
import os
from pathlib import Path
from matplotlib import pyplot as plt
from matplotlib.colors import Normalize
import numpy as np
from scipy.spatial import cKDTree
from scipy.spatial.distance import jensenshannon
from shapely.geometry import LineString
from PIL import Image
import matplotlib.cm as cm
import matplotlib.gridspec as gridspec


def calculate_orientation(line):
    if len(line.coords) < 2:
        return np.array([0.0, 0.0])
    x1, y1 = line.coords[0]
    x2, y2 = line.coords[-1]
    vec = np.array([x2 - x1, y2 - y1])
    norm = np.linalg.norm(vec)
    return vec / norm if norm != 0 else np.array([0.0, 0.0])

def calculate_length(line, pixel_size=4.0):
    coords = line.coords
    if len(coords) < 2:
        return 0.0
    total_length = 0.0
    for i in range(len(coords) - 1):
        x1, y1 = coords[i]
        x2, y2 = coords[i + 1]
        segment_length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        total_length += segment_length
    return total_length * pixel_size

def average_width(props):
    widths = []
    for p in props:
        if "width_mm" in p:
            w = p["width_mm"]
            if isinstance(w, list):
                widths.extend(w)
            elif isinstance(w, (int, float)):
                widths.append(w)
        elif "avg_width_mm" in p:
            widths.append(p["avg_width_mm"])
    return np.mean(widths) if widths else 0.0

def get_width_list(props):
    widths = []
    for p in props:
        if "width_mm" in p:
            w = p["width_mm"]
            if isinstance(w, list):
                widths.extend(w)
            elif isinstance(w, (int, float)):
                widths.append(w)
        elif "avg_width_mm" in p:
            widths.append(p["avg_width_mm"])
    return widths if widths else [0.0]  # avoid empty


def weighted_mean_orientation(lines, pixel_size=4.0):
    if not lines:
        return np.array([0.0, 0.0])
    orientations = [calculate_orientation(line) for line in lines]
    lengths = [calculate_length(line, pixel_size) for line in lines]
    total_length = sum(lengths)
    if total_length == 0:
        return np.array([0.0, 0.0])
    weighted_orient = np.sum([o * l for o, l in zip(orientations, lengths)], axis=0) / total_length
    norm = np.linalg.norm(weighted_orient)
    return weighted_orient / norm if norm != 0 else np.array([0.0, 0.0])

def calculate_ehd_similarity(linesTesting, linesGT, pixel_size=4.0, image_size=None):
    """
    Calculate the Enhanced Hausdorff Distance similarity between two sets of LineString objects.
    
    Parameters:
    - linesTesting: list, LineString objects for detected cracks (coordinates in pixels).
    - linesGT: list, LineString objects for ground truth cracks (coordinates in pixels).
    - pixel_size: float, physical size of one pixel in mm (default 4.0 mm).
    - image_size: tuple, (height, width) of reference image in pixels for empty case handling (optional).
    
    Returns:
    - score: float, performance score between 0 and 1 (1 = max distance, 0 = no distance).
    - fp_penalty: float, false positive penalty as a fraction.
    - fn_penalty: float, false negative penalty as a fraction.
    """
    points_Testing = np.array([coord for line in linesTesting for coord in line.coords]) if linesTesting else np.array([])
    points_GT = np.array([coord for line in linesGT for coord in line.coords]) if linesGT else np.array([])
    
    l = 5.0 / pixel_size  # 5mm no-penalty buffer in pixels
    u = 10.0 / pixel_size  # 10mm upper limit in pixels
    
    if len(points_Testing) == 0 or len(points_GT) == 0:
        if image_size is None:
            n = 1000 * 1000
        else:
            n = image_size[0] * image_size[1]
        mse = (len(points_Testing) + len(points_GT)) / (0.01 * n)
        score = min(mse, 1.0)
        fp_penalty = len(points_Testing) / n if len(points_GT) == 0 and len(points_Testing) > 0 else 0
        fn_penalty = len(points_GT) / n if len(points_Testing) == 0 and len(points_GT) > 0 else 0
        return score, fp_penalty, fn_penalty
    
    tree_GT = cKDTree(points_GT)
    tree_Testing = cKDTree(points_Testing)
    
    distances_Testing_to_GT = tree_GT.query(points_Testing)[0]
    penalties_Testing_to_GT = np.where(distances_Testing_to_GT > u, u - l, np.where(distances_Testing_to_GT > l, distances_Testing_to_GT - l, 0))
    h3_Testing_to_GT = np.mean(penalties_Testing_to_GT) if len(penalties_Testing_to_GT) > 0 else 0
    
    distances_GT_to_Testing = tree_Testing.query(points_GT)[0]
    penalties_GT_to_Testing = np.where(distances_GT_to_Testing > u, u - l, np.where(distances_GT_to_Testing > l, distances_GT_to_Testing - l, 0))
    h3_GT_to_Testing = np.mean(penalties_GT_to_Testing) if len(penalties_GT_to_Testing) > 0 else 0
    
    MH = max(h3_Testing_to_GT, h3_GT_to_Testing)
    score = MH / (u - l)
    fp_penalty = h3_Testing_to_GT / (u - l)
    fn_penalty = h3_GT_to_Testing / (u - l)
    
    return score, fp_penalty, fn_penalty

