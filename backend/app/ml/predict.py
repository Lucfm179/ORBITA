"""
ORBITA — Machine learning model prediction.

Loads the GradientBoosting classifier (training it first if missing)
and provides prediction endpoints for triage.
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
import joblib
import numpy as np

from app.ml.features import extract_features

logger = logging.getLogger("orbita.ml.predict")

_MODEL = None


def _get_model_path() -> Path:
    """Return the absolute path to the saved model.pkl file."""
    current_dir = Path(__file__).resolve().parent
    return current_dir / "model.pkl"


def load_model() -> Any:
    """
    Load the trained classifier from model.pkl.
    If the file does not exist, trigger model training first.
    """
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    model_path = _get_model_path()
    if not model_path.exists():
        logger.info("Model file %s not found. Training model first...", model_path)
        from app.ml.train import train_model
        train_model()

    logger.info("Loading model from %s...", model_path)
    _MODEL = joblib.load(model_path)
    return _MODEL


def predict_risk(features: np.ndarray) -> dict[str, Any]:
    """
    Predict risk score, risk tier, and recommended action from a feature vector.
    
    Tiers:
    - score > 0.7  -> 'alto'   (action: 'avaliar manobra')
    - score > 0.3  -> 'medio'  (action: 'monitorar')
    - else         -> 'baixo'  (action: 'sem ação necessária')
    """
    model = load_model()
    
    # Reshape if single sample
    if features.ndim == 1:
        features = features.reshape(1, -1)
        
    probs = model.predict_proba(features)[0]  # [p_baixo, p_medio, p_alto]
    
    # Weighted score favoring the critical 'alto' class
    risk_score = float(0.05 * probs[0] + 0.45 * probs[1] + 1.0 * probs[2])
    # Keep score between 0.0 and 1.0
    risk_score = min(max(risk_score, 0.0), 1.0)
    
    if risk_score > 0.7:
        risk_tier = "alto"
        recommended_action = "avaliar manobra"
    elif risk_score > 0.3:
        risk_tier = "medio"
        recommended_action = "monitorar"
    else:
        risk_tier = "baixo"
        recommended_action = "sem ação necessária"
        
    return {
        "risk_score": risk_score,
        "risk_tier": risk_tier,
        "recommended_action": recommended_action,
    }


def predict_conjunction(conjunction: dict) -> dict[str, Any]:
    """
    Extract features from a conjunction dict and perform risk prediction.
    """
    features = extract_features(conjunction)
    return predict_risk(features)
