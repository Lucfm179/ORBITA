"""
ORBITA — Backend integration and unit tests.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.core.tle import CATALOG
from app.core.screening import prefilter_altitude

client = TestClient(app)


def test_health_endpoint():
    """Verify that the health check endpoint returns 200 and correct structure."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "catalog_loaded" in data


def test_catalog_stats_endpoint():
    """Verify that catalog stats endpoint returns stats correctly."""
    response = client.get("/api/catalog/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "active" in data
    assert "debris" in data


def test_prefilter_altitude():
    """Test that the altitude prefiltering logic filters orbits correctly."""
    fleet_entry = {
        "norad_id": 47699,
        "perigee_km": 500.0,
        "apogee_km": 550.0,
    }
    
    mock_catalog = {
        # Overlapping
        10001: {"norad_id": 10001, "perigee_km": 520.0, "apogee_km": 560.0},
        # Not overlapping
        10002: {"norad_id": 10002, "perigee_km": 700.0, "apogee_km": 750.0},
        # Overlapping within margin (50km)
        10003: {"norad_id": 10003, "perigee_km": 460.0, "apogee_km": 480.0},
        # Same NORAD ID (should be filtered out)
        47699: {"norad_id": 47699, "perigee_km": 510.0, "apogee_km": 540.0},
    }
    
    candidates = prefilter_altitude(fleet_entry, mock_catalog, margin_km=50.0)
    
    assert 10001 in candidates
    assert 10003 in candidates
    assert 10002 not in candidates
    assert 47699 not in candidates
