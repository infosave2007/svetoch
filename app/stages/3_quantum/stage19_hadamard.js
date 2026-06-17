// Stage 19: Had

export async function run() {
this.setRun(this.t('etap'), this.t('ventil_adamara_h'), 99.97);
    this.showColor('#808080');
    await this.sleep(800);

    // |0⟩ state: uniform brightness in left quadrant, dark in right
    this.log(this.t('levyy_kvadrant'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#fff';ctx.fillRect(0,0,w/2,h);
    });
    await this.sleep(1000);
    const f0 = await this.captureStable(8, 60);
    const q0L = this.quadrantMean(f0, 'left');
    const q0R = this.quadrantMean(f0, 'right');
    this.log(`  |0⟩: L=${q0L.toFixed(4)} R=${q0R.toFixed(4)}`);

    this.showColor('#808080'); await this.sleep(600);

    // Apply Hadamard: 45° diagonal grating
    this.log(this.t('h_reshyotka'));
    this.showPattern((ctx, w, h) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
      const freq = 16 * dpr;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x += 2) {
          const proj = (x + y) / Math.SQRT2;
          const v = Math.round(127 + 127 * Math.sin(2*Math.PI*proj/freq));
          ctx.fillStyle=`rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, 2, 1);
        }
      }
    });
    await this.sleep(1200);
    const fH = await this.captureStable(10, 60);
    const qHL = this.quadrantMean(fH, 'left');
    const qHR = this.quadrantMean(fH, 'right');
    const balance0 = Math.min(qHL,qHR) / Math.max(qHL,qHR, 0.001);
    this.log(`  H|0⟩: L=${qHL.toFixed(4)} R=${qHR.toFixed(4)} bal=${balance0.toFixed(3)}`);

    this.showColor('#808080'); await this.sleep(600);

    // |1⟩ state: dark in left, bright in right
    this.log(this.t('pravyy_kvadrant'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#fff';ctx.fillRect(w/2,0,w/2,h);
    });
    await this.sleep(1000);
    const f1 = await this.captureStable(8, 60);
    const q1L = this.quadrantMean(f1, 'left');
    const q1R = this.quadrantMean(f1, 'right');
    this.log(`  |1⟩: L=${q1L.toFixed(4)} R=${q1R.toFixed(4)}`);

    this.showColor('#808080'); await this.sleep(600);

    // Apply H to |1⟩: 45° grating rotated
    this.log(this.t('h_reshyotka_1'));
    this.showPattern((ctx, w, h) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
      const freq = 16 * dpr;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x += 2) {
          const proj = (x - y) / Math.SQRT2;
          const v = Math.round(127 + 127 * Math.sin(2*Math.PI*proj/freq));
          ctx.fillStyle=`rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, 2, 1);
        }
      }
    });
    await this.sleep(1200);
    const fH1 = await this.captureStable(10, 60);
    const qH1L = this.quadrantMean(fH1, 'left');
    const qH1R = this.quadrantMean(fH1, 'right');
    const balance1 = Math.min(qH1L,qH1R) / Math.max(qH1L,qH1R, 0.001);
    this.log(`  H|1⟩: L=${qH1L.toFixed(4)} R=${qH1R.toFixed(4)} bal=${balance1.toFixed(3)}`);

    const avgBalance = (balance0 + balance1) / 2;
    this.log(this.t('adamar_sredniy_balans_ideal', {var0: avgBalance.toFixed(3)}));
    this.log(this.t('h', {var0: avgBalance > 0.6 ? 'работает' : 'слабый'}), avgBalance > 0.6 ? 'ok' : 'warn');

    this.results.stage19 = {
      q0L, q0R, qHL, qHR, balance0,
      q1L, q1R, qH1L, qH1R, balance1,
      avgBalance
    };
}

export function render(r) {
if (r.stage19) { try {
      const s = r.stage19;
      this.rv('rv-had-bal', (s.balance0*100).toFixed(1)+'%', s.balance0 > 0.6 ? 'ok' : 'warn');
      this.rv('rv-had-bal1', (s.balance1*100).toFixed(1)+'%', s.balance1 > 0.6 ? 'ok' : 'warn');
      this.rv('rv-had-super', (s.avgBalance*100).toFixed(1)+'%', s.avgBalance > 0.6 ? 'ok' : 'warn');
      const g = document.getElementById('g-s19');
      if (s.avgBalance > 0.7) { g.textContent=this.t('h_sozdayot_superpozitsiyu'); g.className='grade pass'; }
      else if (s.avgBalance > 0.5) { g.textContent=this.t('chastichnyy_adamar'); g.className='grade partial'; }
      else { g.textContent=this.t('net_superpozitsii'); g.className='grade fail'; }
      this.drawHadamardChart(s);
    } catch(e) { console.error('stage19 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.avgBalance > 0.5)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'bal=' + (d.avgBalance||0).toFixed(3))(d); } catch(e) { return '—'; }
}
