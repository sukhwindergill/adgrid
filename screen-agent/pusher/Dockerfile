FROM python:3.11-slim

RUN pip install --no-cache-dir requests==2.32.3

WORKDIR /app
COPY event_pusher.py .

CMD ["python", "event_pusher.py"]
