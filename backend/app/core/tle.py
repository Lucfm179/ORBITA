"""
ORBITA — TLE / GP data ingestion from CelesTrak.

Fetches GP JSON records, converts them to SGP4 Satrec objects, computes
orbital characteristics (apogee / perigee), and stores everything in an
in-memory catalog dict keyed by NORAD ID.

Public API
----------
- fetch_and_store_catalog()   — full refresh from CelesTrak
- get_fleet()                 — list of fleet satellite entries
- get_catalog_stats()         — aggregate catalog statistics
- CATALOG                     — the in-memory store (dict[int, dict])
"""

from __future__ import annotations

import logging
import math
import os
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sgp4.api import Satrec, WGS72
from sgp4 import omm

logger = logging.getLogger("orbita.tle")

# ---------------------------------------------------------------------------
# Caching Configuration
# ---------------------------------------------------------------------------
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog_cache.json")

def _load_cache() -> Dict[str, List[dict]]:
    """Load cached GP JSON records from disk."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.warning("Failed to load catalog cache: %s", exc)
    return {}

def _save_cache(cache_data: Dict[str, List[dict]]) -> None:
    """Save GP JSON records to disk."""
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        logger.warning("Failed to save catalog cache: %s", exc)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CELESTRAK_BASE = "https://celestrak.org/NORAD/elements/gp.php"
HTTP_TIMEOUT = 30  # seconds

# Brazilian demo fleet
FLEET_IDS: List[int] = [47699, 56215, 22490, 25504]

# Earth radius in km (WGS-72 value used by SGP4)
RE_KM = 6378.135
# Gravitational parameter (km³/s²) — WGS-72
MU_KM3S2 = 398600.8

# ---------------------------------------------------------------------------
# In-memory catalog:  NORAD_ID → { name, norad_id, type, satrec, ... }
# ---------------------------------------------------------------------------

CATALOG: Dict[int, Dict[str, Any]] = {}
LAST_UPDATED: Optional[datetime] = None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _fetch_gp_json(url: str) -> List[dict]:
    """
    Fetch GP records in JSON format from CelesTrak.
    Uses browser User-Agent and falls back to a local JSON cache if blocked.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT, headers=headers) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
            records = [data] if isinstance(data, dict) else data
            
            # Save to cache if successful
            if records:
                cache = _load_cache()
                cache[url] = records
                _save_cache(cache)
                logger.info("Successfully fetched and cached %d records from %s", len(records), url)
            
            return records
    except Exception as exc:
        logger.warning("CelesTrak fetch failed (%s): %s. Attempting cache fallback...", url, exc)
        cache = _load_cache()
        if url in cache:
            cached_records = cache[url]
            logger.info("Successfully loaded %d cached records for %s", len(cached_records), url)
            return cached_records
        logger.error("No cache available for %s", url)
        return []


# ---------------------------------------------------------------------------
# Catalog building
# ---------------------------------------------------------------------------

def _classify_object(name: str) -> str:
    """
    Derive object type from its name string.

    Returns one of: payload, debris, rocket body, unknown.
    """
    upper = name.upper()
    if "DEB" in upper:
        return "debris"
    if "R/B" in upper or "ROCKET" in upper:
        return "rocket body"
    # Known payload patterns — anything else is treated as payload
    return "payload"


def _orbital_characteristics(mean_motion: float, eccentricity: float) -> dict:
    """
    Compute apogee / perigee altitudes from mean-motion (rev/day) and
    eccentricity.

    Returns
    -------
    dict with keys: semi_major_axis_km, apogee_km, perigee_km
    """
    # Convert mean motion from rev/day → rad/s
    n_rad_s = mean_motion * 2.0 * math.pi / 86400.0
    # Semi-major axis via Kepler's third law: a = (μ / n²)^(1/3)
    a_km = (MU_KM3S2 / (n_rad_s ** 2)) ** (1.0 / 3.0)
    apogee_alt = a_km * (1.0 + eccentricity) - RE_KM
    perigee_alt = a_km * (1.0 - eccentricity) - RE_KM
    return {
        "semi_major_axis_km": a_km,
        "apogee_km": apogee_alt,
        "perigee_km": perigee_alt,
    }


def _build_satrec_from_omm(record: dict) -> Satrec:
    """
    Create an SGP4 Satrec from a CelesTrak GP-JSON record using the
    official ``sgp4.omm`` helper which maps OMM fields directly.
    """
    # sgp4.omm.initialize expects an *iterable* of field-pairs.
    # We use the convenience wrapper that accepts a dict-like.
    sat = Satrec()
    omm.initialize(sat, record)
    return sat


