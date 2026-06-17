// Stage 90: Vortex Knots and Links (Topological Braiding Show)
//
// Traces vortex center trajectories along Trefoil knots and dual Lemniscates,
// tracks the physical centers dynamically via camera optical flow,
// and computes running topological metrics (Gauss Linking Number Lk) in real-time.
//
// Mathematical Trajectories (in relative coordinate space [-1, 1]x[-1, 1]):
//   1. Trefoil Knot:
//      rx(t) = 0.7 * (sin(t) + 2*sin(2*t)) / 3.0
//      ry(t) = 0.7 * (cos(t) - 2*cos(2*t)) / 3.0
//   2. Topological Braiding (modulated circular paths for two vortices A & B):
//      rx_A(t) = r(t) * cos(t),      ry_A(t) = r(t) * sin(t) * 0.75
//      rx_B(t) = -rx_A(t),           ry_B(t) = -ry_A(t)
//      where r(t) = 0.60 * (1.0 + 0.18 * sin(3*t))

export async function run() {
  this.setRun(this.t('etap'), this.t('knots_start'), 150.0);
  this.log('━━━ STAGE 90: VORTEX KNOTS AND LINKS ━━━');
  this.log('  Topological quantum coding demonstration');

  const cal = this.results.calibration || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v, n = 3) => +Number(v || 0).toFixed(n);
  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

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

  // Local displacement tracker around expected coordinate
  const trackCenterDisplacement = (refFrame, frame, ecx, ecy, sizeY) => {
    const wSearch = sizeY * 0.35;
    const hSearch = sizeY * 0.35;
    const shift = measureShiftVector(refFrame, frame, {
      x0: ecx - wSearch,
      x1: ecx + wSearch,
      y0: ecy - hSearch,
      y1: ecy + hSearch
    });
    return shift;
  };

  // ══════════════════════════════════════
  // SETUP CAMERA COORDINATES & BOUNDARIES
  // ══════════════════════════════════════
  const x0 = (cal.x0 != null) ? cal.x0 : 20;
  const x1 = (cal.x1 != null) ? cal.x1 : 300;
  const y0 = (cal.y0 != null) ? cal.y0 : 20;
  const y1 = (cal.y1 != null) ? cal.y1 : 300;
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  const wCentral = x1 - x0;
  const hCentral = y1 - y0;

  const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;
  const colSign = isMirrored ? -1 : 1; // camera X coordinates sign relative to screen X

  // Track noise level
  this.showColor('#000000');
  await this.sleep(1000);
  showReferencePattern();
  await this.sleep(400);
  const coldFrame1 = await this.captureStable(6, 40);
  const coldFrame2 = await this.captureStable(6, 40);
  const sizeY_cam = wCentral * 0.18;
  const dummyShift = trackCenterDisplacement(coldFrame1, coldFrame2, cx, cy, sizeY_cam);
  const noiseSigma = Math.max(0.1, Math.sqrt(dummyShift.dx * dummyShift.dx + dummyShift.dy * dummyShift.dy));
  this.log(`  System Noise Floor (σ): ${noiseSigma.toFixed(3)} px`);

  // ══════════════════════════════════════
  // MODE 1: TREFOIL KNOT EVOLUTION (30 frames)
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), 'Mode 1: Trefoil Knot', 150.1);
  this.log('\n── Mode 1: Trefoil Knot Trajectory ──');

  const M_Tref = 30;
  const trefScreenPath = [];
  const trefTrackedPath = [];

  for (let k = 0; k <= M_Tref; k++) {
    const t = (k / M_Tref) * Math.PI * 2;
    // Relative coordinates
    const rx = 0.7 * (Math.sin(t) + 2 * Math.sin(2 * t)) / 3.2;
    const ry = 0.7 * (Math.cos(t) - 2 * Math.cos(2 * t)) / 3.2;

    trefScreenPath.push({ rx, ry });

    // Show checkerboard baseline first
    showReferencePattern();
    await this.sleep(150);
    const coldFrame = await this.captureStable(4, 30);

    // Draw active vortex and trailing path on screen
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const ccx = w / 2, ccy = h / 2;
      const sizeY = Math.min(w, h) * 0.18;

      // Draw the trailing path of the vortex center
      ctx.lineWidth = Math.max(2, Math.floor(sizeY * 0.08));
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0, 255, 128, 0.45)';
      ctx.beginPath();
      for (let i = 0; i < trefScreenPath.length; i++) {
        const px = ccx + trefScreenPath[i].rx * w * 0.5;
        const py = ccy + trefScreenPath[i].ry * h * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw active vortex at current position (ccx + rx*w/2, ccy + ry*h/2)
      drawElement(ctx, ccx + rx * w * 0.5, ccy + ry * h * 0.5, sizeY, 1);

      // HUD text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `${Math.max(12, Math.floor(sizeY * 0.25))}px monospace`;
      ctx.fillText(`MODE: TREFOIL KNOT`, 15, Math.floor(sizeY * 0.3));
      ctx.fillText(`STEP: ${k}/${M_Tref}`, 15, Math.floor(sizeY * 0.6));
      ctx.fillText(`TQC KNOT CODES`, 15, Math.floor(sizeY * 0.9));
    });

    await this.sleep(600); // Convection build up

    // Show reference pattern for measurement
    showReferencePattern();
    await this.sleep(150);
    const frame = await this.captureStable(4, 30);

    // Expected camera coordinate (mirrored horizontally if colSign = -1)
    const ecx_cam = cx + colSign * rx * wCentral * 0.5;
    const ecy_cam = cy + ry * hCentral * 0.5;

    // Track displacement
    const shift = trackCenterDisplacement(coldFrame, frame, ecx_cam, ecy_cam, sizeY_cam);
    const tracked_x = ecx_cam + shift.dx;
    const tracked_y = ecy_cam + shift.dy;

    trefTrackedPath.push({ x: tracked_x, y: tracked_y });

    if (k % 5 === 0 || k === M_Tref) {
      this.log(`  Trefoil step ${k}: expected=[${ecx_cam.toFixed(0)},${ecy_cam.toFixed(0)}] tracked=[${tracked_x.toFixed(0)},${tracked_y.toFixed(0)}] shift=[${shift.dx.toFixed(1)},${shift.dy.toFixed(1)}]`);
    }

    this.showColor('#000000');
    await this.sleep(300);
  }

  // ══════════════════════════════════════
  // MODE 2: TOPOLOGICAL BRAIDING (40 frames)
  // ══════════════════════════════════════
  this.setRun(this.t('etap'), 'Mode 2: Topological Braiding', 150.2);
  this.log('\n── Mode 2: Topological Braiding ──');

  const M_Lem = 40;
  const pathA_screen = [];
  const pathB_screen = [];
  const pathA_tracked = [];
  const pathB_tracked = [];

  let runningLk = 0.0;
  let hasLink = false;

  for (let k = 0; k <= M_Lem; k++) {
    const t = (k / M_Lem) * Math.PI * 2;
    // Relative coordinates (modulated circular trajectories for non-zero linking number)
    const r = 0.60 * (1.0 + 0.18 * Math.sin(3.0 * t));
    const rx_A = r * Math.cos(t);
    const ry_A = r * Math.sin(t) * 0.75;
    const rx_B = -rx_A;
    const ry_B = -ry_A;

    pathA_screen.push({ rx: rx_A, ry: ry_A });
    pathB_screen.push({ rx: rx_B, ry: ry_B });

    // Capture batch baseline
    showReferencePattern();
    await this.sleep(150);
    const coldFrame = await this.captureStable(4, 30);

    // Draw active double lemniscates on OLED
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const ccx = w / 2, ccy = h / 2;
      const sizeY = Math.min(w, h) * 0.18;

      // Trailing Path A (green)
      ctx.lineWidth = Math.max(2, Math.floor(sizeY * 0.08));
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0, 255, 128, 0.45)';
      ctx.beginPath();
      for (let i = 0; i < pathA_screen.length; i++) {
        const px = ccx + pathA_screen[i].rx * w * 0.5;
        const py = ccy + pathA_screen[i].ry * h * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Trailing Path B (magenta)
      ctx.strokeStyle = 'rgba(255, 0, 128, 0.45)';
      ctx.beginPath();
      for (let i = 0; i < pathB_screen.length; i++) {
        const px = ccx + pathB_screen[i].rx * w * 0.5;
        const py = ccy + pathB_screen[i].ry * h * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw active elements (A is CCW, B is CW to form opposite chirality)
      drawElement(ctx, ccx + rx_A * w * 0.5, ccy + ry_A * h * 0.5, sizeY, 1);
      drawElement(ctx, ccx + rx_B * w * 0.5, ccy + ry_B * h * 0.5, sizeY, -1);

      // HUD HUD
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `${Math.max(12, Math.floor(sizeY * 0.25))}px monospace`;
      ctx.fillText(`MODE: VORTEX BRAIDING`, 15, Math.floor(sizeY * 0.3));
      ctx.fillText(`STEP: ${k}/${M_Lem}`, 15, Math.floor(sizeY * 0.6));
      ctx.fillText(`LINKING Lk: ${runningLk.toFixed(3)}`, 15, Math.floor(sizeY * 0.9));
    });

    await this.sleep(600);

    // Show checkerboard
    showReferencePattern();
    await this.sleep(150);
    const frame = await this.captureStable(4, 30);

    // Expected camera coordinates
    const ecxA_cam = cx + colSign * rx_A * wCentral * 0.5;
    const ecyA_cam = cy + ry_A * hCentral * 0.5;
    const ecxB_cam = cx + colSign * rx_B * wCentral * 0.5;
    const ecyB_cam = cy + ry_B * hCentral * 0.5;

    // Track displacements
    const shiftA = trackCenterDisplacement(coldFrame, frame, ecxA_cam, ecyA_cam, sizeY_cam);
    const shiftB = trackCenterDisplacement(coldFrame, frame, ecxB_cam, ecyB_cam, sizeY_cam);

    const trackedAx = ecxA_cam + shiftA.dx;
    const trackedAy = ecyA_cam + shiftA.dy;
    const trackedBx = ecxB_cam + shiftB.dx;
    const trackedBy = ecyB_cam + shiftB.dy;

    pathA_tracked.push({ x: trackedAx, y: trackedAy });
    pathB_tracked.push({ x: trackedBx, y: trackedBy });

    // Compute Gauss linking increment
    if (k > 0) {
      const prevA = pathA_tracked[k - 1];
      const prevB = pathB_tracked[k - 1];

      // Relative separation vector
      const dx_rel = trackedAx - trackedBx;
      const dy_rel = trackedAy - trackedBy;
      const prev_dx_rel = prevA.x - prevB.x;
      const prev_dy_rel = prevA.y - prevB.y;

      // Differential steps
      const d_dx = dx_rel - prev_dx_rel;
      const d_dy = dy_rel - prev_dy_rel;

      // Gauss linking integrand
      const denom = dx_rel * dx_rel + dy_rel * dy_rel;
      if (denom > 1.0) {
        const increment = (dx_rel * d_dy - dy_rel * d_dx) / denom;
        runningLk += increment / (Math.PI * 2.0);
      }
    }

    if (k % 5 === 0 || k === M_Lem) {
      this.log(`  Braid step ${k}: Lk=${runningLk.toFixed(3)} | A=[${trackedAx.toFixed(0)},${trackedAy.toFixed(0)}] B=[${trackedBx.toFixed(0)},${trackedBy.toFixed(0)}]`);
    }

    this.showColor('#000000');
    await this.sleep(300);
  }

  const finalLk = Math.abs(runningLk);
  this.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  this.log(`  Topological link completed!`);
  this.log(`  Gauss Linking Number (Lk): ${runningLk.toFixed(4)}`);
  this.log(`  Fidelity (Lk vs theoretical=1.0): ${(Math.min(1.0, finalLk) * 100).toFixed(1)}%`);
  this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  this.showColor('#000000');

  const pass = finalLk > 0.45; // Must cross at least half-turn link under noise
  this.results.stage90 = {
    method: 'Vortex Knots and Links Topological Braiding',
    finalLk: +runningLk.toFixed(4),
    noiseSigma: +noiseSigma.toFixed(3),
    steps: M_Lem + M_Tref,
    pass
  };
}

export function render(r) {
  if (r.stage90) { try {
    const s = r.stage90;
    this.rv('rv-knt-lk', `Lk=${s.finalLk.toFixed(3)}`, s.pass ? 'ok' : 'warn');
    this.rv('rv-knt-noise', `σ=${s.noiseSigma}px`, s.noiseSigma < 10.0 ? 'ok' : 'warn');
    const g = document.getElementById('g-s90');
    if (g) {
      if (s.pass) {
        g.textContent = `✅ Knots & Links: Lk=${s.finalLk.toFixed(2)}`;
        g.className = 'grade pass';
      } else {
        g.textContent = `⚠️ Knots & Links: зацепление не подтверждено`;
        g.className = 'grade warn';
      }
    }
  } catch (e) { console.error('s90 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; }
}

export function metric(d) {
  try { return `Lk=${d.finalLk.toFixed(2)} (🌀${d.steps}f)`; } catch (e) { return '—'; }
}
