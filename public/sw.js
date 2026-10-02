self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/watch") ||
    path.endsWith(".apk") ||
    path.endsWith(".m3u8") ||
    path.endsWith(".ts") ||
    path.endsWith(".mp4")
  ) {
    return;
  }
});
