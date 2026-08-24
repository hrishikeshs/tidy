# Third-party notices

## Open Cookie Database

Tidy includes a normalized, generated subset of the
[Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database).

- License: Apache License 2.0
- Retained rules: 2,261
- Source SHA-256: `02a6bf54209273bc21ca0e4bc19c5a8c8946702c7890acbb11172577728e0fb7`
- Local modifications: records are flattened, category names are compacted,
  domain-like tokens are normalized, descriptions are whitespace-normalized
  and truncated, duplicates are removed, and unsafe context-free names shorter
  than three characters are excluded.

The full license text is retained at
[`third_party/open-cookie-database/LICENSE`](third_party/open-cookie-database/LICENSE).
