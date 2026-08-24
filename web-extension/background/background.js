const api = globalThis.browser ?? globalThis.chrome;
const catalogTools = globalThis.TidyCatalog;
let mutationQueue = Promise.resolve();

async function readCatalog() {
  const stored = await api.storage.local.get([catalogTools.STORAGE_KEY, "janitorLab"]);
  if (stored[catalogTools.STORAGE_KEY]?.schemaVersion === catalogTools.SCHEMA_VERSION) {
    return stored[catalogTools.STORAGE_KEY];
  }
  return catalogTools.emptyCatalog(stored.janitorLab?.createdAt);
}

function mutateCatalog(transform) {
  const operation = mutationQueue.then(async () => {
    const catalog = await readCatalog();
    const next = transform(catalog);
    await api.storage.local.set({ [catalogTools.STORAGE_KEY]: next });
    return next;
  });
  mutationQueue = operation.catch(() => undefined);
  return operation;
}

async function scanCookies() {
  try {
    const cookies = await api.cookies.getAll({});
    const byDomain = new Map();
    for (const cookie of cookies) {
      const domain = String(cookie.domain ?? "unknown").replace(/^\./, "");
      byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1);
    }
    const domains = [...byDomain].map(([domain, count]) => ({ domain, count }));
    return mutateCatalog((catalog) => catalogTools.setCookieScan(catalog, {
      total: cookies.length,
      domains
    }));
  } catch (error) {
    return mutateCatalog((catalog) => catalogTools.setCookieScan(catalog, {
      total: 0,
      domains: [],
      error: error instanceof Error ? error.name || "Error" : "Error"
    }));
  }
}

api.runtime.onInstalled.addListener(() => mutateCatalog((catalog) => catalog));

api.runtime.onMessage.addListener((message) => {
  if (message?.type === "janitor.ping" || message?.type === "tidy.ping") {
    return Promise.resolve({ ok: true, manifestVersion: 3, schemaVersion: catalogTools.SCHEMA_VERSION });
  }
  if (message?.type === "tidy.observe") {
    return mutateCatalog((catalog) => catalogTools.upsertSite(catalog, message.snapshot));
  }
  if (message?.type === "tidy.catalog.get") return readCatalog();
  if (message?.type === "tidy.catalog.remove") {
    return mutateCatalog((catalog) => catalogTools.removeSite(catalog, message.origin));
  }
  if (message?.type === "tidy.catalog.reset") {
    return mutateCatalog(() => catalogTools.emptyCatalog());
  }
  if (message?.type === "tidy.cleanup.record") {
    return mutateCatalog((catalog) =>
      catalogTools.recordCleanup(catalog, message.origin, message.cleanup)
    );
  }
  if (message?.type === "tidy.cookies.scan") return scanCookies();
  return undefined;
});
