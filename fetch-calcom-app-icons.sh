#!/usr/bin/env bash
set -euo pipefail

SRC_ROOT="packages/app-store"
DEST_ROOT="apps/web/public/app-store"
BASE_URL="https://cal.com/app-store"

mkdir -p "$DEST_ROOT"

echo "📦 Fetching Cal.com app icons..."

for app_dir in "$SRC_ROOT"/*; do
  slug="$(basename "$app_dir")"

  # Skip non-app directories
  [[ "$slug" == "." || "$slug" == ".." ]] && continue

  dest_dir="$DEST_ROOT/$slug"
  dest_icon="$dest_dir/icon.svg"
  src_url="$BASE_URL/$slug/icon.svg"

  mkdir -p "$dest_dir"

  if curl -fsSL "$src_url" -o "$dest_icon"; then
    echo "✅ $slug"
  else
    rm -f "$dest_icon"
    rmdir "$dest_dir" 2>/dev/null || true
    echo "⚠️  $slug (no icon)"
  fi
done

echo "🎉 Done."
