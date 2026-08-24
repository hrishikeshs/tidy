import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../web-extension/manifest.json", import.meta.url)));

if (manifest.manifest_version !== 3) throw new Error("Manifest V3 is required.");
if (manifest.host_permissions?.length) throw new Error("Blanket host permissions are forbidden in Phase 0.");
if (!manifest.optional_host_permissions?.length) throw new Error("Progressive host permissions are required.");

const resources = [
  ...manifest.background.scripts,
  manifest.action.default_popup,
  manifest.action.default_icon,
  ...Object.values(manifest.icons ?? {}),
  ...manifest.declarative_net_request.rule_resources.map(({ path }) => path)
];

for (const resource of resources) {
  await access(new URL(`../web-extension/${resource}`, import.meta.url));
}

const popup = await readFile(new URL(`../web-extension/${manifest.action.default_popup}`, import.meta.url), "utf8");
for (const match of popup.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const resource = match[1];
  if (/^(?:[a-z]+:|#)/i.test(resource)) continue;
  await access(new URL(`../web-extension/popup/${resource}`, import.meta.url));
}

process.stdout.write("Extension manifest and referenced resources are valid.\n");
