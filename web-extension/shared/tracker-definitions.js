import {
  OPEN_COOKIE_DATABASE_META,
  OPEN_COOKIE_RULES
} from "./open-cookie-rules.generated.js";

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

export const CLASSIFIER_META = Object.freeze({
  version: 1,
  database: OPEN_COOKIE_DATABASE_META,
  policy: "Only high- or medium-confidence evidence-backed analytics and marketing matches are eligible for automatic cleanup."
});

const CATEGORY_NAMES = Object.freeze({
  a: "analytics",
  f: "functional",
  m: "marketing",
  p: "preferences",
  s: "security"
});

const exactRules = new Map();
const wildcardRules = [];

for (const compactRule of OPEN_COOKIE_RULES) {
  const [name, categoryCode, wildcard, domains, description, controller] = compactRule;
  const rule = Object.freeze({
    name,
    purpose: CATEGORY_NAMES[categoryCode] ?? "unknown",
    wildcard: Boolean(wildcard),
    domains,
    description,
    controller
  });
  if (rule.wildcard) {
    wildcardRules.push(rule);
  } else {
    const rules = exactRules.get(name) ?? [];
    rules.push(rule);
    exactRules.set(name, rules);
  }
}

wildcardRules.sort((left, right) => right.name.length - left.name.length);

function hostnameFrom(rawValue) {
  if (!rawValue) return "";
  try {
    const url = new URL(rawValue.includes("://") ? rawValue : `https://${rawValue}`);
    return url.hostname.replace(/^\./, "").toLowerCase();
  } catch {
    return String(rawValue).replace(/^\./, "").toLowerCase();
  }
}

function contextHostnames(item, context = {}) {
  return [...new Set([
    hostnameFrom(item?.domain),
    hostnameFrom(context.origin),
    hostnameFrom(context.hostname)
  ].filter(Boolean))];
}

function domainMatches(ruleDomain, hostnames) {
  return hostnames.some((hostname) =>
    hostname === ruleDomain || hostname.endsWith(`.${ruleDomain}`)
  );
}

function result({ purpose, confidence, evidence, reason, source, controller = "", matchedRule = "" }) {
  const safeToRemove = (purpose === "analytics" || purpose === "marketing")
    && (confidence === "high" || confidence === "medium")
    && evidence !== "heuristic";
  return Object.freeze({
    purpose,
    confidence,
    evidence,
    reason,
    source,
    controller,
    matchedRule,
    safeToRemove,
    classification: purpose === "unknown" ? "unknown" : `${purpose}-${confidence}`
  });
}

function unknown(reason = "No reliable purpose evidence matched this name.") {
  return result({
    purpose: "unknown",
    confidence: "low",
    evidence: "none",
    reason,
    source: "Tidy conservative fallback"
  });
}

function fixtureClassification(name, type) {
  const fixtureMatch = type === "cookie"
    ? isKnownFixtureCookie(name)
    : isKnownFixtureStorageKey(name)
      || (type === "indexedDB" && FIXTURE_TRACKER_DEFINITION.indexedDBNames.includes(name))
      || (type === "cacheStorage" && FIXTURE_TRACKER_DEFINITION.cacheNames.includes(name));
  if (!fixtureMatch) return null;
  return result({
    purpose: "marketing",
    confidence: "high",
    evidence: "fixture",
    reason: FIXTURE_TRACKER_DEFINITION.explanation,
    source: FIXTURE_TRACKER_DEFINITION.source,
    matchedRule: FIXTURE_TRACKER_DEFINITION.id
  });
}

function heuristicClassification(name) {
  const normalized = String(name).toLowerCase();
  const security = /grecaptcha|recaptcha|(?:^|[_-])(csrf|xsrf|captcha|nonce|verification|challenge|antiforgery|mfa|2fa)(?:[_-]|$)/.test(normalized);
  const session = /(?:^|[_-])(auth|login|account|credential|oauth|sso|token|session|sess)(?:[_-]|$)/.test(normalized);
  const tracking = /(?:tracker|tracking|analytics|telemetry|metrics|amplitude|mixpanel|doubleclick|remarket|(?:^|[_-])(?:ads?|advert|campaign|conversion|pixel|gcl|fbp|fbc|uet)(?:[_-]|$))/.test(normalized);

  if ((security || session) && tracking) {
    return unknown("The name contains both safety/session and tracking signals, so Tidy will not guess.");
  }
  if (security) {
    return result({
      purpose: "security",
      confidence: "medium",
      evidence: "heuristic",
      reason: "The name contains a common request-integrity or verification marker.",
      source: "Tidy safety heuristic"
    });
  }
  if (session) {
    return result({
      purpose: "functional",
      confidence: "medium",
      evidence: "heuristic",
      reason: "The name contains an authentication or session marker; automatic removal is disabled.",
      source: "Tidy safety heuristic"
    });
  }
  if (/(?:consent|cookie[_-]?pref)/.test(normalized)) {
    return result({
      purpose: "functional",
      confidence: "medium",
      evidence: "heuristic",
      reason: "The name appears to store a consent choice.",
      source: "Tidy name heuristic"
    });
  }
  if (/(?:preference|prefs?(?:[_-]|$)|theme|locale|language|translation|compact|media[_-]?codec)/.test(normalized)) {
    return result({
      purpose: "preferences",
      confidence: "low",
      evidence: "heuristic",
      reason: "The name resembles a display, language, or site-preference key.",
      source: "Tidy name heuristic"
    });
  }
  if (tracking) {
    const purpose = /(?:ads?|advert|campaign|conversion|doubleclick|remarket|gcl|fbp|fbc|uet)/.test(normalized)
      ? "marketing"
      : "analytics";
    return result({
      purpose,
      confidence: "low",
      evidence: "heuristic",
      reason: "The name resembles a tracking or measurement key, but name-only evidence is insufficient for automatic removal.",
      source: "Tidy name heuristic"
    });
  }
  return unknown();
}

