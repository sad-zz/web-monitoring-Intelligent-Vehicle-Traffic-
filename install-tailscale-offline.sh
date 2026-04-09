#!/bin/bash
# ============================================================
# Tailscale Offline Installer Helper
# راهنمای نصب آفلاین Tailscale برای سرور بدون دسترسی اینترنت
# ============================================================
#
# USAGE / نحوه استفاده:
#
#   MODE 1 – روی سیستم دارای اینترنت (لپتاپ/PC):
#     bash install-tailscale-offline.sh download
#     فایل .deb را دانلود و آماده انتقال به سرور میکند.
#
#   MODE 2 – روی خود سرور (بدون اینترنت):
#     bash install-tailscale-offline.sh install [path-to-deb]
#     بسته را نصب کرده و Tailscale را راهاندازی میکند.
#
#   MODE 3 – بررسی مشخصات سیستم عامل سرور:
#     bash install-tailscale-offline.sh info
# ============================================================

set -e

TAILSCALE_BASE_URL="https://pkgs.tailscale.com/stable"

# ── helpers ──────────────────────────────────────────────────

print_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║       Tailscale Offline Installer / نصب آفلاین       ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
}

detect_os_arch() {
    # Distro
    if command -v lsb_release &>/dev/null; then
        DISTRO_ID=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
        DISTRO_CODENAME=$(lsb_release -sc | tr '[:upper:]' '[:lower:]')
        DISTRO_VERSION=$(lsb_release -sr)
    elif [ -f /etc/os-release ]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        DISTRO_ID=$(echo "${ID}" | tr '[:upper:]' '[:lower:]')
        DISTRO_CODENAME=$(echo "${VERSION_CODENAME:-}" | tr '[:upper:]' '[:lower:]')
        DISTRO_VERSION="${VERSION_ID:-}"
    else
        echo "ERROR: Cannot detect OS. Run on a Debian/Ubuntu system." >&2
        exit 1
    fi

    # Architecture
    ARCH_RAW=$(uname -m)
    case "$ARCH_RAW" in
        x86_64)            ARCH="amd64" ;;
        aarch64|arm64)     ARCH="arm64" ;;
        armv7l|armhf)      ARCH="arm"   ;;
        i386|i686)         ARCH="386"   ;;
        *)                 ARCH="$ARCH_RAW" ;;
    esac

    # Normalise distro to debian/ubuntu for package channel
    case "$DISTRO_ID" in
        ubuntu)                   PKG_DISTRO="ubuntu" ;;
        debian|raspbian)          PKG_DISTRO="debian" ;;
        linuxmint|pop|elementary) PKG_DISTRO="ubuntu" ;;
        *)
            PKG_DISTRO="debian"
            echo "WARNING: Unknown distro '${DISTRO_ID}', defaulting to 'debian' package channel." \
                 "If installation fails, check https://pkgs.tailscale.com for your distro." >&2
            ;;
    esac
}

build_download_url() {
    # Direct stable .deb download (latest for the given distro/codename/arch)
    # e.g. https://pkgs.tailscale.com/stable/ubuntu/focal/pool/tailscale_latest_amd64.deb
    if [ -n "$DISTRO_CODENAME" ]; then
        DEB_URL="${TAILSCALE_BASE_URL}/${PKG_DISTRO}/${DISTRO_CODENAME}/pool/tailscale_latest_${ARCH}.deb"
    else
        # Fallback when codename cannot be detected (e.g. minimal containers).
        # This generic URL may not exist; prefer the distro-specific path when possible.
        DEB_URL="${TAILSCALE_BASE_URL}/tailscale_latest_${ARCH}.deb"
        echo "WARNING: OS codename could not be detected. Using generic fallback URL." \
             "If this fails, visit https://pkgs.tailscale.com to find the correct package." >&2
    fi
    DEB_FILENAME="tailscale_latest_${ARCH}.deb"
}

# ── MODE: info ────────────────────────────────────────────────

cmd_info() {
    print_banner
    detect_os_arch
    build_download_url

    echo "=== اطلاعات سیستم عامل / OS Information ==="
    echo ""
    echo "  Distro ID      : ${DISTRO_ID}"
    echo "  Version        : ${DISTRO_VERSION}"
    echo "  Codename       : ${DISTRO_CODENAME:-n/a}"
    echo "  Architecture   : ${ARCH_RAW}  →  deb arch: ${ARCH}"
    echo ""
    echo "=== آدرس دانلود پیشنهادی / Suggested Download URL ==="
    echo ""
    echo "  ${DEB_URL}"
    echo ""
    echo "لطفاً آدرس بالا را در یک سیستم دارای اینترنت باز کرده و فایل .deb را دانلود کنید."
    echo "Please open the URL above on a machine with internet access and download the .deb file."
    echo ""
}

# ── MODE: download ────────────────────────────────────────────

