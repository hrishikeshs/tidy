# Phase 0 simulator observations

## Environment

- Date: 2026-08-23
- Xcode: 16.1 (16B40)
- Swift: 6.0.2
- Device: iPhone 16 Pro simulator
- Runtime and Safari: iOS 18.1
- Extension: Janitor Lab 0.1.0, Manifest V3

These observations apply to this environment only.

## Results

### Build and DNR

- The iOS containing app and extension built, installed, and launched.
- Controlled DNR A/B result: extension disabled produced 1 tracker request;
  extension enabled produced 0 additional requests.
- The harness had to reboot the simulator after each extension-state change and
  launch the containing app before Safari for the enabled leg.

### Permission prompt

- Before permission, the popup reported: “Shield only. Page contents are not
  accessible.”
- The popup requested the current host only.
- Safari's prompt named `127.0.0.1` and offered **Allow for One Day**,
  **Always Allow**, and **Don't Allow**.

### Inspection

The seeded origin produced:

| Category | Accessible count |
|---|---:|
| Cookies API | 0 |
| Script-visible cookie fallback | 2 |
| localStorage | 2 |
| sessionStorage | 2 |
| IndexedDB | 2 |
| Cache Storage | 2 |
| Service workers | 1 |

The first-party page and server showed four cookies were sent, including the
server-set HttpOnly fixture cookie, while Safari's Cookies API returned zero.
The fallback therefore exposes only `document.cookie` names and displays an
explicit HttpOnly warning. No cookie values cross the extension boundary.

### Cleanup

- Selective cleanup removed 4 tracker-named storage items and the
  script-visible tracker cookie. The paired functional local/session storage,
  IndexedDB, Cache Storage, and cookie names survived the re-scan.
- Full cleanup required an explicit in-popup confirmation, removed the 5
  remaining storage items and 2 script-visible cookies, and re-scanned all 6
  accessible categories as empty.

### Automated UI evidence

`testPhaseZeroPermissionInspectionAndSelectiveCleanup` passed in 28.396 seconds.
The retained accessibility hierarchy records the final result:

```text
Attempted: 5 storage categories and 2 cookies.
Removed: 5 storage items and 2 cookies.
Inaccessible: none reported. Failed: 0.
```

Artifacts:

- [Full-cleanup screenshot](ui-test/439093B9-5390-443B-B69D-6E7B768753C0.png)
- [Full-cleanup accessibility hierarchy](ui-test/9DEABBA6-26EB-401A-94B1-DF2F8A566FC6.txt)
- [Xcode attachment export manifest](ui-test/manifest.json)

No captured evidence includes cookie or storage values.
