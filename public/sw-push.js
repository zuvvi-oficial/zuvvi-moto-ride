// Manipuladores de Web Push, importados pelo service worker gerado pelo
// workbox (vite.config.ts: workbox.importScripts). Arquivo plano — não passa
// pelo bundler, então não pode usar import/export nem sintaxe de módulo.

self.addEventListener("push", function (event) {
  var payload = { title: "Zuvvi", body: "Você tem uma atualização.", tipo: null, corridaId: null };
  if (event.data) {
    try {
      var parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        tipo: parsed.tipo || null,
        corridaId: parsed.corridaId || null,
      };
    } catch (e) {
      // Payload não-JSON: mantém o fallback acima em vez de falhar o evento.
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-96.png",
      tag: payload.tipo || "zuvvi-notificacao",
      data: { tipo: payload.tipo, corridaId: payload.corridaId },
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = "/";
  if (data.corridaId) {
    if (data.tipo === "nova_oferta_corrida") {
      targetUrl = "/home-motorista";
    } else {
      targetUrl = "/acompanhamento?rideId=" + encodeURIComponent(data.corridaId);
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
