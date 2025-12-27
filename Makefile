.PHONY: install run dev build lint format test typecheck clean help \
        frontend.install frontend.dev frontend.build frontend.lint frontend.typecheck \
        backend.install backend.run backend.lint backend.format backend.test

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# Combined Commands
# =============================================================================

install: frontend.install backend.install ## Install all dependencies

run: dev ## Alias for dev

dev: frontend.dev ## Start development (frontend starts backend automatically)

lint: frontend.lint backend.lint ## Run all linters

format: backend.format ## Format all code

test: backend.test ## Run all tests

# =============================================================================
# Frontend Commands
# =============================================================================

frontend.install: ## Install frontend dependencies
	cd frontend && npm install

frontend.dev: ## Start Electron in dev mode (auto-starts backend)
	cd frontend && npm run dev

frontend.build: ## Build frontend for production
	cd frontend && npm run build

frontend.lint: ## Run ESLint on frontend
	cd frontend && npm run lint

frontend.typecheck: ## Run TypeScript type checking
	cd frontend && npm run typecheck

# =============================================================================
# Backend Commands
# =============================================================================

backend.install: ## Install backend dependencies
	cd backend && uv sync

backend.run: ## Start backend server standalone
	cd backend && uv run uvicorn video_audio_combiner.main:app --reload --port 8000

backend.lint: ## Run ruff linter on backend
	cd backend && uv run ruff check src

backend.format: ## Format backend code with ruff
	cd backend && uv run ruff format src

backend.test: ## Run backend tests
	cd backend && uv run pytest

# =============================================================================
# Utility Commands
# =============================================================================

clean: ## Clean build artifacts and caches
	rm -rf frontend/dist frontend/out frontend/node_modules/.cache
	rm -rf backend/.pytest_cache backend/.ruff_cache
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# =============================================================================
# Help
# =============================================================================

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9._-]+:.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
