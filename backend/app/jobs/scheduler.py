"""
ORBITA — Background job scheduler.

Sets up APScheduler to periodicially refresh the CelesTrak catalog and
run the conjunction screening engine every 4 hours.
"""

from __future__ import annotations

import logging
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.tle import fetch_and_store_catalog
from app.core.screening import run_screening

logger = logging.getLogger("orbita.jobs.scheduler")


def refresh_catalog_and_screen() -> None:
    """Fetch the latest orbital data and run conjunction screening."""
    logger.info("Executing periodic catalog refresh and screening...")
    try:
        fetch_and_store_catalog()
        run_screening()
        logger.info("Periodic catalog refresh and screening successfully completed.")
    except Exception as exc:
        logger.error("Periodic job failed: %s", exc, exc_info=True)


def setup_scheduler() -> BackgroundScheduler:
    """
    Create and start the background scheduler.
    Triggers catalog refresh and screening every 4 hours.
    """
    scheduler = BackgroundScheduler()
    # Schedule periodic task
    scheduler.add_job(
        refresh_catalog_and_screen,
        "interval",
        hours=4,
        id="catalog_refresh_job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler initialized and started.")
    return scheduler


def shutdown_scheduler(scheduler: BackgroundScheduler) -> None:
    """Shutdown the background scheduler gracefully."""
    if scheduler:
        logger.info("Shutting down background scheduler...")
        scheduler.shutdown(wait=False)
