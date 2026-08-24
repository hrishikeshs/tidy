# Controlled fixture

The fixture uses two origins:

- `http://127.0.0.1:8765` is the page the user intentionally visits.
- `http://127.0.0.1:8766` is a synthetic embedded tracker origin. A different
  port makes it a different web origin while avoiding simulator hostname quirks.

The first-party page creates paired functional and tracker-like entries in
cookies, local/session storage, IndexedDB, and Cache Storage, plus a service
worker. The names are repository-owned and intentionally obvious so selective
cleanup can be tested without claiming a real-world classifier is ready.

The first-party and tracker servers keep independent in-memory counters. Read
`http://127.0.0.1:8765/status` to prove Safari completed the top-level
navigation, and `http://127.0.0.1:8766/status` to count embedded pixel requests.
Reset either counter with `POST /reset`. Keeping the readiness and tracker
signals separate prevents a slow Safari launch from being mistaken for a DNR
block.

`/learning?tidy_seed=1` is a separate delta-debugging fixture. It seeds six
cookie/Web Storage values and exposes an explicit health oracle that requires
exactly three. The required cookie is HttpOnly so the native Learning Clean lab
must copy it through `WKHTTPCookieStore`; the other required values live in
`localStorage` and `sessionStorage`.

The Safari extension's ordinary inspection and classification paths remain
name-only. Learning Clean is intentionally different: after the user starts a
learning run, its native isolated profiles may copy values locally. Snapshot
values are not part of the persisted learned-policy schema.
