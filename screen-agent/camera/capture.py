"""
Camera capture service.
Reads from USB/CSI camera at CAPTURE_FPS and writes JPEG frames to FRAME_DIR.
Only the most recent frame is kept — inference reads it at its own pace.
"""

import os
import time
import cv2

FRAME_DIR  = os.getenv("FRAME_DIR", "/frames")
CAPTURE_FPS = float(os.getenv("CAPTURE_FPS", "1"))
FRAME_PATH = os.path.join(FRAME_DIR, "latest.jpg")

os.makedirs(FRAME_DIR, exist_ok=True)

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

if not cap.isOpened():
    raise RuntimeError("Could not open camera /dev/video0. Check device mapping.")

interval = 1.0 / CAPTURE_FPS
print(f"[camera] Capturing at {CAPTURE_FPS} FPS → {FRAME_PATH}", flush=True)

while True:
    start = time.time()
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(FRAME_PATH, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    elapsed = time.time() - start
    time.sleep(max(0, interval - elapsed))
