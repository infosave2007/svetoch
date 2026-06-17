// Stage 83: real aerosol 3D globe with camera statistics
//
// OLED emits 24 high-contrast sphere slices. Water aerosol above the screen
// scatters them into a visible volume, while the camera records real slice
// contrast, centroid/radius deviations, and a final BOS reference shift.

export async function run() {
  this.setRun(this.t('etap'), this.t('holo_start'), 105.0);
  this.log('━━━ STAGE 83: AEROSOL 3D GLOBE + CAMERA STATS ━━━');
  this.log('  Output is formed in aerosol above the glass, not as a screen-only globe.');

  const cal = this.results.calibration || {};
  const sliceCount = 24;
  const oledHz = 120;
  const frameMs = 1000 / oledHz;
  const globeRadiusMm = 15;
  const globeHeightMm = globeRadiusMm * 2;
  const sliceDzMm = globeHeightMm / sliceCount;
  const runDurationMs = 60000;

  const clampRegion = (frame, region) => ({
    x0: Math.max(0, Math.min(frame.width - 1, Math.floor(region.x0))),
    x1: Math.max(0, Math.min(frame.width, Math.floor(region.x1))),
    y0: Math.max(0, Math.min(frame.height - 1, Math.floor(region.y0))),
    y1: Math.max(0, Math.min(frame.height, Math.floor(region.y1)))
  });

  const showReferencePattern = () => {
    this.showPattern((ctx, w, h) => {
      const period = 4;
      for (let y = 0; y < h; y += period) {
        for (let x = 0; x < w; x += period) {
          const white = ((x / period + y / period) % 2) < 1;
          ctx.fillStyle = white ? 'rgb(205,205,205)' : 'rgb(45,45,45)';
          ctx.fillRect(x, y, period, period);
        }
      }
    });
  };

  const drawAerosolSlice = (ctx, w, h, t, sliceIndex, options = {}) => {
    const cx = w * 0.5;
    const cy = h * 0.54;
    const radiusPx = Math.min(w, h) * 0.34;
    const phase = ((sliceIndex % sliceCount) + 0.5) / sliceCount;
    const z = -1 + 2 * phase;
    const sliceRadius = radiusPx * Math.sqrt(Math.max(0, 1 - z * z));
    const rotation = t * 0.85;
    const gray = sliceIndex ^ (sliceIndex >> 1);
    const marker = Math.max(14, Math.min(w, h) * 0.028);
    const calibrationMode = options.calibrationMode === true;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = ((gray >> i) & 1) ? '#ffffff' : '#06233a';
      ctx.fillRect(10 + i * marker * 1.35, 10, marker, marker);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w - marker - 10, 10, marker, marker);
    ctx.fillRect(10, h - marker - 10, marker, marker);

    const plume = ctx.createRadialGradient(cx, cy, radiusPx * 0.08, cx, cy, radiusPx * 1.9);
    plume.addColorStop(0, calibrationMode ? 'rgba(0, 90, 135, 0.10)' : 'rgba(0, 85, 130, 0.16)');
    plume.addColorStop(0.65, 'rgba(0, 25, 55, 0.07)');
    plume.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = plume;
    ctx.fillRect(0, 0, w, h);

    ctx.shadowColor = '#7ffcff';
    ctx.shadowBlur = Math.max(18, radiusPx * 0.16);
    ctx.strokeStyle = calibrationMode ? 'rgba(255,255,255,0.98)' : 'rgba(155,255,255,0.96)';
    ctx.lineWidth = Math.max(3, radiusPx * 0.03);
    ctx.beginPath();
    ctx.ellipse(cx, cy, sliceRadius, sliceRadius * 0.84, 0, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = calibrationMode ? 'rgba(255,255,255,0.94)' : 'rgba(70,235,255,0.92)';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * 2 * Math.PI + rotation;
      const gate = Math.abs(Math.sin(a * 3 + z * 2.4)) > 0.82 || i % 4 === sliceIndex % 4;
      if (!gate) continue;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * sliceRadius, cy + Math.sin(a) * sliceRadius * 0.84, Math.max(2.2, radiusPx * 0.012), 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(95,220,255,0.66)';
    ctx.lineWidth = Math.max(1.4, radiusPx * 0.012);
    for (let m = 0; m < 6; m++) {
      const a = rotation + m * Math.PI / 6;
      const xOffset = Math.sin(a) * sliceRadius * 0.72;
      ctx.beginPath();
      ctx.ellipse(cx + xOffset, cy, Math.max(2, sliceRadius * 0.11 * Math.abs(Math.cos(a))), sliceRadius * 0.84, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const measureShift = (frame1, frame2, region) => {
    const reg = clampRegion(frame1, region);
    const d1 = frame1.data;
    const d2 = frame2.data;
    const fw = frame1.width;
    const patchSize = 16;
    const shifts = [];

    const getSAD = (px, py, dx, dy) => {
      let sum = 0;
      for (let yy = 0; yy < patchSize; yy++) {
        for (let xx = 0; xx < patchSize; xx++) {
          const i2 = ((py + yy) * fw + (px + xx)) * 4;
          const i1 = ((py + yy + dy) * fw + (px + xx + dx)) * 4;
          if (i2 < 0 || i2 >= d2.length || i1 < 0 || i1 >= d1.length) continue;
          const v2 = (d2[i2] + d2[i2 + 1] + d2[i2 + 2]) / 3;
          const v1 = (d1[i1] + d1[i1 + 1] + d1[i1 + 2]) / 3;
          sum += Math.abs(v2 - v1);
        }
      }
      return sum;
    };

    for (let py = reg.y0; py < reg.y1 - patchSize; py += patchSize * 2) {
      for (let px = reg.x0; px < reg.x1 - patchSize; px += patchSize * 2) {
        let bestDx = 0;
        let bestDy = 0;
        let best = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const sad = getSAD(px, py, dx, dy);
            if (sad < best) { best = sad; bestDx = dx; bestDy = dy; }
          }
        }
        if (best < patchSize * patchSize * 110) shifts.push(Math.sqrt(bestDx * bestDx + bestDy * bestDy));
      }
    }

    if (!shifts.length) return { mean: 0, rms: 0, count: 0 };
    const mean = shifts.reduce((sum, v) => sum + v, 0) / shifts.length;
    const rms = Math.sqrt(shifts.reduce((sum, v) => sum + v * v, 0) / shifts.length);
    return { mean, rms, count: shifts.length };
  };

  const measureAerosolStats = (frame, darkFrame, region, sliceIndex) => {
    const reg = clampRegion(frame, region);
    const d = frame.data;
    const dark = darkFrame.data;
    const fw = frame.width;
    const cx = (reg.x0 + reg.x1) / 2;
    const cy = (reg.y0 + reg.y1) / 2;
    const samples = [];

    for (let y = reg.y0; y < reg.y1; y += 2) {
      for (let x = reg.x0; x < reg.x1; x += 2) {
        const idx = (y * fw + x) * 4;
        const val = (d[idx] + d[idx + 1] + d[idx + 2]) / 3;
        const base = (dark[idx] + dark[idx + 1] + dark[idx + 2]) / 3;
        samples.push({ x, y, v: Math.max(0, val - base) });
      }
    }

    const mean = samples.reduce((sum, p) => sum + p.v, 0) / Math.max(1, samples.length);
    const variance = samples.reduce((sum, p) => sum + (p.v - mean) * (p.v - mean), 0) / Math.max(1, samples.length);
    const std = Math.sqrt(variance);
    const threshold = mean + std * 1.35;
    let weight = 0;
    let sx = 0;
    let sy = 0;
    let sr = 0;
    let peak = 0;
    let bright = 0;

    for (const p of samples) {
      peak = Math.max(peak, p.v);
      if (p.v <= threshold) continue;
      bright++;
      weight += p.v;
      sx += p.x * p.v;
      sy += p.y * p.v;
      const dx = p.x - cx;
      const dy = p.y - cy;
      sr += Math.sqrt(dx * dx + dy * dy) * p.v;
    }

    const mx = weight > 0 ? sx / weight : cx;
    const my = weight > 0 ? sy / weight : cy;
    const radiusPx = weight > 0 ? sr / weight : 0;
    const phase = ((sliceIndex % sliceCount) + 0.5) / sliceCount;
    const zNorm = -1 + 2 * phase;
    const expectedRadiusNorm = Math.sqrt(Math.max(0, 1 - zNorm * zNorm));
    const dx = mx - cx;
    const dy = my - cy;
    const centroidDeviationPx = Math.sqrt(dx * dx + dy * dy);
    const snr = std > 1e-6 ? mean / std : 0;
    const contrast = peak > 0 ? mean / peak : 0;

    return {
      sliceIndex,
      zNorm: +zNorm.toFixed(3),
      expectedRadiusNorm: +expectedRadiusNorm.toFixed(3),
      mean: +mean.toFixed(2),
      std: +std.toFixed(2),
      peak: +peak.toFixed(2),
      snr: +snr.toFixed(3),
      contrast: +contrast.toFixed(3),
      brightFraction: +(bright / Math.max(1, samples.length)).toFixed(4),
      centroidX: +mx.toFixed(1),
      centroidY: +my.toFixed(1),
      dx: +dx.toFixed(2),
      dy: +dy.toFixed(2),
      centroidDeviationPx: +centroidDeviationPx.toFixed(2),
      radiusPx: +radiusPx.toFixed(2)
    };
  };

  const correlation = (a, b) => {
    if (a.length !== b.length || a.length < 2) return 0;
    const ma = a.reduce((s, v) => s + v, 0) / a.length;
    const mb = b.reduce((s, v) => s + v, 0) / b.length;
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

  const collectSliceStats = async (label, calibrationMode) => {
    const statsList = [];
    this.log(`\n── ${label} ──`);
    for (let slice = 0; slice < sliceCount; slice++) {
      this.showPattern((ctx, w, h) => drawAerosolSlice(ctx, w, h, slice * frameMs / 1000, slice, { calibrationMode }));
      await this.sleep(90);
      const frame = await this.captureStable(2, 25);
      const stats = measureAerosolStats(frame, darkFrame, roi, slice);
      statsList.push(stats);
      this.log(`  slice ${String(slice + 1).padStart(2, '0')}/${sliceCount}: contrast=${stats.contrast.toFixed(3)} snr=${stats.snr.toFixed(2)} peak=${stats.peak.toFixed(1)} mean=${stats.mean.toFixed(2)} dev=${stats.centroidDeviationPx.toFixed(1)}px r=${stats.radiusPx.toFixed(1)}px`);
    }
    return statsList;
  };

  const summarizeSliceStats = (statsList, dryStats = null) => {
    const maxRadius = Math.max(...statsList.map(s => s.radiusPx), 1);
    const expected = statsList.map(s => s.expectedRadiusNorm);
    const measured = statsList.map(s => s.radiusPx / maxRadius);
    const deltas = dryStats ? statsList.map((stats, index) => {
      const dry = dryStats[index] || {};
      const peakDelta = stats.peak - (dry.peak || 0);
      const meanDelta = stats.mean - (dry.mean || 0);
      const brightFractionDelta = stats.brightFraction - (dry.brightFraction || 0);
      return {
        sliceIndex: stats.sliceIndex,
        peakDelta: +peakDelta.toFixed(2),
        meanDelta: +meanDelta.toFixed(2),
        contrastDelta: +(stats.contrast - (dry.contrast || 0)).toFixed(3),
        snrDelta: +(stats.snr - (dry.snr || 0)).toFixed(3),
        brightFractionDelta: +brightFractionDelta.toFixed(4),
        radiusDeltaPx: +(stats.radiusPx - (dry.radiusPx || 0)).toFixed(2),
        visible: peakDelta > 2.5 && meanDelta > 0.35 && brightFractionDelta > 0.0005
      };
    }) : [];

    return {
      radiusCorrelation: correlation(expected, measured),
      meanContrast: statsList.reduce((sum, s) => sum + s.contrast, 0) / statsList.length,
      meanSnr: statsList.reduce((sum, s) => sum + s.snr, 0) / statsList.length,
      meanDeviation: statsList.reduce((sum, s) => sum + s.centroidDeviationPx, 0) / statsList.length,
      visibleSlices: dryStats
        ? deltas.filter(d => d.visible).length
        : statsList.filter(s => s.peak > 8 && s.brightFraction > 0.002).length,
      meanPeakDelta: deltas.length ? deltas.reduce((sum, d) => sum + d.peakDelta, 0) / deltas.length : 0,
      meanMeanDelta: deltas.length ? deltas.reduce((sum, d) => sum + d.meanDelta, 0) / deltas.length : 0,
      meanBrightFractionDelta: deltas.length ? deltas.reduce((sum, d) => sum + d.brightFractionDelta, 0) / deltas.length : 0,
      deltas
    };
  };

  this.setRun(this.t('etap'), 'Aerosol 3D: camera baseline', 143.1);
  this.showColor('#000000');
  await this.sleep(1200);
  const darkFrame = await this.captureStable(8, 40);
  showReferencePattern();
  await this.sleep(400);
  const referenceBefore = await this.captureStable(8, 40);

  const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(darkFrame.width * 0.15);
  const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(darkFrame.width * 0.85);
  const y0 = (cal.y0 != null) ? cal.y0 : Math.floor(darkFrame.height * 0.18);
  const y1 = (cal.y1 != null) ? cal.y1 : Math.floor(darkFrame.height * 0.88);
  const roi = { x0, x1, y0, y1 };
  this.log(`  Camera ROI: [${x0},${x1}] x [${y0},${y1}]`);

  this.setRun(this.t('etap'), 'Aerosol 3D: dry control slices', 143.2);
  this.log('  Dry control: keep the volume above the screen clear. This pass is the screen/reflection/noise baseline.');
  const drySliceStats = await collectSliceStats('Dry control without aerosol', true);
  const drySummary = summarizeSliceStats(drySliceStats);

  this.log('\n  Dry control summary:');
  this.log(`    raw visible slices = ${drySummary.visibleSlices}/${sliceCount}`);
  this.log(`    radius correlation = ${drySummary.radiusCorrelation.toFixed(3)}`);
  this.log(`    mean contrast = ${drySummary.meanContrast.toFixed(3)}, mean SNR = ${drySummary.meanSnr.toFixed(2)}`);

  this.setRun(this.t('etap'), 'Aerosol 3D: add aerosol now', 143.25);
  this.showColor('#000000');
  this.log('\n── Add aerosol now ──');
  this.log('  Spray a thin water aerosol layer 1-4 cm above the screen. Keep droplets off the phone glass.');
  this.log('  Measuring starts in 8 seconds.');
  await this.sleep(8000);

  this.setRun(this.t('etap'), 'Aerosol 3D: aerosol slice statistics', 143.3);
  const sliceStats = await collectSliceStats('Aerosol pass: same slices, measured against dry control', false);
  const aerosolSummary = summarizeSliceStats(sliceStats, drySliceStats);
  const { radiusCorrelation, meanContrast, meanSnr, meanDeviation, visibleSlices, meanPeakDelta, meanMeanDelta, meanBrightFractionDelta } = aerosolSummary;

  this.log('\n  Aerosol-vs-dry statistics summary:');
  this.log(`    visible aerosol slices = ${visibleSlices}/${sliceCount}`);
  this.log(`    radius correlation = ${radiusCorrelation.toFixed(3)}`);
  this.log(`    mean contrast = ${meanContrast.toFixed(3)}, mean SNR = ${meanSnr.toFixed(2)}`);
  this.log(`    mean aerosol gain: peak Δ=${meanPeakDelta.toFixed(2)}, mean Δ=${meanMeanDelta.toFixed(2)}, bright-fraction Δ=${meanBrightFractionDelta.toFixed(4)}`);
  this.log(`    mean centroid deviation = ${meanDeviation.toFixed(1)} px`);

  this.setRun(this.t('etap'), 'Aerosol 3D: live visible volume', 143.4);
  this.log('\n── Live aerosol globe: draw + camera tracking for 60s ──');
  this.log('  Keep a thin aerosol layer 1-4 cm above the screen. Avoid droplets on the phone.');

  const liveStats = [];
  const start = Date.now();
  let lastCapture = 0;
  while (Date.now() - start < runDurationMs) {
    const elapsed = Date.now() - start;
    const slice = Math.floor(elapsed / frameMs) % sliceCount;
    this.showPattern((ctx, w, h) => drawAerosolSlice(ctx, w, h, elapsed / 1000, slice));

    if (elapsed - lastCapture >= 1000) {
      lastCapture = elapsed;
      const frame = await this.captureStable(1, 15);
      const stats = measureAerosolStats(frame, darkFrame, roi, slice);
      const dry = drySliceStats[slice] || {};
      stats.peakDelta = +(stats.peak - (dry.peak || 0)).toFixed(2);
      stats.meanDelta = +(stats.mean - (dry.mean || 0)).toFixed(2);
      liveStats.push(stats);
      this.log(`  live t=${(elapsed / 1000).toFixed(0)}s slice=${slice + 1}: contrast=${stats.contrast.toFixed(3)} peakΔ=${stats.peakDelta.toFixed(1)} meanΔ=${stats.meanDelta.toFixed(2)} dev=${stats.centroidDeviationPx.toFixed(1)}px`);
    }
    await this.sleep(8);
  }

  showReferencePattern();
  await this.sleep(300);
  const referenceAfter = await this.captureStable(8, 40);
  const bosShift = measureShift(referenceBefore, referenceAfter, roi);

  this.showColor('#000000');

  const liveMeanContrast = liveStats.length ? liveStats.reduce((sum, s) => sum + s.contrast, 0) / liveStats.length : 0;
  const liveMeanDeviation = liveStats.length ? liveStats.reduce((sum, s) => sum + s.centroidDeviationPx, 0) / liveStats.length : 0;
  const liveMeanPeakDelta = liveStats.length ? liveStats.reduce((sum, s) => sum + (s.peakDelta || 0), 0) / liveStats.length : 0;
  const liveMeanMeanDelta = liveStats.length ? liveStats.reduce((sum, s) => sum + (s.meanDelta || 0), 0) / liveStats.length : 0;
  const pass = visibleSlices >= 8 && meanPeakDelta > 2.5 && meanMeanDelta > 0.35 && radiusCorrelation > 0.15;

  this.results.stage83 = {
    method: 'Real aerosol 3D globe with camera statistics',
    sliceCount,
    oledHz,
    frameMs: +frameMs.toFixed(2),
    globeRadiusMm,
    globeHeightMm,
    sliceDzMm: +sliceDzMm.toFixed(2),
    visibleSlices,
    meanContrast: +meanContrast.toFixed(3),
    meanSnr: +meanSnr.toFixed(3),
    meanDeviationPx: +meanDeviation.toFixed(2),
    radiusCorrelation: +radiusCorrelation.toFixed(3),
    dryVisibleSlices: drySummary.visibleSlices,
    dryMeanContrast: +drySummary.meanContrast.toFixed(3),
    dryMeanSnr: +drySummary.meanSnr.toFixed(3),
    meanPeakDelta: +meanPeakDelta.toFixed(2),
    meanMeanDelta: +meanMeanDelta.toFixed(2),
    meanBrightFractionDelta: +meanBrightFractionDelta.toFixed(4),
    liveSamples: liveStats.length,
    liveMeanContrast: +liveMeanContrast.toFixed(3),
    liveMeanPeakDelta: +liveMeanPeakDelta.toFixed(2),
    liveMeanMeanDelta: +liveMeanMeanDelta.toFixed(2),
    liveMeanDeviationPx: +liveMeanDeviation.toFixed(2),
    bosShiftMeanPx: +bosShift.mean.toFixed(3),
    bosShiftRmsPx: +bosShift.rms.toFixed(3),
    bosShiftCount: bosShift.count,
    drySliceStats,
    sliceStats,
    sliceDeltas: aerosolSummary.deltas,
    pass
  };

  this.log('\n━━━ STAGE 83 RESULT ━━━');
  this.log(`  Dry raw visible slices: ${drySummary.visibleSlices}/${sliceCount}`);
  this.log(`  Aerosol visible slices above dry: ${visibleSlices}/${sliceCount}`);
  this.log(`  Radius correlation: ${radiusCorrelation.toFixed(3)}`);
  this.log(`  Mean aerosol gain: peak Δ=${meanPeakDelta.toFixed(2)}, mean Δ=${meanMeanDelta.toFixed(2)}`);
  this.log(`  Live samples: ${liveStats.length}, live contrast=${liveMeanContrast.toFixed(3)}, live peak Δ=${liveMeanPeakDelta.toFixed(2)}`);
  this.log(`  BOS shift after aerosol: mean=${bosShift.mean.toFixed(3)}px rms=${bosShift.rms.toFixed(3)}px n=${bosShift.count}`);
  this.log(`  Result: ${pass ? 'PASS - aerosol field detected above dry control' : 'WEAK - aerosol gain is below dry-control threshold'}`);
}

export function render(r) {
  if (r.stage83) { try {
    const s = r.stage83;
    this.rv('rv-holo-opd', `${s.visibleSlices || 0}/${s.sliceCount || 0}`, (s.visibleSlices || 0) >= 8 ? 'ok' : 'warn');
    this.rv('rv-holo-phase', `Δ${(s.meanPeakDelta || 0).toFixed(2)}`, (s.meanPeakDelta || 0) > 2.5 ? 'ok' : 'warn');
    this.rv('rv-holo-lens', `Δ${(s.meanMeanDelta || 0).toFixed(2)}`, (s.meanMeanDelta || 0) > 0.35 ? 'ok' : 'warn');
    this.rv('rv-holo-fresnel', `${(s.meanDeviationPx || 0).toFixed(1)}px`, (s.meanDeviationPx || 999) < 80 ? 'ok' : 'warn');
    this.rv('rv-d2nn-phase', `r=${(s.radiusCorrelation || 0).toFixed(3)}`, (s.radiusCorrelation || 0) > 0.15 ? 'ok' : 'warn');
    this.rv('rv-d2nn-focus', `BOS ${((s.bosShiftRmsPx || 0)).toFixed(2)}px`, (s.bosShiftCount || 0) > 0 ? 'ok' : 'warn');

    const canvas = document.getElementById('holo-globe-canvas');
    if (canvas && !canvas.dataset.animStarted) {
      canvas.dataset.animStarted = 'true';
      startAerosolPreview(canvas);
    }

    const g = document.getElementById('g-s83');
    if (g) {
      g.textContent = s.pass
        ? `✅ Aerosol 3D detected above dry control: ${s.visibleSlices}/${s.sliceCount} slices, peak Δ=${s.meanPeakDelta}`
        : `⚠️ Aerosol weak above dry control: ${s.visibleSlices}/${s.sliceCount} slices, peak Δ=${s.meanPeakDelta}`;
      g.className = s.pass ? 'grade pass' : 'grade warn';
    }
  } catch(e) { console.error('s83 render:', e); } }
}

function startAerosolPreview(canvas) {
  const ctx = canvas.getContext('2d');
  let frame = 0;

  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const cx = w * 0.5;
    const cy = h * 0.54;
    const radius = Math.min(w, h) * 0.34;
    const z = -1 + 2 * ((frame % 24) + 0.5) / 24;
    const r = radius * Math.sqrt(Math.max(0, 1 - z * z));

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.8);
    glow.addColorStop(0, 'rgba(0, 130, 170, 0.20)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.shadowColor = '#7ffcff';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(160,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.82, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dfffff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`camera-tracked aerosol slice ${(frame % 24) + 1}/24`, 12, h - 14);
    frame++;
    requestAnimationFrame(draw);
  };

  draw();
}