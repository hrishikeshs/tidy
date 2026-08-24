(() => {
  if (globalThis.__janitorLabInspectorInstalled) return;
  globalThis.__janitorLabInspectorInstalled = true;

  const api = globalThis.browser ?? globalThis.chrome;

  function failure(type, error) {
    return {
      type,
      code: error instanceof Error ? error.name || "Error" : "Error"
    };
  }

  function scriptVisibleCookieNames() {
    return document.cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split("=", 1)[0])
      .filter(Boolean)
      .sort();
  }

  async function inspectStorage() {
    const result = {
      origin: location.origin,
      localStorageKeys: [],
      sessionStorageKeys: [],
      indexedDBNames: [],
      cacheNames: [],
      serviceWorkerScopes: [],
      scriptVisibleCookieNames: [],
      inaccessibleTypes: [],
      failures: []
    };

    try {
      result.scriptVisibleCookieNames = scriptVisibleCookieNames();
    } catch (error) {
      result.inaccessibleTypes.push("scriptVisibleCookies");
      result.failures.push(failure("scriptVisibleCookies", error));
    }

    try {
      result.localStorageKeys = Object.keys(localStorage).sort();
    } catch (error) {
      result.inaccessibleTypes.push("localStorage");
      result.failures.push(failure("localStorage", error));
    }

    try {
      result.sessionStorageKeys = Object.keys(sessionStorage).sort();
    } catch (error) {
      result.inaccessibleTypes.push("sessionStorage");
      result.failures.push(failure("sessionStorage", error));
    }

    if (typeof indexedDB?.databases === "function") {
      try {
        const databases = await indexedDB.databases();
        result.indexedDBNames = databases
          .map((database) => database.name)
          .filter(Boolean)
          .sort();
      } catch (error) {
        result.inaccessibleTypes.push("indexedDB");
        result.failures.push(failure("indexedDB", error));
      }
    } else {
      result.inaccessibleTypes.push("indexedDB.databases");
    }

    if (globalThis.caches) {
      try {
        result.cacheNames = (await caches.keys()).sort();
      } catch (error) {
        result.inaccessibleTypes.push("cacheStorage");
        result.failures.push(failure("cacheStorage", error));
      }
    } else {
      result.inaccessibleTypes.push("cacheStorage");
    }

    if (navigator.serviceWorker) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        result.serviceWorkerScopes = registrations.map(({ scope }) => scope).sort();
      } catch (error) {
        result.inaccessibleTypes.push("serviceWorkers");
        result.failures.push(failure("serviceWorkers", error));
      }
    } else {
      result.inaccessibleTypes.push("serviceWorkers");
    }

    return result;
  }

  function deleteDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      const timer = setTimeout(() => reject(new DOMException("Delete timed out", "TimeoutError")), 2000);
      request.onsuccess = () => {
        clearTimeout(timer);
        resolve(true);
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error ?? new DOMException("Delete failed", "UnknownError"));
      };
      request.onblocked = () => {
        clearTimeout(timer);
        reject(new DOMException("Delete blocked by an open connection", "InvalidStateError"));
      };
    });
  }

  async function cleanStorage({ mode, definition, cookieNamesExposedByAPI = [] }) {
    const full = mode === "all";
    const matchesPrefix = (name) =>
      definition.storageKeyPrefixes.some((prefix) => name.startsWith(prefix));
    const result = {
      attemptedTypes: [],
      removedCounts: {
        localStorage: 0,
        sessionStorage: 0,
        indexedDB: 0,
        cacheStorage: 0,
        serviceWorkers: 0
      },
      scriptVisibleCookies: { attempted: 0, removed: 0 },
      inaccessibleTypes: [],
      failures: []
    };

    try {
      const apiCookieNames = new Set(cookieNamesExposedByAPI);
      const cookieNames = scriptVisibleCookieNames().filter((name) => !apiCookieNames.has(name));
      const selected = cookieNames.filter((name) => full || definition.cookieNames.includes(name));
      result.scriptVisibleCookies.attempted = selected.length;
      for (const name of selected) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
        if (!scriptVisibleCookieNames().includes(name)) {
          result.scriptVisibleCookies.removed += 1;
        } else {
          result.failures.push({ type: `scriptVisibleCookie:${name}`, code: "NotRemoved" });
        }
      }
    } catch (error) {
      result.inaccessibleTypes.push("scriptVisibleCookies");
      result.failures.push(failure("scriptVisibleCookies", error));
    }

    result.attemptedTypes.push("localStorage");
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (full || matchesPrefix(key)) {
          localStorage.removeItem(key);
          result.removedCounts.localStorage += 1;
        }
      }
    } catch (error) {
      result.inaccessibleTypes.push("localStorage");
      result.failures.push(failure("localStorage", error));
    }

    result.attemptedTypes.push("sessionStorage");
    try {
      const keys = Object.keys(sessionStorage);
      for (const key of keys) {
        if (full || matchesPrefix(key)) {
          sessionStorage.removeItem(key);
          result.removedCounts.sessionStorage += 1;
        }
      }
    } catch (error) {
      result.inaccessibleTypes.push("sessionStorage");
      result.failures.push(failure("sessionStorage", error));
    }

    result.attemptedTypes.push("indexedDB");
    if (typeof indexedDB?.databases === "function") {
      try {
        const databases = await indexedDB.databases();
        const names = databases.map(({ name }) => name).filter(Boolean);
        for (const name of names) {
          if (full || definition.indexedDBNames.includes(name)) {
            try {
              await deleteDatabase(name);
              result.removedCounts.indexedDB += 1;
            } catch (error) {
              result.failures.push(failure(`indexedDB:${name}`, error));
            }
          }
        }
      } catch (error) {
        result.inaccessibleTypes.push("indexedDB");
        result.failures.push(failure("indexedDB", error));
      }
    } else {
      result.inaccessibleTypes.push("indexedDB.databases");
    }

    result.attemptedTypes.push("cacheStorage");
    if (globalThis.caches) {
      try {
        const names = await caches.keys();
        for (const name of names) {
          if (full || definition.cacheNames.includes(name)) {
            if (await caches.delete(name)) result.removedCounts.cacheStorage += 1;
          }
        }
      } catch (error) {
        result.inaccessibleTypes.push("cacheStorage");
        result.failures.push(failure("cacheStorage", error));
      }
    } else {
      result.inaccessibleTypes.push("cacheStorage");
    }

    if (full) {
      result.attemptedTypes.push("serviceWorkers");
      if (navigator.serviceWorker) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            if (await registration.unregister()) result.removedCounts.serviceWorkers += 1;
          }
        } catch (error) {
          result.inaccessibleTypes.push("serviceWorkers");
          result.failures.push(failure("serviceWorkers", error));
        }
      } else {
        result.inaccessibleTypes.push("serviceWorkers");
      }
    }

    return result;
  }

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "janitor.inspect") return inspectStorage();
    if (message?.type === "janitor.clean") return cleanStorage(message);
    return undefined;
  });
})();