def get_orientation_distribution(line, step_size=1.0, n_bins=36):
    """Compute an axial orientation histogram (0–π) along a LineString."""
    length = line.length
    if length == 0:
        return np.zeros(n_bins)
    
    # Sample along the line
    distances = np.arange(0, length, step_size)
    points = [line.interpolate(d) for d in distances]
    coords = np.array([[p.x, p.y] for p in points])
    
    # Compute local tangents
    deltas = np.diff(coords, axis=0)
    if len(deltas) == 0:
        return np.zeros(n_bins)
    
    # Compute orientation angles (axial: 0–π)
    angles = np.arctan2(deltas[:, 1], deltas[:, 0])
    angles = np.abs(angles)  # make axial (ignore direction)
    angles = np.mod(angles, np.pi)
    
    # Histogram normalized to probability distribution
    hist, _ = np.histogram(angles, bins=n_bins, range=(0, np.pi), density=False)
    hist = hist.astype(float) / hist.sum() if hist.sum() > 0 else np.zeros_like(hist, dtype=float)
    return hist

def jsd(p, q):
    """
    Jensen–Shannon Divergence (symmetric, bounded 0–1).
    """
    p = np.asarray(p, dtype=float)
    q = np.asarray(q, dtype=float)
    p = np.clip(p, 1e-12, 1) # Small epsilon to avoid log(0)
    q = np.clip(q, 1e-12, 1)
    p /= p.sum()
    q /= q.sum()
    with np.errstate(invalid='ignore'):
        value = jensenshannon(p, q, base=2.0) # SciPy returns sqrt(JS divergence) -- good to be used as a metric
    # Near-identical distributions can yield a tiny negative divergence under the
    # square root (NaN); the divergence is 0 in that case.
    return float(value) if np.isfinite(value) else 0.0

def weighted_average_distributions(dists, lines):
    """
    Compute average distributions (weighted by line length)
    """
    if not dists or not lines:
        return np.zeros_like(dists[0]) if dists else np.zeros(36)
    lengths = np.array([line.length for line in lines])
    weights = lengths / lengths.sum()
    return np.average(dists, axis=0, weights=weights)

