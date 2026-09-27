"""CRASDI: end-to-end computation of the CRAck Structural Difference Index.

The `crasdi()` entry point accepts a Testing and a GT crack map in either form:
raster crack maps (image files / numpy arrays, vectorized internally) or crack
vector maps (GeoJSON LineString features). It runs vectorization (if needed),
segment matching, and CRASDI scoring in one call. A pre-matched clusters JSON
(the output of the former two-step workflow) is still accepted as a single input.
"""

import json
import os
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from shapely.geometry import LineString

try:  # package import (from crasdi import crasdi)
    from .CRASDI_helpers import (
        calculate_length,
        get_width_list,
        jsd,
        calculate_ehd_similarity,
        get_orientation_distribution,
        weighted_average_distributions,
        _crasdi_plot_from_results,
        _extract_key_from_path
    )
    from .matching import match_crack_segments, build_matched_data
    from .vectorize import vectorize_crack_map, save_vector_map
except ImportError:  # flat import (scripts run from inside Code/crasdi/)
    from CRASDI_helpers import (
        calculate_length,
        get_width_list,
        jsd,
        calculate_ehd_similarity,
        get_orientation_distribution,
        weighted_average_distributions,
        _crasdi_plot_from_results,
        _extract_key_from_path
    )
    from matching import match_crack_segments, build_matched_data
    from vectorize import vectorize_crack_map, save_vector_map

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}


def _resolve_input(source, threshold, invert, min_branch_px):
    """Turn any supported input into a crack vector map (FeatureCollection dict)."""
    if isinstance(source, np.ndarray):
        return vectorize_crack_map(source, threshold=threshold,
                                   invert=invert, min_branch_px=min_branch_px)
    if isinstance(source, dict):
        if "features" in source:
            return source
        raise ValueError("Input dict is not a crack vector map (no 'features' key).")
    if isinstance(source, (str, Path)):
        path = Path(source)
        if path.suffix.lower() in _IMAGE_EXTS:
            return vectorize_crack_map(path, threshold=threshold,
                                       invert=invert, min_branch_px=min_branch_px)
        with open(path, "r") as f:
            data = json.load(f)
        if "features" in data:
            return data
        raise ValueError(f"{path} is neither a crack vector map (GeoJSON) nor a raster crack map.")
    raise TypeError(f"Unsupported input type: {type(source)!r}. "
                    "Expected an image path, GeoJSON path, numpy array, or vector-map dict.")


def _vector_map_lines(vector_map):
    """Extract shapely LineStrings (and their aligned features) from a vector map."""
    lines, features = [], []
    for feature in vector_map.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") == "LineString" and len(geom.get("coordinates", [])) >= 2:
            lines.append(LineString(geom["coordinates"]))
            features.append(feature)
    return lines, features


def _vector_map_hw(vector_map):
    image_props = vector_map.get("properties", {}).get("image", {})
    return image_props.get("height_px", 0), image_props.get("width_px", 0)


