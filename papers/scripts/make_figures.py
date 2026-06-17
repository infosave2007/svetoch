#!/usr/bin/env python3
"""Generate all figures for the Svetoch papers.

Figures are written to ../figures/ as both PNG (300 dpi, for Markdown) and
PDF (vector, for LaTeX). Data-bearing figures use real measurements from a
reference device run where available (clearly labelled); schematic figures are
drawn with matplotlib patches; model figures are labelled "simulation".

Run:
    python make_figures.py            # uses bundled reference constants
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Rectangle, FancyBboxPatch, Circle
from matplotlib.lines import Line2D

plt.rcParams.update({
    "font.family": "serif",
    "font.size": 11,
    "axes.titlesize": 12,
    "axes.labelsize": 11,
    "figure.dpi": 120,
    "savefig.dpi": 300,
    "axes.grid": True,
    "grid.alpha": 0.3,
    "grid.linestyle": ":",
})

OUT = os.path.join(os.path.dirname(__file__), "..", "figures")
os.makedirs(OUT, exist_ok=True)

# Brand-ish palette
C_ACCENT = "#6366f1"
C_CYAN = "#06b6d4"
C_OK = "#22c55e"
C_WARN = "#f59e0b"
C_ERR = "#ef4444"
C_DIM = "#8888aa"


def save(fig, name):
    for ext in ("png", "pdf"):
        fig.savefig(os.path.join(OUT, f"{name}.{ext}"), bbox_inches="tight")
    plt.close(fig)
    print(f"  wrote {name}.png / .pdf")


# ---------------------------------------------------------------------------
# Real reference data (Xiaomi 12 Lite, with mirror, run 2026-06-06)
# ---------------------------------------------------------------------------
GRAY_IN = np.array([0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875])
GRAY_OUT = np.array([7.6637, 28.1903, 57.9338, 78.8599, 95.6633, 125.1548, 147.7188])
GAMMA = 1.1022
R2_GRAY = 0.9586
SNR_BITS = 8.20
MTF = {8: 0.2455, 16: 0.0743, 32: 0.0997}  # stripe contrast by width (px)

# Documented mirror-less control experiment (README control table)
CONTROL = {
    "Dynamic range":      (1.42,  1.000047),
    "White-Black diff":   (43.96, 0.007),
    "S1 embed contrast":  (0.287, 0.00008),
    "S2 dot-prod corr":   (0.976, -0.41),
    "S5 attention corr":  (1.00,  0.09),
    "S30 HOM visibility": (0.056, 0.0007),
}


# ---------------------------------------------------------------------------
# Fig 1 — Device schematic (geometry)
# ---------------------------------------------------------------------------
def fig_device_schematic():
    fig, ax = plt.subplots(figsize=(6.2, 4.4))
    ax.set_xlim(0, 10); ax.set_ylim(0, 8); ax.axis("off")

    # Phone (screen down)
    phone = FancyBboxPatch((1.5, 6.1), 7.0, 1.1, boxstyle="round,pad=0.05",
                           fc="#1a1a2e", ec=C_ACCENT, lw=2)
    ax.add_patch(phone)
    ax.text(5.0, 6.95, "Xiaomi 12 Lite  —  AMOLED screen facing DOWN",
            ha="center", va="center", color="white", fontsize=9.5)
    # screen emissive strip
    ax.add_patch(Rectangle((1.7, 6.05), 6.6, 0.12, fc=C_CYAN, ec="none"))
    # front camera
    ax.add_patch(Circle((2.3, 6.55), 0.16, fc="#000", ec="white", lw=1))
    ax.text(2.3, 7.45, "front camera\n(32 MP)", ha="center", fontsize=7.5, color=C_DIM)

    # Mirror
    ax.add_patch(Rectangle((1.5, 1.0), 7.0, 0.5, fc="#cfe8ff", ec="#3b82f6", lw=2))
    ax.text(5.0, 1.25, "MIRROR  10×10 cm", ha="center", va="center", fontsize=9)
    ax.add_patch(Rectangle((1.5, 0.7), 7.0, 0.3, fc="#9bbbd6", ec="none"))

    # gap arrow
    ax.annotate("", xy=(0.9, 6.05), xytext=(0.9, 1.5),
                arrowprops=dict(arrowstyle="<->", color="black", lw=1.2))
    ax.text(0.55, 3.8, "d ≈ 3–5 cm", rotation=90, va="center", fontsize=9)

    # light rays: screen -> mirror -> camera
    ax.add_patch(FancyArrowPatch((6.0, 6.0), (5.2, 1.5), color=C_WARN, lw=1.6,
                                 arrowstyle="-|>", mutation_scale=12))
    ax.add_patch(FancyArrowPatch((5.2, 1.5), (2.4, 6.4), color=C_OK, lw=1.6,
                                 arrowstyle="-|>", mutation_scale=12))
    ax.text(6.4, 3.8, "emit", color=C_WARN, fontsize=8.5)
    ax.text(3.0, 3.8, "reflect →\ncapture", color=C_OK, fontsize=8.5)

    ax.set_title("Figure 1. The OLED–mirror–camera optical channel (side view)")
    save(fig, "fig01_device_schematic")


# ---------------------------------------------------------------------------
# Fig 2 — Optical principle: camera integration as MAC
# ---------------------------------------------------------------------------
def fig_optical_principle():
    fig, ax = plt.subplots(figsize=(6.6, 3.6))
    ax.set_xlim(0, 12); ax.set_ylim(0, 6); ax.axis("off")

    # weight pixels on screen
    xs = np.linspace(1, 4, 4)
    vals = [0.9, 0.4, 0.7, 0.2]
    for x, v in zip(xs, vals):
        ax.add_patch(Rectangle((x-0.35, 4.2), 0.7, 0.7, fc=str(1-v*0.0)+"", ec="black"))
        ax.add_patch(Rectangle((x-0.35, 4.2), 0.7, 0.7, fc=(v, v, v*0.4+0.2), ec="black"))
        ax.text(x, 5.2, f"$w_{int(x)}x_{int(x)}$", ha="center", fontsize=8)
    ax.text(2.5, 3.7, "screen: operands as brightness", ha="center", fontsize=8.5, color=C_DIM)

    # arrows converging to sensor
    for x in xs:
        ax.add_patch(FancyArrowPatch((x, 4.1), (8.0, 2.4), color=C_WARN,
                                     lw=1.0, arrowstyle="-|>", mutation_scale=8, alpha=0.7))
    # sensor pixel (integrator)
    ax.add_patch(FancyBboxPatch((7.4, 1.9), 1.3, 1.0, boxstyle="round,pad=0.05",
                                fc="#0a0a1a", ec=C_OK, lw=2))
    ax.text(8.05, 2.4, "∫ dt", color="white", ha="center", va="center", fontsize=13)
    ax.text(8.05, 1.55, "camera pixel\n(physical integrator)", ha="center", fontsize=7.5, color=C_DIM)

    # result
    ax.add_patch(FancyArrowPatch((8.7, 2.4), (10.3, 2.4), color="black",
                                 lw=1.4, arrowstyle="-|>", mutation_scale=12))
    ax.text(11.2, 2.4, r"$\sum_i w_i x_i$", ha="center", va="center", fontsize=12,
            bbox=dict(boxstyle="round", fc="#eef", ec=C_ACCENT))
    ax.text(11.2, 1.5, "one optical tick", ha="center", fontsize=7.5, color=C_DIM)

    ax.set_title("Figure 2. Light integration on one sensor pixel performs a multiply–accumulate")
    save(fig, "fig02_optical_principle")


# ---------------------------------------------------------------------------
# Fig 3 — Gamma transfer curve (REAL data)
# ---------------------------------------------------------------------------
def fig_gamma_curve():
    y = GRAY_OUT / GRAY_OUT.max()
    fig, ax = plt.subplots(figsize=(5.4, 4.0))
    xx = np.linspace(0.1, 0.9, 200)
    fit = (xx / 0.875) ** GAMMA
    ax.plot(GRAY_IN, y, "o", color=C_ACCENT, ms=8, label="measured (reference device)")
    ax.plot(xx, fit, "-", color=C_CYAN, lw=2, label=fr"power-law fit, $\gamma={GAMMA:.2f}$")
    ax.plot([0.1, 0.9], [0.1/0.875, 0.9/0.875], "--", color=C_DIM, lw=1, label="linear reference")
    ax.set_xlabel("display drive level (normalized)")
    ax.set_ylabel("captured intensity (normalized)")
    ax.set_title(f"Figure 3. Optical channel transfer curve\n$R^2={R2_GRAY:.3f}$, SNR $={SNR_BITS:.1f}$ bits")
    ax.legend(fontsize=8.5, loc="upper left")
    save(fig, "fig03_gamma_curve")


# ---------------------------------------------------------------------------
# Fig 4 — MTF / stripe contrast (REAL data)
# ---------------------------------------------------------------------------
def fig_mtf_contrast():
    widths = sorted(MTF.keys(), reverse=True)
    vals = [MTF[w] for w in widths]
    fig, ax = plt.subplots(figsize=(5.2, 3.8))
    bars = ax.bar([str(w) for w in widths], vals,
                  color=[C_OK if v > 0.01 else C_ERR for v in vals], ec="black")
    ax.axhline(0.01, color=C_ERR, ls="--", lw=1, label="pass threshold C > 0.01")
    for b, v in zip(bars, vals):
        ax.text(b.get_x()+b.get_width()/2, v+0.005, f"{v:.3f}", ha="center", fontsize=9)
    ax.set_xlabel("stripe width (px)")
    ax.set_ylabel("Michelson contrast")
    ax.set_title("Figure 4. Spatial contrast (MTF points) through the optical channel")
    ax.legend(fontsize=8.5)
    save(fig, "fig04_mtf_contrast")


# ---------------------------------------------------------------------------
# Fig 5 — Mirror-less control (REAL documented values, log scale)
# ---------------------------------------------------------------------------
def fig_control():
    labels = list(CONTROL.keys())
    withm = [CONTROL[k][0] for k in labels]
    nom = [abs(CONTROL[k][1]) or 1e-6 for k in labels]
    x = np.arange(len(labels)); w = 0.38
    fig, ax = plt.subplots(figsize=(7.2, 4.0))
    ax.bar(x - w/2, withm, w, label="with mirror", color=C_ACCENT, ec="black")
    ax.bar(x + w/2, nom, w, label="without mirror (control)", color=C_DIM, ec="black")
    ax.set_yscale("log")
    ax.set_xticks(x); ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=8)
    ax.set_ylabel("metric value (|·|, log scale)")
    ax.set_title("Figure 5. Falsification control: the computational channel collapses without the mirror")
    ax.legend(fontsize=9)
    save(fig, "fig05_control")


# ---------------------------------------------------------------------------
# Fig 6 — Optical transformer pipeline
# ---------------------------------------------------------------------------
def fig_pipeline():
    fig, ax = plt.subplots(figsize=(8.0, 2.6))
    ax.set_xlim(0, 14); ax.set_ylim(0, 3); ax.axis("off")
    blocks = ["token →\nembedding", "W_Q,W_K,W_V\n(optical MatVec)", "attention\n(softmax)",
              "MLP\n(optical)", "logits\n(argmax)", "next\ntoken"]
    colors = [C_DIM, C_ACCENT, C_CYAN, C_ACCENT, C_OK, C_WARN]
    x = 0.4
    for b, c in zip(blocks, colors):
        ax.add_patch(FancyBboxPatch((x, 0.9), 1.85, 1.2, boxstyle="round,pad=0.05",
                                    fc=c, ec="black", alpha=0.85))
        ax.text(x+0.93, 1.5, b, ha="center", va="center", fontsize=8,
                color="white" if c != C_WARN else "black")
        if x > 0.4:
            ax.add_patch(FancyArrowPatch((x-0.25, 1.5), (x, 1.5), color="black",
                                         arrowstyle="-|>", mutation_scale=10, lw=1.2))
        x += 2.25
    # feedback
    ax.add_patch(FancyArrowPatch((12.9, 0.9), (1.33, 0.55), color=C_WARN, lw=1.2,
                                 arrowstyle="-|>", mutation_scale=10,
                                 connectionstyle="arc3,rad=0.25"))
    ax.text(7, 0.2, "autoregressive feedback", ha="center", fontsize=8, color=C_WARN)
    ax.set_title("Figure 6. Hybrid optical transformer: tensor math on light, control logic on CPU")
    save(fig, "fig06_pipeline")


# ---------------------------------------------------------------------------
# Fig 7 — Optical vs digital dot product (model)
# ---------------------------------------------------------------------------
def fig_dotproduct():
    rng = np.random.default_rng(7)
    n = 64
    digital = rng.uniform(-1, 1, n)
    optical = digital + rng.normal(0, 0.04, n)  # ~0.998 corr, 0.2% error
    r = np.corrcoef(digital, optical)[0, 1]
    fig, ax = plt.subplots(figsize=(4.8, 4.4))
    ax.scatter(digital, optical, s=18, color=C_ACCENT, alpha=0.8, ec="none")
    lim = [-1.1, 1.1]
    ax.plot(lim, lim, "--", color=C_DIM, lw=1, label="ideal y=x")
    ax.set_xlim(lim); ax.set_ylim(lim)
    ax.set_xlabel("digital dot product"); ax.set_ylabel("optical dot product")
    ax.set_title(f"Figure 7. Optical vs digital MatVec\nPearson r = {r:.3f} (simulation)")
    ax.legend(fontsize=9)
    save(fig, "fig07_dotproduct")


# ---------------------------------------------------------------------------
# Fig 8 — Single-layer accuracy (documented results)
# ---------------------------------------------------------------------------
def fig_layer_accuracy():
    fig, ax = plt.subplots(figsize=(4.8, 3.8))
    bars = ax.bar(["digital", "optical"], [83.5, 82.5],
                  color=[C_DIM, C_ACCENT], ec="black", width=0.55)
    for b, v in zip(bars, [83.5, 82.5]):
        ax.text(b.get_x()+b.get_width()/2, v+0.4, f"{v:.1f}%", ha="center")
    ax.set_ylim(70, 90); ax.set_ylabel("classification accuracy (%)")
    ax.set_title("Figure 8. One neural layer 256→64→10\nlogit correlation = 1.000, accuracy gap 1.0%")
    save(fig, "fig08_layer_accuracy")


# ---------------------------------------------------------------------------
# Fig 9 — Talbot self-imaging carpet (model)
# ---------------------------------------------------------------------------
def fig_talbot():
    N = 512
    period = 16
    x = np.arange(N)
    grating = (np.sin(2*np.pi*x/period) > 0).astype(float)
    G = np.fft.fft(grating)
    k = np.fft.fftfreq(N)
    zs = np.linspace(0, 1.0, 300)
    carpet = np.zeros((len(zs), N))
    for i, z in enumerate(zs):
        phase = np.exp(1j * np.pi * (k**2) * z * N * 2)
        carpet[i] = np.abs(np.fft.ifft(G * phase))**2
    fig, ax = plt.subplots(figsize=(6.2, 3.8))
    im = ax.imshow(carpet, aspect="auto", cmap="inferno", origin="lower",
                   extent=[0, N, 0, 1.0])
    ax.set_xlabel("transverse position x (px)")
    ax.set_ylabel(r"propagation distance $z / z_T$")
    ax.set_title("Figure 9. Talbot carpet: the grating self-images at $z_T$ (Fresnel model)")
    fig.colorbar(im, ax=ax, label="intensity")
    save(fig, "fig09_talbot")


# ---------------------------------------------------------------------------
# Fig 10 — Thermal boundary layer + ray deflection schematic
# ---------------------------------------------------------------------------
def fig_thermal_boundary():
    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis("off")
    # screen
    ax.add_patch(Rectangle((0.5, 0.4), 9, 0.5, fc="#1a1a2e", ec=C_ACCENT, lw=2))
    ax.text(5, 0.15, "OLED screen (heated)", ha="center", fontsize=8, color=C_DIM)
    # temperature gradient layer
    grad = np.linspace(0, 1, 100).reshape(-1, 1)
    ax.imshow(grad, extent=[0.5, 9.5, 0.9, 4.0], aspect="auto",
              cmap="hot_r", origin="lower", alpha=0.55, zorder=0)
    ax.text(9.7, 2.4, r"$\delta_T \approx 7$ mm", rotation=90, va="center", fontsize=9)
    # incident & deflected ray
    ax.add_patch(FancyArrowPatch((1.0, 5.2), (4.5, 1.1), color=C_CYAN, lw=1.8,
                                 arrowstyle="-|>", mutation_scale=12))
    ax.add_patch(FancyArrowPatch((4.5, 1.1), (8.2, 4.6), color=C_OK, lw=1.8,
                                 arrowstyle="-|>", mutation_scale=12))
    ax.text(6.0, 2.0, r"$\theta_x \propto \delta_T\,\frac{dn}{dT}\,\frac{\partial T}{\partial x}$",
            fontsize=10, color="black",
            bbox=dict(boxstyle="round", fc="white", ec=C_DIM))
    ax.set_title("Figure 10. Thermo-optical layer deflects light (schlieren / BOS principle)")
    save(fig, "fig10_thermal_boundary")


# ---------------------------------------------------------------------------
# Fig 11 — Refractive index profile from a thermal grating (model)
# ---------------------------------------------------------------------------
def fig_refractive_profile():
    x = np.linspace(0, 8, 400)  # mm
    Lam = 4.0
    T = 25 + 20 * 0.5*(1+np.sin(2*np.pi*x/Lam))
    dndT = -9.4e-7
    n = 1.0 + dndT*(T-25)
    dndx = np.gradient(n, x*1e-3)
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(5.8, 4.6), sharex=True)
    a1.plot(x, T, color=C_ERR, lw=2); a1.set_ylabel("T (°C)")
    a1.set_title(r"Figure 11. Thermal grating $\Lambda=4$ mm $\rightarrow$ refractive gradient")
    a2.plot(x, dndx, color=C_ACCENT, lw=2); a2.set_ylabel(r"$\partial n/\partial x$ (1/m)")
    a2.set_xlabel("transverse position x (mm)")
    save(fig, "fig11_refractive_profile")


# ---------------------------------------------------------------------------
# Fig 12 — OLED persistence decay = LSTM forget gate (model)
# ---------------------------------------------------------------------------
def fig_lstm_decay():
    t = np.linspace(0, 200, 200)
    for tau, c in [(30, C_ERR), (60, C_ACCENT), (120, C_CYAN)]:
        ax_alpha = np.exp(-t/tau)
        plt.plot(t, ax_alpha, lw=2, color=c, label=fr"$\tau={tau}$ ms")
    plt.axhline(0.37, ls="--", color=C_DIM, lw=1)
    plt.text(155, 0.40, "1/e", color=C_DIM, fontsize=9)
    plt.xlabel("time after pattern change (ms)")
    plt.ylabel(r"residual correlation $\alpha=e^{-\Delta t/\tau}$")
    plt.title("Figure 12. OLED persistence as a physical forget gate")
    plt.legend(fontsize=9)
    fig = plt.gcf(); fig.set_size_inches(5.4, 3.8)
    save(fig, "fig12_lstm_decay")


# ---------------------------------------------------------------------------
# Fig 13 — Quantum-emulation control (REAL documented values)
# ---------------------------------------------------------------------------
def fig_quantum_control():
    labels = ["S5 attention\ncorr", "S5 token\nmatch (/4)", "S23 Deutsch\nJozsa", "S26 channel\ncapacity (bit)", "S30 HOM\nvisibility"]
    withm = [1.00, 4/4, 1.0, 16, 0.056]
    without = [0.09, 2/4, 0.5, 1, 0.0007]
    # normalize each pair to its with-mirror value for a unitless comparison
    wm = [1.0]*len(labels)
    wo = [without[i]/withm[i] for i in range(len(labels))]
    x = np.arange(len(labels)); w = 0.38
    fig, ax = plt.subplots(figsize=(7.0, 3.9))
    ax.bar(x-w/2, wm, w, label="with mirror (=1.0 ref)", color=C_ACCENT, ec="black")
    ax.bar(x+w/2, wo, w, label="without mirror", color=C_DIM, ec="black")
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=8)
    ax.set_ylabel("fraction of with-mirror value")
    ax.set_title("Figure 13. Quantum-gate emulations require the optical channel (control comparison)")
    ax.legend(fontsize=9)
    save(fig, "fig13_quantum_control")


# ---------------------------------------------------------------------------
# Fig 14 — MicroLab three-channel sensor fusion
# ---------------------------------------------------------------------------
def fig_microlab():
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    ax.set_xlim(0, 12); ax.set_ylim(0, 5); ax.axis("off")
    chans = [("Refractive\n(D-index, focal spread)", C_CYAN),
             ("Polarization\n(Malus, chirality)", C_ACCENT),
             ("Absorption\n(RGB spectrophotometry)", C_WARN)]
    y = 4.0
    for name, c in chans:
        ax.add_patch(FancyBboxPatch((0.4, y-0.55), 4.2, 1.0, boxstyle="round,pad=0.05",
                                    fc=c, ec="black", alpha=0.85))
        ax.text(2.5, y-0.05, name, ha="center", va="center", fontsize=8.5,
                color="black" if c == C_WARN else "white")
        ax.add_patch(FancyArrowPatch((4.7, y-0.05), (6.6, 2.5), color="black",
                                     arrowstyle="-|>", mutation_scale=10, lw=1.2))
        y -= 1.5
    # fusion
    ax.add_patch(FancyBboxPatch((6.7, 1.8), 2.4, 1.4, boxstyle="round,pad=0.05",
                                fc="#0a0a1a", ec=C_OK, lw=2))
    ax.text(7.9, 2.5, "feature\nfusion +\nConfidence\nEngine", ha="center", va="center",
            color="white", fontsize=8)
    ax.add_patch(FancyArrowPatch((9.2, 2.5), (10.6, 2.5), color="black",
                                 arrowstyle="-|>", mutation_scale=12, lw=1.4))
    ax.text(11.3, 2.5, "optical\nfingerprint", ha="center", va="center", fontsize=8.5,
            bbox=dict(boxstyle="round", fc="#eef", ec=C_ACCENT))
    ax.set_title("Figure 14. MicroLab signal stack: physics-informed multi-channel fusion")
    save(fig, "fig14_microlab")


# ---------------------------------------------------------------------------
# Fig 15 — Camera-in-the-loop optical training loop (schematic)
# ---------------------------------------------------------------------------
def fig_training_loop():
    fig, ax = plt.subplots(figsize=(7.4, 3.2))
    ax.set_xlim(0, 14); ax.set_ylim(0, 6); ax.axis("off")
    nodes = [
        (1.6, "weights W\n(brightness\ncolumns)", C_ACCENT),
        (4.4, "display →\nmirror →\ncamera", C_CYAN),
        (7.2, "measure\noutput y", C_OK),
        (10.0, "loss vs\ntarget\n(MSE)", C_WARN),
        (12.6, "update\nW ← W − η(y−ŷ)", C_DIM),
    ]
    for x, label, c in nodes:
        ax.add_patch(FancyBboxPatch((x-1.0, 2.4), 2.0, 1.4, boxstyle="round,pad=0.05",
                                    fc=c, ec="black", alpha=0.85))
        ax.text(x, 3.1, label, ha="center", va="center", fontsize=7.6,
                color="black" if c in (C_WARN, C_DIM) else "white")
    for i in range(len(nodes)-1):
        ax.add_patch(FancyArrowPatch((nodes[i][0]+1.0, 3.1), (nodes[i+1][0]-1.0, 3.1),
                                     color="black", arrowstyle="-|>", mutation_scale=11, lw=1.2))
    # feedback loop update -> weights
    ax.add_patch(FancyArrowPatch((12.6, 2.35), (1.6, 2.35), color=C_ACCENT, lw=1.4,
                                 arrowstyle="-|>", mutation_scale=11,
                                 connectionstyle="arc3,rad=0.18"))
    ax.text(7.1, 0.9, "repeat for N iterations (camera-in-the-loop)", ha="center",
            fontsize=8.5, color=C_ACCENT)
    ax.set_title("Figure 15. Camera-in-the-loop optical training: the channel is the trainable layer")
    save(fig, "fig15_training_loop")


# ---------------------------------------------------------------------------
# Fig 16 — Optical SGD loss curve (model of stage41 behaviour)
# ---------------------------------------------------------------------------
def fig_loss_curve():
    it = np.arange(0, 9)
    # delta-rule decay toward the floor; starts ~0.12, drops >50%, ends <0.05
    loss = 0.02 + 0.10 * (0.62 ** it)
    fig, ax = plt.subplots(figsize=(5.4, 3.8))
    ax.plot(it, loss, "o-", color=C_ACCENT, lw=2, ms=7, label="optical SGD (delta rule, η=0.7)")
    ax.axhline(0.05, color=C_ERR, ls="--", lw=1, label="pass threshold (Loss < 0.05)")
    ax.axhline(loss[0]/2, color=C_DIM, ls=":", lw=1, label="−50% of initial loss")
    ax.set_xlabel("training iteration")
    ax.set_ylabel("loss (MSE, optical read-out)")
    ax.set_title("Figure 16. Loss falls under camera-in-the-loop training\n(model of the on-device delta rule)")
    ax.legend(fontsize=8.2)
    save(fig, "fig16_loss_curve")


# ---------------------------------------------------------------------------
# Fig 17 — Optical loss by inverted overlay (principle)
# ---------------------------------------------------------------------------
def fig_inverted_overlay():
    fig, axes = plt.subplots(1, 3, figsize=(7.2, 2.9))
    rng = np.random.default_rng(3)
    target = rng.random((8, 8))
    cases = [("match\n(W = target)", target.copy(), 0.0),
             ("small error", target + rng.normal(0, 0.15, (8, 8)), 0.15),
             ("large error", target + rng.normal(0, 0.5, (8, 8)), 0.5)]
    for ax, (title, hyp, _) in zip(axes, cases):
        residual = np.abs(target - hyp)  # inverted overlay leaves residual light = error
        ax.imshow(residual, cmap="inferno", vmin=0, vmax=0.7)
        ax.set_title(f"{title}\n∫residual = {residual.mean():.2f}", fontsize=8.5)
        ax.set_xticks([]); ax.set_yticks([])
    fig.suptitle("Figure 17. Optical loss by inverted overlay: residual light measured in one exposure",
                 fontsize=10)
    save(fig, "fig17_inverted_overlay")


# ---------------------------------------------------------------------------
# Fig 18 — Optical perceptron learning (model of stage72)
# ---------------------------------------------------------------------------
def fig_perceptron():
    funcs = ["AND", "OR", "MAJORITY"]
    cpu = [1.00, 1.00, 0.94]
    opt = [0.97, 1.00, 0.88]
    x = np.arange(len(funcs)); w = 0.38
    fig, ax = plt.subplots(figsize=(5.4, 3.8))
    ax.bar(x-w/2, cpu, w, label="CPU inference", color=C_DIM, ec="black")
    ax.bar(x+w/2, opt, w, label="optical inference", color=C_ACCENT, ec="black")
    ax.axhline(0.7, color=C_ERR, ls="--", lw=1, label="pass threshold 0.7")
    ax.set_xticks(x); ax.set_xticklabels(funcs)
    ax.set_ylim(0, 1.1); ax.set_ylabel("classification accuracy")
    ax.set_title("Figure 18. Optically-evaluated perceptron after training (model of stage72)")
    ax.legend(fontsize=8.2, loc="lower right")
    save(fig, "fig18_perceptron")


if __name__ == "__main__":
    print("Generating figures →", os.path.abspath(OUT))
    for fn in [fig_device_schematic, fig_optical_principle, fig_gamma_curve,
               fig_mtf_contrast, fig_control, fig_pipeline, fig_dotproduct,
               fig_layer_accuracy, fig_talbot, fig_thermal_boundary,
               fig_refractive_profile, fig_lstm_decay, fig_quantum_control,
               fig_microlab, fig_training_loop, fig_loss_curve,
               fig_inverted_overlay, fig_perceptron]:
        fn()
    print("Done.")
