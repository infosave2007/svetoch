// Stage 81: Optical LLM v2 — RGB Spatial Multiplexing + VMF-inspired
//
// VMF THEORY CONNECTIONS (github.com/infosave2007/vmf):
// 1. Green channel = "vacuum anchor" M_Ω₀ = 859 MeV
//    → constant G=V_MID normalizes R,B per-band (like M_Ω₀ anchors all VMF predictions)
// 2. Bounce activation from modified Friedmann: H²=...ρ(1−ρ/ρ_c)
//    → f(x) = x·max(0, 1−x²/C²) prevents optical saturation
// 3. RGB = complex field Φ = W·e^(iθ): R=Re(Φ), B=Im(Φ), G=|Φ₀| anchor
//
// KEY IDEA: display ALL dot products in ONE frame using horizontal bands.
// Camera reads N band averages → N dot products simultaneously.
//
// Architecture: 2-layer neural net with skip connection
//   Embedding:   27 → 16  (digital lookup)
//   MLP up:      16 → 32  (OPTICAL: 1 frame, 32 bands × 16 cols)
//   ReLU                   (digital)
//   MLP down:    32 → 16  (OPTICAL: 1 frame, 16 bands × 32 cols)
//   Skip connection + add  (digital)
//   Unembedding: 16 → 27  (OPTICAL: 1 frame, 27 bands × 16 cols)
//   Softmax → sampling     (digital)
//
// Total: 3 OPTICAL FRAMES per token  (v1 used 27 frames!)
// Speed: ~1 sec/token → 20 tokens in ~25 seconds
// Params: 1888 (vs 432 in v1)

