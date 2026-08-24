# Classifier observations — 2026-08-24

## Live Reddit sample

The iOS 18.1 simulator exposed 12 script-visible cookie names on
`https://www.reddit.com`. Tidy 0.3 classified the supplied names without using
cookie values.

| Name | Purpose | Confidence | Automatic cleanup |
|---|---|---|---|
| `_gcl_au` | Marketing | Medium, public rule | Eligible |
| `edgebucket` | Marketing | High, domain-matched public rule | Eligible |
| `ads_cookie` | Marketing | Low, name heuristic | Kept |
| `compact` | Preferences | Low, name heuristic | Kept |
| `csrf_token` | Security | Medium, safety heuristic | Kept |
| `reddit_supported_media_codecs` | Preferences | Low, name heuristic | Kept |
| `reddit_translation_status` | Preferences | Low, name heuristic | Kept |
| `seeker_session` | Functional | Medium, safety heuristic | Kept |
| `session_tracker` | Unknown | Mixed session/tracking signals | Kept |
| `csv`, `g_state`, `loid` | Unknown | Insufficient evidence | Kept |

`_grecaptcha` in local storage was classified as security and kept. Other
opaque UUID and application-specific storage names remained unknown and kept.

The result demonstrates the policy boundary: plausible names receive useful
labels, but only evidence-backed medium/high analytics or marketing matches can
trigger automatic cleanup.

## Automated results

- 12 JavaScript model, privacy, classifier, and URL/cookie tests passed.
- Generic iOS Simulator build passed.
- `testPhaseZeroPermissionInspectionAndSelectiveCleanup` passed in 45.828
  seconds with the generated classifier bundled.
- The simulator test removed four controlled tracker storage objects plus the
  script-visible tracker cookie, preserved paired functional state, then
  completed explicit full cleanup.

The Reddit observation is not evidence of HttpOnly-cookie coverage. Safari's
Cookies API still returned no records in this iOS 18.1 environment.
