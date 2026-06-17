// Stage 98: Schlieren BOS Interferometer

export async function run() {
  this.setRun(this.t('etap'), this.t('start_schlieren'), 150.0);
  this.log('━━━ STAGE 98: SCHLIEREN BOS INTERFEROMETER ━━━');
  this.log('  Mirrorless phase-shift measurement via thermal convection');

  const cal = this.results.calibration || {};
  const x0 = (cal.x0 != null) ? cal.x0 : 20;
  const x1 = (cal.x1 != null) ? cal.x1 : 300;
  const y0 = (cal.y0 != null) ? cal.y0 : 20;
  const y1 = (cal.y1 != null) ? cal.y1 : 300;

  // We need a stable background pattern to illuminate the ceiling and act as reference
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    
    // Draw a central thermal pump area with a high-frequency grid
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.45; // large circle for heating
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.clip();
    
    // High-frequency grid (4px stripes) to provide high spatial derivative for Schlieren sensitivity
    const dpr = window.devicePixelRatio || 1;
    const pxSz = 4 * dpr;
    for (let x = 0; x < w; x += pxSz * 2) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, 0, pxSz, h);
    }
  });

  this.log('  Warming up screen and adapting camera (4s)...');
  await this.sleep(4000); // Wait for auto-exposure to settle and initial heat to build up
  
  // Capture the baseline (cold air / undisturbed air) frame
  const baselineFrame = this.captureFrame();
  
  this.log('  Measuring Schlieren phase shift over 20s...');
  const durationSec = 20;
  const runDurationMs = durationSec * 1000;
  const startTime = Date.now();
  let maxSAD = 0;
  let lastCapture = 0;
  
  const sads = [];

  // Poll camera and calculate phase shifts
  while (Date.now() - startTime < runDurationMs) {
    const elapsed = Date.now() - startTime;
    
    if (elapsed - lastCapture >= 500) {
      lastCapture = elapsed;
      
      const currentFrame = this.captureFrame();
      
      // Calculate Phase Shift (Optical Flow SAD)
      const d1 = baselineFrame.data, d2 = currentFrame.data;
      const fw = baselineFrame.width;
      const step = 4; // Sample every 4th pixel for speed
      let totalSAD = 0;
      let samples = 0;
      
      for (let py = y0; py < y1 - step; py += step) {
        for (let px = x0; px < x1 - step; px += step) {
          const i1 = (py * fw + px) * 4;
          // Grayscale luminosity
          const v1 = (d1[i1] + d1[i1 + 1] + d1[i1 + 2]) / 3;
          const v2 = (d2[i1] + d2[i1 + 1] + d2[i1 + 2]) / 3;
          totalSAD += Math.abs(v2 - v1);
          samples++;
        }
      }
      const sad = samples > 0 ? (totalSAD / samples) : 0;
      sads.push(sad);
      
      if (sad > maxSAD) maxSAD = sad;
      
      const t_sec = elapsed / 1000.0;
      if ((t_sec * 2) % 2 < 0.5) { // Log every ~1s
          this.log(`  [${t_sec.toFixed(1)}s] Phase Shift (SAD): ${sad.toFixed(3)}`);
      }
    } else {
      await this.sleep(50);
    }
  }

  this.showColor('#000000');
  
  // To pass, the SAD must show a measurable shift indicating thermal air turbulence.
  // Ambient sensor noise over 20s usually drifts SAD up to ~0.5. 
  // A SAD > 0.8 is a clear sign of Schlieren convective lensing.
  const pass = maxSAD > 0.8;

  this.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  this.log(`  BOS Schlieren Test Completed!`);
  this.log(`  Max Phase Shift SAD: ${maxSAD.toFixed(3)}`);
  this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  this.results.stage98 = {
    method: 'Background Oriented Schlieren',
    maxSAD: +maxSAD.toFixed(3),
    sads,
    pass
  };
}

export function render(r) {
  if (r.stage98) { try {
    const s = r.stage98;
    this.rv('rv-schlieren-peak', s.maxSAD.toFixed(3), s.pass ? 'ok' : 'warn');
    
    const g = document.getElementById('g-s98');
    if (g) {
      if (s.maxSAD > 1.2) {
        g.textContent = this.t('rezonans_nayden'); g.className = 'grade pass';
      } else if (s.pass) {
        g.textContent = this.t('slabyy_rezonans'); g.className = 'grade partial';
      } else {
        g.textContent = this.t('net_rezonansa'); g.className = 'grade fail';
      }
    }
  } catch (e) { console.error('s98 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; }
}

export function metric(d) {
  try { return `SAD=${(d.maxSAD||0).toFixed(2)}`; } catch (e) { return '—'; }
}
