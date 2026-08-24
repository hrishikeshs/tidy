#!/bin/zsh
set -euo pipefail

project_root="${0:A:h:h}"
native_root="$project_root/native"

if find "$native_root" -name '*.xcodeproj' -print -quit 2>/dev/null | grep -q .; then
  print -u2 "An Xcode project already exists under $native_root. Remove it deliberately before regenerating."
  exit 1
fi

mkdir -p "$native_root"

xcrun safari-web-extension-converter \
  --project-location "$native_root" \
  --app-name "Janitor Lab" \
  --bundle-identifier "io.hrishi.janitorlab" \
  --swift \
  --ios-only \
  --copy-resources \
  --no-open \
  --no-prompt \
  "$project_root/web-extension"
