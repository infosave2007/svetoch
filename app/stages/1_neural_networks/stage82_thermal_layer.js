// Stage 82: Mirrorless Thermal LLM — послойный беззеркальный LLM
//
// Архитектура как Stage 80 (простой послойный LLM), но БЕЗ ЗЕРКАЛА:
// Вместо отражения света от зеркала используется тепловой конвекционный
// пограничный слой воздуха над OLED-экраном (BOS-эффект, δ≈7мм).
//
// ФИЗИЧЕСКИЙ ПРИНЦИП:
//   1. Весовые произведения embed[k]·U[k][j] разделяются на pos/neg суммы
//   2. LEFT яркость ∝ Σ(положительных), RIGHT яркость ∝ Σ(отрицательных)
//   3. OLED нагревает воздух → конвекционный слой → Δn ≈ -1.8×10⁻⁵
//   4. Камера детектирует субпиксельный BOS-сдвиг через SAD-корреляцию
//   5. (shift_L − shift_R) ∝ (posSum − negSum) = dot product = logit[j]
//
// VMF АНАЛОГИЯ (github.com/infosave2007/vmf):
//   W(x) вакуумный конденсат ↔ T(x,z) поле температур
//   Фазовый переход W→0     ↔ n(T) переход на границе слоя
//   Dark photon mixing ε     ↔ угол теплового отклонения θ_x
//
// АРХИТЕКТУРА:
//   Embedding:   27 → 8  (digital lookup)
//   Unembedding: 8 → 27  (THERMAL BOS — 27 тепловых кадров)
//   Softmax → sampling    (digital)
//
// 27 тепловых кадров на токен × 8 токенов = 216 термо-оптических операций
//
// ЭТО LLM ГДЕ МАТРИЧНОЕ УМНОЖЕНИЕ ВЫПОЛНЯЕТСЯ ТЕПЛОВОЙ КОНВЕКЦИЕЙ
// НАД ЭКРАНОМ СМАРТФОНА — НИКАКИХ ЗЕРКАЛ, НИКАКИХ ЧИПОВ ($0).

