(() => {
  const SCHEMA_VERSION = 2;
  const STORAGE_KEY = "tidyCatalog";
  const MAX_SITES = 500;

  function emptyCatalog(now = new Date().toISOString()) {
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      sites: {},
      cookieScan: {
        status: "not-run",
        scannedAt: null,
        total: 0,
        domains: [],
        error: null
      }
    };
  }

  function cleanCount(value) {
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  }

  function summaryFromInspection(inspection) {
    return {
      origin: inspection.origin,
      counts: {
        cookies: cleanCount(
          inspection.counts?.cookies ?? inspection.scriptVisibleCookieNames?.length
        ),
        localStorage: cleanCount(
          inspection.counts?.localStorage ?? inspection.localStorageKeys?.length
        ),
        sessionStorage: cleanCount(
          inspection.counts?.sessionStorage ?? inspection.sessionStorageKeys?.length
        ),
        indexedDB: cleanCount(
          inspection.counts?.indexedDB ?? inspection.indexedDBNames?.length
        ),
        cacheStorage: cleanCount(
          inspection.counts?.cacheStorage ?? inspection.cacheNames?.length
        ),
        serviceWorkers: cleanCount(
          inspection.counts?.serviceWorkers ?? inspection.serviceWorkerScopes?.length
        )
      },
      inaccessibleTypes: [...new Set(inspection.inaccessibleTypes ?? [])].sort(),
      failures: (inspection.failures ?? []).map(({ type, code }) => ({ type, code }))
    };
  }

  function normalizedOrigin(rawOrigin) {
    const url = new URL(rawOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new TypeError("Tidy only catalogs HTTP(S) origins.");
    }
    return url.origin;
  }

  function cloneCatalog(catalog, now) {
    const baseline = catalog?.schemaVersion === SCHEMA_VERSION
      ? catalog
      : emptyCatalog(catalog?.createdAt ?? now);
    return {
      ...baseline,
      updatedAt: now,
      sites: { ...(baseline.sites ?? {}) },
      cookieScan: { ...emptyCatalog(now).cookieScan, ...(baseline.cookieScan ?? {}) }
    };
  }

  function pruneSites(sites) {
    const entries = Object.entries(sites);
    if (entries.length <= MAX_SITES) return sites;
    entries.sort(([, left], [, right]) =>
      String(right.lastSeenAt).localeCompare(String(left.lastSeenAt))
    );
    return Object.fromEntries(entries.slice(0, MAX_SITES));
  }

  function upsertSite(catalog, inspection, now = new Date().toISOString()) {
    const summary = summaryFromInspection(inspection);
    const origin = normalizedOrigin(summary.origin);
    const url = new URL(origin);
    const next = cloneCatalog(catalog, now);
    const previous = next.sites[origin];
    next.sites[origin] = {
      origin,
      hostname: url.hostname,
      firstSeenAt: previous?.firstSeenAt ?? now,
      lastSeenAt: now,
      lastCleanedAt: previous?.lastCleanedAt ?? null,
      lastCleanup: previous?.lastCleanup ?? null,
      counts: summary.counts,
      inaccessibleTypes: summary.inaccessibleTypes,
      failureCount: summary.failures.length
    };
    next.sites = pruneSites(next.sites);
    return next;
  }

  function removeSite(catalog, rawOrigin, now = new Date().toISOString()) {
    const origin = normalizedOrigin(rawOrigin);
    const next = cloneCatalog(catalog, now);
    delete next.sites[origin];
    return next;
  }

  function recordCleanup(catalog, rawOrigin, cleanup, now = new Date().toISOString()) {
    const origin = normalizedOrigin(rawOrigin);
    const next = cloneCatalog(catalog, now);
    const previous = next.sites[origin];
    if (!previous) return next;
    next.sites[origin] = {
      ...previous,
      lastCleanedAt: now,
      lastCleanup: {
        mode: cleanup.mode === "trackers" ? "trackers" : "all",
        removedStorage: cleanCount(cleanup.removedStorage),
        removedCookies: cleanCount(cleanup.removedCookies),
        failureCount: cleanCount(cleanup.failureCount)
      }
    };
    return next;
  }

  function setCookieScan(catalog, scan, now = new Date().toISOString()) {
    const next = cloneCatalog(catalog, now);
    next.cookieScan = {
      status: scan.error ? "error" : "ok",
      scannedAt: now,
      total: cleanCount(scan.total),
      domains: (scan.domains ?? [])
        .map(({ domain, count }) => ({ domain: String(domain), count: cleanCount(count) }))
        .sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain)),
      error: scan.error ? String(scan.error) : null
    };
    return next;
  }

  function totals(catalog) {
    const sites = Object.values(catalog?.sites ?? {});
    return sites.reduce((result, site) => {
      result.sites += 1;
      for (const [key, value] of Object.entries(site.counts ?? {})) {
        result[key] = (result[key] ?? 0) + cleanCount(value);
      }
      return result;
    }, {
      sites: 0,
      cookies: 0,
      localStorage: 0,
      sessionStorage: 0,
      indexedDB: 0,
      cacheStorage: 0,
      serviceWorkers: 0
    });
  }

  globalThis.TidyCatalog = Object.freeze({
    SCHEMA_VERSION,
    STORAGE_KEY,
    emptyCatalog,
    summaryFromInspection,
    upsertSite,
    removeSite,
    recordCleanup,
    setCookieScan,
    totals
  });
})();
