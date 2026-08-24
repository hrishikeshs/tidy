# Simulator test protocol

This protocol targets Xcode 16.1 and the iOS 18.1 iPhone 16 Pro simulator used
for the 2026-08-23/24 evidence run.

## 1. Automated and build gates

```sh
npm run check
npm run build:simulator
```

`check` runs the JavaScript model/classifier tests, syntax checks every extension script, and
validates the manifest and referenced resources. `build:simulator` synchronizes
the canonical `web-extension/` tree into the Xcode project before building.

## 2. Start the controlled origins

```sh
npm run fixture
```

- First party: `http://127.0.0.1:8765`
- First-party readiness: `http://127.0.0.1:8765/status`
- Synthetic tracker: `http://127.0.0.1:8766`
- Tracker counter: `http://127.0.0.1:8766/status`

Both servers send `Cache-Control: no-store`. Their independent counters prevent
a slow Safari first launch from being mistaken for a blocked request.

## 3. Onboard Tidy

1. Install and launch the containing app.
2. In Safari, open Page Menu → Manage Extensions and enable Tidy.
3. Open Tidy on `http://127.0.0.1:8765`.
4. Choose Safari's permanent access for every website.
5. Confirm the popup says all-sites access is granted, then inspect once.

## 4. Dashboard cleanup

1. Open the dashboard from the popup.
2. Confirm the catalog shows the paired fixture counts: 2 local, 2 session,
   2 IndexedDB, 2 caches, and 1 service worker.
3. Run the global cookie probe and retain its exact result. Zero is not treated
   as proof that Safari's cookie jar is empty.
4. Select the fixture origin and choose **Forget selected…**.
5. Confirm the disclosure that Tidy briefly opens the origin.
6. Remove accessible data and verify Tidy returns, reports 9 storage objects
   plus the accessible cookie count, reports zero failures, and re-scans all
   displayed categories to zero.

## 5. Automated UI paths

Run the destructive paths separately so each receives a newly seeded simulator
clone:

```sh
xcodebuild test \
  -project "native/Janitor Lab/Janitor Lab.xcodeproj" \
  -scheme "Janitor Lab" \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.1' \
  -only-testing:'Janitor LabUITests/Janitor_LabUITests/testDashboardCatalogCookieProbeAndBulkCleanup'

xcodebuild test \
  -project "native/Janitor Lab/Janitor Lab.xcodeproj" \
  -scheme "Janitor Lab" \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.1' \
  -only-testing:'Janitor LabUITests/Janitor_LabUITests/testPhaseZeroPermissionInspectionAndSelectiveCleanup'
```

The first test covers install/enable, Safari permission UI, catalog inventory,
global cookie probing, transient-tab cleanup, return to dashboard, and zeroed
re-scan. The second preserves regression coverage for conservative selective
cleanup and functional-state survivors.

## 6. Learning Clean

Open `http://127.0.0.1:8765/learning?tidy_seed=1` in the Tidy Learning
Clean profile, confirm **All required state present**, capture the baseline, and
run the learner. The expected result is:

- required: `tidy_required_auth`, `tidy_required_local`,
  `tidy_required_session`
- removable: `tidy_optional_cookie`, `tidy_optional_local`,
  `tidy_optional_session`

The fixture values are intentionally read and copied into isolated local trial
stores. The saved policy and test attachments contain names/outcomes but no
values.

Run the full app-to-Safari path:

```sh
xcodebuild test \
  -project "native/Janitor Lab/Janitor Lab.xcodeproj" \
  -scheme "Janitor Lab" \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.1' \
  -only-testing:'Janitor LabTests' \
  -only-testing:'Janitor LabUITests/Janitor_LabUITests/testLearningCleanFindsMinimalFixtureState'
```

The UI test learns 3 required / 3 removable items, navigates Safari to a newly
seeded copy, obtains the policy through native messaging, removes exactly 2 Web
Storage items and 1 script-visible cookie, and verifies no learned removable
items remain. Each trial makes ordinary network requests to the fixture, just
as a real run necessarily contacts its target site.

## 7. DNR diagnostic

`npm run test:dnr` is now a diagnostic, not a release gate. The strengthened
harness proves both Safari navigations completed. On iOS 18.1, toggling the
extension with `pluginkit` also loses or bypasses the website-access state the
rule needs, so a request in the enabled leg must not be interpreted as a broken
dashboard. A production blocker needs a separate post-consent test and a real,
maintained ruleset.

## 8. Physical-device gates

Before product claims, repeat on the current shipping Safari and a named
physical device:

- Cookies API enumeration/deletion, especially HttpOnly cookies
- multi-origin bulk cleanup and temporary-tab behavior
- `pagehide`, suspension, memory pressure, locking, and force-quit
- Safari Profiles and Private Browsing isolation
- current converter warnings and App Review behavior
- Learning Clean named-store persistence, app-group signing, and the health
  oracle under real network/lifecycle conditions

Simulator evidence is never promoted to device-verified evidence.
