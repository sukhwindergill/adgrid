#!/usr/bin/env bash
#
# AdGrid Screen Agent — bootstrap script
#
# Provisions a fresh Raspberry Pi 5 / Debian mini PC as a physical AdGrid
# screen: installs Chromium, disables screen blanking, and installs + starts
# the kiosk display systemd service. With a SCREEN_TOKEN it also installs
# Docker and starts the screen-agent camera stack (camera/inference/pusher).
#
# Run from inside the cloned repo, as root:
#   sudo ./screen-agent/bootstrap.sh
#
# Without a SCREEN_TOKEN the display boots to <APP_ORIGIN>/pair, which shows
# a 6-character code; enter it on the screen's Setup Guide tab in the AdGrid
# dashboard to connect it. The camera stack needs the token, so it's skipped.
#
# Non-interactive usage (CI / fleet provisioning):
#   sudo SCREEN_TOKEN=xxx SUPABASE_ANON_KEY=yyy KIOSK_USER=pi \
#     ./screen-agent/bootstrap.sh
#   sudo KIOSK_USER=pi ./screen-agent/bootstrap.sh </dev/null   # pairing-code mode
#
# Get SCREEN_TOKEN and SUPABASE_ANON_KEY from the Setup Guide tab on the
# screen's detail page in the AdGrid dashboard.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_URL_DEFAULT="https://hkqiuwnppxkkztacwicj.supabase.co"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33mWARN:\033[0m $*" >&2; }
die()  { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root: sudo $0"

# ── Gather config ────────────────────────────────────────────────────────
KIOSK_USER="${KIOSK_USER:-${SUDO_USER:-pi}}"
SCREEN_TOKEN="${SCREEN_TOKEN:-}"
SUPABASE_URL="${SUPABASE_URL:-$SUPABASE_URL_DEFAULT}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
CAMERA_DEVICE="${CAMERA_DEVICE:-/dev/video0}"
APP_ORIGIN="${APP_ORIGIN:-https://app.adgrid.io}"

if [[ -z "$SCREEN_TOKEN" && -t 0 ]]; then
  read -rp "Screen token (Enter to skip and pair with a code on screen instead): " SCREEN_TOKEN
fi

if [[ -n "$SCREEN_TOKEN" ]]; then
  if [[ -z "$SUPABASE_ANON_KEY" && -t 0 ]]; then
    read -rp "Supabase anon key: " SUPABASE_ANON_KEY
  fi
  [[ -n "$SUPABASE_ANON_KEY" ]] || die "SUPABASE_ANON_KEY required with SCREEN_TOKEN"
  DISPLAY_URL="$APP_ORIGIN/display/$SCREEN_TOKEN"
else
  DISPLAY_URL="$APP_ORIGIN/pair"
fi

id -u "$KIOSK_USER" &>/dev/null || die "user '$KIOSK_USER' does not exist (set KIOSK_USER=...)"

log "Provisioning AdGrid screen as user '$KIOSK_USER'"

apt-get update -y

# ── 1. Docker + compose plugin (camera stack only) ──────────────────────
if [[ -z "$SCREEN_TOKEN" ]]; then
  log "No SCREEN_TOKEN — skipping Docker/camera stack (re-run with SCREEN_TOKEN=... to add it)"
elif ! command -v docker &>/dev/null; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker already installed ($(docker --version))"
fi
if [[ -n "$SCREEN_TOKEN" ]]; then
  usermod -aG docker "$KIOSK_USER"
  if ! docker compose version &>/dev/null; then
    log "Installing docker-compose-plugin"
    apt-get install -y docker-compose-plugin
  fi
fi

# ── 2. Chromium (kiosk browser) ─────────────────────────────────────────
# Raspberry Pi OS Bookworm / Debian 12 package it as `chromium`; the
# `chromium-browser` name only exists on older images.
if ! command -v chromium-browser &>/dev/null && ! command -v chromium &>/dev/null; then
  log "Installing Chromium"
  apt-get install -y chromium || apt-get install -y chromium-browser
else
  log "Chromium already installed"
fi

# ── 3. Disable screen blanking ──────────────────────────────────────────
# Bookworm (Wayland/labwc) ignores xset; raspi-config handles both Wayland
# and X11. The LXDE autostart file only matters on pre-Bookworm X11 images.
AUTOSTART_DIR="/etc/xdg/lxsession/LXDE-pi"
AUTOSTART_FILE="$AUTOSTART_DIR/autostart"
if command -v raspi-config &>/dev/null; then
  log "Disabling screen blanking (raspi-config)"
  raspi-config nonint do_blanking 1 || warn "raspi-config do_blanking failed — turn off blanking in Raspberry Pi Configuration > Display"
elif [[ -d "$AUTOSTART_DIR" ]]; then
  log "Disabling screen blanking (LXDE)"
  touch "$AUTOSTART_FILE"
  for line in "@xset s off" "@xset -dpms" "@xset s noblank"; do
    grep -qxF "$line" "$AUTOSTART_FILE" || echo "$line" >> "$AUTOSTART_FILE"
  done
else
  warn "no raspi-config or LXDE-pi autostart found — turn off screen blanking/sleep in the desktop's power settings"
fi

if [[ -n "$SCREEN_TOKEN" ]]; then
  # ── 4. Camera check ────────────────────────────────────────────────────
  [[ -e "$CAMERA_DEVICE" ]] || warn "camera device $CAMERA_DEVICE not found — plug in USB camera before/after starting screen-agent"

  # ── 5. Screen-agent Docker stack ───────────────────────────────────────
  log "Writing screen-agent .env"
  ENV_FILE="$SCRIPT_DIR/.env"
  cat > "$ENV_FILE" <<EOF
SCREEN_TOKEN=$SCREEN_TOKEN
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
  chmod 600 "$ENV_FILE"

  log "Starting screen-agent (camera + inference + pusher)"
  (cd "$SCRIPT_DIR" && docker compose up -d)
fi

# ── 6. Display kiosk service ────────────────────────────────────────────
log "Installing display service"
cp "$SCRIPT_DIR/display/adgrid-display.service" /etc/systemd/system/adgrid-display.service
sed -i "s/^User=.*/User=$KIOSK_USER/" /etc/systemd/system/adgrid-display.service
# Wayland sessions (Bookworm/labwc) need the kiosk user's runtime dir.
sed -i "s|^Environment=XDG_RUNTIME_DIR=.*|Environment=XDG_RUNTIME_DIR=/run/user/$(id -u "$KIOSK_USER")|" /etc/systemd/system/adgrid-display.service

cat > /etc/adgrid-display.env <<EOF
DISPLAY_URL=$DISPLAY_URL
EOF
chmod 600 /etc/adgrid-display.env

systemctl daemon-reload
systemctl enable adgrid-display
systemctl restart adgrid-display

# ── 7. Display watchdog (S20) ───────────────────────────────────────────
# adgrid-display.service stops retrying after 5 crashes/60s and never
# recovers on its own, even once the fault clears — this timer periodically
# clears that failed state and restarts it, so a crash-loop doesn't leave
# the screen dark until someone SSHes in.
log "Installing display watchdog"
cp "$SCRIPT_DIR/display/adgrid-display-watchdog.service" /etc/systemd/system/adgrid-display-watchdog.service
cp "$SCRIPT_DIR/display/adgrid-display-watchdog.timer" /etc/systemd/system/adgrid-display-watchdog.timer
systemctl daemon-reload
systemctl enable --now adgrid-display-watchdog.timer

# ── 8. Verify ────────────────────────────────────────────────────────────
log "Status"
if [[ -n "$SCREEN_TOKEN" ]]; then docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps; fi
systemctl --no-pager --lines=0 status adgrid-display || true
systemctl --no-pager --lines=0 status adgrid-display-watchdog.timer || true

log "Done — kiosk display running."
echo "  Display URL:  $DISPLAY_URL"
echo "  Kiosk logs:   journalctl -u adgrid-display -f"
if [[ -n "$SCREEN_TOKEN" ]]; then
  echo "  Agent logs:   docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f"
  echo ""
  echo "  Note: '$KIOSK_USER' was added to the docker group — log out/in (or reboot)"
  echo "  for that to take effect for non-root docker commands."
else
  echo ""
  echo "  The screen now shows a 6-character pairing code. Enter it on your screen's"
  echo "  Setup Guide tab in the AdGrid dashboard to connect it."
fi
