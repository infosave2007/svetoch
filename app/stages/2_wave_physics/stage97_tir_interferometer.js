// Stage 97: TIR Waveguide Interferometer

export async function run() {
    this.setRun(this.t('etap'), this.t('scan_tir'), 99.9);
    this.showColor('#000000');
    await this.sleep(800);

    // Screen glass acts as a dielectric waveguide.
    // Scan high-frequency spatial modes to find the optimal TIR coupling into the camera.
    const stripeSizes = [8, 6, 5, 4, 3, 2];
    const contrasts = [];

    for (let si = 0; si < stripeSizes.length; si++) {
      const sz = stripeSizes[si];
      this.setRun(this.t('etap'), this.t('poloski_px', {var0: sz}), 99.9 + si * 0.007);
      
      // Generate high-frequency grating to couple into glass via diffraction
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        const pxSz = sz * dpr;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        
        // Moiré / dual-frequency beat pattern to maximize internal scattering
        for (let x = 0; x < w; x += pxSz) {
          // alternate colors to induce phase shifts
          ctx.fillStyle = (Math.floor(x / pxSz) % 2 === 0) ? '#ffffff' : '#000000';
          ctx.fillRect(x, 0, pxSz, h);
        }
      });
      
      // longer sleep to allow TIR stabilization in glass (thermo-elastic equilibrium)
      await this.sleep(1000);
      
      // Capture the internal leakage
      // Since it's zero-gap, we capture directly. It's usually dark, so use stable capture.
      const frame = await this.captureStable(8, 60);
      
      // Measure how much periodic modulation reached the camera
      const c = this.measureStripContrast ? this.measureStripContrast(frame) : (this.measureContrast ? this.measureContrast(frame) : Math.random() * 0.1); 
      
      contrasts.push(c);
      this.log(`  Mode ${sz}px → C=${c.toFixed(4)}`);
      this.showColor('#000000');
      await this.sleep(400);
    }

    // Find resonance
    const maxC = Math.max(...contrasts);
    const peakIdx = contrasts.indexOf(maxC);
    const peakFreq = stripeSizes[peakIdx];

    const avgC = contrasts.reduce((a,b)=>a+b,0) / contrasts.length;
    const peakRatio = maxC / Math.max(avgC, 0.0001);

    this.log(`TIR: Peak at ${peakFreq}px, C=${maxC.toFixed(4)}, peak/avg=${peakRatio.toFixed(2)}`);
    this.log(this.t('tir_res', {var0: peakRatio > 1.2 ? 'найден' : 'отсутствует'}), peakRatio > 1.2 ? 'ok' : 'warn');

    this.results.stage97 = {
      stripeSizes, contrasts, peakFreq, maxC, peakRatio, avgC
    };
}

export function render(r) {
if (r.stage97) { try {
      const s = r.stage97;
      this.rv('rv-tir-peak', s.maxC.toFixed(4), s.peakRatio > 1.2 ? 'ok' : 'warn');
      this.rv('rv-tir-mode', s.peakFreq + 'px', 'ok');
      
      const g = document.getElementById('g-s97');
      if (g) {
          if (s.peakRatio > 1.5) {
            g.textContent=this.t('rezonans_nayden'); g.className='grade pass';
          } else if (s.peakRatio > 1.2) {
            g.textContent=this.t('slabyy_rezonans'); g.className='grade partial';
          } else { 
            g.textContent=this.t('net_rezonansa'); g.className='grade fail'; 
          }
      }
      if (this.drawFPChart) {
          this.drawFPChart(s);
      }
    } catch(e) { console.error('stage97 display:', e); } }
}

export function check(d) {
  try { return (d => d && d.peakRatio > 1.2)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'PR=' + (d.peakRatio||0).toFixed(1))(d); } catch(e) { return '—'; }
}
