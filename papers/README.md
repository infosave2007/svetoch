# Svetoch — Scientific Papers (Zenodo preprints)

This folder contains the scientific write-ups of the methods and results behind the
**Svetoch** optical-neural-computer project. They are written to **establish public
authorship and priority** of the ideas (defensive publication) and are formatted for
**[Zenodo](https://zenodo.org/)**, where each is published with a citable DOI and a timestamp
(see the table at the bottom).

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

## Notes for updates / re-use

- **Author:** *Oleg Yuryevich Kirichenko* (urevich55@gmail.com, GitHub @infosave2007).
  An affiliation and [ORCID](https://orcid.org/) iD can be added to a new Zenodo version.
- **Text license:** CC BY 4.0 is standard for Zenodo preprints; the code stays under
  Apache 2.0.
- **Regenerate figures:** `python scripts/make_figures.py` (needs `numpy`, `matplotlib`).
- **New versions:** edit the `paper.tex`, recompile, and upload as a new version of the same
  Zenodo record (the DOI auto-versions).

---

## The papers

| # | Title | Theme | Figures |
|---|-------|-------|---------|
| **I** | [Optical Neural Computation on a Commodity Smartphone: the OLED–Mirror–Camera Channel](paper1_optical_neural_computation/paper.md) — [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20729632.svg)](https://doi.org/10.5281/zenodo.20729632) | The core method: light as an analog matrix engine; channel calibration; dot product → MatVec → a full transformer layer; the falsification control | 1–9 |
| **II** | [Hardware Neural-Network Primitives from Commodity Display Physics](paper2_display_physics_primitives/paper.md) — [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20730065.svg)](https://doi.org/10.5281/zenodo.20730065) | "Free" ML operators from device physics: γ-curve activation, OLED-persistence recurrent memory, Bayer attention multiplexing, chromatic positional encoding | 3, 6, 12 |
| **III** | [A Thermo-Optical Convection Layer above an OLED Display as a Programmable Analog Medium](paper3_thermo_optical_convection/paper.md) — [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20730198.svg)](https://doi.org/10.5281/zenodo.20730198) | The mirror-less thermal channel: boundary-layer theory, schlieren/BOS read-out, thermo-optical matrix multiply, convective actuation of aerosols | 1, 10, 11 |
| **IV** | [Classical Wave-Optical Emulation of Quantum-Gate Algebra on a Smartphone, with a Falsification Protocol](paper4_quantum_gate_emulation/paper.md) — [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20730267.svg)](https://doi.org/10.5281/zenodo.20730267) | Honest framing of the "quantum" stages as **classical** wave-optical analogues; a rigorous mirror-less control that separates optical effects from software artifacts | 5, 9, 13 |
| **V** | [Computational Optics for Liquid Microsampling: a Multi-Channel Smartphone Sensing Platform](paper5_computational_optics_biosensing/paper.md) — [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20730337.svg)](https://doi.org/10.5281/zenodo.20730337) | The MicroLab application: refractive + polarization + absorption sensor fusion, a confidence engine, and validation discipline | 14 |
| **VI** | [Camera-in-the-Loop Optical Training of a Physical Diffractive Network on a Smartphone](paper6_optical_training/paper.md) — [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20730393.svg)](https://doi.org/10.5281/zenodo.20730393) | Closing the loop: on-device optical **training** — camera-in-the-loop gradient descent, single-shot inverted-overlay loss, and an optically-evaluated perceptron | 15–18 |

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

## Published records & how to cite

All six papers are published on Zenodo, each with a citable DOI and timestamp:

| Paper | DOI |
|-------|-----|
| **I** — Optical Neural Computation on a Commodity Smartphone | [10.5281/zenodo.20729632](https://doi.org/10.5281/zenodo.20729632) |
| **II** — Hardware Neural-Network Primitives from Commodity Display Physics | [10.5281/zenodo.20730065](https://doi.org/10.5281/zenodo.20730065) |
| **III** — A Thermo-Optical Convection Layer above an OLED Display | [10.5281/zenodo.20730198](https://doi.org/10.5281/zenodo.20730198) |
| **IV** — Classical Wave-Optical Emulation of Quantum-Gate Algebra | [10.5281/zenodo.20730267](https://doi.org/10.5281/zenodo.20730267) |
| **V** — Computational Optics for Liquid Microsampling | [10.5281/zenodo.20730337](https://doi.org/10.5281/zenodo.20730337) |
| **VI** — Camera-in-the-Loop Optical Training | [10.5281/zenodo.20730393](https://doi.org/10.5281/zenodo.20730393) |

Example citation (Paper I):

> Kirichenko, O. Yu. (2026). *Optical Neural Computation on a Commodity Smartphone: the
> OLED–Mirror–Camera Channel as an Analog Matrix Engine* (Svetoch, Paper I). Zenodo.
> https://doi.org/10.5281/zenodo.20729632