def _score_matched_data(data, mode='default', pixel_size=4.0, alpha=1.0):
    """Compute CRASDI from matched-clusters data (dict). Returns the results dict."""
    matched_clusters = data.get("matched_clusters", [])
    unmatchedTesting = data.get("unmatched_Testing", [])
    unmatchedGT = data.get("unmatched_GT", [])
    metadata = data.get("metadata", {})
    height = metadata.get("image_height_px", metadata.get("image_height", 1527))
    width = metadata.get("image_width_px", metadata.get("image_width", 1020))

    results = {
        "matched_clusters": [],
        "unmatched_Testing": [],
        "unmatched_GT": [],
        "metadata": {
            "image_height": height,
            "image_width": width
        }
    }

    # --- 1. Accumulators for Aggregation ---
    attr_weighted_sums = {"EHD": 0.0, "width": 0.0, "orientation": 0.0, "length": 0.0}
    total_gt_matched_length = 0.0
    actual_matched_length = 0.0

    # --- 2. Process Matched Clusters ---
    for cluster in matched_clusters:
        featuresTesting = cluster.get("from_file_Testing", [])
        featuresGT = cluster.get("from_file_GT", [])
        linesTesting = [LineString(f["geometry"]["coordinates"]) for f in featuresTesting if isinstance(f, dict)]
        linesGT = [LineString(f["geometry"]["coordinates"]) for f in featuresGT if isinstance(f, dict)]

        # Attribute Calculations
        geom_score, fp_penalty, fn_penalty = calculate_ehd_similarity(linesTesting, linesGT, pixel_size=pixel_size, image_size=(height, width))

        # Width JSD
        widths_test = get_width_list([f["properties"] for f in featuresTesting if isinstance(f, dict)])
        widths_gt = get_width_list([f["properties"] for f in featuresGT if isinstance(f, dict)])

        bins = max(len(widths_test), len(widths_gt), 5)
        hist_test, _ = np.histogram(widths_test, bins=bins, density=True)
        hist_gt, _ = np.histogram(widths_gt, bins=bins, density=True)
        width_score = jsd(np.clip(hist_test, 1e-9, None), np.clip(hist_gt, 1e-9, None))

        # Orientation JSD
        step_size = 1.0
        orientTesting = [get_orientation_distribution(line, step_size=step_size) for line in linesTesting]
        orientGT = [get_orientation_distribution(line, step_size=step_size) for line in linesGT]
        distTesting = weighted_average_distributions(orientTesting, linesTesting)
        distGT = weighted_average_distributions(orientGT, linesGT)
        orientation_score = jsd(distTesting, distGT)

        # Length Diff
        lenTesting = sum(calculate_length(line, pixel_size=pixel_size) for line in linesTesting) if linesTesting else 0.0
        lenGT = sum(calculate_length(line, pixel_size=pixel_size) for line in linesGT) if linesGT else 0.0
        length_diff_score = min(abs(lenTesting - lenGT), lenGT) / max(lenGT, 1e-6)

        cluster["scores"] = {
            "fp_penalty": round(fp_penalty, 3),
            "fn_penalty": round(fn_penalty, 3),
            "EHD": round(geom_score, 3),
            "width": round(width_score, 3),
            "orientation": round(orientation_score, 3),
            "length": round(length_diff_score, 3),
            "length_Testing": round(lenTesting, 3),
            "length_GT": round(lenGT, 3)
        }
        results["matched_clusters"].append(cluster)

        # AGGREGATION STEP: w_i = l(Gi)
        w_i = lenGT
        total_gt_matched_length += w_i
        actual_matched_length += min(lenTesting, lenGT)
        attr_weighted_sums["EHD"] += w_i * geom_score
        attr_weighted_sums["width"] += w_i * width_score
        attr_weighted_sums["orientation"] += w_i * orientation_score
        attr_weighted_sums["length"] += w_i * length_diff_score

    # --- 3. Process Unmatched Lengths ---
    unmatched_len = 0.0
    unmatched_Testing_len = 0.0
    unmatched_GT_len = 0.0
    for u in unmatchedTesting:
        lines = [LineString(u["geometry"]["coordinates"])]
        length = sum(calculate_length(line, pixel_size=pixel_size) for line in lines)
        unmatched_len += length
        unmatched_Testing_len += length
        results["unmatched_Testing"].append(u)

    for u in unmatchedGT:
        lines = [LineString(u["geometry"]["coordinates"])]
        length = sum(calculate_length(line, pixel_size=pixel_size) for line in lines)
        unmatched_len += length
        unmatched_GT_len += length
        results["unmatched_GT"].append(u)

    # --- 4. CRASDI Calculation ---
    CRASDI_CONFIGS = {
        "geom": {"EHD": 1.0, "width": 0.0, "orientation": 0.0, "length": 0.0},
        "att":  {"EHD": 0.0, "width": 1/3, "orientation": 1/3, "length": 1/3},
        "default": {"EHD": 0.25, "width": 0.25, "orientation": 0.25, "length": 0.25}
    }
    beta = CRASDI_CONFIGS.get(mode, CRASDI_CONFIGS["default"])

    # Denominator = Sum(wi) + alpha * Lu
    denominator = total_gt_matched_length + (alpha * unmatched_len)
    d_bar = {}

    key_map = {"EHD": "EHD", "width": "width", "orientation": "orientation", "length": "length"}

    for internal_key, beta_key in key_map.items():
        if denominator > 0:
            # Formula: (Sum(wi * Da) + alpha * Lu * 1.0) / denominator
            numerator = attr_weighted_sums[internal_key] + (alpha * unmatched_len * 1.0)
            d_bar[beta_key] = numerator / denominator
        else:
            d_bar[beta_key] = 1.0 if unmatched_len > 0 else 0.0

    crasdi_score = sum(beta[k] * d_bar[k] for k in beta.keys())

    # --- 5. Final Reporting ---
    results["CRASDI_mode"] = mode
    results["CRASDI"] = round(crasdi_score, 4)
    results["unmatched_length_GT_mm"] = round(unmatched_GT_len, 4)
    results["unmatched_length_Testing_mm"] = round(unmatched_Testing_len, 4)
    results["matched_length_total_mm"] = round(actual_matched_length, 4)
    results["d_bar_ehd"] = round(d_bar["EHD"], 4)
    results["d_bar_width"] = round(d_bar["width"], 4)
    results["d_bar_orientation"] = round(d_bar["orientation"], 4)
    results["d_bar_length"] = round(d_bar["length"], 4)

    return results


