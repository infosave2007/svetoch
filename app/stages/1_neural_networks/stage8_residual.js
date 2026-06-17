// Stage 8: Res

export async function run() {
this.setRun(this.t('etap'), 'Residual Connection...', 97);
    this.showColor('#808080');
    await this.sleep(800);

    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;
    const gamma = cal.gamma || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;

    // Reference white
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));
    this.showColor('#808080'); await this.sleep(600);

    // Test superposition: show patterns A, B, and A+B (blended)
    // Pattern A: dim (30% brightness)
    // Pattern B: medium (50% brightness)
    // Expected: A+B ≈ 80% (linearity of optical superposition)
    const testLevels = [
      { a: 0.15, b: 0.15, label: '15%+15%→30%' },
      { a: 0.20, b: 0.30, label: '20%+30%→50%' },
      { a: 0.25, b: 0.25, label: '25%+25%→50%' },
      { a: 0.30, b: 0.30, label: '30%+30%→60%' },
      { a: 0.10, b: 0.40, label: '10%+40%→50%' },
      { a: 0.35, b: 0.35, label: '35%+35%→70%' },
    ];

    const measured = []; // measured A+B
    const expected = []; // measured_A + measured_B (each separately)

    for (let t = 0; t < testLevels.length; t++) {
      const { a, b, label } = testLevels[t];
      this.setRun(this.t('etap'), this.t('test', {var0: t+1, var1: testLevels.length, var2: label}), 97 + t * 0.3);

      // Measure A alone
      const vA = Math.round(a * 255);
      this.showColor(`rgb(${vA},${vA},${vA})`);
      await this.sleep(500);
      const fA = await this.captureStable(5, 50);
      const mA = (this.regionMean(fA) - blackLevel) / Math.max(refBright - blackLevel, 1);
      this.showColor('#808080'); await this.sleep(300);

      // Measure B alone
      const vB = Math.round(b * 255);
      this.showColor(`rgb(${vB},${vB},${vB})`);
      await this.sleep(500);
      const fB = await this.captureStable(5, 50);
      const mB = (this.regionMean(fB) - blackLevel) / Math.max(refBright - blackLevel, 1);
      this.showColor('#808080'); await this.sleep(300);

      // Measure A+B combined
      const vAB = Math.round(Math.min(1, a + b) * 255);
      this.showColor(`rgb(${vAB},${vAB},${vAB})`);
      await this.sleep(500);
      const fAB = await this.captureStable(5, 50);
      const mAB = (this.regionMean(fAB) - blackLevel) / Math.max(refBright - blackLevel, 1);
      this.showColor('#808080'); await this.sleep(300);

      expected.push(mA + mB);
      measured.push(mAB);
    }

    // R² with proper linear fit: measured ≈ α * expected + β
    const n = expected.length;
    const meanE = expected.reduce((a,b) => a+b, 0) / n;
    const meanM = measured.reduce((a,b) => a+b, 0) / n;
    let ssXY = 0, ssXX = 0;
    for (let i = 0; i < n; i++) {
      ssXY += (expected[i] - meanE) * (measured[i] - meanM);
      ssXX += (expected[i] - meanE) ** 2;
    }
    const alpha = ssXX > 0 ? ssXY / ssXX : 1;
    const beta = meanM - alpha * meanE;
    // R² = 1 - SS_res / SS_tot (using fitted line)
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = alpha * expected[i] + beta;
      ssRes += (measured[i] - predicted) ** 2;
      ssTot += (measured[i] - meanM) ** 2;
    }
    const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    // Scale factor
    const scale = meanE > 0 ? meanM / meanE : 1;

    this.log(`Residual R²=${(r2*100).toFixed(1)}%, α=${alpha.toFixed(3)}, β=${beta.toFixed(3)}, scale=${scale.toFixed(3)}`);
    this.log(this.t('superpozitsiya', {var0: r2 > 0.4 ? 'работает' : 'нелинейна'}), r2 > 0.4 ? 'ok' : 'warn');

    this.results.stage8 = {
      expected, measured, r2, scale, alpha, beta, testLevels
    };
}

export function render(r) {
if (r.stage8) { try {
      const s = r.stage8;
      this.rv('rv-res-r2', (s.r2*100).toFixed(1)+'%', s.r2>0.7?'ok':s.r2>0.4?'warn':'bad');
      this.rv('rv-res-scale', s.scale.toFixed(3), Math.abs(s.scale-1)<0.3?'ok':'warn');
      const g = document.getElementById('g-s8');
      if (s.r2 > 0.7) { g.textContent=this.t('superpozitsiya_lineyna'); g.className='grade pass'; }
      else if (s.r2 > 0.4) { g.textContent=this.t('chastichnaya_lineynost'); g.className='grade partial'; }
      else { g.textContent=this.t('superpozitsiya_nelineyna'); g.className='grade fail'; }
      this.drawResChart(s);
    } catch(e) { console.error('stage8 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.r2 > 0.4)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'R²=' + (d.r2||0).toFixed(3))(d); } catch(e) { return '—'; }
}
