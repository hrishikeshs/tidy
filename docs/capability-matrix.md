# Capability matrix

This is an evidence ledger, not a roadmap checkbox list.

## Evidence levels

- **Automated:** repeatable unit, build, or harness result.
- **Simulator-provisional:** observed in an iOS simulator; useful but not a
  claim about suspension, device locking, memory pressure, or all hardware.
- **Device-verified:** reproduced on named physical hardware and OS.
- **Unverified:** no conclusive result yet.

## Toolchain under test

| Field | Value |
|---|---|
| Date | 2026-08-23 |
| Xcode | 16.1 (16B40) |
| Swift | 6.0.2 |
| SDK/runtime | iOS Simulator 18.1 |
| Simulator | iPhone 16 Pro, iOS 18.1 |
| Extension | Manifest V3, Janitor Lab 0.1.0 |

The product handoff cites Safari 26-era material. Results from this installed
Safari 18.1 toolchain must not be used to mark later APIs unsupported.

## Results

| ID | Capability | Fixture / method | Result | Evidence level | Notes |
|---|---|---|---|---|---|
| A1 | Package extension in iOS app | `npm run build:simulator` | Passed | Automated | Xcode build completed for a generic iOS Simulator destination. |
| A2 | Install and launch containing app | `simctl install` and `simctl launch` | Passed | Simulator-provisional | App and extension were available on iPhone 16 Pro. |
| D1 | DNR block without page access | `npm run test:dnr` cross-origin counter A/B | Passed | Automated simulator harness | Disabled: 1 request. Enabled: 0 additional requests. Extension state required a simulator reboot and containing-app launch. |
| B1 | Enumerate `localStorage` names | Paired fixture keys | Passed | Simulator-provisional | 2 names; values did not cross the extension boundary. |
| B2 | Enumerate `sessionStorage` names | Paired fixture keys | Passed | Simulator-provisional | 2 names. |
| B3 | Enumerate IndexedDB database names | Paired fixture databases | Passed | Simulator-provisional | 2 names through `indexedDB.databases()`. |
| B4 | Enumerate Cache Storage names | Paired fixture caches | Passed | Simulator-provisional | 2 names. |
| B5 | Enumerate service worker registrations | Fixture worker | Passed | Simulator-provisional | 1 registration. |
| B6 | Selective origin-storage cleanup | Synthetic tracker names | Passed | Automated UI test on simulator | Removed 4 tracker-named storage items and the script-visible tracker cookie; functional fixtures survived the re-scan. |
| B7 | Full accessible-origin cleanup | Explicit in-popup confirmation plus re-scan | Passed | Automated UI test on simulator | Removed the remaining 5 storage items and 2 script-visible cookies; all 6 accessible categories re-scanned empty. |
| C1 | Enumerate script-visible cookies | Content-script name-only fallback | Passed with limitation | Simulator-provisional | 2 names. Safari's Cookies API returned 0, so the UI labels the fallback and warns that HttpOnly cookies may be inaccessible. |
| C2 | Enumerate HttpOnly cookies | Server-set fixture plus Cookies API | Inconclusive | Unverified | Server proved the HttpOnly cookie was sent, but the Cookies API returned 0 cookies on this simulator. Retest on current Safari and a physical device. |
| C3 | Delete HttpOnly cookies | Server-set fixture | Not run | Unverified | Cannot test honestly until C2 yields an accessible cookie object. |
| P1 | Progressive current-host permission | Popup request on `127.0.0.1` | Passed | Simulator-provisional | Safari displayed a host-scoped prompt with one-day and always-allow choices; no blanket host permission is declared. |
| L1 | `pagehide` execution | Instrumented lifecycle fixture | Not implemented | Unverified | Later Phase 0 slice. |
| L2 | Safari suspension and force-quit behavior | Lifecycle fixture | Not implemented | Unverified | Physical device required for the final claim. |
| F1 | Safari Profiles isolation | Two profiles | Not run | Unverified | Simulator result would remain provisional. |
| F2 | Private Browsing behavior | Private tab | Not run | Unverified | Simulator result would remain provisional. |

## Main finding

The simulator validates the proposed DNR, progressive-permission, origin-storage
inspection, and re-scanned cleanup architecture. It does **not** validate the
spec's assumed HttpOnly cookie path: on iOS 18.1 simulator, the Cookies API
returned an empty result while the controlled page and server showed cookies
were present. This is a version-stamped device gate, not a general claim that
Safari lacks the capability.

The detailed run record and retained artifacts are under
[`docs/evidence/2026-08-23`](evidence/2026-08-23/README.md).