def crasdi(test, gt=None, output_path="crasdi_result.json", vis_path=None,
           mode='default', pixel_size=4.0, alpha=1.0,
           epsilon=5.0, overlap_threshold=0.5,
           threshold=127, invert=False, min_branch_px=2,
           save_vector_maps=None):
    """Compute CRASDI between a Testing and a GT crack map.

    Inputs (each of `test` / `gt`, independently):
    - raster crack map: image path (.png/.jpg/...) or 2-D numpy array — vectorized internally;
    - crack vector map: GeoJSON path or FeatureCollection dict (LineString features).

    Legacy single-input form: `crasdi(matched_clusters_json)` with gt=None accepts the
    pre-matched clusters JSON produced by the former separate matching step.

    Parameters:
    - output_path: where to write the result JSON (None: don't write).
    - vis_path: directory for the CRASDI visualization PNG (None: no visualization).
    - mode: component weights, 'default' | 'geom' | 'att'.
    - pixel_size: mm per pixel (default 4.0).
    - alpha: penalty weight for unmatched length.
    - epsilon, overlap_threshold: segment-matching parameters (buffer in px, overlap fraction).
    - threshold, invert, min_branch_px: vectorization parameters (raster inputs only).
    - save_vector_maps: optional directory; vectorized maps of raster inputs are saved
      there as GeoJSON for inspection/reuse.

    Returns the results dict (also written to `output_path` if given).
    """
    if gt is None:
        # Legacy path: single pre-matched clusters JSON (dict or path).
        if isinstance(test, (str, Path)):
            with open(test, "r") as f:
                data = json.load(f)
        elif isinstance(test, dict):
            data = test
        else:
            raise TypeError("Single-input mode expects a matched-clusters JSON path or dict.")
        if "matched_clusters" not in data:
            raise ValueError("Single-input mode requires matched-clusters data "
                             "(output of the matching step); to compare two crack maps, "
                             "pass them as crasdi(test, gt).")
    else:
        map_test = _resolve_input(test, threshold, invert, min_branch_px)
        map_gt = _resolve_input(gt, threshold, invert, min_branch_px)

        h_t, w_t = _vector_map_hw(map_test)
        h_g, w_g = _vector_map_hw(map_gt)
        if all((h_t, w_t, h_g, w_g)) and (h_t, w_t) != (h_g, w_g):
            raise ValueError(f"Image dimensions do not match: {h_t}x{w_t} vs {h_g}x{w_g}")
        height = h_g or h_t
        width = w_g or w_t

        if save_vector_maps:
            os.makedirs(save_vector_maps, exist_ok=True)
            save_vector_map(map_test, os.path.join(save_vector_maps, "testing_vector_map.geojson"))
            save_vector_map(map_gt, os.path.join(save_vector_maps, "gt_vector_map.geojson"))

        lines_test, features_test = _vector_map_lines(map_test)
        lines_gt, features_gt = _vector_map_lines(map_gt)

        clusters, unmatched_test, unmatched_gt = match_crack_segments(
            lines_test, lines_gt, epsilon=epsilon, overlap_threshold=overlap_threshold)

        data = build_matched_data(features_test, features_gt, clusters,
                                  unmatched_test, unmatched_gt, height, width)

    results = _score_matched_data(data, mode=mode, pixel_size=pixel_size, alpha=alpha)

    if output_path:
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)

    # --- Visualization: save CRASDI plot only ---
    if vis_path:
        try:
            key = _extract_key_from_path(output_path if output_path else "crasdi")
            key = key.replace("_matched_clusters", "").replace("_crasdi_result", "")
            crasdi_plot_path = os.path.join(vis_path, f"{key}_visualization_CRASDI.png")
            os.makedirs(os.path.dirname(crasdi_plot_path), exist_ok=True)
            _crasdi_plot_from_results(results, crasdi_plot_path)
            print(f"[CRASDI] Visualization saved to {crasdi_plot_path}")
        except Exception as e:
            print(f"[CRASDI] Visualization generation failed: {e}")

    return results


