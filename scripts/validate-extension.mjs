import { access, readFile } from "node:fs/promises";

const extensionRoot = new URL("../web-extension/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionRoot)));

if (manifest.manifest_version !== 3) throw new Error("Manifest V3 is required.");
if (!manifest.host_permissions?.includes("<all_urls>")) {
  throw new Error("Tidy's dashboard build requires explicit all-sites host access.");
}
if (manifest.optional_host_permissions?.length) {
  throw new Error("The dashboard build must not fall back to progressive host permissions.");
}

const resources = [
  ...manifest.background.scripts,
  manifest.action.default_popup,
  manifest.action.default_icon,
  ...Object.values(manifest.icons ?? {}),
  ...manifest.content_scripts.flatMap(({ js = [], css = [] }) => [...js, ...css]),
  ...manifest.declarative_net_request.rule_resources.map(({ path }) => path),
  "dashboard/dashboard.html",
  "dashboard/dashboard.css",
  "dashboard/dashboard.js"
];

for (const resource of resources) await access(new URL(resource, extensionRoot));

async function verifyPageReferences(pagePath) {
  const pageURL = new URL(pagePath, extensionRoot);
  const html = await readFile(pageURL, "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const resource = match[1];
    if (/^(?:[a-z]+:|#)/i.test(resource)) continue;
    await access(new URL(resource, pageURL));
  }
}

await verifyPageReferences(manifest.action.default_popup);
await verifyPageReferences("dashboard/dashboard.html");

process.stdout.write("Extension manifest and referenced resources are valid.\n");
