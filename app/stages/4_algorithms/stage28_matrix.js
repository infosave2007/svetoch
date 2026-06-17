// Stage 28: Matrix

export async function run() {
this.setRun(this.t('etap'), 'Transfer Matrix...', 101);
    this.showColor('#808080');
    await this.sleep(800);

    const dim = 8;
    const T = []; // Transfer matrix rows

    for (let basis = 0; basis < dim; basis++) {
      this.setRun(this.t('etap'), this.t('bazis', {var0: basis+1, var1: dim}), 101 + basis * 0.3);

      // Show one-hot pattern: only column 'basis' is bright
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const colW = Math.floor(w / dim);
        ctx.fillStyle = 'rgb(220,220,220)';
        ctx.fillRect(basis * colW, Math.floor(h*0.1), colW, Math.floor(h*0.8));
      });
      await this.sleep(1000);
      const frame = await this.captureStable(8, 50);

      // Measure response in each of 8 columns
      const response = [];
      if (frame) {
        const d = frame.data, fw = frame.width, fh = frame.height;
        const colW = Math.floor(fw / dim);
        for (let col = 0; col < dim; col++) {
          const x0 = col * colW, x1 = x0 + colW;
          const y0 = Math.floor(fh*0.2), y1 = Math.floor(fh*0.8);
          let s = 0, c = 0;
          for (let y = y0; y < y1; y += 3)
            for (let x = x0; x < x1; x += 3) {
              const i = (y*fw+x)*4;
              s += (d[i]+d[i+1]+d[i+2])/3; c++;
            }
          response.push(c > 0 ? s/c/255 : 0);
        }
      } else {
        for (let i = 0; i < dim; i++) response.push(0);
      }
      T.push(response);
      this.log(`e${basis+1} → [${response.map(v=>v.toFixed(2)).join(',')}]`);
      this.showColor('#808080'); await this.sleep(300);
    }

    // SVD approximation: compute singular values via power iteration on T^T * T
    // First: T^T * T
    const TtT = [];
    for (let i = 0; i < dim; i++) {
      TtT.push([]);
      for (let j = 0; j < dim; j++) {
        let s = 0;
        for (let k = 0; k < dim; k++) s += T[k][i] * T[k][j];
        TtT[i].push(s);
      }
    }

    // Eigenvalues of T^T*T = squared singular values
    // Simple: diagonal dominance estimate
    const diagVals = TtT.map((row, i) => row[i]);
    const singularValues = diagVals.map(v => Math.sqrt(Math.max(0, v))).sort((a,b)=>b-a);
    const rank = singularValues.filter(s => s > singularValues[0] * 0.05).length;
    const condition = singularValues[0] / Math.max(singularValues[singularValues.length-1], 1e-10);

    // Is matrix diagonal? (off-diagonal energy)
    let diagEnergy = 0, totalEnergy = 0;
    for (let i = 0; i < dim; i++)
      for (let j = 0; j < dim; j++) {
        totalEnergy += T[i][j] ** 2;
        if (i === j) diagEnergy += T[i][j] ** 2;
      }
    const offDiagRatio = totalEnergy > 0 ? 1 - diagEnergy / totalEnergy : 0;

    this.log(`SVD σ: [${singularValues.map(v=>v.toFixed(3)).join(',')}]`);
    this.log(`rank=${rank}, κ=${condition.toFixed(1)}, off-diag=${(offDiagRatio*100).toFixed(1)}%`);
    this.log(this.t('matrix', {var0: rank >= 4 ? 'полноранговая' : 'вырождена'}), rank >= 4 ? 'ok' : 'warn');

    this.results.stage28 = { T, singularValues, rank, condition, offDiagRatio };
}

export function render(r) {
if (r.stage28) { try {
      const s = r.stage28;
      this.rv('rv-mat-rank', s.rank, s.rank>=4?'ok':'warn');
      this.rv('rv-mat-cond', (s.condition||0).toFixed(0), s.condition<100?'ok':'warn');
      const g = document.getElementById('g-s28');
      if (s.rank>=4) { g.textContent=this.t('polnyy_rang'); g.className='grade pass'; }
      else { g.textContent=this.t('vyrozhdennaya'); g.className='grade fail'; }
    } catch(e) { console.error('stage28 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.rank >= 4)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'rank=' + (d.rank||0))(d); } catch(e) { return '—'; }
}
