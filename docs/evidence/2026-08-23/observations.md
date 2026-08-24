# Tidy simulator observations

## Environment

- Run: 2026-08-23 through 2026-08-24
- Xcode: 16.1 (16B40)
- Swift: 6.0.2
- Device: iPhone 16 Pro simulator
- Runtime and Safari: iOS 18.1
- Extension: Tidy 0.2.0, Manifest V3

These observations apply to this environment only.

## Dashboard result

The end-to-end test enabled Tidy through Safari's Manage Extensions UI, took
the permanent all-websites permission branch, inspected the controlled origin,
opened the dashboard, and observed:

| Category | Count before | Count after |
|---|---:|---:|
| Script-visible cookies | 3 | 0 |
| localStorage | 2 | 0 |
| sessionStorage | 2 | 0 |
| IndexedDB | 2 | 0 |
| Cache Storage | 2 | 0 |
| Service workers | 1 | 0 |

The global Cookies API probe returned zero and the UI retained the warning that
this does not prove the cookie jar is empty.

After explicit confirmation, Tidy created a short-lived active tab for the
origin, cleaned it, closed it, returned to the dashboard, and reported:

```text
Cleaned 1 site(s): removed 9 storage item(s) and 3 cookie(s). Failures: 0.
```

`testDashboardCatalogCookieProbeAndBulkCleanup` passed in 44.459 seconds in the
final retained run. The confirmation panel was hidden after completion and all
category pills re-scanned to zero.

Artifacts:

- [Dashboard full-clean screenshot](dashboard-ui-test-final/7E06B98C-FB7F-4744-8853-F4ED9374E838.png)
- [Dashboard accessibility hierarchy](dashboard-ui-test-final/42910F2B-EFF1-4CF2-9394-95E805750BB9.txt)
- [Attachment manifest](dashboard-ui-test-final/manifest.json)

## Safari boundary probes

### Inactive tabs

Direct cleanup of an already open but inactive fixture tab failed in two ways:

```text
Invalid call to scripting.executeScript(). Could not execute script on this tab.
Invalid call to scripting.executeScript(). Tab not found.
```

In another run `tabs.sendMessage` resolved without the cleaner's result. Briefly
activating the old tab did not make its identifier reliably scriptable. Creating
a fresh active tab from the cataloged origin did; that is the workflow in Tidy.

### Message responders

Safari returned the wrong empty response when both the inspector and observer
registered content-message listeners. Removing the observer's listener and
keeping one request/response owner made cleanup deterministic. Timed and
`pagehide` observation still run without a second message listener.

### Cookies

The controlled page/server proved cookies existed, including an HttpOnly
fixture, while `cookies.getAll` returned zero in this simulator. Tidy therefore
uses a name-only `document.cookie` fallback for accessible cookies and makes no
HttpOnly claim. No captured artifact contains cookie or storage values.

### Declarative rule correction

The original Phase 0 DNR harness waited for the disabled request but did not
prove the enabled page had loaded before declaring success. The revised fixture
adds a first-party navigation counter and waits up to 30 seconds for both legs.
With that correction, toggling the extension through `pluginkit` allowed the
tracker request in the enabled leg, consistent with Safari coupling the rule to
website-access state. The old permission-free-blocking claim is withdrawn.

## Popup regression

`testPhaseZeroPermissionInspectionAndSelectiveCleanup` passed in 45.522 seconds.
It still verifies tracker-named local/session/IndexedDB/cache cleanup while the
paired functional items survive, followed by explicit full cleanup and an empty
re-scan.

## Chrome iOS conclusion

Chrome on iOS does not provide an installable extension surface equivalent to
Safari Web Extensions, and an unrelated app cannot reach Chrome's website-data
store across the iOS sandbox. Switching browsers would reduce, not improve,
Tidy's current capability. iOS 26 URL Filters remain an interesting future
system-wide request-filtering branch, but not a storage-cleaning substitute.
