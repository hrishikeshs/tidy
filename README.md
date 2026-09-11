# Tidy

Tidy is an open-source, local Safari maintenance dashboard for iPhone. It keeps
a small catalog of site-data counts on the device and lets you clean selected
origins from one place.

This repository contains the first working version and the controlled Safari
lab used to establish its boundaries. The current build is validated against
Xcode 16.1 and the iOS 18.1 simulator.

## What works

- Tidy requests access to all HTTP(S) websites through Safari's native consent
  flow.
- Content scripts observe visited origins and record counts for cookies,
  `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, and service
  workers.
- Cookie and storage names inspected on demand receive a purpose, confidence,
  rationale, and keep/remove decision from an offline 2,261-rule classifier.
- Learning Clean opens a dedicated Tidy browser profile, captures cookie and Web
  Storage values into memory, and delta-debugs fresh isolated trials to find a
  1-minimal state set for the page's health oracle.
- Learned names are shared with the Safari extension through an app group. For
  14 days, the site workspace can remove only previously proven-removable names that are
  still present while leaving new or untested state alone.
- Opening Tidy from Safari opens a full-page site workspace, automatically checks the current website, and leads
  with one low-risk recommendation. Detailed names and classifications remain
  available behind the Site data inspector, and every cleanup offers to reload
  the page so stale banners or pop-ups can disappear immediately.
- The dashboard shows the local catalog, open-origin state, aggregate counts,
  cleanup history, and a global Safari Cookies API probe.
- Per-site and bulk cleanup briefly open each selected origin, remove accessible
  site data, close the temporary tab, and return to the dashboard.
- **Clear all saved website data** does the same for every observed origin,
  continues past individual site failures, and then removes every cookie
  Safari exposes globally. It warns that the user will probably be signed out
  and reports site, item, and cookie-sweep outcomes separately.
- **Clean tracking** removes only evidence-backed tracking state and keeps
  sign-in, security, preference, and uncertain data. **Reset this site** is the
  explicit escape hatch for a stuck page or persistent pop-up; it removes all
  reachable site state after warning that sign-in and preferences may be lost.
- The containing app is free and fully unlocked. Its optional StoreKit tip jar
  offers three repeatable, one-time consumable tips; purchases unlock nothing,
  and Tidy never receives payment details.

The simulator UI test removed 9 storage objects and 3 script-visible cookies,
returned to Tidy, and re-scanned every displayed category to zero.
The clear-all test then exercised an accumulated two-origin catalog (Reddit and
the controlled fixture), removed 9 storage objects and 9 site cookies, and
reported zero site or item failures.

## Local-data model

The dashboard database is `browser.storage.local`, owned by the extension. It
stores origins, hostnames, timestamps, category counts, inaccessible-category
flags, and cleanup outcomes. It deliberately does not store cookie names,
storage keys, URL paths, values, or detailed error text. Unit tests enforce
that boundary.

Classification is also entirely local. Tidy combines the Apache-2.0 Open
Cookie Database with conservative safety and name heuristics. Only high- or
medium-confidence analytics/marketing matches backed by the public database or
the controlled fixture are eligible for automatic cleanup. A suggestive name
alone is labeled for review and kept. See [classifier design](docs/classifier.md).

Tidy does not have analytics, an account, a server, or a developer-operated
network client. Cleaning a site necessarily loads that site in a short-lived
Safari tab; the confirmation UI says so before doing it. Optional tips use
Apple's StoreKit purchase flow.

The clear-all action retains Tidy's value-free catalog as local cleanup history.
It does not clear Safari history or saved passwords, and it cannot remove data
that Safari keeps inaccessible to extensions. Those boundaries are stated next
to the action and repeated in its cleanup receipt.

Learning Clean is the explicitly value-aware path. The native app reads cookie
values (including HttpOnly cookies visible to its own `WKHTTPCookieStore`) and
`localStorage`/`sessionStorage` values, then copies them only into in-memory
snapshots and non-persistent WebKit trial stores. The reusable policy contains
origin, route, state-name fingerprint, required/removable names, timestamps,
and trial count—never values—and is shared locally with the extension. The
dedicated Tidy Lab profile itself persists the website's state on device like a
normal browser profile. See [Learning Clean](docs/learning-clean.md).

## Honest boundaries

- Safari does not expose a `browsingData`-style API here. Tidy cleans web
  platform storage from a page context and uses Safari's Cookies API where it
  is available.
- On the tested iOS 18.1 simulator, the Cookies API returned zero even while
  the controlled server proved cookies existed. Script-visible cookies are
  handled with `document.cookie`; the Safari extension still does not claim
  HttpOnly coverage. The native Learning Clean profile has a separate,
  validated WebKit cookie-store path, but it is not Safari's cookie jar.
- Learning Clean does not safely clone an ordinary Safari tab. Trials run in
  fresh non-persistent WebKit stores seeded from Tidy's separate profile.
  Policies transfer names and outcomes to Safari, not session values.
- The algorithm returns one 1-minimal passing set relative to the observed
  page-health oracle. It cannot prove a unique or globally smallest “exact” set,
  and a weak oracle can miss broken behavior.
- The initial learner covers cookies, `localStorage`, and `sessionStorage`.
  IndexedDB, Cache Storage, and service workers remain future learner work.
- Inactive Safari tabs did not reliably accept script injection or return
  message results. Tidy's temporary active-tab workflow is the validated
  workaround.
- A synthetic declarative-network-request rule was used only to probe Safari's
  boundary. It is intentionally absent from the production extension; the
  historical result remains in the capability matrix.
- Profiles, Private Browsing, force-quit, memory pressure, locking, and physical
  device lifecycle behavior remain device gates.

Chrome on iOS is not a better host today: Chrome documents mobile “Add to
Desktop,” but does not provide an installable iOS extension runtime equivalent
to Safari Web Extensions. A separate iOS app also cannot reach Chrome's site
database across the app sandbox. iOS 26 URL Filters are worth a future branch
for system-wide request filtering, but they cannot enumerate or delete browser
storage.

## Repository layout

```text
web-extension/   Canonical Manifest V3 extension source
native/          Xcode container and simulator UI tests
fixtures/        Local first-party and synthetic tracker servers
docs/            Capability ledger, protocol, and dated evidence
tests/           Pure JavaScript privacy/model tests
```

`web-extension/` is the source of truth. Native target names keep their original
`Janitor Lab` labels to avoid unnecessary Xcode-project churn; production bundle
identifiers are `io.hrishi.tidy` and `io.hrishi.tidy.extension`, while the
installed app and extension display as Tidy.

## Quick start

```sh
npm run check
npm run fixture
npm run build:simulator
```

Then install the built app, enable Tidy in Safari, choose access for every
website, and visit `http://127.0.0.1:8765` before opening the dashboard.
Physical-device forks must register or substitute the app-group identifier
`group.io.hrishi.tidy` for both the app and extension signing targets.

See the [simulator protocol](docs/test-protocol.md), [capability
matrix](docs/capability-matrix.md), [initial dashboard evidence](docs/evidence/2026-08-23/README.md),
[classifier evidence](docs/evidence/2026-08-24/classifier-observations.md),
[Learning Clean evidence](docs/evidence/2026-08-24/learning-clean-observations.md),
[clear-all evidence](docs/evidence/2026-08-24/clear-all-observations.md), and the
[App Store release metadata](app-store/metadata.json).

## Platform references

- [Safari Web Extensions](https://developer.apple.com/safari/extensions/)
- [Managing Safari Web Extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)
- [Messaging between a Safari Web Extension and its containing app](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension)
- [`WKWebsiteDataStore`](https://developer.apple.com/documentation/webkit/wkwebsitedatastore)
- [`WKHTTPCookieStore`](https://developer.apple.com/documentation/webkit/wkhttpcookiestore)
- [Chrome extension installation](https://support.google.com/chrome/answer/2664769)
- [Apple URL Filters](https://developer.apple.com/documentation/networkextension/url-filters)
