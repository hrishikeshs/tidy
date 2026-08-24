import {
  FIXTURE_TRACKER_DEFINITION,
  classificationLabel,
  classifyCookie,
  classifyStorageItem,
  cookieRemovalURL,
  learnedPolicySelection,
  permissionPatternFor,
  removableSelection
} from "../shared/tracker-definitions.js";
import "../shared/catalog.js";

const api = globalThis.browser ?? globalThis.chrome;
const elements = Object.fromEntries(
  [
    "domain", "permission", "site-icon", "dashboard", "loading", "grant", "inspect",
    "learning-lab", "inventory", "recommendation", "recommendation-icon",
    "recommendation-kicker", "recommendation-title", "recommendation-copy", "site-data",
    "site-data-total", "summary", "cookie-note", "classifier-note", "learning-note",
    "details", "actions", "clean", "learning-clean", "forget", "confirmation",
    "confirmation-title", "confirmation-copy", "cancel-forget", "confirm-forget", "result",
    "result-title", "result-copy", "result-details", "result-receipt", "reload", "error"
  ]
    .map((id) => [id, document.getElementById(id)])
);

let currentTab;
let currentPattern;
let currentLearnedPolicy = null;

function itemLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function setBusy(busy) {
  document.querySelector("main").setAttribute("aria-busy", String(busy));
  for (const button of [
    elements.dashboard,
    elements.grant,
    elements.inspect,
    elements.clean,
    elements["learning-clean"],
    elements.forget,
    elements.reload
  ]) {
    if (busy) button.disabled = true;
    else if (button !== elements.clean && button !== elements["learning-clean"]) button.disabled = false;
  }
}

async function learningPolicyFor(url) {
  if (typeof api.runtime.sendNativeMessage !== "function") return null;
  const response = await api.runtime.sendNativeMessage("io.hrishi.Janitor-Lab", {
    action: "learningPolicy",
    origin: url.origin,
    route: url.pathname || "/"
  });
  return response?.available ? response.policy : null;
}

function showError(error) {
  elements.loading.hidden = true;
  setBusy(false);
  elements.error.textContent = error instanceof Error ? error.message : String(error);
  elements.error.hidden = false;
}

function clearMessages() {
  elements.error.hidden = true;
  elements.result.hidden = true;
}

function metric(label, value) {
  const node = document.createElement("div");
  node.className = "metric";
  const caption = document.createElement("span");
  caption.textContent = label;
  const count = document.createElement("strong");
  count.textContent = String(value);
  node.append(caption, count);
  return node;
}