function databaseClassification(cookie, context) {
  const exact = exactRules.get(cookie.name) ?? [];
  const wildcard = wildcardRules.filter((rule) => cookie.name.startsWith(rule.name));
  const candidates = exact.length > 0 ? exact : wildcard;
  if (candidates.length === 0) return null;

  const hostnames = contextHostnames(cookie, context);
  const contextual = candidates.filter(({ domains }) =>
    domains.some((domain) => domainMatches(domain, hostnames))
  );
  const generic = candidates.filter(({ domains }) => domains.length === 0);
  const applicable = contextual.length > 0 ? contextual : generic;
  if (applicable.length === 0) return null;

  const purposes = [...new Set(applicable.map(({ purpose }) => purpose))];
  if (purposes.length !== 1) {
    return unknown(`Public definitions disagree (${purposes.sort().join(", ")}); Tidy will not choose one.`);
  }

  const chosen = applicable.find(({ description }) => description) ?? applicable[0];
  const exactMatch = exact.length > 0;
  const domainSpecific = contextual.length > 0;
  const confidence = domainSpecific && exactMatch ? "high" : "medium";
  const matchType = exactMatch ? "exact name" : `prefix ${chosen.name}`;
  return result({
    purpose: purposes[0],
    confidence,
    evidence: "public-database",
    reason: chosen.description || `Matched the database's ${matchType} rule.`,
    source: OPEN_COOKIE_DATABASE_META.source,
    controller: chosen.controller,
    matchedRule: chosen.name
  });
}

export function isKnownFixtureCookie(name) {
  return FIXTURE_TRACKER_DEFINITION.cookieNames.includes(name);
}

export function isKnownFixtureStorageKey(name) {
  return FIXTURE_TRACKER_DEFINITION.storageKeyPrefixes.some((prefix) =>
    name.startsWith(prefix)
  );
}

export function classifyCookie(cookie, context = {}) {
  const classification = fixtureClassification(cookie.name, "cookie")
    ?? databaseClassification(cookie, context)
    ?? heuristicClassification(cookie.name);
  return {
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    session: cookie.session,
    sameSite: cookie.sameSite,
    storeId: cookie.storeId,
    source: cookie.source ?? "cookies-api",
    ...classification
  };
}

export function classifyStorageItem(type, name, context = {}) {
  return {
    name,
    type,
    ...(
      fixtureClassification(name, type)
      ?? heuristicClassification(name, context)
    )
  };
}

export function classificationLabel(classification) {
  if (classification.purpose === "unknown") return "Unknown · kept";
  const purpose = classification.purpose[0].toUpperCase() + classification.purpose.slice(1);
  return `${purpose} · ${classification.confidence} confidence${classification.safeToRemove ? " · removable" : " · kept"}`;
}

export function removableSelection(inspection, cookies = []) {
  const origin = inspection.origin;
  const cookieNames = cookies
    .filter(({ safeToRemove }) => safeToRemove)
    .map(({ name }) => name);
  const classifyNames = (type, names) => names
    .map((name) => classifyStorageItem(type, name, { origin }))
    .filter(({ safeToRemove }) => safeToRemove)
    .map(({ name }) => name);
  return {
    cookieNames: [...new Set(cookieNames)],
    localStorageKeys: classifyNames("localStorage", inspection.localStorageKeys ?? []),
    sessionStorageKeys: classifyNames("sessionStorage", inspection.sessionStorageKeys ?? []),
    indexedDBNames: classifyNames("indexedDB", inspection.indexedDBNames ?? []),
    cacheNames: classifyNames("cacheStorage", inspection.cacheNames ?? []),
    serviceWorkerScopes: []
  };
}

export function learnedPolicySelection(inspection, cookies = [], policy = null) {
  const empty = {
    cookieNames: [],
    localStorageKeys: [],
    sessionStorageKeys: [],
    indexedDBNames: [],
    cacheNames: [],
    serviceWorkerScopes: []
  };
  if (!policy || policy.origin !== inspection.origin || !Array.isArray(policy.removable)) {
    return empty;
  }

  const observed = {
    cookie: new Set(cookies.map(({ name }) => name)),
    localStorage: new Set(inspection.localStorageKeys ?? []),
    sessionStorage: new Set(inspection.sessionStorageKeys ?? [])
  };
  const selected = {
    cookie: new Set(),
    localStorage: new Set(),
    sessionStorage: new Set()
  };
  for (const reference of policy.removable) {
    if (selected[reference?.kind] && observed[reference.kind].has(reference.name)) {
      selected[reference.kind].add(reference.name);
    }
  }
  return {
    ...empty,
    cookieNames: [...selected.cookie].sort(),
    localStorageKeys: [...selected.localStorage].sort(),
    sessionStorageKeys: [...selected.sessionStorage].sort()
  };
}

export function permissionPatternFor(rawURL) {
  const url = new URL(rawURL);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Tidy only inspects HTTP(S) pages.");
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

export function globalCookieRemovalURL(cookie) {
  const hostname = String(cookie?.domain ?? "").replace(/^\./, "");
  if (!hostname) throw new TypeError("A cookie domain is required for global removal.");
  const scheme = cookie.secure ? "https:" : "http:";
  const cookiePath = cookie.path?.startsWith("/") ? cookie.path : "/";
  return `${scheme}//${hostname}${cookiePath}`;
}
