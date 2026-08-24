# Learning Clean observations — 2026-08-24

## Environment

- Xcode 16.1 (16B40)
- iOS 18.1 simulator
- iPhone 16 Pro (`CA8F7500-CB1B-4DD2-A944-238AC3CD4544`)
- Tidy 0.4.0
- Controlled origin: `http://127.0.0.1:8765/learning`

## Fixture and oracle

The seeded page contained six value-bearing items:

- required: HttpOnly cookie `tidy_required_auth`, localStorage
  `tidy_required_local`, sessionStorage `tidy_required_session`
- optional: cookie `tidy_optional_cookie`, localStorage
  `tidy_optional_local`, sessionStorage `tidy_optional_session`

The explicit `window.__tidyHealth` oracle passed only when the three required
values were reconstructed correctly. The server endpoint independently checked
the HttpOnly cookie.

## Results

- Native model tests: 5 passed.
- JavaScript/model/manifest suite: 13 passed.
- Generic simulator build: passed.
- Final learning run: 15 trials, 3 required, 3 removable. Trial 1 reconstructs
  the full captured state before any removal candidate is accepted.
- The baseline used a named app-owned WebKit store; every candidate used a new
  non-persistent store.
- The saved policy's encoding test proved fixture values were absent.
- The app-group/native-messaging bridge returned the policy to Safari for the
  exact origin and route.
- Safari learned cleanup removed 2 Web Storage items and 1 script-visible
  cookie with 0 failures. The next inspection reported 0 matching learned
  removable items; required local/session state remained present.

The first bridge-test attempt failed only because XCTest found Safari's Go key
outside the visible accessibility frame. Submitting the address field directly
fixed the automation. The product path did not change.

## Retained artifacts

- Passing result bundle: `DerivedData/TidyLearningFinal.xcresult` (local,
  ignored build output)
- App learner screenshot and post-cleanup Safari screenshot:
  [`learning-clean-ui-test-final`](learning-clean-ui-test-final/manifest.json)

These artifacts contain fixture names and counts, not snapshot values. They are
simulator-provisional evidence, not a physical-device or arbitrary-site claim.
