/* ════════════════════════════════════════════════════════════════
   sw.js — Secret App Service Worker
   • Must be served from the ROOT of your domain (same origin as the page)
   • e.g. https://yourdomain.com/sw.js
   ════════════════════════════════════════════════════════════════ */

const CACHE = 'secret-v1';

/* ── Install: skip waiting so new SW activates immediately ────── */
self.addEventListener('install', e => {
  self.skipWaiting();
});

/* ── Activate: claim all open clients immediately ─────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

/* ── Push: show notification when a push arrives ──────────────── */
self.addEventListener('push', e => {
  // Default payload — overridden by whatever the server sends
  let data = {
    title : 'Secret',
    body  : 'New message',
    icon  : '/static/icon-192.png',
    badge : '/static/icon-192.png',
    tag   : 'secret-msg',
    type  : 'message'   // 'message' | 'call'
  };

  // Try to parse the server-sent JSON payload
  if (e.data) {
    try { Object.assign(data, e.data.json()); } catch (_) {}
  }

  const options = {
    body    : data.body,
    icon    : data.icon  || '/static/icon-192.png',
    badge   : data.badge || '/static/icon-192.png',
    tag     : data.tag   || 'secret-msg',
    renotify: true,
    data    : data,
    // Action buttons shown in the notification tray
    actions : data.type === 'call'
      ? [
          { action: 'answer',  title: '✅ Answer' },
          { action: 'decline', title: '❌ Decline' }
        ]
      : [
          { action: 'open', title: '💬 Open' }
        ]
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/* ── Notification click: focus or open the app ─────────────────── */
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const action = e.action;           // 'answer' | 'decline' | 'open' | ''
  const data   = e.notification.data || {};

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Try to find an already-open window and focus it
      for (const c of list) {
        if (c.url && 'focus' in c) {
          c.focus();
          // Forward the action to the page so it can handle UI (e.g. show call modal)
          if (action && action !== 'decline') {
            c.postMessage({ type: 'NOTIFICATION_ACTION', action, callId: data.callId });
          }
          return;
        }
      }
      // No open window — open a new one (decline action: no need to open)
      if (action !== 'decline') {
        return clients.openWindow(self.location.origin);
      }
    })
  );
});

/* ── Background sync stub ──────────────────────────────────────── */
self.addEventListener('sync', e => {
  if (e.tag === 'send-queued-messages') {
    // Firestore offline cache handles re-send on next app open
  }
});
