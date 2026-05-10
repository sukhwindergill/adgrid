FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# MediaPipe for face detection + landmark-based attention scoring
# DeepFace for demographic estimation (age/gender)
# OpenCV for image reading
RUN pip install --no-cache-dir \
    opencv-python-headless \
    mediapipe \
    deepface \
    tf-keras \
    numpy

WORKDIR /app
COPY detector.py .

CMD ["python", "detector.py"]