function renderNames(title, entries) {
  const wrapper = document.createElement("section");
  const heading = document.createElement("strong");
  heading.textContent = title;
  wrapper.append(heading);

  const list = document.createElement("ul");
  for (const entry of entries) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${entry.name} — ${classificationLabel(entry)}`;
    const rationale = document.createElement("small");
    rationale.textContent = `${entry.reason} Source: ${entry.source}${entry.controller ? ` (${entry.controller})` : ""}.`;
    item.append(label, rationale);
    list.append(item);
  }
  if (entries.length === 0) {
    const item = document.createElement("li");
    item.textContent = "None observed";
    list.append(item);
  }
  wrapper.append(list);
  return wrapper;
}

async function hasPermission() {
  const [allSites, currentSite] = await Promise.all([
    api.permissions.contains({ origins: ["<all_urls>"] }),
    api.permissions.contains({ origins: [currentPattern] })
  ]);
  return { allSites, currentSite: allSites || currentSite };
}

async function injectInspector() {
  await api.scripting.executeScript({
    target: { tabId: currentTab.id },
    files: ["content/inspector.js"]
  });
}

async function accessibleCookies() {
  const cookies = await api.cookies.getAll({ url: currentTab.url });
  return cookies.map((cookie) => classifyCookie(
    { ...cookie, source: "cookies-api" },
    { origin: currentTab.url }
  ));
}

function combinedCookies(storage, apiCookies) {
  const apiCookieNames = new Set(apiCookies.map(({ name }) => name));
  const fallbackCookies = storage.scriptVisibleCookieNames
    .filter((name) => !apiCookieNames.has(name))
    .map((name) => classifyCookie({
      name,
      domain: new URL(currentTab.url).hostname,
      path: "/",
      secure: new URL(currentTab.url).protocol === "https:",
      httpOnly: false,
      source: "document.cookie"
    }, { origin: currentTab.url }));
  return {
    fallbackCookies,
    cookies: [...apiCookies, ...fallbackCookies].sort((a, b) => a.name.localeCompare(b.name))
  };
}

function classifiedNames(type, names, origin) {
  return names.map((name) => classifyStorageItem(type, name, { origin }));
}

async function inspect({ preserveMessages = false, showLoading = true } = {}) {
  if (!preserveMessages) clearMessages();
  if (showLoading) elements.loading.hidden = false;
  setBusy(true);
  try {
    await injectInspector();
    const [storage, apiCookies] = await Promise.all([
      api.tabs.sendMessage(currentTab.id, { type: "janitor.inspect" }),
      accessibleCookies()
    ]);
    await api.runtime.sendMessage({
      type: "tidy.observe",
      snapshot: globalThis.TidyCatalog.summaryFromInspection(storage)
    });
    const { fallbackCookies, cookies } = combinedCookies(storage, apiCookies);
    const classified = {
      localStorage: classifiedNames("localStorage", storage.localStorageKeys, storage.origin),
      sessionStorage: classifiedNames("sessionStorage", storage.sessionStorageKeys, storage.origin),
      indexedDB: classifiedNames("indexedDB", storage.indexedDBNames, storage.origin),
      cacheStorage: classifiedNames("cacheStorage", storage.cacheNames, storage.origin),
      serviceWorkers: classifiedNames("serviceWorker", storage.serviceWorkerScopes, storage.origin)
    };
    const removableCount = [cookies, ...Object.values(classified)]
      .flat()
      .filter(({ safeToRemove }) => safeToRemove)
      .length;
    try {
      currentLearnedPolicy = await learningPolicyFor(new URL(currentTab.url));
    } catch {
      currentLearnedPolicy = null;
    }
    const learnedSelection = learnedPolicySelection(storage, cookies, currentLearnedPolicy);
    const learnedCount = Object.values(learnedSelection).flat().length;

    elements["cookie-note"].hidden = fallbackCookies.length === 0;
    elements["cookie-note"].textContent = fallbackCookies.length === 0
      ? ""
      : `${itemLabel(fallbackCookies.length, "script-visible cookie name")} could not be read through Safari's Cookies API. HttpOnly cookies may still be inaccessible.`;
    elements["classifier-note"].textContent = removableCount === 0
      ? "Tidy leaves low-confidence guesses alone."
      : `${itemLabel(removableCount, "item")} matched evidence-backed tracking rules. Low-confidence guesses stay put.`;
    elements["learning-note"].hidden = !currentLearnedPolicy;
    elements["learning-note"].textContent = currentLearnedPolicy
      ? `Learning Clean previously tested this route: ${itemLabel(currentLearnedPolicy.required.length, "required item")} and ${itemLabel(currentLearnedPolicy.removable.length, "removable item")}. New or untested state stays put.`
      : "";

    elements.clean.hidden = removableCount === 0;
    elements.clean.disabled = removableCount === 0;
    elements.clean.className = currentLearnedPolicy && learnedCount > 0 ? "secondary" : "primary";
    elements.clean.textContent = `Remove ${itemLabel(removableCount, "tracking item")}`;
    elements["learning-clean"].hidden = !currentLearnedPolicy || learnedCount === 0;
    elements["learning-clean"].disabled = learnedCount === 0;
    elements["learning-clean"].textContent = `Remove ${itemLabel(learnedCount, "tested item")}`;

    if (currentLearnedPolicy && learnedCount > 0) {
      elements.recommendation.dataset.state = "safe";
      elements["recommendation-icon"].textContent = "✓";
      elements["recommendation-kicker"].textContent = "Tested on this page";
      elements["recommendation-title"].textContent = "Use the proven cleanup";
      elements["recommendation-copy"].textContent = `${itemLabel(learnedCount, "item")} can be removed using a recent Learning Clean test. Required and newly observed data stays.`;
    } else if (removableCount > 0) {
      elements.recommendation.dataset.state = "safe";
      elements["recommendation-icon"].textContent = "✓";
      elements["recommendation-kicker"].textContent = "Tidy recommendation";
      elements["recommendation-title"].textContent = "Clean up this site";
      elements["recommendation-copy"].textContent = `Remove ${itemLabel(removableCount, "item")} linked to tracking. Sign-in, security, preferences, and anything uncertain stay. This is a good first step for pop-ups, banners, or stale page behavior.`;
    } else {
      elements.recommendation.dataset.state = "caution";
      elements["recommendation-icon"].textContent = "—";
      elements["recommendation-kicker"].textContent = "No low-risk cleanup";
      elements["recommendation-title"].textContent = "Nothing safe to remove";
      elements["recommendation-copy"].textContent = "Tidy did not find anything with enough evidence for automatic cleanup. You can inspect the site data or reset this site completely.";
    }

    const categories = [
      ["Cookies", cookies.length],
      ["Local storage", storage.localStorageKeys.length],
      ["Session storage", storage.sessionStorageKeys.length],
      ["IndexedDB", storage.indexedDBNames.length],
      ["Caches", storage.cacheNames.length],
      ["Service workers", storage.serviceWorkerScopes.length]
    ];
    const totalItems = categories.reduce((sum, [, count]) => sum + count, 0);
    elements["site-data-total"].textContent = `${itemLabel(totalItems, "item")} across ${itemLabel(categories.length, "storage type")}`;
    elements.summary.replaceChildren(...categories.map(([label, value]) => metric(label, value)));

    elements.details.replaceChildren(
      renderNames("Cookies", cookies),
      renderNames("localStorage", classified.localStorage),
      renderNames("sessionStorage", classified.sessionStorage),
      renderNames("IndexedDB", classified.indexedDB),
      renderNames("Cache Storage", classified.cacheStorage),
      renderNames("Service workers", classified.serviceWorkers)
    );

    elements.inventory.hidden = false;
    elements.actions.hidden = false;
  } finally {
    elements.loading.hidden = true;
    setBusy(false);
  }
}

