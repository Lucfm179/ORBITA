"""
ORBITA — API routes.

Provides endpoints for system health, catalog statistics, fleet assets,
TLE objects, and conjunction event feeds.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.models import (
    HealthResponse,
    CatalogStats,
    TLEObject,
    FleetAsset,
    Conjunction,
)
from app.core.tle import CATALOG, get_fleet, get_catalog_stats, reconstruct_tle_lines
from app.core.screening import CONJUNCTIONS

logger = logging.getLogger("orbita.api.routes")

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def get_health():
    """Get API health and catalog status."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc),
        catalog_loaded=len(CATALOG) > 0,
    )


@router.get("/catalog/stats", response_model=CatalogStats)
def get_stats():
    """Get high-level catalog statistics."""
    stats = get_catalog_stats()
    # Map from get_catalog_stats() dict keys to CatalogStats model
    return CatalogStats(
        total=stats["total"],
        active=stats["active"],
        debris=stats["debris"],
        last_updated=stats["last_updated"],
    )


@router.get("/objects/tle", response_model=List[TLEObject])
def get_tles():
    """Get reconstructed TLEs for all active catalog objects."""
    tle_list = []
    for norad_id, entry in CATALOG.items():
        raw_rec = entry.get("raw")
        if not raw_rec:
            continue
        try:
            line1, line2 = reconstruct_tle_lines(raw_rec)
            tle_list.append(
                TLEObject(
                    norad_id=norad_id,
                    name=entry["name"],
                    object_type=entry["type"],
                    tle_line1=line1,
                    tle_line2=line2,
                    epoch=entry["epoch"] or datetime.now(timezone.utc),
                )
            )
        except Exception as exc:
            logger.warning("Failed to reconstruct TLE for %d: %s", norad_id, exc)
    return tle_list


@router.get("/fleet", response_model=List[FleetAsset])
def get_fleet_assets():
    """Get the fleet satellites and their calculated operational status."""
    fleet = get_fleet()
    response = []

    for asset in fleet:
        norad_id = asset["norad_id"]
        
        # Filter conjunctions belonging to this asset
        asset_conjs = [
            c for c in CONJUNCTIONS.values()
            if c["primary"]["norad_id"] == norad_id
        ]
        
        # Determine status
        status = "operational"
        tiers = [c["risk_tier"] for c in asset_conjs]
        if "alto" in tiers:
            status = "critical"
        elif "medio" in tiers:
            status = "degraded"
            
        response.append(
            FleetAsset(
                norad_id=norad_id,
                name=asset["name"],
                object_type="payload",
                status=status,
                active_conjunctions=len(asset_conjs),
                apogee_km=asset.get("apogee_km", 0.0),
                perigee_km=asset.get("perigee_km", 0.0),
            )
        )
    return response


@router.get("/conjunctions", response_model=List[Conjunction])
def get_conjunctions(
    asset: Optional[int] = Query(None, description="Filter by fleet asset NORAD ID"),
    hours: Optional[int] = Query(72, description="Filter by forecast window in hours"),
    min_tier: Optional[str] = Query(None, description="Minimum risk tier: alto | medio | baixo"),
):
    """Get active conjunction alerts matching the query parameters."""
    filtered = []
    now = datetime.now(timezone.utc)
    cutoff = now + (timedelta(hours=hours) if hours else timedelta(hours=72))

    tier_hierarchy = {"baixo": 0, "medio": 1, "alto": 2}
    min_level = tier_hierarchy.get(min_tier, 0) if min_tier else 0

    for conj in CONJUNCTIONS.values():
        # Filter by asset
        if asset is not None and conj["primary"]["norad_id"] != asset:
            continue
            
        # Filter by forecast window (TCA <= cutoff)
        # Ensure tca is timezone-aware
        tca = conj["tca"]
        if tca.tzinfo is None:
            tca = tca.replace(tzinfo=timezone.utc)
            
        if tca > cutoff:
            continue
            
        # Filter by min_tier
        conj_level = tier_hierarchy.get(conj["risk_tier"], 0)
        if conj_level < min_level:
            continue
            
        filtered.append(Conjunction(**conj))
        
    return filtered


@router.get("/conjunctions/{conjunction_id}", response_model=Conjunction)
def get_conjunction_by_id(conjunction_id: str):
    """Get details of a specific conjunction by ID."""
    conj = CONJUNCTIONS.get(conjunction_id)
    if not conj:
        raise HTTPException(status_code=404, detail="Conjunction alert not found")
    return Conjunction(**conj)
