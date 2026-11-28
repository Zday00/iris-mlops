GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
export GIT_COMMIT

.PHONY: help build train up down logs test clean ps

help: ## Affiche cette aide
	@grep -E '^[a-z]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-8s %s\n", $$1, $$2}'

build: ## Construit les 3 images Docker
	docker compose build

train: ## Ré-entraîne le modèle uniquement
	docker compose run --rm training

up: ## Lance toute la stack (training -> backend -> frontend)
	docker compose up -d --build

down: ## Arrête la stack
	docker compose down

logs: ## Suit les logs
	docker compose logs -f

ps: ## Etat des conteneurs
	docker compose ps -a

test: ## Lance les tests (training + API) dans un conteneur Python jetable
	docker run --rm -v $(PWD):/src -w /src python:3.11-slim sh -c "pip install -q -r training/requirements.txt -r backend/requirements.txt && pytest -q training/tests && cd backend && pytest -q tests"

clean: ## Supprime conteneurs, images et artefacts
	docker compose down --rmi local -v
	rm -f models/*.joblib models/*.json
