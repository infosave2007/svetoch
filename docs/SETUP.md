🇷🇺 [Русская версия](SETUP.ru.md)

# Setup & Configuration Guide

This guide covers everything from installation to fine‑tuning the optical geometry. For the big picture, read the [main README](../README.md) first.

---

## 1. Requirements

**Computer (runs the server):**
- Python **3.8+** (standard library only — no `pip install` needed for the server)
- **OpenSSL** on `PATH` (used once to create a self‑signed certificate)

**Phone (runs the optics):**
- An **OLED / AMOLED** screen (LCD works poorly — the per‑pixel emission of OLED is what makes the channel work)
- A **front camera**
- A modern mobile browser (Chrome / Safari)

**Network:** the phone and the computer must be on the **same local Wi‑Fi network**.

**Optics:** a small flat mirror (≈ 10 × 10 cm). A first‑surface mirror is best; a bathroom mirror works for a first run.

---

## 2. Installation

```bash
git clone https://github.com/infosave2007/svetoch.git
cd svetoch/app
python3 server.py
```

On the first launch the server:

1. Generates a self‑signed TLS certificate (`cert.pem` / `key.pem`) — HTTPS is **mandatory** because browsers only grant camera access on secure origins.
2. Detects your LAN IP and starts listening on `0.0.0.0:8443`.
3. Prints the phone and admin URLs.

```
==================================================
  NVG Optical Computer — Server
==================================================

📱 Phone: https://192.168.x.x:8443/
🖥️  Admin: https://192.168.x.x:8443/admin

Everything on one port 8443 — no WebSocket!
==================================================
```

> The generated `cert.pem` / `key.pem` are local secrets and are **git‑ignored**. Delete them to force regeneration.

---

## 3. Physical setup

```
    ┌────────────────────────────────────┐
    │  [front camera]      AMOLED screen │  ← phone, screen facing DOWN
    └────────────────────────────────────┘
                    │
                    │  d ≈ 3–5 cm   (stack of books / a stand)
                    │
    ╔════════════════════════════════════╗
    ║         MIRROR  10×10 cm            ║  ← flat on the table
    ╚════════════════════════════════════╝
```

| Component | Note |
|-----------|------|
| Phone | OLED screen down, front camera pointing at the mirror |
| Mirror | Flat, clean, directly under the camera |
| Gap `d` | 3–5 cm to start. The Talbot self‑imaging distance depends on `d`; ~37 mm is a sweet spot on the reference device |
| Light | Work in a **dim, stable** room. Ambient light is noise |

Tips:
- Keep the gap **rigid** — even small vibrations blur the interference pattern.
- The camera's minimum focus distance matters (≈ 10 cm on the Xiaomi 12 Lite); the mirror doubles the optical path, which is part of why it is needed.
- Dust and fingerprints on the mirror or lens directly reduce contrast.

---

## 4. Running experiments

1. **Phone:** open the *Phone* URL. Accept the certificate warning ("Advanced → Proceed"). Grant **camera** permission. Keep the screen awake (disable auto‑lock).
2. **Admin:** open the *Admin* URL on your computer. You will see all four experiment families auto‑loaded from `app/stages/`.
3. Select individual experiments or choose **all**, set the interface language (RU / EN), and press **Start**.
4. The phone polls the server, runs the selected experiments, and streams logs, live metrics, and charts back to the dashboard.
5. When the run finishes it is saved to `logs/nvg_poc_v3_<timestamp>.json`. Download any past run from the dashboard's history panel.

The **Student** view (`/student`) mirrors a running session in a simplified, read‑only layout for demonstrations and classrooms.

---

## 5. Configuration

There is no config file — the system is configured by **what you put in `app/stages/` and which experiments you select**. The few server‑side knobs:

| What | Where | Default |
|------|-------|---------|
| Port | `server.py` → `HTTPServer(("0.0.0.0", 8443), …)` | `8443` |
| Default UI language | `server.py` → `state["default_lang"]` (or `/api/set_lang?lang=en`) | `ru` |
| Where runs are saved | `server.py` writes to `../logs` relative to `app/` | `svetoch/logs/` |
| Certificate subject | `generate_cert()` `-subj` | `/CN=NVG-PoC` |

**Experiment categories** are just folders under `app/stages/`. Their display names come from each folder's `info.json`:

```json
{ "ru": "Нейронные сети и Трансформеры",
  "en": "Neural Networks & Transformers" }
```

---

## 6. Adding your own experiment

Each experiment is two files in a category folder:

```
app/stages/1_neural_networks/
├── stage99_myexp.js      ← the experiment logic (ES module)
└── stage99_myexp.json    ← bilingual metadata
```

The `.json` drives the catalog and UI:

```json
{
  "ru": {
    "name": "Моё название",
    "description": "Краткое описание.",
    "description_all": "Полное объяснение: физический принцип, алгоритм, метрика."
  },
  "en": {
    "name": "My title",
    "description": "Short description.",
    "description_all": "Full explanation: physical principle, algorithm, metric."
  },
  "mirrorless": false
}
```

- The numeric prefix (`stage99`) sets the order within the category.
- `mirrorless: true` marks a control experiment that also runs without the mirror.
- After adding files, regenerate the catalog: `python ../scripts/gen_experiments.py`.

The server discovers the new experiment automatically — no restart logic to change, just reload the dashboard.

---

## 7. Pure‑software validation (no phone needed)

The [`simulation/`](../simulation/) folder reproduces the core results in NumPy, useful for understanding the math and for CI.

```bash
pip install numpy
python simulation/xiaomi_12lite_llm_calc.py   # full parameter budget
python simulation/stage1_optical_channel.py   # optical channel model
python simulation/stage2_dot_product.py       # optical dot product
python simulation/stage3_single_layer.py      # one neural layer, optical vs digital
python simulation/stage4_full_inference.py    # autoregressive optical LLM
```

---

## 8. Troubleshooting

| Symptom | Likely cause & fix |
|---------|--------------------|
| Camera permission never asked | You opened `http://` not `https://`, or rejected the certificate. Re‑open the HTTPS URL and accept the warning. |
| "Phone disconnected" in admin | Phone and computer are on different networks, or a firewall blocks port 8443. Put both on the same Wi‑Fi; allow the port. |
| All metrics fail / no contrast | Too much ambient light, mirror misaligned, or screen not facing the mirror. Dim the room, re‑center the mirror under the camera. |
| Low dynamic range (~1.0) | This is exactly the **mirror‑less control** signature — check the mirror is actually reflecting the screen into the lens. |
| Screen sleeps mid‑run | Disable auto‑lock; keep the browser tab in the foreground. |
| Certificate errors on every load | Self‑signed certs are expected; accept once. Some browsers require typing `thisisunsafe` on the warning page. |
| Blurry / no focus | Increase the gap slightly; clean the lens; ensure the minimum focus distance is met (the mirror path helps here). |

---

## 9. Security note

The server uses a **self‑signed** certificate and binds to your LAN. It is meant for a trusted local network during experiments, not for exposure to the public internet. Do not commit `cert.pem` / `key.pem` (they are already git‑ignored).
