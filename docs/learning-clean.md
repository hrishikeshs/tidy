# Learning Clean

Learning Clean is Tidy's value-aware, on-device experimenter. It answers a
narrow question: for this page and this health check, which captured state items
can disappear without making the page observably fail?

It is deliberately separate from ordinary Safari inspection. A second normal
Safari tab shares state with the first and therefore cannot be a safe trial
container. Tidy instead provides a small browser inside the containing app,
backed by a dedicated named `WKWebsiteDataStore`. The user signs in or navigates
there until the page represents the experience they want to preserve.

## Flow

1. Open **Test what this site needs** from Tidy's full-page Safari site workspace. The current URL is
   passed to the app through the local `tidy://` URL scheme.
2. In the Tidy profile, capture the baseline. The app reads same-site cookies
   through `WKHTTPCookieStore`, including HttpOnly cookies available to that
   WebKit profile, and reads `localStorage` and `sessionStorage` names and values.
3. Capture a baseline health snapshot: final host/path behavior, ready state,
   visible-text floor, fatal script errors, an optional user-supplied CSS
   sentinel, and an optional page-owned `window.__tidyHealth` signal.
4. For every trial, create a fresh `WKWebsiteDataStore.nonPersistent()` store,
   seed only the candidate items, load the same route, and compare its health to
   the baseline.
5. First reconstruct the complete capture in an ephemeral store. If that does
   not reproduce the healthy baseline, stop without saving a policy.
6. Run delta debugging over the captured items. Large removable chunks are
   tried first; failing chunks are split until no remaining single item can be
   removed while the oracle still passes.
7. Save a 14-day policy containing names/scopes and outcomes but no values.
8. The Safari extension requests the newest matching origin-and-route policy
   from its native extension. The bridge uses the shared app group
   `group.io.hrishi.tidy` and Safari native messaging.
9. **Remove tested items** intersects the policy with currently
   observed names. Required, new, missing, expired, and untested state stays put.

## What “minimal” means

The result is 1-minimal: given the trial order and oracle, removing any one more
retained item caused a failure. This is stronger than a classifier guess but
weaker than proof of a unique or globally smallest set. Dependencies can have
multiple valid combinations, server behavior can change between trials, and a
health oracle sees only what it measures.

This is delta debugging, not literal binary search. Binary-sized chunk removal
makes it efficient, while adaptive splitting and a final one-at-a-time pass
handle interacting items.

## Local-data boundary

- Snapshot values exist in the app's memory while learning and are copied into
  ephemeral on-device WebKit stores for trials.
- The named Tidy Lab profile retains the site's own state on device so the user
  does not need to sign in for every run.
- Learned policies contain origin, route, a hash of state identities,
  names/scopes, required/removable/uncertain outcomes, timestamps, algorithm
  version, and trial count. They contain no values.
- The app and extension share policies through an Apple app-group container.
- Tidy has no backend, analytics, account, telemetry, or policy sync.
- Each trial still loads the target page, so ordinary requests go to that site
  and any resources the site itself chooses to contact.

## Current scope and limits

- Learned capture covers cookies, `localStorage`, and `sessionStorage`.
- IndexedDB, Cache Storage, and service-worker snapshot/restore are not yet in
  the learner. Ordinary Tidy inspection and cleanup can still enumerate many of
  those names.
- Tidy's WebKit profile is not Safari's storage. The reusable part is the
  site-state schema—the names and learned outcomes—not the session values.
- Policies match exact origin and route, expire after 14 days, and affect only
  matching names that remain present. Automatic refresh scheduling is not yet
  implemented; rerunning the lab replaces the matching fingerprinted policy.
- Simulator results are not a physical-device lifecycle or App Review claim.

## Platform mechanisms

Apple documents Safari Web Extension native messaging and app groups as the
bridge between separately sandboxed extension/app components:
[messaging documentation](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension).
The isolated browser relies on
[`WKWebsiteDataStore`](https://developer.apple.com/documentation/webkit/wkwebsitedatastore)
and [`WKHTTPCookieStore`](https://developer.apple.com/documentation/webkit/wkhttpcookiestore).
