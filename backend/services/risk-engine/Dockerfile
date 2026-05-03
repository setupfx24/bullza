FROM python:3.12-slim

WORKDIR /app

COPY backend/services/risk-engine/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/risk-engine /app/services/risk_engine

RUN groupadd --system --gid 1001 swisdex && \
    useradd  --system --uid 1001 --gid swisdex --home /app --shell /bin/false swisdex && \
    chown -R swisdex:swisdex /app
USER swisdex

ENV PYTHONPATH=/app

CMD ["python", "-m", "services.risk_engine.src.main"]
