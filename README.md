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
- The dashboard shows the local catalog, open-origin state, aggregate counts,
  cleanup history, and a global Safari Cookies API probe.
- Per-site and bulk cleanup briefly open each selected origin, remove accessible
  site data, close the temporary tab, and return to the dashboard.
- The popup retains the controlled selective-cleanup fixture for testing
  tracker-like state separately from functional state.

The simulator UI test removed 9 storage objects and 3 script-visible cookies,
returned to Tidy, and re-scanned every displayed category to zero.

## Local-data model

The initial database is `browser.storage.local`, owned by the extension. It
stores origins, hostnames, timestamps, category counts, inaccessible-category
flags, and cleanup outcomes. It deliberately does not store cookie names,
storage keys, URL paths, values, or detailed error text. Unit tests enforce
that boundary.

Classification is also entirely local. Tidy combines the Apache-2.0 Open
Cookie Database with conservative safety and name heuristics. Only high- or
medium-confidence analytics/marketing matches backed by the public database or
the controlled fixture are eligible for automatic cleanup. A suggestive name
alone is labeled for review and kept. See [classifier design](docs/classifier.md).

Tidy does not have analytics, an account, a server, or a network client of its
own. Cleaning a site necessarily loads that site in a short-lived Safari tab;
the confirmation UI says so before doing it.

## Honest boundaries

- Safari does not expose a `browsingData`-style API here. Tidy cleans web
  platform storage from a page context and uses Safari's Cookies API where it
  is available.
- On the tested iOS 18.1 simulator, the Cookies API returned zero even while
  the controlled server proved cookies existed. Script-visible cookies are
  handled with `document.cookie`; HttpOnly coverage is not claimed.
- Inactive Safari tabs did not reliably accept script injection or return
  message results. Tidy's temporary active-tab workflow is the validated
  workaround.
- The included declarative rule is only a synthetic fixture, not a production
  tracker list. The strengthened DNR harness shows Safari 18 couples its effect
  to website-access state; see the capability matrix.
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

`web-extension/` is the source of truth. The native target and bundle IDs keep
their original `Janitor Lab` names to avoid unnecessary Xcode-project churn;
the installed app and extension display as Tidy.

## Quick start

```sh
npm run check
npm run fixture
npm run build:simulator
```

Then install the built app, enable Tidy in Safari, choose access for every
website, and visit `http://127.0.0.1:8765` before opening the dashboard.

See the [simulator protocol](docs/test-protocol.md), [capability
matrix](docs/capability-matrix.md), [initial dashboard evidence](docs/evidence/2026-08-23/README.md),
and [classifier evidence](docs/evidence/2026-08-24/classifier-observations.md).

## Platform references

- [Safari Web Extensions](https://developer.apple.com/safari/extensions/)
- [Managing Safari Web Extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)
- [Chrome extension installation](https://support.google.com/chrome/answer/2664769)
- [Apple URL Filters](https://developer.apple.com/documentation/networkextension/url-filters)
