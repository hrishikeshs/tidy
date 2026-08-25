# Capability matrix

This is an evidence ledger, not a roadmap checkbox list.

## Evidence levels

- **Automated:** repeatable unit, build, or harness result.
- **Simulator-provisional:** observed in an iOS simulator; not a claim about
  suspension, device locking, memory pressure, or physical hardware.
- **Device-verified:** reproduced on named physical hardware and OS.
- **Unverified:** no conclusive result yet.

## Toolchain under test

| Field | Value |
|---|---|
| Evidence run | 2026-08-23 through 2026-08-24 |
| Xcode | 16.1 (16B40) |
| Swift | 6.0.2 |
| SDK/runtime | iOS Simulator 18.1 |
| Simulator | iPhone 16 Pro, iOS 18.1 |
| Extension | Tidy 0.5.0, Manifest V3 |

Results from this Safari 18.1 environment must not be generalized to later
Safari releases.

## Results

| ID | Capability | Fixture / method | Result | Evidence level | Notes |
|---|---|---|---|---|---|
| A1 | Package extension in iOS app | `npm run build:simulator` | Passed | Automated | Generic iOS Simulator build completed. |
| A2 | Install, enable, and launch | XCTest plus Safari Manage Extensions | Passed | Simulator-provisional | The test handles a fresh disabled extension and Safari's first-run UI. |
| P1 | Maximum website access | Safari permanent-access branch | Passed | Automated UI test on simulator | Safari exposed its all-websites choice; the site workspace subsequently reported all-sites access. |
| T1 | Automatic origin observation | Timed content observer plus site-workspace inspection | Passed | Simulator-provisional | The fixture appeared in the dashboard without persisting item names or values. |
| T2 | Local catalog persistence | `browser.storage.local`, schema 2 | Passed | Automated | Five unit tests cover normalization, aggregation, cleanup history, cookie-domain counts, and data minimization. |
| T3 | Dashboard inventory | Paired storage fixture | Passed | Automated UI test on simulator | 2 local, 2 session, 2 IndexedDB, 2 caches, and 1 service worker were displayed. |
| T4 | Global Cookies API probe | `cookies.getAll({})` | Passed with limitation | Simulator-provisional | Safari exposed 0; UI explicitly says this does not prove the jar is empty. |
| T5 | Bulk full cleanup | Dashboard confirmation and temporary active tab | Passed | Automated UI test on simulator | Removed 9 storage objects and 3 script-visible cookies; failures 0; all displayed counts re-scanned to zero. |
| T6 | Cleanup of cataloged/dormant origins | Short-lived tab loaded from stored origin | Passed for controlled origin | Simulator-provisional | Workflow no longer depends on a previously open, scriptable tab. Multi-origin and physical-device runs remain. |
| T7 | Inactive-tab direct cleanup | `tabs.sendMessage` / `scripting.executeScript` | Failed | Simulator-provisional | Safari returned no cleanup result or “Tab not found.” This motivated T5's temporary-tab workflow. |
| T8 | Explainable purpose classification | 2,261 Open Cookie Database rules plus conservative local heuristics | Passed | Automated | Each item receives purpose, confidence, rationale, source, and a keep/remove decision; values are not inputs. |
| T9 | Removal safety policy | Evidence and confidence gate | Passed | Automated | Name-only heuristics never authorize deletion; mixed session/tracking signals fail to unknown/kept. |
| T10 | Learning Clean value capture | Six-item fixture in dedicated named WebKit profile | Passed | Automated UI test on simulator | Captured two cookies (including one HttpOnly), two localStorage values, and two sessionStorage values. Values remained in native memory/trial stores. |
| T11 | Per-trial state isolation | Fresh `WKWebsiteDataStore.nonPersistent()` per candidate | Passed | Automated UI test on simulator | The live named Tidy profile remained intact. A full-state reconstruction guard now runs before any removal candidate. |
| T12 | Delta-debugging result | Fixture requires exactly one cookie, one local item, and one session item | Passed | Automated + simulator-provisional | Found 3 required and 3 removable items; pure tests also prove a 1-minimal result for interacting sets. |
| T13 | Learned-policy minimization | Codable policy and encoding test | Passed | Automated | Policy contains origin/route, identity fingerprint, names/scopes, outcomes, dates, algorithm version, and trial count; snapshot values are absent. |
| T14 | Native policy bridge | App group + `nativeMessaging` + Safari site workspace | Passed | Automated UI test on simulator | Safari received the fresh 3/3 policy, removed 2 optional storage values plus 1 optional cookie, preserved required state, and then reported 0 matching removable items. |
| T15 | Learned-policy aging | 14-day expiry and algorithm-version filter | Implemented | Automated model coverage | Expired policies are pruned by the app and rejected by the native handler. Scheduled background refresh is not implemented. |
| T16 | Global clear-all workflow | Every cataloged origin followed by `cookies.getAll({})` removal sweep | Passed | Automated UI test on simulator | Across the accumulated Reddit + fixture catalog, the destructive dashboard action warned about sign-out, cleaned 2/2 sites, removed 9 fixture storage objects and 9 site cookies, found 0 additional globally exposed cookies, reported zero failures, and re-scanned displayed counts to zero. Safari history, passwords, and inaccessible internal data remain out of scope. |
| B1 | Enumerate `localStorage` names in site workspace | Paired fixture keys | Passed | Simulator-provisional | 2 names; values did not cross the boundary. |
| B2 | Enumerate `sessionStorage` names in site workspace | Paired fixture keys | Passed | Simulator-provisional | 2 names. |
| B3 | Enumerate IndexedDB names | `indexedDB.databases()` | Passed | Simulator-provisional | 2 names. |
| B4 | Enumerate Cache Storage names | Paired caches | Passed | Simulator-provisional | 2 names. |
| B5 | Enumerate service workers | Fixture registration | Passed | Simulator-provisional | 1 registration. |
| B6 | Selective storage cleanup | Synthetic tracker names | Passed | Automated UI test on simulator | Removed 4 tracker-named storage items while functional fixtures survived. |
| B7 | Full site-workspace cleanup | Explicit confirmation plus re-scan | Passed | Automated UI test on simulator | Removed the remaining 5 storage items; accessible categories re-scanned empty. |
| C1 | Script-visible cookie cleanup | `document.cookie` name-only fallback | Passed with limitation | Simulator-provisional | Dashboard run removed 3 accessible cookies without persisting names or values. |
| C2 | Enumerate HttpOnly cookies | Server-set fixture plus Cookies API | Inconclusive | Unverified | Server proved the HttpOnly cookie was sent, but the Cookies API returned 0. |
| C3 | Delete HttpOnly cookies | Server-set fixture | Not run | Unverified | Cannot claim until C2 yields an accessible cookie object. |
| C4 | Real-site Reddit sample | 12 script-visible names supplied by simulator run | Passed for classification | Simulator-provisional | `_gcl_au` and domain-matched `edgebucket` are removable marketing evidence; CSRF/session ambiguity remains protected. The generated classifier also passed the controlled site-workspace cleanup UI regression. |
| C5 | Native WebKit HttpOnly capture/seed | Learning Clean fixture + `WKHTTPCookieStore` | Passed for Tidy profile | Automated UI test on simulator | This validates the app-owned WebKit store only; it does not upgrade C2/C3 for Safari's cookie jar. |
| D1 | Synthetic DNR rule | Strengthened first-party-readiness A/B harness | Permission-coupled / reopened | Simulator-provisional | The earlier Phase 0 “pass” did not wait for the enabled navigation. With readiness proof added, toggling the extension allowed the request; Safari's website grant is reset/coupled in this flow. Do not claim permission-free blocking. |
| L1 | Timed observation | 750 ms and 2.5 s captures | Passed for foreground fixture | Simulator-provisional | Background and suspension behavior is not implied. |
| L2 | `pagehide` capture | Observer hook | Implemented, not isolated | Unverified | Needs a dedicated lifecycle fixture. |
| L3 | Suspension and force-quit | Physical-device lifecycle run | Not run | Unverified | Physical device required. |
| F1 | Safari Profiles isolation | Two profiles | Not run | Unverified | No claim. |
| F2 | Private Browsing behavior | Private tab | Not run | Unverified | No claim. |
| X1 | Chrome iOS extension host | Official Chrome extension docs/source review | Not available | Research-backed | Chrome iOS has no installable extension surface equivalent to Safari Web Extensions. |
| X2 | Cross-browser site-database access | iOS app sandbox and WebKit data-store review | Not available | Research-backed | A separate app can manage only its own WebKit data store, not Safari's or Chrome's. |
| X3 | iOS 26 URL Filter | NetworkExtension documentation | Future candidate | Unverified locally | Promising for system-wide request filtering; not a browser-storage deletion API. |

## Main finding

Safari supports a useful local super-dashboard when Tidy treats origins as a
catalog and performs cleanup in short-lived active tabs. It does not expose an
omnipotent browser-history/site-data deletion API, and the iOS 18.1 Cookies API
and inactive-tab behavior are materially weaker than the idealized design.

For state minimization, a dedicated Tidy WebKit profile is the workable safety
boundary. It can reconstruct value-bearing candidates in fresh ephemeral stores
and pass a names-only policy back to Safari. The result is 1-minimal relative to
the oracle—not a unique exact set—and currently excludes IndexedDB, caches, and
service workers.

The retained artifacts are under
[`docs/evidence/2026-08-23`](evidence/2026-08-23/README.md) and
[`docs/evidence/2026-08-24`](evidence/2026-08-24/learning-clean-observations.md).
