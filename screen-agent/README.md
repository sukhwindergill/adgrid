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

On a fresh Raspberry Pi 5 (Raspberry Pi OS Bookworm) / Debian mini PC, `bootstrap.sh` does everything below in one shot: installs Chromium, disables screen blanking, and installs + starts the kiosk display service. With a screen token it also installs Docker and starts the screen-agent camera stack.

```bash
sudo ./screen-agent/bootstrap.sh
```

Press Enter at the token prompt to skip it: the screen boots to `https://app.adgrid.io/pair`, shows a 6-character code, and you type that code into the **Setup Guide** tab in the dashboard. The display remembers its screen across reboots.

For the camera stack too, give it `SCREEN_TOKEN` and `SUPABASE_ANON_KEY` (from the Setup Guide tab), interactively or non-interactively:

```bash
sudo SCREEN_TOKEN=xxx SUPABASE_ANON_KEY=yyy KIOSK_USER=pi ./screen-agent/bootstrap.sh
```

Prefer to do it by hand, or provisioning a non-Debian system? Manual steps below.

---

## Display Setup (Kiosk Browser)

The display is a web page served from the AdGrid platform. Point the kiosk browser at the pairing page:

```
https://app.adgrid.io/pair
```

It shows a 6-character code. Enter it on the **Setup Guide** tab of your screen's detail page in the AdGrid dashboard; the page then switches itself to that screen's player and remembers it across reboots (open `/pair?reset=1` to pair the device to a different screen).

Advanced: `https://app.adgrid.io/display/<YOUR_SCREEN_TOKEN>` skips pairing. The token is on the same Setup Guide tab; treat that URL like a password.

### Raspberry Pi OS Bookworm / Debian Linux

Bookworm runs Wayland (labwc compositor) by default, the Chromium package is `chromium` (not `chromium-browser`), and the old `/etc/xdg/lxsession/LXDE-pi/autostart` + `xset` approach no longer applies.

**1. Install Chromium (if not already installed):**
```bash
sudo apt-get install -y chromium
```

**2. Disable screen blanking:**
```bash
sudo raspi-config nonint do_blanking 1
```
(Pre-Bookworm X11 images: add `@xset s off`, `@xset -dpms`, `@xset s noblank` to `/etc/xdg/lxsession/LXDE-pi/autostart` instead. Non-Pi desktops: turn off blanking/sleep in the desktop's power settings.)

**3. Install the systemd service:**
```bash
# Copy the service and env files from this directory
sudo cp display/adgrid-display.service /etc/systemd/system/

> **Note:** The service file defaults to `User=pi` with `XDG_RUNTIME_DIR=/run/user/1000`. If your username is different, edit the file after copying:
> ```bash
> sudo nano /etc/systemd/system/adgrid-display.service
> # Change: User=pi  →  User=your-username
> # Change: XDG_RUNTIME_DIR=/run/user/1000  →  /run/user/$(id -u your-username)
> ```

sudo cp display/adgrid-display.env.example /etc/adgrid-display.env

# Defaults to the pairing page; edit only to use the advanced player URL
sudo nano /etc/adgrid-display.env
# Secure the file (it holds the token if you use the player URL)
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
