FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# MediaPipe for face detection + landmark-based attention scoring
# DeepFace for demographic estimation (age/gender)
# OpenCV for image reading
RUN pip install --no-cache-dir \
    opencv-python-headless==4.10.0.84 \
    mediapipe==0.10.14 \
    deepface==0.0.93 \
    tf-keras==2.17.0 \
    numpy==1.26.4

WORKDIR /app
COPY detector.py .

CMD ["python", "detector.py"]