def _epoch_from_record(record: dict) -> datetime:
    """Parse the EPOCH string from a GP JSON record into a UTC datetime."""
    epoch_str = record.get("EPOCH", "")
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(epoch_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # Fallback — use current time (should never happen with real data)
    return datetime.now(timezone.utc)


def parse_and_store(records: List[dict]) -> int:
    """
    Parse a batch of GP JSON records, create Satrec objects, compute
    orbital characteristics, and store in ``CATALOG``.

    Returns the number of newly stored objects.
    """
    stored = 0
    for rec in records:
        try:
            norad_id = int(rec.get("NORAD_CAT_ID", 0))
            if norad_id == 0:
                continue

            sat = _build_satrec_from_omm(rec)
            name = rec.get("OBJECT_NAME", f"UNKNOWN-{norad_id}")
            obj_type = _classify_object(name)
            epoch = _epoch_from_record(rec)

            mean_motion = float(rec.get("MEAN_MOTION", 0.0))
            eccentricity = float(rec.get("ECCENTRICITY", 0.0))
            orbit = _orbital_characteristics(mean_motion, eccentricity)

            CATALOG[norad_id] = {
                "norad_id": norad_id,
                "name": name,
                "type": obj_type,
                "satrec": sat,
                "epoch": epoch,
                "mean_motion": mean_motion,
                "eccentricity": eccentricity,
                "inclination": float(rec.get("INCLINATION", 0.0)),
                "apogee_km": orbit["apogee_km"],
                "perigee_km": orbit["perigee_km"],
                "semi_major_axis_km": orbit["semi_major_axis_km"],
                "raw": rec,  # keep raw GP JSON for TLE reconstruction
            }
            stored += 1
        except Exception as exc:  # noqa: BLE001
            logger.debug("Skipping record %s: %s", rec.get("NORAD_CAT_ID"), exc)
    return stored


# ---------------------------------------------------------------------------
# TLE line reconstruction (for satellite.js on the frontend)
# ---------------------------------------------------------------------------

def _checksum(line: str) -> int:
    """Compute the TLE line checksum (mod-10 of digit sum with '-' = 1)."""
    s = 0
    for ch in line:
        if ch.isdigit():
            s += int(ch)
        elif ch == "-":
            s += 1
    return s % 10


def _format_exp(value: float) -> str:
    """
    Format a float into TLE exponential notation: ±NNNNN±E
    representing ±0.NNNNN * 10^E
    e.g. 0.00088836 → ' 88836-3'
    """
    if value == 0.0:
        return " 00000-0"
    sign = "-" if value < 0 else " "
    val = abs(value)
    exp = int(math.floor(math.log10(val))) + 1
    mantissa = val / (10.0 ** exp)
    mantissa_int = int(round(mantissa * 100000))
    if mantissa_int >= 100000:
        mantissa_int //= 10
        exp += 1
    exp_sign = "+" if exp >= 0 else "-"
    return f"{sign}{mantissa_int:05d}{exp_sign}{abs(exp)}"


def reconstruct_tle_lines(record: dict) -> tuple[str, str]:
    """
    Build TLE line-1 and line-2 strings from a CelesTrak GP JSON record.

    These lines follow the standard two-line element set format and are
    consumable by satellite.js (and any other TLE parser).
    """
    norad = int(record.get("NORAD_CAT_ID", 0))
    classification = record.get("CLASSIFICATION_TYPE", "U")
    
    # Format OBJECT_ID (e.g., '1993-036AA') to standard TLE designator (8 chars: '93036AA ')
    obj_id = record.get("OBJECT_ID")
    if obj_id:
        parts = obj_id.split("-")
        if len(parts) == 2:
            year_part, piece_part = parts
            year_2d = year_part[-2:]  # Last 2 digits of year
            launch_no = piece_part[:3]
            piece = piece_part[3:]
            intl_desig = f"{year_2d}{launch_no}{piece:<3s}"
        else:
            intl_desig = f"{obj_id:<8s}"[:8]
    else:
        intl_desig = "00000A  "

    # Epoch: convert ISO to TLE epoch (YYddd.dddddddd)
    epoch_str = record.get("EPOCH", "")
    try:
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
            try:
                epoch_dt = datetime.strptime(epoch_str, fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                continue
        else:
            epoch_dt = datetime.now(timezone.utc)

        year_2d = epoch_dt.year % 100
        day_of_year = (epoch_dt - datetime(epoch_dt.year, 1, 1, tzinfo=timezone.utc)).total_seconds() / 86400.0 + 1.0
        tle_epoch = f"{year_2d:02d}{day_of_year:012.8f}"
    except Exception:
        tle_epoch = "00001.00000000"

    # First derivative of mean motion (rev/day²) / 2
    mm_dot = float(record.get("MEAN_MOTION_DOT", 0.0))
    sign = "-" if mm_dot < 0 else " "
    val_str = f"{abs(mm_dot):.8f}"
    if val_str.startswith("0."):
        val_str = val_str[1:]  # Strip leading zero before decimal point
    mm_dot_str = f"{sign}{val_str[:9]:<9s}"

    # Second derivative of mean motion (rev/day³) / 6
    mm_ddot = float(record.get("MEAN_MOTION_DDOT", 0.0))
    mm_ddot_str = _format_exp(mm_ddot)

    # BSTAR drag term
    bstar = float(record.get("BSTAR", 0.0))
    bstar_str = _format_exp(bstar)

    eph_type = str(record.get("EPHEMERIS_TYPE", 0))
    elset_no = int(record.get("ELEMENT_SET_NO", 999))

    # ---- Line 1 ----
    line1_no_cksum = (
        f"1 {norad:05d}{classification} {intl_desig} {tle_epoch} "
        f"{mm_dot_str} {mm_ddot_str} {bstar_str} {eph_type} {elset_no:4d}"
    )
    # Pad / trim to exactly 68 characters before checksum
    line1_no_cksum = f"{line1_no_cksum:<68s}"
    cksum1 = _checksum(line1_no_cksum)
    line1 = f"{line1_no_cksum}{cksum1}"

    # ---- Line 2 ----
    inc = float(record.get("INCLINATION", 0.0))
    raan = float(record.get("RA_OF_ASC_NODE", 0.0))
    ecc = float(record.get("ECCENTRICITY", 0.0))
    argp = float(record.get("ARG_OF_PERICENTER", 0.0))
    ma = float(record.get("MEAN_ANOMALY", 0.0))
    mm = float(record.get("MEAN_MOTION", 15.0))
    rev = int(record.get("REV_AT_EPOCH", 0))

    # Eccentricity: 7 digits, no leading "0."
    ecc_str = f"{ecc:.7f}"[2:]  # strip "0."

    line2_no_cksum = (
        f"2 {norad:05d} {inc:8.4f} {raan:8.4f} {ecc_str} "
        f"{argp:8.4f} {ma:8.4f} {mm:11.8f}{rev:5d}"
    )
    line2_no_cksum = f"{line2_no_cksum:<68s}"
    cksum2 = _checksum(line2_no_cksum)
    line2 = f"{line2_no_cksum}{cksum2}"

    return line1, line2


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_and_store_catalog() -> None:
    """
    Fetch the full catalog from CelesTrak (fleet + active + debris groups)
    and populate the in-memory ``CATALOG``.
    """
    global LAST_UPDATED  # noqa: PLW0603

    all_records: List[dict] = []

    # 1. Fetch individual fleet satellites first (guaranteed presence)
    for nid in FLEET_IDS:
        url = f"{CELESTRAK_BASE}?FORMAT=json&CATNR={nid}"
        records = _fetch_gp_json(url)
        all_records.extend(records)

    # 2. Fetch active satellites group
    active_url = f"{CELESTRAK_BASE}?FORMAT=json&GROUP=active"
    active_records = _fetch_gp_json(active_url)
    if active_records:
        all_records.extend(active_records)
    else:
        logger.info("GROUP=active failed or returned empty. Fetching fallback active groups (visual, stations, gps-ops)...")
        for fallback_group in ("visual", "stations", "gps-ops"):
            fallback_url = f"{CELESTRAK_BASE}?FORMAT=json&GROUP={fallback_group}"
            all_records.extend(_fetch_gp_json(fallback_url))

    # 3. Fetch debris groups for conjunction screening
    for debris_group in ("cosmos-2251-debris", "fengyun-1c-debris"):
        debris_url = f"{CELESTRAK_BASE}?FORMAT=json&GROUP={debris_group}"
        all_records.extend(_fetch_gp_json(debris_url))

    stored = parse_and_store(all_records)
    LAST_UPDATED = datetime.now(timezone.utc)
    logger.info(
        "Catalog loaded: %d objects stored (%d records processed)",
        stored,
        len(all_records),
    )


def get_fleet() -> List[Dict[str, Any]]:
    """Return catalog entries for fleet satellites."""
    result = []
    for nid in FLEET_IDS:
        entry = CATALOG.get(nid)
        if entry:
            result.append(entry)
        else:
            # Placeholder so the fleet endpoint always returns all 4
            result.append({
                "norad_id": nid,
                "name": f"NORAD-{nid}",
                "type": "payload",
                "satrec": None,
                "epoch": None,
                "apogee_km": 0.0,
                "perigee_km": 0.0,
            })
    return result


def get_catalog_stats() -> dict:
    """
    Return aggregate statistics about the current catalog.
    """
    total = len(CATALOG)
    active = sum(1 for v in CATALOG.values() if v["type"] == "payload")
    debris = sum(1 for v in CATALOG.values() if v["type"] in ("debris", "rocket body"))
    return {
        "total": total,
        "active": active,
        "debris": debris,
        "last_updated": LAST_UPDATED,
    }
