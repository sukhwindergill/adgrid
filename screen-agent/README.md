# Screen Agent

The screen agent runs three services that work together to capture video, run inference models, and push results:

- **Camera Service**: Captures video frames from a USB camera connected at `/dev/video0`
- **Inference Service**: Runs ML models to analyze the video frames
- **Pusher Service**: Sends inference results back to the platform in real-time

## Quick Start (Physical Screen)

A physical AdGrid screen needs **two things running**:

| What | Does |
|------|------|
| **Display (kiosk browser)** | Shows ads on screen |
| **Screen agent (Docker)** | Tracks viewers via camera |

Both are required. Set up the display first, then the screen agent below.

---

## Quick Start (Bootstrap Script)

On a fresh Raspberry Pi 5 / Debian mini PC, `bootstrap.sh` does everything below in one shot: installs Docker + Chromium, disables screen blanking, configures and starts the screen-agent Docker stack, and installs + starts the kiosk display service.

```bash
sudo ./screen-agent/bootstrap.sh
```

It'll prompt for `SCREEN_TOKEN` and `SUPABASE_ANON_KEY` (from the Setup Guide tab), or accept them non-interactively:

```bash
sudo SCREEN_TOKEN=xxx SUPABASE_ANON_KEY=yyy KIOSK_USER=pi ./screen-agent/bootstrap.sh
```

Prefer to do it by hand, or provisioning a non-Debian system? Manual steps below.

---

## Display Setup (Kiosk Browser)

The display player is a web page served from the AdGrid platform at:

```
https://app.adgrid.io/display/<YOUR_SCREEN_TOKEN>
```

Get your `SCREEN_TOKEN` from the **Setup Guide** tab on your screen's detail page in the AdGrid dashboard.

### Raspberry Pi / Debian Linux

**1. Install Chromium (if not already installed):**
```bash
sudo apt-get install -y chromium-browser
```

**2. Disable screen blanking** — add these lines to `/etc/xdg/lxsession/LXDE-pi/autostart`:
```
@xset s off
@xset -dpms
@xset s noblank
```

**3. Install the systemd service:**
```bash
# Copy the service and env files from this directory
sudo cp display/adgrid-display.service /etc/systemd/system/

> **Note:** The service file defaults to `User=pi`. If your username is different, edit the file after copying:
> ```bash
> sudo nano /etc/systemd/system/adgrid-display.service
> # Change: User=pi  →  User=your-username
> ```

sudo cp display/adgrid-display.env.example /etc/adgrid-display.env

# Fill in your screen token
sudo nano /etc/adgrid-display.env
# Set: DISPLAY_URL=https://app.adgrid.io/display/YOUR_SCREEN_TOKEN
# Secure the token file
sudo chmod 600 /etc/adgrid-display.env

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable adgrid-display
sudo systemctl start adgrid-display
```

**4. Install the watchdog (recommended):**

`adgrid-display.service` stops retrying after 5 crashes in 60 seconds and won't auto-restart again on its own, even once the fault clears — a crash-loop (bad GPU driver, corrupt profile, OOM) would otherwise leave the screen dark until someone SSHes in and runs `systemctl reset-failed`. This timer clears that failed state and restarts the service every 5 minutes if it's down:

```bash
sudo cp display/adgrid-display-watchdog.service display/adgrid-display-watchdog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now adgrid-display-watchdog.timer
```

**5. Verify:**
```bash
sudo systemctl status adgrid-display
sudo systemctl status adgrid-display-watchdog.timer
```

If it fails to start, check logs:
```bash
journalctl -u adgrid-display -n 50
```

The screen will show ads on boot, auto-recover if Chromium crashes, refresh content every 30 seconds automatically, and self-heal within 5 minutes even if it crash-loops past systemd's own restart limit.

---

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required environment variables in `.env`:
   - `SCREEN_TOKEN`: Get this from the Setup Guide tab on your screen's detail page
   - `SUPABASE_URL`: Already populated with the correct URL
   - `SUPABASE_ANON_KEY`: Get this from the platform or the Setup Guide

3. Start the services:
   ```bash
   docker-compose up -d
   ```

## Requirements

- **Docker**: Make sure Docker and Docker Compose are installed
- **USB Camera**: A USB camera connected at `/dev/video0` (Linux) or equivalent on other systems
