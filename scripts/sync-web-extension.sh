#!/bin/zsh
set -euo pipefail

project_root="${0:A:h:h}"
source_root="$project_root/web-extension"
native_resources="$project_root/native/Janitor Lab/Janitor Lab Extension/Resources"

if [[ ! -d "$native_resources" ]]; then
  print -u2 "The generated Xcode extension resources were not found. Run ./scripts/package-ios.sh first."
  exit 1
fi

rsync -a --delete "$source_root/" "$native_resources/"
print "Synced web-extension/ into the Xcode extension resources."
