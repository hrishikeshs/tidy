export const FIXTURE_TRACKER_DEFINITION = Object.freeze({
  id: "janitor-lab-fixture",
  source: "repository-owned test fixture",
  sourceVersion: "1",
  domains: Object.freeze(["127.0.0.1"]),
  cookieNames: Object.freeze(["_janitor_tracker", "janitor_http_only_tracker"]),
  storageKeyPrefixes: Object.freeze(["_janitor_tracker"]),
  indexedDBNames: Object.freeze(["janitor-tracker-db"]),
  cacheNames: Object.freeze(["janitor-tracker-cache"]),
  explanation: "Synthetic tracker state created only by the Janitor Lab fixture."
});

export function isKnownFixtureCookie(name) {
  return FIXTURE_TRACKER_DEFINITION.cookieNames.includes(name);
}

export function isKnownFixtureStorageKey(name) {
  return FIXTURE_TRACKER_DEFINITION.storageKeyPrefixes.some((prefix) =>
    name.startsWith(prefix)
  );
}

export function classifyCookie(cookie) {
  return {
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    session: cookie.session,
    sameSite: cookie.sameSite,
    source: cookie.source ?? "cookies-api",
    classification: isKnownFixtureCookie(cookie.name) ? "known-fixture-tracker" : "unknown"
  };
}

export function permissionPatternFor(rawURL) {
  const url = new URL(rawURL);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Janitor Lab only inspects HTTP(S) pages.");
  }
  return `${url.protocol}//${url.hostname}/*`;
}

export function cookieRemovalURL(cookie, rawPageURL) {
  const pageURL = new URL(rawPageURL);
  const scheme = cookie.secure ? "https:" : pageURL.protocol;
  const cookiePath = cookie.path?.startsWith("/") ? cookie.path : "/";

  if (cookie.hostOnly || cookie.domain.replace(/^\./, "") === pageURL.hostname) {
    return `${scheme}//${pageURL.host}${cookiePath}`;
  }

  return `${scheme}//${cookie.domain.replace(/^\./, "")}${cookiePath}`;
}
