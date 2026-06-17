// Stage 84: Air Elements Bench
// Instrumental BOS test suite for calibrated thermal air elements above OLED.

export async function run() {
  this.setRun(this.t('etap'), this.t('air_bench_start'), 144.0);
  this.log('━━━ STAGE 84: AIR ELEMENTS INSTRUMENTATION BENCH ━━━');
  this.log('  Goal: measure real BOS response of programmable air elements before using them as neural layers.');

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
  const corr = (a, b) => {
    if (a.length !== b.length || a.length < 2) return 0;
    const ma = mean(a), mb = mean(b);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) {
      const xa = a[i] - ma;
      const xb = b[i] - mb;
      num += xa * xb;
      da += xa * xa;
      db += xb * xb;
    }
    return num / Math.sqrt(Math.max(1e-12, da * db));
  };
  const r2ForXY = points => {
    if (!points || points.length < 3) return 0;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const mx = mean(xs), my = mean(ys);
    let cov = 0, vx = 0, vy = 0;
    for (let i = 0; i < points.length; i++) {
      cov += (xs[i] - mx) * (ys[i] - my);
      vx += (xs[i] - mx) * (xs[i] - mx);
      vy += (ys[i] - my) * (ys[i] - my);
    }
    return (cov * cov) / Math.max(1e-12, vx * vy);
  };
  const cosine = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / Math.sqrt(Math.max(1e-12, na * nb));
  };
  const logSection = title => this.log(`\n── ${title} ──`);
  const logSamples = (title, samples, formatter) => {
    this.log(`  ${title}:`);
    for (const sample of samples) this.log(`    ${formatter(sample)}`);
  };

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

  const measureShiftVector = (frame1, frame2, region) => {
    const d1 = frame1.data, d2 = frame2.data;
    const fw = frame1.width, fh = frame1.height;
    const rx0 = clamp(Math.floor(region.x0), 0, fw - 1);
    const rx1 = clamp(Math.floor(region.x1), 0, fw);
    const ry0 = clamp(Math.floor(region.y0), 0, fh - 1);
    const ry1 = clamp(Math.floor(region.y1), 0, fh);
    const patchSize = 16;
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

    for (let py = ry0; py < ry1 - patchSize - 1; py += patchSize * 2) {
      for (let px = rx0; px < rx1 - patchSize - 1; px += patchSize * 2) {
        let bestDx = 0, bestDy = 0, best = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
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
    const mags = dxs.map((x, i) => Math.sqrt(x * x + dys[i] * dys[i]));
    return {
      dx: round(mx),
      dy: round(my),
      mean: round(mx),
      mag: round(mean(mags)),
      rms: round(Math.sqrt(mean(mags.map(v => v * v)))),
      std: round(std(mags)),
      count: dxs.length,
      mags
    };
  };

  const drawByName = (name, options = {}) => (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const br = options.brightness == null ? 255 : options.brightness;
    const gray = v => `rgb(${clamp(Math.round(v), 0, 255)},${clamp(Math.round(v), 0, 255)},${clamp(Math.round(v), 0, 255)})`;

    if (name === 'leftRight') {
      const bg = options.background || 0;
      ctx.fillStyle = gray(bg);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gray(options.left != null ? options.left : bg);
      ctx.fillRect(0, 0, w / 2, h);
      ctx.fillStyle = gray(options.right != null ? options.right : bg);
      ctx.fillRect(w / 2, 0, w / 2, h);
    } else if (name === 'madelungDoubleSlit') {
      const slit = options.slit || 'AB';
      const sw = Math.max(2, Math.round(w * 0.08));
      const sep = Math.round(w * (options.sepFrac || 0.25));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gray(br);
      if (slit === 'A' || slit === 'AB') {
        ctx.fillRect(Math.round(cx - sep / 2 - sw / 2), 0, sw, h);
      }
      if (slit === 'B' || slit === 'AB') {
        ctx.fillRect(Math.round(cx + sep / 2 - sw / 2), 0, sw, h);
      }
    } else if (name === 'bandLeft') {
      const n = options.bands || 4;
      const band = options.band || 0;
      const bh = h / n;
      const guard = options.guardBandPx || 0;
      ctx.fillStyle = gray(br);
      ctx.fillRect(0, band * bh + guard / 2, w / 2, Math.max(2, bh - guard));
    } else if (name === 'centerLens') {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.48);
      grad.addColorStop(0, gray(br));
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (name === 'ringLens') {
      const r = Math.min(w, h) * (options.radius || 0.28);
      ctx.strokeStyle = gray(br);
      ctx.lineWidth = Math.max(18, Math.min(w, h) * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (name === 'edgeLens') {
      const grad = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.12, cx, cy, Math.min(w, h) * 0.62);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(1, gray(br));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (name === 'gradient') {
      const dir = options.dir || 'lr';
      const a = options.a == null ? 0 : options.a;
      const b = options.b == null ? 255 : options.b;
      const g = dir === 'tb' ? ctx.createLinearGradient(0, 0, 0, h) : ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, gray(a));
      g.addColorStop(1, gray(b));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (name === 'grating') {
      const period = options.period || 32;
      for (let x = 0; x < w; x += period) {
        ctx.fillStyle = ((Math.floor(x / period) % 2) === 0) ? gray(br) : '#000000';
        ctx.fillRect(x, 0, period, h);
      }
    } else if (name === 'axicon') {
      const slope = options.slope || 1.0;
      const maxR = Math.min(w, h) * 0.5;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(1, gray(br * slope));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (name === 'spiral') {
      const handedness = options.handedness || 1;
      // Use a fixed size offscreen canvas to optimize performance and bypass WebView z-index compositing bugs
      const size = 512;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = size;
      offCanvas.height = size;
      const offCtx = offCanvas.getContext('2d');
      const img = offCtx.createImageData(size, size);
      const scx = size / 2, scy = size / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - scx, dy = y - scy;
          const rr = Math.sqrt(dx * dx + dy * dy) / (size * 0.5);
          const theta = Math.atan2(dy, dx);
          const wave = Math.sin(theta * handedness + rr * 15);
          const v = rr < 0.95 && wave > 0.15 ? br : 0;
          const i = (y * size + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      }
      offCtx.putImageData(img, 0, 0);
      const renderSize = Math.min(w, h);
      ctx.drawImage(offCanvas, cx - renderSize / 2, cy - renderSize / 2, renderSize, renderSize);
    } else if (name === 'full') {
      ctx.fillStyle = gray(br);
      ctx.fillRect(0, 0, w, h);
    } else if (name === 'verticalMulti') {
      const r = Math.min(w, h) * 0.28;
      ctx.strokeStyle = 'rgb(128,128,128)';
      ctx.lineWidth = Math.max(18, Math.min(w, h) * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();

      const period = 24;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let x = 0; x < w; x += period * 2) {
        ctx.fillRect(x, 0, period, h);
      }
    } else if (name === 'grid') {
      const cols = options.cols || 2;
      const rows = options.rows || 2;
      const activeIndices = options.activeIndices || [0];
      const cw = w / cols;
      const ch = h / rows;
      for (const idx of activeIndices) {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        ctx.fillStyle = gray(br);
        ctx.fillRect(c * cw, r * ch, cw, ch);
      }
    } else if (name === 'talbotMulti') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let x = 0; x < w; x += 24) {
        ctx.fillRect(x, 0, 12, h);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let x = 0; x < w; x += 96) {
        ctx.fillRect(x, 0, 48, h);
      }
    } else if (name === 'quadVortex' || name === 'quadVortexLensing') {
      const targetHand = options.targetHandedness || 1;
      const size = Math.min(w, h);
      
      const spSize = 256;
      const offCCW = document.createElement('canvas');
      offCCW.width = spSize;
      offCCW.height = spSize;
      const ctxCCW = offCCW.getContext('2d');
      const imgCCW = ctxCCW.createImageData(spSize, spSize);
      
      const offCW = document.createElement('canvas');
      offCW.width = spSize;
      offCW.height = spSize;
      const ctxCW = offCW.getContext('2d');
      const imgCW = ctxCW.createImageData(spSize, spSize);
      
      const scx = spSize / 2, scy = spSize / 2;
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
      
      const dVal = size * 0.23;
      const rSize = size * 0.40;
      
      const canvasTR = targetHand === 1 ? offCW : offCCW;
      ctx.drawImage(canvasTR, cx + dVal - rSize / 2, cy - dVal - rSize / 2, rSize, rSize);
      
      const canvasTL = targetHand === 1 ? offCCW : offCW;
      ctx.drawImage(canvasTL, cx - dVal - rSize / 2, cy - dVal - rSize / 2, rSize, rSize);
      
      const canvasBL = targetHand === 1 ? offCW : offCCW;
      ctx.drawImage(canvasBL, cx - dVal - rSize / 2, cy + dVal - rSize / 2, rSize, rSize);
      
      const canvasBR = targetHand === 1 ? offCCW : offCW;
      ctx.drawImage(canvasBR, cx + dVal - rSize / 2, cy + dVal - rSize / 2, rSize, rSize);
      
      if (name === 'quadVortexLensing') {
        const rLens = size * 0.12;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rLens);
        const red = clamp(Math.round(br), 0, 255);
        grad.addColorStop(0, `rgba(${red},${red},${red},1)`);
        grad.addColorStop(1, `rgba(${red},${red},${red},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rLens, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  this.showColor('#000000');
  await this.sleep(1800);
  showReferencePattern();
  await this.sleep(450);
  let coldFrame = await this.captureStable(8, 45);

  const fw = coldFrame.width, fh = coldFrame.height;
  const x0 = cal.x0 != null ? cal.x0 : Math.floor(fw * 0.15);
  const x1 = cal.x1 != null ? cal.x1 : Math.floor(fw * 0.85);
  const y0 = cal.y0 != null ? cal.y0 : Math.floor(fh * 0.15);
  const y1 = cal.y1 != null ? cal.y1 : Math.floor(fh * 0.85);
  const roi = { x0, x1, y0, y1 };
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  const leftRegion = { x0, x1: cx, y0, y1 };
  const rightRegion = { x0: cx, x1, y0, y1 };
  const centerRegion = { x0: x0 + (x1 - x0) * 0.33, x1: x0 + (x1 - x0) * 0.67, y0: y0 + (y1 - y0) * 0.33, y1: y0 + (y1 - y0) * 0.67 };
  const edgeRegions = [
    { x0, x1: x1, y0, y1: y0 + (y1 - y0) * 0.2 },
    { x0, x1: x1, y0: y1 - (y1 - y0) * 0.2, y1 },
    { x0, x1: x0 + (x1 - x0) * 0.2, y0, y1 },
    { x0: x1 - (x1 - x0) * 0.2, x1, y0, y1 }
  ];
  const quadrants = {
    top: { x0: x0 + (x1 - x0) * 0.25, x1: x0 + (x1 - x0) * 0.75, y0, y1: cy },
    right: { x0: cx, x1, y0: y0 + (y1 - y0) * 0.25, y1: y0 + (y1 - y0) * 0.75 },
    bottom: { x0: x0 + (x1 - x0) * 0.25, x1: x0 + (x1 - x0) * 0.75, y0: cy, y1 },
    left: { x0, x1: cx, y0: y0 + (y1 - y0) * 0.25, y1: y0 + (y1 - y0) * 0.75 }
  };
  const wCentral = x1 - x0;
  const hCentral = y1 - y0;
  const centralQuadrants = {
    top: { x0: cx - wCentral * 0.15, x1: cx + wCentral * 0.15, y0: cy - hCentral * 0.15, y1: cy },
    right: { x0: cx, x1: cx + wCentral * 0.15, y0: cy - hCentral * 0.15, y1: cy + hCentral * 0.15 },
    bottom: { x0: cx - wCentral * 0.15, x1: cx + wCentral * 0.15, y0: cy, y1: cy + hCentral * 0.15 },
    left: { x0: cx - wCentral * 0.15, x1: cx, y0: cy - hCentral * 0.15, y1: cy + hCentral * 0.15 }
  };
  const bandRegions = Array.from({ length: 4 }, (_, i) => {
    const by0 = y0 + (y1 - y0) * i / 4;
    const by1 = y0 + (y1 - y0) * (i + 1) / 4;
    return {
      left: { x0, x1: cx, y0: by0, y1: by1 },
      right: { x0: cx, x1, y0: by0, y1: by1 }
    };
  });

  const captureAfterPattern = async (patternFn, heatMs = 650, refMs = 150, samples = 4) => {
    this.showPattern(patternFn);
    await this.sleep(heatMs);
    showReferencePattern(4);
    await this.sleep(refMs);
    return await this.captureStable(samples, 35);
  };
  const differentialBetweenFrames = (refFrame, frame) => {
    const left = measureShiftVector(refFrame, frame, leftRegion);
    const right = measureShiftVector(refFrame, frame, rightRegion);
    return { left, right, delta: round(left.dx - right.dx), magDelta: round(left.mag - right.mag) };
  };
  const differentialFromFrame = frame => {
    return differentialBetweenFrames(coldFrame, frame);
  };
  let activeNoiseSigma = 1.0;
  const airSettle = [];
  const coolAndRefresh = async (ms = 900, label = 'air settle') => {
    this.showColor('#000000');
    await this.sleep(ms);

    const attempts = [];
    let settledFrame = null;
    const targetResidual = Math.max(0.75, activeNoiseSigma * 0.65);
    for (let pass = 0; pass < 3; pass++) {
      showReferencePattern(4);
      await this.sleep(180);
      const refA = await this.captureStable(3, 30);
      await this.sleep(140);
      const refB = await this.captureStable(3, 30);
      const d = differentialBetweenFrames(refA, refB);
      const residual = Math.abs(d.delta);
      attempts.push({ pass: pass + 1, residual: round(residual), delta: d.delta, left: d.left.dx, right: d.right.dx });
      settledFrame = refB;
      if (residual <= targetResidual) break;
      this.showColor('#000000');
      await this.sleep(Math.min(1400, 350 + pass * 350));
    }

    if (settledFrame) coldFrame = settledFrame;
    const last = attempts[attempts.length - 1] || { residual: 0, delta: 0 };
    const ok = last.residual <= Math.max(1.5, activeNoiseSigma * 1.25);
    const item = { label, ms, attempts: attempts.length, residual: round(last.residual), delta: round(last.delta), ok };
    airSettle.push(item);
    this.log(`  air-settle ${label}: residual=${item.residual.toFixed(3)}px attempts=${item.attempts} ${ok ? 'OK' : 'DRIFT'}`);
  };

  this.log(`  Camera ROI: [${Math.round(x0)},${Math.round(x1)}] x [${Math.round(y0)},${Math.round(y1)}], frame ${fw}x${fh}`);

  this.setRun(this.t('etap'), 'Stage 84: baseline noise', 144.05);
  logSection('84.1 Baseline BOS noise');
  const baseline = [];
  for (let i = 0; i < 3; i++) {
    await coolAndRefresh(500);
    showReferencePattern();
    await this.sleep(180);
    const frame = await this.captureStable(4, 35);
    baseline.push(differentialFromFrame(frame));
    this.log(`  baseline ${i + 1}/3: delta=${baseline[i].delta.toFixed(3)}px left=${baseline[i].left.dx.toFixed(3)} right=${baseline[i].right.dx.toFixed(3)} patches=${baseline[i].left.count + baseline[i].right.count}`);
  }
  const noiseSigma = Math.max(0.05, std(baseline.map(b => b.delta)), mean(baseline.map(b => Math.abs(b.delta))) * 0.7);
  activeNoiseSigma = noiseSigma;
  this.log(`  Baseline differential noise sigma approx ${noiseSigma.toFixed(3)} px`);
  await coolAndRefresh(1200, 'after baseline / before two-zone');

  this.setRun(this.t('etap'), 'Stage 84: two-zone differential', 144.1);
  logSection('84.2 Two-zone differential element');
  const sweepLevels = [0, 64, 128, 192, 255];
  const gainSweep = [];
  for (const level of sweepLevels) {
    const frame = await captureAfterPattern(drawByName('leftRight', { left: level, right: 0 }), 650, 150, 4);
    const d = differentialFromFrame(frame);
    gainSweep.push({ level, delta: d.delta, left: d.left, right: d.right });
    this.log(`  diff sweep L=${level}: delta=${d.delta.toFixed(3)}px`);
    await coolAndRefresh(400);
  }
  const invFrame = await captureAfterPattern(drawByName('leftRight', { left: 0, right: 255 }), 650, 150, 4);
  const signRight = differentialFromFrame(invFrame).delta;
  await coolAndRefresh(900, 'two-zone inverted -> zero');
  const zeroFrame = await captureAfterPattern(drawByName('leftRight', { left: 128, right: 128 }), 650, 150, 4);
  const signLeft = gainSweep[gainSweep.length - 1].delta;
  const zeroDelta = differentialFromFrame(zeroFrame).delta;
  const differential = {
    gainSweep,
    signLeft: round(signLeft),
    signRight: round(signRight),
    zeroDelta: round(zeroDelta),
    linearityR2: round(r2ForXY(gainSweep.map(p => ({ x: p.level, y: p.delta })))) ,
    signalSigma: round(Math.abs(signLeft) / noiseSigma, 2),
    signFlip: signLeft * signRight < 0,
    zeroBalanced: Math.abs(zeroDelta) < Math.max(1.0, Math.abs(signLeft) * 0.45)
  };
  this.log(`  diff invert R=255: delta=${signRight.toFixed(3)}px, zero L=R=128: delta=${zeroDelta.toFixed(3)}px`);
  this.log(`  diff summary: signal=${differential.signalSigma} sigma, signFlip=${differential.signFlip}, zeroBalanced=${differential.zeroBalanced}, R2=${differential.linearityR2}`);
  await coolAndRefresh(1500, 'after two-zone / before multi-band');

  this.setRun(this.t('etap'), 'Stage 84: 4-band BOS register', 144.2);
  logSection('84.3 Multi-band BOS register');
  const matrix = [];
  for (let inputBand = 0; inputBand < 4; inputBand++) {
    const frame = await captureAfterPattern(drawByName('bandLeft', { bands: 4, band: inputBand, brightness: 255 }), 700, 150, 4);
    const row = bandRegions.map(reg => {
      const left = measureShiftVector(coldFrame, frame, reg.left);
      const right = measureShiftVector(coldFrame, frame, reg.right);
      return round(left.dx - right.dx);
    });
    matrix.push(row);
    this.log(`  band ${inputBand + 1} -> [${row.map(v => v.toFixed(2)).join(', ')}]`);
    await coolAndRefresh(450);
  }
  const diag = matrix.map((row, i) => Math.abs(row[i]));
  const off = matrix.map((row, i) => Math.max(...row.map((v, j) => i === j ? 0 : Math.abs(v))));
  const multiBand = {
    matrix,
    diagonalMean: round(mean(diag)),
    offDiagonalMaxMean: round(mean(off)),
    diagonalDominance: round(mean(diag) / Math.max(0.05, mean(off))),
    usableBands: diag.filter((v, i) => v > Math.max(noiseSigma * 2, off[i])).length
  };
  this.log(`  multiband diag=[${diag.map(v => v.toFixed(2)).join(', ')}], offMax=[${off.map(v => v.toFixed(2)).join(', ')}]`);
  this.log(`  multiband summary: dominance=${multiBand.diagonalDominance}, usableBands=${multiBand.usableBands}/4, diagMean=${multiBand.diagonalMean}px, offMean=${multiBand.offDiagonalMaxMean}px`);
  await coolAndRefresh(1500, 'after multi-band / before lens');

  this.setRun(this.t('etap'), 'Stage 84: lens / prism / grating', 144.3);
  logSection('84.4 Thermal lens');
  const lensStats = {};
  const lensModes = [
    ['center', drawByName('centerLens')],
    ['ring', drawByName('ringLens')],
    ['edge', drawByName('edgeLens')]
  ];
  for (const [name, pattern] of lensModes) {
    const frame = await captureAfterPattern(pattern, 750, 150, 4);
    const c = measureShiftVector(coldFrame, frame, centerRegion);
    const e = mean(edgeRegions.map(r => measureShiftVector(coldFrame, frame, r).mag));
    lensStats[name] = { centerMag: c.mag, edgeMag: round(e), contrast: round(c.mag - e) };
    await coolAndRefresh(1200, `lens ${name} settle`);
  }
  const lens = {
    ...lensStats,
    polarityFlip: lensStats.center.contrast * lensStats.edge.contrast < 0,
    maxContrast: round(Math.max(...Object.values(lensStats).map(v => Math.abs(v.contrast))))
  };
  logSamples('lens modes', Object.entries(lensStats).map(([name, value]) => ({ name, ...value })), s => `${s.name}: center=${s.centerMag.toFixed(3)}px edge=${s.edgeMag.toFixed(3)}px contrast=${s.contrast.toFixed(3)}px`);
  this.log(`  lens summary: maxContrast=${lens.maxContrast}px, polarityFlip=${lens.polarityFlip}`);
  await coolAndRefresh(1500, 'after lens / before prism');

  logSection('84.5 Thermal prism');
  const prismCases = [
    { name: 'lr_full', dir: 'lr', a: 0, b: 255 },
    { name: 'rl_full', dir: 'lr', a: 255, b: 0 },
    { name: 'lr_mid', dir: 'lr', a: 64, b: 192 },
    { name: 'rl_mid', dir: 'lr', a: 192, b: 64 },
    { name: 'tb_full', dir: 'tb', a: 0, b: 255 },
    { name: 'bt_full', dir: 'tb', a: 255, b: 0 }
  ];
  const prismSamples = [];
  for (const p of prismCases) {
    const frame = await captureAfterPattern(drawByName('gradient', p), 650, 150, 4);
    const v = measureShiftVector(coldFrame, frame, roi);
    prismSamples.push({ ...p, dx: v.dx, dy: v.dy, mag: v.mag });
    await coolAndRefresh(300);
  }
  const prism = {
    samples: prismSamples,
    xSignFlip: prismSamples[0].dx * prismSamples[1].dx < 0,
    ySignFlip: prismSamples[4].dy * prismSamples[5].dy < 0,
    xGainFull: round(Math.abs(prismSamples[0].dx - prismSamples[1].dx)),
    yGainFull: round(Math.abs(prismSamples[4].dy - prismSamples[5].dy))
  };
  logSamples('prism gradients', prismSamples, s => `${s.name}: dx=${s.dx.toFixed(3)}px dy=${s.dy.toFixed(3)}px mag=${s.mag.toFixed(3)}px`);
  this.log(`  prism summary: xGain=${prism.xGainFull}px xFlip=${prism.xSignFlip}, yGain=${prism.yGainFull}px yFlip=${prism.ySignFlip}`);
  await coolAndRefresh(1500, 'after prism / before grating');

  logSection('84.6 Thermal grating');
  const gratingPeriods = [12, 24, 48, 96];
  const gratingSamples = [];
  for (const period of gratingPeriods) {
    const frame = await captureAfterPattern(drawByName('grating', { period }), 650, 150, 4);
    const v = measureShiftVector(coldFrame, frame, roi);
    gratingSamples.push({ periodPx: period, mag: v.mag, rms: v.rms, count: v.count });
    await coolAndRefresh(300);
  }
  const grating = {
    samples: gratingSamples,
    bestPeriodPx: gratingSamples.reduce((a, b) => b.rms > a.rms ? b : a, gratingSamples[0]).periodPx,
    maxRms: round(Math.max(...gratingSamples.map(s => s.rms)))
  };
  logSamples('grating periods', gratingSamples, s => `period=${s.periodPx}px mag=${s.mag.toFixed(3)}px rms=${s.rms.toFixed(3)}px patches=${s.count}`);
  this.log(`  grating summary: bestPeriod=${grating.bestPeriodPx}px, maxRms=${grating.maxRms}px`);
  await coolAndRefresh(1500, 'after grating / before axicon');

  this.setRun(this.t('etap'), 'Stage 84: axicon and vortex', 144.4);
  logSection('84.7 Thermal axicon');
  const axiconSamples = [];
  for (const slope of [0.65, 1.0, 1.35]) {
    const frame = await captureAfterPattern(drawByName('axicon', { slope }), 700, 150, 4);
    const inner = measureShiftVector(coldFrame, frame, centerRegion).mag;
    const outer = mean(edgeRegions.map(r => measureShiftVector(coldFrame, frame, r).mag));
    axiconSamples.push({ slope, inner: round(inner), outer: round(outer), ringContrast: round(outer - inner) });
    await coolAndRefresh(350);
  }
  const axicon = {
    samples: axiconSamples,
    contrastTrendR2: round(r2ForXY(axiconSamples.map(s => ({ x: s.slope, y: s.ringContrast })))) ,
    maxRingContrast: round(Math.max(...axiconSamples.map(s => Math.abs(s.ringContrast))))
  };
  logSamples('axicon slopes', axiconSamples, s => `slope=${s.slope}: inner=${s.inner.toFixed(3)}px outer=${s.outer.toFixed(3)}px ringContrast=${s.ringContrast.toFixed(3)}px`);
  this.log(`  axicon summary: maxRingContrast=${axicon.maxRingContrast}px, trendR2=${axicon.contrastTrendR2}`);
  await coolAndRefresh(1500, 'after axicon / before vortex');

  logSection('84.8 Vortex element');
  const vortexSamples = [];
  for (const handedness of [1, -1]) {
    const frame = await captureAfterPattern(drawByName('spiral', { handedness }), 850, 150, 4);
    const top = measureShiftVector(coldFrame, frame, quadrants.top);
    const right = measureShiftVector(coldFrame, frame, quadrants.right);
    const bottom = measureShiftVector(coldFrame, frame, quadrants.bottom);
    const left = measureShiftVector(coldFrame, frame, quadrants.left);
    const curlProxy = round(top.dx + right.dy - bottom.dx - left.dy);
    vortexSamples.push({ handedness, curlProxy, top, right, bottom, left });
    await coolAndRefresh(500);
  }
  const vortex = {
    samples: vortexSamples,
    curlSignFlip: vortexSamples[0].curlProxy * vortexSamples[1].curlProxy < 0,
    curlDelta: round(Math.abs(vortexSamples[0].curlProxy - vortexSamples[1].curlProxy))
  };
  logSamples('vortex handedness', vortexSamples, s => `hand=${s.handedness}: curl=${s.curlProxy.toFixed(3)}px top.dx=${s.top.dx.toFixed(3)} right.dy=${s.right.dy.toFixed(3)} bottom.dx=${s.bottom.dx.toFixed(3)} left.dy=${s.left.dy.toFixed(3)}`);
  this.log(`  vortex summary: curlDelta=${vortex.curlDelta}px, signFlip=${vortex.curlSignFlip}`);
  await coolAndRefresh(1600, 'after vortex / before memory');

  this.setRun(this.t('etap'), 'Stage 84: thermal memory', 144.5);
  logSection('84.9 Thermal memory decay');
  this.showPattern(drawByName('leftRight', { left: 255, right: 0 }));
  await this.sleep(700);
  const memoryDelays = [0, 50, 100, 150, 200, 300, 500];
  const memorySamples = [];
  for (const delay of memoryDelays) {
    this.showColor('#000000');
    await this.sleep(delay);
    showReferencePattern();
    await this.sleep(120);
    const frame = await this.captureStable(3, 30);
    const d = differentialFromFrame(frame);
    memorySamples.push({ delayMs: delay, delta: d.delta, absDelta: round(Math.abs(d.delta)) });
    this.log(`  memory delay=${delay}ms: delta=${d.delta.toFixed(3)}px (${(Math.abs(d.delta) / noiseSigma).toFixed(2)} sigma)`);
  }
  const memory0 = Math.max(0.001, Math.abs(memorySamples[0].delta));
  let decayMs = 500;
  for (const s of memorySamples) {
    if (Math.abs(s.delta) <= memory0 / Math.E) { decayMs = s.delayMs; break; }
  }
  const memory = {
    samples: memorySamples,
    initialDelta: round(memorySamples[0].delta),
    decayMs,
    signalAt150Sigma: round(Math.abs((memorySamples.find(s => s.delayMs === 150) || { delta: 0 }).delta) / noiseSigma, 2),
    signPreserved: memorySamples.slice(0, 4).every(s => Math.sign(s.delta) === Math.sign(memorySamples[0].delta) || Math.abs(s.delta) < noiseSigma)
  };
  this.log(`  memory summary: initial=${memory.initialDelta}px, decay=${memory.decayMs}ms, signal@150ms=${memory.signalAt150Sigma} sigma, signPreserved=${memory.signPreserved}`);
  await coolAndRefresh(1800, 'after memory / before nonlinearity');

  this.setRun(this.t('etap'), 'Stage 84: nonlinearity and frequency', 144.6);
  logSection('84.10 Nonlinear threshold sweep');
  const nonlinearLevels = [0, 32, 64, 96, 128, 160, 192, 224, 255];
  const nonlinearSamples = [];
  for (const level of nonlinearLevels) {
    const frame = await captureAfterPattern(drawByName('full', { brightness: level }), 700, 150, 4);
    const v = measureShiftVector(coldFrame, frame, roi);
    nonlinearSamples.push({ level, mag: v.mag, rms: v.rms, std: v.std });
    this.log(`  nonlinear B=${level}: mag=${v.mag.toFixed(3)}px rms=${v.rms.toFixed(3)}px std=${v.std.toFixed(3)}px`);
    await coolAndRefresh(250);
  }
  const slopes = nonlinearSamples.slice(1).map((s, i) => (s.mag - nonlinearSamples[i].mag) / 32);
  const maxSlope = Math.max(...slopes.map(Math.abs));
  const thresholdIndex = slopes.findIndex(s => Math.abs(s) > maxSlope * 0.65);
  const nonlinear = {
    samples: nonlinearSamples,
    linearityR2: round(r2ForXY(nonlinearSamples.map(s => ({ x: s.level, y: s.mag })))) ,
    thresholdLevel: thresholdIndex >= 0 ? nonlinearLevels[thresholdIndex + 1] : null,
    maxGain: round(Math.max(...nonlinearSamples.map(s => s.mag))),
    maxVariance: round(Math.max(...nonlinearSamples.map(s => s.std)))
  };
  this.log(`  nonlinear summary: threshold=${nonlinear.thresholdLevel}, maxGain=${nonlinear.maxGain}px, maxVariance=${nonlinear.maxVariance}px, R2=${nonlinear.linearityR2}`);
  await coolAndRefresh(1600, 'after nonlinearity / before frequency');

  logSection('84.11 Frequency response');
  const frequencySamples = [];
  for (const hz of [1, 2, 5, 10, 15, 30]) {
    const started = Date.now();
    const half = Math.max(16, 500 / hz);
    let phase = 0;
    while (Date.now() - started < 1200) {
      this.showPattern(drawByName('leftRight', phase % 2 === 0 ? { left: 255, right: 0 } : { left: 0, right: 255 }));
      phase++;
      await this.sleep(half);
    }
    showReferencePattern();
    await this.sleep(130);
    const frame = await this.captureStable(3, 30);
    const d = differentialFromFrame(frame);
    frequencySamples.push({ hz, delta: d.delta, amplitude: round(Math.abs(d.delta)), toggles: phase });
    this.log(`  frequency ${hz}Hz: delta=${d.delta.toFixed(3)}px amp=${Math.abs(d.delta).toFixed(3)}px toggles=${phase}`);
    await coolAndRefresh(350);
  }
  const lowAmp = Math.max(0.001, frequencySamples[0].amplitude);
  const frequency = {
    samples: frequencySamples,
    cutoffHzApprox: (frequencySamples.find(s => s.amplitude < lowAmp / Math.sqrt(2)) || frequencySamples[frequencySamples.length - 1]).hz,
    responseAt5Hz: round((frequencySamples.find(s => s.hz === 5) || { amplitude: 0 }).amplitude / lowAmp, 3),
    responseAt10Hz: round((frequencySamples.find(s => s.hz === 10) || { amplitude: 0 }).amplitude / lowAmp, 3)
  };
  this.log(`  frequency summary: cutoff≈${frequency.cutoffHzApprox}Hz, response@5Hz=${frequency.responseAt5Hz}, response@10Hz=${frequency.responseAt10Hz}`);
  await coolAndRefresh(1600, 'after frequency / before reservoir');

  this.setRun(this.t('etap'), 'Stage 84: reservoir features', 144.7);
  logSection('84.12 Air reservoir features');
  const reservoirPatterns = [
    ['left', drawByName('leftRight', { left: 255, right: 0 })],
    ['gradient', drawByName('gradient', { dir: 'lr', a: 0, b: 255 })],
    ['ring', drawByName('ringLens', { radius: 0.3 })],
    ['spiral', drawByName('spiral', { handedness: 1 })]
  ];
  const reservoirRuns = [];
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const [name, pattern] of reservoirPatterns) {
      const frame = await captureAfterPattern(pattern, 650, 150, 3);
      const feature = [
        ...bandRegions.map(reg => round(measureShiftVector(coldFrame, frame, reg.left).dx - measureShiftVector(coldFrame, frame, reg.right).dx)),
        measureShiftVector(coldFrame, frame, quadrants.top).dx,
        measureShiftVector(coldFrame, frame, quadrants.right).dy,
        measureShiftVector(coldFrame, frame, quadrants.bottom).dx,
        measureShiftVector(coldFrame, frame, quadrants.left).dy
      ];
      reservoirRuns.push({ name, repeat, feature });
      this.log(`  reservoir ${name} repeat ${repeat + 1}: [${feature.map(v => v.toFixed(2)).join(', ')}]`);
      await coolAndRefresh(300);
    }
  }
  const repeatCosines = reservoirPatterns.map(([name]) => {
    const runs = reservoirRuns.filter(r => r.name === name);
    return cosine(runs[0].feature, runs[1].feature);
  });
  const diffCosines = [];
  for (let i = 0; i < reservoirPatterns.length; i++) {
    for (let j = i + 1; j < reservoirPatterns.length; j++) {
      diffCosines.push(cosine(reservoirRuns[i].feature, reservoirRuns[j].feature));
    }
  }
  const reservoir = {
    runs: reservoirRuns,
    repeatCosineMean: round(mean(repeatCosines)),
    differentCosineMean: round(mean(diffCosines)),
    separability: round(mean(repeatCosines) - mean(diffCosines))
  };
  this.log(`  reservoir repeat cosines: [${repeatCosines.map(v => v.toFixed(3)).join(', ')}]`);
  this.log(`  reservoir summary: repeatMean=${reservoir.repeatCosineMean}, differentMean=${reservoir.differentCosineMean}, separability=${reservoir.separability}`);
  await coolAndRefresh(1800, 'after reservoir / before follow-up');

  this.setRun(this.t('etap'), 'Stage 84: follow-up diagnostics', 144.8);
  logSection('84.13 Zero-compensated differential');
  const zeroCompSamples = [];
  for (const heatMs of [650, 1000]) {
    const leftFrame = await captureAfterPattern(drawByName('leftRight', { left: 255, right: 0 }), heatMs, 150, 4);
    const leftRaw = differentialFromFrame(leftFrame).delta;
    await coolAndRefresh(450);
    const zeroBalancedFrame = await captureAfterPattern(drawByName('leftRight', { left: 128, right: 128 }), heatMs, 150, 4);
    const zeroRaw = differentialFromFrame(zeroBalancedFrame).delta;
    await coolAndRefresh(450);
    const rightFrame = await captureAfterPattern(drawByName('leftRight', { left: 0, right: 255 }), heatMs, 150, 4);
    const rightRaw = differentialFromFrame(rightFrame).delta;
    await coolAndRefresh(700);
    const leftCorrected = leftRaw - zeroRaw;
    const rightCorrected = rightRaw - zeroRaw;
    const signedSignal = leftCorrected - rightCorrected;
    const signFlipRecovered = leftCorrected * rightCorrected < 0;
    zeroCompSamples.push({
      heatMs,
      leftRaw: round(leftRaw),
      zeroRaw: round(zeroRaw),
      rightRaw: round(rightRaw),
      leftCorrected: round(leftCorrected),
      rightCorrected: round(rightCorrected),
      signedSignal: round(signedSignal),
      sigma: round(Math.abs(signedSignal) / noiseSigma, 2),
      signFlipRecovered
    });
    this.log(`  zero-comp heat=${heatMs}ms: Lraw=${leftRaw.toFixed(3)} zero=${zeroRaw.toFixed(3)} Rraw=${rightRaw.toFixed(3)} -> signed=${signedSignal.toFixed(3)}px (${(Math.abs(signedSignal) / noiseSigma).toFixed(2)} sigma), signFlip=${signFlipRecovered}`);
  }
  const zeroCompensation = {
    samples: zeroCompSamples,
    bestSigma: round(Math.max(...zeroCompSamples.map(s => s.sigma))),
    signFlipRecovered: zeroCompSamples.some(s => s.signFlipRecovered)
  };
  this.log(`  zero-comp summary: bestSigma=${zeroCompensation.bestSigma}, signFlipRecovered=${zeroCompensation.signFlipRecovered}`);

  logSection('84.14 Cooldown repeatability sweep');
  const cooldownSamples = [];
  for (const cooldownMs of [250, 750, 1500]) {
    const deltas = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      const frame = await captureAfterPattern(drawByName('leftRight', { left: 255, right: 0 }), 650, 150, 3);
      const delta = differentialFromFrame(frame).delta;
      deltas.push(delta);
      this.log(`  cooldown=${cooldownMs}ms repeat=${repeat + 1}: delta=${delta.toFixed(3)}px`);
      await coolAndRefresh(cooldownMs);
    }
    const sampleMean = mean(deltas);
    const sampleStd = std(deltas);
    cooldownSamples.push({ cooldownMs, mean: round(sampleMean), std: round(sampleStd), cv: round(sampleStd / Math.max(0.001, Math.abs(sampleMean)), 4), deltas: deltas.map(v => round(v)) });
  }
  const cooldownSweep = {
    samples: cooldownSamples,
    bestCooldownMs: cooldownSamples.reduce((best, sample) => sample.cv < best.cv ? sample : best, cooldownSamples[0]).cooldownMs
  };
  logSamples('cooldown summary', cooldownSamples, s => `${s.cooldownMs}ms: mean=${s.mean.toFixed(3)}px std=${s.std.toFixed(3)}px cv=${s.cv}`);

  logSection('84.15 Lens radius sweep');
  const lensRadiusSamples = [];
  for (const radius of [0.18, 0.28, 0.38, 0.48]) {
    const frame = await captureAfterPattern(drawByName('ringLens', { radius }), 850, 150, 4);
    const centerMag = measureShiftVector(coldFrame, frame, centerRegion).mag;
    const edgeMag = mean(edgeRegions.map(region => measureShiftVector(coldFrame, frame, region).mag));
    const contrast = centerMag - edgeMag;
    lensRadiusSamples.push({ radius, centerMag: round(centerMag), edgeMag: round(edgeMag), contrast: round(contrast), sigma: round(Math.abs(contrast) / noiseSigma, 2) });
    this.log(`  lens radius=${radius}: center=${centerMag.toFixed(3)}px edge=${edgeMag.toFixed(3)}px contrast=${contrast.toFixed(3)}px (${(Math.abs(contrast) / noiseSigma).toFixed(2)} sigma)`);
    await coolAndRefresh(450);
  }
  const lensRadiusSweep = {
    samples: lensRadiusSamples,
    bestRadius: lensRadiusSamples.reduce((best, sample) => Math.abs(sample.contrast) > Math.abs(best.contrast) ? sample : best, lensRadiusSamples[0]).radius,
    bestSigma: round(Math.max(...lensRadiusSamples.map(s => s.sigma)))
  };

  logSection('84.16 Grating repeatability');
  const gratingRepeatSamples = [];
  for (let repeat = 0; repeat < 3; repeat++) {
    const frame = await captureAfterPattern(drawByName('grating', { period: grating.bestPeriodPx }), 650, 150, 4);
    const shift = measureShiftVector(coldFrame, frame, roi);
    gratingRepeatSamples.push({ repeat: repeat + 1, periodPx: grating.bestPeriodPx, mag: shift.mag, rms: shift.rms, count: shift.count });
    this.log(`  grating repeat ${repeat + 1}: period=${grating.bestPeriodPx}px mag=${shift.mag.toFixed(3)}px rms=${shift.rms.toFixed(3)}px patches=${shift.count}`);
    await coolAndRefresh(450);
  }
  const gratingRmsValues = gratingRepeatSamples.map(s => s.rms);
  const gratingRepeatability = {
    periodPx: grating.bestPeriodPx,
    samples: gratingRepeatSamples,
    meanRms: round(mean(gratingRmsValues)),
    stdRms: round(std(gratingRmsValues)),
    cv: round(std(gratingRmsValues) / Math.max(0.001, mean(gratingRmsValues)), 4)
  };
  this.log(`  grating repeat summary: meanRms=${gratingRepeatability.meanRms}px std=${gratingRepeatability.stdRms}px cv=${gratingRepeatability.cv}`);

  logSection('84.17 Runaway series test');
  const runawaySamples = [];
  for (let pulse = 0; pulse < 15; pulse++) {
    this.showPattern(drawByName('leftRight', { left: 255, right: 0 }));
    await this.sleep(650);
    this.showPattern(drawByName('leftRight', { left: 128, right: 128 }));
    await this.sleep(150);
    const frame = await this.captureStable(2, 30);
    const zeroRaw = differentialFromFrame(frame).delta;
    runawaySamples.push({ pulse: pulse + 1, zeroRaw: round(zeroRaw) });
    this.log(`  pulse ${pulse + 1}/15: zeroRaw drift = ${zeroRaw.toFixed(3)}px`);
    await coolAndRefresh(250);
  }
  const zeroRawValues = runawaySamples.map(s => s.zeroRaw);
  const runawayTest = {
    samples: runawaySamples,
    driftMax: round(Math.max(...zeroRawValues.map(Math.abs))),
    driftTrend: round(zeroRawValues[zeroRawValues.length - 1] - zeroRawValues[0])
  };
  this.log(`  runaway summary: max drift = ${runawayTest.driftMax}px, trend = ${runawayTest.driftTrend}px`);

  logSection('84.18 Guard-band sweep');
  const guardBandSamples = [];
  for (const guard of [0, 20, 40]) {
    const matrix = [];
    for (let inputBand = 0; inputBand < 4; inputBand++) {
      const frame = await captureAfterPattern(drawByName('bandLeft', { bands: 4, band: inputBand, brightness: 255, guardBandPx: guard }), 700, 150, 3);
      const row = bandRegions.map(reg => {
        const left = measureShiftVector(coldFrame, frame, reg.left);
        const right = measureShiftVector(coldFrame, frame, reg.right);
        return round(left.dx - right.dx);
      });
      matrix.push(row);
      await coolAndRefresh(350);
    }
    const diag = matrix.map((row, i) => Math.abs(row[i]));
    const off = matrix.map((row, i) => Math.max(...row.map((v, j) => i === j ? 0 : Math.abs(v))));
    const dominance = round(mean(diag) / Math.max(0.05, mean(off)));
    guardBandSamples.push({ guardBandPx: guard, dominance, matrix });
    this.log(`  guardBand ${guard}px: dominance = ${dominance}`);
  }
  const guardBandSweep = {
    samples: guardBandSamples,
    bestGuardBandPx: guardBandSamples.reduce((best, sample) => sample.dominance > best.dominance ? sample : best, guardBandSamples[0]).guardBandPx
  };

  logSection('84.19 Pattern period sweep');
  const patternPeriodSamples = [];
  for (const period of [4, 6, 8]) {
    showReferencePattern(period);
    await this.sleep(400);
    const tempColdFrame = await this.captureStable(4, 30);
    const deltas = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      showReferencePattern(period);
      await this.sleep(200);
      const frame = await this.captureStable(3, 30);
      const left = measureShiftVector(tempColdFrame, frame, leftRegion);
      const right = measureShiftVector(tempColdFrame, frame, rightRegion);
      deltas.push(left.dx - right.dx);
    }
    const noise = round(std(deltas));
    patternPeriodSamples.push({ periodPx: period, noiseSigma: noise });
    this.log(`  period ${period}px: noiseSigma = ${noise}px`);
  }
  const patternPeriodSweep = {
    samples: patternPeriodSamples,
    bestPeriodPx: patternPeriodSamples.reduce((best, sample) => sample.noiseSigma < best.noiseSigma ? sample : best, patternPeriodSamples[0]).periodPx
  };
  showReferencePattern(4);
  await this.sleep(300);

  logSection('84.20 Fine lens radius sweep');
  const fineLensSamples = [];
  for (const radius of [0.24, 0.26, 0.28, 0.30, 0.32]) {
    const frame = await captureAfterPattern(drawByName('ringLens', { radius }), 850, 150, 4);
    const centerMag = measureShiftVector(coldFrame, frame, centerRegion).mag;
    const edgeMag = mean(edgeRegions.map(region => measureShiftVector(coldFrame, frame, region).mag));
    const contrast = centerMag - edgeMag;
    fineLensSamples.push({ radius, centerMag: round(centerMag), edgeMag: round(edgeMag), contrast: round(contrast), sigma: round(Math.abs(contrast) / noiseSigma, 2) });
    this.log(`  fine lens radius=${radius}: center=${centerMag.toFixed(3)}px edge=${edgeMag.toFixed(3)}px contrast=${contrast.toFixed(3)}px (${(Math.abs(contrast) / noiseSigma).toFixed(2)} sigma)`);
    await coolAndRefresh(450);
  }
  const fineLensSweep = {
    samples: fineLensSamples,
    bestRadius: fineLensSamples.reduce((best, sample) => Math.abs(sample.contrast) > Math.abs(best.contrast) ? sample : best, fineLensSamples[0]).radius,
    bestSigma: round(Math.max(...fineLensSamples.map(s => s.sigma)))
  };

  logSection('84.21 Dynamic reservoir test');
  const dynamicReservoirRuns = [];
  const timeSteps = [300, 550, 800];
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const [name, pattern] of reservoirPatterns) {
      const timeFeatures = [];
      for (const heatMs of timeSteps) {
        const frame = await captureAfterPattern(pattern, heatMs, 150, 3);
        const stepFeature = [
          ...bandRegions.map(reg => round(measureShiftVector(coldFrame, frame, reg.left).dx - measureShiftVector(coldFrame, frame, reg.right).dx)),
          measureShiftVector(coldFrame, frame, quadrants.top).dx,
          measureShiftVector(coldFrame, frame, quadrants.right).dy,
          measureShiftVector(coldFrame, frame, quadrants.bottom).dx,
          measureShiftVector(coldFrame, frame, quadrants.left).dy
        ];
        timeFeatures.push(...stepFeature);
        await coolAndRefresh(300);
      }
      dynamicReservoirRuns.push({ name, repeat, feature: timeFeatures });
      this.log(`  dyn reservoir ${name} repeat ${repeat + 1}: feature length = ${timeFeatures.length}`);
    }
  }
  const dynRepeatCosines = reservoirPatterns.map(([name]) => {
    const runs = dynamicReservoirRuns.filter(r => r.name === name);
    return cosine(runs[0].feature, runs[1].feature);
  });
  const dynDiffCosines = [];
  for (let i = 0; i < reservoirPatterns.length; i++) {
    for (let j = i + 1; j < reservoirPatterns.length; j++) {
      dynDiffCosines.push(cosine(dynamicReservoirRuns[i].feature, dynamicReservoirRuns[j].feature));
    }
  }
  const dynamicReservoir = {
    runs: dynamicReservoirRuns,
    repeatCosineMean: round(mean(dynRepeatCosines)),
    differentCosineMean: round(mean(dynDiffCosines)),
    separability: round(mean(dynRepeatCosines) - mean(dynDiffCosines))
  };
  this.log(`  dyn reservoir summary: repeatMean=${dynamicReservoir.repeatCosineMean}, differentMean=${dynamicReservoir.differentCosineMean}, separability=${dynamicReservoir.separability}`);

  logSection('84.22 Vertical layer multiplexing');
  const vertFrame = await captureAfterPattern(drawByName('verticalMulti'), 650, 150, 4);
  const vertShiftGrating = measureShiftVector(coldFrame, vertFrame, roi);
  const vertShiftLensCenter = measureShiftVector(coldFrame, vertFrame, centerRegion);
  const vertShiftLensEdge = mean(edgeRegions.map(region => measureShiftVector(coldFrame, vertFrame, region).mag));
  const vertLensContrast = vertShiftLensCenter.mag - vertShiftLensEdge;
  const verticalMultiplexing = {
    gratingMag: round(vertShiftGrating.mag),
    lensContrast: round(vertLensContrast),
    orthogonality: round(cosine(
      [vertShiftGrating.dx, vertShiftGrating.dy],
      [vertShiftLensCenter.dx, vertShiftLensCenter.dy]
    ))
  };
  this.log(`  vert-multi summary: gratingMag=${verticalMultiplexing.gratingMag}px, lensContrast=${verticalMultiplexing.lensContrast}px, orthogonality=${verticalMultiplexing.orthogonality}`);
  await coolAndRefresh(450);

  logSection('84.23 Channel capacity sweep');
  const capacitySamples = [];
  for (const gridSz of [2, 3, 4]) {
    const activeIdx = [];
    const totalCells = gridSz * gridSz;
    for (let i = 0; i < totalCells; i += 2) activeIdx.push(i);
    const frame = await captureAfterPattern(drawByName('grid', { cols: gridSz, rows: gridSz, activeIndices: activeIdx }), 700, 150, 4);
    const cellW = (x1 - x0) / gridSz;
    const cellH = (y1 - y0) / gridSz;
    const activeCellRoi = { x0, x1: x0 + cellW, y0, y1: y0 + cellH };
    const inactiveCellRoi = { x0: x0 + cellW, x1: x0 + cellW * 2, y0, y1: y0 + cellH };
    const activeShift = measureShiftVector(coldFrame, frame, activeCellRoi);
    const inactiveShift = measureShiftVector(coldFrame, frame, inactiveCellRoi);
    const crossTalk = activeShift.mag > 0.1 ? round(inactiveShift.mag / activeShift.mag, 3) : 1.0;
    capacitySamples.push({
      gridSize: gridSz,
      activeMag: round(activeShift.mag),
      inactiveMag: round(inactiveShift.mag),
      crossTalk
    });
    this.log(`  grid ${gridSz}x${gridSz}: activeCellMag=${activeShift.mag.toFixed(3)}px, inactiveCellMag=${inactiveShift.mag.toFixed(3)}px, cross-talk=${crossTalk}`);
    await coolAndRefresh(400);
  }
  const channelCapacity = {
    samples: capacitySamples,
    bestGridSize: (capacitySamples.find(s => s.crossTalk < 0.5) || capacitySamples[0]).gridSize
  };

  logSection('84.24 Talbot layering test');
  const talbotFrame = await captureAfterPattern(drawByName('talbotMulti'), 650, 150, 4);
  const talbotShift = measureShiftVector(coldFrame, talbotFrame, roi);
  const talbotLayering = {
    mag: round(talbotShift.mag),
    rms: round(talbotShift.rms),
    usable: talbotShift.mag > noiseSigma * 3
  };
  this.log(`  talbot layering summary: mag=${talbotLayering.mag}px, rms=${talbotLayering.rms}px, usable=${talbotLayering.usable}`);
  await coolAndRefresh(450);

  logSection('84.25 Free Convection Double-Slit (Madelung)');
  const slitAFrame = await captureAfterPattern(drawByName('madelungDoubleSlit', { slit: 'A' }), 650, 150, 4);
  const shiftA = measureShiftVector(coldFrame, slitAFrame, roi);
  await coolAndRefresh(450);

  const slitBFrame = await captureAfterPattern(drawByName('madelungDoubleSlit', { slit: 'B' }), 650, 150, 4);
  const shiftB = measureShiftVector(coldFrame, slitBFrame, roi);
  await coolAndRefresh(450);

  const slitABFrame = await captureAfterPattern(drawByName('madelungDoubleSlit', { slit: 'AB' }), 650, 150, 4);
  const shiftAB = measureShiftVector(coldFrame, slitABFrame, roi);

  const doubleSlitMadelung = {
    magA: round(shiftA.mag),
    magB: round(shiftB.mag),
    magAB: round(shiftAB.mag),
    nonAdditivity: round(shiftAB.mag - (shiftA.mag + shiftB.mag)),
    ratio: round(shiftAB.mag / Math.max(1e-12, shiftA.mag + shiftB.mag))
  };
  this.log(`  double-slit: slitA=${doubleSlitMadelung.magA}px, slitB=${doubleSlitMadelung.magB}px, slitAB=${doubleSlitMadelung.magAB}px`);
  this.log(`  double-slit non-additivity: cross-term=${doubleSlitMadelung.nonAdditivity}px, ratio=${doubleSlitMadelung.ratio}`);
  await coolAndRefresh(450);

  logSection('84.26 Entanglement Decay (RHIC Bell Test)');
  const decaySamples = [];
  const bgLevels = [0, 64, 128, 192];
  for (const bg of bgLevels) {
    const frame = await captureAfterPattern(drawByName('leftRight', { left: 255, right: bg, background: bg }), 650, 150, 4);
    const left = measureShiftVector(coldFrame, frame, leftRegion);
    const right = measureShiftVector(coldFrame, frame, rightRegion);

    const alignedLen = Math.min((left.mags || []).length, (right.mags || []).length);
    const la = (left.mags || []).slice(0, alignedLen);
    const ra = (right.mags || []).slice(0, alignedLen);
    const correlation = alignedLen > 1 ? corr(la, ra) : 0;
    const S_CHSH = round(2 * Math.sqrt(2) * correlation);

    decaySamples.push({
      background: bg,
      leftMag: round(left.mag),
      rightMag: round(right.mag),
      correlation: round(correlation),
      S_CHSH
    });
    this.log(`  RHIC Bell bg=${bg}: left=${left.mag.toFixed(3)}px right=${right.mag.toFixed(3)}px corr=${correlation.toFixed(3)} S_CHSH=${S_CHSH.toFixed(3)}`);
    await coolAndRefresh(400);
  }
  const entanglementDecay = {
    samples: decaySamples,
    initialS: decaySamples[0].S_CHSH,
    finalS: decaySamples[decaySamples.length - 1].S_CHSH,
    decayed: Math.abs(decaySamples[decaySamples.length - 1].S_CHSH) < Math.abs(decaySamples[0].S_CHSH) * 0.7
  };
  this.log(`  entanglement decay summary: initial S_CHSH=${entanglementDecay.initialS}, final S_CHSH=${entanglementDecay.finalS}, decayed=${entanglementDecay.decayed}`);
  await coolAndRefresh(450);

  logSection('84.27 Phase Coherence Collapse (Wavefunction Collapse)');
  const collapseSamples = [];
  const delays = [0, 50, 100, 150];
  for (const dt of delays) {
    this.showPattern(drawByName('grating', { period: 24 }));
    await this.sleep(650);
    this.showColor('#000000');
    await this.sleep(dt);
    showReferencePattern(4);
    await this.sleep(120);
    const frame = await this.captureStable(3, 30);
    const shift = measureShiftVector(coldFrame, frame, roi);
    const coherence = round(shift.rms / Math.max(1e-12, noiseSigma));

    collapseSamples.push({
      delayMs: dt,
      rms: round(shift.rms),
      coherence
    });
    this.log(`  collapse delay=${dt}ms: grating rms=${shift.rms.toFixed(3)}px coherence=${coherence.toFixed(3)}`);
    await coolAndRefresh(600);
  }
  const phaseCollapse = {
    samples: collapseSamples,
    initialCoherence: collapseSamples[0].coherence,
    finalCoherence: collapseSamples[collapseSamples.length - 1].coherence,
    collapseMs: (collapseSamples.find(s => s.coherence <= collapseSamples[0].coherence / Math.E) || collapseSamples[collapseSamples.length - 1]).delayMs
  };
  this.log(`  phase collapse summary: initial coherence=${phaseCollapse.initialCoherence}, final coherence=${phaseCollapse.finalCoherence}, collapse time approx=${phaseCollapse.collapseMs}ms`);
  await coolAndRefresh(450);

  this.setRun(this.t('etap'), 'Stage 84: gating and diffusion probes', 144.9);
  logSection('84.28 Settle-gated element repeatability');
  const settleGatedSamples = [];
  for (let i = 0; i < 5; i++) {
    await coolAndRefresh(450, `gated-rep ${i + 1}`);
    const settleOk = (airSettle[airSettle.length - 1] || { ok: false }).ok;
    const frame = await captureAfterPattern(drawByName('grating', { period: 24 }), 650, 150, 3);
    const mag = measureShiftVector(coldFrame, frame, roi).mag;
    settleGatedSamples.push({ run: i + 1, mag: round(mag), settleOk });
    this.log(`  gated-rep ${i + 1}: gratingMag=${mag.toFixed(3)}px settleOk=${settleOk}`);
  }
  const allRepMags = settleGatedSamples.map(s => s.mag);
  const okRepMags = settleGatedSamples.filter(s => s.settleOk).map(s => s.mag);
  const cvAll = mean(allRepMags) > 1e-6 ? round(std(allRepMags) / mean(allRepMags), 3) : 0;
  const cvGated = (okRepMags.length > 1 && mean(okRepMags) > 1e-6) ? round(std(okRepMags) / mean(okRepMags), 3) : null;
  const settleGatedRepeatability = {
    samples: settleGatedSamples,
    cvAll,
    cvGated,
    okCount: okRepMags.length,
    improvement: cvGated != null ? round(cvAll - cvGated, 3) : 0
  };
  this.log(`  settle-gated repeatability: cvAll=${cvAll}, cvGated=${cvGated}, okCount=${okRepMags.length}/${settleGatedSamples.length}`);

  logSection('84.29 Double-slit separation sweep');
  const slitSepSamples = [];
  for (const sepFrac of [0.12, 0.20, 0.28, 0.36]) {
    const fa = await captureAfterPattern(drawByName('madelungDoubleSlit', { slit: 'A', sepFrac }), 650, 150, 4);
    const ma = measureShiftVector(coldFrame, fa, roi).mag;
    await coolAndRefresh(450, `slitSep A ${sepFrac}`);
    const fb = await captureAfterPattern(drawByName('madelungDoubleSlit', { slit: 'B', sepFrac }), 650, 150, 4);
    const mb = measureShiftVector(coldFrame, fb, roi).mag;
    await coolAndRefresh(450, `slitSep B ${sepFrac}`);
    const fab = await captureAfterPattern(drawByName('madelungDoubleSlit', { slit: 'AB', sepFrac }), 650, 150, 4);
    const mab = measureShiftVector(coldFrame, fab, roi).mag;
    await coolAndRefresh(450, `slitSep AB ${sepFrac}`);
    const ratio = round(mab / Math.max(1e-12, ma + mb), 3);
    slitSepSamples.push({ sepFrac, magA: round(ma), magB: round(mb), magAB: round(mab), ratio });
    this.log(`  slit sep ${sepFrac}: A=${ma.toFixed(3)}px B=${mb.toFixed(3)}px AB=${mab.toFixed(3)}px ratio=${ratio}`);
  }
  const doubleSlitSeparation = {
    samples: slitSepSamples,
    additiveSepFrac: (slitSepSamples.find(s => s.ratio >= 0.9) || slitSepSamples[slitSepSamples.length - 1]).sepFrac,
    minRatio: round(Math.min(...slitSepSamples.map(s => s.ratio)), 3)
  };
  this.log(`  double-slit separation summary: additiveSepFrac=${doubleSlitSeparation.additiveSepFrac}, minRatio=${doubleSlitSeparation.minRatio}`);

  logSection('84.30 Lateral thermal diffusion probe');
  const diffusionSamples = [];
  const probeGrid = 6;
  const probeFrame = await captureAfterPattern(drawByName('grid', { cols: probeGrid, rows: probeGrid, activeIndices: [0] }), 700, 150, 4);
  const pCellW = (x1 - x0) / probeGrid;
  const pCellH = (y1 - y0) / probeGrid;
  for (let c = 0; c < probeGrid; c++) {
    const cellRoi = { x0: x0 + c * pCellW, x1: x0 + (c + 1) * pCellW, y0, y1: y0 + pCellH };
    const mag = measureShiftVector(coldFrame, probeFrame, cellRoi).mag;
    diffusionSamples.push({ cellsFromSource: c, mag: round(mag) });
    this.log(`  diffusion cell +${c}: mag=${mag.toFixed(3)}px`);
  }
  await coolAndRefresh(450, 'diffusion probe');
  const sourceMag = diffusionSamples[0].mag;
  const halfMag = sourceMag * 0.5;
  const halfFalloffCells = (diffusionSamples.find(s => s.cellsFromSource > 0 && s.mag < halfMag) || diffusionSamples[diffusionSamples.length - 1]).cellsFromSource;
  const lateralDiffusion = {
    samples: diffusionSamples,
    sourceMag: round(sourceMag),
    halfFalloffCells,
    cellWidthPx: round(pCellW, 1),
    estimatedSpreadPx: round(halfFalloffCells * pCellW, 1)
  };
  this.log(`  lateral diffusion summary: sourceMag=${lateralDiffusion.sourceMag}px, halfFalloff=${halfFalloffCells} cells (~${lateralDiffusion.estimatedSpreadPx}px)`);

  logSection('84.31 Central Vortex Synergy');
  const centralVortexSamples = [];
  for (const targetHandedness of [1, -1]) {
    const frame = await captureAfterPattern(drawByName('quadVortex', { targetHandedness }), 850, 150, 4);
    const top = measureShiftVector(coldFrame, frame, centralQuadrants.top);
    const right = measureShiftVector(coldFrame, frame, centralQuadrants.right);
    const bottom = measureShiftVector(coldFrame, frame, centralQuadrants.bottom);
    const left = measureShiftVector(coldFrame, frame, centralQuadrants.left);
    const curlProxy = round(top.dx + right.dy - bottom.dx - left.dy);
    centralVortexSamples.push({ targetHandedness, curlProxy, top, right, bottom, left });
    await coolAndRefresh(500);
  }
  const centralVortexSynergy = {
    samples: centralVortexSamples,
    curlSignFlip: centralVortexSamples[0].curlProxy * centralVortexSamples[1].curlProxy < 0,
    curlDelta: round(Math.abs(centralVortexSamples[0].curlProxy - centralVortexSamples[1].curlProxy)),
    magCCW: round(mean([centralVortexSamples[0].top.mag, centralVortexSamples[0].right.mag, centralVortexSamples[0].bottom.mag, centralVortexSamples[0].left.mag])),
    magCW: round(mean([centralVortexSamples[1].top.mag, centralVortexSamples[1].right.mag, centralVortexSamples[1].bottom.mag, centralVortexSamples[1].left.mag]))
  };
  logSamples('central vortex synergy', centralVortexSamples, s => `targetHand=${s.targetHandedness}: curl=${s.curlProxy.toFixed(3)}px top.dx=${s.top.dx.toFixed(3)} right.dy=${s.right.dy.toFixed(3)} bottom.dx=${s.bottom.dx.toFixed(3)} left.dy=${s.left.dy.toFixed(3)}`);
  this.log(`  central vortex summary: curlDelta=${centralVortexSynergy.curlDelta}px, signFlip=${centralVortexSynergy.curlSignFlip}`);

  logSection('84.32 Vortex Lensing');
  const vortexLensingSamples = [];
  for (const targetHandedness of [1, -1]) {
    const frame = await captureAfterPattern(drawByName('quadVortexLensing', { targetHandedness }), 850, 150, 4);
    const top = measureShiftVector(coldFrame, frame, centralQuadrants.top);
    const right = measureShiftVector(coldFrame, frame, centralQuadrants.right);
    const bottom = measureShiftVector(coldFrame, frame, centralQuadrants.bottom);
    const left = measureShiftVector(coldFrame, frame, centralQuadrants.left);
    const centralRegion = {
      x0: cx - wCentral * 0.15,
      x1: cx + wCentral * 0.15,
      y0: cy - hCentral * 0.15,
      y1: cy + hCentral * 0.15
    };
    const cShift = measureShiftVector(coldFrame, frame, centralRegion);
    const curlProxy = round(top.dx + right.dy - bottom.dx - left.dy);
    vortexLensingSamples.push({ targetHandedness, curlProxy, centralMag: cShift.mag, centralRms: cShift.rms, top, right, bottom, left });
    await coolAndRefresh(500);
  }
  const vortexLensing = {
    samples: vortexLensingSamples,
    curlSignFlip: vortexLensingSamples[0].curlProxy * vortexLensingSamples[1].curlProxy < 0,
    curlDelta: round(Math.abs(vortexLensingSamples[0].curlProxy - vortexLensingSamples[1].curlProxy)),
    meanCentralMag: round(mean([vortexLensingSamples[0].centralMag, vortexLensingSamples[1].centralMag])),
    meanCentralRms: round(mean([vortexLensingSamples[0].centralRms, vortexLensingSamples[1].centralRms]))
  };
  logSamples('vortex lensing', vortexLensingSamples, s => `targetHand=${s.targetHandedness}: curl=${s.curlProxy.toFixed(3)}px centralMag=${s.centralMag.toFixed(3)}px centralRms=${s.centralRms.toFixed(3)}px`);
  this.log(`  vortex lensing summary: curlDelta=${vortexLensing.curlDelta}px, centralMagMean=${vortexLensing.meanCentralMag}px, signFlip=${vortexLensing.curlSignFlip}`);

  const followUp = {
    zeroCompensation,
    cooldownSweep,
    lensRadiusSweep,
    centralVortexSynergy,
    vortexLensing,
    gratingRepeatability,
    runawayTest,
    guardBandSweep,
    patternPeriodSweep,
    fineLensSweep,
    dynamicReservoir,
    verticalMultiplexing,
    channelCapacity,
    talbotLayering,
    doubleSlitMadelung,
    entanglementDecay,
    phaseCollapse,
    settleGatedRepeatability,
    doubleSlitSeparation,
    lateralDiffusion
  };

  this.showColor('#000000');

  const elementSignals = [
    Math.abs(differential.signLeft),
    multiBand.diagonalMean,
    lens.maxContrast,
    Math.max(prism.xGainFull, prism.yGainFull),
    grating.maxRms,
    axicon.maxRingContrast,
    vortex.curlDelta,
    Math.abs(memory.initialDelta),
    nonlinear.maxGain,
    frequencySamples[0].amplitude,
    Math.max(0, reservoir.separability)
  ];
  const usableElementCount = elementSignals.filter(v => v > noiseSigma * 3).length;
  const elementNames = ['two-zone', 'multi-band', 'lens', 'prism', 'grating', 'axicon', 'vortex', 'memory', 'nonlinear', 'frequency', 'reservoir'];
  const elementDiagnostics = elementNames.map((name, index) => ({
    name,
    signal: round(elementSignals[index]),
    sigma: round(elementSignals[index] / noiseSigma, 2),
    usable: elementSignals[index] > noiseSigma * 3
  }));
  const pass = usableElementCount >= 3;

  this.results.stage84 = {
    method: 'Air-element BOS instrumentation bench for Stage 82 follow-up',
    roi: { x0: Math.round(x0), x1: Math.round(x1), y0: Math.round(y0), y1: Math.round(y1) },
    noiseSigma: round(noiseSigma),
    baseline,
    differential,
    multiBand,
    lens,
    prism,
    grating,
    axicon,
    vortex,
    memory,
    nonlinear,
    frequency,
    reservoir,
    airSettle,
    followUp,
    usableElementCount,
    elementSignals: elementSignals.map(v => round(v)),
    elementDiagnostics,
    differentialPass: differential.signalSigma > 3 && differential.signFlip,
    testsCovered: [
      'two-zone differential', 'multi-band register', 'thermal lens', 'thermal prism',
      'thermal grating', 'thermal axicon', 'vortex element', 'thermal memory',
      'nonlinear threshold', 'frequency response', 'air reservoir',
      'zero-compensated differential', 'cooldown repeatability', 'lens radius sweep', 'grating repeatability',
      'runaway series test', 'guard-band sweep', 'pattern period sweep', 'fine lens radius sweep', 'dynamic reservoir test',
      'vertical layer multiplexing', 'channel capacity sweep', 'spatial talbot layering',
      'free convection double-slit', 'entanglement decay', 'phase coherence collapse',
      'settle-gated repeatability', 'double-slit separation sweep', 'lateral thermal diffusion probe',
      'central vortex synergy', 'vortex lensing'
    ],
    pass
  };

  this.log('\n━━━ STAGE 84 RESULT ━━━');
  this.log(`  Noise sigma: ${noiseSigma.toFixed(3)} px`);
  this.log(`  Differential: signal=${differential.signalSigma} sigma, signFlip=${differential.signFlip}, R2=${differential.linearityR2}`);
  this.log(`  Multi-band: dominance=${multiBand.diagonalDominance}, usable=${multiBand.usableBands}/4`);
  this.log(`  Lens max contrast=${lens.maxContrast}px, prism x/y gain=${prism.xGainFull}/${prism.yGainFull}px`);
  this.log(`  Grating best period=${grating.bestPeriodPx}px, axicon max ring=${axicon.maxRingContrast}px, vortex curl delta=${vortex.curlDelta}px`);
  this.log(`  Memory decay=${memory.decayMs}ms, signal@150ms=${memory.signalAt150Sigma} sigma`);
  this.log(`  Frequency cutoff approx=${frequency.cutoffHzApprox}Hz, reservoir separability=${reservoir.separability}`);
  this.log(`  Air-settle guard: ${airSettle.filter(s => s.ok).length}/${airSettle.length} barriers stable, last residual=${(airSettle[airSettle.length - 1] || { residual: 0 }).residual.toFixed(3)}px`);
  this.log(`  Follow-up: zeroComp best=${followUp.zeroCompensation.bestSigma} sigma signFlip=${followUp.zeroCompensation.signFlipRecovered}, bestCooldown=${followUp.cooldownSweep.bestCooldownMs}ms, lensRadius=${followUp.lensRadiusSweep.bestRadius}, gratingCV=${followUp.gratingRepeatability.cv}`);
  this.log(`  New follow-up tests: runaway drift=${followUp.runawayTest.driftTrend.toFixed(3)}px, bestGuardBand=${followUp.guardBandSweep.bestGuardBandPx}px, bestRefPeriod=${followUp.patternPeriodSweep.bestPeriodPx}px, fineLens bestRadius=${followUp.fineLensSweep.bestRadius}, dynReservoir separability=${followUp.dynamicReservoir.separability}`);
  this.log(`  Multi-layer tests: vertMultiGrating=${followUp.verticalMultiplexing.gratingMag.toFixed(3)}px, bestGridSize=${followUp.channelCapacity.bestGridSize}x${followUp.channelCapacity.bestGridSize}, talbotMag=${followUp.talbotLayering.mag.toFixed(3)}px`);
  this.log(`  Mirrorless VMF tests: doubleSlitRatio=${followUp.doubleSlitMadelung.ratio}, CHSHInitial=${followUp.entanglementDecay.initialS.toFixed(3)}, collapseTime=${followUp.phaseCollapse.collapseMs}ms`);
  this.log(`  Gating/diffusion tests: settleGated cvAll=${followUp.settleGatedRepeatability.cvAll} cvGated=${followUp.settleGatedRepeatability.cvGated}, slitAdditiveSep=${followUp.doubleSlitSeparation.additiveSepFrac}, diffusionSpread=${followUp.lateralDiffusion.estimatedSpreadPx}px`);
  this.log(`  Quad-vortex VMF tests: centralVortexDelta=${followUp.centralVortexSynergy.curlDelta.toFixed(3)}px signFlip=${followUp.centralVortexSynergy.curlSignFlip}, lensingDelta=${followUp.vortexLensing.curlDelta.toFixed(3)}px centralMag=${followUp.vortexLensing.meanCentralMag.toFixed(3)}px`);
  logSamples('Element sigma table', elementDiagnostics, s => `${s.name}: signal=${s.signal.toFixed(3)}px, ${s.sigma.toFixed(2)} sigma, usable=${s.usable}`);
  if (!this.results.stage84.differentialPass) this.log('  Note: bench passed by physical element coverage, but two-zone differential needs retuning/cooling before Stage 82 LLM use.');
  this.log(`  Usable air elements: ${usableElementCount}/11 -> ${pass ? 'PASS' : 'WEAK'}`);
}

export function render(r) {
  if (r.stage84) { try {
    const s = r.stage84;
    this.rv('rv-s84-usable', `${s.usableElementCount || 0}/11`, (s.usableElementCount || 0) >= 3 ? 'ok' : 'warn');
    this.rv('rv-s84-noise', `${(s.noiseSigma || 0).toFixed(2)}px`, (s.noiseSigma || 9) < 2 ? 'ok' : 'warn');
    this.rv('rv-s84-diff', `${((s.differential || {}).signalSigma || 0).toFixed(1)}σ`, ((s.differential || {}).signalSigma || 0) > 3 ? 'ok' : 'warn');
    this.rv('rv-s84-band', `${((s.multiBand || {}).diagonalDominance || 0).toFixed(2)}x`, ((s.multiBand || {}).diagonalDominance || 0) > 1.5 ? 'ok' : 'warn');
    this.rv('rv-s84-memory', `${((s.memory || {}).decayMs || 0)}ms`, ((s.memory || {}).signalAt150Sigma || 0) > 3 ? 'ok' : 'warn');
    this.rv('rv-s84-freq', `${((s.frequency || {}).cutoffHzApprox || 0)}Hz`, ((s.frequency || {}).responseAt5Hz || 0) > 0.2 ? 'ok' : 'warn');
    const g = document.getElementById('g-s84');
    if (g) {
      g.textContent = s.pass
        ? `OK: air bench found ${s.usableElementCount}/11 usable elements`
        : `WEAK: only ${s.usableElementCount}/11 elements above 3 sigma`;
      g.className = s.pass ? 'grade pass' : 'grade warn';
    }
  } catch(e) { console.error('s84 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; }
}

export function metric(d) {
  try { return `${d.usableElementCount}/11 elements, diff ${d.differential.signalSigma}σ`; } catch (e) { return '—'; }
}