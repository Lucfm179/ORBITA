"""
ORBITA — Collision-probability estimation via Monte Carlo simulation.

For each conjunction, we perturb the propagated positions of both
objects at TCA with Gaussian noise (representing positional uncertainty)
and count how many realisations result in the objects being closer than
their combined hard-body radius.

Public API
----------
- estimate_combined_radius(type1, type2) → float  (km)
- monte_carlo_probability(sat1, sat2, tca, ...) → float
"""

from __future__ import annotations

import logging

import numpy as np
from sgp4.api import Satrec

from app.core.propagation import propagate_single

logger = logging.getLogger("orbita.probability")

# ---------------------------------------------------------------------------
# Typical object radii (km)  — conservative round values
# ---------------------------------------------------------------------------
_RADIUS_MAP: dict[str, float] = {
    "payload": 0.005,       # ~5 m
    "debris": 0.001,        # ~1 m
    "rocket body": 0.003,   # ~3 m
    "unknown": 0.002,
}


def estimate_combined_radius(type1: str, type2: str) -> float:
    """
    Return the combined hard-body radius (km) for two objects based on
    their types.

    Parameters
    ----------
    type1, type2 : str
        Object types (payload / debris / rocket body / unknown).

    Returns
    -------
    float
        Sum of individual radii in km.
    """
    r1 = _RADIUS_MAP.get(type1, _RADIUS_MAP["unknown"])
    r2 = _RADIUS_MAP.get(type2, _RADIUS_MAP["unknown"])
    return r1 + r2


def monte_carlo_probability(
    sat1_satrec: Satrec,
    sat2_satrec: Satrec,
    tca_dt,
    type1: str = "payload",
    type2: str = "debris",
    n_samples: int = 500,
    sigma_km: float = 1.0,
) -> float:
    """
    Estimate collision probability using Monte Carlo sampling.

    Algorithm
    ---------
    1. Propagate both satellites to TCA to get nominal positions.
    2. For each sample, add independent 3-D Gaussian noise (σ = sigma_km)
       to both position vectors.
    3. Compute the distance between perturbed positions.
    4. If distance < combined hard-body radius → collision.
    5. Probability ≈ #collisions / #samples.

    Parameters
    ----------
    sat1_satrec, sat2_satrec : Satrec
        SGP4 satellite records.
    tca_dt : datetime
        Time of closest approach (UTC).
    type1, type2 : str
        Object types for radius estimation.
    n_samples : int
        Number of Monte Carlo realisations (default 500).
    sigma_km : float
        1-σ positional uncertainty in each axis (km).

    Returns
    -------
    float
        Estimated collision probability ∈ [0, 1].
    """
    try:
        pos1_nom, _ = propagate_single(sat1_satrec, tca_dt)
        pos2_nom, _ = propagate_single(sat2_satrec, tca_dt)
    except RuntimeError as exc:
        logger.warning("Propagation failed at TCA: %s", exc)
        return 0.0

    combined_r = estimate_combined_radius(type1, type2)

    rng = np.random.default_rng()
    # Shape (n_samples, 3) noise for each object
    noise1 = rng.normal(0.0, sigma_km, size=(n_samples, 3))
    noise2 = rng.normal(0.0, sigma_km, size=(n_samples, 3))

    # Perturbed positions  →  (n_samples, 3)
    p1 = pos1_nom + noise1
    p2 = pos2_nom + noise2

    # Euclidean distances  →  (n_samples,)
    dists = np.linalg.norm(p1 - p2, axis=1)

    collisions = int(np.sum(dists < combined_r))
    probability = collisions / n_samples

    logger.debug(
        "MC probability: %d / %d = %.6f  (combined_r=%.4f km, σ=%.2f km)",
        collisions, n_samples, probability, combined_r, sigma_km,
    )
    return probability
