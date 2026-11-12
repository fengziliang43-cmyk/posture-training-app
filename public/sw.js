const SHELL_CACHE = "posture-training-shell-v1";
const RUNTIME_CACHE = "posture-training-runtime-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest"];
// Until 1.0.6 this worker kept /api/plans/today here, keyed by address only, so the next person
// signed in on the same device could be shown the previous account's plan while offline. API answers
// are no longer cached here (the page keeps its own offline copy per account); the old cache goes
// when this worker takes over.
const RETIRED_CACHES = ["posture-training-plan-v1"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all(RETIRED_CACHES.map((name) => caches.delete(name)))
      .catch(() => undefined)
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // What the API returns depends on who is signed in, so none of it is cached here.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }

  event.respondWith(networkFirstRuntimeAsset(request));
});

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("/")) || Response.error();
  }
}

async function networkFirstRuntimeAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}