def _crasdi_plot_from_results(results, save_path):
    """Generate and save a CRASDI visualization from in-memory results dict."""
    height = results.get("metadata", {}).get("image_height", 1527)
    width = results.get("metadata", {}).get("image_width", 1020)
    weights = results.get("CRASDI_mode", "default")
    if weights == "geom":
        beta = {"EHD": 1.0, "width": 0.0, "orientation": 0.0, "length": 0.0}
    elif weights == "att":
        beta = {"EHD": 0.0, "width": 1/3, "orientation": 1/3, "length": 1/3}
    else:
        beta = {"EHD": 0.25, "width": 0.25, "orientation": 0.25, "length": 0.25}

    fig, ax_display = plt.subplots(figsize=(width/100, height/100), facecolor='black')
    ax_display.set_facecolor('black')
    ax_display.set_aspect('equal')
    ax_display.set_xlim(0, width)
    ax_display.set_ylim(0, height)
    ax_display.invert_yaxis()
    # ax_display.set_title("CRASDI Score")
    ax_display.axis('off')

    cmap = plt.get_cmap("Reds")
    norm = Normalize(vmin=0, vmax=1)

    for cluster in results.get("matched_clusters", []):
        scores = cluster.get("scores", {})
        score = (
            beta["EHD"] * scores.get("EHD", 0) +
            beta["width"] * scores.get("width_difference", scores.get("width", 0)) +
            beta["orientation"] * scores.get("orientation_difference", scores.get("orientation", 0)) +
            beta["length"] * scores.get("length_difference", scores.get("length", 0))
        )
        color = cmap(norm(score))
        for feature in cluster.get("from_file_Testing", []):
            try:
                line = LineString(feature["geometry"]["coordinates"])
                ys, xs = line.xy
                ax_display.plot(xs, ys, linestyle='-', color=color, linewidth=2)
            except Exception:
                continue
        for feature in cluster.get("from_file_GT", []):
            try:
                line = LineString(feature["geometry"]["coordinates"])
                ys, xs = line.xy
                ax_display.plot(xs, ys, linestyle='--', color=color, linewidth=2)
            except Exception:
                continue

    unmatchedLineWidth = 1.5
    unmatchedLineColor = 'cyan'
    for unmatched in results.get("unmatched_Testing", []):
        try:
            line = LineString(unmatched["geometry"]["coordinates"])
            ys, xs = line.xy
            ax_display.plot(xs, ys, color=unmatchedLineColor, linestyle='-', linewidth=unmatchedLineWidth)
        except Exception:
            continue
    for unmatched in results.get("unmatched_GT", []):
        try:
            line = LineString(unmatched["geometry"]["coordinates"])
            ys, xs = line.xy
            ax_display.plot(xs, ys, color=unmatchedLineColor, linestyle='--', linewidth=unmatchedLineWidth)
        except Exception:
            continue

    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    plt.tight_layout()

    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        fig.savefig(
            save_path, dpi=600, bbox_inches='tight', pad_inches=0,
            facecolor=fig.get_facecolor(), edgecolor='none'
        )
        print(f"Saved CRASDI plot to {save_path}")
    plt.close(fig)

def _load_image(image_path):
    if not image_path or not os.path.exists(image_path):
        return None
    img = Image.open(image_path)
    try:
        return img.convert("RGB")
    except Exception:
        return img

def _add_image_axis(ax, image, title: str):
    ax.axis("off")
    if image is None:
        ax.text(0.5, 0.5, title, ha="center", va="center", fontsize=12, color="gray")
        return
    ax.imshow(image)
    if title:
        ax.set_title(title, fontsize=10)

def _find_first_two_images(input_dir, key_str):
    exts = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
    candidates = [p for p in Path(input_dir).iterdir() if p.is_file() and p.suffix.lower() in exts and p.name.startswith(f"{key_str}_")]
    return sorted(candidates)[:2]

def _extract_key_from_path(path_like):
    """Extract the dataset/sample key from a filename or path while preserving underscores."""
    stem = Path(str(path_like)).stem
    if "_similarity_visualization_" in stem:
        return stem.split("_similarity_visualization_", 1)[0]
    if stem.endswith("_qaqc_result"):
        return stem[: -len("_qaqc_result")]
    if stem.endswith("_CRASDI_visualization"):
        return stem[: -len("_CRASDI_visualization")]
    return stem
