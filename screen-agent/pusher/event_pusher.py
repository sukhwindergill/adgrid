"""
Event pusher service.
Reads result JSON files written by the inference service and
pushes them to the Supabase ingest-impressions edge function.

Only aggregated anonymous stats are transmitted — no images, no PII.
"""

import os
import json
import time
import glob
import requests
from pathlib import Path

SCREEN_TOKEN   = os.getenv("SCREEN_TOKEN", "")
SUPABASE_URL   = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY   = os.getenv("SUPABASE_ANON_KEY", "")
RESULTS_DIR    = os.getenv("RESULTS_DIR", "/frames/results")
PUSH_INTERVAL  = int(os.getenv("PUSH_INTERVAL_SECONDS", "30"))
INGEST_URL     = f"{SUPABASE_URL}/functions/v1/ingest-impressions"

PUSHED_LOG = os.path.join(RESULTS_DIR, ".pushed")

def load_pushed() -> set:
    if not Path(PUSHED_LOG).exists():
        return set()
    with open(PUSHED_LOG) as f:
        return set(f.read().splitlines())

def mark_pushed(filename: str):
    with open(PUSHED_LOG, "a") as f:
        f.write(filename + "\n")

def push_result(result: dict, filename: str) -> bool:
    payload = {
        "screen_token": SCREEN_TOKEN,
        **result,
    }
    try:
        resp = requests.post(
            INGEST_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            timeout=10,
        )
        if resp.status_code == 200:
            print(f"[pusher] ✓ Pushed {filename}", flush=True)
            return True
        else:
            print(f"[pusher] ✗ Failed {filename}: {resp.status_code} {resp.text[:120]}", flush=True)
            return False
    except Exception as e:
        print(f"[pusher] ✗ Error pushing {filename}: {e}", flush=True)
        return False

if __name__ == "__main__":
    if not SCREEN_TOKEN or not SUPABASE_URL:
        raise EnvironmentError("SCREEN_TOKEN and SUPABASE_URL must be set")

    print(f"[pusher] Starting. Ingest URL: {INGEST_URL}", flush=True)
    os.makedirs(RESULTS_DIR, exist_ok=True)

    while True:
        time.sleep(PUSH_INTERVAL)
        pushed = load_pushed()
        result_files = sorted(glob.glob(os.path.join(RESULTS_DIR, "*.json")))

        for path in result_files:
            filename = os.path.basename(path)
            if filename in pushed:
                continue
            try:
                with open(path) as f:
                    result = json.load(f)
                if push_result(result, filename):
                    mark_pushed(filename)
                    # Keep last 100 result files, delete older ones
                    all_files = sorted(glob.glob(os.path.join(RESULTS_DIR, "*.json")))
                    for old in all_files[:-100]:
                        try:
                            os.remove(old)
                        except OSError:
                            pass
            except Exception as e:
                print(f"[pusher] Error reading {filename}: {e}", flush=True)
