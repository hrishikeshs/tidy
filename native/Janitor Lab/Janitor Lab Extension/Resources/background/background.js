const api = globalThis.browser ?? globalThis.chrome;

api.runtime.onInstalled.addListener(async () => {
  const current = await api.storage.local.get("janitorLab");
  if (current.janitorLab) return;

  await api.storage.local.set({
    janitorLab: {
      schemaVersion: 1,
      createdAt: new Date().toISOString()
    }
  });
});

api.runtime.onMessage.addListener((message) => {
  if (message?.type !== "janitor.ping") return undefined;
  return Promise.resolve({ ok: true, manifestVersion: 3 });
});
