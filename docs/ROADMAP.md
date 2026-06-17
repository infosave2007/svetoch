# Roadmap / Дорожная карта

Planned experiments and scaling directions beyond the current 101. Status legend: ❌ not started · 🟡 partial · ✅ done.

Запланированные эксперименты и направления масштабирования сверх текущих 101. Статусы: ❌ не начат · 🟡 частично · ✅ готово.

---

## 🔴 Priority 1 — Publication‑grade experiments / Публикационные эксперименты

| Experiment | Status | Why it matters / Зачем |
|------------|:------:|------------------------|
| **Temperature dependence of θ‑coherence** | ❌ | The single test that distinguishes this model from standard QM: it predicts `dS/dT < 0` (entanglement falls when the mirror is heated 30°→50°→70°C), whereas standard QM predicts `dS/dT = 0`. / Единственный тест, отличающий модель от стандартной КМ. |
| **Calibrated Talbot — predict zₜ before measuring** | ❌ | Predict `zₜ(R)=193 µm < zₜ(G)=230 µm < zₜ(B)=265 µm`, then measure R/G/B contrast at 6 distances. Predicting before measuring is the publication standard. / Предсказать до измерения. |
| **Cross‑device reproducibility** | ❌ | Same test on another phone with a different pixel pitch. If `zₜ` scales as `p²`, it is physics, not a sensor artifact. / Главный аргумент против «артефакта сенсора». |
| **θ‑coherence length L_θ** | 🟡 | `S(z)` at 6 distances, fit `S(z)=S_max·exp(−z/L_θ)`. Data exists at 4 cm and 6 cm. / Есть данные на 4 и 6 см. |
| **Blind verification** | ❌ | A reviewer sends unknown vectors; you measure them blind. / Слепая верификация. |

---

## 🔴 Priority 2 — Broadening the evidence / Расширение доказательной базы

| Experiment | Status | Idea / Идея |
|------------|:------:|-------------|
| **Talbot carpet — full z‑map** | ❌ | Scan the mirror 1→10 cm (0.5 cm step), build a 2D `I(x, z)` map, locate `zₜ/4`, `zₜ/2`, `zₜ`. Needs a tripod + micrometer stage. |
| **Phase‑noise spectroscopy** | ❌ | 600 frames over 60 s at a fixed pattern; PSD `P(f)=|FFT(I(t))|²` to find `f_θ = 1/τ`. |
| **Mirror comparison** | ❌ | Bathroom / first‑surface / CD / metal — pick the best reflector. |

---

## 🟡 Priority 3 — New ML primitives / Новые ML‑примитивы

- **BB84 quantum key distribution** — 8 bits × 2 bases, sift by basis; target QBER < 11%.
- **Optical LSTM** — exploit OLED persistence (`τ ≈ 1–5 ms`) as a physical forget gate `α = e^{−Δt/τ}`.
- **Batch normalization** — measure 4 columns, normalize, re‑display, re‑measure.
- **Optical SGD** — 5–10 iterations of show‑W → measure‑y → loss → update‑W; target loss −50% in 5 steps.
- **Extended LLM (8 tokens)** — grow autoregression from 4 to 8 tokens; target match ≥ 6/8.
- **Optical image classifier** — 3 letters × 3 orientations; target accuracy > 66%.
- **1‑cycle optical reservoir / physical ELM** — defocus blur as a 2D convolution, inference in a single frame; target ≥ 5 tokens/s, ridge `R² ≥ 85%`.
- **Nanolithography & chip metrology** — spatial NVG oscillations (`λ_eff ≈ 30 nm`) for photomask overlay control and defect inspection without EUV/SEM.

---

## 🟢 Priority 4 — Advanced quantum protocols / Продвинутые квантовые протоколы

Entanglement witness · multi‑mirror cavity · quantum random walk · Bernstein‑Vazirani · Simon's algorithm · E91 QKD · superdense coding.

---

## Scaling beyond the PoC / Масштабирование после PoC

| Next step | d_model | Cost | Payoff |
|-----------|--------:|-----:|--------|
| Samsung S24 Ultra | 1440 | $3 | More parameters |
| + macro lens (7.5 mm) | 1080 | $8 | SNR > 10,000 |
| Optical RFC (OPA chip) | 6144 | $5,000 | 100+ tokens/s |

---

## Run history (reference device) / История прогонов

| Date | Gap | Dynamic range | Passed | Note |
|------|-----|--------------:|:------:|------|
| 03.06 08:38 | ~4 cm | 1.2 : 1 | 11/35 | First full run |
| 03.06 10:50 | ~7.5 cm | 1.92 : 1 | 13/35 | Best dynamic range |
| 03.06 12:23 | 6 cm | 1.07 : 1 | 14/35 | QRNG ✅, θ‑Collapse ✅ |
| 03.06 | 37 mm | — | — | `zₜ/4` — expected maximum |

> The experiment set has since grown to **101**. See [EXPERIMENTS.md](EXPERIMENTS.md) for the current catalog.
