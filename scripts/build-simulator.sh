#!/bin/zsh
set -euo pipefail

project_root="${0:A:h:h}"

"$project_root/scripts/sync-web-extension.sh"

xcodebuild \
  -project "$project_root/native/Janitor Lab/Janitor Lab.xcodeproj" \
  -scheme "Janitor Lab" \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$project_root/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  build
