// Stage 49: ΔxΔp

export async function run() {
this.setRun(this.t('etap'), this.t('nvg_printsip_neopredelyonnosti'), 109.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};

    // Measure Δx (spatial resolution) and Δp (intensity resolution)
    // at different spatial frequencies
    // Δx = 1/f (smaller for higher frequency patterns)
    // Δp = noise / contrast (higher for finer patterns due to blur)
    const freqs = [1, 2, 4, 8, 12, 16]; // stripe frequency in cycles
    const measurements = [];

    for (let fi = 0; fi < freqs.length; fi++) {
      const f = freqs[fi];
      this.setRun(this.t('etap'), `f=${f} cycles...`, 109.0 + fi * 0.12);

      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const v = Math.round(128 + 120 * Math.sin(2 * Math.PI * f * x / w));
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, 0, 1, h);
        }
      });
      await this.sleep(600);
      const frame = await this.captureStable(6, 40);
      const bins = this.measureNBins(frame, 8);
      const bMax = Math.max(...bins), bMin = Math.min(...bins);
      const contrast = (bMax - bMin) / (bMax + bMin + 1e-6);

      // Δx ∝ 1/f (spatial uncertainty decreases with frequency)
      const deltaX = 1.0 / f;
      // Δp ∝ 1/contrast (momentum uncertainty increases as contrast drops)
      const deltaP = contrast > 0.01 ? 1.0 / contrast : 100;
      const product = deltaX * deltaP;

      measurements.push({ f, contrast: Number(contrast.toFixed(4)), deltaX, deltaP: Number(deltaP.toFixed(3)), product: Number(product.toFixed(4)) });
      this.log(`  f=${f}: contrast=${contrast.toFixed(4)}, Δx=${deltaX.toFixed(3)}, Δp=${deltaP.toFixed(3)}, Δx·Δp=${product.toFixed(4)}`);
      this.showColor('#808080'); await this.sleep(200);
    }

    const products = measurements.map(m => m.product);
    const minProduct = Math.min(...products);
    const maxProduct = Math.max(...products);
    const snrDr = (cal.snrBits || 0) * (cal.dr || 0);
    const bounded = minProduct > 0.1; // Therethis.t('s_a_lower_bound_also_compute_s')ПОДТВЕРЖДЕНА' : 'слабая'}`, bounded ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage49 = { measurements, minProduct, maxProduct, bounded, snrDr: Number(snrDr.toFixed(0)) };
}

export function render(r) {
if (r.stage49) { try {
      const s = r.stage49;
      this.rv('rv-nvg49-prod', `[${s.minProduct?.toFixed(3)}, ${s.maxProduct?.toFixed(3)}]`, 'ok');
      this.rv('rv-nvg49-min', `≥ ${s.minProduct?.toFixed(4)}`, s.bounded ? 'ok' : 'warn');
      this.rv('rv-nvg49-snrdr', s.snrDr, 'ok');
      const g = document.getElementById('g-s49');
      if (s.bounded) { g.textContent='✅ NVG #50: Δx·Δp ≥ const подтверждено!'; g.className='grade pass'; }
      else { g.textContent='⚠️ Неопределённость слабая'; g.className='grade partial'; }
    } catch(e) { console.error('stage49 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.bounded)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'min=' + (d.minProduct||0).toFixed(3))(d); } catch(e) { return '—'; }
}
