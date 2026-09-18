self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(data.title || "Motion", {
    body: data.body || "Neue Nachricht",
    icon: data.icon || "/ak-motion-logo.png",
    badge: "/ak-motion-logo.png",
    tag: data.tag || "ak-motion",
    data: { href: data.href || "/chat" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/calendar";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => "focus" in client);
    return existing ? existing.focus().then(() => existing.navigate(href)) : clients.openWindow(href);
  }));
});
