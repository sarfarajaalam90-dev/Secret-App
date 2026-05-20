from flask import Flask, render_template, request, jsonify, send_from_directory
from datetime import datetime
from pywebpush import webpush, WebPushException
import os, json, firebase_admin
from firebase_admin import credentials, firestore as fb_firestore

# ── Firebase init ─────────────────────────────────────────────────
_fs_client = None
try:
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    cred = credentials.Certificate(json.loads(sa_json)) if sa_json else \
           credentials.Certificate("nexo-app-b9ec4-firebase-adminsdk-fbsvc-4f17bf7bb7.json")
    firebase_admin.initialize_app(cred)
    _fs_client = fb_firestore.client()
    print("[Firebase] ✅ Ready")
except Exception as e:
    print(f"[Firebase] ❌ {e}")

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))

VAPID_PRIVATE_KEY  = os.environ.get("VAPID_PRIVATE_KEY",  "qgIPEeJdGTTevefFs1NRIJ1aZZplgsMRnDwBZz1pOSc")
VAPID_PUBLIC_KEY   = os.environ.get("VAPID_PUBLIC_KEY",   "BIayh8Hp_-6TosLl50O5xGmK1F7mP6RAmdul3m22nEwCWd3tL5Rm1BRWp_Oq-fzafRIvo2gr-lFokY2TFuQjWlw")
VAPID_EMAIL        = os.environ.get("VAPID_CLAIMS_EMAIL", "sarfarajaalam90@gmail.com")

_sub_cache: dict = {}

def _get_sub(uid):
    if uid in _sub_cache:
        return _sub_cache[uid]
    if _fs_client:
        try:
            doc = _fs_client.collection("pushSubscriptions").document(uid).get()
            if doc.exists:
                sub = doc.to_dict().get("subscription")
                if sub:
                    _sub_cache[uid] = sub
                    return sub
        except Exception as e:
            print(f"[Push] Firestore read error uid={uid}: {e}")
    return None

def _send_push(uid, payload):
    sub = _get_sub(uid)
    if not sub:
        return False, 404
    try:
        webpush(
            subscription_info=sub,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{VAPID_EMAIL}"}
        )
        return True, 200
    except WebPushException as ex:
        if ex.response and ex.response.status_code == 410:
            _sub_cache.pop(uid, None)
            if _fs_client:
                try: _fs_client.collection("pushSubscriptions").document(uid).delete()
                except: pass
            return False, 410
        return False, 500

# ── Routes ────────────────────────────────────────────────────────
@app.route('/manifest.json')
def manifest():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'manifest.json', mimetype='application/manifest+json')

@app.route('/sw.js')
def service_worker():
    resp = send_from_directory(os.path.join(app.root_path, 'static'),
                               'sw.js', mimetype='application/javascript')
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['Service-Worker-Allowed'] = '/'
    return resp

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/push/subscribe", methods=["POST"])
def push_subscribe():
    body = request.get_json(silent=True) or {}
    uid, sub = body.get("uid"), body.get("subscription")
    if not uid or not sub:
        return jsonify({"ok": False, "error": "Missing uid or subscription"}), 400
    _sub_cache[uid] = sub
    if _fs_client:
        try:
            _fs_client.collection("pushSubscriptions").document(uid).set(
                {"subscription": sub, "updatedAt": fb_firestore.SERVER_TIMESTAMP})
            print(f"[Push] ✅ Saved uid={uid}")
        except Exception as e:
            print(f"[Push] ⚠️ Save failed uid={uid}: {e}")
    return jsonify({"ok": True})

@app.route("/api/push/send", methods=["POST"])
def push_send():
    body = request.get_json(silent=True) or {}
    uid  = body.get("recipientUid")
    if not uid:
        return jsonify({"ok": False, "error": "Missing recipientUid"}), 400
    payload = {
        "title" : body.get("title", "Secret"),
        "body"  : body.get("body", "New message"),
        "type"  : body.get("type", "message"),
        "callId": body.get("callId", ""),
        "icon"  : "/static/icon-192.png",
        "badge" : "/static/icon-192.png",
        "tag"   : "secret-call" if body.get("type") == "call" else "secret-msg",
    }
    ok, code = _send_push(uid, payload)
    return jsonify({"ok": ok}), (200 if ok else code)

@app.route("/api/send", methods=["POST"])
def send_message():
    text = (request.get_json(silent=True) or {}).get("text", "").strip()
    if not text:
        return jsonify({"ok": False, "error": "Empty message"}), 400
    return jsonify({"ok": True, "message": {
        "id": f"msg_{datetime.now().timestamp()}",
        "text": text, "sender": "me",
        "time": datetime.now().strftime("%I:%M %p"),
    }})

@app.route("/health")
def health():
    return jsonify({"status": "ok", "firebase": _fs_client is not None,
                    "cached_subs": len(_sub_cache)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
