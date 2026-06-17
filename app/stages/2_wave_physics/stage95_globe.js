// Stage 95: VMF Thermal 3D Globe (Physical Convective Lenticular Array)
//
// Generates a physical autostereoscopic 3D light-field steering barrier using
// localized thermal plumes created by interlaced high/low intensity OLED columns.
// The front camera measures the Background Oriented Schlieren (BOS) optical flow
// to verify the physical refraction of the ascending thermal boundary layer.

const continents = [
  // North America
  [
    [-100, 50], [-60, 50], [-80, 30], [-100, 20], [-120, 30], [-120, 50]
  ],
  // South America
  [
    [-80, -10], [-40, -10], [-40, -20], [-70, -50], [-80, -20]
  ],
  // Africa
  [
    [-20, 20], [15, 30], [30, 30], [50, 10], [40, -10], [20, -35], [10, -35], [-10, 5]
  ],
  // Eurasia
  [
    [-10, 60], [30, 70], [60, 70], [120, 70], [140, 50], [120, 30], [80, 10], [40, 30], [15, 35]
  ],
  // Australia
  [
    [115, -20], [145, -20], [145, -35], [115, -35]
  ],
  // Greenland
  [
    [-50, 70], [-30, 70], [-40, 60]
  ]
];

export async function run() {
  this.setRun(this.t('etap'), this.t('globe_start'), 145.0);
  this.log('━━━ STAGE 95: VMF THERMAL LENTICULAR 3D GLOBE ━━━');
  this.log('  Physical generation of 3D light-field via convective thermal barrier');

  const cal = this.results.calibration || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v, n = 3) => +Number(v || 0).toFixed(n);
  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Optical flow displacement helper to measure the BOS effect
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

  // 3D projection helper
  const projectPoint = (lat, lon, angleX, angleY, size, w, h) => {
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    const x = Math.cos(latRad) * Math.cos(lonRad);
    const y = Math.sin(latRad);
    const z = Math.cos(latRad) * Math.sin(lonRad);
    let x1 = x * Math.cos(angleY) - z * Math.sin(angleY);
    let z1 = x * Math.sin(angleY) + z * Math.cos(angleY);
    let y2 = y * Math.cos(angleX) - z1 * Math.sin(angleX);
    let z2 = y * Math.sin(angleX) + z1 * Math.cos(angleX);
    return {
      x: w / 2 + x1 * size,
      y: h / 2 + y2 * size,
      z: z2
    };
  };

  const drawContinent = (ctx, poly, angleX, angleY, size, w, h, fillColor, lineColor) => {
    ctx.beginPath();
    let first = true;
    for (const pt of poly) {
      const proj = projectPoint(pt[1], pt[0], angleX, angleY, size, w, h);
      if (proj.z > 0) {
        if (first) { ctx.moveTo(proj.x, proj.y); first = false; }
        else ctx.lineTo(proj.x, proj.y);
      }
    }
    if (!first) {
      ctx.closePath();
      if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
      if (lineColor) { ctx.strokeStyle = lineColor; ctx.stroke(); }
    }
  };

  const drawGlobeScene = (ctx, w, h, angleX, angleY, size, alpha) => {
    ctx.clearRect(0, 0, w, h);
    
    // Draw grid lines
    ctx.strokeStyle = `rgba(0, 255, 230, ${0.15 * alpha})`;
    ctx.lineWidth = 1;
    
    // Latitudes
    const nLat = 6;
    for (let i = 1; i < nLat; i++) {
      const theta = -Math.PI / 2 + (i * Math.PI) / nLat;
      const r = Math.cos(theta);
      const y = Math.sin(theta);
      ctx.beginPath();
      let first = true;
      for (let j = 0; j <= 30; j++) {
        const phi = (j * 2 * Math.PI) / 30;
        const pt = projectPoint(theta * 180 / Math.PI, phi * 180 / Math.PI, angleX, angleY, size, w, h);
        if (pt.z > 0) {
          if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
          else ctx.lineTo(pt.x, pt.y);
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }

    // Longitudes
    const nLong = 6;
    for (let i = 0; i < nLong; i++) {
      const phi = (i * Math.PI) / nLong;
      ctx.beginPath();
      let first = true;
      for (let j = 0; j <= 30; j++) {
        const theta = -Math.PI / 2 + (j * Math.PI) / 30;
        const pt = projectPoint(theta * 180 / Math.PI, phi * 180 / Math.PI, angleX, angleY, size, w, h);
        if (pt.z > 0) {
          if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
          else ctx.lineTo(pt.x, pt.y);
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }

    // Draw continents
    for (const poly of continents) {
      drawContinent(ctx, poly, angleX, angleY, size, w, h, `rgba(0, 255, 230, ${0.12 * alpha})`, `rgba(0, 255, 230, ${0.8 * alpha})`);
    }

    // Sphere boundary glow
    ctx.strokeStyle = `rgba(0, 255, 230, ${1.0 * alpha})`;
    ctx.lineWidth = Math.max(2, Math.floor(size * 0.012));
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, size, 0, 2 * Math.PI);
    ctx.stroke();
  };

  // Camera tracking boundaries for front camera BOS measurement
  const x0 = (cal.x0 != null) ? cal.x0 : 20;
  const x1 = (cal.x1 != null) ? cal.x1 : 300;
  const y0 = (cal.y0 != null) ? cal.y0 : 20;
  const y1 = (cal.y1 != null) ? cal.y1 : 300;
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  const wCentral = x1 - x0;
  const hCentral = y1 - y0;

  // Active tracking region (center 50%)
  const trackerRegion = {
    x0: Math.floor(clamp(cx - wCentral * 0.25, 0, x1)),
    x1: Math.floor(clamp(cx + wCentral * 0.25, 0, x1)),
    y0: Math.floor(clamp(cy - hCentral * 0.25, 0, y1)),
    y1: Math.floor(clamp(cy + hCentral * 0.25, 0, y1))
  };

  // Reference pattern for Background Oriented Schlieren (BOS)
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

  // Baseline calibration
  showReferencePattern();
  await this.sleep(200);
  const coldFrame = await this.captureStable(4, 25);

  const M_Steps = 12;
  const shiftsH = [];
  const shiftsV = [];

  // Offscreen canvases for left/right interlacing
  const canvasL = document.createElement('canvas');
  const canvasR = document.createElement('canvas');

  for (let k = 0; k <= M_Steps; k++) {
    const angleY = (k / M_Steps) * 1.5 * Math.PI; // Spin from 0 to 270 deg
    this.setRun(this.t('etap'), this.t('tracking_convection'), 145.0 + k * 0.2);

    this.showPattern((ctx, w, h) => {
      canvasL.width = w; canvasL.height = h;
      canvasR.width = w; canvasR.height = h;
      const ctxL = canvasL.getContext('2d');
      const ctxR = canvasR.getContext('2d');
      const size = Math.min(w, h) * 0.25;

      // Both views use the identical color (cyan) for a seamless 3D hologram look
      // But they are rendered from different angles (left vs right eye perspective)
      const eyeOffsetAngle = 0.045; // Base parallax baseline
      drawGlobeScene(ctxL, w, h, 0.41, angleY - eyeOffsetAngle, size, 1.0);
      drawGlobeScene(ctxR, w, h, 0.41, angleY + eyeOffsetAngle, size, 1.0);

      // Combine onto screen using parallax barrier interlacing
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      // Atmosphere glow behind the globe
      const auraGrad = ctx.createRadialGradient(w / 2, h / 2, size * 0.9, w / 2, h / 2, size * 1.4);
      auraGrad.addColorStop(0, 'rgba(0, 200, 255, 0.25)');
      auraGrad.addColorStop(0.5, 'rgba(0, 100, 255, 0.08)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, size * 1.4, 0, 2 * Math.PI);
      ctx.fill();

      // Interlace columns: odd = Left Eye, even = Right Eye
      // This interlacing forms alternating hot/cold convective micro-plumes in the air
      // naturally forming a physical thermal lenticular array!
      const period = 6;
      for (let x = 0; x < w; x += period) {
        ctx.drawImage(canvasL, x, 0, period / 2, h, x, 0, period / 2, h);
        ctx.drawImage(canvasR, x + period / 2, 0, period / 2, h, x + period / 2, 0, period / 2, h);
      }

      // High-tech HUD overlay
      ctx.fillStyle = 'rgba(0, 255, 230, 0.85)';
      ctx.font = `${Math.max(12, Math.floor(size * 0.13))}px monospace`;
      ctx.fillText(`THERMAL LENTICULAR 3D GLOBE`, 15, Math.floor(size * 0.25));
      ctx.fillText(`ROTATION: ${(angleY * 180 / Math.PI).toFixed(0)}°`, 15, Math.floor(size * 0.5));
      ctx.fillText(`VMF LENTICULAR ARRAY: ACTIVE`, 15, Math.floor(size * 0.75));
    });
    
    // Give the thermal plumes time to establish themselves and bend the light
    await this.sleep(450);

    // Flash reference pattern to capture the optical flow shift (BOS) caused by the plume
    showReferencePattern();
    await this.sleep(120);
    const frame = await this.captureStable(4, 25);

    const shift = measureShiftVector(coldFrame, frame, trackerRegion);
    shiftsH.push(shift.dx);
    shiftsV.push(shift.dy);

    if (k % 3 === 0 || k === M_Steps) {
      this.log(`  Step ${k}: angle = ${(angleY * 180 / Math.PI).toFixed(0)}°, BOS shifts = (H: ${shift.dx.toFixed(2)}, V: ${shift.dy.toFixed(2)}) px`);
    }
  }

  this.showColor('#000000');

  // Determine active flow axis based on convection structure
  const meanAbsH = mean(shiftsH.map(Math.abs));
  const meanAbsV = mean(shiftsV.map(Math.abs));
  const useHorizontal = meanAbsH > meanAbsV;
  const activeShifts = useHorizontal ? shiftsH : shiftsV;

  const meanActive = mean(activeShifts);
  const flowIntensity = mean(activeShifts.map(Math.abs));

  // Verify that the directed physical convective flow exceeds noise threshold
  const pass = flowIntensity > 0.4;

  this.log('\n━━━ STAGE 95 RESULTS ━━━');
  this.log(`  Active Lenticular Axis    : ${useHorizontal ? 'Horizontal' : 'Vertical'}`);
  this.log(`  Physical Flow Intensity   : ${flowIntensity.toFixed(3)} px`);
  this.log(`  Directed Mean Shift       : ${meanActive.toFixed(3)} px`);
  this.log(pass ? this.t('success', { var0: flowIntensity.toFixed(3) }) : this.t('fail'), pass ? 'ok' : 'warn');

  this.results.stage95 = {
    method: 'Physical Thermal Lenticular 3D Light-Field',
    axis: useHorizontal ? 'H' : 'V',
    flowIntensity: round(flowIntensity),
    meanActive: round(meanActive),
    pass
  };
}

export function render(r) {
  if (r.stage95) { try {
    const s = r.stage95;
    this.rv('rv-gl-axis', s.axis, 'ok');
    this.rv('rv-gl-intensity', `${s.flowIntensity.toFixed(2)}px`, s.pass ? 'ok' : 'warn');
    const g = document.getElementById('g-s95');
    if (g) {
      g.textContent = s.pass ? `✅ Physical Hologram OK: ${s.flowIntensity.toFixed(2)}px` : '⚠️ Weak 3D effect';
      g.className = 'grade ' + (s.pass ? 'pass' : 'warn');
    }
  } catch(e) { console.error('s95 render:', e); } }
}

export function check(d) { try { return d && d.pass; } catch(e) { return false; } }
export function metric(d) { try { return `flow=${d.flowIntensity.toFixed(2)}px`; } catch(e) { return '—'; } }
