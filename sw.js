// SW Version: 20261102_01
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Mensaje desde la app para programar alarmas en el Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_REMINDERS' && Array.isArray(event.data.recordatorios)) {
    programarAlarmasLocales(event.data.recordatorios);
  }
});

let timersActivos = [];

function programarAlarmasLocales(recordatorios) {
  timersActivos.forEach(t => clearTimeout(t));
  timersActivos = [];

  const ahora = Date.now();
  recordatorios.forEach(rec => {
    if (rec.realizada || !rec.notificar || !rec.fecha || !rec.hora) return;

    const [anio, mes, dia] = rec.fecha.split('-').map(Number);
    const [hora, min] = rec.hora.split(':').map(Number);
    if (!anio || !mes || !dia || isNaN(hora) || isNaN(min)) return;

    const tsEvento = new Date(anio, mes - 1, dia, hora, min, 0, 0).getTime();
    const minAntes = Number(rec.minutosAntes || 0);
    const tsAviso = tsEvento - (minAntes * 60 * 1000);
    const demoraMs = tsAviso - ahora;

    // Si todavía falta para la hora de aviso y está dentro de las próximas 24 horas
    if (demoraMs > 0 && demoraMs <= 24 * 60 * 60 * 1000) {
      const timer = setTimeout(() => {
        const prefijo = minAntes === 0
          ? `⏰ Es la hora (${rec.hora} hs)`
          : `⏰ En ${minAntes} min (${rec.hora} hs)`;

        self.registration.showNotification(`📅 Recordatorio: ${rec.texto}`, {
          body: prefijo,
          icon: 'logo.svg',
          badge: 'logo.svg',
          tag: 'rec-' + rec.id,
          vibrate: [250, 100, 250, 100, 250]
        });
      }, demoraMs);

      timersActivos.push(timer);
    }
  });
}

// Recibir notificación push en segundo plano aunque la app esté totalmente cerrada
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 Agenda Familiar',
    body: 'Tenés una nueva notificación.',
    icon: 'logo.svg',
    badge: 'logo.svg',
    tag: 'agenda-push-' + Date.now()
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = Object.assign(data, json);
    } catch (e) {
      const text = event.data.text();
      if (text) data.body = text;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'logo.svg',
    badge: data.badge || 'logo.svg',
    tag: data.tag || 'agenda-push',
    vibrate: [250, 100, 250, 100, 250],
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Al tocar la notificación que llega al celular, abrir o enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && typeof event.notification.data === 'string')
    ? event.notification.data
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
