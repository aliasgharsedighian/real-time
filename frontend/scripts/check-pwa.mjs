import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const dist = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.webmanifest", dist), "utf8"));
const workerSource = await readFile(new URL("sw.js", dist), "utf8");

function worker(network = async () => new Response("network")) {
  const handlers = {};
  const stores = new Map();
  const cacheStorage = {
    keys: async () => [...stores.keys()],
    delete: async (key) => stores.delete(key),
    open: async (key) => {
      if (!stores.has(key)) stores.set(key, new Map());
      const entries = stores.get(key);
      return {
        addAll: async (urls) => {
          for (const url of urls) {
            const bytes = await readFile(new URL(url.slice(1), dist));
            entries.set(url, new Response(bytes));
          }
        },
        match: async (request) => entries.get(typeof request === "string" ? request : new URL(request.url).pathname)?.clone(),
      };
    },
  };
  runInNewContext(workerSource, {
    URL,
    caches: cacheStorage,
    fetch: network,
    self: {
      location: { origin: "https://batgram.test" },
      clients: { claim: async () => {} },
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
  });
  const lifecycle = async (name) => {
    let pending;
    handlers[name]({ waitUntil: (promise) => { pending = promise; } });
    await pending;
  };
  return {
    stores,
    lifecycle,
    request(path, options = {}) {
      let response;
      handlers.fetch({
        request: { url: new URL(path, "https://batgram.test").href, method: "GET", mode: "cors", ...options },
        respondWith: (promise) => { response = promise; },
      });
      return response;
    },
  };
}

test("manifest and Apple/favicon assets exist with correct raster dimensions", async () => {
  assert.equal(manifest.name, "BatGram");
  assert.equal(manifest.start_url, "/dashboard");
  assert.equal(manifest.display, "standalone");
  for (const purpose of ["any", "maskable"]) {
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((entry) => entry.purpose === purpose && entry.sizes === `${size}x${size}`);
      assert.ok(icon);
      const png = await readFile(new URL(icon.src.slice(1), dist));
      assert.equal(png.readUInt32BE(16), size);
      assert.equal(png.readUInt32BE(20), size);
    }
  }
  const apple = await readFile(new URL("apple-touch-icon.png", dist));
  assert.equal(apple.readUInt32BE(16), 180);
  assert.equal(apple.readUInt32BE(20), 180);
  const ico = await readFile(new URL("favicon.ico", dist));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  const html = await readFile(new URL("index.html", dist), "utf8");
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
});

test("worker precaches build assets, serves offline page, and leaves private requests alone", async () => {
  const app = worker(async () => { throw new TypeError("offline"); });
  await app.lifecycle("install");
  const cache = [...app.stores.values()][0];
  assert.ok(cache.has("/index.html"));
  assert.ok([...cache.keys()].some((key) => /ChatPage.*\.js$/.test(key)));
  assert.match(await (await app.request("/dashboard/websocket/42", { mode: "navigate" })).text(), /BatGram is offline/);
  assert.ok((await app.request("/icons/icon-192.png")).ok);
  for (const path of ["/api/v1/user/user-info", "/api/v1/auth/refresh", "/socket.io/?transport=polling", "https://api.example.com/api/v1/chats", "/unknown.json"]) {
    assert.equal(app.request(path), undefined, path);
  }
  assert.equal(app.request("/api/v1/chats", { method: "POST" }), undefined);
  assert.equal(app.request("/icons/icon-192.png?private=1"), undefined);
});

test("online navigation stays on network and activation only deletes old BatGram caches", async () => {
  const app = worker();
  await app.lifecycle("install");
  app.stores.set("batgram-static-old", new Map());
  app.stores.set("unrelated-app", new Map());
  await app.lifecycle("activate");
  assert.ok(!app.stores.has("batgram-static-old"));
  assert.ok(app.stores.has("unrelated-app"));
  assert.equal(await (await app.request("/dashboard", { mode: "navigate" })).text(), "network");
});
