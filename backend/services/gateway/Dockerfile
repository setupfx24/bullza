FROM python:3.12-slim

WORKDIR /app

COPY backend/services/gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/gateway /app/services/gateway

# Run as non-root. Uploads dir is bind-mounted in compose; chown the
# in-image copy so the bind-mount inherits ownership where it can.
RUN groupadd --system --gid 1001 app && \
    useradd  --system --uid 1001 --gid app --home /app --shell /bin/false app && \
    mkdir -p /app/uploads && chown -R app:app /app
USER app

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "services.gateway.src.main:app", "--host", "0.0.0.0", "--port", "8000"]
