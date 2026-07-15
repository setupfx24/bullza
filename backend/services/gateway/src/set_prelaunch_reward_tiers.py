"""One-off (client 2026-07-15): set the PRE LAUNCH OFFER reward campaign to
FIXED-VALUE milestone tiers (reward shown as $ value, not a percentage).

Values from the client (threshold x their intended %):
  $1,000+   -> $20
  $5,000+   -> $150
  $10,000+  -> $400
  $25,000+  -> $1,125
  $50,000+  -> $2,500
  $100,000+ -> $5,500
  $200,000+ -> $12,000

Replaces the target campaign's tiers wholesale. DRY-RUN by default.
    python -m services.gateway.src.set_prelaunch_reward_tiers
    python -m services.gateway.src.set_prelaunch_reward_tiers --execute
    python -m services.gateway.src.set_prelaunch_reward_tiers --title "PRE LAUNCH OFFER" --execute
"""
import argparse
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import RewardCampaign, RewardCampaignTier

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("set-prelaunch-tiers")

# (min_amount, max_amount|None, reward_amount)
TIERS = [
    (1000,    5000,   20),
    (5000,    10000,  150),
    (10000,   25000,  400),
    (25000,   50000,  1125),
    (50000,   100000, 2500),
    (100000,  200000, 5500),
    (200000,  None,   12000),
]


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", default="PRE LAUNCH OFFER", help="Campaign title to target (case-insensitive)")
    parser.add_argument("--execute", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        c = (await db.execute(
            select(RewardCampaign).where(func.lower(RewardCampaign.title) == args.title.strip().lower())
        )).scalars().first()
        if c is None:
            logger.error("No campaign titled %r found.", args.title)
            return
        logger.info("Target campaign: %s (%s)", c.title, c.id)
        logger.info("New fixed-value tiers:")
        for lo, hi, rew in TIERS:
            logger.info("  $%s%s -> $%s", f"{lo:,}", f"-{hi:,}" if hi else "+", f"{rew:,}")

        if args.execute:
            await db.execute(sql_delete(RewardCampaignTier).where(RewardCampaignTier.campaign_id == c.id))
            for lo, hi, rew in TIERS:
                db.add(RewardCampaignTier(
                    campaign_id=c.id,
                    min_amount=Decimal(str(lo)),
                    max_amount=Decimal(str(hi)) if hi is not None else None,
                    reward_pct=None,
                    reward_amount=Decimal(str(rew)),
                ))
            await db.commit()
            logger.info("COMMITTED — %d fixed-value tiers set.", len(TIERS))
        else:
            logger.info("Dry-run only — re-run with --execute to write.")


if __name__ == "__main__":
    asyncio.run(main())
