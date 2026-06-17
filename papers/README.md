# Svetoch — Scientific Papers (Zenodo preprints)

This folder contains the scientific write-ups of the methods and results behind the
**Svetoch** optical-neural-computer project. They are written to **establish public
authorship and priority** of the ideas (defensive publication) and are formatted for
upload to **[Zenodo](https://zenodo.org/)**, which mints a citable DOI and a timestamp.

> The author has chosen **not to patent** these ideas. Publishing them here, with a
> Zenodo DOI and timestamp, places them in the public record as **prior art** and
> documents the author's contribution and the date of disclosure.

Each paper is provided in two formats:

- **`paper.md`** — Markdown, with embedded figures (`../figures/*.png`). Readable on GitHub.
- **`paper.tex`** — LaTeX (`article` class), with vector figures (`../figures/*.pdf`).
  Compile from inside the paper's folder: `pdflatex paper.tex`.

All papers are in **English**, complete from the device principle through results, with
figures, graphs and diagrams.

---

## ⚠️ Before publishing on Zenodo

1. **Author block.** The papers list the author as *Oleg Yuryevich Kirichenko*
   (urevich55@gmail.com, GitHub @infosave2007). Optionally add an affiliation and an
   [ORCID](https://orcid.org/) iD.
2. **Pick a license** for the text (e.g. CC BY 4.0 is standard for Zenodo preprints; the
   code stays under Apache 2.0).
3. **Regenerate figures if needed:** `python scripts/make_figures.py` (needs `numpy`,
   `matplotlib`).
4. Upload each paper's PDF (compiled from `paper.tex`) plus the `.md`/`.tex` sources.
   Group them as a Zenodo *series* or one record per paper.

---

## The papers

| # | Title | Theme | Figures |
|---|-------|-------|---------|
| **I** | [Optical Neural Computation on a Commodity Smartphone: the OLED–Mirror–Camera Channel](paper1_optical_neural_computation/paper.md) | The core method: light as an analog matrix engine; channel calibration; dot product → MatVec → a full transformer layer; the falsification control | 1–9 |
| **II** | [Hardware Neural-Network Primitives from Commodity Display Physics](paper2_display_physics_primitives/paper.md) | "Free" ML operators from device physics: γ-curve activation, OLED-persistence recurrent memory, Bayer attention multiplexing, chromatic positional encoding | 3, 6, 12 |
| **III** | [A Thermo-Optical Convection Layer above an OLED Display as a Programmable Analog Medium](paper3_thermo_optical_convection/paper.md) | The mirror-less thermal channel: boundary-layer theory, schlieren/BOS read-out, thermo-optical matrix multiply, convective actuation of aerosols | 1, 10, 11 |
| **IV** | [Classical Wave-Optical Emulation of Quantum-Gate Algebra on a Smartphone, with a Falsification Protocol](paper4_quantum_gate_emulation/paper.md) | Honest framing of the "quantum" stages as **classical** wave-optical analogues; a rigorous mirror-less control that separates optical effects from software artifacts | 5, 9, 13 |
| **V** | [Computational Optics for Liquid Microsampling: a Multi-Channel Smartphone Sensing Platform](paper5_computational_optics_biosensing/paper.md) | The MicroLab application: refractive + polarization + absorption sensor fusion, a confidence engine, and validation discipline | 14 |
| **VI** | [Camera-in-the-Loop Optical Training: Gradient Descent and the Perceptron Rule on a Smartphone Display–Camera Channel](paper6_optical_training/paper.md) | Closing the loop: on-device optical **training** — camera-in-the-loop gradient descent, single-shot inverted-overlay loss, and an optically-evaluated perceptron | 15–18 |

---

## Reproducibility

- **Real-data figures** (channel transfer curve, MTF contrasts, control comparison) use
  measurements from a Xiaomi 12 Lite reference run (June 2026); the constants are embedded
  in [`scripts/make_figures.py`](scripts/make_figures.py).
- **Model figures** (Talbot carpet, dot-product scatter, persistence decay) are labelled
  *simulation* and are reproducible from the same script.
- The experiments themselves are in [`../app/stages/`](../app/stages/); the pure-software
  validation is in [`../simulation/`](../simulation/).

## Related repositories

- **[github.com/infosave2007/svetoch](https://github.com/infosave2007/svetoch)** — this project: the optical-computer app, the 101 experiments, simulation, and these papers.
- **[github.com/infosave2007/vmf](https://github.com/infosave2007/vmf)** — the VMF/NVG theory that inspires the thermo-optical analogy (Paper III).

Both links are cited in every paper's header and "Data and code" section.

## How to cite (placeholder)

> Kirichenko, O. Yu. (2026). *Svetoch: Optical Neural Computation on Commodity Smartphone
> Hardware* (Series I–VI). Zenodo. https://doi.org/XX.XXXX/zenodo.XXXXXXX

Fill in the DOI after the first Zenodo upload.
