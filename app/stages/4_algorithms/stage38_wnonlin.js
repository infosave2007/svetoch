// Stage 38: Entgl

export async function run() {
this.setRun(this.t('etap'), this.t('wnelineynost'), 101.01);
    this.showColor('#808080');
    await this.sleep(800);

    // In-situ calibration
    this.showColor('#000000'); await this.sleep(500);
    const fDark = await this.captureStable(8, 50);
    const darkBase = this.regionMean(fDark);
    this.showColor('#808080'); await this.sleep(300);

    // 5 intensity levels: 10%, 25%, 50%, 75%, 100%
    const levels = [0.10, 0.25, 0.50, 0.75, 1.00];
    const results = [];

    for (const frac of levels) {
      this.setRun(this.t('etap'), `I=${(frac*100).toFixed(0)}%...`, 101.01 + frac * 0.3);

      const vA = Math.round(frac * 200); // Pattern A: left half bright
      const vB = Math.round(frac * 200); // Pattern B: right half bright
      const vAB = Math.min(255, Math.round(frac * 200 * 2)); // A+B: full bright (clamped)
      // Use stripe patterns instead to avoid clipping
      const vStripeA = Math.round(frac * 128);  // half-amplitude stripes
      const vStripeB = Math.round(frac * 128);
      const vCombined = Math.round(frac * 255);  // full amplitude = A+B

      // Measure Pattern A (horizontal stripes)
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const stripeH = Math.max(4, Math.floor(h / 16));
        for (let y = 0; y < h; y += stripeH * 2) {
          ctx.fillStyle = `rgb(${vStripeA},${vStripeA},${vStripeA})`;
          ctx.fillRect(0, y, w, stripeH);
        }
      });
      await this.sleep(600);
      const frameA = await this.captureStable(8, 50);
      const meanA = this.regionMean(frameA) - darkBase;

      // Measure Pattern B (vertical stripes)
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const stripeW = Math.max(4, Math.floor(w / 16));
        for (let x = 0; x < w; x += stripeW * 2) {
          ctx.fillStyle = `rgb(${vStripeB},${vStripeB},${vStripeB})`;
          ctx.fillRect(x, 0, stripeW, h);
        }
      });
      await this.sleep(600);
      const frameB = await this.captureStable(8, 50);
      const meanB = this.regionMean(frameB) - darkBase;

      // Measure Pattern A+B (grid = horizontal + vertical stripes)
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const stripeH = Math.max(4, Math.floor(h / 16));
        const stripeW = Math.max(4, Math.floor(w / 16));
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x += 4) {
            const inH = (Math.floor(y / stripeH) % 2 === 0);
            const inV = (Math.floor(x / stripeW) % 2 === 0);
            const v = Math.min(255, (inH ? vStripeA : 0) + (inV ? vStripeB : 0));
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, 4, 1);
          }
        }
      });
      await this.sleep(600);
      const frameAB = await this.captureStable(8, 50);
      const meanAB = this.regionMean(frameAB) - darkBase;

      // Deviation from linear superposition
      const linear = meanA + meanB;
      const delta = meanAB - linear;
      const relDev = linear > 0.1 ? (delta / linear) * 100 : 0;

      results.push({
        frac, vStripeA, vStripeB,
        meanA, meanB, meanAB, linear,
        delta, relDev
      });

      this.log(`  I=${(frac*100).toFixed(0)}%: A=${meanA.toFixed(2)} B=${meanB.toFixed(2)} A+B=${meanAB.toFixed(2)} lin=${linear.toFixed(2)} δ=${delta.toFixed(3)} (${relDev.toFixed(1)}%)`);
      this.showColor('#808080'); await this.sleep(200);
    }

    // Fit δ = α·I² (quadratic) vs δ = β·I (linear)
    // Using least squares: log(|δ|) vs log(I)
    const validPts = results.filter(r => Math.abs(r.delta) > 0.001 && r.frac > 0);
    let exponent = 0;
    if (validPts.length >= 3) {
      const logI = validPts.map(r => Math.log(r.frac));
      const logD = validPts.map(r => Math.log(Math.abs(r.delta)));
      // Linear regression log(δ) = n·log(I) + c → exponent n
      const n = logI.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < n; i++) {
        sx += logI[i]; sy += logD[i];
        sxy += logI[i] * logD[i]; sx2 += logI[i] * logI[i];
      }
      exponent = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    }

    // NVG: exponent ≈ 2 (δ ∝ I²), Linear optics: exponent ≈ 1 (δ ∝ I)
    const isNonlinear = exponent > 1.5;
    const isQuadratic = exponent > 1.8 && exponent < 2.5;

    this.log(this.t('wpole_i', {var0: exponent.toFixed(2)}));
    this.log(this.t('n_lineynaya_optika_n_nvg_w'));
    this.log(this.t('key', {var0: isQuadratic ? '🔴 NVG-НЕЛИНЕЙНОСТЬ!' : isNonlinear ? '⚠️ нелинейность, но не квадратичная' : '✅ линейная оптика (ожидаемо на этом масштабе)'}), isQuadratic ? 'ok' : 'warn');

    this.results.stage38 = { results, exponent, isNonlinear, isQuadratic };
}

export function render(r) {
if (r.stage38) { try {
      const s = r.stage38;
      this.rv('rv-entgl-exp', (s.exponent||0).toFixed(2), s.exponent>0.5?'ok':'warn');
      const g = document.getElementById('g-s38');
      if (s.exponent>0.5) { g.textContent=this.t('nelineynost'); g.className='grade pass'; }
      else { g.textContent=this.t('lineynyy'); g.className='grade fail'; }
    } catch(e) { console.error('stage38 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.exponent > 0.5)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'n=' + (d.exponent||0).toFixed(2))(d); } catch(e) { return '—'; }
}
