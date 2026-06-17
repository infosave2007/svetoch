<div align="center">

# ⚡ Svetoch — Optical Neural Computer

**Turn a phone, a $3 mirror, and the front camera into a working optical computer.**

🇷🇺 [Русская версия](README.ru.md) · 📖 [Setup guide](docs/SETUP.md) · 🧪 [All 101 experiments](docs/EXPERIMENTS.md) · 🗺️ [Roadmap](docs/ROADMAP.md)

</div>

---

## What is this?

**Svetoch** (Russian *светоч* — "beacon / source of light") is a proof‑of‑concept that performs real computation **in light instead of silicon**.

The phone's OLED screen displays the operands as patterns of brightness. The light bounces off an ordinary pocket mirror and is captured by the front camera. Because the camera *integrates* incoming photons over its exposure, the merging of light on the sensor physically performs additions and dot products — the core operation of every neural network — in a single optical tick.

On top of this one optical primitive the project builds a tower of **101 experiments**: from a calibrated optical channel and dot products, up through full transformer layers and autoregressive text generation, and further into wave‑physics, quantum‑gate, and classical‑algorithm analogues.

> **Cost:** ~$3 (a mirror). **Hardware:** any modern phone with an OLED/AMOLED screen and a front camera. **Reference device:** Xiaomi 12 Lite.

```
    ┌────────────────────────────────────┐
    │  [front camera]      AMOLED screen │  ← phone, screen facing DOWN
    └────────────────────────────────────┘
                    │  ~5 cm
    ╔════════════════════════════════════╗
    ║         MIRROR  10×10 cm  ($3)      ║  ← lying on the table
    ╚════════════════════════════════════╝
```

The screen shows the weights → the mirror returns the light → the camera reads the result. That round trip *is* the computation.

---

## Why it matters

- **It is real, not a simulation.** The app drives an actual screen→mirror→camera optical channel and measures what the sensor sees.
- **Built‑in control experiment.** Every claim is checked against a *mirror‑less* run: with the screen facing an open room the computational channel collapses (dynamic range 1.42 → 1.00, contrast ×4000 weaker), proving the effect comes from the optics, not from software artifacts.
- **Reproducible.** All 101 experiments are scriptable, the metrics have explicit pass thresholds, and every run is saved as JSON.
- **Hackable.** Each experiment is one small self‑contained JavaScript module in `app/stages/`. Adding an experiment is dropping in a `.js` + a bilingual `.json`.

---

## How it works (the architecture)

The system has three roles that talk over a single HTTPS port:

| Role | URL | What it does |
|------|-----|--------------|
| **Phone** | `https://<ip>:8443/` | Renders patterns on the OLED, captures camera frames, runs the experiments, posts results. |
| **Admin** | `https://<ip>:8443/admin` | Picks which experiments to run, presses Start/Stop, watches live logs and charts, downloads result JSON. |
| **Student** | `https://<ip>:8443/student` | A guided, classroom‑friendly read‑only view of a running session. |

```
   Admin dashboard  ──HTTP──►  server.py  ◄──HTTP poll──  Phone
   (choose & start)            (shared state)             (runs optics)
                                   │
                                   └── saves every run → logs/*.json
```

`server.py` is a dependency‑free Python HTTP server. It holds the shared state, relays Start/Stop commands to the phone (which polls for them), collects per‑stage results, and writes the full run to `logs/`. No WebSockets, no framework, no build step.

Experiments are **auto‑discovered**: the server scans `app/stages/<category>/stage*.js`, reads the matching `stage*.json` for bilingual names/descriptions, and exposes them via `/api/stages`. Drop a new pair of files into a category folder and it appears in the dashboard.

---

## Quick start

> Full details, troubleshooting, and tuning are in the **[Setup guide](docs/SETUP.md)**.

**Requirements:** Python 3.8+, OpenSSL (for the self‑signed certificate), a phone and a computer on the **same Wi‑Fi network**, and a small mirror.

```bash
git clone https://github.com/infosave2007/svetoch.git
cd svetoch/app
python3 server.py
```

On first launch the server generates a self‑signed certificate and prints two URLs:

```
📱 Phone: https://192.168.x.x:8443/
🖥️  Admin: https://192.168.x.x:8443/admin
```

