"""Vectorization of raster crack maps.

Converts a binary crack map (image file or numpy array) into a crack vector
map with the same schema and conventions as the released vector data:

    {
      "type": "FeatureCollection",
      "properties": {"image": {"width_px": W, "height_px": H}},
      "features": [
        {"type": "Feature",
         "geometry": {"type": "LineString", "coordinates": [[y, x], ...]},
         "properties": {"name": "branch", "width_mm": [w1, w2, ...]}},
        ...
      ]
    }

Coordinates are [row, col] pixel positions; per-point `width_mm` values have
0.0 at the two branch endpoints. As in the paper, spatial quantities operate in
pixel units with physical values assuming the nominal design resolution of
4 mm/pixel; both maps of a compared pair must use the same convention.
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.morphology import thin

_NEIGHBOR_OFFSETS = [(-1, -1), (-1, 0), (-1, 1),
                     (0, -1),           (0, 1),
                     (1, -1),  (1, 0),  (1, 1)]


def _to_binary_mask(image, threshold=127, invert=False):
    """Load `image` (path or 2-D array) and return a boolean crack mask."""
    if isinstance(image, (str, Path)):
        image = np.array(Image.open(image).convert("L"))
    image = np.asarray(image)
    if image.ndim == 3:
        image = image.mean(axis=2)
    if image.dtype == bool:
        mask = image
    else:
        mask = image > threshold
    if invert:
        mask = ~mask
    return mask


def _fill_small_holes(mask, max_hole_px=10):
    """Fill enclosed background holes of at most `max_hole_px` pixels."""
    if max_hole_px <= 0:
        return mask
    labels, n = ndimage.label(~mask)
    if n == 0:
        return mask
    border_labels = set(np.unique(labels[0, :])) | set(np.unique(labels[-1, :])) \
        | set(np.unique(labels[:, 0])) | set(np.unique(labels[:, -1]))
    sizes = ndimage.sum_labels(~mask, labels, index=np.arange(1, n + 1))
    fill_ids = [i for i in range(1, n + 1) if i not in border_labels and sizes[i - 1] <= max_hole_px]
    if fill_ids:
        mask = mask | np.isin(labels, fill_ids)
    return mask


def _trace_branches(skeleton):
    """Decompose an 8-connected skeleton into branches (pixel paths)."""
    ys, xs = np.nonzero(skeleton)
    pixels = set(zip(ys.tolist(), xs.tolist()))

    def neighbors(p):
        y, x = p
        return [(y + dy, x + dx) for dy, dx in _NEIGHBOR_OFFSETS if (y + dy, x + dx) in pixels]

    degree = {p: len(neighbors(p)) for p in pixels}
    nodes = {p for p, d in degree.items() if d != 2}

    def edge_key(a, b):
        return (a, b) if a <= b else (b, a)

    branches = []
    visited_edges = set()

    # Walk from every node along each incident edge until the next node.
    for node in nodes:
        for nb in neighbors(node):
            if edge_key(node, nb) in visited_edges:
                continue
            path = [node, nb]
            visited_edges.add(edge_key(node, nb))
            prev, cur = node, nb
            while cur not in nodes:
                nxt = [q for q in neighbors(cur) if q != prev]
                if not nxt:
                    break
                nxt = nxt[0]
                if edge_key(cur, nxt) in visited_edges:
                    break
                visited_edges.add(edge_key(cur, nxt))
                path.append(nxt)
                prev, cur = cur, nxt
            branches.append(path)

    # Remaining pixels are degree-2 cycles (closed loops with no endpoint/junction).
    touched = set()
    for b in branches:
        touched.update(b)
    remaining = pixels - touched
    while remaining:
        start = next(iter(remaining))
        remaining.discard(start)
        path = [start]
        prev, cur = None, start
        while True:
            candidates = [q for q in neighbors(cur) if q != prev]
            nxt = next((q for q in candidates if q in remaining), None)
            if nxt is None:
                if start in candidates and len(path) > 2:
                    path.append(start)  # close the loop
                break
            remaining.discard(nxt)
            path.append(nxt)
            prev, cur = cur, nxt
        branches.append(path)

    return branches


def _perpendicular_widths(path, mask, max_width_expand=20.0):
    """Per-point branch width along a traced path; branch endpoints get width 0."""
    n = len(path)
    if n == 1:
        return [0.0]

    h, w = mask.shape
    widths_interior = []
    for j in range(1, n - 1):
        cy, cx = path[j]
        dy = path[j + 1][0] - path[j - 1][0]
        dx = path[j + 1][1] - path[j - 1][1]
        norm = np.hypot(-dx, dy)
        if norm == 0:
            widths_interior.append(0.0)
            continue
        oy, ox = -dx / norm, dy / norm

        total = 0.0
        for sy, sx in ((oy, ox), (-oy, -ox)):
            weight = 0.25
            while True:
                py, px = cy + weight * sy, cx + weight * sx
                if not (0 <= py < h and 0 <= px < w):
                    break
                if mask[int(py), int(px)]:
                    weight += 0.5
                    if weight > max_width_expand:
                        break
                else:
                    break
            total += weight
        widths_interior.append(total)

    return [0.0, *widths_interior, 0.0]


def vectorize_crack_map(image, threshold=127, invert=False, min_branch_px=2,
                        max_hole_px=10, max_width_expand=20.0):
    """Vectorize a raster crack map into a crack vector map (FeatureCollection dict).

    Parameters:
    - image: str/Path to an image file, or a 2-D numpy array (grayscale or bool).
             Cracks are assumed bright on dark background (set invert=True otherwise).
    - threshold: int, grayscale binarization threshold (foreground = value > threshold).
    - invert: bool, set True for dark cracks on bright background.
    - min_branch_px: int, discard branches with fewer skeleton pixels than this.
    - max_hole_px: int, fill enclosed holes up to this many pixels.
    - max_width_expand: float, cap on the width measurement per side, in px.
    """
    mask = _to_binary_mask(image, threshold=threshold, invert=invert)
    height, width = mask.shape

    filled = _fill_small_holes(mask, max_hole_px=max_hole_px)
    # thin() mutates a bool input in place — protect `filled`, widths are measured on it
    skeleton = thin(filled.copy())

    features = []
    for path in _trace_branches(skeleton):
        if len(path) < max(min_branch_px, 2):
            continue
        widths = _perpendicular_widths(path, filled, max_width_expand=max_width_expand)
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[int(y), int(x)] for y, x in path]
            },
            "properties": {
                "name": "branch",
                "width_mm": [round(float(v), 2) for v in widths]
            }
        })

    return {
        "type": "FeatureCollection",
        "properties": {"image": {"width_px": int(width), "height_px": int(height)}},
        "features": features
    }


def save_vector_map(vector_map, output_path):
    with open(output_path, "w") as f:
        json.dump(vector_map, f, indent=2)
    return output_path
