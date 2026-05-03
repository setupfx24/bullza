import json
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from .config import get_settings

settings = get_settings()


class KafkaTopics:
    ORDERS = "orders"
    TRADES = "trades"
    POSITIONS = "positions"
    DEPOSITS = "deposits"
    WITHDRAWALS = "withdrawals"
    COMMISSIONS = "commissions"
    NOTIFICATIONS = "notifications"
    AUDIT = "audit"
    MARKET_DATA = "market_data"
    RISK_EVENTS = "risk_events"
    SOCIAL_COPY = "social_copy"


_producer = None


async def get_kafka_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        # acks="all" + idempotent producer = exactly-once semantics on the
        # producer side: a broker leader change can't drop or duplicate the
        # message in flight. send_and_wait() on top of this gives us a
        # synchronous-feeling at-least-once contract for trade events.
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            acks="all",
            enable_idempotence=True,
            compression_type="gzip",
        )
        await _producer.start()
    return _producer


async def produce_event(topic: str, key: str, value: dict):
    producer = await get_kafka_producer()
    await producer.send_and_wait(topic, key=key, value=value)


def create_consumer(topic: str, group_id: str) -> AIOKafkaConsumer:
    """Build a consumer with reliability defaults suited to financial events:

      * ``auto_offset_reset='earliest'``  — a fresh consumer group reads from
        the start of the topic, not the tip. Prevents silent gap-on-restart
        for new services. (Existing groups already have committed offsets,
        so this only affects first-time starts.)
      * ``enable_auto_commit=False``      — caller commits manually after the
        DB write succeeds, giving at-least-once semantics. Combined with the
        consumer-side dedup table (processed_webhooks-style), the system is
        effectively exactly-once.
    """
    return AIOKafkaConsumer(
        topic,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=group_id,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )


async def close_producer():
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
