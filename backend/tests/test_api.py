"""Tests d'intégration de l'API (le modèle est entraîné dans un dossier temporaire)."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "training"))
sys.path.insert(0, str(ROOT / "backend"))


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    from train import parse_args, train

    model_dir = tmp_path_factory.mktemp("models")
    train(parse_args(["--model-dir", str(model_dir), "--n-estimators", "20"]))

    from app.model import iris_model

    iris_model.model_dir = model_dir

    from app.main import app

    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "model_loaded": True}


def test_predict_setosa(client):
    r = client.post("/predict", json={
        "sepal_length": 5.1, "sepal_width": 3.5, "petal_length": 1.4, "petal_width": 0.2})
    assert r.status_code == 200
    body = r.json()
    assert body["species"] == "setosa"
    assert abs(sum(body["probabilities"].values()) - 1) < 1e-3


def test_predict_validation_error(client):
    r = client.post("/predict", json={"sepal_length": -1})
    assert r.status_code == 422


def test_batch(client):
    item = {"sepal_length": 6.7, "sepal_width": 3.0, "petal_length": 5.2, "petal_width": 2.3}
    r = client.post("/predict/batch", json={"items": [item, item]})
    assert r.status_code == 200
    assert len(r.json()["predictions"]) == 2
