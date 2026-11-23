# ---- Image d'entraînement du modèle Iris ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_DIR=/models

WORKDIR /app

# 1) Dépendances d'abord (meilleur cache Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) Code ensuite
COPY . .

# Commit Git injecté au build pour la traçabilité
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}

CMD ["python", "train.py"]
