#!/bin/zsh
set -euo pipefail

device="${1:-booted}"
extension_bundle_id="io.hrishi.Janitor-Lab.Extension"
containing_bundle_id="io.hrishi.Janitor-Lab"
fixture_url="http://127.0.0.1:8765"
tracker_status_url="http://127.0.0.1:8766/status"
tracker_reset_url="http://127.0.0.1:8766/reset"
run_nonce="$(date +%s)"

if [[ "$device" == "booted" ]]; then
  device="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/ { print $2; exit }')"
  if [[ -z "$device" ]]; then
    print -u2 "No booted iPhone simulator was found."
    exit 1
  fi
fi

reboot_simulator() {
  xcrun simctl shutdown "$device"
  xcrun simctl boot "$device"
  xcrun simctl bootstatus "$device" -b >/dev/null
}

tracker_state="$(curl -fsS "$tracker_status_url")" || {
  print -u2 "Fixture server is not running. Start it with: npm run fixture"
  exit 1
}

curl -fsS -X POST "$tracker_reset_url" >/dev/null
reboot_simulator
xcrun simctl spawn "$device" pluginkit -e ignore -i "$extension_bundle_id"
xcrun simctl openurl "$device" "$fixture_url/?dnr=disabled-$run_nonce"

for attempt in {1..20}; do
  tracker_state="$(curl -fsS "$tracker_status_url")"
  [[ "$tracker_state" == '{"trackerRequests":1}' ]] && break
  sleep 0.25
done

if [[ "$tracker_state" != '{"trackerRequests":1}' ]]; then
  print -u2 "Expected one tracker request with the extension disabled; observed $tracker_state"
  exit 1
fi

reboot_simulator
xcrun simctl spawn "$device" pluginkit -e use -i "$extension_bundle_id"
xcrun simctl launch "$device" "$containing_bundle_id" >/dev/null
sleep 0.25
xcrun simctl openurl "$device" "$fixture_url/?dnr=enabled-$run_nonce"

for attempt in {1..8}; do
  sleep 0.25
  tracker_state="$(curl -fsS "$tracker_status_url")"
  if [[ "$tracker_state" != '{"trackerRequests":1}' ]]; then
    print -u2 "Tracker counter changed with the extension enabled: $tracker_state"
    exit 1
  fi
done

print "DNR A/B passed: disabled=1 request, enabled=0 additional requests."
