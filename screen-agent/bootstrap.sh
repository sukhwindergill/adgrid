#!/usr/bin/env bash
#
# AdGrid Screen Agent — bootstrap script
#
# Provisions a fresh Raspberry Pi 5 / Debian mini PC as a physical AdGrid
# screen: installs Docker + Chromium, disables screen blanking, configures
# and starts the screen-agent Docker stack (camera/inference/pusher), and
# installs + starts the kiosk display systemd service.
#
# Run from inside the cloned repo, as root:
#   sudo ./screen-agent/bootstrap.sh
#
# Non-interactive usage (CI / fleet provisioning):
#   sudo SCREEN_TOKEN=xxx SUPABASE_ANON_KEY=yyy KIOSK_USER=pi \
#     ./screen-agent/bootstrap.sh
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

if [[ -z "$SCREEN_TOKEN" ]]; then
  read -rp "Screen token (Setup Guide tab on screen detail page): " SCREEN_TOKEN
fi
[[ -n "$SCREEN_TOKEN" ]] || die "SCREEN_TOKEN required"

if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  read -rp "Supabase anon key: " SUPABASE_ANON_KEY
fi
[[ -n "$SUPABASE_ANON_KEY" ]] || die "SUPABASE_ANON_KEY required"

id -u "$KIOSK_USER" &>/dev/null || die "user '$KIOSK_USER' does not exist (set KIOSK_USER=...)"

log "Provisioning AdGrid screen as user '$KIOSK_USER'"

# ── 1. Docker + compose plugin ──────────────────────────────────────────
apt-get update -y

if ! command -v docker &>/dev/null; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker already installed ($(docker --version))"
fi
usermod -aG docker "$KIOSK_USER"

if ! docker compose version &>/dev/null; then
  log "Installing docker-compose-plugin"
  apt-get install -y docker-compose-plugin
fi

# ── 2. Chromium (kiosk browser) ─────────────────────────────────────────
if ! command -v chromium-browser &>/dev/null && ! command -v chromium &>/dev/null; then
  log "Installing Chromium"
  apt-get install -y chromium-browser || apt-get install -y chromium
else
  log "Chromium already installed"
fi

# ── 3. Disable screen blanking ──────────────────────────────────────────
AUTOSTART_DIR="/etc/xdg/lxsession/LXDE-pi"
AUTOSTART_FILE="$AUTOSTART_DIR/autostart"
if [[ -d "$AUTOSTART_DIR" ]]; then
  log "Disabling screen blanking"
  touch "$AUTOSTART_FILE"
  for line in "@xset s off" "@xset -dpms" "@xset s noblank"; do
    grep -qxF "$line" "$AUTOSTART_FILE" || echo "$line" >> "$AUTOSTART_FILE"
  done
else
  warn "no LXDE-pi autostart dir found — skipping screen-blanking tweak (not Raspberry Pi Desktop?)"
fi

# ── 4. Camera check ──────────────────────────────────────────────────────
[[ -e "$CAMERA_DEVICE" ]] || warn "camera device $CAMERA_DEVICE not found — plug in USB camera before/after starting screen-agent"

# ── 5. Screen-agent Docker stack ────────────────────────────────────────
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

# ── 6. Display kiosk service ────────────────────────────────────────────
log "Installing display service"
cp "$SCRIPT_DIR/display/adgrid-display.service" /etc/systemd/system/adgrid-display.service
sed -i "s/^User=.*/User=$KIOSK_USER/" /etc/systemd/system/adgrid-display.service

cat > /etc/adgrid-display.env <<EOF
DISPLAY_URL=$APP_ORIGIN/display/$SCREEN_TOKEN
EOF
chmod 600 /etc/adgrid-display.env

systemctl daemon-reload
systemctl enable adgrid-display
systemctl restart adgrid-display

# ── 7. Verify ────────────────────────────────────────────────────────────
log "Status"
docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps
systemctl --no-pager --lines=0 status adgrid-display || true

log "Done — screen agent + kiosk display running."
echo "  Display URL:  $APP_ORIGIN/display/$SCREEN_TOKEN"
echo "  Kiosk logs:   journalctl -u adgrid-display -f"
echo "  Agent logs:   docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f"
echo ""
echo "  Note: '$KIOSK_USER' was added to the docker group — log out/in (or reboot)"
echo "  for that to take effect for non-root docker commands."
