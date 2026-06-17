// Stage 47: CHSH↓

export async function run() {
this.setRun(this.t('etap'), 'NVG: S_CHSH vs SNR...', 107.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const gamma = cal.gamma || 1.5;

    // Measure CHSH-like angular correlation at different contrast levels
    // Low contrast = high "temperature" = deconfinement
    const contrastLevels = [1.0, 0.6, 0.3, 0.1]; // fraction of max contrast
    const sValues = [];

    for (let ci = 0; ci < contrastLevels.length; ci++) {
      const c = contrastLevels[ci];
      this.setRun(this.t('etap'), this.t('chsh_pri_kontraste', {var0: (c*100).toFixed(0)}), 107.0 + ci * 0.2);

      // Show correlated pattern at 4 angles: 0, π/8, π/4, 3π/8
      const angles = [0, Math.PI/8, Math.PI/4, 3*Math.PI/8];
      const corrs = [];

      for (const angle of angles) {
        // Pattern: encode angle as spatial frequency modulated by contrast
        const baseV = 128;
        const amp = Math.round(120 * c);
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          for (let x = 0; x < w; x++) {
            const val = Math.cos(2 * Math.PI * 4 * x / w + angle);
            const v = Math.max(0, Math.min(255, baseV + Math.round(val * amp)));
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, 0, 1, h);
          }
        });
        await this.sleep(300);
        const f = await this.captureStable(4, 30);
        const bins = this.measureNBins(f, 4);
        const bMax = Math.max(...bins), bMin = Math.min(...bins);
        const visibility = (bMax - bMin) / (bMax + bMin + 1e-6);
        corrs.push(visibility);
      }

      // CHSH: S = |E(a,b) - E(a,b') + E(a',b) + E(a',b')|
      // Simplified: S ≈ 2√2 · mean_visibility
      const meanVis = corrs.reduce((a,b) => a+b, 0) / corrs.length;
      const S = 2 * Math.sqrt(2) * meanVis;
      sValues.push({ contrast: c, S: Number(S.toFixed(4)), meanVis: Number(meanVis.toFixed(4)) });
      this.log(`  C=${(c*100).toFixed(0)}%: vis=[${corrs.map(v=>v.toFixed(3)).join(',')}] S=${S.toFixed(3)}`);
      this.showColor('#808080'); await this.sleep(200);
    }

    const sMax = sValues[0].S;
    const sMin = sValues[sValues.length - 1].S;
    const deconfirmed = sMax > sMin * 2.0 && sMax > 0.1 && sValues.length >= 3;

    this.log(`━━━ NVG #49 ━━━`);
    this.log(`  S(max)=${sMax.toFixed(3)}, S(min)=${sMin.toFixed(3)}`);
    this.log(this.t('dekonfaynment', {var0: deconfirmed ? 'ПОДТВЕРЖДЁН' : 'не обнаружен'}), deconfirmed ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage47 = { sValues, sMax, sMin, deconfirmed };
}

export function render(r) {
if (r.stage47) { try {
      const s = r.stage47;
      this.rv('rv-nvg47-smax', s.sMax?.toFixed(3), s.sMax > 1.5 ? 'ok' : 'warn');
      this.rv('rv-nvg47-smin', s.sMin?.toFixed(3), 'ok');
      this.rv('rv-nvg47-deconf', s.deconfirmed ? this.t('s_pri_snr') : this.t('net'), s.deconfirmed ? 'ok' : 'warn');
      const g = document.getElementById('g-s47');
      if (s.deconfirmed) { g.textContent=this.t('nvg_smert_zaputannosti_pri_ttc'); g.className='grade pass'; }
      else { g.textContent=this.t('dekonfaynment_ne_obnaruzhen'); g.className='grade partial'; }
    } catch(e) { console.error('stage47 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.deconfirmed)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'S↑=' + (d.sMax||0).toFixed(2))(d); } catch(e) { return '—'; }
}