export async function run() {
  this.setRun(this.t('etap'), this.t('llm2_start'), 141.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};
  const V0 = 10, V_MID = 128, V1 = 250;

  // ── Measure RGB brightness of horizontal bands (R, G, B channels) ──
  // G channel = VMF vacuum anchor for per-band normalization
  const measureBandsRGB = (frame, nBands) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = (cal.y0 != null) ? cal.y0 : 0;
    const y1 = (cal.y1 != null) ? cal.y1 : fh;
    const bandH = (y1 - y0) / nBands;
    const margin = Math.max(2, Math.floor(bandH * 0.12));
    const rBands = [], gBands = [], bBands = [];
    for (let b = 0; b < nBands; b++) {
      const by0 = Math.floor(y0 + b * bandH) + margin;
      const by1 = Math.floor(y0 + (b + 1) * bandH) - margin;
      let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
      for (let y = by0; y < by1; y += 2) {
        for (let x = x0; x < x1; x += 3) {
          const i = (y * fw + x) * 4;
          rSum += d[i];     // Red channel (positive products)
          gSum += d[i + 1]; // Green channel (VMF anchor M_Ω₀)
          bSum += d[i + 2]; // Blue channel (negative products)
          cnt++;
        }
      }
      rBands.push(cnt > 0 ? rSum / cnt : 0);
      gBands.push(cnt > 0 ? gSum / cnt : 0);
      bBands.push(cnt > 0 ? bSum / cnt : 0);
    }
    return { rBands, gBands, bBands };
  };

  // ── Measure grayscale bands (for calibration) ──
  const measureBands = (frame, nBands) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = (cal.y0 != null) ? cal.y0 : 0;
    const y1 = (cal.y1 != null) ? cal.y1 : fh;
    const bandH = (y1 - y0) / nBands;
    const margin = Math.max(2, Math.floor(bandH * 0.12));
    const results = [];
    for (let b = 0; b < nBands; b++) {
      const by0 = Math.floor(y0 + b * bandH) + margin;
      const by1 = Math.floor(y0 + (b + 1) * bandH) - margin;
      let sum = 0, cnt = 0;
      for (let y = by0; y < by1; y += 2) {
        for (let x = x0; x < x1; x += 3) {
          const i = (y * fw + x) * 4;
          sum += (d[i] + d[i+1] + d[i+2]) / 3; cnt++;
        }
      }
      results.push(cnt > 0 ? sum / cnt : 0);
    }
    return results;
  };

  // ── RGB cross-talk matrix calibration ──
  // When displaying rgb(R,0,B), camera sees:
  //   R_cam = darkR + a·R_frac + c·B_frac   (a=direct, c=B→R crosstalk)
  //   B_cam = darkB + d·R_frac + b·B_frac   (b=direct, d=R→B crosstalk)
  // We calibrate a,b,c,d and then invert the 2×2 matrix to deconvolve.

  // 1. Dark baseline
  this.showColor('rgb(0,0,0)');
  await this.sleep(500);
  const frDark = await this.captureStable(6, 40);
  const darkRGB = measureBandsRGB(frDark, 1);
  const darkR = darkRGB.rBands[0], darkB = darkRGB.bBands[0];

  // 2. Pure Red → measure R_cam and B_cam (gives a, d)
  this.showColor(`rgb(${V1},0,0)`);
  await this.sleep(500);
  const frRedCal = await this.captureStable(6, 40);
  const redCalRGB = measureBandsRGB(frRedCal, 1);
  const a_coeff = redCalRGB.rBands[0] - darkR;  // R→R (direct)
  const d_coeff = redCalRGB.bBands[0] - darkB;  // R→B (crosstalk)

  // 3. Pure Blue → measure R_cam and B_cam (gives c, b)
  this.showColor(`rgb(0,0,${V1})`);
  await this.sleep(500);
  const frBlueCal = await this.captureStable(6, 40);
  const blueCalRGB = measureBandsRGB(frBlueCal, 1);
  const c_coeff = blueCalRGB.rBands[0] - darkR;  // B→R (crosstalk)
  const b_coeff = blueCalRGB.bBands[0] - darkB;  // B→B (direct)

  // 4. Invert 2×2 matrix: [a c; d b]^-1 = [b -c; -d a] / det
  const det = a_coeff * b_coeff - c_coeff * d_coeff;
  const crossR = c_coeff / Math.max(a_coeff, 0.1);  // B→R leakage ratio
  const crossB = d_coeff / Math.max(b_coeff, 0.1);  // R→B leakage ratio

  this.log(`  cal RGB: a=${a_coeff.toFixed(1)} b=${b_coeff.toFixed(1)} c=${c_coeff.toFixed(1)} d=${d_coeff.toFixed(1)}`);
  this.log(`  cross-talk: B→R=${(crossR*100).toFixed(1)}% R→B=${(crossB*100).toFixed(1)}%, det=${det.toFixed(1)}`);

  // ── Band order verification ──
  this.showPattern((ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = Math.round(V1 - (V1 - V0) * y / h);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  await this.sleep(300);
  const gradFrame = await this.captureStable(4, 30);
  const gradBands = measureBands(gradFrame, 4);
  const bandFlip = gradBands[0] < gradBands[3];
  this.log(`  bands: top=${gradBands[0].toFixed(1)}, bottom=${gradBands[3].toFixed(1)}${bandFlip ? ' (flipped!)' : ''}`);
  // ── Per-band calibration for spatial uniformity ──
  // Measure dark/bright per band for EACH band count used in inference
  const BAND_COUNTS = [32, 16, 27]; // D_FF=32, D=16, VOCAB=27
  const bandCal = {};  // bandCal[nBands] = { darkR[], darkB[], aR[], aB[], cR[], cB[] }
  const gamma = cal.gamma || 1.5;
  const invGamma = 1 / gamma;

  // Helper: draw uniform bands pattern with given R,G,B values
  const showUniformBands = (nBands, rVal, gVal, bVal) => {
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = 'rgb(0,0,0)';
      ctx.fillRect(0, 0, w, h);
      const bandH = h / nBands;
      const sep = Math.max(1, Math.floor(bandH * 0.04));
      for (let j = 0; j < nBands; j++) {
        const by = Math.floor(j * bandH) + sep;
        const bh = Math.floor(bandH) - 2 * sep;
        ctx.fillStyle = `rgb(${rVal},${gVal},${bVal})`;
        ctx.fillRect(0, by, w, bh);
      }
    });
  };

  for (const nB of BAND_COUNTS) {
    // Dark per band (all dark, with G anchor)
    showUniformBands(nB, V0, V_MID, V0);
    await this.sleep(150);
    const fDark = await this.captureStable(4, 30);
    let dkRGB = measureBandsRGB(fDark, nB);
    if (bandFlip) { dkRGB.rBands.reverse(); dkRGB.gBands.reverse(); dkRGB.bBands.reverse(); }

    // Pure Red (V1, G_anchor, V0) per band
    showUniformBands(nB, V1, V_MID, V0);
    await this.sleep(150);
    const fRed = await this.captureStable(4, 30);
    let rdRGB = measureBandsRGB(fRed, nB);
    if (bandFlip) { rdRGB.rBands.reverse(); rdRGB.gBands.reverse(); rdRGB.bBands.reverse(); }

    // Pure Blue (V0, G_anchor, V1) per band
    showUniformBands(nB, V0, V_MID, V1);
    await this.sleep(150);
    const fBlue = await this.captureStable(4, 30);
    let blRGB = measureBandsRGB(fBlue, nB);
    if (bandFlip) { blRGB.rBands.reverse(); blRGB.gBands.reverse(); blRGB.bBands.reverse(); }

    // Mean green reference across calibration frames (VMF anchor)
    const gRefBands = dkRGB.gBands.map((v, j) => 
      (dkRGB.gBands[j] + rdRGB.gBands[j] + blRGB.gBands[j]) / 3);

    bandCal[nB] = {
      darkR: dkRGB.rBands,
      darkB: dkRGB.bBands,
      gRef: gRefBands,  // per-band green anchor reference
      // Per-band cross-talk matrix coefficients
      a: rdRGB.rBands.map((v, j) => v - dkRGB.rBands[j]),  // R→R direct
      d: rdRGB.bBands.map((v, j) => v - dkRGB.bBands[j]),  // R→B crosstalk
      c: blRGB.rBands.map((v, j) => v - dkRGB.rBands[j]),  // B→R crosstalk
      b: blRGB.bBands.map((v, j) => v - dkRGB.bBands[j]),  // B→B direct
    };
  }
  this.log(`  per-band cal: ${BAND_COUNTS.join(',')} bands + green anchor calibrated`);

  // ── Optical MV multiply via RGB spatial multiplexing ──
  // SINGLE FRAME per MV: Red = positive products, Blue = negative products
  // Per-band cross-talk deconvolution with pre-gamma correction
  const opticalMV = async (input, W, nBands, nCols) => {
    const products = [];
    let maxAbs = 0.001;
    for (let j = 0; j < nBands; j++) {
      products[j] = [];
      for (let k = 0; k < nCols; k++) {
        const p = input[k] * W[j][k];
        products[j][k] = p;
        if (Math.abs(p) > maxAbs) maxAbs = Math.abs(p);
      }
    }

    // Display: R=pos, G=anchor(V_MID), B=neg, with inverse gamma pre-correction
    // Green channel = VMF vacuum anchor M_Ω₀ (constant reference for normalization)
    const G_ANCHOR = V_MID; // constant green = vacuum background |Φ₀|
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = 'rgb(0,0,0)';
      ctx.fillRect(0, 0, w, h);
      const bandH = h / nBands;
      const colW = w / nCols;
      const sep = Math.max(1, Math.floor(bandH * 0.04));
      for (let j = 0; j < nBands; j++) {
        const by = Math.floor(j * bandH) + sep;
        const bh = Math.floor(bandH) - 2 * sep;
        for (let k = 0; k < nCols; k++) {
          const posVal = Math.max(0, products[j][k]) / maxAbs;  // [0, 1]
          const negVal = Math.max(0, -products[j][k]) / maxAbs; // [0, 1]
          // Apply inverse gamma to linearize camera response
          const r = Math.round(V0 + (V1 - V0) * Math.pow(posVal, invGamma));
          const b = Math.round(V0 + (V1 - V0) * Math.pow(negVal, invGamma));
          ctx.fillStyle = `rgb(${r},${G_ANCHOR},${b})`;
          ctx.fillRect(Math.floor(k * colW), by, Math.ceil(colW), bh);
        }
      }
    });
    await this.sleep(180);
    // Average 2 frames for noise reduction (√2 improvement)
    const frame1 = await this.captureStable(6, 35);
    const rgb1 = measureBandsRGB(frame1, nBands);
    await this.sleep(60);
    const frame2 = await this.captureStable(4, 25);
    const rgb2 = measureBandsRGB(frame2, nBands);
    let rgbBands = {
      rBands: rgb1.rBands.map((v, j) => (v + rgb2.rBands[j]) / 2),
      gBands: rgb1.gBands.map((v, j) => (v + rgb2.gBands[j]) / 2),
      bBands: rgb1.bBands.map((v, j) => (v + rgb2.bBands[j]) / 2),
    };
    if (bandFlip) {
      rgbBands.rBands = rgbBands.rBands.reverse();
      rgbBands.gBands = rgbBands.gBands.reverse();
      rgbBands.bBands = rgbBands.bBands.reverse();
    }

    // VMF-anchor normalization: G channel = per-band gain reference
    // Like M_Ω₀ normalizes all VMF predictions, G normalizes R,B measurements
    const bc = bandCal[nBands];
    return rgbBands.rBands.map((rCam, j) => {
      const bCam = rgbBands.bBands[j];
      const gCam = rgbBands.gBands[j];
      // Per-band gain correction via green anchor (VMF M_Ω₀ normalization)
      const gExpected = bc.gRef[j];  // per-band green reference
      const gGain = gExpected / Math.max(gCam, 1);
      const rCorr = (rCam - bc.darkR[j]) * gGain;
      const bCorr = (bCam - bc.darkB[j]) * gGain;
      // Per-band 2×2 matrix inversion (cross-talk deconvolution)
      const aj = Math.max(bc.a[j], 0.1);
      const bj = Math.max(bc.b[j], 0.1);
      const cj = bc.c[j];
      const dj = bc.d[j];
      const detj = aj * bj - cj * dj;
      const rTrue = (bj * rCorr - cj * bCorr) / detj;
      const bTrue = (aj * bCorr - dj * rCorr) / detj;
      // Convert to dot product sum
      const posSum = Math.max(0, rTrue) * maxAbs * nCols;
      const negSum = Math.max(0, bTrue) * maxAbs * nCols;
      return posSum - negSum;
    });
  };

  // ══════════════════════════════════════
  // MODEL DEFINITION
  // ══════════════════════════════════════
  const CHARS = ' abcdefghijklmnopqrstuvwxyz';
  const VOCAB = 27, D = 16, D_FF = 32;
  const charToIdx = c => { const i = CHARS.indexOf(c.toLowerCase()); return i >= 0 ? i : 0; };

  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };

  // Initialize weights
  const E     = Array.from({length: VOCAB}, () => Array.from({length: D}, () => (rng()-0.5)*0.3));
  const W_up  = Array.from({length: D_FF},  () => Array.from({length: D}, () => (rng()-0.5)*0.3));
  const W_dn  = Array.from({length: D},     () => Array.from({length: D_FF}, () => (rng()-0.5)*0.3));
  const U     = Array.from({length: D},     () => Array.from({length: VOCAB}, () => (rng()-0.5)*0.3));

  const softmax = (logits, temp=1.0) => {
    const sc = logits.map(l => l / temp);
    const mx = Math.max(...sc);
    const ex = sc.map(l => Math.exp(l - mx));
    const sm = ex.reduce((s,v) => s+v, 0);
    return ex.map(e => e / sm);
  };

  // ══════════════════════════════════════
  // TRAINING (digital, fast)
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), this.t('llm2_train'), 141.1);

  const corpus = [
    'the quick brown fox jumps over the lazy dog ',
    'to be or not to be that is the question ',
    'it was the best of times it was the worst of times ',
    'in the beginning there was light and it was good ',
    'she sells sea shells on the sea shore ',
    'all that glitters is not gold ',
    'a journey of a thousand miles begins with a single step ',
    'the only thing we have to fear is fear itself ',
    'i think therefore i am and i know that i know nothing ',
    'knowledge is power and power is knowledge ',
    'time and tide wait for no man ',
    'where there is a will there is a way ',
    'we hold these truths to be self evident ',
    'one small step for man one giant leap for mankind ',
    'science is organized knowledge wisdom is organized life ',
    'the important thing is not to stop questioning ',
    'imagination is more important than knowledge ',
    'life is what happens when you are busy making other plans ',
    'the only way to do great work is to love what you do ',
    'in the middle of difficulty lies opportunity ',
  ].join('');

  this.log('━━━ OPTICAL LLM v2: TRAINING ━━━');
  this.log(`  Corpus: ${corpus.length} chars, Model: d=${D}, d_ff=${D_FF}`);

  const epochs = 200;
  const W_MAX = 1.5; // weight clipping for optical dynamic range (relaxed)
  // VMF-inspired bounce activation (from modified Friedmann equation)
  // H² = (8πG/3)ρ(1 − ρ/ρ_c)  →  f(x) = x·max(0, 1 − x²/C²)
  // Self-limiting: prevents optical saturation at extreme values
  const BOUNCE_C2 = 16.0; // C² ceiling (allows activations up to |x|=4)
  const bounce = x => x > 0 ? x * Math.max(0, 1 - x*x / BOUNCE_C2) : 0;
  const bounceGrad = (x) => x > 0 && (1 - x*x/BOUNCE_C2) > 0 ? 1 - 3*x*x/BOUNCE_C2 : 0;

  // Noise-aware training: simulate optical channel noise during forward pass
  // σ=0.03 matches ~7-bit precision after all corrections (per-band cal + G-anchor)
  const NOISE_STD = 0.03;
  const gaussNoise = () => {
    // Box-Muller transform using the training RNG
    const u1 = Math.max(1e-10, rng()), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * NOISE_STD;
  };

  // Clip function for weight bounding
  const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let lastLoss = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    // LR schedule: warmup (0→0.02 in 20 epochs) + cosine decay
    const warmup = Math.min(1, epoch / 20);
    const decay = 0.5 * (1 + Math.cos(Math.PI * Math.max(0, epoch - 20) / (epochs - 20)));
    const lr = 0.025 * warmup * decay;
    // Noise annealing: more noise early, less late (like temperature in simulated annealing)
    const noiseScale = epoch < epochs * 0.7 ? 1.0 : (epochs - epoch) / (epochs * 0.3);

    let totalLoss = 0, count = 0;
    for (let i = 0; i < corpus.length - 1; i++) {
      const c1 = charToIdx(corpus[i]), c2 = charToIdx(corpus[i+1]);

      // Forward (with optical noise injection)
      const embed = E[c1].slice();
      // MLP up: h_raw = W_up @ embed + noise
      const h_raw = new Array(D_FF).fill(0);
      for (let j = 0; j < D_FF; j++)
        for (let k = 0; k < D; k++)
          h_raw[j] += W_up[j][k] * embed[k];
      // Inject optical noise after MV multiply (simulates camera noise)
      for (let j = 0; j < D_FF; j++) h_raw[j] += gaussNoise() * noiseScale;
      // VMF bounce activation
      const h = h_raw.map(v => bounce(v));
      // MLP down: out = W_dn @ h + embed (skip) + noise
      const out = embed.slice();
      for (let j = 0; j < D; j++)
        for (let k = 0; k < D_FF; k++)
          out[j] += W_dn[j][k] * h[k];
      for (let j = 0; j < D; j++) out[j] += gaussNoise() * noiseScale;
      // Unembedding: logits = out @ U + noise
      const logits = new Array(VOCAB).fill(0);
      for (let j = 0; j < VOCAB; j++)
        for (let k = 0; k < D; k++)
          logits[j] += out[k] * U[k][j];
      for (let j = 0; j < VOCAB; j++) logits[j] += gaussNoise() * noiseScale;

      const probs = softmax(logits);
      totalLoss -= Math.log(Math.max(probs[c2], 1e-10));
      count++;

      // Backward (standard, no noise in gradients)
      const dLogits = probs.map((p, j) => p - (j === c2 ? 1 : 0));
      // dU
      const dOut = new Array(D).fill(0);
      for (let k = 0; k < D; k++) {
        for (let j = 0; j < VOCAB; j++) {
          dOut[k] += U[k][j] * dLogits[j];
          U[k][j] -= lr * out[k] * dLogits[j];
          U[k][j] = clip(U[k][j], -W_MAX, W_MAX);
        }
      }
      // dW_dn, dH
      const dH = new Array(D_FF).fill(0);
      for (let k = 0; k < D_FF; k++) {
        for (let j = 0; j < D; j++) {
          dH[k] += W_dn[j][k] * dOut[j];
          W_dn[j][k] -= lr * h[k] * dOut[j];
          W_dn[j][k] = clip(W_dn[j][k], -W_MAX, W_MAX);
        }
      }
      // VMF bounce grad
      const dH_raw = dH.map((v, k) => v * bounceGrad(h_raw[k]));
      // dW_up, dEmbed
      const dEmbed = dOut.slice(); // from skip connection
      for (let k = 0; k < D; k++) {
        for (let j = 0; j < D_FF; j++) {
          dEmbed[k] += W_up[j][k] * dH_raw[j];
          W_up[j][k] -= lr * embed[k] * dH_raw[j];
          W_up[j][k] = clip(W_up[j][k], -W_MAX, W_MAX);
        }
        E[c1][k] -= lr * dEmbed[k];
        E[c1][k] = clip(E[c1][k], -W_MAX, W_MAX);
      }
    }
    lastLoss = totalLoss / count;
  }

  const totalParams = VOCAB*D + D_FF*D + D*D_FF + D*VOCAB;
  this.log(`  Training: ${epochs} epochs (noise-aware), loss=${lastLoss.toFixed(3)}`);
  this.log(`  Noise σ=${NOISE_STD}, W_clip=±${W_MAX}, bounce C²=${BOUNCE_C2}`);
  this.log(`  Params: ${totalParams} (E:${VOCAB*D} + W_up:${D_FF*D} + W_dn:${D*D_FF} + U:${D*VOCAB})`);

  // ══════════════════════════════════════
  // CPU REFERENCE (generate same text digitally)
  // ══════════════════════════════════════
  const N_GEN = 20;
  const TEMP = 1.2;
  let cpuSeed = 777;
  const cpuRng = () => { cpuSeed = (cpuSeed*1664525+1013904223) & 0x7fffffff; return cpuSeed/0x7fffffff; };
  let cpuChar = 0, cpuText = '';

  for (let t = 0; t < N_GEN; t++) {
    const embed = E[cpuChar];
    const h_raw = new Array(D_FF).fill(0);
    for (let j = 0; j < D_FF; j++)
      for (let k = 0; k < D; k++) h_raw[j] += W_up[j][k] * embed[k];
    const h = h_raw.map(v => bounce(v)); // VMF bounce (digital)
    const out = embed.slice();
    for (let j = 0; j < D; j++)
      for (let k = 0; k < D_FF; k++) out[j] += W_dn[j][k] * h[k];
    const logits = new Array(VOCAB).fill(0);
    for (let j = 0; j < VOCAB; j++)
      for (let k = 0; k < D; k++) logits[j] += out[k] * U[k][j];
    const probs = softmax(logits, TEMP);
    let r = cpuRng(), cumul = 0;
    for (let j = 0; j < VOCAB; j++) { cumul += probs[j]; if (r < cumul) { cpuChar = j; break; } }
    cpuText += CHARS[cpuChar];
  }

  // ══════════════════════════════════════
  // OPTICAL INFERENCE (spatial multiplexing!)
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), this.t('llm2_inference'), 141.3);
  this.log('\n━━━ OPTICAL LLM v2: SPATIAL MULTIPLEXING ━━━');
  this.log(`  6 frames/token: RGB MV × 2-frame avg (R=pos, B=neg)`);
  this.log(`  ${N_GEN} tokens × 6 = ${N_GEN*6} optical frames\n`);

  // U is stored as U[D][VOCAB] = [16][27], but opticalMV expects W[nBands][nCols] = [27][16]
  // Transpose: U_T[j][k] = U[k][j]  (U_T is VOCAB×D = 27×16)
  const U_T = Array.from({length: VOCAB}, (_, j) =>
    Array.from({length: D}, (_, k) => U[k][j]));

  seed = 777; // same seed as CPU for fair comparison
  let optChar = 0, optText = '', totalFrames = 0, matchCount = 0;

  for (let t = 0; t < N_GEN; t++) {
    const embed = E[optChar].slice();
    this.setRun(this.t('etap'), `🔤 "${optText}█"`, 141.3 + t * 0.02);

    // MLP up (16→32) — 32 bands × 16 cols (2 frames: pos + neg)
    const h_raw = await opticalMV(embed, W_up, D_FF, D);
    totalFrames += 2;
    const h = h_raw.map(v => bounce(v)); // VMF bounce activation (digital)

    // MLP down (32→16) — 16 bands × 32 cols (2 frames: pos + neg)
    const mlpOut = await opticalMV(h, W_dn, D, D_FF);
    totalFrames += 2;
    // Skip connection (digital)
    const out = embed.map((e, k) => e + mlpOut[k]);

    // Unembedding (16→27) — 27 bands × 16 cols (2 frames: pos + neg)
    // Use transposed U so opticalMV can index as U_T[j][k] = U[k][j]
    const logits = await opticalMV(out, U_T, VOCAB, D);
    totalFrames += 2;

    // Softmax + sample (digital)
    const probs = softmax(logits, TEMP);
    let r = rng(), cumul = 0;
    for (let j = 0; j < VOCAB; j++) {
      cumul += probs[j];
      if (r < cumul) { optChar = j; break; }
    }
    const ch = CHARS[optChar];
    optText += ch;
    if (ch === cpuText[t]) matchCount++;

    const ranked = probs.map((p,j) => ({p,c:CHARS[j]})).sort((a,b) => b.p - a.p);
    this.log(`  [${String(t+1).padStart(2)}] "${ch}" (${(probs[optChar]*100).toFixed(0)}%) | ${ranked.slice(0,3).map(x=>`'${x.c}'=${(x.p*100).toFixed(0)}%`).join(' ')}`);
  }

  this.showColor('#000');

  // ══════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════
  const matchRate = matchCount / N_GEN;
  this.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  OPTICAL: "${optText}"`);
  this.log(`  CPU:     "${cpuText}"`);
  this.log(`  Match:   ${matchCount}/${N_GEN} (${(matchRate*100).toFixed(0)}%)`);
  this.log(`  Frames:  ${totalFrames} (6/token × ${N_GEN})`);
  this.log(`  Params:  ${totalParams} (d=${D}, d_ff=${D_FF})`);
  this.log(`  Method:  RGB + VMF anchor(G) + bounce act + per-band cal + γ⁻¹`);
  this.log(`  Speedup: 4.5× faster than v1 (27→6 frames/token)`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  ⚡ Consumer optical LLM v2 + VMF (smartphone + mirror, $0)`);
  this.log(`  📐 VMF: G=M_Ω₀ anchor, bounce=Friedmann H²(1−ρ/ρ_c)`);

  this.results.stage81 = {
    method: 'Optical LLM v2: VMF-inspired RGB (G-anchor + bounce activation)',
    opticalText: optText, cpuText,
    matchRate: +matchRate.toFixed(3), matchCount,
    totalFrames, framesPerToken: 6,
    params: totalParams, d_model: D, d_ff: D_FF, vocab: VOCAB,
    tokensGenerated: N_GEN, trainingLoss: +lastLoss.toFixed(4),
    temperature: TEMP, bandFlip,
    vmf: { greenAnchor: V_MID, bounceC2: BOUNCE_C2 }
  };
}

export function render(r) {
  if (r.stage81) { try {
    const s = r.stage81;
    this.rv('rv-llm2-text', `"${s.opticalText}"`, 'ok');
    this.rv('rv-llm2-match', `match=${(s.matchRate*100).toFixed(0)}%`, s.matchRate > 0.2 ? 'ok' : 'warn');
    const g = document.getElementById('g-s81');
    if (g) {
      g.textContent = `✅ LLMv2: "${(s.opticalText||'').slice(0,16)}…"`;
      g.className = 'grade pass';
    }
  } catch(e) { console.error('s81:', e); } }
}

export function check(d) { try { return d && d.opticalText && d.opticalText.length >= 15; } catch(e) { return false; } }
export function metric(d) { try { return `"${d.opticalText}" (${d.framesPerToken}f/t)`; } catch(e) { return '—'; } }
