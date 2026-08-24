# Tidy classifier

Tidy classifies names, never values. A result contains a purpose, confidence,
evidence type, human-readable rationale, source, and `safeToRemove` decision.

## Purposes

- **Security:** request integrity, verification, and abuse prevention.
- **Functional:** login, session, consent, and application operation.
- **Preferences:** display, language, and user choices.
- **Analytics:** traffic and product measurement.
- **Marketing:** advertising, attribution, and campaign measurement.
- **Unknown:** insufficient or conflicting evidence.

## Evidence order

1. Repository-owned controlled fixtures, used only for deterministic tests.
2. Exact or wildcard Open Cookie Database matches, strengthened when their
   documented domain matches the observed cookie/site domain.
3. Conservative name heuristics for safety, sessions, preferences, analytics,
   and marketing.
4. Unknown.

Exact domain matches receive high confidence. General exact and wildcard rules
receive medium confidence. Heuristics are medium confidence for protective
security/session signals and low confidence for tracking or preference guesses.
Conflicting public categories or mixed session/tracking tokens resolve to
unknown.

## Automatic-cleanup invariant

Only analytics or marketing classifications with high or medium confidence and
fixture/public-database evidence set `safeToRemove`. Name heuristics can improve
the inventory but never trigger deletion. Service workers remain kept unless
the user explicitly chooses full-site cleanup.

When Safari's Cookies API omits a script-visible cookie, Tidy expires the
selected name across the current path hierarchy and plausible parent domains.
This remains best-effort: HttpOnly cookies and attributes Safari does not expose
cannot be inspected or guaranteed removable through `document.cookie`.

The classifier cannot infer how a site actually uses data from a name alone.
Its output is an explainable aid, not a factual guarantee or legal cookie
classification.

## Dataset

The generated rules are derived from
[Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database),
licensed Apache-2.0. Tidy retains 2,261 normalized rules from source SHA-256
`02a6bf54209273bc21ca0e4bc19c5a8c8946702c7890acbb11172577728e0fb7`.
Descriptions are whitespace-normalized and truncated for an offline extension
bundle; malformed or dangerously short context-free patterns are excluded.
See the retained [license](../third_party/open-cookie-database/LICENSE).

Regenerate from a reviewed source snapshot with:

```sh
npm run generate:classifier -- /path/to/open-cookie-database.json
```
