// Stage 86: Qutrit Optical Router (Оптический роутер на кутрите)
// Demonstrates light routing along a three-channel Psi-waveguide using convective vortex-lensing.

export async function run() {
  this.setRun(this.t('etap'), this.t('router_start'), 146.0);
  this.log('━━━ STAGE 86: QUTRIT OPTICAL ROUTER ━━━');

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

  // Reference grid
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

  // Optical flow / shift vector measurement
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

  const drawState0 = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const size = Math.min(w, h);
    const br = 255;
    const rLens = size * 0.12;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rLens);
    grad.addColorStop(0, `rgba(${br},${br},${br},1)`);
    grad.addColorStop(1, `rgba(${br},${br},${br},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rLens, 0, 2 * Math.PI);
    ctx.fill();
  };

  const drawQuadVortexLensing = (targetHandedness) => {
    return (ctx, w, h) => {
      const cx = w / 2, cy = h / 2;
      const size = Math.min(w, h);
      const br = 255;
      const targetHand = targetHandedness || 1;

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

      const rLens = size * 0.12;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rLens);
      grad.addColorStop(0, `rgba(${br},${br},${br},1)`);
      grad.addColorStop(1, `rgba(${br},${br},${br},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rLens, 0, 2 * Math.PI);
      ctx.fill();
    };
  };

  const drawWaveguideWithSignal = (stateId) => {
    return (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      if (stateId === 0) {
        drawState0(ctx, w, h);
      } else {
        drawQuadVortexLensing(stateId === 1 ? 1 : -1)(ctx, w, h);
      }
    };
  };

  // Settle cold frame
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

  const centralQuadrants = {
    top: { x0: cx - wCentral * 0.15, x1: cx + wCentral * 0.15, y0: cy - hCentral * 0.15, y1: cy },
    right: { x0: cx, x1: cx + wCentral * 0.15, y0: cy - hCentral * 0.15, y1: cy + hCentral * 0.15 },
    bottom: { x0: cx - wCentral * 0.15, x1: cx + wCentral * 0.15, y0: cy, y1: cy + hCentral * 0.15 },
    left: { x0: cx - wCentral * 0.15, x1: cx, y0: cy - hCentral * 0.15, y1: cy + hCentral * 0.15 }
  };

  const centralRegion = {
    x0: cx - wCentral * 0.15,
    x1: cx + wCentral * 0.15,
    y0: cy - hCentral * 0.15,
    y1: cy + hCentral * 0.15
  };

  let noiseSigma = 5.0;
  if (this.results.stage85 && this.results.stage85.noiseSigma) {
    noiseSigma = this.results.stage85.noiseSigma;
  } else if (this.results.stage84 && this.results.stage84.noiseSigma) {
    noiseSigma = this.results.stage84.noiseSigma;
  }
  this.log(`  System Noise Floor (σ): ${noiseSigma.toFixed(3)} px`);

  const coolAndRefresh = async (ms = 300) => {
    this.showColor('#000000');
    await this.sleep(ms);
  };

  const routeChannel = async (stateId, labelKey) => {
    this.log(this.t(labelKey));
    this.showPattern(drawWaveguideWithSignal(stateId));
    await this.sleep(1100);
    showReferencePattern();
    await this.sleep(150);
    const frame = await this.captureStable(4, 35);

    const top = measureShiftVector(coldFrame, frame, centralQuadrants.top);
    const right = measureShiftVector(coldFrame, frame, centralQuadrants.right);
    const bottom = measureShiftVector(coldFrame, frame, centralQuadrants.bottom);
    const left = measureShiftVector(coldFrame, frame, centralQuadrants.left);
    const cShift = measureShiftVector(coldFrame, frame, centralRegion);

    const curl = round(top.dx + right.dy - bottom.dx - left.dy);
    const mag = round(cShift.mag);
    return { curl, mag };
  };

  // Route 1: Left (|1>)
  const r1 = await routeChannel(1, 'route_left');
  await coolAndRefresh(300);

  // Route 2: Center (|0>)
  const r0 = await routeChannel(0, 'route_center');
  await coolAndRefresh(300);

  // Route 3: Right (|2>)
  const r2 = await routeChannel(2, 'route_right');

  this.showColor('#000000');

  const curl0 = r0.curl;
  const curl1 = r1.curl;
  const curl2 = r2.curl;

  const orderCorrect = (curl1 > curl0 && curl0 > curl2) || (curl2 > curl0 && curl0 > curl1);
  const delta12 = round(Math.abs(curl1 - curl2));
  const isSeparable = delta12 > 2 * noiseSigma;
  const pass = orderCorrect && isSeparable;

  this.log('\n━━━ ROUTER SEPARATION ━━━');
  this.log(`  Left channel curl   : ${curl1.toFixed(3)} px`);
  this.log(`  Center channel curl : ${curl0.toFixed(3)} px`);
  this.log(`  Right channel curl  : ${curl2.toFixed(3)} px`);
  this.log(`  Channel crosstalk separation: ${delta12.toFixed(3)} px (${(delta12/noiseSigma).toFixed(2)}σ)`);
  this.log(pass ? this.t('success') : this.t('fail'), pass ? 'ok' : 'warn');

  this.results.stage86 = {
    method: 'Three-way Qutrit Convective Waveguide Router',
    noiseSigma: round(noiseSigma),
    curl0: round(curl0),
    curl1: round(curl1),
    curl2: round(curl2),
    delta12: round(delta12),
    sigmaSeparation: round(delta12 / noiseSigma, 2),
    orderCorrect,
    isSeparable,
    pass
  };
}

export function render(r) {
  if (r.stage86) {
    try {
      const s = r.stage86;
      this.rv('rv-router-delta', `${s.delta12.toFixed(2)}px (${s.sigmaSeparation.toFixed(1)}σ)`, s.isSeparable ? 'ok' : 'warn');
      const label = s.orderCorrect ? (s.curl1 > s.curl2 ? 'Correct Routing (|1⟩→L, |0⟩→C, |2⟩→R)' : 'Correct Routing (|2⟩→L, |0⟩→C, |1⟩→R)') : 'Incorrect';
      this.rv('rv-router-order', label, s.orderCorrect ? 'ok' : 'warn');
      const g = document.getElementById('g-s86');
      if (g) {
        g.textContent = s.pass ? 'OK: Waveguide routing resolved' : 'FAIL: Poor channel separation';
        g.className = s.pass ? 'grade pass' : 'grade fail';
      }
    } catch (e) {
      console.error('s86 render error:', e);
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
    return `Δ=${(d.delta12 || 0).toFixed(1)}px (${(d.sigmaSeparation || 0).toFixed(1)}σ)`;
  } catch (e) {
    return '—';
  }
}
