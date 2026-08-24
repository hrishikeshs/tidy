import http from "node:http";

const FIRST_PARTY_PORT = 8765;
const TRACKER_PORT = 8766;
let trackerRequests = 0;
let pageRequests = 0;

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Janitor Lab Fixture</title>
    <style>
      :root { color-scheme: light dark; font: 17px/1.45 system-ui; }
      body { margin: 0 auto; max-width: 720px; padding: 28px 20px; }
      h1 { letter-spacing: -.03em; }
      .card { border: 1px solid #8885; border-radius: 14px; padding: 16px; margin: 14px 0; }
      code, pre { font-family: ui-monospace, monospace; font-size: 13px; }
      button { font: inherit; padding: 10px 14px; border-radius: 10px; border: 0; background: #2563eb; color: white; }
      .ok { color: #16a34a; }
    </style>
  </head>
  <body>
    <p>JANITOR LAB · CONTROLLED ORIGIN</p>
    <h1>Storage and blocking fixture</h1>
    <p>This page creates synthetic functional and tracker-like state. None of the names belong to a real tracker.</p>
    <div class="card">
      <strong>Seed status</strong>
      <pre id="status">Seeding…</pre>
      <button id="reseed">Seed again</button>
    </div>
    <div class="card">
      <strong>Controlled cross-origin request</strong>
      <p>An image request to <code>127.0.0.1:8766/pixel.gif</code> appears below only when the DNR fixture rule does not block it.</p>
      <img id="tracker-pixel" src="http://127.0.0.1:8766/pixel.gif?fixture=janitor" alt="tracker request loaded" width="1" height="1">
      <p id="pixel-status">Waiting for the request outcome…</p>
    </div>
    <script>
      async function openDatabase(name) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(name, 1);
          request.onupgradeneeded = () => request.result.createObjectStore("records");
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
          request.onerror = () => reject(request.error);
        });
      }

      async function deleteDatabase(name) {
        return new Promise((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      }

      async function resetAccessibleState() {
        localStorage.clear();
        sessionStorage.clear();
        if (typeof indexedDB.databases === "function") {
          const databases = await indexedDB.databases();
          await Promise.all(databases.map(({ name }) => name ? deleteDatabase(name) : undefined));
        }
        await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
        if ("serviceWorker" in navigator) {
          await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) => registration.unregister()));
        }
      }

      async function seed() {
        localStorage.setItem("janitor_login_preference", "functional-value");
        localStorage.setItem("_janitor_tracker_id", "tracker-value");
        sessionStorage.setItem("janitor_draft", "functional-value");
        sessionStorage.setItem("_janitor_tracker_session", "tracker-value");
        await openDatabase("janitor-functional-db");
        await openDatabase("janitor-tracker-db");
        const functionalCache = await caches.open("janitor-functional-cache");
        await functionalCache.put("/functional-cache-entry", new Response("functional-value"));
        const trackerCache = await caches.open("janitor-tracker-cache");
        await trackerCache.put("/tracker-cache-entry", new Response("tracker-value"));
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register("/service-worker.js");
        }
        const cookieResponse = await fetch("/cookie-names");
        const { names } = await cookieResponse.json();
        document.querySelector("#status").textContent = [
          "localStorage: " + Object.keys(localStorage).join(", "),
          "sessionStorage: " + Object.keys(sessionStorage).join(", "),
          "cookies sent to server: " + names.join(", "),
          "IndexedDB: janitor-functional-db, janitor-tracker-db",
          "Cache Storage: janitor-functional-cache, janitor-tracker-cache",
          "Service worker: registration attempted"
        ].join("\\n");
        document.querySelector("#status").classList.add("ok");
      }

      const pixel = document.querySelector("#tracker-pixel");
      pixel.addEventListener("load", () => {
        document.querySelector("#pixel-status").textContent = "Loaded — fixture rule did not block this request.";
      });
      pixel.addEventListener("error", () => {
        document.querySelector("#pixel-status").textContent = "Blocked or failed — check the tracker server counter for proof.";
      });
      document.querySelector("#reseed").addEventListener("click", () => seed());
      const parameters = new URLSearchParams(location.search);
      const initialSeed = parameters.get("tidy_reset") === "1"
        ? resetAccessibleState().then(seed)
        : seed();
      initialSeed.catch((error) => {
        document.querySelector("#status").textContent = error.name + ": " + error.message;
      });
    </script>
  </body>
