"""Chargement et inférence du modèle entraîné (artefact produit par training/)."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import joblib

log = logging.getLogger("model")

MODEL_DIR = Path(os.getenv("MODEL_DIR", "/models"))


class IrisModel:
    def __init__(self, model_dir: Path = MODEL_DIR):
        self.model_dir = Path(model_dir)
        self.pipeline = None
        self.metadata: dict = {}

    @property
    def loaded(self) -> bool:
        return self.pipeline is not None

    def load(self) -> None:
        model_path = self.model_dir / "model.joblib"
        meta_path = self.model_dir / "metadata.json"
        if not model_path.exists():
            raise FileNotFoundError(f"Modèle introuvable : {model_path}. Lancez d'abord le training.")
        self.pipeline = joblib.load(model_path)
        self.metadata = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        log.info("Modèle chargé : version %s", self.metadata.get("model_version", "unknown"))

    def predict(self, rows: list[list[float]]) -> list[dict]:
        if not self.loaded:
            raise RuntimeError("Modèle non chargé")
        names = self.metadata.get("target_names", ["setosa", "versicolor", "virginica"])
        version = self.metadata.get("model_version", "unknown")
        classes = self.pipeline.predict(rows)
        probas = self.pipeline.predict_proba(rows)
        return [
            {
                "species": names[int(c)],
                "class_id": int(c),
                "probabilities": {names[i]: round(float(p), 4) for i, p in enumerate(proba)},
                "model_version": version,
            }
            for c, proba in zip(classes, probas)
        ]


iris_model = IrisModel()
