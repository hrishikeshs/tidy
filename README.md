# Janitor Lab

Phase 0 feasibility repository for an open-source Safari privacy inspector and
selective cleanup tool.

This is deliberately a laboratory, not a product. Its job is to replace
assumptions about Safari with versioned, reproducible evidence.

## What the first build demonstrates

- A declarative rule blocks the controlled tracker fixture without page
  inspection permission.
- The popup requests access to only the current site.
- With permission, the extension inventories accessible origin storage without
  displaying or persisting stored values.
- Script-visible cookie names have an explicitly labelled fallback when
  Safari's Cookies API exposes nothing; HttpOnly coverage is not claimed.
- Selective and full cleanup report what happened and scan again instead of
  assuming success.

The result is a simulator proof against Xcode 16.1 and iOS 18.1. Device-only
lifecycle behavior, Profiles, Private Browsing, HttpOnly cookie access, and the
newer Safari 26-era environment remain gates. See the
[capability matrix](docs/capability-matrix.md) for the exact boundary.

## Repository layout

```text
web-extension/   Canonical Manifest V3 extension source
native/          Generated Xcode container plus UI tests
fixtures/        Local first-party and synthetic tracker servers
docs/            Capability ledger, protocol, and dated evidence
tests/           Pure JavaScript tests
```

`web-extension/` is the source of truth. `npm run build:simulator` synchronizes
it into the checked-in Xcode resources before building. `package-ios.sh` is only
for deliberately regenerating the native scaffold and refuses to overwrite an
existing project.

## Quick start

```sh
npm run check
npm run fixture
npm run build:simulator
```

With an iPhone simulator booted and the built app installed, the DNR A/B test is:

```sh
npm run test:dnr
```

Then visit `http://127.0.0.1:8765` in simulator Safari. The page seeds
functional and tracker-like storage using names owned by this repository. The
distinct origin `http://127.0.0.1:8766` acts as the controlled tracker.

No real tracker list or production website is involved in Phase 0.

## Evidence standard

Simulator results are useful but provisional for behaviors affected by process
suspension, memory pressure, device locking, or platform-version differences.
Every conclusion records the Xcode, Safari/iOS, environment, fixture, and
observed result. No captured evidence contains cookie or storage values.
