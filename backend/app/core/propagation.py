"""
ORBITA — Orbit propagation helpers using SGP4.

Provides thin wrappers around the sgp4 library so the rest of the
application can work with ``datetime`` objects and NumPy arrays
without worrying about Julian-date arithmetic.

All positions are in the TEME (True Equator Mean Equinox) reference
frame, in **kilometres**.  Velocities are in **km/s**.

Public API
----------
- datetime_to_jd(dt)                   → (jd, fr)
- propagate_single(satrec, dt)         → (pos, vel)
- propagate_array(satrec, jd, fr)      → (positions, velocities)
- propagate_batch(satrecs, jd, fr)     → (positions, velocities)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Tuple

import numpy as np
from sgp4.api import Satrec, SatrecArray, jday

logger = logging.getLogger("orbita.propagation")


# ---------------------------------------------------------------------------
# Julian-date conversion
# ---------------------------------------------------------------------------

def datetime_to_jd(dt: datetime) -> Tuple[float, float]:
    """
    Convert a Python datetime (UTC) to a two-part Julian date
    ``(jd, fr)`` as expected by the sgp4 library.

    Parameters
    ----------
    dt : datetime
        Must be timezone-aware UTC (or naïve, assumed UTC).

    Returns
    -------
    tuple[float, float]
        jd  — Julian date (whole part)
        fr  — fractional day
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    jd_val, fr_val = jday(
        dt.year, dt.month, dt.day,
        dt.hour, dt.minute, dt.second + dt.microsecond / 1e6,
    )
    return jd_val, fr_val


# ---------------------------------------------------------------------------
# Single-satellite, single-epoch propagation
# ---------------------------------------------------------------------------

def propagate_single(
    satrec: Satrec,
    dt: datetime,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Propagate a single satellite to a single epoch.

    Parameters
    ----------
    satrec : Satrec
        Initialised SGP4 satellite record.
    dt : datetime
        Target epoch (UTC).

    Returns
    -------
    pos : np.ndarray, shape (3,)
        Position in TEME [km].
    vel : np.ndarray, shape (3,)
        Velocity in TEME [km/s].

    Raises
    ------
    RuntimeError
        If the SGP4 propagator returns a non-zero error code.
    """
    jd, fr = datetime_to_jd(dt)
    err, pos, vel = satrec.sgp4(jd, fr)
    if err != 0:
        raise RuntimeError(f"SGP4 error code {err} for sat {satrec.satnum}")
    return np.asarray(pos, dtype=np.float64), np.asarray(vel, dtype=np.float64)


# ---------------------------------------------------------------------------
# Single satellite, many time-steps (vectorised)
# ---------------------------------------------------------------------------

def propagate_array(
    satrec: Satrec,
    jd_array: np.ndarray,
    fr_array: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Propagate **one** satellite over an array of time-steps.

    Uses ``sgp4.api.SatrecArray`` internally with a single-element
    array to take advantage of the C-accelerated batch path, then
    squeezes the satellite axis away.

    Parameters
    ----------
    satrec : Satrec
        Initialised SGP4 satellite record.
    jd_array : np.ndarray, shape (N,)
        Julian date whole parts for each time-step.
    fr_array : np.ndarray, shape (N,)
        Julian date fractional parts for each time-step.

    Returns
    -------
    positions : np.ndarray, shape (N, 3)
        Positions in TEME [km].
    velocities : np.ndarray, shape (N, 3)
        Velocities in TEME [km/s].
    """
    # Wrap the single Satrec into a SatrecArray of length 1
    arr = SatrecArray([satrec])
    # sgp4_array returns shape (n_sats, n_times, 3) — we want (n_times, 3)
    err, pos, vel = arr.sgp4(jd_array, fr_array)
    # pos shape: (1, N, 3)  →  (N, 3)
    return pos[0], vel[0]


# ---------------------------------------------------------------------------
# Many satellites, many time-steps (fully vectorised)
# ---------------------------------------------------------------------------

def propagate_batch(
    satrecs: List[Satrec],
    jd_array: np.ndarray,
    fr_array: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Propagate **multiple** satellites over an array of time-steps.

    Parameters
    ----------
    satrecs : list[Satrec]
        List of initialised SGP4 satellite records.
    jd_array : np.ndarray, shape (N,)
        Julian date whole parts.
    fr_array : np.ndarray, shape (N,)
        Julian date fractional parts.

    Returns
    -------
    positions : np.ndarray, shape (M, N, 3)
        M = number of satellites, N = number of time-steps.
    velocities : np.ndarray, shape (M, N, 3)
    """
    arr = SatrecArray(satrecs)
    err, pos, vel = arr.sgp4(jd_array, fr_array)
    return pos, vel


# ---------------------------------------------------------------------------
# Utility: build time arrays from a datetime range
# ---------------------------------------------------------------------------

def build_time_array(
    start: datetime,
    end: datetime,
    step_seconds: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create arrays of Julian-date (jd, fr) pairs spanning
    [start, end] with the given step.

    Returns
    -------
    jd_array : np.ndarray
    fr_array : np.ndarray
    """
    total_seconds = (end - start).total_seconds()
    n_steps = max(int(total_seconds / step_seconds) + 1, 1)
    jd0, fr0 = datetime_to_jd(start)

    # Build fractional-day offsets
    offsets = np.linspace(0.0, total_seconds / 86400.0, n_steps)
    jd_array = np.full(n_steps, jd0)
    fr_array = fr0 + offsets
    return jd_array, fr_array
