#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
METADATA_FILE="${PROJECT_DIR}/metadata.json"

read_metadata() {
    local field="$1"
    node -p "require('${METADATA_FILE}').${field}"
}

extension_uuid() {
    read_metadata "uuid"
}

extension_version() {
    read_metadata "version"
}