cmd_download() {
    print_banner
    echo ">>> این دستور را روی سیستم دارای اینترنت اجرا کنید <<<"
    echo ">>> Run this on a machine WITH internet access <<<"
    echo ""

    detect_os_arch
    build_download_url

    echo "Detected (or using default): arch=${ARCH}, distro=${PKG_DISTRO}, codename=${DISTRO_CODENAME:-generic}"
    echo ""

    # Allow override via argument: bash install-tailscale-offline.sh download <url>
    if [ -n "${2:-}" ]; then
        DEB_URL="$2"
        DEB_FILENAME=$(basename "$DEB_URL")
    fi

    echo "Downloading: ${DEB_URL}"
    echo ""

    if command -v curl &>/dev/null; then
        curl -L --progress-bar -o "${DEB_FILENAME}" "${DEB_URL}"
    elif command -v wget &>/dev/null; then
        wget -O "${DEB_FILENAME}" "${DEB_URL}"
    else
        echo "ERROR: Neither curl nor wget found. Install one of them first." >&2
        exit 1
    fi

    echo ""
    echo "✔ Downloaded: $(pwd)/${DEB_FILENAME}"
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  مرحله بعد / Next step:"
    echo ""
    echo "  فایل را با scp به سرور منتقل کنید:"
    echo "  Transfer the file to your server with scp:"
    echo ""
    echo "    scp ${DEB_FILENAME} root@<SERVER_IP>:/tmp/"
    echo ""
    echo "  سپس روی سرور اجرا کنید / Then on the server run:"
    echo ""
    echo "    bash install-tailscale-offline.sh install /tmp/${DEB_FILENAME}"
    echo "══════════════════════════════════════════════════════"
    echo ""
}

# ── MODE: install ─────────────────────────────────────────────

cmd_install() {
    print_banner
    echo ">>> نصب آفلاین Tailscale روی سرور / Offline install on server <<<"
    echo ""

    DEB_PATH="${2:-}"

    # If no path given, look for a .deb in current dir
    if [ -z "$DEB_PATH" ]; then
        DEB_PATH=$(ls tailscale*.deb 2>/dev/null | head -n1 || true)
    fi

    if [ -z "$DEB_PATH" ] || [ ! -f "$DEB_PATH" ]; then
        echo "ERROR: .deb file not found."
        echo ""
        echo "Usage:"
        echo "  bash install-tailscale-offline.sh install /path/to/tailscale_latest_amd64.deb"
        echo ""
        echo "اگر فایل را هنوز ندارید، مراحل زیر را دنبال کنید:"
        echo "1. روی یک سیستم دارای اینترنت:"
        echo "   bash install-tailscale-offline.sh download"
        echo "2. انتقال فایل به سرور:"
        echo "   scp tailscale_latest_amd64.deb root@<SERVER_IP>:/tmp/"
        echo "3. روی سرور:"
        echo "   bash install-tailscale-offline.sh install /tmp/tailscale_latest_amd64.deb"
        exit 1
    fi

    echo "Installing from: ${DEB_PATH}"
    echo ""

    # Install .deb (use apt if available to handle deps, fallback to dpkg)
    if command -v apt-get &>/dev/null; then
        echo "Attempting to fix any pre-existing broken dependencies..."
        apt-get install -y --fix-broken || echo "Note: fix-broken step had warnings (continuing)."
        dpkg -i "${DEB_PATH}" || {
            echo "dpkg reported errors; running apt-get -f to resolve dependencies..."
            apt-get install -y -f
        }
    else
        dpkg -i "${DEB_PATH}"
    fi

    echo ""
    echo "✔ Tailscale installed successfully."
    echo ""

    # Enable and start the service
    if command -v systemctl &>/dev/null; then
        systemctl enable --now tailscaled 2>/dev/null || true
        echo "✔ tailscaled service enabled and started."
    fi

    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  مرحله آخر / Final step:"
    echo ""
    echo "  برای اتصال به شبکه Tailscale:"
    echo "  To connect to your Tailscale network:"
    echo ""
    echo "    sudo tailscale up"
    echo ""
    echo "  برای استفاده به عنوان Exit Node (اختیاری):"
    echo "  To use as an exit-node (optional):"
    echo ""
    echo "    sudo tailscale up --advertise-exit-node"
    echo ""
    echo "  برای اتصال از طریق Exit Node دیگر:"
    echo "  To route traffic through another exit-node:"
    echo ""
    echo "    sudo tailscale up --exit-node=<NODE_IP_OR_NAME>"
    echo "══════════════════════════════════════════════════════"
    echo ""
}

# ── entrypoint ────────────────────────────────────────────────

MODE="${1:-help}"

case "$MODE" in
    info)     cmd_info ;;
    download) cmd_download "$@" ;;
    install)  cmd_install "$@" ;;
    *)
        print_banner
        echo "نحوه استفاده / Usage:"
        echo ""
        echo "  bash install-tailscale-offline.sh info"
        echo "      نمایش نسخه و معماری سیستم و آدرس دانلود مناسب"
        echo "      Show OS/arch info and the matching download URL"
        echo ""
        echo "  bash install-tailscale-offline.sh download"
        echo "      دانلود بسته .deb (روی سیستم دارای اینترنت)"
        echo "      Download the .deb package (run on machine WITH internet)"
        echo ""
        echo "  bash install-tailscale-offline.sh install [/path/to/tailscale.deb]"
        echo "      نصب آفلاین روی سرور"
        echo "      Install offline on the server"
        echo ""
        ;;
esac
