import test from "node:test";
import assert from "node:assert/strict";
import {
  classificationLabel,
  classifyCookie,
  classifyStorageItem,
  cookieRemovalURL,
  globalCookieRemovalURL,
  isKnownFixtureCookie,
  isKnownFixtureStorageKey,
  learnedPolicySelection,
  permissionPatternFor,
  removableSelection
} from "../web-extension/shared/tracker-definitions.js";

test("fixture classification fails conservative for unknown names", () => {
  assert.equal(isKnownFixtureCookie("_janitor_tracker"), true);
  assert.equal(isKnownFixtureCookie("janitor_login"), false);
  assert.equal(isKnownFixtureStorageKey("_janitor_tracker_id"), true);
  assert.equal(isKnownFixtureStorageKey("janitor_login_preference"), false);
});

test("cookie classification drops values", () => {
  const classified = classifyCookie({
    name: "_janitor_tracker",
    value: "must-not-cross-the-boundary",
    domain: "127.0.0.1",
    path: "/",
    secure: false,
    httpOnly: true,
    session: true,
    sameSite: "lax"
  });

  assert.equal(classified.purpose, "marketing");
  assert.equal(classified.confidence, "high");
  assert.equal(classified.safeToRemove, true);
  assert.equal("value" in classified, false);
});

test("public rules classify common Reddit cookies with contextual confidence", () => {
  const googleAds = classifyCookie({ name: "_gcl_au", domain: ".reddit.com" }, {
    origin: "https://www.reddit.com"
  });
  const redditAds = classifyCookie({ name: "edgebucket", domain: ".reddit.com" }, {
    origin: "https://www.reddit.com"
  });

  assert.equal(googleAds.purpose, "marketing");
  assert.equal(googleAds.confidence, "medium");
  assert.equal(googleAds.safeToRemove, true);
  assert.equal(redditAds.purpose, "marketing");
  assert.equal(redditAds.confidence, "high");
  assert.equal(redditAds.safeToRemove, true);
});

test("safety and mixed-signal names fail conservative", () => {
  const csrf = classifyCookie({ name: "csrf_token", domain: "reddit.com" });
  const mixed = classifyCookie({ name: "session_tracker", domain: "reddit.com" });
  const suggestive = classifyCookie({ name: "ads_cookie", domain: "reddit.com" });
  const preference = classifyCookie({ name: "compact", domain: "reddit.com" });
  const recaptcha = classifyStorageItem("localStorage", "_grecaptcha");

  assert.equal(csrf.purpose, "security");
  assert.equal(csrf.safeToRemove, false);
  assert.equal(mixed.purpose, "unknown");
  assert.equal(mixed.safeToRemove, false);
  assert.equal(suggestive.purpose, "marketing");
  assert.equal(suggestive.confidence, "low");
  assert.equal(suggestive.safeToRemove, false);
  assert.equal(preference.purpose, "preferences");
  assert.equal(classificationLabel(preference), "Preferences · low confidence · kept");
  assert.equal(recaptcha.purpose, "security");
  assert.equal(recaptcha.safeToRemove, false);
});

test("automatic selection includes evidence-backed tracking and protects heuristics", () => {
  const cookies = [
    classifyCookie({ name: "edgebucket", domain: ".reddit.com" }, { origin: "https://www.reddit.com" }),
    classifyCookie({ name: "csrf_token", domain: ".reddit.com" }, { origin: "https://www.reddit.com" }),
    classifyCookie({ name: "ads_cookie", domain: ".reddit.com" }, { origin: "https://www.reddit.com" })
  ];
  const inspection = {
    origin: "https://www.reddit.com",
    localStorageKeys: ["_gcl_ls", "_janitor_tracker_id", "account"],
    sessionStorageKeys: [],
    indexedDBNames: ["keyval-store"],
    cacheNames: []
  };

  assert.deepEqual(removableSelection(inspection, cookies), {
    cookieNames: ["edgebucket"],
    localStorageKeys: ["_janitor_tracker_id"],
    sessionStorageKeys: [],
    indexedDBNames: [],
    cacheNames: [],
    serviceWorkerScopes: []
  });
  assert.equal(classifyStorageItem("localStorage", "_gcl_ls").safeToRemove, false);
});

test("learned selection removes only proven names still present", () => {
  const inspection = {
    origin: "https://www.reddit.com",
    localStorageKeys: ["required_local", "optional_local", "new_local"],
    sessionStorageKeys: ["required_session", "optional_session"],
    indexedDBNames: ["untested-db"],
    cacheNames: ["untested-cache"]
  };
  const cookies = [
    { name: "required_cookie" },
    { name: "optional_cookie" },
    { name: "new_cookie" }
  ];
  const policy = {
    origin: inspection.origin,
    required: [
      { kind: "cookie", name: "required_cookie" },
      { kind: "localStorage", name: "required_local" }
    ],
    removable: [
      { kind: "cookie", name: "optional_cookie" },
      { kind: "cookie", name: "no_longer_present" },
      { kind: "localStorage", name: "optional_local" },
      { kind: "sessionStorage", name: "optional_session" }
    ]
  };

  assert.deepEqual(learnedPolicySelection(inspection, cookies, policy), {
    cookieNames: ["optional_cookie"],
    localStorageKeys: ["optional_local"],
    sessionStorageKeys: ["optional_session"],
    indexedDBNames: [],
    cacheNames: [],
    serviceWorkerScopes: []
  });
});

test("permissions are requested for a host, not a browsing URL", () => {
  assert.equal(
    permissionPatternFor("http://127.0.0.1:8765/account?token=secret#profile"),
    "http://127.0.0.1/*"
  );
  assert.throws(() => permissionPatternFor("safari-extension://settings"));
});

test("host-only cookie removal preserves the fixture port", () => {
  assert.equal(
    cookieRemovalURL(
      { hostOnly: true, secure: false, domain: "127.0.0.1", path: "/settings" },
      "http://127.0.0.1:8765/account"
    ),
    "http://127.0.0.1:8765/settings"
  );
});

test("global cookie removal derives a URL without opening its site", () => {
  assert.equal(
    globalCookieRemovalURL({ secure: true, domain: ".example.com", path: "/account" }),
    "https://example.com/account"
  );
  assert.equal(
    globalCookieRemovalURL({ secure: false, domain: "localhost", path: "invalid" }),
    "http://localhost/"
  );
  assert.throws(() => globalCookieRemovalURL({}), /domain/);
});
