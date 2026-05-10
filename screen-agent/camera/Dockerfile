FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir opencv-python-headless

WORKDIR /app
COPY capture.py .

CMD ["python", "capture.py"]
