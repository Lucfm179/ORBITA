"""
ORBITA — Feature extraction for the ML risk-triage model.

Transforms a conjunction dict (as stored in ``screening.CONJUNCTIONS``)
into a flat NumPy feature vector suitable for the GradientBoosting
classifier.

Feature vector layout (7 features)
-----------------------------------
0  miss_distance_km
1  relative_velocity_kms
2  probability
3  tle_age_hours
4  primary_type_encoded   (payload=0, debris=1, rocket body=2, unknown=3)
5  secondary_type_encoded
6  altitude_km            (approximate altitude at TCA — perigee of primary)
"""

from __future__ import annotations

import numpy as np

# ---------------------------------------------------------------------------
# Object-type encoding map
# ---------------------------------------------------------------------------
_TYPE_ENCODING: dict[str, int] = {
    "payload": 0,
    "debris": 1,
    "rocket body": 2,
    "unknown": 3,
}


def _encode_type(object_type: str) -> int:
    """Map an object-type string to its integer encoding."""
    return _TYPE_ENCODING.get(object_type, 3)


def extract_features(conjunction: dict) -> np.ndarray:
    """
    Extract a feature vector from a conjunction record.

    Parameters
    ----------
    conjunction : dict
        A conjunction dict as stored by ``screening.CONJUNCTIONS``.
        Expected keys:
        - miss_distance_km : float
        - relative_velocity_kms : float
        - probability : float
        - tle_age_hours : float
        - primary_type : str
        - secondary_type : str
        - altitude_km : float   (approximate orbital altitude)

    Returns
    -------
    np.ndarray, shape (7,)
        Feature vector ready for model prediction.
    """
    features = np.array([
        conjunction.get("miss_distance_km", 10.0),
        conjunction.get("relative_velocity_kms", 10.0),
        conjunction.get("probability", 0.0),
        conjunction.get("tle_age_hours", 24.0),
        float(_encode_type(conjunction.get("primary_type", "unknown"))),
        float(_encode_type(conjunction.get("secondary_type", "unknown"))),
        conjunction.get("altitude_km", 600.0),
    ], dtype=np.float64)

    return features
