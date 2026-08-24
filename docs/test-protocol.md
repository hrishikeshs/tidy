# Simulator test protocol

This protocol targets Xcode 16.1 and the iOS 18.1 iPhone 16 Pro simulator used
for the 2026-08-23 evidence run.

## 1. Automated gate

```sh
npm run check
npm run build:simulator
```

`build:simulator` synchronizes the canonical `web-extension/` tree into the
generated Xcode project, then builds scheme `Janitor Lab` with code signing
disabled.

## 2. Start the controlled origins

```sh
npm run fixture
```

- First party: `http://127.0.0.1:8765`
- Synthetic tracker: `http://127.0.0.1:8766`
- Tracker counter: `http://127.0.0.1:8766/status`

The tracker server counter is evidence for a request, independent of whether
Safari renders the one-pixel response.

## 3. DNR A/B

Install the containing app on a booted iPhone simulator, then run:

```sh
npm run test:dnr
```

The harness resets the tracker counter and compares extension-disabled and
extension-enabled legs. It reboots the simulator for each leg because extension
enablement did not take effect reliably in the running Safari process. It also
launches the containing app before the enabled leg.

Expected output:

```text
DNR A/B passed: disabled=1 request, enabled=0 additional requests.
```

## 4. Permission separation

1. Open `http://127.0.0.1:8765` in simulator Safari.
2. Open Page Menu → Janitor Lab with no host permission.
3. Confirm the popup says page contents are inaccessible while the fixture
   shield remains enabled.
4. Choose **Grant access to this site**.
5. Record that Safari's prompt names `127.0.0.1`, not all websites, and exposes
   the one-day/always choices.

## 5. Inspection and cleanup

1. Inspect and compare names with the fixture page. Never capture values.
2. Record the Cookies API count separately from any explicitly labelled
   script-visible fallback. Do not infer HttpOnly coverage from `document.cookie`.
3. Choose **Clean tracker fixture** and verify tracker-named state disappears
   while functional state survives the automatic re-scan.
4. Choose **Forget accessible site data…**, verify the explicit confirmation
   panel, and remove the remaining accessible state.
5. Confirm the result distinguishes attempted, removed, inaccessible, and
   failed work, and that all reported categories re-scan empty.

## 6. Automated UI path

With the fixture running, the extension installed and enabled, and Safari open
on the seeded fixture:

```sh
xcodebuild test \
  -project "native/Janitor Lab/Janitor Lab.xcodeproj" \
  -scheme "Janitor Lab" \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.1' \
  -only-testing:'Janitor LabUITests/Janitor_LabUITests/testPhaseZeroPermissionInspectionAndSelectiveCleanup'
```

The test covers the host permission branch, paired inventory, selective cleanup
with survivor assertions, explicit full-clean confirmation, and empty re-scan.

## 7. Physical-device gates

Before making product claims, repeat on the current shipping Safari and a named
physical device:

- Cookies API enumeration and deletion, especially HttpOnly cookies
- `pagehide`, background suspension, memory pressure, locking, and force-quit
- Safari Profiles and Private Browsing isolation
- current manifest/converter warnings and App Review behavior

Simulator evidence is not promoted to device-verified evidence.
