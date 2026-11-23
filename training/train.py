"""
Pipeline d'entraînement du modèle Iris.

Étapes : chargement des données -> split -> entraînement -> évaluation
-> contrôle qualité (seuil) -> sauvegarde du modèle + métriques + métadonnées.

Usage :
    python train.py --model-dir ../models --n-estimators 100 --min-accuracy 0.90
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import sklearn
from sklearn.datasets import load_iris
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("train")

FEATURE_NAMES = ["sepal_length", "sepal_width", "petal_length", "petal_width"]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Entraînement du modèle Iris")
    p.add_argument("--model-dir", default=os.getenv("MODEL_DIR", "models"))
    p.add_argument("--n-estimators", type=int, default=int(os.getenv("N_ESTIMATORS", 100)))
    p.add_argument("--max-depth", type=int, default=int(os.getenv("MAX_DEPTH", 5)))
    p.add_argument("--test-size", type=float, default=float(os.getenv("TEST_SIZE", 0.2)))
    p.add_argument("--random-state", type=int, default=int(os.getenv("RANDOM_STATE", 42)))
    p.add_argument("--min-accuracy", type=float, default=float(os.getenv("MIN_ACCURACY", 0.90)))
    return p.parse_args(argv)


def git_commit() -> str:
    """Retourne le commit Git courant (traçabilité modèle <-> code)."""
    env_sha = os.getenv("GIT_COMMIT")
    if env_sha:
        return env_sha
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        return "unknown"


def build_pipeline(args: argparse.Namespace) -> Pipeline:
    return Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("clf", RandomForestClassifier(
                n_estimators=args.n_estimators,
                max_depth=args.max_depth,
                random_state=args.random_state,
            )),
        ]
    )


def train(args: argparse.Namespace) -> dict:
    log.info("Chargement du dataset Iris")
    data = load_iris()
    X, y = data.data, data.target
    target_names = [str(n) for n in data.target_names]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.random_state, stratify=y
    )
    log.info("Train: %d échantillons | Test: %d échantillons", len(X_train), len(X_test))

    model = build_pipeline(args)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "f1_macro": round(float(f1_score(y_test, y_pred, average="macro")), 4),
    }
    log.info("Métriques : %s", metrics)
    log.info("\n%s", classification_report(y_test, y_pred, target_names=target_names))

    # Quality gate : on refuse de publier un modèle trop faible
    if metrics["accuracy"] < args.min_accuracy:
        log.error("Accuracy %.3f < seuil %.3f : modèle rejeté", metrics["accuracy"], args.min_accuracy)
        sys.exit(1)

    version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    metadata = {
        "model_version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "git_commit": git_commit(),
        "algorithm": "RandomForestClassifier",
        "hyperparameters": {
            "n_estimators": args.n_estimators,
            "max_depth": args.max_depth,
            "random_state": args.random_state,
            "test_size": args.test_size,
        },
        "feature_names": FEATURE_NAMES,
        "target_names": target_names,
        "metrics": metrics,
        "sklearn_version": sklearn.__version__,
    }

    out = Path(args.model_dir)
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out / "model.joblib")
    (out / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    log.info("Modèle v%s sauvegardé dans %s", version, out.resolve())
    return metadata


if __name__ == "__main__":
    train(parse_args())
