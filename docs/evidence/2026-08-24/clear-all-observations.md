# Clear-all dashboard observations

Validated on 2026-08-24 with Tidy 0.5.0, Xcode 16.1, and the iOS 18.1 iPhone
16 Pro simulator.

`testDashboardClearAllSavedWebsiteData` passed in 52.454 seconds. The test:

- reset and seeded the controlled origin inside its simulator clone;
- verified the dashboard's paired 2 local / 2 session / 2 IndexedDB / 2 cache
  / 1 service-worker inventory;
- probed Safari's global Cookies API;
- opened the first-class **Clear all saved website data** confirmation and
  verified its sign-out warning;
- cleaned the accumulated two-origin catalog (Reddit plus the fixture), then
  ran the final global Cookies API sweep;
- removed 9 storage items and 9 site cookies, with 0 additional globally
  exposed cookies, 0 site failures, and 0 item failures; and
- re-scanned every displayed storage category to zero for both origins.

The final receipt explicitly states that Safari history, saved passwords, and
inaccessible internal data were not touched. The local catalog remains as a
value-free cleanup history.

Retained artifacts are in [`clear-all-ui-test`](clear-all-ui-test/): the exact
receipt, Safari accessibility hierarchy, screenshot, and attachment manifest.
