"""API FastAPI de serving du modèle Iris."""
from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .model import iris_model
from .schemas import (
    BatchRequest,
    BatchResponse,
    HealthResponse,
    IrisFeatures,
    PredictionResponse,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
log = logging.getLogger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Chargement du modèle une seule fois au démarrage
    try:
        iris_model.load()
    except FileNotFoundError as exc:
        log.error(str(exc))
    yield


app = FastAPI(
    title="Iris MLOps API",
    description="API de prédiction de l'espèce d'iris à partir des 4 mesures de la fleur.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    log.info("%s %s -> %s (%.1f ms)", request.method, request.url.path, response.status_code, ms)
    return response


def _require_model():
    if not iris_model.loaded:
        raise HTTPException(status_code=503, detail="Modèle non disponible")


@app.get("/health", response_model=HealthResponse, tags=["monitoring"])
def health():
    return {"status": "ok", "model_loaded": iris_model.loaded}


@app.get("/model/info", tags=["model"])
def model_info():
    _require_model()
    return iris_model.metadata


@app.post("/predict", response_model=PredictionResponse, tags=["prediction"])
def predict(features: IrisFeatures):
    _require_model()
    return iris_model.predict([features.to_row()])[0]


@app.post("/predict/batch", response_model=BatchResponse, tags=["prediction"])
def predict_batch(req: BatchRequest):
    _require_model()
    return {"predictions": iris_model.predict([f.to_row() for f in req.items])}
