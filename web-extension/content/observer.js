(() => {
  if (globalThis.__tidyObserverInstalled) return;
  globalThis.__tidyObserverInstalled = true;

  const api = globalThis.browser ?? globalThis.chrome;
  let captureInFlight;

  async function capture() {
    if (captureInFlight) return captureInFlight;
    captureInFlight = (async () => {
      const inspection = await globalThis.__tidyInspectStorage();
      const snapshot = globalThis.TidyCatalog.summaryFromInspection(inspection);
      await api.runtime.sendMessage({ type: "tidy.observe", snapshot });
      return snapshot;
    })().finally(() => {
      captureInFlight = undefined;
    });
    return captureInFlight;
  }

  setTimeout(() => capture().catch(() => undefined), 750);
  setTimeout(() => capture().catch(() => undefined), 2500);
  globalThis.addEventListener("pagehide", () => capture().catch(() => undefined));
})();
