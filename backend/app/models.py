"""
ORBITA — Pydantic response schemas for the REST API.

Every model maps directly to the JSON contract consumed by the frontend.
All datetimes are serialised as ISO-8601 in UTC.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Health / status
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """Service health-check response."""
    status: str = Field(..., description="Current service status", examples=["ok"])
    timestamp: datetime = Field(..., description="Current server UTC timestamp")
    catalog_loaded: bool = Field(..., description="Whether the TLE catalog has been loaded")


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

class CatalogStats(BaseModel):
    """Aggregate statistics about the loaded catalog."""
    total: int = Field(..., description="Total number of objects in the catalog")
    active: int = Field(..., description="Number of active payloads")
    debris: int = Field(..., description="Number of debris objects")
    last_updated: Optional[datetime] = Field(None, description="Timestamp of last catalog refresh")


# ---------------------------------------------------------------------------
# Space objects & TLEs
# ---------------------------------------------------------------------------

class SpaceObject(BaseModel):
    """Minimal representation of a space object."""
    norad_id: int = Field(..., description="NORAD catalog number")
    name: str = Field(..., description="Object name")
    type: str = Field(..., description="Object type: payload | debris | rocket body | unknown")


class TLEObject(BaseModel):
    """TLE data formatted for satellite.js consumption."""
    norad_id: int
    name: str
    object_type: str
    tle_line1: str
    tle_line2: str
    epoch: datetime


# ---------------------------------------------------------------------------
# Fleet
# ---------------------------------------------------------------------------

class FleetAsset(BaseModel):
    """A tracked fleet satellite with its operational status."""
    norad_id: int
    name: str
    object_type: str = "payload"
    status: str = Field("operational", description="operational | degraded | critical")
    active_conjunctions: int = Field(0, description="Number of active conjunction alerts")
    apogee_km: float = Field(0.0, description="Apogee altitude in kilometers")
    perigee_km: float = Field(0.0, description="Perigee altitude in kilometers")


# ---------------------------------------------------------------------------
# Conjunctions
# ---------------------------------------------------------------------------

class ConjunctionPrimary(BaseModel):
    """Primary (fleet) object involved in a conjunction."""
    norad_id: int
    name: str
    type: str


class ConjunctionSecondary(BaseModel):
    """Secondary (catalog) object involved in a conjunction."""
    norad_id: int
    name: str
    type: str


class Conjunction(BaseModel):
    """Full conjunction event record."""
    id: str = Field(..., description="Unique conjunction ID (cj_<hex>)")
    primary: ConjunctionPrimary
    secondary: ConjunctionSecondary
    tca: datetime = Field(..., description="Time of Closest Approach (UTC)")
    miss_distance_km: float = Field(..., description="Predicted miss distance in km")
    relative_velocity_kms: float = Field(..., description="Relative velocity at TCA in km/s")
    probability: float = Field(..., description="Estimated collision probability")
    risk_score: float = Field(..., description="ML-predicted risk score [0, 1]")
    risk_tier: str = Field(..., description="Risk tier: alto | medio | baixo")
    tle_age_hours: float = Field(..., description="Age of TLE data in hours")
    recommended_action: str = Field(..., description="Recommended operator action")
    computed_at: datetime = Field(..., description="Timestamp when this conjunction was computed")


class ConjunctionList(BaseModel):
    """Wrapper for a list of conjunctions."""
    count: int
    items: List[Conjunction]
