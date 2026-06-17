// Stage 87: Topological Braiding Gate & Memory (Топологическое косоплетение)
// Emulates topological quantum braids by dynamically rotating vortex spots on the OLED screen,
// measuring the resulting thermal memory loop (hysteresis).

export async function run() {
  this.setRun(this.t('etap'), this.t('braiding_start'), 147.0);
  this.log('━━━ STAGE 87: TOPOLOGICAL BRAIDING GATE ━━━');

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

  const drawBraiding = (theta_rot, targetHandedness) => {
    return (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const size = Math.min(w, h);
      const br = 255;
      const targetHand = targetHandedness || 1;

      // Draw offscreen spirals
      const spSize = 256;
      const offCCW = document.createElement('canvas');
      offCCW.width = spSize; offCCW.height = spSize;
      const ctxCCW = offCCW.getContext('2d');
      const imgCCW = ctxCCW.createImageData(spSize, spSize);

      const offCW = document.createElement('canvas');
      offCW.width = spSize; offCW.height = spSize;
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

      const dist = size * 0.23 * Math.sqrt(2); // distance to corners
      const rSize = size * 0.40;

      // Rotated corner coordinates
      const xTR = cx + dist * Math.cos(Math.PI/4 + theta_rot);
      const yTR = cy + dist * Math.sin(Math.PI/4 + theta_rot);

      const xTL = cx + dist * Math.cos(3*Math.PI/4 + theta_rot);
      const yTL = cy + dist * Math.sin(3*Math.PI/4 + theta_rot);

      const xBL = cx + dist * Math.cos(-3*Math.PI/4 + theta_rot);
      const yBL = cy + dist * Math.sin(-3*Math.PI/4 + theta_rot);

      const xBR = cx + dist * Math.cos(-Math.PI/4 + theta_rot);
      const yBR = cy + dist * Math.sin(-Math.PI/4 + theta_rot);

      // Alternate handedness corners
      const canvasTR = targetHand === 1 ? offCW : offCCW;
      ctx.drawImage(canvasTR, xTR - rSize / 2, yTR - rSize / 2, rSize, rSize);

      const canvasTL = targetHand === 1 ? offCCW : offCW;
      ctx.drawImage(canvasTL, xTL - rSize / 2, yTL - rSize / 2, rSize, rSize);

      const canvasBL = targetHand === 1 ? offCW : offCCW;
      ctx.drawImage(canvasBL, xBL - rSize / 2, yBL - rSize / 2, rSize, rSize);

      const canvasBR = targetHand === 1 ? offCCW : offCW;
      ctx.drawImage(canvasBR, xBR - rSize / 2, yBR - rSize / 2, rSize, rSize);

      // Central gradient lens
      const rLens = size * 0.12;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rLens);
      grad.addColorStop(0, `rgba(${br},${br},${br},1)`);
      grad.addColorStop(1, `rgba(${br},${br},${br},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rLens, 0, 2 * Math.PI);
      ctx.fill();

      // Draw braiding path ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, dist, 0, 2 * Math.PI);
      ctx.stroke();

      // Outer boundary
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, dist + rSize/2, 0, 2 * Math.PI);
      ctx.stroke();
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

  let noiseSigma = 5.0;
  if (this.results.stage85 && this.results.stage85.noiseSigma) {
    noiseSigma = this.results.stage85.noiseSigma;
  } else if (this.results.stage84 && this.results.stage84.noiseSigma) {
    noiseSigma = this.results.stage84.noiseSigma;
  }

  const coolAndRefresh = async (ms = 900) => {
    this.showColor('#000000');
    await this.sleep(ms);
  };

  const measureAngle = async (angle, hand) => {
    this.showPattern(drawBraiding(angle, hand));
    await this.sleep(800); // dynamic heating step (increased to 800ms for stable convective flow)
    showReferencePattern();
    await this.sleep(120);
    const frame = await this.captureStable(3, 35);
    const top = measureShiftVector(coldFrame, frame, centralQuadrants.top);
    const right = measureShiftVector(coldFrame, frame, centralQuadrants.right);
    const bottom = measureShiftVector(coldFrame, frame, centralQuadrants.bottom);
    const left = measureShiftVector(coldFrame, frame, centralQuadrants.left);
    return round(top.dx + right.dy - bottom.dx - left.dy);
  };

  // 1. CW Loop (0 -> pi/2 -> pi)
  this.log(this.t('weaving_cw'));
  const cw0 = await measureAngle(0, 1);
  const cw1 = await measureAngle(Math.PI / 2, 1);
  const cw2 = await measureAngle(Math.PI, 1);

  // 2. CCW Loop (pi -> pi/2 -> 0) - continuous without cooling to measure true convective hysteresis loop
  this.log(this.t('weaving_ccw'));
  const ccw2 = await measureAngle(Math.PI, 1);
  const ccw1 = await measureAngle(Math.PI / 2, 1);
  const ccw0 = await measureAngle(0, 1);

  this.showColor('#000000');

  // Hysteresis calculation: difference at intermediate state due to lag/thermal memory
  const hysteresisArea = round(Math.abs(cw1 - ccw1));
  const pass = hysteresisArea > noiseSigma * 0.25;

  this.log('\n━━━ TOPOLOGICAL HYSTERESIS ━━━');
  this.log(`  CW Loop at π/2  : ${cw1.toFixed(3)} px`);
  this.log(`  CCW Loop at π/2 : ${ccw1.toFixed(3)} px`);
  this.log(this.t('braiding_hysteresis', { var0: hysteresisArea.toFixed(3) }));
  this.log(pass ? this.t('success') : this.t('fail'), pass ? 'ok' : 'warn');

  this.results.stage87 = {
    method: 'Topological Braiding & Thermal Memory Loop',
    noiseSigma: round(noiseSigma),
    cwValue: round(cw1),
    ccwValue: round(ccw1),
    hysteresisArea: round(hysteresisArea),
    sigmaMemory: round(hysteresisArea / noiseSigma, 2),
    pass
  };
}

export function render(r) {
  if (r.stage87) {
    try {
      const s = r.stage87;
      this.rv('rv-braiding-hyst', `${s.hysteresisArea.toFixed(2)}px (${s.sigmaMemory.toFixed(1)}σ)`, s.pass ? 'ok' : 'warn');
      const g = document.getElementById('g-s87');
      if (g) {
        g.textContent = s.pass ? 'OK: Topological memory loop detected' : 'FAIL: No hysteresis detected';
        g.className = s.pass ? 'grade pass' : 'grade fail';
      }
    } catch (e) {
      console.error('s87 render error:', e);
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
    return `H=${(d.hysteresisArea || 0).toFixed(1)}px (${(d.sigmaMemory || 0).toFixed(1)}σ)`;
  } catch (e) {
    return '—';
  }
}
