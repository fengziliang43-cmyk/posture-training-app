const SHELL_CACHE = "posture-training-shell-v1";
const PLAN_CACHE = "posture-training-plan-v1";
const RUNTIME_CACHE = "posture-training-runtime-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest"];

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
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname === "/api/plans/today") {
    event.respondWith(networkFirstPlan(request));
    return;
  }

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

async function networkFirstPlan(request) {
  const cache = await caches.open(PLAN_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
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