def visualize_similarity_scores(json_path, save_path="visualization.png", show=False):
    """
    Visualize link-level similarity scores for matched and unmatched crack clusters.
    Each score type is plotted in a separate figure. A version without colorbar is saved individually
    for high quality if save_path is provided.

    Parameters:
    - json_path: str, path to JSON file with assessment scores.
    - save_path: str, base path to save the visualizations (optional). Each plot is saved as <save_path>_<score_type>.png.
    - summary_panel: bool, if True create CRASDI summary panel after individual score visualizations are saved.
    """
    with open(json_path, 'r') as f:
        data = json.load(f)

    height = data.get("metadata", {}).get("image_height", 1527)
    width = data.get("metadata", {}).get("image_width", 1020)

    score_types = ["EHD", "width_difference", "orientation_difference", "length_difference"]
    score_key_map = {
        "EHD": "EHD",
        "width_difference": "width",
        "orientation_difference": "orientation",
        "length_difference": "length",
    }
    titles = ["EHD", "Width Difference (mm)", "Orientation Difference", "Length Difference (mm)"]

    def plot_features(ax, features, score, linestyle, cmap, score_type):
        norm = Normalize(vmin=0, vmax=1)
        color = cmap(norm(score))
        for feature in features:
            try:
                line = LineString(feature["geometry"]["coordinates"])
                ys, xs = line.xy
                ax.plot(xs, ys, linestyle=linestyle, color=color, linewidth=2)
            except (KeyError, TypeError) as e:
                print(f"Warning: Skipping feature with invalid geometry: {feature}, error: {e}")

    for score_type, title in zip(score_types, titles):
        # Create figure for display with colorbar
        fig_display, ax_display = plt.subplots(figsize=(width/100, height/100))
        ax_display.set_facecolor('black')
        ax_display.set_aspect('equal')
        ax_display.set_xlim(0, width)
        ax_display.set_ylim(0, height)
        ax_display.invert_yaxis()
        ax_display.set_title(title)

        cmap = plt.get_cmap("Reds")
        num_matched = 0
        for cluster in data.get("matched_clusters", []):
            score = cluster.get("scores", {}).get(score_key_map[score_type], 0)
            plot_features(ax_display, cluster["from_file_Testing"], score, '-', cmap, score_type)
            plot_features(ax_display, cluster["from_file_GT"], score, '--', cmap, score_type)
            num_matched += len(cluster["from_file_Testing"]) + len(cluster["from_file_GT"])

        num_unmatched_testing = 0
        unmatchedLineWidth = 1.5
        unmatchedLineColor = 'cyan'
        for unmatched in data.get("unmatched_Testing", []):
            try:
                line = LineString(unmatched["geometry"]["coordinates"])
                ys, xs = line.xy
                ax_display.plot(xs, ys, color=unmatchedLineColor, linestyle='-', linewidth=unmatchedLineWidth)
                num_unmatched_testing += 1
            except (KeyError, TypeError) as e:
                print(f"Warning: Skipping unmatched_Testing feature with invalid geometry: {unmatched}, error: {e}")

        num_unmatched_gt = 0
        for unmatched in data.get("unmatched_GT", []):
            try:
                line = LineString(unmatched["geometry"]["coordinates"])
                ys, xs = line.xy
                ax_display.plot(xs, ys, color=unmatchedLineColor, linestyle='--', linewidth=unmatchedLineWidth)
                num_unmatched_gt += 1
            except (KeyError, TypeError) as e:
                print(f"Warning: Skipping unmatched_GT feature with invalid geometry: {unmatched}, error: {e}")

        print(f"Plot {title}: {num_matched} matched segments, {num_unmatched_testing} unmatched Testing segments, {num_unmatched_gt} unmatched GT segments")

        norm = Normalize(vmin=0, vmax=1)
        sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
        cbar = plt.colorbar(sm, ax=ax_display, label=title)

        # Adjust layout for display
        plt.tight_layout()
        fig_display.subplots_adjust(left=0.1, bottom=0.1, right=0.9, top=0.9, wspace=0.1, hspace=0.1)
        cbar.ax.yaxis.set_label_position('right')
        cbar.ax.yaxis.set_offset_position('right')

        # Create a separate score vis figure for saving without colorbar
        if save_path:
            fig_save, ax_save = plt.subplots(figsize=(width/100, height/100), facecolor='black')
            ax_save.set_facecolor('black')
            ax_save.set_aspect('equal')
            ax_save.set_xlim(0, width)
            ax_save.set_ylim(0, height)
            ax_save.invert_yaxis()
            ax_save.axis('off')

            # Re-plot all features without colorbar
            for cluster in data.get("matched_clusters", []):
                score = cluster.get("scores", {}).get(score_key_map[score_type], 0)
                plot_features(ax_save, cluster["from_file_Testing"], score, '-', cmap, score_type)
                plot_features(ax_save, cluster["from_file_GT"], score, '--', cmap, score_type)

            for unmatched in data.get("unmatched_Testing", []):
                try:
                    line = LineString(unmatched["geometry"]["coordinates"])
                    ys, xs = line.xy
                    ax_save.plot(xs, ys, color=unmatchedLineColor, linestyle='-', linewidth=unmatchedLineWidth)
                except (KeyError, TypeError):
                    continue

            for unmatched in data.get("unmatched_GT", []):
                try:
                    line = LineString(unmatched["geometry"]["coordinates"])
                    ys, xs = line.xy
                    ax_save.plot(xs, ys, color=unmatchedLineColor, linestyle='--', linewidth=unmatchedLineWidth)
                except (KeyError, TypeError):
                    continue

            # Adjust layout for saving
            plt.tight_layout()
            fig_save.subplots_adjust(left=0.1, bottom=0.1, right=0.9, top=0.9, wspace=0.1, hspace=0.1)

            # Save high-quality image without colorbar
            base, ext = os.path.splitext(save_path)
            individual_save_path = f"{base}_{score_type}{ext or '.png'}"
            os.makedirs(os.path.dirname(individual_save_path), exist_ok=True)
            fig_save.savefig(
                individual_save_path, dpi=600, bbox_inches='tight', pad_inches=0,
                facecolor=fig_save.get_facecolor(), edgecolor='none'
            )

            print(f"Saved high-quality plot for {title} to {individual_save_path}")
            plt.close(fig_save)  # Close save figure to avoid clutter

        if show:
            plt.show()  # Display the figure with colorbar


if __name__ == "__main__":
    # Example usage — any combination of raster crack maps and vector maps works:
    results = crasdi(
        "path/to/testing_map.png",       # or .geojson / numpy array / dict
        "path/to/gt_map.geojson",
        output_path="pair_crasdi_result.json",
        vis_path="crasdi_visualizations",
        mode="default", pixel_size=4.0, alpha=1.0,
    )
    print("CRASDI:", results["CRASDI"])
