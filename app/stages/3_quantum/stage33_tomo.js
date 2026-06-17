// Stage 33: ρ-Tomo

export async function run() {
this.setRun(this.t('etap'), 'State Tomography...', 106);
    this.showColor('#808080');
    await this.sleep(800);

    const states = [
      { name: '|0⟩', color: 'rgb(200,200,200)' },
      { name: '|+⟩', color: 'rgb(128,128,128)' },
    ];

    const tomographyResults = [];

    for (const state of states) {
      this.log(this.t('tomografiya', {var0: state.name}));
      const expectations = {};

      // Basis Z: vertical stripes
      this.setRun(this.t('etap'), `${state.name} basis Z`, 106.1);
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 16*dpr) {
          ctx.fillStyle = state.color;
          ctx.fillRect(x, 0, 8*dpr, h);
        }
      });
      await this.sleep(800);
      const fZ = await this.captureStable(6, 40);
      const zL = this.quadrantMean(fZ, 'left');
      const zR = this.quadrantMean(fZ, 'right');
      expectations.sigmaZ = (zL + zR) > 0 ? (zL - zR) / (zL + zR) : 0;

      // Basis X: horizontal stripes
      this.setRun(this.t('etap'), `${state.name} basis X`, 106.2);
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 16*dpr) {
          ctx.fillStyle = state.color;
          ctx.fillRect(0, y, w, 8*dpr);
        }
      });
      await this.sleep(800);
      const fX = await this.captureStable(6, 40);
      const xTop = this.regionMeanArea(fX, 0, 0.25, 1, 0.5);
      const xBot = this.regionMeanArea(fX, 0, 0.5, 1, 0.75);
      expectations.sigmaX = (xTop + xBot) > 0 ? (xTop - xBot) / (xTop + xBot) : 0;

      // Basis Y: 45° diagonal stripes
      this.setRun(this.t('etap'), `${state.name} basis Y`, 106.3);
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w + h; x += 16*dpr) {
          ctx.beginPath();
          ctx.moveTo(x, 0); ctx.lineTo(x - h, h);
          ctx.strokeStyle = state.color; ctx.lineWidth = 4*dpr;
          ctx.stroke();
        }
      });
      await this.sleep(800);
      const fY = await this.captureStable(6, 40);
      const yDiag1 = this.regionMeanArea(fY, 0, 0, 0.5, 0.5);
      const yDiag2 = this.regionMeanArea(fY, 0.5, 0.5, 1, 1);
      expectations.sigmaY = (yDiag1 + yDiag2) > 0 ? (yDiag1 - yDiag2) / (yDiag1 + yDiag2) : 0;

      // Density matrix ρ = (I + ⟨σx⟩σx + ⟨σy⟩σy + ⟨σz⟩σz) / 2
      const sx = expectations.sigmaX, sy = expectations.sigmaY, sz = expectations.sigmaZ;
      const blochR = Math.sqrt(sx*sx + sy*sy + sz*sz);
      const purity = (1 + blochR*blochR) / 2;

      this.log(`  ⟨σx⟩=${sx.toFixed(3)}, ⟨σy⟩=${sy.toFixed(3)}, ⟨σz⟩=${sz.toFixed(3)}`);
      this.log(`  |r|=${blochR.toFixed(3)}, Tr(ρ²)=${purity.toFixed(3)}`);

      tomographyResults.push({ state: state.name, expectations, blochR, purity });
      this.showColor('#808080'); await this.sleep(500);
    }

    const avgPurity = tomographyResults.reduce((s,t)=>s+t.purity,0) / tomographyResults.length;
    const avgBloch = tomographyResults.reduce((s,t)=>s+t.blochR,0) / tomographyResults.length;

    this.log(this.t('tomografiya_avgtr_avgr', {var0: avgPurity.toFixed(3), var1: avgBloch.toFixed(3)}));
    this.log(this.t('sostoyanie', {var0: avgPurity > 0.6 ? 'когерентное' : 'смешанное'}), avgPurity > 0.6 ? 'ok' : 'warn');

    this.results.stage33 = { tomographyResults, avgPurity, avgBloch };
}

export function render(r) {
if (r.stage33) { try {
      const s = r.stage33;
      this.rv('rv-tomo-pur', (s.avgPurity||0).toFixed(3), s.avgPurity>0.5?'ok':'warn');
      this.rv('rv-tomo-bloch', (s.avgBloch||0).toFixed(3), s.avgBloch>0.3?'ok':'warn');
      const g = document.getElementById('g-s33');
      if (s.avgPurity>0.5) { g.textContent=this.t('tomografiya_rabotaet'); g.className='grade pass'; }
      else { g.textContent=this.t('nizkaya_chistota'); g.className='grade fail'; }
    } catch(e) { console.error('stage33 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.avgPurity > 0.5)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'Tr(ρ²)=' + (d.avgPurity||0).toFixed(3))(d); } catch(e) { return '—'; }
}
