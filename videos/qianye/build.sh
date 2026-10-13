#!/usr/bin/env bash
# Rebuild 《前夜》 from source: fonts -> timeline -> score -> frames -> qianye.mp4
# Needs: node + playwright (Chromium), python3 + numpy + scipy, ffmpeg (libx264).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts
if [ ! -f fonts/NotoSerifSC-900.ttf ]; then
  curl -sS "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&family=Noto+Sans+SC:wght@300;400&family=JetBrains+Mono:wght@400" -o fonts/fonts.css
  grep -o "font-family: '[^']*'\|font-weight: [0-9]*\|url([^)]*)" fonts/fonts.css | paste - - - |
    while IFS=$'\t' read -r fam w url; do
      name=$(echo "$fam" | sed "s/font-family: '//;s/'//;s/ //g")-${w#font-weight: }.ttf
      curl -sS -o "fonts/$name" "$(echo "$url" | sed 's/url(//;s/)//')"
    done
fi
node render.mjs timeline timeline.json
python3 music.py timeline.json score.wav
node render.mjs full out "${WORKERS:-3}"
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -i score.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart qianye.mp4
echo "wrote $(pwd)/qianye.mp4"
