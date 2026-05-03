FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY backend/services/admin/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/admin /app

RUN groupadd --system --gid 1001 swisdex && \
    useradd  --system --uid 1001 --gid swisdex --home /app --shell /bin/false swisdex && \
    mkdir -p /app/uploads && chown -R swisdex:swisdex /app
USER swisdex

ENV PYTHONPATH=/app

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
