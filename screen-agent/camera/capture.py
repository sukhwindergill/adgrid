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

# If the camera is unplugged/fails mid-run, cap.read() just keeps returning
# ret=False forever without cv2 raising — the container stays "up" but frames
# stop updating and nothing ever surfaces that. Exit after sustained failure
# so `restart: unless-stopped` cycles the container and retries cap.open();
# this is the only way the camera reconnecting gets picked back up.
CONSECUTIVE_FAIL_LIMIT = 30  # ~30-60s of failed reads depending on FPS
consecutive_fails = 0

while True:
    start = time.time()
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(FRAME_PATH, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        consecutive_fails = 0
    else:
        consecutive_fails += 1
        print(f"[camera] WARN: frame read failed ({consecutive_fails}/{CONSECUTIVE_FAIL_LIMIT})", flush=True)
        if consecutive_fails >= CONSECUTIVE_FAIL_LIMIT:
            raise RuntimeError(
                f"camera read failed {CONSECUTIVE_FAIL_LIMIT} times in a row — "
                "camera likely disconnected. Exiting for restart."
            )
    elapsed = time.time() - start
    time.sleep(max(0, interval - elapsed))
