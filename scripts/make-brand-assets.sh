#!/usr/bin/env bash
# Regenerates every web asset from the source artwork.
#
#   1. Edit public/logo-original.png  (your logo / icon artwork)
#   2. Run:  bash scripts/make-brand-assets.sh
#   3. Rebuild:  npm run build
#
# Requires: ImageMagick 6+ (convert), Python 3 with Pillow.
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE="public/logo-original.png"
OUT=/tmp/opencode/brand
mkdir -p "$OUT" public

# Tight, square master: trim wide margins, contain on white, 1200x1200.
convert "$SOURCE" -fuzz 5% -trim +repage -resize '1200x1200' \
  -background white -gravity center -extent 1200x1200 "$OUT/base.png"

# Modern favicon + apple touch icon (Next metadata file conventions).
convert "$OUT/base.png" -resize 256x256 src/app/icon.png
convert "$OUT/base.png" -resize 176x183 -background white -gravity center \
  -extent 180x180 src/app/apple-icon.png

# Classic multi-size favicon.ico (16/32/48 embedded).
python3 - "$OUT/base.png" <<'PY'
import sys
from PIL import Image

base = Image.open(sys.argv[1]).resize((64, 64), Image.LANCZOS)
base.save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
PY

# Social share card 1200x630 with the art centered.
convert "$SOURCE" -resize 'x630' -background white -gravity center \
  -extent 1200x630 src/app/opengraph-image.png

# Small header badge.
convert "$OUT/base.png" -resize 128x128 public/logo.png

echo "done:"
identify -format '  %f %wx%h\n' \
  src/app/icon.png src/app/apple-icon.png src/app/opengraph-image.png \
  public/logo.png src/app/favicon.ico
