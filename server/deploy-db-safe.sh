#!/bin/bash
# DB-safe deploy helper:
# 1) recover/verify SQLite
# 2) deploy code only (exclude data.db*)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/tc-manager}"
DB_PATH="${DB_PATH:-$APP_DIR/server/data.db}"
SERVICE_NAME="${SERVICE_NAME:-tc-manager}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-nginx}"

usage() {
  cat <<'EOF'
Usage:
  deploy-db-safe.sh scan-backups
  deploy-db-safe.sh restore <healthy-backup-path>
  deploy-db-safe.sh deploy-code-only <source-dir>
  deploy-db-safe.sh full <source-dir> <healthy-backup-path>

Environment overrides:
  APP_DIR=/opt/tc-manager
  DB_PATH=/opt/tc-manager/server/data.db
  SERVICE_NAME=tc-manager
  WEB_SERVICE_NAME=nginx
EOF
}

timestamp() {
  date +%F-%H%M%S
}

backup_current_db() {
  if [ -f "$DB_PATH" ]; then
    local emergency_backup="${DB_PATH}.emergency.$(timestamp)"
    cp -a "$DB_PATH" "$emergency_backup"
    echo "Emergency backup created: $emergency_backup"
  else
    echo "Warning: $DB_PATH not found; skip emergency backup"
  fi
}

scan_backups() {
  echo "Listing DB candidates..."
  ls -lt "${DB_PATH}"* || true
  echo
  # Expected backup names:
  #   data.db.before-restore.YYYY-MM-DD-HHMMSS
  #   data.db.current.YYYY-MM-DD-HHMMSS
  #   data.db.emergency.YYYY-MM-DD-HHMMSS
  echo "Integrity check for candidates (expect: ok):"
  local candidates=()
  local f
  for f in "${DB_PATH}".before-restore* "${DB_PATH}".current.* "${DB_PATH}".emergency.* "$DB_PATH"; do
    [ -f "$f" ] && candidates+=("$f")
  done
  if [ "${#candidates[@]}" -eq 0 ]; then
    echo "No DB candidates found near: $DB_PATH"
    return 0
  fi
  for f in "${candidates[@]}"; do
    [ -f "$f" ] || continue
    echo "=== $f ==="
    if ! sqlite3 "$f" "PRAGMA integrity_check;"; then
      echo "integrity_check failed to run for: $f" >&2
    fi
    echo
  done
}

restore_db() {
  local source_backup="$1"
  if [ ! -f "$source_backup" ]; then
    echo "Error: backup file not found: $source_backup" >&2
    exit 1
  fi

  echo "Stopping ${SERVICE_NAME}..."
  systemctl stop "$SERVICE_NAME"
  backup_current_db

  echo "Restoring healthy DB from: $source_backup"
  cp -a "$source_backup" "$DB_PATH"
  # Restrictive mode by default because DB may contain sensitive data.
  chmod 600 "$DB_PATH"
  local svc_user
  svc_user="$(systemctl show -p User --value "$SERVICE_NAME" 2>/dev/null || true)"
  if [ -z "$svc_user" ] || [ "$svc_user" = "root" ]; then
    chown root:root "$DB_PATH"
  else
    chown "${svc_user}:${svc_user}" "$DB_PATH"
  fi

  echo "Starting ${SERVICE_NAME}..."
  systemctl start "$SERVICE_NAME"
  systemctl status "$SERVICE_NAME" --no-pager -l

  echo "Running DB quick check..."
  sqlite3 "$DB_PATH" "PRAGMA quick_check;"
}

deploy_code_only() {
  local source_dir="$1"
  if [ ! -d "$source_dir" ]; then
    echo "Error: source directory not found: $source_dir" >&2
    exit 1
  fi

  echo "Deploying code only from $source_dir to $APP_DIR ..."
  rsync -av "${source_dir}/" "${APP_DIR}/" \
    --exclude 'server/data.db' \
    --exclude 'server/data.db-*' \
    --exclude 'server/data.db.*' \
    --exclude 'server/logs/' \
    --exclude 'server/uploads/' \
    --exclude 'server/.env'

  cd "$APP_DIR/server"
  if ! npm ci --omit=dev; then
    echo "Error: npm ci failed in $APP_DIR/server" >&2
    exit 1
  fi

  systemctl restart "$SERVICE_NAME"
  systemctl restart "$WEB_SERVICE_NAME"
  systemctl status "$SERVICE_NAME" --no-pager -l
  journalctl -u "$SERVICE_NAME" -n 30 --no-pager
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    scan-backups)
      scan_backups
      ;;
    restore)
      [ $# -eq 2 ] || { usage; exit 1; }
      restore_db "$2"
      ;;
    deploy-code-only)
      [ $# -eq 2 ] || { usage; exit 1; }
      deploy_code_only "$2"
      ;;
    full)
      [ $# -eq 3 ] || { usage; exit 1; }
      restore_db "$3"
      deploy_code_only "$2"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
