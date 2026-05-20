/* ════════════════════════════════════════════════════════════════
   sw.js — Secret App Service Worker
   KEY FIX: Server-side Firestore listener in app.py now sends
   pushes even when BOTH users have the app fully closed.
   This SW just needs to receive & display them reliably.
   ════════════════════════════════════════════════════════════════ */

const ORIGIN = 'https://secretapp-e3jr.onrender.com';
const SW_VERSION = 'v4'; // bump this if you change sw.js to force update

self.addEventListener('install', e => {
  console.log('[SW] Installing', SW_VERSION);
  // Skip waiting immediately so the new SW takes over without needing a refresh
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activating', SW_VERSION);
  // Take control of all open pages immediately
  e.waitUntil(clients.claim());
});

// ── Push event — ALWAYS show notification ────────────────────────
// This fires when the server sends a push via web-push protocol.
// It works even when the app is fully closed (no browser tab open).
self.addEventListener('push', e => {
  console.log('[SW] Push received');

  // Safe defaults
  let data = {
    title : 'Secret',
    body  : 'New message',
    icon  : ORIGIN + '/static/icon-192.png',
    badge : ORIGIN + '/static/icon-192.png',
    tag   : 'secret-msg',
    type  : 'message',
    callId: ''
  };

  if (e.data) {
    try {
      Object.assign(data, e.data.json());
    } catch (_) {
      // If JSON parse fails, try text
      data.body = e.data.text() || data.body;
    }
  }

  // Make sure icon/badge are absolute URLs
  if (data.icon  && !data.icon.startsWith('http'))  data.icon  = ORIGIN + data.icon;
  if (data.badge && !data.badge.startsWith('http')) data.badge = ORIGIN + data.badge;

  // IMPORTANT: Always call e.waitUntil with the showNotification promise.
  // Without this, the browser may kill the SW before the notification shows.
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body              : data.body,
      icon              : data.icon,
      badge             : data.badge,
      tag               : data.tag || 'secret-msg',
      renotify          : true,          // always alert even if same tag
      requireInteraction: data.type === 'call',  // call notifs stay until dismissed
      vibrate           : data.type === 'call'
                            ? [300, 100, 300, 100, 300]
                            : [200, 100, 200],
      data              : data,          // attach payload so notificationclick can read it
      actions           : data.type === 'call'
        ? [{ action: 'answer',  title: '✅ Answer'  },
           { action: 'decline', title: '❌ Decline' }]
        : [{ action: 'open',    title: '💬 Open'    }]
    })
  );
});

// ── Notification click ───────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const action = e.action;
  const data   = e.notification.data || {};

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Try to focus an already-open app window
      for (const c of list) {
        if (c.url && c.url.startsWith(ORIGIN) && 'focus' in c) {
          c.focus();
          if (action && action !== 'decline') {
            c.postMessage({
              type  : 'NOTIFICATION_ACTION',
              action: action,
              callId: data.callId || ''
            });
          }
          return;
        }
      }
      // No window open — open the app (unless user declined a call)
      if (action !== 'decline') {
        return clients.openWindow(ORIGIN);
      }
    })
  );
});

// ── Background sync (reserved for future offline queue) ─────────
self.addEventListener('sync', e => {
  if (e.tag === 'send-queued-messages') { /* reserved */ }
});
