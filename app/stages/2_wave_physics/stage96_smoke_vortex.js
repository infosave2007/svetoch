export async function run() {
  this.setRun(this.t('etap'), this.t('smoke_start'), 150.0);
  this.log('━━━ STAGE 96: RESONANT SMOKE SUPER-VORTEX (5Hz) ━━━');
  this.log('  Thermodynamic macroscopic smoke interaction test');

  const cal = this.results.calibration || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v, n = 3) => +Number(v || 0).toFixed(n);

  // Pre-generate templates for the vortex
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

  // Draws an octo-vortex structure with intensity modulation
  const drawElement = (ctx, ecx, ecy, eSize, hand = 1, intensity = 1.0) => {
    const R = eSize * 0.36;     // larger radius for the ring to prevent overlap
    const rSize = eSize * 0.25; // smaller vortex size so they fit nicely around the ring

    ctx.globalAlpha = intensity;
    
    // We use all CW spirals to create a unified macroscopic rotation (thermal ratchet)
    const vCanvas = offCW;

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4.0;
      const px = ecx + R * Math.cos(angle);
      const py = ecy + R * Math.sin(angle);
      ctx.drawImage(vCanvas, px - rSize / 2, py - rSize / 2, rSize, rSize);
    }

    ctx.globalAlpha = 1.0;

    const rLens = eSize * 0.15;
    const grad = ctx.createRadialGradient(ecx, ecy, 0, ecx, ecy, rLens);
    grad.addColorStop(0, `rgba(255,255,255,${intensity})`);
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

  // Function to calculate global optical flow magnitude (SAD) to track smoke movement
  const measureSmokeActivity = (frame1, frame2) => {
    const d1 = frame1.data, d2 = frame2.data;
    const fw = frame1.width, fh = frame1.height;
    const step = 4;
    let totalSAD = 0;
    let samples = 0;

    for (let py = y0; py < y1 - step; py += step) {
      for (let px = x0; px < x1 - step; px += step) {
        const i1 = (py * fw + px) * 4;
        const v1 = (d1[i1] + d1[i1 + 1] + d1[i1 + 2]) / 3;
        const v2 = (d2[i1] + d2[i1 + 1] + d2[i1 + 2]) / 3;
        totalSAD += Math.abs(v2 - v1);
        samples++;
      }
    }
    return samples > 0 ? (totalSAD / samples) : 0;
  };

  this.log('\n── Starting 5Hz Resonance Injection ──');
  this.log('  Please blow some smoke gently over the display.');
  
  const durationSec = 30; // Run for 30 seconds
  const runDurationMs = durationSec * 1000;

  let accumulatedSmokeActivity = 0;
  let maxActivity = 0;
  
  // Capture initial baseline
  this.showColor('#000000');
  await this.sleep(500);
  let prevFrame = this.captureFrame(); // Use instant frame to match data types in loop

  const startTime = Date.now();
  let lastCapture = 0;
  let frameCount = 0;

  // We use a high-frequency polling loop so the screen rendering is perfectly on time,
  // and we only capture frames occasionally so we don't block the screen updates.
  while (Date.now() - startTime < runDurationMs) {
    const elapsed = Date.now() - startTime;
    const t_sec = elapsed / 1000.0;
    
    // Strict 5 Hz resonance modulation (Square Wave)
    // Period is 200ms: 100ms ON (full brightness), 100ms OFF (black)
    const modulation = Math.floor(elapsed / 100) % 2 === 0 ? 1.0 : 0.0;
    
    // Draw giant vortex on the screen
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      
      const ccx = w / 2, ccy = h / 2;
      const eSize = Math.min(w, h) * 0.95; // Giant screen-sized vortex
      
      drawElement(ctx, ccx, ccy, eSize, 1, modulation);

      // HUD text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `${Math.max(16, Math.floor(h * 0.05))}px monospace`;
      ctx.fillText(`5Hz RESONANT SUPER-VORTEX`, 20, Math.floor(h * 0.1));
      ctx.fillText(`TIME: ${t_sec.toFixed(1)}s / ${durationSec}s`, 20, Math.floor(h * 0.15));
      ctx.fillText(`SMOKE ACTIVITY: ${maxActivity.toFixed(2)}`, 20, Math.floor(h * 0.2));
    });

    // Capture frames independently (4 times a second) without skipping frames 
    // to prevent blocking the rendering loop!
    if (elapsed - lastCapture >= 250) {
      lastCapture = elapsed;
      
      const currentFrame = this.captureFrame(); // INSTANT return, bypasses Float64Array blocking loop!
      const activity = measureSmokeActivity(prevFrame, currentFrame);
      
      accumulatedSmokeActivity += activity;
      if (activity > maxActivity) maxActivity = activity;
      
      prevFrame = currentFrame;
      frameCount++;

      if (frameCount % 4 === 0) {
        this.log(`  [${t_sec.toFixed(1)}s] Mod=${modulation.toFixed(2)} | Activity SAD=${activity.toFixed(2)}`);
      }
    } else {
      await this.sleep(16); // sleep 16ms to maintain ~60fps screen update rate
    }
  }

  const avgActivity = frameCount > 0 ? accumulatedSmokeActivity / frameCount : 0;
  
  this.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  this.log(`  Resonance Experiment Completed!`);
  this.log(`  Avg Smoke Rotation SAD: ${avgActivity.toFixed(2)}`);
  this.log(`  Max Smoke Activity Peak: ${maxActivity.toFixed(2)}`);
  this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  this.showColor('#000000');

  // Threshold to consider that we interacted with smoke.
  // Baseline noise for instant raw frames is ~0.5. A peak > 0.9 is a clear smoke signal.
  const pass = avgActivity > 0.55 || maxActivity > 0.9;
  
  this.results.stage96 = {
    method: '5Hz Resonant Smoke Super-Vortex',
    avgActivity: +avgActivity.toFixed(2),
    maxActivity: +maxActivity.toFixed(2),
    pass
  };
}

export function render(r) {
  if (r.stage96) { try {
    const s = r.stage96;
    this.rv('rv-smoke-act', `Act=${s.avgActivity}`, s.pass ? 'ok' : 'warn');
    const g = document.getElementById('g-s96');
    if (g) {
      if (s.pass) {
        g.textContent = `✅ Smoke Vortex: Active (SAD=${s.maxActivity})`;
        g.className = 'grade pass';
      } else {
        g.textContent = `⚠️ Smoke Vortex: Low Activity (SAD=${s.maxActivity})`;
        g.className = 'grade warn';
      }
    }
  } catch (e) { console.error('s96 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; } }

export function metric(d) {
  try { return `SAD=${d.maxActivity}`; } catch (e) { return '—'; } }
