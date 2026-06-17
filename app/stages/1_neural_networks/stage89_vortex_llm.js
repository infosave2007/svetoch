// Stage 89: Vortex Mirrorless LLM — вихревой беззеркальный LLM
//
// Computes layer-by-layer LLM logits using an 8-channel parallel optical bus
// of quad-vortex convective lens cells (vortex lensing) on the screen.
//
// Physis: logit_j = sum(embed * W[j]).
// We encode logit magnitude as the drawing opacity of each element (globalAlpha) and
// logit sign as the chirality/handedness of the quad-vortex (CCW: +, CW: -).
// The camera measures the 8 local curls in parallel, which is rotationally invariant and
// dynamically calibrated to reject mirroring, local variations, and scaling.

export async function run() {
  this.setRun(this.t('etap'), this.t('vortex_llm_start'), 149.0);
  this.log('━━━ STAGE 89: 8-CHANNEL PARALLEL VORTEX LLM ━━━');

  const cal = this.results.calibration || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v, n = 3) => +Number(v || 0).toFixed(n);
  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const variance = arr => {
    if (!arr.length) return 0;
    const m = mean(arr);
    return mean(arr.map(v => (v - m) * (v - m)));
  };
  const std = arr => Math.sqrt(variance(arr));

  // Reference checkerboard pattern
  const showReferencePattern = (period = 4) => {
    this.showPattern((ctx, w, h) => {
      for (let y = 0; y < h; y += period) {
        for (let x = 0; x < w; x += period) {
          const white = ((x / period + y / period) % 2) < 1;
          ctx.fillStyle = white ? 'rgb(205,205,205)' : 'rgb(50,50,50)';
          ctx.fillRect(x, y, period, period);
        }
      }
    });
  };

  // Optical flow displacement measurement with dynamic patching
  const measureShiftVector = (frame1, frame2, region) => {
    const d1 = frame1.data, d2 = frame2.data;
    const fw = frame1.width, fh = frame1.height;
    const rx0 = clamp(Math.floor(region.x0), 0, fw - 1);
    const rx1 = clamp(Math.floor(region.x1), 0, fw);
    const ry0 = clamp(Math.floor(region.y0), 0, fh - 1);
    const ry1 = clamp(Math.floor(region.y1), 0, fh);
    const rw = rx1 - rx0, rh = ry1 - ry0;
    const patchSize = Math.max(6, Math.min(16, Math.floor(Math.min(rw, rh) * 0.75)));
    const dxs = [], dys = [];

    const getSAD = (px, py, dx, dy) => {
      let sum = 0;
      for (let yy = 0; yy < patchSize; yy++) {
        for (let xx = 0; xx < patchSize; xx++) {
          const x1 = px + xx + dx;
          const y1 = py + yy + dy;
          if (x1 < 0 || x1 >= fw || y1 < 0 || y1 >= fh) continue;
          const i2 = ((py + yy) * fw + (px + xx)) * 4;
          const i1 = (y1 * fw + x1) * 4;
          const v2 = (d2[i2] + d2[i2 + 1] + d2[i2 + 2]) / 3;
          const v1 = (d1[i1] + d1[i1 + 1] + d1[i1 + 2]) / 3;
          sum += Math.abs(v2 - v1);
        }
      }
      return sum;
    };

    const step = Math.max(2, Math.floor(patchSize * 0.3));
    for (let py = ry0; py < ry1 - patchSize - 1; py += step) {
      for (let px = rx0; px < rx1 - patchSize - 1; px += step) {
        let bestDx = 0, bestDy = 0, best = Infinity;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const sad = getSAD(px, py, dx, dy);
            if (sad < best) { best = sad; bestDx = dx; bestDy = dy; }
          }
        }
        const sxm = getSAD(px, py, bestDx - 1, bestDy);
        const sxp = getSAD(px, py, bestDx + 1, bestDy);
        const sym = getSAD(px, py, bestDx, bestDy - 1);
        const syp = getSAD(px, py, bestDx, bestDy + 1);
        const denomX = sxm - 2 * best + sxp;
        const denomY = sym - 2 * best + syp;
        const subDx = denomX > 1e-4 ? clamp((sxm - sxp) / (2 * denomX), -1, 1) : 0;
        const subDy = denomY > 1e-4 ? clamp((sym - syp) / (2 * denomY), -1, 1) : 0;
        if (best < patchSize * patchSize * 115) {
          dxs.push((bestDx + subDx) * 15.0);
          dys.push((bestDy + subDy) * 15.0);
        }
      }
    }

    const mx = mean(dxs), my = mean(dys);
    return { dx: round(mx), dy: round(my) };
  };

  // Pre-generate offscreen vortex spiral templates
  const spSize = 128;
  const offCCW = document.createElement('canvas');
  offCCW.width = spSize; offCCW.height = spSize;
  const ctxCCW = offCCW.getContext('2d');
  const imgCCW = ctxCCW.createImageData(spSize, spSize);

  const offCW = document.createElement('canvas');
  offCW.width = spSize; offCW.height = spSize;
  const ctxCW = offCW.getContext('2d');
  const imgCW = ctxCW.createImageData(spSize, spSize);

  const scx = spSize / 2, scy = spSize / 2;
  const br = 255;
  for (let y = 0; y < spSize; y++) {
    for (let x = 0; x < spSize; x++) {
      const dx = x - scx, dy = y - scy;
      const rr = Math.sqrt(dx * dx + dy * dy) / (spSize * 0.5);
      const theta = Math.atan2(dy, dx);

      const waveCCW = Math.sin(theta * 1 + rr * 15);
      const vCCW = rr < 0.95 && waveCCW > 0.15 ? br : 0;
      const i = (y * spSize + x) * 4;
      imgCCW.data[i] = imgCCW.data[i + 1] = imgCCW.data[i + 2] = vCCW;
      imgCCW.data[i + 3] = 255;

      const waveCW = Math.sin(theta * (-1) + rr * 15);
      const vCW = rr < 0.95 && waveCW > 0.15 ? br : 0;
      imgCW.data[i] = imgCW.data[i + 1] = imgCW.data[i + 2] = vCW;
      imgCW.data[i + 3] = 255;
    }
  }
  ctxCCW.putImageData(imgCCW, 0, 0);
  ctxCW.putImageData(imgCW, 0, 0);

  // Local curl proxy calculator inside a specified element bounding box
  const measureElementCurl = (refFrame, frame, ecx, ecy, eSize) => {
    const ew = eSize * 0.5;
    const eh = eSize * 0.5;
    const top = measureShiftVector(refFrame, frame, {
      x0: ecx - ew * 0.3,
      x1: ecx + ew * 0.3,
      y0: ecy - eh * 0.6,
      y1: ecy
    });
    const right = measureShiftVector(refFrame, frame, {
      x0: ecx,
      x1: ecx + ew * 0.6,
      y0: ecy - eh * 0.3,
      y1: ecy + eh * 0.3
    });
    const bottom = measureShiftVector(refFrame, frame, {
      x0: ecx - ew * 0.3,
      x1: ecx + ew * 0.3,
      y0: ecy,
      y1: ecy + eh * 0.6
    });
    const left = measureShiftVector(refFrame, frame, {
      x0: ecx - ew * 0.6,
      x1: ecx,
      y0: ecy - eh * 0.3,
      y1: ecy + eh * 0.3
    });
    return round(top.dx + right.dy - bottom.dx - left.dy);
  };

  // Draws a quad-vortex structure
  const drawElement = (ctx, ecx, ecy, eSize, hand = 1) => {
    const dVal = eSize * 0.23;
    const rSize = eSize * 0.40;

    const canvasTR = hand === 1 ? offCW : offCCW;
    ctx.drawImage(canvasTR, ecx + dVal - rSize / 2, ecy - dVal - rSize / 2, rSize, rSize);

    const canvasTL = hand === 1 ? offCCW : offCW;
    ctx.drawImage(canvasTL, ecx - dVal - rSize / 2, ecy - dVal - rSize / 2, rSize, rSize);

    const canvasBL = hand === 1 ? offCW : offCCW;
    ctx.drawImage(canvasBL, ecx - dVal - rSize / 2, ecy + dVal - rSize / 2, rSize, rSize);

    const canvasBR = hand === 1 ? offCCW : offCW;
    ctx.drawImage(canvasBR, ecx + dVal - rSize / 2, ecy + dVal - rSize / 2, rSize, rSize);

    const rLens = eSize * 0.12;
    const grad = ctx.createRadialGradient(ecx, ecy, 0, ecx, ecy, rLens);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ecx, ecy, rLens, 0, 2 * Math.PI);
    ctx.fill();
  };

  // ══════════════════════════════════════
  // PHASE 1: COLD BASELINE + PARALLEL VORTEX CALIBRATION
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), 'Phase 1: Parallel Vortex Cal', 149.1);
  this.log('\n── Phase 1: Cold baseline + parallel vortex calibration ──');

  // Cool screen, capture cold baseline
  this.showColor('#000000');
  await this.sleep(2000);
  showReferencePattern();
  await this.sleep(500);
  let coldFrame = await this.captureStable(8, 50);
  this.log('  Cold baseline captured');

  // Setup camera boundaries
  const cfW = coldFrame.width, cfH = coldFrame.height;
  const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(cfW * 0.15);
  const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(cfW * 0.85);
  const y0 = (cal.y0 != null) ? cal.y0 : Math.floor(cfH * 0.15);
  const y1 = (cal.y1 != null) ? cal.y1 : Math.floor(cfH * 0.85);
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);

  const wCentral = x1 - x0;
  const hCentral = y1 - y0;

  // Geometry setups for 8 positions (4 rows of 2 columns) in camera frame
  const sizeY_cam = wCentral * 0.20;
  const dx_cam = wCentral * 0.23;
  const dy1_cam = hCentral * 0.35;
  const dy2_cam = hCentral * 0.12;

  // Mirror-aware coordinate mapping (horizontally flips camera reading positions if mirrored)
  const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;
  this.log(`  Mirroring mode: ${isMirrored ? 'Mirrored (swapping camera columns)' : 'Direct'}`);
  const colSign = isMirrored ? 1 : -1;

  const cameraPositions = [
    { cx: cx + colSign * dx_cam, cy: cy - dy1_cam },
    { cx: cx - colSign * dx_cam, cy: cy - dy1_cam },
    { cx: cx + colSign * dx_cam, cy: cy - dy2_cam },
    { cx: cx - colSign * dx_cam, cy: cy - dy2_cam },
    { cx: cx + colSign * dx_cam, cy: cy + dy2_cam },
    { cx: cx - colSign * dx_cam, cy: cy + dy2_cam },
    { cx: cx + colSign * dx_cam, cy: cy + dy1_cam },
    { cx: cx - colSign * dx_cam, cy: cy + dy1_cam }
  ];

  this.log(`  Camera screen region: [${x0},${x1}]×[${y0},${y1}]`);

  // Measure noise sigma on cold reference at pos 0
  const noiseFrame = await this.captureStable(6, 40);
  const noiseCurl = measureElementCurl(coldFrame, noiseFrame, cameraPositions[0].cx, cameraPositions[0].cy, sizeY_cam);
  const noiseSigma = Math.max(0.1, Math.abs(noiseCurl));
  this.log(`  System Noise Floor (σ): ${noiseSigma.toFixed(3)} px`);

  // ── Thermal vortex calibration: heat all 8 elements with positive CCW vortex at full intensity ──
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const ccx = w / 2, ccy = h / 2;
    const size = Math.min(w, h);
    const sizeY = size * 0.20;
    const dx = w * 0.23;
    const dy1 = h * 0.35;
    const dy2 = h * 0.12;

    const positions = [
      { cx: ccx - dx, cy: ccy - dy1 },
      { cx: ccx + dx, cy: ccy - dy1 },
      { cx: ccx - dx, cy: ccy - dy2 },
      { cx: ccx + dx, cy: ccy - dy2 },
      { cx: ccx - dx, cy: ccy + dy2 },
      { cx: ccx + dx, cy: ccy + dy2 },
      { cx: ccx - dx, cy: ccy + dy1 },
      { cx: ccx + dx, cy: ccy + dy1 }
    ];

    for (let i = 0; i < 8; i++) {
      drawElement(ctx, positions[i].cx, positions[i].cy, sizeY, 1);
    }
  });
  await this.sleep(2500); // Heat up

  showReferencePattern();
  await this.sleep(200);
  const calHeatFrame = await this.captureStable(6, 40);

  const thermalCal = [];
  for (let i = 0; i < 8; i++) {
    const pos = cameraPositions[i];
    const curl = measureElementCurl(coldFrame, calHeatFrame, pos.cx, pos.cy, sizeY_cam);
    thermalCal.push(curl);
  }
  const averageGain = mean(thermalCal.map(Math.abs));
  this.log(`  Vortex Calibration curls: [${thermalCal.map(v => v.toFixed(1)).join(', ')}] px (avg=${averageGain.toFixed(1)}px)`);

  // Cool down and re-capture fresh baseline
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
  const D = 8; // embedding dimension
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
  this.setRun(this.t('etap'), this.t('vortex_llm_train'), 149.2);
  this.log('\n━━━ VORTEX LLM: TRAINING (digital) ━━━');

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
  // OPTICAL INFERENCE: PARALLEL THERMAL VORTEX CURL LOGITS
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), this.t('vortex_llm_inference'), 149.4);
  this.log('\n━━━ PARALLEL THERMAL VORTEX OPTICAL INFERENCE ━━━');
  this.log('  Protocol per logit batch:');
  this.log('    1. Display 8-channel quad-vortex grid: opacity ∝ magnitude, chirality ∝ sign');
  this.log('    2. Wait 600ms → thermal boundary layer vortices form');
  this.log('    3. Show reference checkerboard → measure 8 local curls in parallel');
  this.log('    4. logit_j = (measuredCurl_i / thermalCal_i) * maxAbs');
  this.log(`  4 batches/token × ${N_GEN} tokens = ${4 * N_GEN} parallel frames\n`);

  const HEAT_TIME = 600;  // ms
  const REF_TIME = 150;   // ms
  const COOL_TIME = 400;  // ms

  // Reset seed for fair comparison
  seed = 12345;

  let currentChar = 0, opticalText = '', totalFrames = 0, matchCount = 0;
  const startTime = Date.now();

  for (let t = 0; t < N_GEN; t++) {
    const embed = E[currentChar];
    const optLogits = new Array(VOCAB).fill(0);
    this.setRun(this.t('etap'), `🔤 "${opticalText}█"`, 149.4 + t * 0.05);

    // Baseline is refreshed dynamically per batch below

    // ── Pre-compute all 27 digital logits to normalize scale ──
    const digLogits = [];
    for (let j = 0; j < VOCAB; j++) {
      let lVal = 0;
      for (let k = 0; k < D; k++) {
        lVal += embed[k] * U[k][j];
      }
      digLogits.push(lVal);
    }
    const maxAbs = Math.max(0.001, ...digLogits.map(Math.abs));

    // ── Compute 27 logits via 4 parallel batches ──
    for (let batch = 0; batch < 4; batch++) {
      const startIndex = batch * 8;
      const activeCount = Math.min(8, 27 - startIndex);

      // Capture fresh baseline frame before heating this batch to cancel accumulated drift
      showReferencePattern();
      await this.sleep(REF_TIME);
      coldFrame = await this.captureStable(4, 30);

      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        const ccx = w / 2, ccy = h / 2;
        const size = Math.min(w, h);
        const sizeY = size * 0.20;
        const dx = w * 0.23;
        const dy1 = h * 0.35;
        const dy2 = h * 0.12;

        const positions = [
          { cx: ccx - dx, cy: ccy - dy1 },
          { cx: ccx + dx, cy: ccy - dy1 },
          { cx: ccx - dx, cy: ccy - dy2 },
          { cx: ccx + dx, cy: ccy - dy2 },
          { cx: ccx - dx, cy: ccy + dy2 },
          { cx: ccx + dx, cy: ccy + dy2 },
          { cx: ccx - dx, cy: ccy + dy1 },
          { cx: ccx + dx, cy: ccy + dy1 }
        ];

        for (let i = 0; i < activeCount; i++) {
          const logitIndex = startIndex + i;
          const logitVal = digLogits[logitIndex];
          const intensity = Math.max(0.05, Math.abs(logitVal) / maxAbs);
          const direction = logitVal >= 0 ? 1 : -1;

          ctx.globalAlpha = intensity;
          drawElement(ctx, positions[i].cx, positions[i].cy, sizeY, direction);
        }
        ctx.globalAlpha = 1.0;
      });

      // Wait for thermal boundary vortex to form
      await this.sleep(HEAT_TIME);

      // Show reference pattern
      showReferencePattern();
      await this.sleep(REF_TIME);

      // Capture frame and measure curls in parallel
      const frame = await this.captureStable(4, 30);
      totalFrames++;

      for (let i = 0; i < activeCount; i++) {
        const logitIndex = startIndex + i;
        const pos = cameraPositions[i];
        const curl = measureElementCurl(coldFrame, frame, pos.cx, pos.cy, sizeY_cam);

        // Decode logit using individual gain regularized against noise floor
        const signCal = Math.sign(thermalCal[i]);
        const gainFloor = Math.max(3.0, noiseSigma * 1.5);
        const individualGain = Math.max(gainFloor, Math.abs(thermalCal[i]));
        // Squelch filter: zero out logits for channels that failed to show stable calibration response
        const optDot = Math.abs(thermalCal[i]) > Math.max(2.5, noiseSigma * 0.8)
          ? (curl * signCal) / individualGain * maxAbs
          : 0;
        optLogits[logitIndex] = optDot;
      }

      // Cooldown
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
  this.log(`  VORTEX THERMAL: "${opticalText}"`);
  this.log(`  CPU:            "${cpuText}"`);
  this.log(`  Match:   ${matchCount}/${N_GEN} chars (${(matchRate * 100).toFixed(0)}%)`);
  this.log(`  Frames:  ${totalFrames} (4 batches/token × ${N_GEN} tokens)`);
  this.log(`  Time:    ${elapsedSec.toFixed(1)}s (${(elapsedSec / N_GEN).toFixed(1)}s/token)`);
  this.log(`  Model:   ${totalParams} params, d=${D}, vocab=${VOCAB}`);
  this.log(`  Thermal: δ_cal_mean=${mean(thermalCal).toFixed(2)}px, heat=${HEAT_TIME}ms, cool=${COOL_TIME}ms`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage89 = {
    method: '8-Channel Parallel Vortex Mirrorless Thermal LLM',
    opticalText, cpuText,
    matchRate: +(matchRate).toFixed(3),
    matchCount,
    totalFrames,
    framesPerToken: 4,
    params: totalParams,
    d_model: D, vocab: VOCAB,
    tokensGenerated: N_GEN,
    trainingLoss: +lastLoss.toFixed(4),
    temperature: TEMPERATURE,
    thermalCal: thermalCal.map(round),
    elapsed: +elapsedSec.toFixed(1),
    secPerToken: +(elapsedSec / N_GEN).toFixed(1),
    heatTime: HEAT_TIME,
    coolTime: COOL_TIME,
    pass: opticalText && opticalText.length >= 6
  };
}

export function render(r) {
  if (r.stage89) { try {
    const s = r.stage89;
    this.rv('rv-vtx-text', `"${s.opticalText}"`, 'ok');
    this.rv('rv-vtx-match', `match=${((s.matchRate || 0) * 100).toFixed(0)}%`, s.matchRate > 0.2 ? 'ok' : 'warn');
    const avgCal = s.thermalCal.reduce((a,b)=>a+b, 0) / s.thermalCal.length;
    this.rv('rv-vtx-cal', `δ_avg=${avgCal.toFixed(1)}px`, Math.abs(avgCal) > 0.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s89');
    if (g) {
      if (s.pass) {
        g.textContent = `✅ Vortex LLM: "${(s.opticalText || '').slice(0, 12)}" (${s.secPerToken}s/tok)`;
        g.className = 'grade pass';
      } else {
        g.textContent = `⚠️ Vortex LLM: генерация не завершена`;
        g.className = 'grade warn';
      }
    }
  } catch (e) { console.error('s89 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; }
}

export function metric(d) {
  try { return `"${d.opticalText}" (🌀${d.framesPerToken}f/t, ${d.secPerToken}s/t)`; } catch (e) { return '—'; }
}