async function removeCookies(mode, cookies, selection) {
  const selectedNames = new Set(selection.cookieNames);
  const selected = cookies.filter((cookie) => mode === "all" || selectedNames.has(cookie.name));
  const result = { attempted: selected.length, removed: 0, failures: [] };

  for (const cookie of selected) {
    try {
      const details = {
        url: cookieRemovalURL(cookie, currentTab.url),
        name: cookie.name
      };
      if (cookie.storeId) details.storeId = cookie.storeId;
      const removed = await api.cookies.remove(details);
      if (removed) result.removed += 1;
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

async function clean(mode) {
  clearMessages();
  setBusy(true);
  try {
    await injectInspector();
    const apiCookies = await accessibleCookies();
    const inspection = await api.tabs.sendMessage(currentTab.id, { type: "tidy.inspect" });
    const { cookies: allCookies } = combinedCookies(inspection, apiCookies);
    const selection = mode === "learned"
      ? learnedPolicySelection(inspection, allCookies, currentLearnedPolicy)
      : removableSelection(inspection, allCookies);
    const [storage, cookies] = await Promise.all([
      api.tabs.sendMessage(currentTab.id, {
        type: "janitor.clean",
        mode,
        definition: FIXTURE_TRACKER_DEFINITION,
        selection,
        cookieNamesExposedByAPI: apiCookies.map(({ name }) => name)
      }),
      removeCookies(mode, apiCookies, selection)
    ]);

    const removedStorage = Object.values(storage.removedCounts).reduce((sum, value) => sum + value, 0);
    const failures = [...storage.failures, ...cookies.failures];
    const attemptedCookies = cookies.attempted + storage.scriptVisibleCookies.attempted;
    const removedCookies = cookies.removed + storage.scriptVisibleCookies.removed;
    const removedTotal = removedStorage + removedCookies;
    const hostname = new URL(currentTab.url).hostname;
    elements["result-title"].textContent = mode === "all"
      ? "Site data reset"
      : removedTotal === 0 ? "Nothing changed" : "Cleanup complete";
    elements["result-copy"].textContent = mode === "all"
      ? `${itemLabel(removedTotal, "accessible item")} removed from ${hostname}. Reload to let the page start fresh.`
      : removedTotal === 0
        ? "The matching items were already gone. Reload if the page still shows stale content."
        : `${itemLabel(removedTotal, "tracking item")} removed. Sign-in, security, preferences, and uncertain data stayed. Reload to update the page.`;
    elements["result-receipt"].textContent = [
      `Attempted: ${storage.attemptedTypes.length} storage categories and ${attemptedCookies} cookies.`,
      `Removed: ${removedStorage} storage items and ${removedCookies} cookies.`,
      `Inaccessible: ${storage.inaccessibleTypes.join(", ") || "none reported"}.`,
      `Failed: ${failures.length}.`
    ].join(" ");
    elements["result-details"].open = false;
    await inspect({ preserveMessages: true, showLoading: false });
    elements.result.hidden = false;
    elements.result.scrollIntoView({ block: "nearest" });
  } finally {
    setBusy(false);
  }
}

async function initialize() {
  [currentTab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!currentTab?.url) throw new Error("Safari did not expose an active page.");

  const url = new URL(currentTab.url);
  elements.domain.textContent = url.hostname || url.protocol;
  elements["site-icon"].textContent = (url.hostname || url.protocol).replace(/^www\./, "").charAt(0) || "—";
  const learningURL = new URL("tidy://learn");
  learningURL.searchParams.set("url", currentTab.url);
  elements["learning-lab"].href = learningURL.href;
  currentPattern = permissionPatternFor(currentTab.url);

  const access = await hasPermission();
  elements.permission.textContent = access.allSites
    ? "Ready. Checked only when you open Tidy."
    : access.currentSite
      ? "Ready for this website."
      : "Website access is needed to inspect and clean this site.";
  elements.grant.hidden = access.currentSite;
  elements.inspect.hidden = true;
  elements.loading.hidden = true;
  if (access.currentSite) await inspect();
}

elements.dashboard.addEventListener("click", () => {
  api.tabs.create({ url: api.runtime.getURL("dashboard/dashboard.html") }).catch(showError);
});

elements.grant.addEventListener("click", async () => {
  clearMessages();
  try {
    const granted = await api.permissions.request({ origins: ["<all_urls>"] });
    if (!granted) throw new Error("Safari did not grant access to all websites.");
    elements.permission.textContent = "Ready. Checked only when you open Tidy.";
    elements.grant.hidden = true;
    await inspect();
  } catch (error) {
    showError(error);
  }
});

elements.inspect.addEventListener("click", () => inspect().catch(showError));
elements.clean.addEventListener("click", () => clean("trackers").catch(showError));
elements["learning-clean"].addEventListener("click", () => clean("learned").catch(showError));
elements.forget.addEventListener("click", () => {
  clearMessages();
  const hostname = new URL(currentTab.url).hostname;
  elements["confirmation-title"].textContent = `Reset ${hostname}?`;
  elements["confirmation-copy"].textContent = "This removes accessible cookies and site data. You may be signed out, and saved preferences may be lost.";
  elements.inventory.hidden = true;
  elements.confirmation.hidden = false;
});
elements["cancel-forget"].addEventListener("click", () => {
  elements.confirmation.hidden = true;
  elements.inventory.hidden = false;
});
elements["confirm-forget"].addEventListener("click", async () => {
  elements.confirmation.hidden = true;
  elements.inventory.hidden = false;
  try {
    await clean("all");
  } catch (error) {
    showError(error);
  }
});
elements.reload.addEventListener("click", async () => {
  try {
    await api.tabs.reload(currentTab.id);
    window.close();
  } catch (error) {
    showError(error);
  }
});

initialize().catch(showError);
