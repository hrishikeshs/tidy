import test from "node:test";
import assert from "node:assert/strict";
import "../web-extension/shared/catalog.js";

const catalogTools = globalThis.TidyCatalog;
const NOW = "2026-08-23T20:30:00.000Z";

function fixtureInspection(origin = "https://example.com") {
  return {
    origin,
    localStorageKeys: ["account", "secret-value-must-not-persist"],
    sessionStorageKeys: ["draft"],
    indexedDBNames: ["application"],
    cacheNames: ["assets"],
    serviceWorkerScopes: [`${origin}/`],
    scriptVisibleCookieNames: ["session"],
    inaccessibleTypes: ["indexedDB.databases"],
    failures: [{ type: "indexedDB", code: "SecurityError", detail: "drop me" }]
  };
}

test("site observations persist counts but never storage names", () => {
  const catalog = catalogTools.upsertSite(
    catalogTools.emptyCatalog(NOW),
    fixtureInspection(),
    NOW
  );
  const site = catalog.sites["https://example.com"];

  assert.deepEqual(site.counts, {
    cookies: 1,
    localStorage: 2,
    sessionStorage: 1,
    indexedDB: 1,
    cacheStorage: 1,
    serviceWorkers: 1
  });
  assert.equal(JSON.stringify(catalog).includes("secret-value-must-not-persist"), false);
  assert.equal(JSON.stringify(catalog).includes("SecurityError"), false);
  assert.deepEqual(site.inaccessibleTypes, ["indexedDB.databases"]);
  assert.equal(site.failureCount, 1);
});

test("site catalog keys entries by normalized HTTP origin", () => {
  const catalog = catalogTools.upsertSite(
    catalogTools.emptyCatalog(NOW),
    fixtureInspection("http://127.0.0.1:8765/path?private=yes"),
    NOW
  );
  assert.deepEqual(Object.keys(catalog.sites), ["http://127.0.0.1:8765"]);
  assert.throws(() =>
    catalogTools.upsertSite(catalog, fixtureInspection("file:///private/tmp/secret"), NOW)
  );
});

test("cleanup history stores outcomes without names", () => {
  const observed = catalogTools.upsertSite(
    catalogTools.emptyCatalog(NOW),
    fixtureInspection(),
    NOW
  );
  const cleaned = catalogTools.recordCleanup(observed, "https://example.com", {
    mode: "all",
    removedStorage: 6,
    removedCookies: 1,
    failureCount: 0,
    cookieNames: ["must-not-persist"]
  }, "2026-08-23T20:31:00.000Z");

  assert.deepEqual(cleaned.sites["https://example.com"].lastCleanup, {
    mode: "all",
    removedStorage: 6,
    removedCookies: 1,
    failureCount: 0
  });
  assert.equal(JSON.stringify(cleaned).includes("must-not-persist"), false);
});

test("global cookie scan persists domain counts, not cookie records", () => {
  const catalog = catalogTools.setCookieScan(catalogTools.emptyCatalog(NOW), {
    total: 3,
    domains: [{ domain: "example.com", count: 2 }, { domain: "test", count: 1 }]
  }, NOW);

  assert.equal(catalog.cookieScan.status, "ok");
  assert.equal(catalog.cookieScan.total, 3);
  assert.deepEqual(catalog.cookieScan.domains[0], { domain: "example.com", count: 2 });
});

test("catalog totals aggregate value-free site counts", () => {
  let catalog = catalogTools.emptyCatalog(NOW);
  catalog = catalogTools.upsertSite(catalog, fixtureInspection("https://one.example"), NOW);
  catalog = catalogTools.upsertSite(catalog, fixtureInspection("https://two.example"), NOW);
  assert.deepEqual(catalogTools.totals(catalog), {
    sites: 2,
    cookies: 2,
    localStorage: 4,
    sessionStorage: 2,
    indexedDB: 2,
    cacheStorage: 2,
    serviceWorkers: 2
  });
});
