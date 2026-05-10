"""
CV inference service.
Reads latest.jpg from FRAME_DIR every second.
Detects faces, estimates dwell time, attention score, age bracket, gender.
Aggregates stats over WINDOW_SECONDS and writes a JSON result file.

Privacy guarantee: raw frames are never stored or transmitted.
Only aggregated anonymous statistics leave this service.
"""

import os
import json
import time
import math
import threading
from pathlib import Path
from datetime import datetime, timezone

import cv2
import numpy as np
import mediapipe as mp

FRAME_DIR       = os.getenv("FRAME_DIR", "/frames")
RESULTS_DIR     = os.getenv("RESULTS_DIR", "/frames/results")
WINDOW_SECONDS  = int(os.getenv("WINDOW_SECONDS", "30"))
FRAME_PATH      = os.path.join(FRAME_DIR, "latest.jpg")

os.makedirs(RESULTS_DIR, exist_ok=True)

mp_face = mp.solutions.face_detection
mp_mesh = mp.solutions.face_mesh

# Track face positions across frames for dwell time estimation
# Key: approximate face region hash, Value: first_seen timestamp
face_tracker: dict[str, float] = {}
POSITION_BUCKET = 80  # pixels — bucket size for position-based tracking

def bucket_pos(x, y):
    return (x // POSITION_BUCKET, y // POSITION_BUCKET)

def estimate_attention(landmarks):
    """
    Estimate attention score 0–1 from face landmarks.
    Frontal face (nose roughly centred between eyes) = high attention.
    Profile = low attention.
    """
    if not landmarks:
        return 0.5
    # Use nose tip, left eye, right eye landmarks
    try:
        nose  = landmarks[1]
        l_eye = landmarks[33]
        r_eye = landmarks[263]
        eye_centre_x = (l_eye.x + r_eye.x) / 2
        nose_x = nose.x
        # How centred is the nose between the eyes (0=perfectly centred)
        offset = abs(nose_x - eye_centre_x) / max(abs(r_eye.x - l_eye.x), 0.001)
        # score: 1.0 when offset=0, 0.1 when offset>=0.5
        score = max(0.1, 1.0 - (offset * 1.8))
        return round(score, 3)
    except Exception:
        return 0.5

def classify_age(age_val):
    if age_val < 25:   return "18_24"
    if age_val < 35:   return "25_34"
    if age_val < 45:   return "35_44"
    if age_val < 55:   return "45_54"
    return "55_plus"

def run_window():
    """Collect stats for one WINDOW_SECONDS period, write result JSON."""
    from deepface import DeepFace

    window_start = datetime.now(timezone.utc)
    stats = {
        "people_count": 0,
        "dwell_samples": [],
        "attention_samples": [],
        "age_18_24": 0, "age_25_34": 0, "age_35_44": 0,
        "age_45_54": 0, "age_55_plus": 0,
        "gender_male": 0, "gender_female": 0, "gender_unknown": 0,
    }

    face_tracker.clear()
    end_time = time.time() + WINDOW_SECONDS

    with mp_face.FaceDetection(min_detection_confidence=0.5) as detector, \
         mp_mesh.FaceMesh(static_image_mode=True, max_num_faces=10, min_detection_confidence=0.4) as mesher:

        while time.time() < end_time:
            frame_time = time.time()

            if not Path(FRAME_PATH).exists():
                time.sleep(1)
                continue

            frame = cv2.imread(FRAME_PATH)
            if frame is None:
                time.sleep(1)
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w = frame.shape[:2]

            detection_result = detector.process(rgb)
            mesh_result = mesher.process(rgb)

            if not detection_result.detections:
                time.sleep(1)
                continue

            faces_this_frame = []
            for det in detection_result.detections:
                bb = det.location_data.relative_bounding_box
                cx = int((bb.xmin + bb.width / 2) * w)
                cy = int((bb.ymin + bb.height / 2) * h)
                faces_this_frame.append((cx, cy, bb, det))

            stats["people_count"] = max(stats["people_count"], len(faces_this_frame))

            for cx, cy, bb, det in faces_this_frame:
                key = str(bucket_pos(cx, cy))
                now = time.time()
                if key not in face_tracker:
                    face_tracker[key] = now
                dwell = now - face_tracker[key]
                stats["dwell_samples"].append(dwell)

                # Attention from mesh landmarks
                attention = 0.5
                if mesh_result.multi_face_landmarks:
                    for fl in mesh_result.multi_face_landmarks:
                        attention = estimate_attention(fl.landmark)
                        break
                stats["attention_samples"].append(attention)

                # Demographic estimation — crop face region
                try:
                    x1 = max(0, int(bb.xmin * w))
                    y1 = max(0, int(bb.ymin * h))
                    x2 = min(w, int((bb.xmin + bb.width) * w))
                    y2 = min(h, int((bb.ymin + bb.height) * h))
                    face_crop = frame[y1:y2, x1:x2]
                    if face_crop.size > 0:
                        analysis = DeepFace.analyze(
                            face_crop, actions=["age", "gender"],
                            enforce_detection=False, silent=True,
                        )
                        if isinstance(analysis, list):
                            analysis = analysis[0]
                        age_bracket = classify_age(analysis.get("age", 30))
                        stats[f"age_{age_bracket}"] += 1
                        gender = analysis.get("dominant_gender", "unknown").lower()
                        if "man" in gender or gender == "male":
                            stats["gender_male"] += 1
                        elif "woman" in gender or gender == "female":
                            stats["gender_female"] += 1
                        else:
                            stats["gender_unknown"] += 1
                except Exception:
                    stats["gender_unknown"] += 1

            # Remove stale face tracks (not seen for >10s)
            stale = [k for k, t in face_tracker.items() if time.time() - t > 10]
            for k in stale:
                del face_tracker[k]

            time.sleep(1)

    window_end = datetime.now(timezone.utc)
    avg_dwell = round(sum(stats["dwell_samples"]) / max(len(stats["dwell_samples"]), 1), 2)
    avg_attention = round(sum(stats["attention_samples"]) / max(len(stats["attention_samples"]), 1), 3)

    result = {
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "people_count": stats["people_count"],
        "avg_dwell_seconds": avg_dwell,
        "avg_attention_score": avg_attention,
        "age_18_24": stats["age_18_24"],
        "age_25_34": stats["age_25_34"],
        "age_35_44": stats["age_35_44"],
        "age_45_54": stats["age_45_54"],
        "age_55_plus": stats["age_55_plus"],
        "gender_male": stats["gender_male"],
        "gender_female": stats["gender_female"],
        "gender_unknown": stats["gender_unknown"],
    }

    ts = window_start.strftime("%Y%m%d_%H%M%S")
    result_path = os.path.join(RESULTS_DIR, f"{ts}.json")
    with open(result_path, "w") as f:
        json.dump(result, f)

    print(f"[inference] Window {ts}: {result['people_count']} people, "
          f"dwell={avg_dwell}s, attention={avg_attention}", flush=True)


if __name__ == "__main__":
    print(f"[inference] Starting. Window={WINDOW_SECONDS}s", flush=True)
    while True:
        try:
            run_window()
        except Exception as e:
            print(f"[inference] Error in window: {e}", flush=True)
            time.sleep(5)
