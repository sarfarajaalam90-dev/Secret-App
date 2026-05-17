# Nexo — Real-Time Messaging App

A sleek, mobile-first messaging web application built with Flask + vanilla JS.

## Project Structure

```
nexo/
├── app.py              ← Flask backend (API routes, in-memory data)
├── requirements.txt    ← Python dependencies
└── templates/
    └── index.html      ← Full frontend (HTML + CSS + JS)
```

## Setup & Run

### Step 1 — Make sure Python is installed
```bash
python --version   # should be 3.8+
```

### Step 2 — Install Flask
```bash
pip install -r requirements.txt
```

### Step 3 — Run the app
```bash
python app.py
```

### Step 4 — Open in browser
Visit: **http://127.0.0.1:5000**

---

## Demo Login Credentials

| Field    | Value          |
|----------|----------------|
| Mobile   | `9800000001`   |
| Password | `password123`  |

Or try: `9800000002` / `nexo2024`

---

## Features

- 🔐 **Login** — Mobile number + password auth (SHA-256 hashed)
- 💬 **Chats** — Contact list with unread badges, last message preview
- 📨 **Real-time messaging** — Send/receive with simulated AI replies
- 📡 **Typing indicator** — Animated dots when contact is "typing"
- 📞 **Calls tab** — Recent call history (voice/video UI)
- 🟢 **Status tab** — Stories/status updates UI
- ⚙️ **Settings** — Profile view + sign out
- 🔔 **Toast notifications** — "Coming Soon" for voice/video call buttons
- 📱 **Mobile-first** — Bottom nav, safe area insets, touch-friendly
