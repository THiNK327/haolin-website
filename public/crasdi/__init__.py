"""CRASDI: CRAck Structural Difference Index.

Typical usage (any combination of raster crack maps and vector maps):

    from crasdi import crasdi
    results = crasdi("prediction.png", "ground_truth.png", output_path="result.json")
    print(results["CRASDI"])
"""

from .CRASDI import crasdi, visualize_similarity_scores
from .matching import (
    match_crack_segments,
    load_geojson_lines,
    load_geojson_imageHW,
    save_clusters_with_features,
)
from .vectorize import vectorize_crack_map, save_vector_map

__all__ = [
    "crasdi",
    "visualize_similarity_scores",
    "match_crack_segments",
    "load_geojson_lines",
    "load_geojson_imageHW",
    "save_clusters_with_features",
    "vectorize_crack_map",
    "save_vector_map",
]