</html>`;

const learningPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tidy Learning Fixture</title>
    <style>
      :root { color-scheme: light dark; font: 17px/1.45 system-ui; }
      body { margin: 0 auto; max-width: 720px; padding: 28px 20px; }
      h1 { letter-spacing: -.03em; }
      .card { border: 1px solid #8885; border-radius: 14px; padding: 16px; margin: 14px 0; }
      .ok { color: #16a34a; }
      .bad { color: #dc2626; }
      code { font-family: ui-monospace, monospace; font-size: 13px; }
    </style>
  </head>
  <body>
    <p>TIDY · DELTA-DEBUGGING FIXTURE</p>
    <h1>Learning Clean oracle</h1>
    <p>This page needs exactly three of six seeded state items: one HttpOnly cookie, one localStorage value, and one sessionStorage value.</p>
    <div class="card" id="health-card">
      <strong>Health oracle</strong>
      <p id="learning-status">Checking required state…</p>
    </div>
    <div class="card">
      <strong>Expected learning result</strong>
      <p>Required: <code>tidy_required_auth</code>, <code>tidy_required_local</code>, <code>tidy_required_session</code></p>
      <p>Removable: <code>tidy_optional_cookie</code>, <code>tidy_optional_local</code>, <code>tidy_optional_session</code></p>
    </div>
    <script>
      const parameters = new URLSearchParams(location.search);
      if (parameters.get("tidy_seed") === "1") {
        localStorage.setItem("tidy_required_local", "local-ok");
        localStorage.setItem("tidy_optional_local", "local-noise");
        sessionStorage.setItem("tidy_required_session", "session-ok");
        sessionStorage.setItem("tidy_optional_session", "session-noise");
        history.replaceState(null, "", "/learning");
      }

      async function assess() {
        const response = await fetch("/learning-health", { cache: "no-store" });
        const server = await response.json();
        const signals = {
          cookie: server.requiredCookie === true,
          localStorage: localStorage.getItem("tidy_required_local") === "local-ok",
          sessionStorage: sessionStorage.getItem("tidy_required_session") === "session-ok"
        };
        const ok = Object.values(signals).every(Boolean);
        window.__tidyHealth = { ok, signals };
        const status = document.querySelector("#learning-status");
        status.textContent = ok
          ? "All required state present"
          : "Required state missing: " + Object.entries(signals).filter(([, value]) => !value).map(([key]) => key).join(", ");
        status.className = ok ? "ok" : "bad";
        document.querySelector("#health-card").dataset.tidyHealth = ok ? "ok" : "failed";
      }
      assess().catch(error => {
        window.__tidyHealth = { ok: false, error: error.message };
        document.querySelector("#learning-status").textContent = error.name + ": " + error.message;
      });
    </script>
  </body>
</html>`;

function cookieNames(request) {
  return (request.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim().split("=", 1)[0])
    .filter(Boolean)
    .sort();
}

const firstParty = http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${FIRST_PARTY_PORT}`);

  if (url.pathname === "/") {
    pageRequests += 1;
    response.setHeader("Set-Cookie", [
      "janitor_login=fixture-functional; Path=/; SameSite=Lax",
      "_janitor_tracker=fixture-tracker; Path=/; SameSite=Lax",
      "janitor_http_only_tracker=fixture-secret; Path=/; HttpOnly; SameSite=Lax"
    ]);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(page);
    return;
  }

  if (url.pathname === "/learning") {
    pageRequests += 1;
    if (url.searchParams.get("tidy_seed") === "1") {
      response.setHeader("Set-Cookie", [
        "tidy_required_auth=auth-ok; Path=/; HttpOnly; SameSite=Lax",
        "tidy_optional_cookie=optional-noise; Path=/; SameSite=Lax"
      ]);
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(learningPage);
    return;
  }

  if (url.pathname === "/learning-health") {
    const cookies = new Map(
      (request.headers.cookie ?? "")
        .split(";")
        .map((part) => part.trim().split("="))
        .filter(([name]) => name)
        .map(([name, ...value]) => [name, value.join("=")])
    );
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ requiredCookie: cookies.get("tidy_required_auth") === "auth-ok" }));
    return;
  }

  if (url.pathname === "/status") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ pageRequests }));
    return;
  }

  if (url.pathname === "/reset" && request.method === "POST") {
    pageRequests = 0;
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ pageRequests }));
    return;
  }

  if (url.pathname === "/cookie-names") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ names: cookieNames(request) }));
    return;
  }

  if (url.pathname === "/service-worker.js") {
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/"
    });
    response.end("self.addEventListener('fetch', () => {});");
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

const tracker = http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${TRACKER_PORT}`);
  if (url.pathname === "/pixel.gif") {
    trackerRequests += 1;
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Set-Cookie", "_janitor_embedded=fixture; Path=/; SameSite=None");
    response.writeHead(200, { "Content-Type": "image/gif", "Cache-Control": "no-store" });
    response.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64"));
    return;
  }

  if (url.pathname === "/status") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ trackerRequests }));
    return;
  }

  if (url.pathname === "/reset" && request.method === "POST") {
    trackerRequests = 0;
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ trackerRequests }));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

firstParty.listen(FIRST_PARTY_PORT, "0.0.0.0", () => {
  process.stdout.write(`First-party fixture: http://127.0.0.1:${FIRST_PARTY_PORT}\\n`);
});

tracker.listen(TRACKER_PORT, "0.0.0.0", () => {
  process.stdout.write(`Tracker fixture: http://127.0.0.1:${TRACKER_PORT} (status at /status)\\n`);
});

function shutdown() {
  firstParty.close();
  tracker.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
