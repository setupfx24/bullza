"""AI Station SL/TP watcher.

Every few seconds, closes any open AI-Station signal whose stop-loss or
take-profit has been reached by the live tick. Display-only — it closes the
display copies, never a real position. Mirrors the fixed_return_engine shape:
a leader lock so only one worker sweeps under --workers N.
"""
import asyncio
import logging

from packages.common.src.database import AsyncSessionLocal
from packages.common.src import ai_station_service

logger = logging.getLogger("ai-station-engine")

CHECK_INTERVAL = 3.0


class AiStationEngine:
    def __init__(self) -> None:
        self._running = False

    async def start(self):
        self._running = True
        logger.info("AI Station SL/TP engine started (tick=%.1fs)", CHECK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        from packages.common.src.redis_client import acquire_leader_lock
        while self._running:
            try:
                if not await acquire_leader_lock("engine:ai_station:lock", 10):
                    await asyncio.sleep(CHECK_INTERVAL)
                    continue
                async with AsyncSessionLocal() as db:
                    closed = await ai_station_service.sweep_sltp(db)
                if closed:
                    logger.info("AI Station: SL/TP closed %d signal(s)", closed)
            except Exception as e:
                logger.error("AI Station engine error: %s", e, exc_info=True)
            await asyncio.sleep(CHECK_INTERVAL)


ai_station_engine = AiStationEngine()
