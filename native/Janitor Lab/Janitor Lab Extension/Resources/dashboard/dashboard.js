import "../shared/catalog.js";
import {
  classifyCookie,
  cookieRemovalURL,
  removableSelection
} from "../shared/tracker-definitions.js";

const api = globalThis.browser ?? globalThis.chrome;
const catalogTools = globalThis.TidyCatalog;
const elements = Object.fromEntries(
  [
    "overview", "refresh-open", "scan-cookies", "cookie-status", "cookie-domains",
    "select-all", "clean-trackers", "forget-selected", "catalog-note", "site-list",
    "empty-state", "confirmation", "confirmation-title", "confirmation-copy",
    "cancel-clean", "confirm-clean", "result", "error"
  ].map((id) => [id, document.getElementById(id)])
);

let catalog = catalogTools.emptyCatalog();
let tabsByOrigin = new Map();
let pendingCleanup;

function httpOrigin(rawURL) {
  try {
    const url = new URL(rawURL);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function metric(label, value) {
  const node = document.createElement("div");
  node.className = "metric";
  const count = document.createElement("strong");
  count.textContent = String(value);
  const caption = document.createElement("span");
  caption.textContent = label;
  node.append(count, caption);
  return node;
}

function relativeTime(rawDate) {
  if (!rawDate) return "never";
  const elapsed = Math.max(0, Date.now() - new Date(rawDate).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function selectedOrigins() {
  return [...elements["site-list"].querySelectorAll('input[type="checkbox"]:checked')]
    .map(({ value }) => value);
}

function updateBulkActions() {
  const count = selectedOrigins().length;
  elements["clean-trackers"].disabled = count === 0;
  elements["forget-selected"].disabled = count === 0;
}

function renderSite(site) {
  const row = document.createElement("article");
  row.className = "site";
  row.dataset.origin = site.origin;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = site.origin;
  checkbox.setAttribute("aria-label", `Select ${site.hostname}`);
  checkbox.addEventListener("change", updateBulkActions);

  const identity = document.createElement("div");
  identity.className = "site-name";
  const name = document.createElement("strong");
  name.textContent = site.hostname;
  const origin = document.createElement("span");
  origin.textContent = `${site.origin} · seen ${relativeTime(site.lastSeenAt)}`;
  identity.append(name, origin);

  const counts = document.createElement("div");
  counts.className = "site-counts";
  const labels = [
    ["cookies", "cookies"],
    ["localStorage", "local"],
    ["sessionStorage", "session"],
    ["indexedDB", "IDB"],
    ["cacheStorage", "caches"],
    ["serviceWorkers", "workers"]
  ];
  for (const [key, label] of labels) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${site.counts?.[key] ?? 0} ${label}`;
    counts.append(pill);
  }

  const actions = document.createElement("div");
  actions.className = "site-actions";
  const openTab = tabsByOrigin.get(site.origin);
  const state = document.createElement("span");
  state.className = openTab ? "open-state" : "closed-state";
  state.textContent = openTab ? "OPEN" : "DORMANT";
  const action = document.createElement("button");
  action.className = openTab ? "secondary" : "quiet";
  action.textContent = "Clean…";
  action.addEventListener("click", () => showConfirmation([site.origin]));
  actions.append(state, action);
  row.append(checkbox, identity, counts, actions);
  return row;
}

function render() {
  const totals = catalogTools.totals(catalog);
  const storedItems = totals.cookies + totals.localStorage + totals.sessionStorage
    + totals.indexedDB + totals.cacheStorage + totals.serviceWorkers;
  elements.overview.replaceChildren(
    metric("Observed sites", totals.sites),
    metric("Open now", tabsByOrigin.size),
    metric("Observed items", storedItems),
    metric("Cookies API", catalog.cookieScan?.total ?? 0)
  );

  const scan = catalog.cookieScan ?? {};
  if (scan.status === "ok") {
    elements["cookie-status"].textContent = scan.total === 0
      ? `Safari exposed 0 cookies globally · probed ${relativeTime(scan.scannedAt)}. This does not prove the cookie jar is empty.`
      : `Safari exposed ${scan.total} cookies across ${scan.domains.length} domains · probed ${relativeTime(scan.scannedAt)}.`;
  } else if (scan.status === "error") {
    elements["cookie-status"].textContent = `Probe failed with ${scan.error}.`;
  } else {
    elements["cookie-status"].textContent = "Not probed yet.";
  }
  elements["cookie-domains"].replaceChildren(...(scan.domains ?? []).slice(0, 20).map(({ domain, count }) => {
    const tag = document.createElement("span");
    tag.textContent = `${domain} · ${count}`;
    return tag;
  }));

  const sites = Object.values(catalog.sites ?? {})
    .sort((left, right) => String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)));
  elements["site-list"].replaceChildren(...sites.map(renderSite));
  elements["empty-state"].hidden = sites.length !== 0;
  elements["site-list"].hidden = sites.length === 0;
  updateBulkActions();
}

async function loadOpenTabs() {
  const tabs = await api.tabs.query({});
  tabsByOrigin = new Map();
  for (const tab of tabs) {
    const origin = httpOrigin(tab.url);
    if (origin && !tabsByOrigin.has(origin)) tabsByOrigin.set(origin, tab);
  }
}

async function loadCatalog() {
  catalog = await api.runtime.sendMessage({ type: "tidy.catalog.get" });
  await loadOpenTabs();
  render();
}

function showError(error) {
  elements.error.textContent = error instanceof Error ? error.message : String(error);
  elements.error.hidden = false;
}

function showResult(message) {
  elements.result.textContent = message;
  elements.result.hidden = false;
  elements.error.hidden = true;
}

async function ensureInspector(tabId) {
  let lastError;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const inspection = await api.tabs.sendMessage(tabId, { type: "tidy.inspect" });
      if (inspection?.origin) return inspection;
    } catch (error) {
      lastError = error;
    }
    try {
      await api.scripting.executeScript({
        target: { tabId },
        files: ["content/inspector.js"]
      });
      const inspection = await api.tabs.sendMessage(tabId, { type: "tidy.inspect" });
      if (inspection?.origin) return inspection;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw lastError ?? new Error("Safari did not load the selected site.");
}

async function removeAPICookies(mode, tab, cookies, selection) {
  const selectedNames = new Set(selection.cookieNames);
  const selected = cookies.filter((cookie) => mode === "all" || selectedNames.has(cookie.name));
  const result = { attempted: selected.length, removed: 0, failures: [] };
  for (const cookie of selected) {
    try {
      const details = { url: cookieRemovalURL(cookie, tab.url), name: cookie.name };
      if (cookie.storeId) details.storeId = cookie.storeId;
      if (await api.cookies.remove(details)) result.removed += 1;
      else result.failures.push({ type: `cookie:${cookie.name}`, code: "NotRemoved" });
    } catch (error) {
      result.failures.push({
        type: `cookie:${cookie.name}`,
        code: error instanceof Error ? error.name || "Error" : "Error"
      });
    }
  }
  return result;
}

async function cleanOrigin(origin, mode) {
  const tab = await api.tabs.create({ url: origin, active: true });
  try {
    const inspection = await ensureInspector(tab.id);
    const rawCookies = await api.cookies.getAll({ url: tab.url });
    const apiCookies = rawCookies.map((cookie) => classifyCookie(
      { ...cookie, source: "cookies-api" },
      { origin }
    ));
    const apiCookieNames = new Set(apiCookies.map(({ name }) => name));
    const fallbackCookies = (inspection.scriptVisibleCookieNames ?? [])
      .filter((name) => !apiCookieNames.has(name))
      .map((name) => classifyCookie({
        name,
        domain: new URL(origin).hostname,
        path: "/",
        secure: new URL(origin).protocol === "https:",
        httpOnly: false,
        source: "document.cookie"
      }, { origin }));
    const selection = removableSelection(inspection, [...apiCookies, ...fallbackCookies]);
    const cookieResult = await removeAPICookies(mode, tab, apiCookies, selection);
    const storage = await api.tabs.sendMessage(tab.id, {
      type: "tidy.clean",
      mode,
      selection,
      cookieNamesExposedByAPI: apiCookies.map(({ name }) => name)
    });
    if (!storage?.removedCounts) throw new Error("Safari did not return a cleanup result.");
    const removedStorage = Object.values(storage.removedCounts)
      .reduce((sum, count) => sum + count, 0);
    const removedCookies = cookieResult.removed + storage.scriptVisibleCookies.removed;
    const failureCount = cookieResult.failures.length + storage.failures.length;
    await api.runtime.sendMessage({
      type: "tidy.cleanup.record",
      origin,
      cleanup: { mode, removedStorage, removedCookies, failureCount }
    });
    const refreshed = await api.tabs.sendMessage(tab.id, { type: "tidy.inspect" });
    await api.runtime.sendMessage({
      type: "tidy.observe",
      snapshot: catalogTools.summaryFromInspection(refreshed)
    });
    return { origin, status: "cleaned", removedStorage, removedCookies, failureCount };
  } finally {
    await api.tabs.remove(tab.id).catch(() => undefined);
  }
}

async function cleanOrigins(origins, mode) {
  elements.confirmation.hidden = true;
  elements.result.hidden = true;
  const results = [];
  const [dashboardTab] = await api.tabs.query({ active: true, currentWindow: true });
  try {
    for (const origin of origins) {
      results.push(await cleanOrigin(origin, mode));
    }
  } finally {
    if (dashboardTab?.id) {
      await api.tabs.update(dashboardTab.id, { active: true });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  const cleaned = results.filter(({ status }) => status === "cleaned");
  const removedStorage = cleaned.reduce((sum, result) => sum + result.removedStorage, 0);
  const removedCookies = cleaned.reduce((sum, result) => sum + result.removedCookies, 0);
  const failures = cleaned.reduce((sum, result) => sum + result.failureCount, 0);
  showResult(
    `Cleaned ${cleaned.length} site(s): removed ${removedStorage} storage item(s) and ${removedCookies} cookie(s). `
    + `Failures: ${failures}.`
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  await loadCatalog();
}

function showConfirmation(origins) {
  pendingCleanup = { origins, mode: "all" };
  elements["confirmation-title"].textContent = `Forget ${origins.length} selected site${origins.length === 1 ? "" : "s"}?`;
  elements["confirmation-copy"].textContent = "Tidy will briefly open each selected origin, remove accessible cookies and storage, close it, and return here.";
  elements.confirmation.hidden = false;
}

elements["refresh-open"].addEventListener("click", async () => {
  try {
    elements.result.hidden = true;
    await loadOpenTabs();
    let refreshed = 0;
    for (const tab of tabsByOrigin.values()) {
      try {
        await ensureInspector(tab.id);
        const inspection = await api.tabs.sendMessage(tab.id, { type: "tidy.inspect" });
        await api.runtime.sendMessage({
          type: "tidy.observe",
          snapshot: catalogTools.summaryFromInspection(inspection)
        });
        refreshed += 1;
      } catch {
        // Safari internal pages and pages that changed during the scan are skipped.
      }
    }
    await loadCatalog();
    showResult(`Refreshed ${refreshed} open HTTP(S) site(s).`);
  } catch (error) {
    showError(error);
  }
});

elements["scan-cookies"].addEventListener("click", async () => {
  try {
    catalog = await api.runtime.sendMessage({ type: "tidy.cookies.scan" });
    render();
  } catch (error) {
    showError(error);
  }
});

elements["select-all"].addEventListener("click", () => {
  const checkboxes = [...elements["site-list"].querySelectorAll('input[type="checkbox"]')];
  const shouldSelect = checkboxes.some(({ checked }) => !checked);
  for (const checkbox of checkboxes) checkbox.checked = shouldSelect;
  updateBulkActions();
});

elements["clean-trackers"].addEventListener("click", () => {
  cleanOrigins(selectedOrigins(), "trackers").catch(showError);
});
elements["forget-selected"].addEventListener("click", () => showConfirmation(selectedOrigins()));
elements["cancel-clean"].addEventListener("click", () => {
  pendingCleanup = undefined;
  elements.confirmation.hidden = true;
});
elements["confirm-clean"].addEventListener("click", () => {
  if (!pendingCleanup) return;
  const { origins, mode } = pendingCleanup;
  pendingCleanup = undefined;
  cleanOrigins(origins, mode).catch(showError);
});

api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[catalogTools.STORAGE_KEY]?.newValue) return;
  catalog = changes[catalogTools.STORAGE_KEY].newValue;
  render();
});

loadCatalog().catch(showError);
