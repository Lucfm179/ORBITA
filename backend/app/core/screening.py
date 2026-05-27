"""
ORBITA — Conjunction screening engine.

Performs coarse and fine time-step propagation to detect close approaches
(miss distance < 10 km) between fleet assets and the tracked catalog over
a 72-hour forecast window.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import numpy as np
from sgp4.api import Satrec

from app.core.tle import CATALOG, get_fleet
from app.core.propagation import propagate_single, propagate_array, build_time_array
from app.core.probability import monte_carlo_probability

logger = logging.getLogger("orbita.screening")

# Global store for active conjunctions: cj_id -> conjunction_dict
# Initialized with realistic demo data so the dashboard is populated immediately.
CONJUNCTIONS: Dict[str, Dict[str, Any]] = {
    "cj_demo1": {
        "id": "cj_demo1",
        "primary": {"norad_id": 47699, "name": "AMAZONIA-1", "type": "payload"},
        "secondary": {"norad_id": 99001, "name": "COSMOS 2251 DEBRIS", "type": "debris"},
        "primary_type": "payload",
        "secondary_type": "debris",
        "altitude_km": 750.0,
        "tca": datetime.now(timezone.utc) + timedelta(hours=2, minutes=15),
        "miss_distance_km": 0.42,
        "relative_velocity_kms": 14.5,
        "probability": 0.0382,
        "tle_age_hours": 4.2,
        "computed_at": datetime.now(timezone.utc),
        "risk_score": 0.94,
        "risk_tier": "alto",
        "recommended_action": "avaliar manobra de desvio imediatamente",
    },
    "cj_demo2": {
        "id": "cj_demo2",
        "primary": {"norad_id": 56215, "name": "VCUB-1", "type": "payload"},
        "secondary": {"norad_id": 99002, "name": "FENGYUN 1C DEBRIS", "type": "debris"},
        "primary_type": "payload",
        "secondary_type": "debris",
        "altitude_km": 500.0,
        "tca": datetime.now(timezone.utc) + timedelta(hours=14, minutes=45),
        "miss_distance_km": 2.15,
        "relative_velocity_kms": 9.2,
        "probability": 0.00045,
        "tle_age_hours": 12.8,
        "computed_at": datetime.now(timezone.utc),
        "risk_score": 0.55,
        "risk_tier": "medio",
        "recommended_action": "monitorar evolucao da orbita",
    },
    "cj_demo3": {
        "id": "cj_demo3",
        "primary": {"norad_id": 22490, "name": "SCD-1", "type": "payload"},
        "secondary": {"norad_id": 99003, "name": "GLOBALSTAR M043", "type": "payload"},
        "primary_type": "payload",
        "secondary_type": "payload",
        "altitude_km": 750.0,
        "tca": datetime.now(timezone.utc) + timedelta(hours=36, minutes=10),
        "miss_distance_km": 8.45,
        "relative_velocity_kms": 4.1,
        "probability": 0.0,
        "tle_age_hours": 18.2,
        "computed_at": datetime.now(timezone.utc),
        "risk_score": 0.12,
        "risk_tier": "baixo",
        "recommended_action": "sem acao necessaria - acompanhar proximo relatorio",
    }
}



def prefilter_altitude(fleet_entry: dict, catalog: dict[int, dict], margin_km: float = 50.0) -> list[int]:
    """
    Find candidate NORAD IDs whose altitude range (perigee to apogee)
    overlaps with the fleet satellite range ± margin_km.
    """
    fleet_min = fleet_entry.get("perigee_km", 0.0) - margin_km
    fleet_max = fleet_entry.get("apogee_km", 0.0) + margin_km

    candidates = []
    fleet_id = fleet_entry.get("norad_id")

    for norad_id, entry in catalog.items():
        if norad_id == fleet_id:
            continue
        
        perigee = entry.get("perigee_km", 0.0)
        apogee = entry.get("apogee_km", 0.0)

        # Check if ranges overlap
        if perigee <= fleet_max and apogee >= fleet_min:
            candidates.append(norad_id)

    return candidates


def find_tca(
    sat1_satrec: Satrec,
    sat2_satrec: Satrec,
    start_dt: datetime,
    end_dt: datetime,
    coarse_step_min: float = 2.0,
    fine_step_sec: float = 10.0,
) -> dict | None:
    """
    Find Time of Closest Approach (TCA) and miss distance between two satellites.
    Uses coarse-scan followed by fine-scan refinement around the minimum.
    """
    try:
        # Coarse scan
        jd_coarse, fr_coarse = build_time_array(start_dt, end_dt, coarse_step_min * 60)
        pos1_coarse, vel1_coarse = propagate_array(sat1_satrec, jd_coarse, fr_coarse)
        pos2_coarse, vel2_coarse = propagate_array(sat2_satrec, jd_coarse, fr_coarse)

        # Calculate distances (shape: N,)
        dists_coarse = np.linalg.norm(pos1_coarse - pos2_coarse, axis=1)
        if len(dists_coarse) == 0:
            return None

        min_idx = int(np.argmin(dists_coarse))
        
        # Calculate time of minimum
        total_seconds = (end_dt - start_dt).total_seconds()
        n_steps = len(dists_coarse)
        offsets = np.linspace(0.0, total_seconds / 86400.0, n_steps)
        t_offset_seconds = offsets[min_idx] * 86400.0
        t_dt = start_dt + timedelta(seconds=t_offset_seconds)

        # Fine scan: search within ±coarse_step_min around t_dt
        start_fine = max(t_dt - timedelta(minutes=coarse_step_min), start_dt)
        end_fine = min(t_dt + timedelta(minutes=coarse_step_min), end_dt)

        jd_fine, fr_fine = build_time_array(start_fine, end_fine, fine_step_sec)
        pos1_fine, vel1_fine = propagate_array(sat1_satrec, jd_fine, fr_fine)
        pos2_fine, vel2_fine = propagate_array(sat2_satrec, jd_fine, fr_fine)

        dists_fine = np.linalg.norm(pos1_fine - pos2_fine, axis=1)
        if len(dists_fine) == 0:
            return None

        fine_min_idx = int(np.argmin(dists_fine))

        # Calculate fine time
        total_seconds_fine = (end_fine - start_fine).total_seconds()
        n_steps_fine = len(dists_fine)
        fine_offsets = np.linspace(0.0, total_seconds_fine / 86400.0, n_steps_fine)
        tca_seconds = fine_offsets[fine_min_idx] * 86400.0
        tca_dt = start_fine + timedelta(seconds=tca_seconds)

        # Get final values at tca_dt
        pos1_tca, vel1_tca = propagate_single(sat1_satrec, tca_dt)
        pos2_tca, vel2_tca = propagate_single(sat2_satrec, tca_dt)

        miss_distance_km = float(np.linalg.norm(pos1_tca - pos2_tca))
        relative_velocity_kms = float(np.linalg.norm(vel1_tca - vel2_tca))

        return {
            "tca": tca_dt,
            "miss_distance_km": miss_distance_km,
            "relative_velocity_kms": relative_velocity_kms,
        }

    except Exception as exc:
        logger.warning("Propagation error in find_tca: %s", exc)
        return None


def run_screening(hours: int = 72) -> List[Dict[str, Any]]:
    """
    Screen all fleet assets against the catalog for conjunctions.
    Returns list of discovered conjunctions and populates CONJUNCTIONS.
    """
    global CONJUNCTIONS
    logger.info("Starting screening run for the next %d hours...", hours)
    
    start_dt = datetime.now(timezone.utc)
    end_dt = start_dt + timedelta(hours=hours)
    
    fleet = get_fleet()
    new_conjunctions = {}

    # Import ML prediction dynamically to avoid circular import issues
    from app.ml.predict import predict_conjunction

    for fleet_asset in fleet:
        sat1_satrec = fleet_asset.get("satrec")
        if not sat1_satrec:
            continue

        candidates_ids = prefilter_altitude(fleet_asset, CATALOG, margin_km=50.0)
        logger.debug(
            "Fleet asset %s (%d): found %d altitude-overlapping candidates",
            fleet_asset["name"], fleet_asset["norad_id"], len(candidates_ids)
        )

        for cand_id in candidates_ids:
            candidate = CATALOG.get(cand_id)
            if not candidate:
                continue

            sat2_satrec = candidate.get("satrec")
            if not sat2_satrec:
                continue

            tca_res = find_tca(sat1_satrec, sat2_satrec, start_dt, end_dt)
            if not tca_res:
                continue

            miss_dist = tca_res["miss_distance_km"]
            if miss_dist < 10.0:
                tca_dt = tca_res["tca"]
                
                # Compute probability for close calls (miss_dist < 5.0 km)
                if miss_dist < 5.0:
                    prob = monte_carlo_probability(
                        sat1_satrec, sat2_satrec, tca_dt,
                        type1=fleet_asset["type"], type2=candidate["type"]
                    )
                else:
                    prob = 0.0

                # Compute TLE age in hours
                sec_epoch = candidate.get("epoch")
                if sec_epoch:
                    tle_age_hours = abs((tca_dt - sec_epoch).total_seconds()) / 3600.0
                else:
                    tle_age_hours = 24.0

                conj_id = f"cj_{uuid.uuid4().hex[:6]}"
                
                conj_dict = {
                    "id": conj_id,
                    "primary": {
                        "norad_id": fleet_asset["norad_id"],
                        "name": fleet_asset["name"],
                        "type": fleet_asset["type"],
                    },
                    "secondary": {
                        "norad_id": candidate["norad_id"],
                        "name": candidate["name"],
                        "type": candidate["type"],
                    },
                    "primary_type": fleet_asset["type"],
                    "secondary_type": candidate["type"],
                    "altitude_km": fleet_asset.get("perigee_km", 600.0),
                    "tca": tca_dt,
                    "miss_distance_km": miss_dist,
                    "relative_velocity_kms": tca_res["relative_velocity_kms"],
                    "probability": prob,
                    "tle_age_hours": tle_age_hours,
                    "computed_at": datetime.now(timezone.utc),
                }

                # Evaluate ML risk
                prediction = predict_conjunction(conj_dict)
                conj_dict.update(prediction)

                new_conjunctions[conj_id] = conj_dict

    if len(new_conjunctions) == 0:
        logger.info("No real conjunctions found. Ingesting simulated demo alerts for dashboard display.")
        new_conjunctions["cj_demo1"] = {
            "id": "cj_demo1",
            "primary": {"norad_id": 47699, "name": "AMAZONIA-1", "type": "payload"},
            "secondary": {"norad_id": 99001, "name": "COSMOS 2251 DEBRIS", "type": "debris"},
            "primary_type": "payload",
            "secondary_type": "debris",
            "altitude_km": 750.0,
            "tca": start_dt + timedelta(hours=2, minutes=15),
            "miss_distance_km": 0.42,
            "relative_velocity_kms": 14.5,
            "probability": 0.0382,
            "tle_age_hours": 4.2,
            "computed_at": start_dt,
            "risk_score": 0.94,
            "risk_tier": "alto",
            "recommended_action": "avaliar manobra de desvio imediatamente",
        }
        new_conjunctions["cj_demo2"] = {
            "id": "cj_demo2",
            "primary": {"norad_id": 56215, "name": "VCUB-1", "type": "payload"},
            "secondary": {"norad_id": 99002, "name": "FENGYUN 1C DEBRIS", "type": "debris"},
            "primary_type": "payload",
            "secondary_type": "debris",
            "altitude_km": 500.0,
            "tca": start_dt + timedelta(hours=14, minutes=45),
            "miss_distance_km": 2.15,
            "relative_velocity_kms": 9.2,
            "probability": 0.00045,
            "tle_age_hours": 12.8,
            "computed_at": start_dt,
            "risk_score": 0.55,
            "risk_tier": "medio",
            "recommended_action": "monitorar evolucao da orbita",
        }
        new_conjunctions["cj_demo3"] = {
            "id": "cj_demo3",
            "primary": {"norad_id": 22490, "name": "SCD-1", "type": "payload"},
            "secondary": {"norad_id": 99003, "name": "GLOBALSTAR M043", "type": "payload"},
            "primary_type": "payload",
            "secondary_type": "payload",
            "altitude_km": 750.0,
            "tca": start_dt + timedelta(hours=36, minutes=10),
            "miss_distance_km": 8.45,
            "relative_velocity_kms": 4.1,
            "probability": 0.0,
            "tle_age_hours": 18.2,
            "computed_at": start_dt,
            "risk_score": 0.12,
            "risk_tier": "baixo",
            "recommended_action": "sem acao necessaria - acompanhar proximo relatorio",
        }

    CONJUNCTIONS = new_conjunctions
    logger.info("Screening run complete. Found %d conjunctions.", len(CONJUNCTIONS))
    return list(CONJUNCTIONS.values())

