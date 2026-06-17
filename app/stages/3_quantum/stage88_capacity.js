// Stage 88: Micro-Vortex Grid Capacity (Емкость микровихревой сетки)
// Tests the maximum number of recognizable quad-vortex cells (1, 2, 4, and 8 elements) 
// that can be resolved and tracked simultaneously on the screen.

export async function run() {
  this.setRun(this.t('etap'), this.t('capacity_start'), 148.0);
  this.log('━━━ STAGE 88: MICRO-VORTEX GRID CAPACITY ━━━');

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

  // Optical flow displacement measurement
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

  // Initial black frame reference
  this.showColor('#000000');
  await this.sleep(1500);
  showReferencePattern();
  await this.sleep(450);
  const coldFrame = await this.captureStable(8, 45);

  const fw = coldFrame.width, fh = coldFrame.height;
  const x0 = cal.x0 != null ? cal.x0 : Math.floor(fw * 0.15);
  const x1 = cal.x1 != null ? cal.x1 : Math.floor(fw * 0.85);
  const y0 = cal.y0 != null ? cal.y0 : Math.floor(fh * 0.15);
  const y1 = cal.y1 != null ? cal.y1 : Math.floor(fh * 0.85);
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);

  const wCentral = x1 - x0;
  const hCentral = y1 - y0;

  let noiseSigma = 5.0;
  if (this.results.stage86 && this.results.stage86.noiseSigma) {
    noiseSigma = this.results.stage86.noiseSigma;
  } else if (this.results.stage85 && this.results.stage85.noiseSigma) {
    noiseSigma = this.results.stage85.noiseSigma;
  }
  this.log(`  System Noise Floor (σ): ${noiseSigma.toFixed(3)} px`);

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

  // Draws a quad-vortex structure (4 corners and a center gradient lens)
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

  const coolAndRefresh = async (ms = 300) => {
    this.showColor('#000000');
    await this.sleep(ms);
  };

  // Run a test with a specific count of quad-vortex elements
  const runTestPattern = async (labelKey, nElements) => {
    this.log(this.t(labelKey));

    // Capture dynamic reference frame immediately before heating
    this.showColor('#000000');
    await this.sleep(450);
    showReferencePattern();
    await this.sleep(150);
    const localColdFrame = await this.captureStable(4, 35);

    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      const ccx = w / 2, ccy = h / 2;
      const size = Math.min(w, h);

      if (nElements === 1) {
        drawElement(ctx, ccx, ccy, size * 0.8, 1);
      } else if (nElements === 2) {
        const dx = w * 0.23;
        drawElement(ctx, ccx - dx, ccy, size * 0.40, 1);
        drawElement(ctx, ccx + dx, ccy, size * 0.40, 1);
      } else if (nElements === 4) {
        const dx = w * 0.23;
        const dy = h * 0.23;
        drawElement(ctx, ccx - dx, ccy - dy, size * 0.40, 1);
        drawElement(ctx, ccx + dx, ccy - dy, size * 0.40, 1);
        drawElement(ctx, ccx - dx, ccy + dy, size * 0.40, 1);
        drawElement(ctx, ccx + dx, ccy + dy, size * 0.40, 1);
      } else if (nElements === 6) {
        const dx = w * 0.23;
        const dy = h * 0.30;
        const sizeS = size * 0.28;
        // Row 1
        drawElement(ctx, ccx - dx, ccy - dy, sizeS, 1);
        drawElement(ctx, ccx + dx, ccy - dy, sizeS, 1);
        // Row 2
        drawElement(ctx, ccx - dx, ccy, sizeS, 1);
        drawElement(ctx, ccx + dx, ccy, sizeS, 1);
        // Row 3
        drawElement(ctx, ccx - dx, ccy + dy, sizeS, 1);
        drawElement(ctx, ccx + dx, ccy + dy, sizeS, 1);
      } else if (nElements === 8) {
        const sizeY = size * 0.20;
        const dx = w * 0.23;
        const dy1 = h * 0.35;
        const dy2 = h * 0.12;
        // Row 1
        drawElement(ctx, ccx - dx, ccy - dy1, sizeY, 1);
        drawElement(ctx, ccx + dx, ccy - dy1, sizeY, 1);
        // Row 2
        drawElement(ctx, ccx - dx, ccy - dy2, sizeY, 1);
        drawElement(ctx, ccx + dx, ccy - dy2, sizeY, 1);
        // Row 3
        drawElement(ctx, ccx - dx, ccy + dy2, sizeY, 1);
        drawElement(ctx, ccx + dx, ccy + dy2, sizeY, 1);
        // Row 4
        drawElement(ctx, ccx - dx, ccy + dy1, sizeY, 1);
        drawElement(ctx, ccx + dx, ccy + dy1, sizeY, 1);
      }
    });

    await this.sleep(1100);
    showReferencePattern();
    await this.sleep(150);
    const frame = await this.captureStable(4, 35);

    const curls = [];
    if (nElements === 1) {
      curls.push(measureElementCurl(localColdFrame, frame, cx, cy, wCentral * 0.8));
    } else if (nElements === 2) {
      const dVal = wCentral * 0.23;
      const sizeX = wCentral * 0.40;
      curls.push(measureElementCurl(localColdFrame, frame, cx - dVal, cy, sizeX));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dVal, cy, sizeX));
    } else if (nElements === 4) {
      const dx = wCentral * 0.23;
      const dy = hCentral * 0.23;
      const sizeX = wCentral * 0.40;
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy - dy, sizeX));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy - dy, sizeX));
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy + dy, sizeX));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy + dy, sizeX));
    } else if (nElements === 6) {
      const dx = wCentral * 0.23;
      const dy = hCentral * 0.30;
      const sizeS = wCentral * 0.28;
      // Row 1
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy - dy, sizeS));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy - dy, sizeS));
      // Row 2
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy, sizeS));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy, sizeS));
      // Row 3
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy + dy, sizeS));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy + dy, sizeS));
    } else if (nElements === 8) {
      const sizeY = wCentral * 0.20;
      const dx = wCentral * 0.23;
      const dy1 = hCentral * 0.35;
      const dy2 = hCentral * 0.12;
      // Row 1
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy - dy1, sizeY));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy - dy1, sizeY));
      // Row 2
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy - dy2, sizeY));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy - dy2, sizeY));
      // Row 3
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy + dy2, sizeY));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy + dy2, sizeY));
      // Row 4
      curls.push(measureElementCurl(localColdFrame, frame, cx - dx, cy + dy1, sizeY));
      curls.push(measureElementCurl(localColdFrame, frame, cx + dx, cy + dy1, sizeY));
    }
    return curls;
  };

  // Helper to evaluate pass criteria for a list of measured element curls
  const evaluateTest = (curls, threshold, minPassCount) => {
    if (curls.length === 0) return false;
    const exceedCount = curls.filter(c => Math.abs(c) > threshold).length;
    return exceedCount >= minPassCount;
  };

  // Run the sequence of sweeps
  const res1 = await runTestPattern('test_1', 1);
  await coolAndRefresh(300);

  const res2 = await runTestPattern('test_2', 2);
  await coolAndRefresh(300);

  const res4 = await runTestPattern('test_4', 4);
  await coolAndRefresh(300);

  const res6 = await runTestPattern('test_6', 6);
  await coolAndRefresh(300);

  const res8 = await runTestPattern('test_8', 8);
  this.showColor('#000000');

  // Evaluate each sweep with dynamic thresholds and min active counts
  const pass1 = evaluateTest(res1, noiseSigma * 0.40, 1);
  const pass2 = evaluateTest(res2, noiseSigma * 0.30, 2);
  const pass4 = evaluateTest(res4, noiseSigma * 0.25, 3);
  const pass6 = evaluateTest(res6, noiseSigma * 0.20, 4);
  const pass8 = evaluateTest(res8, noiseSigma * 0.15, 6);

  let resolvedCount = 0;
  if (pass8) resolvedCount = 8;
  else if (pass6) resolvedCount = 6;
  else if (pass4) resolvedCount = 4;
  else if (pass2) resolvedCount = 2;
  else if (pass1) resolvedCount = 1;

  this.log('\n━━━ MICRO-VORTEX GRID SWEEP RESULTS ━━━');
  this.log(`  1 Element: curls=[${res1.map(v => v.toFixed(1)).join(', ')}] -> ${pass1 ? 'PASSED' : 'FAILED'}`);
  this.log(`  2 Elements: curls=[${res2.map(v => v.toFixed(1)).join(', ')}] -> ${pass2 ? 'PASSED' : 'FAILED'}`);
  this.log(`  4 Elements: curls=[${res4.map(v => v.toFixed(1)).join(', ')}] -> ${pass4 ? 'PASSED' : 'FAILED'}`);
  this.log(`  6 Elements: curls=[${res6.map(v => v.toFixed(1)).join(', ')}] -> ${pass6 ? 'PASSED' : 'FAILED'}`);
  this.log(`  8 Elements: curls=[${res8.map(v => v.toFixed(1)).join(', ')}] -> ${pass8 ? 'PASSED' : 'FAILED'}`);

  const pass = resolvedCount >= 1;
  this.log(pass ? this.t('success', { var0: resolvedCount }) : this.t('fail'), pass ? 'ok' : 'warn');

  this.results.stage88 = {
    method: 'Micro-Vortex Bounding Grid Capacity and Resolution Test',
    noiseSigma: round(noiseSigma),
    capacity: resolvedCount,
    pass,
    res1: { curls: res1.map(round), pass: pass1 },
    res2: { curls: res2.map(round), pass: pass2 },
    res4: { curls: res4.map(round), pass: pass4 },
    res6: { curls: res6.map(round), pass: pass6 },
    res8: { curls: res8.map(round), pass: pass8 }
  };
}

export function render(r) {
  if (r.stage88) {
    try {
      const s = r.stage88;
      this.rv('rv-capacity-val', `${s.capacity} active cells resolved`, s.pass ? 'ok' : 'warn');
      this.rv('rv-capacity-noise', `${s.noiseSigma.toFixed(1)} px`, 'ok');
      const g = document.getElementById('g-s88');
      if (g) {
        g.textContent = s.pass ? `OK: Resolved ${s.capacity} cells` : 'FAIL: No cells resolved';
        g.className = s.pass ? 'grade pass' : 'grade fail';
      }
    } catch (e) {
      console.error('s88 render error:', e);
    }
  }
}

export function check(d) {
  try {
    return d && d.pass;
  } catch (e) {
    return false;
  }
}

export function metric(d) {
  try {
    return `N=${d.capacity || 0}`;
  } catch (e) {
    return '—';
  }
}
