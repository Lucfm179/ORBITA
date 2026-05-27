"""
ORBITA — Machine learning model training script.

Generates a synthetic training set representing various conjunction risk scenarios
and trains a GradientBoostingClassifier to perform threat triage (alto, médio, baixo).
"""

from __future__ import annotations

import os
import logging
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

logger = logging.getLogger("orbita.ml.train")


def generate_synthetic_data(n: int = 2000) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate realistic synthetic conjunction features for model training.
    
    Feature Layout:
    0: miss_distance_km
    1: relative_velocity_kms
    2: probability
    3: tle_age_hours
    4: primary_type_encoded
    5: secondary_type_encoded
    6: altitude_km
    """
    rng = np.random.default_rng(seed=42)
    
    n_alto = int(n * 0.30)
    n_medio = int(n * 0.30)
    n_baixo = n - n_alto - n_medio
    
    features = []
    labels = []
    
    # 1. Alto Risk (Label: 2)
    for _ in range(n_alto):
        feat = [
            rng.uniform(0.01, 1.0),      # miss_distance_km
            rng.uniform(8.0, 16.0),      # relative_velocity_kms
            rng.uniform(0.001, 0.08),     # probability
            rng.uniform(0.5, 12.0),      # tle_age_hours
            float(rng.choice([0, 3])),   # primary_type (mostly payloads)
            float(rng.choice([0, 1, 2, 3])), # secondary_type
            rng.uniform(450.0, 750.0)    # altitude_km
        ]
        features.append(feat)
        labels.append(2)
        
    # 2. Médio Risk (Label: 1)
    for _ in range(n_medio):
        feat = [
            rng.uniform(1.0, 5.0),       # miss_distance_km
            rng.uniform(5.0, 12.0),      # relative_velocity_kms
            rng.uniform(0.0, 0.001),     # probability
            rng.uniform(12.0, 36.0),     # tle_age_hours
            float(rng.choice([0, 3])),
            float(rng.choice([0, 1, 2, 3])),
            rng.uniform(400.0, 800.0)
        ]
        features.append(feat)
        labels.append(1)
        
    # 3. Baixo Risk (Label: 0)
    for _ in range(n_baixo):
        feat = [
            rng.uniform(5.0, 10.0),      # miss_distance_km
            rng.uniform(1.0, 8.0),       # relative_velocity_kms
            0.0,                         # probability
            rng.uniform(24.0, 72.0),     # tle_age_hours
            float(rng.choice([0, 3])),
            float(rng.choice([0, 1, 2, 3])),
            rng.uniform(300.0, 900.0)
        ]
        features.append(feat)
        labels.append(0)
        
    return np.array(features, dtype=np.float64), np.array(labels, dtype=np.int64)


def train_model() -> None:
    """Train the model and save it to model.pkl."""
    logging.basicConfig(level=logging.INFO)
    logger.info("Generating synthetic data for training...")
    
    X, y = generate_synthetic_data(2000)
    
    logger.info("Training GradientBoostingClassifier...")
    clf = GradientBoostingClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=4,
        random_state=42
    )
    clf.fit(X, y)
    
    # Save path relative to this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(current_dir, "model.pkl")
    
    logger.info("Saving trained model to %s...", model_path)
    joblib.dump(clf, model_path)
    logger.info("Model training successfully completed!")


if __name__ == "__main__":
    train_model()
