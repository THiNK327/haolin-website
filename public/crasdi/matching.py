"""Segment matching between two crack vector maps.

Buffers each ground-truth segment by `epsilon` pixels, links test segments with
sufficient overlap, and groups linked segments into matched clusters.
"""

import json

import matplotlib.pyplot as plt
from shapely.geometry import LineString


def load_geojson_imageHW(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    image_properties = data.get("properties", {}).get("image", {})
    return image_properties.get("height_px", 0), image_properties.get("width_px", 0)


def load_geojson_lines(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    lines = []
    properties = []
    for feature in data.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") == "LineString":
            coords = geom.get("coordinates", [])
            line = LineString(coords)
            lines.append(line)
            properties.append(feature.get("properties", {}))
    return lines, properties


def match_crack_segments(linesTesting, linesGT, epsilon=5.0, overlap_threshold=0.5):
    N, M = len(linesTesting), len(linesGT)
    overlaps = []
    for i, lineTesting in enumerate(linesTesting):
        for j, lineGT in enumerate(linesGT):
            bufferGT = lineGT.buffer(epsilon)
            inter = lineTesting.intersection(bufferGT)
            overlap_length = 0.0
            if not inter.is_empty and inter.geom_type != 'Point':
                if inter.geom_type == 'LineString':
                    overlap_length = inter.length
                else:
                    overlap_length = sum(geom.length for geom in inter.geoms if geom.geom_type == 'LineString')
            if overlap_length <= 0:
                continue
            fracTesting = overlap_length / lineTesting.length if lineTesting.length > 0 else 0
            fracGT = overlap_length / lineGT.length if lineGT.length > 0 else 0
            if fracTesting >= overlap_threshold or fracGT >= overlap_threshold:
                overlaps.append((i, j))

    clusters = []
    visitedTesting = [False]*N
    visitedGT = [False]*M
    adjTesting = {i: [] for i in range(N)}
    adjGT = {j: [] for j in range(M)}
    for i, j in overlaps:
        adjTesting[i].append(j)
        adjGT[j].append(i)

    for i in range(N):
        if visitedTesting[i]:
            continue
        clusterTesting, clusterGT = [], []
        stack = [('Testing', i)]
        visitedTesting[i] = True
        while stack:
            typ, idx = stack.pop()
            if typ == 'Testing':
                clusterTesting.append(idx)
                for j in adjTesting[idx]:
                    if not visitedGT[j]:
                        visitedGT[j] = True
                        stack.append(('GT', j))
            else:
                clusterGT.append(idx)
                for i2 in adjGT[idx]:
                    if not visitedTesting[i2]:
                        visitedTesting[i2] = True
                        stack.append(('Testing', i2))
        if clusterTesting and clusterGT:
            clusters.append((clusterTesting, clusterGT))

    for j in range(M):
        if visitedGT[j]:
            continue
        clusterTesting, clusterGT = [], []
        stack = [('GT', j)]
        visitedGT[j] = True
        while stack:
            typ, idx = stack.pop()
            if typ == 'GT':
                clusterGT.append(idx)
                for i2 in adjGT[idx]:
                    if not visitedTesting[i2]:
                        visitedTesting[i2] = True
                        stack.append(('Testing', i2))
            else:
                clusterTesting.append(idx)
                for j2 in adjTesting[idx]:
                    if not visitedGT[j2]:
                        visitedGT[j2] = True
                        stack.append(('GT', j2))
        if clusterTesting and clusterGT:
            clusters.append((clusterTesting, clusterGT))

    unmatchedTesting = [i for i in range(N) if not any(i in cTesting for cTesting, cGT in clusters)]
    unmatchedGT = [j for j in range(M) if not any(j in cGT for cTesting, cGT in clusters)]
    return clusters, unmatchedTesting, unmatchedGT


def build_matched_data(featuresTesting, featuresGT, clusters, unmatchedTesting, unmatchedGT, height, width):
    """Assemble the cluster-matching result dict consumed by the CRASDI scoring step."""
    output = {
        "type": "ClusterMatchingResult",
        "metadata": {
            "total_clusters": len(clusters),
            "unmatched_Testing": len(unmatchedTesting),
            "unmatched_GT": len(unmatchedGT),  # this will still reflect the original input count
            "image_height_px": height,
            "image_width_px": width
        },
        "matched_clusters": [],
        "unmatched_Testing": [],
        "unmatched_GT": []
    }

    # Matched clusters
    for cid, (testing_idxs, gt_idxs) in enumerate(clusters):
        matched = {
            "cluster_id": cid,
            "from_file_Testing": [featuresTesting[i] for i in testing_idxs],
            "from_file_GT": [featuresGT[j] for j in gt_idxs]
        }
        output["matched_clusters"].append(matched)

    # Unmatched Testing (as usual)
    for i in unmatchedTesting:
        output["unmatched_Testing"].append(featuresTesting[i])

    # Recompute true unmatched GT to ensure full coverage
    all_gt_indices = set(range(len(featuresGT)))
    matched_gt_indices = set(j for _, gt_idxs in clusters for j in gt_idxs)
    true_unmatched_gt_indices = all_gt_indices - matched_gt_indices

    for j in sorted(true_unmatched_gt_indices):
        output["unmatched_GT"].append(featuresGT[j])

    if set(unmatchedGT) != true_unmatched_gt_indices:
        print(f"Note: {len(true_unmatched_gt_indices)} GT segments marked as unmatched (recomputed to ensure completeness).")

    return output


def save_clusters_with_features(featuresTesting, featuresGT, clusters, unmatchedTesting, unmatchedGT, output_path, height, width):
    output = build_matched_data(featuresTesting, featuresGT, clusters, unmatchedTesting, unmatchedGT, height, width)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    return output_path


def visualize_clusters(linesTesting, linesGT, clusters, unmatchedTesting, unmatchedGT, height, width, save_path=None):
    fig = plt.figure(figsize=(12, 6))
    ax = plt.gca()

    fig = plt.gcf()
    fig.patch.set_alpha(0.0)

    # Set black background for the plot area
    ax.set_facecolor('black')
    ax.set_aspect('equal')
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)

    # Hide axis ticks and borders
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)

    # Plot matched segments: white solid for Testing, white dashed for GT
    for (testing_idxs, gt_idxs) in clusters:
        for ti in testing_idxs:
            ys, xs = zip(*linesTesting[ti].coords)
            ys = [height - y for y in ys]
            ax.plot(xs, ys, color='white', linewidth=2, linestyle='-')
        for gj in gt_idxs:
            ys, xs = zip(*linesGT[gj].coords)
            ys = [height - y for y in ys]
            ax.plot(xs, ys, color='white', linewidth=2, linestyle='--')

    # Plot unmatched segments: orange solid for Testing, green dashed for GT
    for ti in unmatchedTesting:
        ys, xs = zip(*linesTesting[ti].coords)
        ys = [height - y for y in ys]
        ax.plot(xs, ys, color='orange', linewidth=1.5, linestyle='-')
    for gj in unmatchedGT:
        ys, xs = zip(*linesGT[gj].coords)
        ys = [height - y for y in ys]
        ax.plot(xs, ys, color='green', linewidth=1.5, linestyle='--')

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight', pad_inches=0.0)
    plt.show()
