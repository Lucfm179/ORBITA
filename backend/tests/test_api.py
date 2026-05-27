"""
ORBITA — Backend integration and unit tests.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.core.tle import CATALOG, reconstruct_tle_lines
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


def test_reconstruct_tle_lines():
    """Verify that reconstruct_tle_lines outputs correctly formatted TLE rows."""
    mock_raw = {
        "OBJECT_NAME": "AMAZONIA 1",
        "OBJECT_ID": "2021-017A",
        "NORAD_CAT_ID": 47699,
        "EPOCH": "2026-05-26T12:00:00.000000",
        "MEAN_MOTION": 14.5,
        "ECCENTRICITY": 0.0001,
        "INCLINATION": 98.4,
        "RA_OF_ASC_NODE": 100.2,
        "ARG_OF_PERICENTER": 200.5,
        "MEAN_ANOMALY": 50.1,
        "EPHEMERIS_TYPE": 0,
        "ELEMENT_SET_NO": 999,
        "FIRST_DERIVATIVE": 0.00001,
        "SECOND_DERIVATIVE": 0.0,
        "BSTAR": 0.0001,
    }
    line1, line2 = reconstruct_tle_lines(mock_raw)
    assert len(line1) == 69
    assert len(line2) == 69
    assert line1.startswith("1 47699U")
    assert line2.startswith("2 47699")


def test_ml_pipeline():
    """Verify feature extraction and model prediction for a mock conjunction."""
    mock_conj = {
        "miss_distance_km": 0.5,
        "relative_velocity_kms": 12.0,
        "probability": 0.02,
        "tle_age_hours": 8.0,
        "primary_type": "payload",
        "secondary_type": "debris",
        "altitude_km": 600.0,
    }
    from app.ml.features import extract_features
    from app.ml.predict import predict_conjunction
    
    feats = extract_features(mock_conj)
    assert feats.shape == (7,)
    assert feats[0] == 0.5
    assert feats[2] == 0.02
    
    res = predict_conjunction(mock_conj)
    assert "risk_score" in res
    assert "risk_tier" in res
    assert "recommended_action" in res
    assert res["risk_tier"] in ("baixo", "medio", "alto")


def test_api_fleet_route():
    """Verify that the GET /api/fleet route returns active fleet assets with correct schema."""
    response = client.get("/api/fleet")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 4
    for asset in data:
        assert "norad_id" in asset
        assert "name" in asset
        assert "status" in asset
        assert "active_conjunctions" in asset
        assert "apogee_km" in asset
        assert "perigee_km" in asset
