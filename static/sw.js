// Secret App — Service Worker (Render deployment)
// Supports: offline caching + Web Push Notifications (call & message events)

const CACHE = 'secret-v2';
const ASSETS = [
  '/',
  '/manifest.json',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/apple-touch-icon.png'
];

/* ── Install: pre-cache shell assets ─────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

/* ── Activate: purge stale caches ────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: network-first, fall back to cache ────────────────── */
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

/* ═══════════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════
   Your server sends a JSON payload like:
   {
     "type"      : "call" | "message",
     "title"     : "Incoming Voice Call",
     "body"      : "Sarfaraj is calling…",
     "icon"      : "/static/icon-192.png",
     "badge"     : "/static/icon-192.png",
     "tag"       : "call-<uid>",
     "callId"    : "<Firestore doc id>",
     "callerName": "Sarfaraj",
     "url"       : "/"
   }
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener('push', e => {
  if (!e.data) return;

  let payload;
  try {
    payload = e.data.json();
  } catch {
    payload = {
      type : 'message',
      title: 'Secret',
      body : e.data.text(),
      icon : '/static/icon-192.png'
    };
  }

  const {
    type       = 'message',
    title      = 'Secret',
    body       = 'You have a new notification',
    icon       = '/static/icon-192.png',
    badge      = '/static/icon-192.png',
    tag        = 'secret-notification',
    callId     = '',
    url        = '/'
  } = payload;

  // Build actions based on event type
  // "call"    → Answer / Decline   (WhatsApp-style lock-screen call)
  // "message" → Open App
  const actions = type === 'call'
    ? [
        { action: 'answer',  title: '✅ Answer'  },
        { action: 'decline', title: '❌ Decline' }
      ]
    : [
        { action: 'open', title: '💬 Open App' }
      ];

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify : true,
    requireInteraction: type === 'call',
    vibrate  : type === 'call'
      ? [300, 200, 300, 200, 300]
      : [200, 100, 200],
    actions,
    data: { url, callId, type }
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

/* ── Notification Click / Action ─────────────────────────────── */
self.addEventListener('notificationclick', e => {
  const notification = e.notification;
  const action       = e.action;
  const { url, callId, type } = notification.data || {};

  notification.close();

  // Decline: dismiss only
  if (action === 'decline') return;

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus an existing app window
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type  : 'NOTIFICATION_ACTION',
              action: action || 'open',
              callId
            });
            return;
          }
        }

        // No existing window → open a new one
        if (clients.openWindow) {
          const target = callId
            ? `${url || '/'}#call=${callId}&action=${action || 'open'}`
            : (url || '/');
          return clients.openWindow(target).then(newClient => {
            if (newClient) {
              setTimeout(() => {
                newClient.postMessage({
                  type  : 'NOTIFICATION_ACTION',
                  action: action || 'open',
                  callId
                });
              }, 1500);
            }
          });
        }
      })
  );
});

/* ── Push subscription change (key rotation) ─────────────────── */
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly   : true,
        applicationServerKey: e.oldSubscription?.options?.applicationServerKey
      })
      .then(subscription => {
        return fetch('/api/push/subscribe', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(subscription)
        });
      })
  );
});
