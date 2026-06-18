🇷🇺 [Русская версия](EXPERIMENTS.ru.md)

# Experiment Catalog

This repository ships **102 optical-computing experiments** grouped into four families. Every experiment runs on the phone (`index.html`), is launched from the admin dashboard (`/admin`), and reports a pass/fail metric back to the server, which stores the full run as JSON in `logs/`.

Each entry below lists the short description and the detailed physical / algorithmic explanation taken directly from the experiment's metadata. A 🪞 marker means the experiment **requires the mirror**; a 📵 marker means it also works **without the mirror** (used as a control / device-only test).

## Contents

- [Neural Networks & Transformers](#neural-networks-transformers) — 23 experiments
- [Wave Physics & Foundations](#wave-physics-foundations) — 29 experiments
- [Quantum Gates & Computing](#quantum-gates-computing) — 24 experiments
- [Mathematical Algorithms & Applications](#mathematical-algorithms-applications) — 26 experiments

---

## Neural Networks & Transformers

### 1. Optical Channel Calibration

`stage1_channel` · 🪞 requires mirror

*Analysis of the basic optical properties of the "screen-to-camera" channel.*

Optical communication channel.

**Physical principle:** (With mirror). The signal is shown on the screen, reflected off the mirror and captured by the front camera.
**Algorithmic essence:** Vertical stripes of width 32, 16 and 8 px are displayed; the camera grabs a frame and for each width the stripe contrast is computed (MTF points). Then a horizontal black-to-white gradient is shown, and the linearity of the grayscale transfer through the optical path is measured (R² coefficient).
**Analogy:** Basic calibration of an "air" optical fiber — checking how clearly the camera sees the screen pixels through the mirror.
**Metric:** contrast of 32 px stripes (pass threshold C(32) > 0.01).

### 2. Dot Product

`stage2_dotprod` · 🪞 requires mirror

*Hardware computation of the dot product of vectors via optical summation.*

Dot Product.

**Physical principle:** (With mirror). An opto-digital hybrid. The screen emits a uniform brightness encoding a number, and the camera integrates the incoming light over the exposure time.
**Algorithmic essence:** First, 12 monotonic gray levels (0.05…0.95) are swept: for each, the region's mean brightness is measured, normalized against white and gamma-corrected, and the Pearson correlation "digital value ↔ optical value" is computed. Then, for two 4-element vectors, the product A·B is shown as 4 blocks, whose total brightness yields the optical dot product compared against the digital one.
**Analogy:** The camera acts as a physical integrator: light from pixels merges, summing values in hardware in one O(1) tick.
**Metric:** intensity-tracking correlation (pass threshold r > 0.7).

### 3. Matrix–Vector Product

`stage3_matvec` · 🪞 requires mirror

*Parallel optical matrix-vector multiplication.*

Matrix-Vector Multiplication.

**Physical principle:** (With mirror). The screen projects a row of element-wise products W·x as a 4×4 grid of blocks, one set per RGB channel in parallel.
**Algorithmic essence:** For a 16×16 matrix (separate weights in R, G, B) each of the 16 rows is shown as blocks; the camera measures block mean brightness, normalizes against white and gamma-corrects, sums into the optical row output, affine-scales it to the digital range, and computes the Pearson correlation across the three channels, then averages it.
**Analogy:** Parallel hardware summation of many independent channels (matrix rows) via the camera optics.
**Metric:** average correlation of optical vs digital output (pass threshold r > 0.4).

### 4. Logic Gates (AND/OR/XOR)

`stage4_logic` · 🪞 requires mirror

*Implementation of boolean logic via thresholded optical readout.*

Logic Gates.

**Physical principle:** (With mirror). A pair of boolean inputs is encoded as a single brightness equal to their mean ((x₁+x₂)/2) and shown on the screen as a gray level.
**Algorithmic essence:** For the 4 input combinations the camera measures the optical brightness once (white-normalized, gamma-corrected). Then for each gate an optimal cutoff threshold (with possible inversion) is fitted and the accuracy computed: linearly separable AND/OR/NAND should reach ≥75%, while XOR must stay ≤75% (the Minsky–Papert result that a single linear layer cannot separate XOR).
**Analogy:** An optical realization of a linear classifier where 1+1 shines brighter and the software decides via a threshold whether the gate fired — honestly failing on XOR.
**Metric:** Minsky–Papert confirmation (AND/OR/NAND ≥ 75% and XOR ≤ 75%).

### 5. Mini-Transformer (LLM)

`stage5_llm` · 🪞 requires mirror

*Hybrid computation of a Transformer (LLM) layer with an optical summator.*

Optical inference of an LLM layer.

**Physical principle:** (With mirror). Combining the optical multiplication from the previous stages to compute a layer of a tiny Transformer (d_model=4, vocab A/B/C/D).
**Algorithmic essence:** Starting from token 'A', 3 tokens are generated. At each step the value-projection elements W_V·x are shown on screen one by one as brightness; the camera measures them (white-normalized, gamma-corrected), and an argmax over the optical logits picks the next token. The same is computed digitally in parallel, then the token match and the V-projection correlation are checked.
**Analogy:** Partial offloading of Transformer computation from the CPU to the smartphone optics (an optical tensor accelerator).
**Metric:** number of matching tokens between optical and digital generation (pass threshold ≥ 3 of 4).

### 6. RGB Channel Separation

`stage6_rgb` · 🪞 requires mirror

*Optical mixing of color channels and construction of the YUV matrix.*

RGB channels as parallel attention heads.

**Physical principle:** (With mirror). The screen's subpixels emit independently in the red, green and blue spectra. The camera sensor receives them through the Bayer filter.
**Algorithmic essence:** White (reference) and then pure R, G, B are shown in turn; the camera measures the mean RGB responses. For each channel the isolation is computed as the ratio of the target response to the sum of the cross responses, converted to decibels (10·log₁₀), and the average isolation across R/G/B is taken. A normalized 3×3 channel-mixing matrix is also stored.
**Analogy:** Calibrating the color vision of our optical processor for future parallel RGB computation (three independent "heads").
**Metric:** average cross-channel isolation in dB (pass threshold avg > 0 dB).

### 7. SiLU Activation

`stage7_silu` · 🪞 requires mirror

*Applying the SiLU activation function via the nonlinear response of the camera.*

Optical nonlinearity (SiLU).

**Physical principle:** (With mirror). Using the dynamic range and the sensitivity curve of the camera sensor as a physical activation function.
**Algorithmic essence:** 20 gray levels from 0 to 1 are fed to the screen; the camera captures the transfer curve (normalized against black and white). The curve is compared against SiLU, ReLU and linear references (Pearson correlations), and the degree of nonlinearity is estimated as (1 − R²_linear)·100%.
**Analogy:** Replacing the mathematical activation formula (Sigmoid) with the physical saturation curve of the smartphone photosensor.
**Metric:** response nonlinearity (pass threshold > 2%).

### 8. Residual Connections

`stage8_residual` · 🪞 requires mirror

*Optical emulation of residual (skip) connections.*

Residual Connection.

**Physical principle:** (With mirror). Emulating a ResNet skip connection through the linearity of optical superposition: the brightnesses of two signals A and B add up along the screen-to-camera path.
**Algorithmic essence:** For 6 level pairs (A, B) the camera separately measures the brightness of A, of B, and of the combined A+B (black- and white-normalized). A linear regression measured(A+B) ≈ α·(measured_A + measured_B) + β is then fitted, and the coefficient of determination R² is reported, showing how additive the optical responses are.
**Analogy:** Exercising the ResNet residual connection: verifying that the optical path adds signals linearly, without loss or distortion.
**Metric:** R² of superposition linearity (pass threshold R² > 0.4).

### 9. Dropout Regularization

`stage9_dropout` · 🪞 requires mirror

*Network regularization via physical deactivation of screen pixels.*

Optical Dropout.

**Physical principle:** (With mirror). Random weights of a 4×4 matrix are "switched off" (zeroed by a Bernoulli mask) and the corresponding blocks on the OLED screen go dark.
**Algorithmic essence:** A reference MatVec W·x (4×4) is computed. Then at dropout rates of 10/20/30% the weights are zeroed by a Bernoulli mask, the dropped rows are shown as blocks, the camera measures the optical output (black/white-normalized, gamma-corrected), and the Pearson correlation between the dropped optical output and the full digital one is computed — a measure of robustness to element dropout.
**Analogy:** Neural-network regularization where we physically "switch off lightbulbs" on the screen and check how recognizable the result remains.
**Metric:** correlation at 10% dropout (pass threshold corr > 0.3).

### 10. Two-Layer Perceptron (MLP)

`stage10_mlp` · 🪞 requires mirror

*Optical inference of a two-layer fully-connected neural network.*

Multi-Layer Perceptron (MLP).

**Physical principle:** (With mirror). Two successive optical matrix-vector multiplications (W₁ and W₂, 4×4) with an intermediate software nonlinearity σ, run through one and the same mirrored screen-to-camera path.
**Algorithmic essence:** Layer 1: the rows of W₁·x are shown as blocks, the camera measures the optical output (black/white-normalized, gamma-corrected), which is affine-scaled to the digital range and correlated with layer 1. The software then applies a sigmoid and stretches z₁ into [0,1] for contrast. Layer 2: the rows of W₂·z₁ are shown as blocks, measured, scaled, and the final correlation and NRMSE against the digital two-layer output are computed.
**Analogy:** A two-stroke neural-network "engine" where both layers are physically cycled through the same smartphone optics.
**Metric:** final correlation of the full MLP (pass threshold corr > 0.3).

### 11. Rotary Positional Encoding (RoPE)

`stage11_rope` · 🪞 requires mirror

*Hardware positional encoding via optical dispersion.*

Chromatic Rotary Position Encoding (RoPE).

**Physical principle:** (With mirror). Chromatic aberration and the Talbot effect: for the OLED pixel pitch the Talbot distances z_T(λ) are computed per R/G/B, so different wavelengths transfer spatial frequency differently.
**Algorithmic essence:** White vertical stripes at 6 spatial frequencies (32…6 px) are shown; for each, the camera separately measures the contrast in the R, G, B channels. From these the R/G and G/B contrast ratios per frequency are computed, plus the dispersion = √(var(R/G)+var(G/B)) and a "uniqueness" — the fraction of frequency pairs whose (R/G, G/B) vectors are distinguishable (> 0.05). This chromatic signature encodes position without computing sines/cosines.
**Analogy:** Using the lens "optical flaw" and diffraction to compute LLM positional embeddings in hardware, for free.
**Metric:** chromatic dispersion of the contrast ratios (pass threshold dispersion > 0.005).

### 12. Softmax Normalization

`stage12_softmax` · 🪞 requires mirror

*Hardware-software implementation of Softmax normalization.*

Optical Softmax.

**Physical principle:** The screen sequentially displays 7 gray fields of increasing brightness (5% to 95%), and the camera measures the mean optical brightness of each.
**Algorithmic essence:** The measured brightnesses are normalized to [0,1], then a softmax with temperature 3.0 is applied (optical softmax). In parallel, the digital softmax of the original inputs is computed; Pearson correlation, KL divergence and monotonicity are reported.
**Analogy:** Checking that the analog brightness channel "screen→camera" preserves the shape of a softmax distribution just like digital normalization.
**Metric:** Correlation between optical and digital softmax; passes when corr > 0.5 (corr > 0.7 means it works reliably).

### 13. Grouped-Query Attention (GQA)

`stage13_gqa` · 🪞 requires mirror

*Parallel computation of Attention heads via RGB multiplexing.*

Color Grouped Query Attention (GQA).

**Physical principle:** The camera's Bayer filter separates the red and green channels in hardware, letting two independent streams travel through one optical channel at once.
**Algorithmic essence:** For 3 tokens the screen paints Key weights in the red channel and (shifted) V weights in the green channel. The camera reads the R and G channels as two Q-heads; after baseline subtraction and normalization, each head's argmax is compared against the expected token selection, and KV correlation is computed.
**Analogy:** Color filters carry two independent attention streams of the network in parallel over a single physical channel.
**Metric:** Sum of R-head and G-head matches (3 tokens each); passes when headR_match + headG_match ≥ 3 of 6.

### 14. Positional Encoding

`stage14_pe` · 🪞 requires mirror

*Optical generation of positional embeddings based on 2D waves.*

Sinusoidal Positional Encoding (PE).

**Physical principle:** The screen outputs sinusoidal brightness stripes; each of the 4 positions gets its own frequency multiplier (1×, 1.5×, 2×, 3×) and phase, encoding the token position in spatial frequency.
**Algorithmic essence:** For each position, across 6 frequencies, the camera measures contrast in 4 bins, forming a 24-dimensional PE vector. Cosine similarity is computed between all position pairs; a position is deemed distinguishable when |cos| < 0.8.
**Analogy:** A physical visualization of the classic sinusoidal Positional Encoding from the original Transformer.
**Metric:** Fraction of distinguishable position pairs (distinguishability); passes when distinguishability > 0.3 (full orthogonality at avgCosSim < 0.5).

### 35. Convolutional Network (CNN)

`stage35_cnn` · 🪞 requires mirror

*Hardware acceleration of convolutional layers via optical integration.*

Convolutional Neural Network (CNN).

**Physical principle:** Defocus and scattering of the "screen→camera" path act as a natural low-pass filter (optical blur close to a Gaussian convolution).
**Algorithmic essence:** Three 8×8 letters (A, B, C) are shown on screen. The camera reads the optical response as an 8×8 grid, which is compared via Pearson correlation against a digital 3×3 Gaussian convolution and against the original image. The mean absolute correlation is taken (inversion is allowed).
**Analogy:** Just as a lens blurs an image, performing a Gaussian blur, we use the optical blur of the path as a convolutional layer of the network.
**Metric:** Mean |correlation| of the optical response with the digital convolution; passes when avgAbsCorrConv > 0.2.

### 37. LSTM Memory (OLED Afterglow)

`stage37_lstm` · 🪞 requires mirror

*Optical emulation of the memory gates of a recurrent neural network.*

Optical LSTM memory.

**Physical principle:** The afterglow of OLED pixels and the latency of the "screen→camera" path physically hold a residual image after the screen goes dark, acting as a memory cell with a forget gate.
**Algorithmic essence:** At three speeds (Δt=50/200/1000 ms) three orthogonal patterns (horizontal, vertical, diagonal stripes) are shown in sequence. The screen then goes black, and at 0/50/100/200/400 ms the camera captures frames; the spatial fingerprint of each frame is correlated against the three references. From the decay of the last pattern's correlation, the persistence and the memory time constant τ (at the 1/e level) are estimated.
**Analogy:** An LSTM cell that stores its hidden state not in capacitors but in the fading afterglow of light, which is "forgotten" over time.
**Metric:** Persistence (|corr| of the last pattern right after blackout) and τ; passes when persistence > 0.1, the order is chronological, and τ > 30 ms.

### 72. Perceptron Training

`stage72_perceptron` · 🪞 requires mirror

*Training a neural network with optical computation of the forward pass.*

Single-layer perceptron.

**Physical principle:** In a single frame the camera sums the brightness of all screen columns, physically performing a multiply-accumulate (the dot product w·x) in O(1).
**Algorithmic essence:** An 8-input perceptron is trained on CPU for three logic functions (AND ≥6/8, OR ≥1/8, MAJORITY >4/8) using the perceptron rule. For optical inference the products w[i]·x[i] are then displayed as the brightness of 8 columns (relative to a gray background); the camera measures the mean brightness, a calibration (dark/mid/bright) recovers the optical dot product, a bias is added, and a >0 threshold yields the binary class.
**Analogy:** A single glance of the camera at the screen replaces a whole layer of a neuron's multiply-add operations.
**Metric:** Mean accuracy of the CPU and optical inference; passes when avgCpuAcc > 0.7.

### 80. Optical LLM

`stage80_optllm` · 🪞 requires mirror

*Full hybrid pipeline of LLM layers on an optical coprocessor.*

Optical LLM (character-level language model).

**Physical principle:** In a single frame the camera sums the brightness of 8 screen columns, physically performing the dot product — the matrix-vector multiply of the network's output layer.
**Algorithmic essence:** A character model (embedding 27→8, unembedding 8→27) is trained digitally with SGD on an English bigram corpus (80 epochs). Optical inference then runs: for each of the 8 generated characters the screen shows 27 patterns of 8 brightness columns (∝ embed[k]·U[k][j]); the camera averages them, a 3-point calibration recovers the 27 logits, followed by softmax at temperature 1.2 and sampling. The result is compared against a reference CPU generation.
**Analogy:** A smartphone with a screen and camera becomes an analog optical NPU where matrix multiplication is performed by photons.
**Metric:** Generated text and the match rate against CPU; passes when the optical text is ≥ 6 characters long.

### 81. Optical LLM v2 (RGB Multiplexing)

`stage81_optllm2` · 📵 works without mirror (control)

*RGB spatial-multiplexed LLM layers computing a whole layer per color frame.*

Optical LLM v2 (RGB spatial multiplexing).

**Physical principle:** All dot products of one layer are emitted in a single frame as horizontal bands, and the camera's Bayer RGB filter encodes sign: the red channel holds positive products, the blue channel negative ones, and the green channel acts as a normalization anchor.
**Algorithmic essence:** A 2-layer network with a skip connection (embedding 27→16, MLP 16→32→16, unembedding 16→27) is trained digitally. Three matrix multiplies (MLP-up, MLP-down, unembedding) run optically — one frame each, where the camera reads N averaged bands as N logits; a bounce activation prevents saturation, with per-band calibration and gamma correction. This totals 6 frames per token; 20 tokens are generated and compared against CPU.
**Analogy:** Instead of 27 separate shots (as in v1), a whole network layer is read out in one color frame, giving a ~4.5× speedup.
**Metric:** Generated text, frames per token (6) and match rate against CPU; passes when the optical text is ≥ 15 characters long.

### 82. 🔥 Mirrorless Thermal LLM

`stage82_thermal_layer` · 📵 works without mirror (control)

*Mirrorless neural layer: using screen thermal convection (BOS) for optical matrix multiplication.*

Thermal Neural Layer (Thermal LLM).

**Physical principle:** (Mirrorless). The phone lies horizontally, screen up. The OLED renders bright patterns, locally heating the air and triggering convection, which changes the air's refractive index (Schlieren effect).
**Algorithmic essence:** A character model is trained digitally on bigrams; thermal inference then runs: for each of the 8 generated characters the screen shows VOCAB patterns, and the camera, via optical flow (BOS — Background Oriented Schlieren), measures the convective micro-shifts whose magnitude serves as the dot product (logit). Softmax and sampling follow, and the result is compared against CPU.
**Analogy:** The air layer above the screen acts as a physical tensor co-processor that computes LLM activations in hardware.
**Metric:** Generated text and match rate against CPU; passes when the optical text is ≥ 6 characters long.

### 84. 🌡️ Air-Elements Instrumentation Bench

`stage84_air_elements_bench` · 📵 works without mirror (control)

*Instrumentation bench for measuring basic air elements: thermal lenses, prisms, and gratings.*

Air Elements Benchmark.

**Physical principle:** (Mirrorless). The screen generates various patterns (lens, prism, grating, axicon, vortex and more) that, through localized OLED heating, create thermal structures in the air which bend passing light (BOS).
**Algorithmic essence:** Using differential optical flow, the front camera measures, for each of the 11 elements, the noise baseline, the thermal BOS shift amplitude (in σ above noise), a 4-band matrix, frequency response, and the air's relaxation time (memory) after the pattern turns off; an air-settle/cooldown runs between tests.
**Analogy:** A laboratory testbed used to calibrate fundamental "air-optic components" before assembling them into more complex computational circuits (Stage 82).
**Metric:** Number of usable elements (signal > 3σ) and the differential in σ; passes when usableElementCount ≥ 3 of 11.

### 89. 🌡️ Vortex Mirrorless LLM

`stage89_vortex_llm` · 📵 works without mirror (control)

*Implementation of a fully connected LLM layer via a parallel 8-channel thermal vortex bus.*

Vortex Mirrorless LLM.

**Physical principle:** (Mirrorless). 8 thermal vortex cells operate simultaneously on the screen. Opacity encodes absolute magnitude (logit), while chirality (CW/CCW) encodes the sign of the weight; rising convection bends the light (BOS).
**Algorithmic essence:** A character model is trained digitally, then inference runs: for each of the 8 generated characters, 4 batches of 8 parallel vortex channels are launched, and via optical flow the camera computes the curl of the displacement vector fields as logits. Curl is invariant to scale and global phone tilts, making the sums resilient to environmental noise. Softmax and sampling follow, with comparison against CPU.
**Analogy:** The matrix multiplication of an LLM layer is performed by 8 independent thermal "cores", and the camera reads the computation results straight out of the air, frame by frame.
**Metric:** Generated text and match rate against CPU; passes when the optical text is ≥ 6 characters long.

### 102. Two-layer XOR (screen→camera feedback)

`stage102_xor2layer` · 🪞 requires mirror

*XOR, unsolvable by one optical layer, is solved by a second pass through the feedback loop.*

Two-layer XOR via screen→camera feedback.

**Physical principle:** (With mirror). This stage continues the Logic Gates experiment (stage4): a single optical linear layer cannot separate XOR (Minsky–Papert). Here the loop is closed — the optical output of the first layer is shown back on the screen and measured a second time, physically forming a second network layer.
**Algorithmic essence:** XOR = AND(OR, NAND). Layer 1: for each of the 4 input pairs the screen shows brightness (x₁+x₂)/2, the camera measures it (white-normalized, gamma-corrected), and a threshold yields two hidden units — OR and NAND (both linearly separable). Then feedback: the pair [OR, NAND] is shown on screen as two blocks, the camera integrates them into (h₁+h₂)/2, and a threshold realizes AND — i.e. XOR. The inter-layer nonlinearity comes from the sensor itself (gamma + saturation) plus the threshold. Control: the best single linear threshold fitted directly to XOR on the same measurements cannot exceed 75 % — the contrast 'one layer vs two' is the point of the demo.
**Analogy:** A two-layer perceptron unrolled in time: compute a layer → read it with the camera → feed the result back to the screen → compute the second layer. The 'feedback channel' turns a static optical multiplier into a network with depth.
**Metric:** passes when the two-layer XOR accuracy ≥ 75 % AND the control single layer ≤ 75 % (feedback supplied the missing layer).

---

## Wave Physics & Foundations

### 15. Fabry–Pérot Interferometer

`stage15_fabryperot` · 🪞 requires mirror

*Hybrid emulation of multiple-beam interference and the Airy function.*

Fabry-Perot interferometer.

**Physical principle:** (With mirror). Emulation of a high-Q optical resonator: the screen-mirror-camera channel re-reflects light, and at certain spatial pattern frequencies the round-trip reinforces the pattern (resonance).
**Algorithmic essence:** The screen sweeps 12 stripe sizes (40→4px); for each, the camera grabs a stable frame and measures stripe contrast. The algorithm finds the frequency of maximum contrast, computes the peak/average ratio, and a Q-factor as the point count divided by the peak half-width (FWHM).
**Analogy:** A digital imitation of a laser cavity built on a real, noisy camera signal.
**Metric:** Resonance is counted when peak/average > 1.2; the reported quantity is the Q-factor = (point count)/FWHM.

### 16. Amplitude Superposition (ψ)

`stage16_superpos` · 🪞 requires mirror

*Hardware test of the linearity of optical amplitude addition.*

Superposition of light waves.

**Physical principle:** (With mirror). The screen shows two sinusoidal stripe patterns — ψ_A (phase 0) and ψ_B (phase π/2) — then their superposition (ψ_A+ψ_B)/2 at 50% intensity each.
**Algorithmic essence:** The camera measures the mean brightness of each pattern and compares the brightness of the sum I(A+B) against the classical expectation (I_A+I_B)/2. It computes the relative deviation from classical in %, and visibility V=(I_max−I_min)/(I_max+I_min) from the horizontal profile.
**Analogy:** An experimental observation that two screen-light patterns add on the sensor like classical optical amplitudes.
**Metric:** Superposition is confirmed when the relative deviation dev > 3%; the reported quantity is dev in percent.

### 17. Bell Inequality (CHSH)

`stage17_chsh` · 🪞 requires mirror

*Optical simulation of a quantum non-locality test (CHSH).*

Bell inequality (CHSH), optical analog.

**Physical principle:** (With mirror). CHSH-style test via a spatial angle correlator: the LEFT screen half = Alice (stripes at 45°−Δθ/2), RIGHT = Bob (45°+Δθ/2), the mirror reflects both into the camera. This is a classical optical proxy, not genuine quantum entanglement.
**Algorithmic essence:** It scans 13 points Δθ=0..30°. For each half it measures, on the green channel, the stripe phase difference, coherence C, and correlation E(Δθ). The algorithm fits a cosine E=A·cos(4Δθ+B)+D against a Gaussian (comparing R²) and derives S=2√2·|A|, then normalizes S_norm=S/C̄.
**Analogy:** A tabletop emulation of the famous entanglement experiment where the 'particles' are stripe masks on a screen.
**Metric:** A violation is counted when S (S_vmf=S/C̄, else S) > 2; the reported quantity is S.

### 18. Wavefunction Collapse

`stage18_collapse` · 🪞 requires mirror

*Emulation of quantum measurement via hardware binning of the frame.*

Wavefunction collapse.

**Physical principle:** (With mirror). The screen shows a sharply non-equilibrium pattern — a narrow bright spike (10% of width) on a dark background, with high initial spatial variance.
**Algorithmic essence:** The camera grabs 30 consecutive frames; for each, the spatial variance σ² is computed over 8 bins. The algorithm compares late vs early variance (convergence = lateVar/earlyVar), estimates a decay time τ (first frame with σ²<0.5·earlyVar) and a back-action term (deviation of the first mean from the rest).
**Analogy:** The act of measurement (a series of captures) acts like a 'collapse': the brightness spread across the scene decays over time toward a single stable state.
**Metric:** Collapse is confirmed when convergence conv = lateVar/earlyVar < 0.8; the reported quantity is conv.

### 30. Hong–Ou–Mandel Interference (HOM)

`stage30_hom` · 🪞 requires mirror

*Modeling two-photon interference and measurement of the HOM dip.*

Hong-Ou-Mandel (HOM) effect, optical analog.

**Physical principle:** (With mirror). Two overlaid sinusoidal stripe patterns (period 16px) add in amplitude with a relative shift Δx; depending on phase match they reinforce or cancel.
**Algorithmic essence:** It scans 12 shifts Δx=0..period. For each, the camera grabs a frame and the stripe amplitude is measured via DFT of the horizontal profile. The algorithm computes visibility V=(Imax−Imin)/(Imax+Imin) across the shift series and the correlation of the amplitude profile with the theoretical |cos(πΔx/period)|.
**Analogy:** A tabletop imitation of the famous quantum effect where two photons 'bunch' at a beamsplitter — here via classical addition of stripes.
**Metric:** Counted when visibility V > 0.3 and correlation with the cosine > 0.5; the reported quantity is V.

### 47. Entanglement Decay (CHSH↓)

`stage47_deconf` · 🪞 requires mirror

*Emulation of the loss of quantum coherence due to channel noise.*

Deconfinement: S(CHSH) vs SNR.

**Physical principle:** (With mirror). Lowering the pattern contrast mimics a rising 'temperature'/channel noise: the weaker the visibility, the more the quantum-like angular correlation breaks down. This is a classical optical proxy, not genuine entanglement.
**Algorithmic essence:** It sweeps 4 contrast levels (100%, 60%, 30%, 10%). For each, the screen shows cosine patterns at 4 angles (0, π/8, π/4, 3π/8); the camera measures visibility V=(bMax−bMin)/(bMax+bMin) over 4 bins, and a simplified CHSH parameter is estimated as S≈2√2·⟨V⟩.
**Analogy:** Watching how a falling signal-to-noise ratio quenches fragile quantum order: at high contrast S is large, at low contrast it collapses.
**Metric:** Deconfinement is counted when S(max) > 2·S(min) and S(max) > 0.1; the reported quantity is S(max).

### 48. Young's Double-Slit Experiment

`stage48_2slit` · 🪞 requires mirror

*Hardware realization of Young's interference on the screen's pixels.*

Young's double-slit experiment.

**Physical principle:** (With mirror). The screen acts as a spatial light modulator (SLM): it opens two bright vertical 'slits' (8% of screen width, 30% separation); light travels to the mirror and back into the camera.
**Algorithmic essence:** The camera captures three configurations in turn — slit A only, slit B only, and both slits A+B — and measures the mean brightness I_A, I_B, I_AB. It computes the interference (cross) term I_AB−I_A−I_B and its normalized value normCross=(I_AB−I_A−I_B)/(I_A+I_B).
**Analogy:** The most famous experiment of quantum mechanics, recreated on a tabletop with a phone display.
**Metric:** Interference is counted when |normCross| > 0.02; the reported quantity is normCross in percent.

### 49. Uncertainty Principle (Δx·Δp)

`stage49_uncertainty` · 🪞 requires mirror

*Demonstration of quantum uncertainty via diffractive broadening.*

Heisenberg's uncertainty principle.

**Physical principle:** (With mirror). The more precisely the spatial coordinate is set (higher stripe frequency → smaller Δx), the more the contrast smears on the sensor due to diffraction and defocus — a growth of the 'momentum uncertainty' Δp.
**Algorithmic essence:** It sweeps 6 stripe frequencies (1, 2, 4, 8, 12, 16 cycles). For each, the camera measures contrast over 8 bins, then computes Δx=1/f, Δp=1/contrast and their product Δx·Δp. The algorithm takes the minimum product across frequencies as a 'lower bound' (analogous to ℏ/2).
**Analogy:** A practical demonstration that a smartphone's optics cannot be focused to an infinitely small point without losing contrast.
**Metric:** The relation is confirmed when min(Δx·Δp) > 0.1; the reported quantity is the min.

### 50. Born Rule (|ψ|²)

`stage50_born` · 🪞 requires mirror

*Hardware computation of the squared amplitude modulus (mapping to probability).*

The Born rule.

**Physical principle:** (With mirror). The photosensor measures only light intensity P(x), not the phase of the amplitude ψ(x): sensor brightness plays the role of |ψ(x)|².
**Algorithmic essence:** Four |ψ|² distributions are shown in turn (uniform, single peak, double peak, quadratic 4x(1−x)). The camera measures brightness over 8 bins, normalizes it against the uniform reference, and compares the measured P(x) with the expected one: it computes the Pearson correlation and KL divergence, averaged over the informative distributions.
**Analogy:** Proof that the camera, like the human eye, sees not the quantum probabilities themselves but only their projection — the intensity.
**Metric:** The Born rule is confirmed when the average correlation avgCorr > 0.5 and the average KL < 0.5; the reported quantity is corr.

### 57. Cosmological Big Bounce

`stage57_bounce` · 🪞 requires mirror

*Simulation of a cosmological bounce (modified Friedmann equation).*

Cosmological bounce (Big Bounce).

**Physical principle:** (With mirror). The modified Friedmann equation H²=(8πG/3)·ρ·(1−ρ/ρ_c) yields a minimal scale factor instead of a singularity: the universe 'contracts' to a_min and re-expands. This is an optical visualization, not real cosmology.
**Algorithmic essence:** The profile a(t)=a_min+(1−a_min)·t² (a_min=0.3) over 16 steps is encoded as screen brightness. The camera measures the calibrated brightness of each level, normalizes to [0,1], and checks: the position of the minimum (V-shape), left/right branch symmetry, and the Pearson correlation of the measured a(t) with theory.
**Analogy:** An optical 'breath' of the universe: brightness dims toward the bounce and brightens again.
**Metric:** The bounce is counted when corr > 0.8, the shape is V-like (center-dist < 0.3), and symmetry > 0.5; the reported quantity is corr.

### 58. Dark Photon Search

`stage58_darkphoton` · 🪞 requires mirror

*Analysis of anomalous optical leakage and unaccounted-for path cross-talk.*

Dark photon: ρ-meson mass shift in dense medium.

**Physical principle:** (With mirror). In the NVG model, coupling to the dark sector renormalizes the vacuum condensate, so at density 2n₀ the ρ-meson mass drops by ≈20%. This mass shift is encoded as a shift in spatial frequency.
**Algorithmic essence:** A sinusoidal brightness pattern cos(2π·f·x) is shown first at the "vacuum" frequency f₀=8, then at the "in-medium" f*=f₀·(1−0.20)=6.4. The camera captures both frames, builds a fine DFT (k=1…20, step 0.25) of the horizontal profile, locates the peaks k₀ and k₁, and computes the measured relative shift Δk/k₀.
**Analogy:** Just as a string's pitch drops when it is loaded, the "lightened" meson in a dense medium produces a lower spatial fringe frequency on the sensor.
**Metric:** Measured Δm/m ≈ Δk/k₀; passes when |Δk/k₀ − (−0.20)| < 0.10.

### 73. Standing Waves

`stage73_standing` · 🪞 requires mirror

*Visualization of the interference of counter-propagating traveling waves (antinodes and nodes).*

Standing waves: nodes and antinodes of harmonics.

**Physical principle:** (With mirror). A standing wave y=2A·sin(kx)·cos(ωt) has nodes (always dark) and antinodes (bright). The n-th harmonic of a bounded string has exactly n−1 interior nodes.
**Algorithmic essence:** For harmonics n=1…5 the screen displays the brightness profile |sin(nπx/L)|. The camera captures a frame, averages brightness into 40 vertical bins, normalizes the profile, and counts nodes as local minima below 0.2; in parallel it computes the Pearson correlation between measured and theoretical profiles.
**Analogy:** Just as a guitar string at different frets produces a different number of antinodes, each harmonic on screen yields its own count of dark nodes on the sensor.
**Metric:** Number of harmonics with correctly counted nodes (±1 tolerance); passes when nodesOK ≥ 3 of 5.

### 74. Single-Slit Diffraction

`stage74_diffraction` · 🪞 requires mirror

*Hardware capture of light diffraction from a narrow slit on the screen.*

Fraunhofer diffraction: sinc² profile and Young's experiment.

**Physical principle:** (With mirror). Single-slit diffraction in the far field gives intensity I=sinc²(πa·sinθ/λ) — the Fourier transform of the aperture; two slits add a cos² interference factor (Young's pattern).
**Algorithmic essence:** The sinc² profile (for slit widths 0.3/0.2/0.1) and the Young sinc²·cos² profile are computed on CPU and displayed as the brightness of 40 screen columns. The camera captures the pattern, averages into 40 bins, normalizes, and computes the Pearson correlation with the reference; it also checks that the center is a maximum and counts Young interference fringes.
**Analogy:** A laser-free demonstration of the wave nature of light and the diffraction–Fourier connection — using only a screen, mirror, and camera.
**Metric:** Mean correlation of the sinc² profile; passes when avgCorr > 0.5.

### 76. Malus's Law (Polarization)

`stage76_malus` · 🪞 requires mirror

*Verification of Malus's law for the smartphone's polarized light.*

Malus's law: cos²θ curve and the three-polarizer paradox.

**Physical principle:** (With mirror). Malus's law I(θ)=I₀·cos²θ describes light passing through two polarizers at angle θ; inserting a third at 45° between crossed polarizers restores I₀/4.
**Algorithmic essence:** A 3-point brightness calibration (0/0.5/1) builds a piecewise-linear camera→intensity inverse. Then for θ=0…90° the screen shows uniform brightness equal to cos²θ; the camera measures it, recovers the intensity, and compares to theory. Separately it shows the levels cos²(90°)=0 and cos²(45°)²=0.25 to test the three-polarizer paradox.
**Analogy:** Just as polarized sunglasses dim glare as you rotate them, the calibrated camera reads off the cos²θ attenuation law from screen brightness.
**Metric:** Pearson correlation of measured vs. theoretical cos²θ; passes when correlation > 0.8.

### 77. VMF: Mass Hierarchy

`stage77_vmf_hierarchy` · 🪞 requires mirror

*Optical measurement of the meson mass-shift hierarchy in a dense medium via fringe-frequency shift.*

VMF: hierarchy of meson mass shifts at 2n₀.

**Physical principle:** (With mirror). In the VMF/NVG model, coupling to the W-field gives Δm/m = −VMF·(1 − m_quarks/m_meson): the heavier the quark content, the smaller the shift. This yields the hierarchy ρ(−20%) > K*(−7.8%) > φ(−2.9%) > J/ψ(−0.4%), anchored to the single QCD parameter M_Ω=859 MeV.
**Algorithmic essence:** Each meson is encoded as a sinusoidal brightness pattern cos(2π·f·x) at its own frequency f₀. For each one the "vacuum" frequency is shown, then the "in-medium" f*=f₀(1+shift); the camera captures both frames, a fine DFT (k=1…30) locates the peaks k₀ and k₁, and the shift Δk/k₀ is measured. The code verifies the decreasing hierarchy of |shifts| and the Pearson correlation between predicted and measured values.
**Analogy:** Four strings of differing "heaviness" lower their pitch differently in a dense medium — the smartphone spectrometer reads off this ladder of shifts from the shift in fringe frequency.
**Metric:** Correctness of the hierarchy and number of mesons with |error|<0.08; passes when hierarchyOK and passCount ≥ 2.

### 78. VMF: Phase Transition (Melting)

`stage78_vmf_melting` · 🪞 requires mirror

*Optical recovery of the vacuum-condensate melting curve W(ρ)=√(1−ρ/ρ_c) from brightness.*

VMF: vacuum-condensate melting curve W(ρ)=√(1−ρ/ρ_c).

**Physical principle:** (With mirror). The central NVG equation W(ρ)=W₀·√(1−ρ/ρ_c) describes the melting of the vacuum condensate: at ρ=0, W=W₀; at the critical density ρ_c=M_Ω⁴/(ℏc)³ the condensate fully melts (W→0). It rests on the single QCD parameter M_Ω=859 MeV.
**Algorithmic essence:** After a 3-point brightness calibration (0/0.5/1) and building a camera→intensity inverse, for 11 density points ρ/ρ_c=0…1 the screen shows uniform brightness equal to W(ρ)=√(1−ρ/ρ_c). The camera measures each, recovers the intensity, and compares to theory: it computes the Pearson correlation against √(1−x) and against a linear model, and checks the boundary conditions W(0)≈1, W(ρ_c)≈0 and the downward curvature.
**Analogy:** Just as ice melts into water when heated, the vacuum condensate "melts" as density rises — the smartphone reads the shape of this curve from the falloff of screen brightness.
**Metric:** Pearson correlation of the measured curve with √(1−x) and its superiority over the linear model; passes when corrSqrt > 0.9 and sqrtBetter.

### 79. VMF: Cosmological Bounce

`stage79_vmf_bounce` · 🪞 requires mirror

*Optical test of a Big-Bounce instead of a Big Bang: the Friedmann parabola and Tolman 4^n cycles via brightness.*

VMF: cosmological bounce (Friedmann) and the Tolman entropy snowball.

**Physical principle:** (With mirror). The modified Friedmann equation H²(ρ)=(8πG/3)·ρ(1−ρ/ρ_c) is a parabola with zeros at ρ=0 and ρ=ρ_c and a maximum at ρ_c/2: the ρ/ρ_c correction removes the Big Bang singularity and produces a bounce. The Tolman entropy "snowball" grows each cycle's mass as M_n=M₁·4^(n−1), reaching our universe by cycle 77 and H₀=72.8 km/s/Mpc.
**Algorithmic essence:** After a 3-point brightness calibration, the screen shows brightness ∝ H²=x(1−x)/0.25 at 11 points (Part A) and brightness ∝ 4^n across 8 cycles (Part B). The camera measures both, recovers the intensity, and computes the Pearson correlation against the parabola and against the geometric progression, checking the central maximum, the zeros at the edges, and a growth factor of ≈4.
**Analogy:** Just as a ball bounces off the floor instead of passing through it, the universe "bounces" at critical density instead of collapsing into a singularity — the smartphone reads the shape of both curves from screen brightness.
**Metric:** Parabola correlation (corrParabola>0.9, central maximum) and Tolman 4^n correlation (corrExp>0.8); passes when both parts pass.

### 83. 🔵 Aerosol-Visible 3D Globe

`stage83_thermal_hologram` · 📵 works without mirror (control)

*Real aerosol 3D globe: 120 Hz OLED sphere slices, a dry control, and camera gain statistics with a BOS shift.*

Real aerosol-visible 3D globe with camera statistics.

**Physical principle:** (Mirrorless). A 120 Hz OLED screen renders 24 high-contrast sphere slices (slice radius following √(1−z²)); a thin water-aerosol layer 1–4 cm above the glass scatters the light into a visible volume. The camera compares the aerosol pass against a "dry" control with no aerosol.
**Algorithmic essence:** A dark frame and a dry control of the 24 slices are captured first (the screen/reflection/noise baseline). For the aerosol pass the camera computes, per slice within the ROI, contrast, SNR, centroid, radius and bright fraction, and — relative to the dry control — the peak/mean/bright-fraction gains. The measured radius is correlated against √(1−z²); a 60 s live tracking pass runs, and a final BOS shift on a checkerboard reference is measured by SAD block matching before and after.
**Analogy:** The screen "prints" an invisible 3D globe in the air with light, the aerosol reveals it as a volume, and the camera statistically confirms the glow rises above the empty control.
**Metric:** Slices visible above the dry control; passes when visibleSlices ≥ 8, peak gain Δ>2.5, mean gain Δ>0.35 and radius correlation > 0.15.

### 91. ⚛️ Quantum Entanglement Decay (BOS)

`stage91_entanglement` · 📵 works without mirror (control)

*Evaluating spatial air coherence when simulating quantum entanglement.*

Thermal correlation death at "deconfinement" (a thermo-optic BOS analog).

**Physical principle:** (Mirrorless). The screen forms two separated quad-vortex cells (Left and Right) as an emulated Bell pair. At T=0 their convective curls are correlated; rising background "temperature" (melting W→0) disrupts the gradients and drives the link to zero. This is a classical thermo-optic analog of decoherence, not literal quantum entanglement.
**Algorithmic essence:** For three background brightness-heat levels (0, 60, 150) the screen shows two quad-vortices; against a checkerboard reference, BOS optical flow (SAD block matching over a ±2 range) measures each cell's curl as curl = top.dx + right.dy − bottom.dx − left.dy. Over a series of 8 frames the Pearson correlation between the Left and Right cell curls is computed.
**Analogy:** Measuring how long two thermal vortices "feel" each other in the air before heat-driven chaos breaks their bond.
**Metric:** Cold r₀ versus hot r_hot correlation; passes when r₀ > r_hot + 0.15 or r₀ > 0.40.

### 92. 🌀 Topological Vortex Reconnection

`stage92_reconnection` · 📵 works without mirror (control)

*Analysis of topological reconnection of two approaching thermal jets.*

Topological vortex reconnection and collapse (a thermo-optic BOS analog).

**Physical principle:** (Mirrorless). The screen brings together a vortex (CW) / antivortex (CCW) pair moving toward each other. As they merge, their opposing convective chiralities annihilate and the local optical motion suddenly drops — an optical-convective analog of wave-function collapse (θ-collapse).
**Algorithmic essence:** Over 15 steps the pair's separation shrinks from 1.1 to 0 (and their opacity fades ∝ distance). At each step, against a checkerboard reference, BOS optical flow (SAD block matching over ±2) measures the mean displacement magnitude across two 3×3 grids around the vortex centers, scaled by the remaining distance fraction. The initial and final motion magnitudes are compared.
**Analogy:** A tabletop model of a complex plasma phenomenon (like solar flares), where screen-heated air plays the role of plasma and the link breaks at reconnection.
**Metric:** Ratio of final to initial displacement magnitude varRatio = finalVar/initialVar; passes when varRatio < 0.88.

### 93. 🕳️ de Sitter Core Echoes

`stage93_echoes` · 📵 works without mirror (control)

*Measuring the air channel's memory (thermal echo) after heat source deactivation.*

de Sitter Core Resonance (frequency sweep).

**Physical principle:** (Mirrorless). The Hayward regular black-hole core is modeled as a glowing de Sitter lens with a radial brightness gradient, harmonically modulated across a range of frequencies.
**Algorithmic essence:** The screen sweeps frequencies [1, 2, 3, 4, 5] Hz, modulating the core brightness as 1 + 0.35·cos(2πft) over 12 steps of 160 ms. The camera measures the mean intensity in the central core region; at each frequency a DFT amplitude (cos/sin projections) is computed and the resonance peak is located.
**Analogy:** Driving a standing wave: the periodic "heating" excites an eigenmode of the core, which responds with resonant amplification of intensity.
**Metric:** Resonance frequency f_res and peak-to-background ratio. Pass when maxAmp > 1.25·avgAmp or f_res falls within 2.0–4.0 Hz.

### 94. 🔀 Madelung Double-Slit Interference

`stage94_madelung` · 📵 works without mirror (control)

*Emulation of quantum fluid hydrodynamics (Madelung equations) via convection.*

Madelung Double-Slit Interference (profile correlation).

**Physical principle:** (Mirrorless). The Schrödinger equation can be formulated as a quantum-fluid flow (Madelung formalism); the double-slit interference pattern is its observable probability density.
**Algorithmic essence:** The screen draws the theoretical profile I(x) = cos²(5πx)·sinc²(1.35πx). The camera captures a frame and extracts horizontal and vertical brightness profiles, then searches over scale, translation offset and Gaussian blur to find the maximum Pearson correlation between the measured and reference profiles.
**Analogy:** Rendering the abstract wave function as a real, measurable interference fringe pattern.
**Metric:** Correlation coefficient r against the double-slit profile. Pass when r > 0.75.

### 95. 🔮 Thermal 3D Globe (Convective Lenticular)

`stage95_globe` · 📵 works without mirror (control)

*Global thermo-optic visualization of the Earth, evaluating Coriolis-like flows.*

Thermal Lenticular 3D Globe (BOS shift).

**Physical principle:** (Mirrorless). A rotating wireframe 3D globe (continents, grid) is rendered in two left/right-eye perspectives, column-interlaced like a parallax barrier. The alternating bright and dark columns form a physical array of thermal micro-plumes — a convective lenticular grating that refracts light.
**Algorithmic essence:** The globe spins across 12 steps from 0 to 270°. At each step a reference checkerboard is shown over it; the camera captures a frame and measures BOS shift vectors in the central region via block matching (SAD with sub-pixel refinement) relative to a cold reference frame. The dominant axis (H or V) is selected and the mean absolute shift is taken as the flow intensity.
**Analogy:** The smartphone creates its own miniature "holographic" thermal layer whose real refraction is registered by the camera.
**Metric:** Directed flow intensity flowIntensity (px). Pass when flowIntensity > 0.4 px.

### 96. 💨 Resonant Smoke Super-Vortex (5 Hz)

`stage96_smoke_vortex` · 📵 works without mirror (control)

*Demonstration of thermodynamic interaction between a pulsating display and real smoke.*

Resonant Smoke Super-Vortex (5 Hz).

**Physical principle:** (Mirrorless). A giant ring of 8 identically (clockwise) spiraling vortices with a central glowing lens is displayed. The whole structure's brightness pulses as a strict 5 Hz square wave (100 ms on / 100 ms off) — the resonant frequency for microconvection above the display. The 8 peripheral thermo-optical vortices act like synchronized gears, twisting the air into a single central macro-vortex.
**Algorithmic essence:** For 30 seconds the screen flashes the resonant pattern while the user blows smoke over the display. Every 250 ms the camera grabs an instant frame and computes global activity as the mean SAD brightness difference between consecutive frames across the whole region, accumulating the average and the peak smoke-motion value.
**Analogy:** The screen acts as an invisible optical 'fan', using 8 thermal blades to physically twist real smoke.
**Metric:** Average and peak SAD activity. Pass when avgActivity > 0.55 or maxActivity > 0.9.

### 97. TIR Interferometer

`stage97_tir_interferometer` · 📵 works without mirror (control)

*Mirrorless waveguide zero-gap interferometer.*

TIR Waveguide Interferometer (Zero-Gap).

**Physical principle:** (Mirrorless). The smartphone's cover glass (Gorilla Glass) acts as a dielectric slab waveguide: display light is trapped via Total Internal Reflection (TIR) and reaches the camera sensor.
**Algorithmic essence:** The screen sweeps high-frequency black-and-white gratings with stripe pitches [8, 6, 5, 4, 3, 2] px; at each mode it makes a stabilized capture and measures the contrast of the leaked in-glass wave. The mode with maximum contrast is found and the peak-to-average ratio is computed.
**Analogy:** The smartphone becomes a solid-state fiber-optic strain sensor, where the screen is the laser, the glass is the fiber, and the camera is the detector.
**Metric:** Resonance ratio peakRatio = maxC / avgC. Pass when peakRatio > 1.2.

### 98. Schlieren Interferometer (BOS)

`stage98_schlieren_interferometer` · 📵 works without mirror (control)

*Speckle-Schlieren interferometer (thermo-optical phase measurement).*

Active Speckle-Schlieren Interferometer (BOS).

**Physical principle:** (Mirrorless). Background Oriented Schlieren. The smartphone illuminates the ceiling with a high-frequency pattern, which serves as a reference speckle field for the camera.
**Algorithmic essence:** A high-frequency grating (4 px stripes) is drawn inside a central circular region that acts both as the thermal pump and the reference field. After a 4 s warm-up a cold baseline frame is captured; then for 20 s the camera grabs a frame every 500 ms and computes the phase shift as the mean SAD brightness difference relative to the baseline, tracking the maximum.
**Analogy:** An optical equivalent of the mirage above hot asphalt, but measured with sub-pixel precision.
**Metric:** Peak phase shift maxSAD. Pass when maxSAD > 0.8.

### 99. Liquid Spectrometer

`stage99_liquid_spectrometer` · 📵 works without mirror (control)

*Liquid identification: Water / Oil / Blood.*

Micro-drop Spectro-Refractometer.

**Physical principle:** Hybrid optical analysis. A drop of liquid on the camera lens acts as a micro-lens. Different liquids have distinct refractive indices (refractometry), absorption spectra (spectroscopy), and turbidity (Mie scattering).
**Algorithmic essence:** First the screen displays a high-frequency grid and the camera measures the spatial contrast (StdDev) within a central disc as a proxy for refractive index and turbidity. Then the screen flashes pure R, G, B colors in turn and the channel averages yield an R/G absorption index. By thresholding contrast and R/G the substance is classified as Air, Blood, Oil or Water.
**Analogy:** A pocket chemistry lab using smartphone optics instead of test tubes and centrifuges.
**Metric:** Contrast StdDev and R/G index. Air when StdDev > 25; Blood when R/G > 1.5; Oil when StdDev < 9.75; otherwise Water. Pass on successful classification (result ≠ Unknown).

### 100. Dispersion Saccharimeter

`stage100_dispersion_spectrometer` · 📵 works without mirror (control)

*Measure salt/sugar concentration (Abbe Invariant).*

Chromatic Dispersion Saccharimeter.

**Physical principle:** Measuring the Abbe number (dispersion) of a liquid independent of drop size. Lens focal length depends on radius of curvature and refractive index, and red and blue light refract differently. By dividing optical contrast in red by contrast in blue, the drop size mathematically cancels out.
**Algorithmic essence:** The screen projects a random speckle pattern (to suppress Moiré). For 10 s the camera continuously captures frames and computes the spatial contrast of the Red (Cr) and Blue (Cb) channels within a central disc. The dispersion index D = Cr / Cb is averaged with a thermal-drift correction (−0.0010·t). Calibrated D thresholds classify the substance as Air, viscous organics, oil, thick/light syrup or water.
**Analogy:** A pocket saccharimeter that reads solution concentration without test tubes — from the chromatic refraction of the drop.
**Metric:** Dispersion index D = Cr / Cb (thermally corrected). Calibration: Air D<0.975, organics 0.975–0.985, oil 0.985–0.989, thick syrup 0.989–0.991, syrup 0.991–0.993, water D≥0.993. The stage always passes (pass=true).

### 101. Bio-Fluid Analyzer

`stage101_bio_diagnostics` · 📵 works without mirror (control)

*Medical analysis (urine, blood, saliva).*

Clinical Smartphone Refractometer.

**Important (Hygiene):** Place a piece of transparent tape or plastic wrap over the front camera and put the biological fluid drop on the film.

**Physical principle:** Colorimetry plus dispersive refractometry. The fluid's pigment sets its absorption spectrum (hemoglobin, urobilin), while its density sets the chromatic dispersion (Abbe number), which is independent of drop size.
**Algorithmic essence:** Phase 1 — a white screen flash, the camera measures mean R/G/B in a central disc and classifies the fluid as Blood, Urine or Saliva from relative pigment absorption. Phase 2 — a speckle pattern, and over 8 s the dispersion index D = Cr / Cb is computed with a thermal-drift correction. Phase 3 — from fluid type and D a diagnosis is made: for urine the Specific Gravity (SG) and hydration level are derived, for blood the plasma-protein level, for saliva the osmolality.
**Analogy:** A pocket clinical lab that replaces test strips and a bench refractometer with the smartphone's optics.
**Metric:** Thermally-corrected dispersion index D = Cr / Cb (plus derived SG for urine). D<0.975 means no fluid/air; otherwise the stage passes (pass=true).

---

## Quantum Gates & Computing

### 19. Hadamard Gate (H)

`stage19_hadamard` · 🪞 requires mirror

*Optical generation of superposition (Hadamard) via light mixing.*

Hadamard Gate — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. Basis states |0⟩ and |1⟩ are encoded as a bright screen half (left/right quadrant); the H action is a 45°/135° sinusoidal grating that spreads the focused brightness into an even halftone.
**Algorithmic essence:** For inputs |0⟩ and |1⟩ the camera captures a frame after the grating, quadrantMean measures the mean brightness of the left and right quadrants, and balance = min(L,R)/max(L,R) is computed. An ideal 'superposition' gives equal L and R (balance→1). The average balance over both inputs (avgBalance) is returned.
**Analogy:** The grating acts as a splitter that smears the bright half evenly across both quadrants — an optical image of the equiprobable superposition |0⟩+|1⟩.
**Metric:** Mean quadrant-brightness balance avgBalance = (balance0+balance1)/2; passes when avgBalance > 0.5.

### 20. Quantum Fourier Transform (QFT)

`stage20_qft` · 🪞 requires mirror

*QFT simulation via the spatial Fourier spectrum of the image.*

Quantum Fourier Transform (QFT) — optical analog for N=4.

**Physical principle:** A classical model on a phone screen with mirror and camera. For each input basis state |k⟩ a row of 4 bars is displayed, with brightness set by intensity cos²(φ/2)=(1+cos(2πkn/N))/2 — the QFT matrix-row amplitudes encoded into brightness.
**Algorithmic essence:** For each k the camera captures a frame, measureCalibratedBins/measureNBins reads 4 spatial brightness bins. Rows are normalized against the k=0 input bins (vignetting compensation) and then compared to the theoretical cos² QFT rows via the Pearson coefficient; the correlation is averaged over k=1..3 (avgCorr). Row |0⟩ uniformity and row |2⟩ phase sharpness are also evaluated.
**Analogy:** The camera lens and the spatial layout of the bars act as an 'optical' Fourier transformer in which the QFT result is read out as a set of bin intensities.
**Metric:** Mean Pearson correlation of measured bins with the QFT matrix, avgCorr; passes when avgCorr > 0.3.

### 21. Grover's Search

`stage21_grover` · 🪞 requires mirror

*Optical modeling of Grover's search algorithm (amplitude amplification).*

Grover's algorithm — optical analog (N=4).

**Physical principle:** A classical model on a phone screen with mirror and camera. A 4-element search is modeled by three brightness-pattern steps: equal superposition (4 gray blocks), oracle (target block #2 darkened — an analog of phase inversion), and diffuser (reflection about the mean).
**Algorithmic essence:** At each step the camera captures a frame and measureNBins reads 4 brightness bins. The oracle and diffuser frames are taken with the baseline superposition subtracted (vignetting compensation); the diffuser is implemented as 2·mean − v. The target is considered found if it has the largest differential brightness increase diff2 over the superposition; an amplification = target brightness / mean of the rest is also computed.
**Analogy:** Instead of a linear array scan, a single optical 'amplifier snapshot' is taken, after which the correct answer stands out as the brightest bin.
**Metric:** Boolean found (target bin #2 has the largest differential increase); passes when found = true.

### 22. Quantum Teleportation

`stage22_teleport` · 🪞 requires mirror

*State teleportation simulation between the screen's color channels.*

Quantum teleportation — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. The R and G color channels play the role of an 'entangled' Bell pair: Alice's input state is encoded in the brightness of the red channel, while the green channel acts as the link mediator.
**Algorithmic essence:** Four 'states' |0⟩, |1⟩, |+⟩, |−⟩ of differing red brightness are shown in turn, and regionMeanRGB reads the frame's mean R, G, B. The Pearson correlation between Alice's input (R) and Bob's output (B) is computed; fidelity = |corrRB|, while the R→G correlation gauges the θ-channel quality. A negative correlation is treated as an inverted but valid transfer.
**Analogy:** Carrying a 'state' from one color channel to another mimics teleportation, with entanglement replaced by RGB color multiplexing.
**Metric:** Transfer fidelity = |corr(Alice R, Bob B)|; passes when fidelity > 0.5.

### 23. Deutsch–Jozsa Algorithm

`stage23_deutsch` · 🪞 requires mirror

*Hardware evaluation of a function's balance via optical interference.*

Deutsch-Jozsa algorithm — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. A function over 2 bins is encoded as a brightness pattern: a constant function is a uniform screen, a balanced one is a half-bright/half-dark split.
**Algorithmic essence:** Four cases are shown (constant=0, constant=1 and two balanced halves); for each, measureNBins reads 2 brightness bins and the contrast ratio |b0−b1|/max is computed. ratio < 0.15 is classified as constant, ratio > 0.15 as balanced. accuracy is the fraction of the 4 cases classified correctly — each decided from a single optical capture.
**Analogy:** The function type is determined in one 'query' from the global light distribution on the sensor, rather than by probing each input.
**Metric:** Classification accuracy over 4 cases; passes when accuracy ≥ 0.75.

### 24. Quantum Error Correction (QEC)

`stage24_qec` · 🪞 requires mirror

*Modeling error protection via optical redundancy.*

Quantum error correction (QEC) — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. A 3-bit repetition code is used: logical |0⟩ is three bright bits, logical |1⟩ is three dark ones. A threshold thresh = (dark+bright)/2 is first calibrated from dark (40) and bright (200) screens.
**Algorithmic essence:** Each of the 3 physical bits is shown in turn and read with regionMean, bit = (brightness > thresh). A single error (one-bit flip out of three) is injected into each of the two logical states, after which majority voting is applied: recovered bit = 1 if ≥2 measured bits equal 1. recoveryRate is the fraction of trials where the vote returned the original bit.
**Analogy:** Three-copy redundancy plus majority voting suppress single camera noise just as a repetition code fixes a single error.
**Metric:** Recovery fraction recoveryRate over all single-error trials; passes when recoveryRate ≥ 0.6.

### 25. CNOT Gate

`stage25_cnot` · 🪞 requires mirror

*Two-qubit operation via spatial pixel overlay.*

CNOT (Controlled-NOT) gate — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. Control and target bits are set by full-screen fill brightness (dark 40 / bright 200); a threshold thresh = (dark+bright)/2 is calibrated from dark and bright screens.
**Algorithmic essence:** For all 4 rows of the truth table |c,t⟩→|c, c⊕t⟩ the control and target bits are shown in turn, regionMean reads the brightness and bit = (brightness > thresh). Comparing measured input bits and the expected output against the reference gives inputAcc and outputAcc, and totalAcc = (inputAcc+outputAcc)/2.
**Analogy:** A controlled optical switch at the screen-pixel level, where the 'control' state determines whether the 'target' is inverted.
**Metric:** Mean truth-table accuracy totalAcc = (inputAcc+outputAcc)/2; passes when totalAcc ≥ 0.625.

### 26. Qubit Capacity (W-bits)

`stage26_wbits` · 🪞 requires mirror

*Readout-capacity test of an optical register, bit by bit.*

W-bit capacity — optical register analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. Each W-bit is encoded as full-screen brightness (dark 40 / bright 200); a threshold thresh = (dark+bright)/2 is calibrated from dark and bright screens.
**Algorithmic essence:** For bit counts nQ from 1 to 16, test patterns (all-zeros, all-ones and alternating) are shown sequentially, regionMean reads the brightness and bit = (brightness > thresh). For each nQ the readout accuracy = correct bits / total bits is computed; maxUsable is the number of levels nQ where accuracy ≥ 0.75 (maxPerfect where ≥ 0.95).
**Analogy:** How many distinguishable 'W-bits' the optical channel holds before camera noise breaks reliable readout — a register-capacity estimate.
**Metric:** Number of reliably-read digits maxUsable (accuracy ≥ 0.75); passes when maxUsable ≥ 4.

### 27. CHSH ×50 (Bell Statistics)

`stage27_chsh_x20` · 🪞 requires mirror

*Repeated CHSH measurement to confirm statistical significance.*

CHSH ×20-round test (statistics) — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. The screen halves carry sinusoidal gratings at Alice's (30°/52.5°) and Bob's (41.25°/63.75°) 'angles' — an optical analog of the polarization measurements in a Bell test.
**Algorithmic essence:** 20 rounds of 4 angle pairs: the camera captures a frame, the phase of each strip is computed from the green channel via sin/cos coefficients and per-half frequency auto-calibration, the phase differences are detrended, and correlation E is taken as the real part of the mean phase vector. From the four E values S_round = |E00−E01+E10+E11| is formed; over 20 values the mean S̄_norm, σ and a t-test for S̄_norm > 2 are computed.
**Analogy:** Repeated collection of 'correlated' optical measurements for a robust statistical conclusion about exceeding the classical Bell limit S=2.
**Metric:** Mean normalized S̄_norm and the t-test p-value; passes when S̄_norm > 2 and pBell < 0.05.

### 29. State Fidelity ×10

`stage29_fidelity` · 🪞 requires mirror

*Hardware computation of the overlap metric between two quantum states.*

Quantum fidelity ×10 — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. The 'states' |0⟩, |1⟩, |+⟩, |−⟩ are set by colored blocks: Alice's input is the red channel, Bob's output the blue, with green fixed as a mediator channel.
**Algorithmic essence:** In each of 10 trials four color blocks are shown, regionMeanRGB reads the mean R and B, the Pearson correlation r between R (Alice) and B (Bob) is computed, and F = (1+|r|)/2. Over the 10 trials the mean meanF, σ and the count of runs with F > 2/3 are taken.
**Analogy:** Repeated estimation of state 'overlap' via color correlation — an optical analog of state-transfer fidelity under real noise.
**Metric:** Mean fidelity meanF = ⟨(1+|r|)/2⟩ over 10 trials; passes when meanF > 0.667.

### 32. 🎲 Quantum RNG (QRNG)

`stage32_qrng` · 🪞 requires mirror

*Generating cryptographic randomness from the camera's physical noise.*

Hardware random number generator (QRNG) — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. The entropy source is the temporal noise of the CMOS sensor (thermal and shot noise) captured against a uniform gray screen.
**Algorithmic essence:** 100 frame pairs are captured; for each pair the summed brightness of a central 5×5 window is compared: bit = 1 if frame B is brighter than frame A, else 0. The resulting 100-bit string is run through 4 NIST-like tests — frequency (monobit, |1−0|/√N < 1.96), runs, serial correlation (< 0.1) and longest run of ones (< 12). testsPass is the number of tests passed.
**Analogy:** The unavoidable physical noise of a digital camera is used as a source of cryptographic randomness, validated by standard statistics.
**Metric:** Number of passed NIST tests testsPass out of 4; passes when testsPass ≥ 3.

### 33. Density-Matrix Tomography (ρ)

`stage33_tomo` · 🪞 requires mirror

*Optical reconstruction of the density matrix from a series of projections.*

Quantum state tomography — optical analog.

**Physical principle:** A classical model on a phone screen with mirror and camera. The Pauli bases are emulated by stripe patterns: Z — vertical, X — horizontal, Y — 45° diagonal; the 'states' |0⟩ and |+⟩ are set by stripe brightness.
**Algorithmic essence:** For each state three frames are captured, quadrantMean/regionMeanArea read opposite regions to give the expectations ⟨σz⟩=(L−R)/(L+R), ⟨σx⟩=(top−bot)/(top+bot), ⟨σy⟩ from diagonals. The Bloch vector |r|=√(σx²+σy²+σz²) and purity Tr(ρ²)=(1+|r|²)/2 are formed; results are averaged over the two states (avgPurity, avgBloch).
**Analogy:** Like a medical scanner builds a volume from projections, the state is reconstructed from three brightness-projection bases.
**Metric:** Mean purity avgPurity = ⟨(1+|r|²)/2⟩ over the states; passes when avgPurity > 0.5.

### 34. Shor's Algorithm (Factoring)

`stage34_shor` · 🪞 requires mirror

*Finding factors of a number via spatial-frequency analysis.*

Shor's Algorithm (optical analog, N=15).

**Physical principle:** (With mirror). Optical detection of hidden spatial periods by capturing and spectrally analyzing a brightness grating. This is a classical model on a phone screen and camera, not a real quantum processor.
**Algorithmic essence:** The sequence 7^x mod 15 (period r=4) is shown as 8 high-contrast brightness columns. The camera captures a frame (captureStable), measures 8 bins (measureNBins), a linear trend is subtracted (detrending against vignetting), then a discrete Fourier transform is computed over the 8 bins. From the |QFT| peak (expected k=2) the period r is found, and factors are extracted as gcd(7^(r/2)±1, 15).
**Analogy:** Turning factorization into finding a striped pattern in a photo.
**Metric:** Pass (check) requires correct factorization correctFactors, i.e. 15 = 3 × 5; the metric reports the found period r.

### 51. Aspect Experiment (🔔 Bell)

`stage51_aspect` · 🪞 requires mirror

*Emulation of Bell's theorem using the 120Hz refresh rate.*

Aspect Experiment / Bell Test (optical analog).

**Physical principle:** (With mirror). Violation of the Bell (CHSH) inequality is reproduced statistically on a classical phone screen and camera, not with real entangled qubits.
**Algorithmic essence:** First a striped |Φ⁺⟩ pattern is shown; the camera captures a frame (captureStable) and the Pearson correlation between the R channel ("Alice") and B channel ("Bob") is computed. Then, for 4 CHSH angle pairs, cosine interference gratings cos(x+a)+cos(x+b) are displayed; the camera measures fringe visibility (measureVisibility), normalizes it by a reference visibility, and via the sign of cos(2(a−b)) forms correlators E(a,b). From these, S = |E₁−E₂+E₃+E₄| is computed.
**Analogy:** The smartphone "tests quantum telepathy" by comparing the contrast of overlaid striped images at different angles.
**Metric:** Pass (check) requires bellViolation, i.e. S > 2.0 (classical limit 2.0, quantum maximum 2√2≈2.83); the metric reports S.

### 52. Grover's Search (8 Items)

`stage52_grover8` · 🪞 requires mirror

*Amplitude amplification when searching an 8-element optical space.*

Grover's Algorithm (optical analog, N=8→16→32→64).

**Physical principle:** (With mirror). Amplification of the marked state's amplitude is visualized as a bright bin on the screen and confirmed by the camera. This is a classical model on a phone screen and camera, not real qubits.
**Algorithmic essence:** For each N (8,16,32,64) the Grover phase inversion and diffusion are computed on the CPU over ⌊π/4·√N⌋ iterations. The final |amp|² distribution is shown as N brightness columns. The camera captures a flat white frame and the distribution frame (captureStable, measureCalibratedBins/measureNBins), divides one by the other to correct vignetting, and checks that the maximum falls within a window around the target bin with amplification relative to the mean.
**Analogy:** Finding the right answer among many options by the brightest spot in a photo.
**Metric:** Amplitude amplification (× relative to mean background); pass (check) requires pass, i.e. the maximum resolved N (maxN) ≥ 8 with a target-window amplification > 1.25×.

### 53. 🔐 BB84 Decoy-State QKD

`stage53_bb84f` · 🪞 requires mirror

*Securing an optical key-distribution channel via the BB84 protocol.*

BB84 Protocol — optical key distribution (32 bits).

**Physical principle:** (With mirror). Distribution of a secret key through two polarization "bases", emulated on a classical phone screen and camera rather than on single photons.
**Algorithmic essence:** Alice generates 32 random bits and random bases (R=rectilinear, D=diagonal). Each bit is shown as a bright half-screen: in the R basis left/right, in the D basis top/bottom. The camera calibrates dark and bright levels, captures each frame (captureStable) and measures the halves (measureNBins / region means); Bob "reads" the bit in his own random basis. After sifting on matching bases, an orientation correction is applied and the QBER (fraction of mismatched bits) is computed.
**Analogy:** Two parties randomly rotate "filters" and keep only the transmissions where the filters matched, using the error rate as an eavesdropping detector.
**Metric:** QBER (% errors in the sifted key); pass (check) requires secure, i.e. QBER < 0.11 (11%).

### 54. Quantum Phase Estimation (QPE)

`stage54_qpe` · 🪞 requires mirror

*Hardware measurement of phase shift with subpixel precision.*

Quantum Phase Estimation (QPE, 4-bit, optical analog).

**Physical principle:** (With mirror). The phase estimate is encoded as the spatial frequency of a cosine grating and read out by the camera; this is a classical model on a phone screen and camera, not a real quantum register.
**Algorithmic essence:** First a calibration grating with 4 known periods is shown; the camera captures a frame (captureStable), builds a 1D profile and finds the measured frequency via a fine DFT (0.25-bin step), setting the scale freqScale. Then, for 6 test phases φ, cosine gratings at frequency φ·16 are displayed; from the DFT peak corrected by freqScale, the phase is rounded to the nearest of 16 bins and the error relative to the true φ is computed.
**Analogy:** A hidden number is determined from how frequently the stripes repeat in a photo of the grating.
**Metric:** Average error avgError (phase bits) and number of exact hits; pass (check) requires pass, i.e. exact hits ≥ 4 (effectiveError < 0.001); Shor-readiness needs avgError ≤ 0.0625.

### 55. Shor's Algorithm (Multi-Factoring)

`stage55_shormulti` · 🪞 requires mirror

*Sequential factoring of several numbers via optical phase estimation.*

Shor Multi-Factorization (optical analog, 8 numbers).

**Physical principle:** (With mirror). The period of a^x mod N is extracted via phase estimation (QPE) on the spatial frequencies of gratings; this is a classical model on a phone screen and camera, not a real quantum processor.
**Algorithmic essence:** The frequency scale freqScale is calibrated once. Then, one number at a time (N=15,21,35,77,143,221,323,1001), cosine gratings at frequency φ·16 are displayed for phases φ=s/r; the camera captures a frame (captureStable), a fine DFT finds the peak, corrects it by freqScale and rounds to the nearest of 16 bins. From the measured φ, period candidates r are reconstructed (via fractions s/r, doubling and LCM), and factors are sought as gcd(a^(r/2)±1, N).
**Analogy:** Several numbers are "factored" in turn from how frequently the stripes repeat in a photo of each grating.
**Metric:** Count of factored numbers factored/total; pass (check) requires pass, i.e. at least 4 of 8 factored.

### 75. Quantum Walk

`stage75_qrwalk` · 🪞 requires mirror

*Modeling a coherent quantum walk with interference of probabilities.*

Quantum vs Classical Random Walk (optical analog, 20 steps).

**Physical principle:** (With mirror). A ballistic quantum walk versus a diffusive classical one is reproduced by the shape of the light distribution on the phone screen and camera, not with real qubits.
**Algorithmic essence:** Two 41-position distributions are computed on the CPU: classical (binomial coefficients, σ≈√20) and quantum (a coherent Hadamard-coin walk with complex amplitudes). Both are shown as 41 brightness columns; the camera captures frames (captureStable), builds profiles (measureProfile), computes the Pearson correlation with the reference, and checks that the classical peak is at the center while the quantum peaks are at the edges. The speedup is estimated as σ_q/σ_c.
**Analogy:** A quantum drunkard ends up at the edges of the street more often than at the center, and "spreads out" faster than usual.
**Metric:** Speedup = σ_q/σ_c; pass (check) requires speedup > 1.2.

### 85. 🌡️ Qutrit Emulator

`stage85_qutrit` · 📵 works without mirror (control)

*Emulation of a qutrit (ternary logic) via chirality analysis of a thermo-optic vortex.*

Three-State Qutrit Emulator (thermo-optical analog).

**Physical principle:** (Mirrorless). The screen shows spiral vortex patterns with a defined chirality (l=0,+1,−1), inducing a thermo-convective vortex above the display; this is classical thermo-optics, not a real qutrit.
**Algorithmic essence:** For each of the three states a pattern is shown (a pure lens |0⟩, left/right-handed vortices |1⟩/|2⟩), then a reference checkerboard grid on top. The camera captures frames (captureStable) and, via block matching (SAD optical flow, measureShiftVector), measures the BOS displacement field in four central quadrants; from it the curl = top.dx + right.dy − bottom.dx − left.dy is computed for each state. The order curl[1] > curl[0] > curl[2] and the separability of states relative to noise are checked.
**Analogy:** A three-level logic element where the "digit" is set by the swirl direction of warm air.
**Metric:** State separation Δ = |curl₁ − curl₂| (px) and its significance in σ; pass (check) requires pass, i.e. correct curl order and Δ > 2·noiseSigma.

### 86. 🌡️ Qutrit Optical Router

`stage86_router` · 📵 works without mirror (control)

*Demonstration of signal routing through waveguides formed by thermal gradients (BOS).*

Qutrit Optical Router (thermo-optical analog).

**Physical principle:** (Mirrorless). A controlling thermo-convective vortex with a defined chirality bends the heat flow above the display, emulating the switching of three channels; this is classical thermo-optics, not a real qutrit.
**Algorithmic essence:** For three command states in turn a pattern is shown (a pure lens |0⟩ → center, left/right-handed vortices |1⟩/|2⟩ → left/right), then a reference checkerboard grid on top. The camera captures frames (captureStable) and, via SAD optical flow (measureShiftVector), measures the BOS displacement field in four central quadrants; from it the curl = top.dx + right.dy − bottom.dx − left.dy is computed for each channel. The order curl[1] > curl[0] > curl[2] and the separability of channels relative to noise are checked.
**Analogy:** An optical track switch where the "switch" is toggled by the swirl direction of warm air.
**Metric:** Channel separation Δ = |curl₁ − curl₂| (px) and its significance in σ; pass (check) requires pass, i.e. correct curl order and Δ > 2·noiseSigma.

### 87. 🌡️ Topological Braiding Gate

`stage87_braiding` · 📵 works without mirror (control)

*Computing topological braiding operations by spatially rotating thermal vortices on the screen.*

Topological Braiding Gate (thermo-optical analog).

**Physical principle:** (Mirrorless). Vortex patterns arranged around a ring rotate on the screen (angle 0→π/2→π and back), creating moving heat sources whose decaying convective trail acts as "environmental memory". This is classical thermo-optics, not real non-Abelian statistics.
**Algorithmic essence:** For angles 0, π/2, π a braiding pattern is shown (drawBraiding), with a reference checkerboard grid on top. The camera captures frames (captureStable) and, via SAD optical flow (measureShiftVector), measures the BOS displacement field in the central quadrants, from which the curl = top.dx + right.dy − bottom.dx − left.dy is computed. The forward sweep (0→π) and reverse sweep (π→0) run without cooling, and the hysteresis area is estimated as |curl_forward − curl_reverse| at angle π/2.
**Analogy:** A topological computer braids particle trajectories; here warm air currents are braided, and the residual hysteresis is the trace of that "linking".
**Metric:** Hysteresis area H = |curl_CW − curl_CCW| (px) and its significance in σ; pass (check) requires pass, i.e. H > 0.25·noiseSigma.

### 88. 🌡️ Micro-Vortex Grid Capacity

`stage88_capacity` · 📵 works without mirror (control)

*Evaluating the ultimate capacity and resolution of the thermal (BOS) grid on the smartphone.*

Micro-Vortex Grid Capacity (thermo-optical analog).

**Physical principle:** (Mirrorless). A grid of independent thermal micro-vortices is created above the screen; the denser the grid, the more the convective flows overlap. This is classical thermo-optics.
**Algorithmic essence:** Patterns with 1, 2, 4, 6 and 8 quad-vortex cells are shown in turn over a reference checkerboard grid. For each cell the camera captures frames (captureStable) and, via SAD optical flow (measureShiftVector), measures the local curl = top.dx + right.dy − bottom.dx − left.dy. A level-N test passes if enough cells have |curl| above a threshold that drops with density (0.40σ for 1 down to 0.15σ for 8); the capacity is the highest passing N.
**Analogy:** A stress test: how many independent "thermal processors" fit in the air above one screen before they merge.
**Metric:** Capacity N = number of resolved cells; pass (check) requires pass, i.e. at least 1 cell resolved (N ≥ 1).

### 90. 🌀 Vortex Knots and Links

`stage90_knots` · 📵 works without mirror (control)

*Tracking physical trajectories of thermal vortices to compute topological invariants (links).*

Vortex Knots and Links (thermo-optical analog).

**Physical principle:** (Mirrorless). The OLED screen drives thermal vortices along complex trajectories (a trefoil knot, then a braid of two vortices on modulated circles), creating convective air distortions. This is classical thermo-optics; the invariant is computed statistically.
**Algorithmic essence:** Mode 1 — a vortex traces a trefoil (30 frames); Mode 2 — two vortices A and B of opposite chirality braid (40 frames). At each step a pattern is shown over a reference checkerboard grid, the camera captures frames (captureStable) and, via SAD optical flow (measureShiftVector), tracks the vortex centers. From the differential shift coordinates the Gauss linking number is integrated step by step: Lk = Σ (Δx·dΔy − Δy·dΔx)/(2π·|Δ|²).
**Analogy:** Knots are usually computed on heavy simulators; here they are "braided" from warm air currents and their intertwining is measured optically.
**Metric:** Linking number Lk (target ≈1.0); pass (check) requires pass, i.e. |Lk| > 0.45.

---

## Mathematical Algorithms & Applications

### 28. Transfer Matrix (Rank, SVD)

`stage28_matrix` · 🪞 requires mirror

*Optical computation of a matrix product via time multiplexing.*

Optical transfer matrix and its SVD analysis.

**Physical principle:** (With mirror). The screen acts as a 2D optical modulator: for each of the 8 basis vectors exactly one vertical column is lit (one-hot).
**Algorithmic essence:** Time multiplexing: a one-hot pattern is shown 8 times, the camera integrates brightness across 8 columns and forms one row of the transfer matrix T (8×8). The CPU then computes TᵀT, estimates singular values from its diagonal, the rank (σ > 5% of σ_max) and the condition number κ.
**Analogy:** The smartphone as an optical linear-algebra channel whose transfer matrix we measure and factorize.
**Metric:** rank of the transfer matrix; passes when rank ≥ 4.

### 31. Null Test (Background)

`stage31_null` · 🪞 requires mirror

*Calibration of background illumination and thermal noise of the frame sensor.*

Null control test.

**Physical principle:** (With mirror). The screen displays a uniform gray (#808080) with no patterns at all — the detector should see NO signal.
**Algorithmic essence:** On the gray frame 5 checks are run, each of which MUST fail: stripe contrast, left/right brightness difference, RGB spread, spatial variance over 8 bins, and correlation of 4 bins with a random vector. Every threshold crossing counts as a false positive; integrity = 1 − FP/5.
**Analogy:** A blank-experiment control in a physics lab: the instrument must not 'detect' a signal where none exists.
**Metric:** test integrity (fraction of checks with no false positive); passes when integrity ≥ 0.8 (at most 1 of 5 FP).

### 36. BB84 Protocol (QKD)

`stage36_bb84` · 🪞 requires mirror

*Simulation of key distribution and eavesdropper detection (BB84).*

BB84 quantum key distribution protocol.

**Physical principle:** (With mirror). Two bases are encoded by different ways the screen glows: the rectilinear basis by brightness level (dark/bright), the diagonal basis by stripe orientation (vertical/horizontal).
**Algorithmic essence:** For 16 bits 'Alice' randomly picks a bit and a basis and displays the corresponding pattern; 'Bob' (the camera) measures in a random basis — via brightness threshold or by comparing horizontal/vertical gradients. After sifting on matching bases the QBER (error fraction) and key length are computed.
**Analogy:** An optical cipher game where basis mismatches and camera noise produce errors, as an eavesdropper would.
**Metric:** QBER; the channel is deemed secure when QBER < 0.11 and the sifted key length ≥ 4 bits.

### 38. Superposition Nonlinearity

`stage38_wnonlin` · 🪞 requires mirror

*Analysis of W-correlations accounting for the camera sensor's nonlinearity.*

Probing the nonlinearity of the optical channel via superposition violation.

**Physical principle:** (With mirror). In linear optics brightnesses add up: the response to the sum of two patterns equals the sum of the responses. A nonlinear channel (or the gamma response of the CMOS sensor) breaks this.
**Algorithmic essence:** For 5 intensity levels the screen sequentially shows pattern A (horizontal stripes), pattern B (vertical stripes) and their overlay A+B (a grid). The camera measures the mean brightness of each; the deviation δ = I(A+B) − [I(A)+I(B)] from linearity is fit to a power law δ ∝ Iⁿ by least squares in log coordinates.
**Analogy:** Testing whether two light sources 'add up' honestly, or whether the phone's optics inject a quadratic (Iⁿ, n≈2) term.
**Metric:** the exponent n; passes when n > 0.5 (a nonlinear departure from superposition is detected).

### 39. Shot Noise (Poisson Statistics)

`stage39_poisson` · 🪞 requires mirror

*Verifying photon shot-noise statistics (σ² ∝ μ) from the camera sensor.*

Poisson statistics: testing the σ² ∝ μ law of camera noise.

**Physical principle:** (With mirror). For Poissonian (shot) photon noise the variance equals the mean, σ² = μ; the camera measures this fundamental link between intensity and fluctuations.
**Algorithmic essence:** The screen sequentially shows 10 brightness levels (from 20 to 227). At each, 30 frames are captured, and the region's mean brightness yields μ and the temporal variance σ². A linear regression then estimates σ² = a·μ + b (with R²), while a log-log fit gives the power-law exponent of σ² ∝ μⁿ.
**Analogy:** Listening to the photon 'hiss': the brighter the light, the stronger the shot noise — exactly proportionally, as Poisson statistics demand.
**Metric:** the coefficient of determination R² of the linear σ²(μ) model; passes when R² > 0.5.

### 40. Frequency Scan (MTF)

`stage40_freqscan` · 🪞 requires mirror

*Searching for the Nyquist frequency and resonances of the optical channel.*

Frequency scan of the optical channel in search of NVG oscillations.

**Physical principle:** (With mirror). The contrast of a sinusoidal grating decays with frequency along a Gaussian law (the channel MTF); a faint 'ripple' on top of that decay could betray a new effective wavelength λ_eff.
**Algorithmic essence:** For 9 spatial frequencies the screen is split into Alice and Bob halves at CHSH angles; the camera captures frames, and the fringe phase coherence yields C(f) and the value S. The C(f) curve is fit to a Gaussian C₀·exp(−f²/2σ²); the residuals are scanned for a hidden oscillation by correlating with cos(2πf/f_NVG), and λ_eff is estimated from the found f_NVG.
**Analogy:** A hearing test for the phone's optics: against a smooth decay we hunt for the faintest periodic tremor that classical optics should not produce.
**Metric:** the peak correlation of the residuals with the oscillation, corr; NVG is deemed detected when |corr| > 0.7 (with ≥ 5 residual points).

### 41. Optical Gradient Descent (SGD)

`stage41_optsgd` · 🪞 requires mirror

*Hardware computation of the error gradient via an optical feedback loop.*

Optical gradient descent with a camera feedback loop.

**Physical principle:** (With mirror). The screen acts as an optical output layer: 8 weights are drawn as 8 brightness columns, and the camera reads back the channel's actual response — the network's 'forward pass'.
**Algorithmic essence:** 8 training iterations. At each one the current weights W are shown as columns, the camera measures the output y (8 bins), the MSE error against a target vector is computed, and by the delta rule W ← W − η·(y − y_target) (η=0.7) the weights are updated. The final loss reduction is assessed by a separate measurement.
**Analogy:** A neural network whose 'neuron' is the phone's real optical channel, trained by trial-and-error through display and capture.
**Metric:** the initial and final Loss (MSE); passes when the error drops by ≥ 50% and the final Loss < 0.05.

### 42. Elliptic Curves (Points)

`stage42_elliptic` · 🪞 requires mirror

*Simulation of ECC point vector addition in color space.*

Elliptic curve: optical generator search and an exact rank proof.

**Physical principle:** (With mirror). The quality of a candidate point on the curve E: y²=x³−x−2 is encoded as screen brightness (the smaller the residual, the brighter); the camera ranks the candidates by measured brightness.
**Algorithmic essence:** The CPU builds a grid of integer candidates sorted by residual; the top candidates are lit one by one, the camera reads brightness and picks a generator. Then exact BigInt rational arithmetic verifies P∈E and that 2P is non-integral, and by the Nagell-Lutz theorem proves rank(E) ≥ 1; the orbit {nP} is additionally confirmed optically.
**Analogy:** Light hints at which point to take, while rigorous arithmetic proves the curve carries infinitely many rational points.
**Metric:** the curve rank; passes when rankGE1 — rank(E) ≥ 1 is certified (an infinite-order point via Nagell-Lutz).

### 43. Discrete Log (Baby-Step Giant-Step)

`stage43_bsgs` · 🪞 requires mirror

*Optical collision search in Shanks' algorithm (BSGS).*

The Baby-Step Giant-Step algorithm for the discrete logarithm on a curve.

**Physical principle:** (With mirror). Point coordinates are encoded as brightness, and the camera matches 'baby' and 'giant' steps by brightness as a visual optical verification of the collision.
**Algorithmic essence:** On E(F_97) a generator G and a secret k are fixed, Q=kG. The CPU finds the exact BSGS collision: a baby-step table jG (hashed by coordinates) and giant steps Q−i·mG search for a match, yielding k = j + i·m. In parallel the point brightness is shown on screen, and the camera measures brightness matches (opticalMatches) for confirmation.
**Analogy:** A meet-in-the-middle needle-in-a-haystack search, where matching patterns are additionally lit up for the eye.
**Metric:** the operation count ops = baby + giant steps (≈2√N instead of N by brute force); passes when kCorrect — the recovered k equals the secret (Q=kG verified).

### 44. Discrete Fourier Transform (DFT)

`stage44_dft` · 🪞 requires mirror

*Optical computation of the spatial spectrum via diffraction.*

A Fourier spectrum from a single optically captured frame.

**Physical principle:** (With mirror). A composite signal (a sum of sinusoids) is drawn as stripes on the screen and carried in a single frame through the optical channel to the camera; the channel acts as an analog medium preserving the spatial signal.
**Algorithmic essence:** The screen shows a sum of sinusoids at frequencies {2,5,9}, the camera captures ONE frame. A 1D profile is extracted from it (averaging rows), DC is removed, an inverse gamma is applied, and the CPU computes a 20-bin DFT. The spectral peaks and correlation are compared against a reference digital DFT of the input signal.
**Analogy:** 'Fourier in one snapshot' — the picture's spectrum is obtained from a single optical frame rather than a video stream.
**Metric:** the correlation of the optical and digital spectra, corr; passes when ≥ 2 peaks match (±1 bin) and corr > 0.2.

### 45. Birch–Swinnerton-Dyer (BSD)

`stage45_bsd` · 🪞 requires mirror

*Optical integration of the L-function via moiré-pattern measurement.*

The Birch-Swinnerton-Dyer conjecture: the camera computes a_p via the Legendre symbol.

**Physical principle:** (With mirror). The camera sums Legendre symbols optically: gamma correction makes brightness linear in the symbol, and the frame's mean brightness gives Σ Legendre/p in a single shot — hence the Frobenius trace a_p.
**Algorithmic essence:** For curve E₁ and primes p ≤ 47 the screen shows a gamma-corrected Legendre-symbol pattern (V₋/V₀/V₊), the camera reads brightness and extracts a_p (half-range normalization). The CPU then computes the full L-functions of 5 curves via the Euler product and proves rank by Nagell-Lutz (BigInt); BSD is checked as the agreement of the |L| ordering with rank.
**Analogy:** A hardest-of-all math conjecture reduced to measuring the mean brightness of a pattern encoding number-theoretic symbols.
**Metric:** the optical a_p correlation (camera vs CPU) and the fraction of consistent curves; passes when bsdAllConsistent — BSD consistency holds for all 5 curves.

### 46. Schrödinger Equation (Eigenstates)

`stage46_schroedinger` · 🪞 requires mirror

*Analog step-by-step propagation of the wave function (evolution).*

Eigenstates of a potential well and the energy spectrum, through optics.

**Physical principle:** (With mirror). The infinite-well eigenfunctions ψ_n = sin(nπx/L) are displayed as standing brightness waves; the camera measures their spatial frequency, yielding the quantum number n.
**Algorithmic essence:** For n=1..4 the screen draws ψ_n (n full sinusoidal periods), the camera captures a frame, a 1D profile is extracted, DC is removed and a DFT finds the dominant frequency k=n. From this the energy E_n ∝ n² and the ratio E₂/E₁ (reference 4.0) follow. Orthogonality ⟨ψ₁|ψ₂⟩ is checked separately via the cross-term of the superposition brightness.
**Analogy:** Screen and camera play the 'string' of a quantum particle: each mode rings at its own frequency, while energies grow as n².
**Metric:** the average error of the measured n (%); passes when modes n=1 and n=2 are identified correctly (|n_meas − n| ≤ 1).

### 56. Travelling Salesman Problem (TSP)

`stage56_tsp` · 🪞 requires mirror

*Optical solution of graph problems via constructive interference.*

The travelling salesman problem: finding the shortest route by brightness.

**Physical principle:** (With mirror). Each route's cost is encoded as the brightness of a screen bar (the shorter the path, the brighter); the camera looks for the brightest bin, which points to the optimal route.
**Algorithmic essence:** For 4, 5 and 6 cities the CPU enumerates all unique routes (fixed start, no mirror duplicates) and computes their lengths. The costs are shown as brightness bins, the camera measures them via measureNBins and picks the brightest; this 'optical' answer is compared with the classical optimum. The problem size grows as long as screen resolution allows (px/bin ≥ 10).
**Analogy:** All routes glow at once, and the shortest one flares brightest — the eye (camera) spots the winner instantly.
**Metric:** the maximum city count for which the optical pick matched the optimum; passes when maxSolved ≥ 4.

### 59. Optical Data Compression

`stage59_compress` · 🪞 requires mirror

*Estimating the information entropy of an optical signal via dispersion.*

Lossless information compression.

**Physical principle:** (With mirror). Bit streams are shown on screen as brightness columns and read back by the camera in chunks (16 bits, 3 frames, majority vote) to verify the optical channel.
**Algorithmic essence:** The CPU applies prefix-free pair coding (00→0, 01→10, 10→110, 11→111) iteratively to 5 sets of 64 bits (all-zeros, sparse 95/90%, structured, random), stopping when no further gain occurs, and confirms reversibility via decompression. The best case is additionally read by the camera.
**Analogy:** White noise cannot be compressed, while ordered patterns collapse into a narrow stream — and this can be "read" with light.
**Metric:** Best compression ratio bestRatio; pass when every test is fully reversible AND bestRatio > 1.2.

### 60. Bounce Compression (Golden Ratio)

`stage60_bouncecomp` · 🪞 requires mirror

*Testing the robustness of the Bounce compression algorithm in a real optical channel.*

Bounce compression (V-curve).

**Physical principle:** (With mirror). The resulting V-curve a(t) is displayed as brightness bars (up to 16) and read back by the camera (measureNBins) to compare against the theoretical bounce curve.
**Algorithmic essence:** The CPU compresses 128 sparse bits with the same prefix-free code as stage59; contraction proceeds to a "bounce" at the critical density ρ_c=(3−√5)/2 (golden ratio), then expansion losslessly reconstructs the data. V-curve symmetry and data↔theory correlation are computed.
**Analogy:** Compression as a cosmological bounce — data collapses to a minimum and symmetrically unfolds back without loss.
**Metric:** Compression ratio compressionRatio and correlation corr; pass when lossless AND corr > 0.9 AND compressionRatio > 1.5.

### 61. Text Compression (LZSS)

`stage61_textcomp` · 🪞 requires mirror

*Lossless text compression (LZSS + bounce) with chunked optical bit verification.*

Text compression (LZSS + Bounce).

**Physical principle:** (With mirror). The bits of the best-compressing text are shown on screen as brightness columns and read back by the camera in chunks (16 bits, 3 frames, majority vote) — original and compressed streams separately — to verify the optical channel.
**Algorithmic essence:** For each of 6 texts (repeats, prose, code, XML, logs, DNA) the CPU tries 4 methods (raw, delta, lz, lz+delta), then iteratively compresses the bits with the same prefix-free code as stage59 and keeps the best; reversibility is confirmed by full decompression and string comparison.
**Analogy:** Sending a text file with light — ordered patterns collapse into a narrow stream, while decompression restores every character without loss.
**Metric:** Best compression ratio bestRatio; pass when every text is fully reversible AND bestRatio > 1.3.

### 62. Mertens Function (Riemann Hypothesis)

`stage62_mertens` · 🪞 requires mirror

*Optical computation of the Mertens sum by summing Mobius-encoded brightness columns.*

Mertens function M(x)=Σμ(n) (Number theory).

**Physical principle:** (With mirror). Mobius values μ(n)∈{−1,0,+1} are shown as columns at dark/mid/bright levels (gamma-calibrated), and the camera measures the mean window brightness — an optical sum of μ(n) yielding M(N).
**Algorithmic essence:** The CPU sieves μ(n) for n=1..500 and the exact M(x); optically M(N) is recovered from the normalized mean brightness for N=10,20,30,40,47 and compared to the CPU (Pearson correlation). The Riemann bound |M(x)|≤√x is then checked at control points up to 500.
**Analogy:** Light adds up the pluses and minuses of number theory into a single value, like a balance summing weights of opposite sign.
**Metric:** Correlation corr between optics and CPU; pass when rhConsistent — |M(x)|≤√x holds at all control points x≤500.

### 63. Goldbach Conjecture

`stage63_goldbach` · 🪞 requires mirror

*Optical verification of the Goldbach conjecture by counting prime-pair brightness columns.*

Goldbach conjecture: N = p + q (Number theory).

**Physical principle:** (With mirror). For even N, columns k=2..N/2 are shown bright if both k and N−k are prime, dark otherwise (gamma-calibrated). The camera measures the fraction of bright columns, giving the Goldbach pair count G(N).
**Algorithmic essence:** The CPU sieves primes up to 1000 and computes G(N); optically G(N) is recovered from the mean brightness for N=10,20,30,40,46 and compared to the CPU (Pearson correlation). The CPU then checks G(N)>0 for every even 4≤N≤1000.
**Analogy:** Every even number splits into a pair of primes, and light counts how many such splittings exist.
**Metric:** Maximum verified N (maxVerified) and correlation corr; pass when allVerified — G(N)>0 for every even N up to 1000.

### 64. Dirichlet L-functions

`stage64_dirichlet` · 🪞 requires mirror

*Optical Dirichlet character sums and L-functions verifying primes in progressions.*

Dirichlet L-functions and primes in progressions (Number theory).

**Physical principle:** (With mirror). Quadratic character values χ_q(n)∈{−1,0,+1} (Legendre symbol) are shown as columns at dark/mid/bright levels (gamma-calibrated), and the camera measures the mean brightness — an optical character sum Σχ(n).
**Algorithmic essence:** For moduli q=5..47 the CPU computes L(1,χ), the Pólya–Vinogradov bound |S(N)|≤√q·log q, and the distribution of primes across residue classes; optically Σχ(n) over a full period (≈0) is compared to the CPU (Pearson correlation).
**Analogy:** The alternating pluses and minuses of a character become a brightness pattern whose total luminosity is the series sum.
**Metric:** Correlation corr between optics and CPU; pass when allLnonzero (L(1,χ)≠0 for all q) AND allPV (Pólya–Vinogradov bound satisfied).

### 65. Class Numbers (Heegner Numbers)

`stage65_classnum` · 🪞 requires mirror

*Optical class numbers h(D) via Kronecker character sums of quadratic fields.*

Class numbers h(D) of imaginary quadratic fields (Number theory).

**Physical principle:** (With mirror). Kronecker symbol values χ_D(n)∈{−1,0,+1} are shown as columns at dark/mid/bright levels (gamma-calibrated), and the camera measures the mean brightness — an optical character sum Σχ_D(n).
**Algorithmic essence:** Using h(D)=−(1/|D|)·Σ n·χ_D(n) the CPU exactly computes the class number for 15 discriminants D from −3 to −47 and checks them against references; optically Σχ_D(n) is read by the camera for |D|≤47 and compared to the CPU. Heegner numbers (h(D)=1, UFD) are identified.
**Analogy:** The field's character fingerprint, rendered as stripes of light, measures how far its ring of integers is from unique factorization.
**Metric:** Number of exact optical matches exactMatch; pass when allCorrect — every h(D) matches its reference value.

### 66. Kloosterman Sums (Weil Bound)

`stage66_kloosterman` · 🪞 requires mirror

*Optical Kloosterman sums verifying the Weil bound via cosine brightness encoding.*

Kloosterman sums and the Weil bound (Number theory).

**Physical principle:** (With mirror). The terms cos(2π(ax+bx⁻¹)/p)∈[−1,+1] are shown as columns of continuous gamma-calibrated brightness, and the camera measures the mean window brightness — an optical sum Re(K).
**Algorithmic essence:** The CPU computes K(a,b;p) for primes 5..97 and a set of pairs (a,b) and checks the Weil bound |K|≤2√p; optically Re(K) for K(1,1;p), p≤47 is read by the camera and compared to the CPU (Pearson correlation).
**Analogy:** Trigonometric terms become stripes of light whose total brightness is the value of the sum.
**Metric:** Maximum ratio |K|/2√p (maxRatio) and correlation corr; pass when allWeilSatisfied — |K|≤2√p for every (p,a,b) triple.

### 67. Monte Carlo π

`stage67_montecarlo` · 🪞 requires mirror

*Optical Monte Carlo estimation of π by measuring the fraction of in-circle points.*

Monte Carlo estimation of π (Numerical methods).

**Physical principle:** (With mirror). Random points in the square [0,1]² are shown as columns: bright if x²+y²≤1 (inside the circle), dark otherwise (gamma-calibrated). The camera measures the mean brightness — the fraction of in-circle points, so π≈4·fraction.
**Algorithmic essence:** A deterministic Mulberry32 PRNG drives 8 trials of 40 points each; for every trial the CPU computes π while the optical fraction is read by the camera and compared (Pearson correlation). A separate run up to 10000 points demonstrates O(1/√N) convergence.
**Analogy:** We throw glowing darts into a circle and measure the board's total brightness instead of counting hits by hand.
**Metric:** Estimate cpuPi and error |cpuPi−π|; pass when |cpuPi−π| < 0.2.

### 68. Optical Integrator

`stage68_integral` · 🪞 requires mirror

*Optical Riemann integration: the camera averages brightness to compute definite integrals.*

Optical Riemann integral ∫f(x)dx (Numerical methods).

**Physical principle:** (With mirror). Values of f(x) are shown as 40 brightness columns (piecewise-linear 3-point calibration f=0/0.5/1), and the camera averages the window brightness — exactly ∫₀¹f(x)dx as the mean over the interval.
**Algorithmic essence:** For 8 functions with known integrals (x², sin(πx), e⁻ˣ, √x, 4x(1−x), x·sin(πx), 1/(1+x²), cos²(πx)) the CPU computes a Riemann sum while the optical integral is recovered from the mean brightness and compared to the exact value (Pearson correlation).
**Analogy:** The area of a complex shape is measured not with a ruler but by "weighing" the collected light in a single frame.
**Metric:** Number of integrals within 5% error (closeCount of total=8); pass when closeCount ≥ half (≥4).

### 69. Ising Model (Phase Transition)

`stage69_ising` · 🪞 requires mirror

*1D Ising phase transition with the camera as an optical magnetometer.*

Ising model and phase transition (Statistical physics).

**Physical principle:** (With mirror). After simulation the spins are shown as columns: +1 bright, −1 dark (gamma-calibrated), and the camera measures the mean brightness — an optical magnetization m=(1/N)Σσᵢ.
**Algorithmic essence:** The CPU runs a 1D Ising model (N=40, J=1) with the Metropolis algorithm for 200 sweeps at 12 temperatures T=0.1..8.0; for each it computes the magnetization while the optical m is read by the camera and compared (Pearson correlation). The ordered (low T) and disordered (high T) phases are contrasted.
**Analogy:** The screen is a strip of little magnets and the camera is a magnetometer reading their net orientation at a glance.
**Metric:** Correlation corr between optics and CPU; pass when phaseTransition — avg|m| > 0.5 for T≤1 AND < 0.5 for T≥3.

### 70. Hamming Code (7,4)

`stage70_hamming` · 🪞 requires mirror

*Hardware demonstration of optical error correction via the Hamming code.*

Hamming(7,4) code through an optical channel (Information theory).

**Physical principle:** (With mirror). A 7-bit codeword is shown as brightness columns with guard bands at the edges, travels the real screen→mirror→camera channel (accounting for the mirror flip) and is threshold-decoded — real channel noise (PSF, gamma, quantization) produces genuine errors.
**Algorithmic essence:** The CPU encodes all 16 four-bit messages into Hamming(7,4); the camera receives the codewords and syndrome decoding corrects single-bit errors. Raw channel BER and post-correction BER are measured.
**Analogy:** Sending a message by traffic light through fog — the channel adds noise, and the Hamming code fixes the "typos".
**Metric:** Post-correction BER correctedBER; pass when correctedBER < 10%.

### 71. Benford's Law

`stage71_benford` · 🪞 requires mirror

*Optical verification of Benford's first-digit law on mathematical datasets.*

Benford's law P(d)=log₁₀(1+1/d) (Statistics).

**Physical principle:** (With mirror). For each digit d=1..9 the dataset entries are shown as columns: bright if the number's leading digit equals d, dark otherwise (gamma-calibrated). The camera measures the fraction of bright columns — the optical frequency of that digit.
**Algorithmic essence:** For 4 datasets (powers 2ⁿ, Fibonacci, factorials n!, n²) the CPU computes leading-digit frequencies and a χ² test (threshold 15.51), while the optical frequencies are read by the camera and compared (Pearson correlation).
**Analogy:** One leads over nine not by chance — even dry numbers obey a logarithmic law made visible in brightness.
**Metric:** Number of datasets passing χ²<15.51 (benfordCount of 4) and average correlation avgOptCorr; pass when benfordCount ≥ 2.
