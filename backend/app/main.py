"""
ORBITA — FastAPI Entrypoint.

Bootstraps the backend server, configures CORS, initializes logging,
loads the machine learning classifier, and spawns the background scheduler.
"""

from __future__ import annotations

import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.ml.predict import load_model
from app.core.tle import fetch_and_store_catalog
from app.core.screening import run_screening
from app.jobs.scheduler import setup_scheduler, shutdown_scheduler

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("orbita.main")

# Global scheduler container
_scheduler = None


async def initialize_application():
    """Initialise catalog, ML models, and trigger first screening."""
    logger.info("Initializing application state...")
    try:
        # Load ML model (will train it if model.pkl is missing)
        await asyncio.to_thread(load_model)
        logger.info("ML model loaded successfully.")

        # Ingest orbit data (CelesTrak)
        logger.info("Fetching TLE catalog data...")
        await asyncio.to_thread(fetch_and_store_catalog)
        logger.info("Catalog fetched successfully.")

        # Execute initial screening run
        logger.info("Running initial conjunction screening...")
        await asyncio.to_thread(run_screening)
        logger.info("Initial screening run complete.")

    except Exception as exc:
        logger.critical("Failed to initialize application state: %s", exc, exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle events."""
    global _scheduler
    
    # Startup tasks
    asyncio.create_task(initialize_application())
    
    # Setup periodic background jobs
    _scheduler = setup_scheduler()
    
    yield
    
    # Shutdown tasks
    if _scheduler:
        shutdown_scheduler(_scheduler)


# Create FastAPI application
app = FastAPI(
    title="ORBITA API",
    description="Inteligência de tráfego orbital. Rastreia o tráfego no espaço, prevê aproximações perigosas e usa IA.",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev mode
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints
app.include_router(router)