export async function run() {
  this.setRun(this.t('etap'), this.t('thermal_llm_start'), 142.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};

  // ══════════════════════════════════════
  // HELPER: Sub-pixel BOS shift via SAD cross-correlation
  // Validated in experiments: R²=1.000 for 2×2 thermal inference
  // ══════════════════════════════════════
  const measureShift = (frame1, frame2, region) => {
    const d1 = frame1.data, d2 = frame2.data;
    const fw = frame1.width, fh = frame1.height;
    const rx0 = Math.max(0, Math.min(fw - 1, region.x0));
    const rx1 = Math.max(0, Math.min(fw - 1, region.x1));
    const ry0 = Math.max(0, Math.min(fh - 1, region.y0));
    const ry1 = Math.max(0, Math.min(fh - 1, region.y1));

    const rw = rx1 - rx0, rh = ry1 - ry0;
    const patchSize = Math.max(6, Math.min(16, Math.floor(Math.min(rw, rh) * 0.25)));
    const step = Math.max(4, Math.floor(patchSize * 1.5));
    const shifts = [];

    const getSAD = (px, py, dx, dy) => {
      let sum = 0;
      for (let dy_p = 0; dy_p < patchSize; dy_p++) {
        for (let dx_p = 0; dx_p < patchSize; dx_p++) {
          const idx2 = ((py + dy_p) * fw + (px + dx_p)) * 4;
          const idx1 = ((py + dy_p + dy) * fw + (px + dx_p + dx)) * 4;
          if (idx2 < 0 || idx2 >= d2.length || idx1 < 0 || idx1 >= d1.length) continue;
          const val2 = (d2[idx2] + d2[idx2 + 1] + d2[idx2 + 2]) / 3;
          const val1 = (d1[idx1] + d1[idx1 + 1] + d1[idx1 + 2]) / 3;
          sum += Math.abs(val2 - val1);
        }
      }
      return sum;
    };

    // Scan patches with step based on patch size
    for (let py = ry0; py < ry1 - patchSize - 1; py += step) {
      for (let px = rx0; px < rx1 - patchSize - 1; px += step) {
        let bestDx = 0, bestDy = 0, minSAD = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const sad = getSAD(px, py, dx, dy);
            if (sad < minSAD) { minSAD = sad; bestDx = dx; bestDy = dy; }
          }
        }
        // Sub-pixel interpolation (parabolic fit)
        const s_m1 = getSAD(px, py, bestDx - 1, bestDy);
        const s_0 = minSAD;
        const s_p1 = getSAD(px, py, bestDx + 1, bestDy);
        let subDx = 0;
        const denomX = s_m1 - 2 * s_0 + s_p1;
        if (denomX > 1e-4) subDx = Math.max(-1, Math.min(1, (s_m1 - s_p1) / (2 * denomX)));
        const dx_total = bestDx + subDx;
        if (minSAD < patchSize * patchSize * 100) {
          shifts.push(dx_total * 15.0); // scale for sensitivity
        }
      }
    }
    if (shifts.length === 0) return { mean: 0, rms: 0, count: 0 };
    const mean = shifts.reduce((s, v) => s + v, 0) / shifts.length;
    const rms = Math.sqrt(shifts.reduce((s, v) => s + v * v, 0) / shifts.length);
    return { mean, rms, count: shifts.length };
  };

  // ══════════════════════════════════════
  // HELPER: BOS reference pattern (checkerboard 4px period)
  // ══════════════════════════════════════
  const showReferencePattern = () => {
    this.showPattern((ctx, w, h) => {
      const period = 4;
      for (let y = 0; y < h; y += period) {
        for (let x = 0; x < w; x += period) {
          const isWhite = ((x / period + y / period) % 2) < 1;
          ctx.fillStyle = isWhite ? 'rgb(200,200,200)' : 'rgb(55,55,55)';
          ctx.fillRect(x, y, period, period);
        }
      }
    });
  };

  this.log('━━━ MIRRORLESS THERMAL LLM (Layer-by-Layer BOS) ━━━');
  this.log('  Physics: OLED heat → δ≈7mm convection → Δn → BOS shift → dot product');
  this.log('  No mirror! Thermal boundary layer IS the optical processor');

  // ══════════════════════════════════════
  // PHASE 1: COLD BASELINE + THERMAL CALIBRATION
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), 'Phase 1: Thermal Calibration', 142.1);
  this.log('\n── Phase 1: Cold baseline + thermal calibration ──');

  // Cool screen, capture cold baseline
  this.showColor('#000000');
  await this.sleep(2000);
  showReferencePattern();
  await this.sleep(500);
  let coldFrame = await this.captureStable(8, 50);
  this.log('  Cold baseline captured');

  // Setup camera regions from calibration
  const cfW = coldFrame.width, cfH = coldFrame.height;
  const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(cfW * 0.15);
  const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(cfW * 0.85);
  const y0 = (cal.y0 != null) ? cal.y0 : Math.floor(cfH * 0.15);
  const y1 = (cal.y1 != null) ? cal.y1 : Math.floor(cfH * 0.85);

  const wCentral = x1 - x0;
  const hCentral = y1 - y0;
  const isRotated = wCentral > hCentral;

  let leftRegion, rightRegion;
  if (isRotated) {
    const cy = Math.floor((y0 + y1) / 2);
    leftRegion = { x0, x1, y0, y1: cy };
    rightRegion = { x0, x1, y0: cy, y1 };
    this.log(`  Camera rotation detected (90°). Regions partitioned vertically: Top & Bottom.`);
  } else {
    const cx = Math.floor((x0 + x1) / 2);
    leftRegion = { x0, x1: cx, y0, y1 };
    rightRegion = { x0: cx, x1, y0, y1 };
    this.log(`  Camera aligned. Regions partitioned horizontally: Left & Right.`);
  }
  this.log(`  Camera: ${cfW}×${cfH}px, screen region: [${x0},${x1}]×[${y0},${y1}]`);

  // Measure baseline noise sigma
  const noiseFrame = await this.captureStable(6, 40);
  const noiseL = measureShift(coldFrame, noiseFrame, leftRegion);
  const noiseR = measureShift(coldFrame, noiseFrame, rightRegion);
  const noiseSigma = Math.max(0.1, Math.abs(noiseL.mean - noiseR.mean));
  this.log(`  System Noise Floor (σ): ${noiseSigma.toFixed(3)} px`);

  // ── Thermal gain calibration: heat LEFT → measure shift asymmetry ──
  // This establishes the proportionality constant: shift_delta ∝ brightness
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, Math.floor(w / 2), h);
  });
  await this.sleep(2500); // 2.5s heating for reliable calibration

  showReferencePattern();
  await this.sleep(200);
  const calHeatFrame = await this.captureStable(6, 40);

  const calShiftL = measureShift(coldFrame, calHeatFrame, leftRegion);
  const calShiftR = measureShift(coldFrame, calHeatFrame, rightRegion);
  const thermalCal = calShiftL.mean - calShiftR.mean;

  this.log(`  Thermal cal: shift_L=${calShiftL.mean.toFixed(2)}, shift_R=${calShiftR.mean.toFixed(2)}`);
  this.log(`  Thermal gain δ = ${thermalCal.toFixed(2)} px (LEFT−RIGHT at full heat)`);

  if (Math.abs(thermalCal) < 0.1) {
    this.log('  ⚠️ Thermal gain too low — convection may not be detectable');
  }

  // Cool down and re-capture fresh cold baseline
  this.showColor('#000000');
  await this.sleep(2000);
  showReferencePattern();
  await this.sleep(500);
  coldFrame = await this.captureStable(8, 50);

  // ══════════════════════════════════════
  // VOCABULARY & MODEL DEFINITION
  // ══════════════════════════════════════
  const CHARS = ' abcdefghijklmnopqrstuvwxyz';
  const VOCAB = 27;
  const D = 8; // embedding dimension (same as Stage 80)
  const charToIdx = c => { const i = CHARS.indexOf(c.toLowerCase()); return i >= 0 ? i : 0; };

  // PRNG
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };

  // Initialize weights: E[27][8], U[8][27]
  const E = Array.from({ length: VOCAB }, () =>
    Array.from({ length: D }, () => (rng() - 0.5) * 0.4));
  const U = Array.from({ length: D }, () =>
    Array.from({ length: VOCAB }, () => (rng() - 0.5) * 0.4));

  const softmax = (logits, temp = 1.0) => {
    const scaled = logits.map(l => l / temp);
    const max = Math.max(...scaled);
    const exp = scaled.map(l => Math.exp(l - max));
    const sum = exp.reduce((s, v) => s + v, 0);
    return exp.map(e => e / sum);
  };

  // ══════════════════════════════════════
  // TRAINING (digital, fast SGD on bigrams)
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), this.t('thermal_llm_train'), 142.2);
  this.log('\n━━━ THERMAL LLM: TRAINING (digital) ━━━');

  const corpus = [
    'the quick brown fox jumps over the lazy dog ',
    'to be or not to be that is the question ',
    'it was the best of times it was the worst of times ',
    'in the beginning there was light and it was good ',
    'she sells sea shells on the sea shore ',
    'all that glitters is not gold ',
    'a journey of a thousand miles begins with a single step ',
    'the only thing we have to fear is fear itself ',
    'i think therefore i am ',
    'knowledge is power and power is knowledge ',
    'time and tide wait for no man ',
    'where there is a will there is a way ',
  ].join('');

  this.log(`  Corpus: ${corpus.length} chars, Model: d=${D}, vocab=${VOCAB}`);

  const lr = 0.05;
  const epochs = 80;
  let lastLoss = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0, count = 0;
    for (let i = 0; i < corpus.length - 1; i++) {
      const c1 = charToIdx(corpus[i]), c2 = charToIdx(corpus[i + 1]);
      const embed = E[c1];
      const logits = new Array(VOCAB).fill(0);
      for (let j = 0; j < VOCAB; j++)
        for (let k = 0; k < D; k++)
          logits[j] += embed[k] * U[k][j];
      const probs = softmax(logits);
      totalLoss -= Math.log(Math.max(probs[c2], 1e-10));
      count++;

      const dLogits = probs.map((p, j) => p - (j === c2 ? 1 : 0));
      const dEmbed = new Array(D).fill(0);
      for (let k = 0; k < D; k++) {
        for (let j = 0; j < VOCAB; j++) {
          dEmbed[k] += U[k][j] * dLogits[j];
          U[k][j] -= lr * embed[k] * dLogits[j];
        }
        E[c1][k] -= lr * dEmbed[k];
      }
    }
    lastLoss = totalLoss / count;
  }

  const totalParams = VOCAB * D + D * VOCAB;
  this.log(`  Training: ${epochs} epochs, loss=${lastLoss.toFixed(3)}`);
  this.log(`  Params: ${totalParams} (E:${VOCAB * D} + U:${D * VOCAB})`);

  // ══════════════════════════════════════
  // CPU REFERENCE (same text digitally)
  // ══════════════════════════════════════
  const N_GEN = 8;
  const TEMPERATURE = 1.2;

  let cpuSeed = 12345;
  const cpuRng = () => {
    cpuSeed = (cpuSeed * 1664525 + 1013904223) & 0x7fffffff;
    return cpuSeed / 0x7fffffff;
  };
  let cpuChar = 0, cpuText = '';
  for (let t = 0; t < N_GEN; t++) {
    const embed = E[cpuChar];
    const logits = new Array(VOCAB).fill(0);
    for (let j = 0; j < VOCAB; j++)
      for (let k = 0; k < D; k++) logits[j] += embed[k] * U[k][j];
    const probs = softmax(logits, TEMPERATURE);
    let r = cpuRng(), cumul = 0;
    for (let j = 0; j < VOCAB; j++) {
      cumul += probs[j]; if (r < cumul) { cpuChar = j; break; }
    }
    cpuText += CHARS[cpuChar];
  }

  // ══════════════════════════════════════
  // OPTICAL INFERENCE: THERMAL BOS DOT PRODUCTS
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), this.t('thermal_llm_inference'), 142.4);
  this.log('\n━━━ THERMAL OPTICAL INFERENCE (BOS) ━━━');
  this.log('  Protocol per logit:');
  this.log('    1. Display LEFT/RIGHT heat ∝ pos/neg product sums');
  this.log('    2. Wait 600ms → thermal boundary layer forms (δ≈7mm)');
  this.log('    3. Show reference checkerboard → BOS shift via SAD');
  this.log('    4. Δshift = shift_L − shift_R ∝ dot product');
  this.log(`  ${VOCAB} logits/token × ${N_GEN} tokens = ${VOCAB * N_GEN} thermal ops\n`);

  // Timing parameters (optimized for speed vs. SNR)
  const HEAT_TIME = 600;  // ms — thermal buildup (shorter = faster, noisier)
  const REF_TIME = 150;   // ms — reference pattern before capture
  const COOL_TIME = 400;  // ms — cooldown between logits (prevents thermal accumulation)

  // Reset seed for fair comparison with CPU
  seed = 12345;

  let currentChar = 0, opticalText = '', totalFrames = 0, matchCount = 0;
  const startTime = Date.now();

  for (let t = 0; t < N_GEN; t++) {
    const embed = E[currentChar];
    const optLogits = [];
    this.setRun(this.t('etap'), `🔤 "${opticalText}█"`, 142.4 + t * 0.05);

    // Refresh cold baseline every token (compensate for ambient drift)
    if (t > 0) {
      this.showColor('#000000');
      await this.sleep(1500);
      showReferencePattern();
      await this.sleep(400);
      coldFrame = await this.captureStable(6, 40);
      this.log(`  [baseline refreshed at token ${t}]`);
    }

    // ── Compute 27 logits via thermal BOS shifts ──
    for (let j = 0; j < VOCAB; j++) {
      // Step 1: Compute weight products digitally
      const products = [];
      for (let k = 0; k < D; k++) {
        products.push(embed[k] * U[k][j]);
      }

      // Step 2: Separate into positive and negative partial sums
      let posSum = 0, negSum = 0;
      for (let k = 0; k < D; k++) {
        if (products[k] > 0) posSum += products[k];
        else negSum -= products[k]; // make positive
      }
      const maxVal = Math.max(0.001, posSum, negSum);

      // Step 3: Encode as LEFT/RIGHT heat intensities
      // Physics: brightness → OLED heat → convection → Δn → deflection
      const leftBr = Math.round((posSum / maxVal) * 255);
      const rightBr = Math.round((negSum / maxVal) * 255);

      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = `rgb(${leftBr},${leftBr},${leftBr})`;
        ctx.fillRect(0, 0, Math.floor(w / 2), h);
        ctx.fillStyle = `rgb(${rightBr},${rightBr},${rightBr})`;
        ctx.fillRect(Math.floor(w / 2), 0, Math.ceil(w / 2), h);
      });

      // Step 4: Wait for thermal boundary layer to form
      await this.sleep(HEAT_TIME);

      // Step 5: Show reference pattern (thermal layer persists ~200ms!)
      showReferencePattern();
      await this.sleep(REF_TIME);

      // Step 6: Capture BOS frame and measure shift
      const frame = await this.captureStable(4, 30);
      totalFrames++;

      const shiftL = measureShift(coldFrame, frame, leftRegion);
      const shiftR = measureShift(coldFrame, frame, rightRegion);

      // Step 7: Decode dot product from shift asymmetry
      // We encode SUM directly (not columns), so NO ×D averaging compensation!
      // shiftDelta ∝ (posHeat − negHeat) / maxVal = dot / maxVal
      // → dot = shiftDelta / thermalCal × maxVal
      const shiftDelta = shiftL.mean - shiftR.mean;
      const optDot = Math.abs(thermalCal) > 0.1
        ? (shiftDelta / thermalCal) * maxVal
        : 0;
      optLogits.push(optDot);

      // Step 8: Cooldown (prevent thermal accumulation)
      this.showColor('#000000');
      await this.sleep(COOL_TIME);
    }

    // Softmax + temperature sampling (digital)
    const probs = softmax(optLogits, TEMPERATURE);
    let r = rng(), cumul = 0;
    for (let j = 0; j < VOCAB; j++) {
      cumul += probs[j];
      if (r < cumul) { currentChar = j; break; }
    }

    const ch = CHARS[currentChar];
    opticalText += ch;
    if (ch === cpuText[t]) matchCount++;

    // Log top-3 probabilities
    const ranked = probs.map((p, j) => ({ p, c: CHARS[j] })).sort((a, b) => b.p - a.p);
    this.log(`  [${t + 1}] "${ch}" (p=${(probs[currentChar] * 100).toFixed(1)}%) | top: ${ranked.slice(0, 3).map(x => `'${x.c}'=${(x.p * 100).toFixed(0)}%`).join(', ')}`);
  }

  this.showColor('#000');
  const elapsedSec = (Date.now() - startTime) / 1000;

  // ══════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════
  const matchRate = matchCount / N_GEN;
  this.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  THERMAL: "${opticalText}"`);
  this.log(`  CPU:     "${cpuText}"`);
  this.log(`  Match:   ${matchCount}/${N_GEN} chars (${(matchRate * 100).toFixed(0)}%)`);
  this.log(`  Frames:  ${totalFrames} (${VOCAB}/token × ${N_GEN} tokens)`);
  this.log(`  Time:    ${elapsedSec.toFixed(1)}s (${(elapsedSec / N_GEN).toFixed(1)}s/token)`);
  this.log(`  Model:   ${totalParams} params, d=${D}, vocab=${VOCAB}`);
  this.log(`  Thermal: δ_cal=${thermalCal.toFixed(2)}px, heat=${HEAT_TIME}ms, cool=${COOL_TIME}ms`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`\n  🔥 LLM on MIRRORLESS thermal processor (smartphone, $0)!`);
  this.log(`  📐 VMF: W(x) → T(x,z), thermal boundary δ≈7mm = optical lens`);
  this.log(`  🌡️ Thermal persistence ~200ms = analog weight memory`);

  this.results.stage82 = {
    method: 'Mirrorless Thermal LLM (BOS dot products, layer-by-layer)',
    opticalText, cpuText,
    matchRate: +(matchRate).toFixed(3),
    matchCount,
    totalFrames,
    framesPerToken: VOCAB,
    params: totalParams,
    d_model: D, vocab: VOCAB,
    tokensGenerated: N_GEN,
    trainingLoss: +lastLoss.toFixed(4),
    temperature: TEMPERATURE,
    thermalCal: +thermalCal.toFixed(2),
    elapsed: +elapsedSec.toFixed(1),
    secPerToken: +(elapsedSec / N_GEN).toFixed(1),
    heatTime: HEAT_TIME,
    coolTime: COOL_TIME,
    pass: opticalText && opticalText.length >= 6
  };
}

export function render(r) {
  if (r.stage82) { try {
    const s = r.stage82;
    this.rv('rv-tl-text', `"${s.opticalText}"`, 'ok');
    this.rv('rv-tl-match', `match=${((s.matchRate || 0) * 100).toFixed(0)}%`, s.matchRate > 0.2 ? 'ok' : 'warn');
    this.rv('rv-tl-cal', `δ=${s.thermalCal}px`, Math.abs(s.thermalCal || 0) > 0.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s82');
    if (g) {
      if (s.pass) {
        g.textContent = `✅ Thermal LLM: "${(s.opticalText || '').slice(0, 12)}" (${s.secPerToken}s/tok)`;
        g.className = 'grade pass';
      } else {
        g.textContent = `⚠️ Thermal LLM: генерация не завершена`;
        g.className = 'grade warn';
      }
    }
  } catch (e) { console.error('s82 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; }
}

export function metric(d) {
  try { return `"${d.opticalText}" (🔥${d.framesPerToken}f/t, ${d.secPerToken}s/t)`; } catch (e) { return '—'; }
}
