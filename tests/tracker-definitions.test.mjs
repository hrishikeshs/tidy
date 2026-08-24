import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCookie,
  cookieRemovalURL,
  isKnownFixtureCookie,
  isKnownFixtureStorageKey,
  permissionPatternFor
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

  assert.equal(classified.classification, "known-fixture-tracker");
  assert.equal("value" in classified, false);
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
