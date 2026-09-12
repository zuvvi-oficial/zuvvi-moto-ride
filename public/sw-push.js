// Manipuladores de Web Push, importados pelo service worker gerado pelo
// workbox (vite.config.ts: workbox.importScripts). Arquivo plano — não passa
// pelo bundler, então não pode usar import/export nem sintaxe de módulo.

self.addEventListener("push", function (event) {
  var payload = { title: "Zuvvi", body: "Você tem uma atualização.", tipo: null, corridaId: null, url: null, icon: null };
  if (event.data) {
    try {
      var parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        tipo: parsed.tipo || null,
        corridaId: parsed.corridaId || null,
        url: typeof parsed.url === "string" && parsed.url.charAt(0) === "/" ? parsed.url : null,
        // Só https: é uma URL assinada do próprio Supabase, nunca um esquema
        // arbitrário (javascript:, data:, etc.) vindo de um payload adulterado.
        icon: typeof parsed.icon === "string" && parsed.icon.indexOf("https://") === 0 ? parsed.icon : null,
      };
    } catch (e) {
      // Payload não-JSON: mantém o fallback acima em vez de falhar o evento.
    }
  }

  var ehMensagem = payload.tipo === "nova_mensagem_chat";

  function appEstaEmFoco() {
    // Só o cliente sabe se a pessoa está de fato com o app na frente; o
    // servidor manda a mensagem sempre, pra nunca engolir um aviso.
    if (!ehMensagem) return Promise.resolve(false);
    return self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (janelas) {
        return janelas.some(function (janela) {
          return janela.focused === true;
        });
      })
      .catch(function () {
        return false;
      });
  }

  event.waitUntil(
    appEstaEmFoco().then(function (emFoco) {
      // Com o app aberto, o aviso dentro dele (som, vibração e toast) já cobre:
      // mostrar o balão do sistema por cima seria avisar duas vezes.
      if (emFoco) return undefined;

      return self.registration.showNotification(payload.title, {
        body: payload.body,
        // Foto de quem mandou, quando tiver uma cadastrada (hoje só
        // passageiro); sem isso, cai no logo padrão da Zuvvi.
        icon: payload.icon || "/brand/icon-192.png",
        // O badge da barra de status precisa de fundo transparente: o Android
        // usa só o canal alfa como silhueta e ignora as cores. Um PNG opaco
        // (como o icon-96, que tem fundo) vira um quadrado branco sólido.
        badge: "/brand/icon-badge.png",
        tag: payload.tipo || "zuvvi-notificacao",
        // Mensagens novas empilham no mesmo balão, mas precisam avisar de novo a
        // cada uma — sem renotify o Android troca o texto em silêncio.
        renotify: ehMensagem,
        vibrate: ehMensagem ? [300, 120, 300, 120, 300] : undefined,
        data: { tipo: payload.tipo, corridaId: payload.corridaId, url: payload.url },
      });
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = "/";
  if (typeof data.url === "string" && data.url.charAt(0) === "/") {
    targetUrl = data.url;
  } else if (data.corridaId) {
    if (data.tipo === "nova_oferta_corrida") {
      targetUrl = "/home-motorista";
    } else {
      targetUrl = "/acompanhamento?rideId=" + encodeURIComponent(data.corridaId);
    }
  } else if (data.tipo === "corrida_agendada_lembrete" || data.tipo === "corrida_agendada_falhou") {
    targetUrl = "/corridas-agendadas";
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