1. **On the phone:** open the *Phone* URL, accept the self‑signed certificate warning, grant **camera** access, and allow the screen to stay on. Lay the phone screen‑down ~5 cm above the mirror.
2. **On your computer:** open the *Admin* URL, choose the experiments (or "all"), and press **Start**.
3. Watch the metrics stream in live. Each finished run is saved to `logs/nvg_poc_v3_<timestamp>.json` and can be downloaded from the dashboard.

**No mirror / no phone handy?** Run the pure‑software validation instead — see [`simulation/`](simulation/):

```bash
pip install numpy
python simulation/xiaomi_12lite_llm_calc.py   # system parameters
python simulation/stage1_optical_channel.py   # optical channel
python simulation/stage4_full_inference.py    # full optical LLM inference
```

---

## The experiments at a glance

101 experiments in four families — the full catalog with physics and pass criteria is in **[docs/EXPERIMENTS.md](docs/EXPERIMENTS.md)**.

| Family | Count | Examples |
|--------|------:|----------|
| 🧠 **Neural Networks & Transformers** | 22 | Optical channel, dot product, MatVec, a full LLM layer, SiLU, softmax, RoPE, MLP, optical CNN, LSTM via OLED persistence |
| 🌊 **Wave Physics & Foundations** | 29 | Talbot self‑imaging, interference, diffraction, Fabry‑Perot, thermal convection, coherence length |
| ⚛️ **Quantum Gates & Computing** | 24 | ψ‑superposition, θ‑Bell test, Hadamard, QFT, Grover, teleportation, Deutsch‑Jozsa, CNOT, QEC |
| 🔢 **Mathematical Algorithms** | 26 | Channel capacity, transfer‑matrix tomography, fidelity, HOM, QRNG, Shor, applied DSP |

Reference results on a Xiaomi 12 Lite (with mirror, ~37 mm gap): the optical channel is linear (R² ≈ 1.0), an optically computed neural layer matches the digital one to within ~1% accuracy, and a 2‑layer transformer generates text autoregressively at a few tokens/second.

---

## Repository layout

```
svetoch/
├── README.md / README.ru.md      ← you are here (EN / RU)
├── app/                          ← the application you run
│   ├── server.py                 ← dependency-free HTTPS control server
│   ├── index.html                ← phone client (runs the optics)
│   ├── admin.html                ← admin dashboard
│   ├── student.html              ← classroom view
│   ├── *.json                    ← UI translations & device profiles
│   └── stages/                   ← the 101 experiments (auto-discovered)
│       ├── 1_neural_networks/
│       ├── 2_wave_physics/
│       ├── 3_quantum/
│       └── 4_algorithms/
├── simulation/                   ← pure-software validation (numpy only)
├── examples/logs/                ← a sample saved run
├── docs/                         ← setup, experiment catalog, roadmap (EN + RU)
└── scripts/gen_experiments.py    ← regenerates the experiment catalog
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/SETUP.md](docs/SETUP.md) · [ru](docs/SETUP.ru.md) | Detailed installation, configuration, geometry, troubleshooting |
| [docs/EXPERIMENTS.md](docs/EXPERIMENTS.md) · [ru](docs/EXPERIMENTS.ru.md) | All 101 experiments with physics and pass criteria |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Planned experiments and scaling directions |
| [simulation/README.md](simulation/README.md) | The pure‑software validation scripts |

---

## Contributing

Adding an experiment is intentionally simple:

1. Create `app/stages/<category>/stageN_token.js` exporting the experiment logic.
2. Create `app/stages/<category>/stageN_token.json` with `ru` / `en` `name`, `description`, and `description_all`, plus a `mirrorless` flag.
3. Run `python scripts/gen_experiments.py` to refresh the catalog.

Keep new code consistent with the existing modules in the same category.

---

## License

Released under the **[Apache License 2.0](LICENSE)** (see also [NOTICE](NOTICE)). Apache 2.0 is permissive and includes an explicit **patent grant**, which makes it well suited to a project with novel optical‑computing methods.

**Using this commercially or in an institution?** Apache 2.0 already permits free commercial and educational use. If you need a separate **commercial license** — for support guarantees, indemnification, or terms beyond the Apache grant — contact the author to arrange dual licensing.

This is a research proof‑of‑concept. Pass thresholds are calibrated for the reference device and conditions; your numbers will vary with phone model, mirror quality, ambient light, and geometry.
