# Controlled fixture

The fixture uses two origins:

- `http://127.0.0.1:8765` is the page the user intentionally visits.
- `http://127.0.0.1:8766` is a synthetic embedded tracker origin. A different
  port makes it a different web origin while avoiding simulator hostname quirks.

The first-party page creates paired functional and tracker-like entries in
cookies, local/session storage, IndexedDB, and Cache Storage, plus a service
worker. The names are repository-owned and intentionally obvious so selective
cleanup can be tested without claiming a real-world classifier is ready.

The tracker server increments an in-memory counter for every pixel request. Read
`http://127.0.0.1:8766/status` outside the protected page to distinguish a DNR
block from an ordinary image error.

Values exist only to prove that deletion targets names rather than empty data.
The extension itself must never display or persist them.
