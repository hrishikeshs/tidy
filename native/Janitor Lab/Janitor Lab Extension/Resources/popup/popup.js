import {
  FIXTURE_TRACKER_DEFINITION,
  classifyCookie,
  cookieRemovalURL,
  isKnownFixtureCookie,
  permissionPatternFor
} from "../shared/tracker-definitions.js";

const api = globalThis.browser ?? globalThis.chrome;
const elements = Object.fromEntries(
  ["domain", "permission", "grant", "inspect", "inventory", "summary", "cookie-note", "details", "actions", "clean", "forget", "confirmation", "cancel-forget", "confirm-forget", "result", "error"]
    .map((id) => [id, document.getElementById(id)])
);

let currentTab;
let currentPattern;

function showError(error) {
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
  const count = document.createElement("strong");
  count.textContent = String(value);
  const caption = document.createElement("span");
  caption.textContent = label;
  node.append(count, caption);
  return node;
}

function renderNames(title, entries, classify = () => "unknown") {
  const wrapper = document.createElement("section");
  const heading = document.createElement("strong");
  heading.textContent = title;
  wrapper.append(heading);

  const list = document.createElement("ul");
  for (const entry of entries) {
    const item = document.createElement("li");
    const name = typeof entry === "string" ? entry : entry.name;
    item.textContent = `${name} — ${classify(entry)}`;
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
  return api.permissions.contains({ origins: [currentPattern] });
}

async function injectInspector() {
  await api.scripting.executeScript({
    target: { tabId: currentTab.id },
    files: ["content/inspector.js"]
  });
}

async function accessibleCookies() {
  const cookies = await api.cookies.getAll({ url: currentTab.url });
  return cookies.map((cookie) => classifyCookie({ ...cookie, source: "cookies-api" }));
}

async function inspect({ preserveMessages = false } = {}) {
  if (!preserveMessages) clearMessages();
  await injectInspector();
  const [storage, apiCookies] = await Promise.all([
    api.tabs.sendMessage(currentTab.id, { type: "janitor.inspect" }),
    accessibleCookies()
  ]);
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
    }));
  const cookies = [...apiCookies, ...fallbackCookies].sort((a, b) => a.name.localeCompare(b.name));

  elements["cookie-note"].hidden = fallbackCookies.length === 0;
  elements["cookie-note"].textContent = fallbackCookies.length === 0
    ? ""
    : `Showing ${fallbackCookies.length} script-visible cookie name(s) that Safari's Cookies API did not expose. HttpOnly cookies may still be inaccessible.`;

  const categories = [
    ["Cookies", cookies.length],
    ["Local storage", storage.localStorageKeys.length],
    ["Session storage", storage.sessionStorageKeys.length],
    ["IndexedDB", storage.indexedDBNames.length],
    ["Caches", storage.cacheNames.length],
    ["Service workers", storage.serviceWorkerScopes.length]
  ];
  elements.summary.replaceChildren(...categories.map(([label, value]) => metric(label, value)));

  elements.details.replaceChildren(
    renderNames("Cookies", cookies, ({ classification }) => classification),
    renderNames("localStorage", storage.localStorageKeys, (key) =>
      key.startsWith("_janitor_tracker") ? "known-fixture-tracker" : "unknown"
    ),
    renderNames("sessionStorage", storage.sessionStorageKeys, (key) =>
      key.startsWith("_janitor_tracker") ? "known-fixture-tracker" : "unknown"
    ),
    renderNames("IndexedDB", storage.indexedDBNames),
    renderNames("Cache Storage", storage.cacheNames),
    renderNames("Service workers", storage.serviceWorkerScopes)
  );

  elements.inventory.hidden = false;
  elements.actions.hidden = false;
}

async function removeCookies(mode, cookies) {
  const selected = cookies.filter((cookie) => mode === "all" || isKnownFixtureCookie(cookie.name));
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
  const apiCookies = await accessibleCookies();
  await injectInspector();
  const [storage, cookies] = await Promise.all([
    api.tabs.sendMessage(currentTab.id, {
      type: "janitor.clean",
      mode,
      definition: FIXTURE_TRACKER_DEFINITION,
      cookieNamesExposedByAPI: apiCookies.map(({ name }) => name)
    }),
    removeCookies(mode, apiCookies)
  ]);

  const removedStorage = Object.values(storage.removedCounts).reduce((sum, value) => sum + value, 0);
  const failures = [...storage.failures, ...cookies.failures];
  const attemptedCookies = cookies.attempted + storage.scriptVisibleCookies.attempted;
  const removedCookies = cookies.removed + storage.scriptVisibleCookies.removed;
  elements.result.textContent = [
    `Attempted: ${storage.attemptedTypes.length} storage categories and ${attemptedCookies} cookies.`,
    `Removed: ${removedStorage} storage items and ${removedCookies} cookies.`,
    `Inaccessible: ${storage.inaccessibleTypes.join(", ") || "none reported"}.`,
    `Failed: ${failures.length}.`
  ].join(" ");
  elements.result.hidden = false;
  await inspect({ preserveMessages: true });
}

async function initialize() {
  [currentTab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!currentTab?.url) throw new Error("Safari did not expose an active page.");

  const url = new URL(currentTab.url);
  elements.domain.textContent = url.hostname || url.protocol;
  currentPattern = permissionPatternFor(currentTab.url);

  const allowed = await hasPermission();
  elements.permission.textContent = allowed
    ? "Site access granted. Nothing is inspected until you ask."
    : "Shield only. Page contents are not accessible.";
  elements.grant.hidden = allowed;
  elements.inspect.hidden = !allowed;
}

elements.grant.addEventListener("click", async () => {
  clearMessages();
  try {
    const granted = await api.permissions.request({ origins: [currentPattern] });
    if (!granted) throw new Error("Safari did not grant access to this site.");
    elements.permission.textContent = "Site access granted. Nothing is inspected until you ask.";
    elements.grant.hidden = true;
    elements.inspect.hidden = false;
    await inspect();
  } catch (error) {
    showError(error);
  }
});

elements.inspect.addEventListener("click", () => inspect().catch(showError));
elements.clean.addEventListener("click", () => clean("trackers").catch(showError));
elements.forget.addEventListener("click", () => {
  clearMessages();
  elements.confirmation.hidden = false;
});
elements["cancel-forget"].addEventListener("click", () => {
  elements.confirmation.hidden = true;
});
elements["confirm-forget"].addEventListener("click", async () => {
  elements.confirmation.hidden = true;
  try {
    await clean("all");
  } catch (error) {
    showError(error);
  }
});

initialize().catch(showError);
