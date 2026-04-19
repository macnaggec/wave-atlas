/**
 * Chrome automation: clear app data → hard reload
 *
 * Requires Chrome to be running with remote debugging:
 *   chrome-debug  (or: google-chrome --remote-debugging-port=9222)
 *
 * Usage:  node scripts/chrome-reset.mjs [origin] [port]
 *   origin  defaults to http://localhost:3000
 *   port    defaults to 9222
 */

import CDP from "chrome-remote-interface";

const origin = process.argv[2] ?? "http://localhost:3000";
const debugPort = Number(process.argv[3] ?? 9222);

async function run() {
  let client;
  try {
    // Find the first non-devtools target whose URL matches our origin
    const targets = await CDP.List({ port: debugPort });
    const target =
      targets.find(
        (t) => t.type === "page" && t.url.startsWith(origin)
      ) ?? targets.find((t) => t.type === "page");

    if (!target) {
      console.error("No page target found. Is the app open in Chrome?");
      process.exit(1);
    }

    console.log(`Attaching to: ${target.url}`);
    client = await CDP({ target: target.id, port: debugPort });

    const { Network, Storage, Page } = client;

    await Promise.all([
      Network.enable(),
      Page.enable(),
    ]);

    // 1. Clear all application/storage data for the origin
    await Storage.clearDataForOrigin({
      origin,
      storageTypes:
        "appcache,cookies,file_systems,indexeddb,local_storage,shader_cache,websql,service_workers,cache_storage,all",
    });
    console.log("✓ Application data cleared");

    // 2. Clear browser disk cache
    await Network.clearBrowserCache();
    console.log("✓ Browser cache cleared");

    // 3. Hard reload (equivalent to Shift+Cmd+R / empty cache & hard reload)
    await Page.reload({ ignoreCache: true });
    console.log("✓ Hard reload sent");
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      console.error(
        `Could not connect to Chrome on port ${debugPort}.\n` +
        `Run the "Start Chrome remote debug" task first.`
      );
    } else {
      console.error(err.message ?? err);
    }
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

run();
