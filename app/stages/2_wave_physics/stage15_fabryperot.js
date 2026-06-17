// Stage 15: FP

export async function run() {
this.setRun(this.t('etap'), this.t('fabripero_rezonans'), 99.9);
    this.showColor('#808080');
    await this.sleep(800);

    // Screen + mirror = optical resonator
    // Scan stripe frequencies to find resonance peaks
    // At certain spatial frequencies, the round-trip reinforces the pattern (resonance)
    const stripeSizes = [40, 32, 28, 24, 20, 16, 14, 12, 10, 8, 6, 4];
    const contrasts = [];

    for (let si = 0; si < stripeSizes.length; si++) {
      const sz = stripeSizes[si];
      this.setRun(this.t('etap'), this.t('poloski_px', {var0: sz}), 99.9 + si * 0.007);
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        const pxSz = sz * dpr;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += pxSz * 2) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, 0, pxSz, h);
        }
      });
      await this.sleep(800);
      const frame = await this.captureStable(8, 60);
      const c = this.measureStripContrast(frame);
      contrasts.push(c);
      this.log(`  ${sz}px → C=${c.toFixed(4)}`);
      this.showColor('#808080');
      await this.sleep(400);
    }

    // Find peak (resonance)
    const maxC = Math.max(...contrasts);
    const peakIdx = contrasts.indexOf(maxC);
    const peakFreq = stripeSizes[peakIdx];

    // Compute Q-factor: peak width at half maximum
    const halfMax = maxC / 2;
    let leftIdx = peakIdx, rightIdx = peakIdx;
    while (leftIdx > 0 && contrasts[leftIdx] > halfMax) leftIdx--;
    while (rightIdx < contrasts.length - 1 && contrasts[rightIdx] > halfMax) rightIdx++;
    const fwhm = Math.max(1, rightIdx - leftIdx);
    const qFactor = stripeSizes.length / fwhm;

    // Is there a clear peak? (peak must be > 1.5× average)
    const avgC = contrasts.reduce((a,b)=>a+b,0) / contrasts.length;
    const peakRatio = maxC / Math.max(avgC, 0.001);

    this.log(`FP: Peak at ${peakFreq}px, C=${maxC.toFixed(4)}, Q=${qFactor.toFixed(1)}, peak/avg=${peakRatio.toFixed(2)}`);
    this.log(this.t('fp', {var0: peakRatio > 1.3 ? 'резонанс найден' : 'нет резонанса'}), peakRatio > 1.3 ? 'ok' : 'warn');

    this.results.stage15 = {
      stripeSizes, contrasts, peakFreq, maxC, qFactor, peakRatio, avgC
    };
}

export function render(r) {
if (r.stage15) { try {
      const s = r.stage15;
      this.rv('rv-fp-peak', s.maxC.toFixed(4), s.peakRatio > 1.3 ? 'ok' : 'warn');
      this.rv('rv-fp-freq', s.peakFreq + 'px', 'ok');
      this.rv('rv-fp-q', s.qFactor.toFixed(1), s.qFactor > 2 ? 'ok' : 'warn');
      const g = document.getElementById('g-s15');
      if (s.peakRatio > 1.5 && s.qFactor > 2) {
        g.textContent=this.t('rezonans_nayden'); g.className='grade pass';
      } else if (s.peakRatio > 1.2) {
        g.textContent=this.t('slabyy_rezonans'); g.className='grade partial';
      } else { g.textContent=this.t('net_rezonansa'); g.className='grade fail'; }
      this.drawFPChart(s);
    } catch(e) { console.error('stage15 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.peakRatio > 1.2)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'Q=' + (d.qFactor||0).toFixed(1))(d); } catch(e) { return '—'; }
}
