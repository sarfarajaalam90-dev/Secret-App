from flask import Flask, render_template, request, jsonify, session
from datetime import datetime
import hashlib, os

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))

USERS = {
    "9800000001": {"password": hashlib.sha256("password123".encode()).hexdigest(), "name": "Alex Rivera", "avatar": "AR"},
    "9800000002": {"password": hashlib.sha256("nexo2024".encode()).hexdigest(),    "name": "Maya Chen",   "avatar": "MC"},
}

CONTACTS = [
    {"id": "c1", "name": "Jamie Patel",  "avatar": "JP", "status": "online",  "last": "Sounds good 👍",    "time": "10:42 AM",  "unread": 2},
    {"id": "c2", "name": "Sam Torres",   "avatar": "ST", "status": "offline", "last": "See you there!",    "time": "Yesterday", "unread": 0},
    {"id": "c3", "name": "Priya Nair",   "avatar": "PN", "status": "online",  "last": "Call me when free", "time": "9:15 AM",   "unread": 5},
    {"id": "c4", "name": "Chris Mullen", "avatar": "CM", "status": "away",    "last": "Sent a photo 📷",   "time": "Mon",       "unread": 0},
    {"id": "c5", "name": "Zara Okonkwo", "avatar": "ZO", "status": "online",  "last": "haha yes!!",        "time": "Sun",       "unread": 1},
]

MESSAGES = {
    "c1": [
        {"id": "m1", "text": "Hey! Are we still on for tomorrow?",   "sender": "them", "time": "10:30 AM"},
        {"id": "m2", "text": "Yeah, 3pm works perfectly for me 🙌", "sender": "me",   "time": "10:35 AM"},
        {"id": "m3", "text": "Great, I'll book the place now.",      "sender": "them", "time": "10:40 AM"},
        {"id": "m4", "text": "Sounds good 👍",                       "sender": "them", "time": "10:42 AM"},
    ],
    "c2": [
        {"id": "m5", "text": "Don't forget to bring the files.", "sender": "me",   "time": "Yesterday"},
        {"id": "m6", "text": "See you there!",                   "sender": "them", "time": "Yesterday"},
    ],
    "c3": [
        {"id": "m7", "text": "Hey Priya, got your message!", "sender": "me",   "time": "9:10 AM"},
        {"id": "m8", "text": "Call me when free",            "sender": "them", "time": "9:15 AM"},
    ],
    "c4": [], "c5": [],
}

STATUS_UPDATES = [
    {"contact": "Jamie Patel",  "avatar": "JP", "time": "10 min ago"},
    {"contact": "Priya Nair",   "avatar": "PN", "time": "1 hr ago"},
    {"contact": "Zara Okonkwo", "avatar": "ZO", "time": "3 hrs ago"},
]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/login", methods=["POST"])
def login():
    data     = request.get_json()
    mobile   = data.get("mobile", "").strip()
    password = data.get("password", "")
    hashed   = hashlib.sha256(password.encode()).hexdigest()
    user     = USERS.get(mobile)
    if user and user["password"] == hashed:
        session["mobile"] = mobile
        session["name"]   = user["name"]
        return jsonify({"ok": True, "name": user["name"], "avatar": user["avatar"]})
    return jsonify({"ok": False, "error": "Invalid mobile number or password"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})

@app.route("/api/contacts")
def contacts():
    return jsonify(CONTACTS)

@app.route("/api/messages/<contact_id>")
def messages(contact_id):
    return jsonify(MESSAGES.get(contact_id, []))

@app.route("/api/send", methods=["POST"])
def send_message():
    data       = request.get_json()
    contact_id = data.get("contact_id")
    text       = data.get("text", "").strip()
    if not text or contact_id not in MESSAGES:
        return jsonify({"ok": False}), 400
    msg = {
        "id":     f"m{len(MESSAGES[contact_id])+100}",
        "text":   text,
        "sender": "me",
        "time":   datetime.now().strftime("%I:%M %p"),
    }
    MESSAGES[contact_id].append(msg)
    for c in CONTACTS:
        if c["id"] == contact_id:
            c["last"] = text
            c["time"] = msg["time"]
            break
    return jsonify({"ok": True, "message": msg})

@app.route("/api/status")
def status():
    return jsonify(STATUS_UPDATES)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
