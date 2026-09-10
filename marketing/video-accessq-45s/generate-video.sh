#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
video_dir="$project_dir/marketing/video-accessq-45s"
public_dir="$project_dir/frontendAccessQ/public"
font_regular="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
font_bold="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ffmpeg -y \
  -f lavfi -i "color=c=0x061522:s=1920x1080:r=24:d=45" \
  -loop 1 -framerate 24 -t 45 -i "$public_dir/accessq-concert.webp" \
  -loop 1 -framerate 24 -t 45 -i "$public_dir/marketing/accessq-affiche-anti-doublon-02.png" \
  -loop 1 -framerate 24 -t 45 -i "$public_dir/accessq-mobile-showcase-3.webp" \
  -loop 1 -framerate 24 -t 45 -i "$public_dir/accessq-conference.webp" \
  -loop 1 -framerate 24 -t 45 -i "$public_dir/accessq-supports-qr-hd.png" \
  -loop 1 -framerate 24 -t 45 -i "$public_dir/logo/access_logo.png" \
  -f lavfi -t 45 -i "sine=frequency=110:sample_rate=48000" \
  -f lavfi -t 45 -i "sine=frequency=164.81:sample_rate=48000" \
  -f lavfi -t 45 -i "sine=frequency=220:sample_rate=48000" \
  -filter_complex_script "$video_dir/video-filter.txt" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -movflags +faststart -shortest \
  "$video_dir/accessq-publicite-45s-1080p.mp4"

printf '%s\n' "$video_dir/accessq-publicite-45s-1080p.mp4"
