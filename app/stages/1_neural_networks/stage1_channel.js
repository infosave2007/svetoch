// Stage 1: Канал

export async function run() {
this.setRun(this.t('etap'), this.t('opticheskiy_kanal'), 30);
    this.showColor('#808080');
    await this.sleep(800);

    const sizes = [32, 16, 8];
    const contrasts = {};

    for (let si = 0; si < sizes.length; si++) {
      const sz = sizes[si];
      this.setRun(this.t('etap'), this.t('poloski_px', {var0: sz}), 32 + si * 5);
      this.log(this.t('poloski_px_1', {var0: sz}));

      // Show vertical stripes
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        const pxSz = sz * dpr;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += pxSz * 2) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, 0, pxSz, h);
        }
      });
      await this.sleep(1000);  // Longer settle for stripes
      const frame = await this.captureStable(6, 60);
      contrasts[sz] = this.measureStripContrast(frame);
      this.log(this.t('kontrast', {var0: contrasts[sz].toFixed(4)}), contrasts[sz] > 0.02 ? 'ok' : 'warn');

      // Gray between (longer)
      this.showColor('#808080');
      await this.sleep(800);
    }

    // Gradient
    this.setRun(this.t('etap'), this.t('gradient'), 48);
    this.showPattern((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#000'); g.addColorStop(1, '#fff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    await this.sleep(800);
    const gradFrame = await this.captureStable(5, 60);
    const gradData = this.measureGradient(gradFrame);
    this.log(this.t('gradient_r', {var0: (gradData.r2*100).toFixed(1)}), gradData.r2 > 0.5 ? 'ok' : 'warn');

    this.results.stage1 = { contrasts, gradR2: gradData.r2, gradProfile: gradData.profile };
    this.showColor('#808080');
    await this.sleep(500);
}

export function render(r) {
if (r.stage1) { try {
      const s = r.stage1;
      for (const sz of [32,16,8]) {
        const v = s.contrasts[sz]||0;
        this.rv(`rv-c${sz}`, v.toFixed(4), v>0.03?'ok':v>0.01?'warn':'bad');
      }
      this.rv('rv-grad', (s.gradR2*100).toFixed(1)+'%', s.gradR2>0.7?'ok':s.gradR2>0.4?'warn':'bad');
      const minC = Math.min(s.contrasts[32]||0, s.contrasts[16]||0);
      const g = document.getElementById('g-s1');
      if (minC>0.02&&s.gradR2>0.4) { g.textContent=this.t('kanal_rabotaet'); g.className='grade pass'; }
      else if (minC>0.005||s.gradR2>0.2) { g.textContent=this.t('slabyy_kanal'); g.className='grade partial'; }
      else { g.textContent=this.t('net_kontrasta'); g.className='grade fail'; }
      this.drawGradChart(s);
    } catch(e) { console.error('stage1 display:', e); } }
}


export function check(d) {
  try { return (d => d && (d.contrasts?.['32']||0) > 0.01)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'C(32)=' + (d.contrasts?.['32']||0).toFixed(4))(d); } catch(e) { return '—'; }
}
