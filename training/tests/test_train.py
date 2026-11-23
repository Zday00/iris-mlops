import json
import sys
from pathlib import Path

import joblib

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from train import parse_args, train  # noqa: E402


def test_training_produces_artifacts(tmp_path):
    args = parse_args(["--model-dir", str(tmp_path), "--n-estimators", "20"])
    meta = train(args)
    assert (tmp_path / "model.joblib").exists()
    assert (tmp_path / "metadata.json").exists()
    assert meta["metrics"]["accuracy"] >= 0.9
    saved = json.loads((tmp_path / "metadata.json").read_text())
    assert saved["feature_names"] == ["sepal_length", "sepal_width", "petal_length", "petal_width"]


def test_model_predicts_setosa(tmp_path):
    train(parse_args(["--model-dir", str(tmp_path), "--n-estimators", "20"]))
    model = joblib.load(tmp_path / "model.joblib")
    assert model.predict([[5.1, 3.5, 1.4, 0.2]])[0] == 0  # setosa
