# UX redesign validation

Validated on the iOS 18.1 iPhone 16 Pro simulator on 2026-08-24.

- [`home.png`](home.png) captures the installed containing app's redesigned
  setup screen.
- `npm run check` passed all 14 JavaScript model/privacy tests, syntax checks,
  manifest validation, and resource validation.
- `npm run build:simulator` completed with `BUILD SUCCEEDED`.
- `testPhaseZeroPermissionInspectionAndSelectiveCleanup` passed in Safari in
  44.8 seconds. It covered automatic inspection, the progressive Site data
  disclosure, exact classifier decisions, five-item conservative cleanup,
  functional/unknown survivors, full site reset, cleanup receipts, and a
  zeroed re-scan.
- `testDashboardClearAllSavedWebsiteData` passed in Safari in 40.9 seconds. It
  covered the redesigned catalog, cookie-jar disclosure, destructive warning,
  transient-tab cleanup, return to the dashboard, and zeroed displayed fixture
  categories. The accumulated local catalog run cleaned 3/3 sites, removed 34
  storage items and 35 cookies, and reported zero site or item failures.

Xcode emitted a ResultKit `mkstemp` warning while saving each `.xcresult` after
the tests had passed. The test runner output and `xcodebuild` result both
reported `TEST SUCCEEDED`; only the exported attachment bundle was affected.
