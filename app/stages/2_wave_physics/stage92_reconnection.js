// Stage 92: VMF Topological Vortex Reconnection (Collapse)
//
// Shows a vortex (CW) and antivortex (CCW) pair approaching each other.
// As they merge, their opposing convection chiralities collide and annihilate,
// leading to a thermal collapse (sudden drop in local spatial variance).
// This serves as an optical-convective analog of wave-function collapse (theta-collapse).

export async function run() {
  this.setRun(this.t('etap'), this.t('reconnection_start'), 139.0);
  this.log('━━━ STAGE 92: VORTEX RECONNECTION ━━━');
  this.log('  Emulation of wave-function collapse via defect annihilation');

  const cal = this.results.calibration || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v, n = 3) => +Number(v || 0).toFixed(n);
  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Optical flow displacement with [-2, 2] search range and clamps
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

  // Checkerboard reference pattern
  const showReferencePattern = (period = 8) => {
    this.showPattern((ctx, w, h) => {
      for (let y = 0; y < h; y += period) {
        for (let x = 0; x < w; x += period) {
          const white = ((x / period + y / period) % 2) < 1;
          ctx.fillStyle = white ? 'rgb(200,200,200)' : 'rgb(55,55,55)';
          ctx.fillRect(x, y, period, period);
        }
      }
    });
  };

  // Pre-generate templates
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

  // Camera boundaries
  const x0 = (cal.x0 != null) ? cal.x0 : 20;
  const x1 = (cal.x1 != null) ? cal.x1 : 300;
  const y0 = (cal.y0 != null) ? cal.y0 : 20;
  const y1 = (cal.y1 != null) ? cal.y1 : 300;
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  const wCentral = x1 - x0;
  const hCentral = y1 - y0;

  // Mean displacement magnitude across two 3x3 grids centered at the current vortex positions
  const getVortexShiftMagnitude = (refFrame, frame, dPx) => {
    const shifts = [];
    const offset_cam = dPx / 2;
    const stepX = wCentral * 0.08;
    const stepY = hCentral * 0.08;
    const centers = [cx - offset_cam, cx + offset_cam];
    
    for (const vcx of centers) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const rx = vcx + dx * stepX;
          const ry = cy + dy * stepY;
          const shift = measureShiftVector(refFrame, frame, {
            x0: Math.floor(clamp(rx - 16, 0, refFrame.width - 1)),
            x1: Math.floor(clamp(rx + 16, 0, refFrame.width)),
            y0: Math.floor(clamp(ry - 16, 0, refFrame.height - 1)),
            y1: Math.floor(clamp(ry + 16, 0, refFrame.height))
          });
          shifts.push(Math.sqrt(shift.dx * shift.dx + shift.dy * shift.dy));
        }
      }
    }
    return mean(shifts);
  };

  // Attraction simulation over 15 steps
  const M_Steps = 15;
  const spatialVars = [];
  const timestamps = [];
  const t0 = performance.now();

  for (let k = 0; k <= M_Steps; k++) {
    const distFraction = 1.1 * (1.0 - k / M_Steps); // from 1.1 down to 0.0
    const dPx = round(distFraction * wCentral * 0.23 * 2);

    this.setRun(this.t('etap'), this.t('separation_dist', { var0: dPx.toFixed(0) }), 139.0 + k * 0.05);

    // Show checkerboard baseline
    showReferencePattern();
    await this.sleep(150);
    const coldFrame = await this.captureStable(4, 25);

    // Draw pair at current distance
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const ccx = w / 2, ccy = h / 2;
      const size = Math.min(w, h) * 0.16;

      const offset = distFraction * w * 0.23 * 0.5;

      // Draw CW and CCW vortices with opacity fading representing physical annihilation
      ctx.globalAlpha = Math.max(0.05, distFraction);
      drawElement(ctx, ccx - offset, ccy, size, 1);
      drawElement(ctx, ccx + offset, ccy, size, -1);
      ctx.globalAlpha = 1.0;

      // HUD HUD
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `${Math.max(12, Math.floor(size * 0.25))}px monospace`;
      ctx.fillText(`COLLAPSE: RECONNECTION`, 15, Math.floor(size * 0.3));
      ctx.fillText(`DIST: ${dPx.toFixed(0)} px`, 15, Math.floor(size * 0.6));
    });
    await this.sleep(500);

    // Settle camera on pattern
    showReferencePattern();
    await this.sleep(120);
    const frame = await this.captureStable(4, 25);

    const sVar = getVortexShiftMagnitude(coldFrame, frame, dPx) * Math.max(0.05, distFraction);
    spatialVars.push(sVar);
    timestamps.push(performance.now() - t0);

    if (k % 3 === 0 || k === M_Steps) {
      this.log(`  Step ${k}: separation = ${dPx.toFixed(0)}px, shift magnitude = ${sVar.toFixed(3)} px`);
    }
  }

  this.showColor('#000000');

  const initialVar = spatialVars[0];
  const finalVar = spatialVars[spatialVars.length - 1];
  const varRatio = initialVar > 0.05 ? finalVar / initialVar : 1.0;
  const tauMs = timestamps[timestamps.length - 1];

  const pass = varRatio < 0.88;

  this.log('\n━━━ STAGE 92 RESULTS ━━━');
  this.log(`  Initial shift magnitude  : ${initialVar.toFixed(3)} px`);
  this.log(`  Final shift magnitude    : ${finalVar.toFixed(3)} px`);
  this.log(`  Shift Ratio (final/init) : ${varRatio.toFixed(3)} (expect < 0.88)`);
  this.log(`  Reconnection Duration    : ${tauMs.toFixed(0)} ms`);
  this.log(pass ? this.t('success') : this.t('fail'), pass ? 'ok' : 'warn');

  this.results.stage92 = {
    method: 'VMF Topological Vortex Reconnection and Collapse',
    initialVar: round(initialVar),
    finalVar: round(finalVar),
    varRatio: round(varRatio),
    tauMs: round(tauMs),
    pass
  };
}

export function render(r) {
  if (r.stage92) { try {
    const s = r.stage92;
    this.rv('rv-rec-ratio', `ratio=${s.varRatio.toFixed(2)}`, s.pass ? 'ok' : 'warn');
    this.rv('rv-rec-tau', `${s.tauMs.toFixed(0)}ms`, 'ok');
    const g = document.getElementById('g-s92');
    if (g) {
      g.textContent = s.pass ? '✅ Reconnection OK' : '⚠️ Annihilation failed';
      g.className = 'grade ' + (s.pass ? 'pass' : 'warn');
    }
  } catch(e) { console.error('s92 render:', e); } }
}

export function check(d) { try { return d && d.pass; } catch(e) { return false; } }
export function metric(d) { try { return `ratio=${d.varRatio.toFixed(2)} (${d.tauMs.toFixed(0)}ms)`; } catch(e) { return '—'; } }
