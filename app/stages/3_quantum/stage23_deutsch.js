// Stage 23: DJ

export async function run() {
this.setRun(this.t('etap'), this.t('doychzhozha'), 99.991);
    this.showColor('#808080');
    await this.sleep(800);

    // Deutsch-Jozsa: 1 query distinguishes constant vs balanced
    // Key: use FULL-SCREEN halves with MAX contrast for balanced
    // and uniform brightness for constant → measureNBins(frame, 2)
    const results = [];

    // Test 1: Constant f(x)=0 → entire screen bright
    this.log(this.t('fconstx_ves_ekran_yarkiy'));
    this.showColor('#c8c8c8');
    await this.sleep(1000);
    const fConst = await this.captureStable(8, 60);
    const binsConst = this.measureNBins(fConst, 2);
    const constRatio = Math.abs(binsConst[0] - binsConst[1]) / (Math.max(...binsConst) + 1e-6);
    const isConst = constRatio < 0.15;
    results.push({type:'const', bins: binsConst, ratio: constRatio, correct: isConst});
    this.log(this.t('bins_ratio', {var0: binsConst.map(v=>v.toFixed(3)).join(','), var1: constRatio.toFixed(4), var2: isConst?'CONST ✓':'ОШИБКА'}));

    this.showColor('#808080'); await this.sleep(600);

    // Test 2: Balanced f(x)=x%2 → left half bright, right half dark
    this.log(this.t('fbalanced_lyarkiy_rtyomnyy'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w/2, h);
    });
    await this.sleep(1000);
    const fBal1 = await this.captureStable(8, 60);
    const binsBal1 = this.measureNBins(fBal1, 2);
    const bal1Ratio = Math.abs(binsBal1[0] - binsBal1[1]) / (Math.max(...binsBal1) + 1e-6);
    const isBal1 = bal1Ratio > 0.15;
    results.push({type:'balanced', bins: binsBal1, ratio: bal1Ratio, correct: isBal1});
    this.log(this.t('bins_ratio', {var0: binsBal1.map(v=>v.toFixed(3)).join(','), var1: bal1Ratio.toFixed(4), var2: isBal1?'BALANCED ✓':'ОШИБКА'}));

    this.showColor('#808080'); await this.sleep(600);

    // Test 3: Constant f(x)=1 → entire screen dark
    this.log(this.t('fconstx_ves_ekran_tyomnyy'));
    this.showColor('#282828');
    await this.sleep(1000);
    const fConst2 = await this.captureStable(8, 60);
    const binsConst2 = this.measureNBins(fConst2, 2);
    const const2Ratio = Math.abs(binsConst2[0] - binsConst2[1]) / (Math.max(...binsConst2) + 1e-6);
    const isConst2 = const2Ratio < 0.15;
    results.push({type:'const', bins: binsConst2, ratio: const2Ratio, correct: isConst2});
    this.log(this.t('bins_ratio', {var0: binsConst2.map(v=>v.toFixed(3)).join(','), var1: const2Ratio.toFixed(4), var2: isConst2?'CONST ✓':'ОШИБКА'}));

    this.showColor('#808080'); await this.sleep(600);

    // Test 4: Balanced f(x)=(x+1)%2 → left dark, right bright
    this.log(this.t('fbalanced_ltyomnyy_ryarkiy'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w/2, h);
    });
    await this.sleep(1000);
    const fBal2 = await this.captureStable(8, 60);
    const binsBal2 = this.measureNBins(fBal2, 2);
    const bal2Ratio = Math.abs(binsBal2[0] - binsBal2[1]) / (Math.max(...binsBal2) + 1e-6);
    const isBal2 = bal2Ratio > 0.15;
    results.push({type:'balanced', bins: binsBal2, ratio: bal2Ratio, correct: isBal2});
    this.log(this.t('bins_ratio', {var0: binsBal2.map(v=>v.toFixed(3)).join(','), var1: bal2Ratio.toFixed(4), var2: isBal2?'BALANCED ✓':'ОШИБКА'}));

    const accuracy = results.filter(r => r.correct).length / results.length;
    this.log(this.t('doychzhozha_za_zapros_kazhdyy', {var0: (accuracy*100).toFixed(0)}), accuracy >= 0.75 ? 'ok' : 'warn');

    this.results.stage23 = { results, accuracy, N: 2 };
}

export function render(r) {
if (r.stage23) { try {
      const s = r.stage23;
      const constOK = s.results.filter(r=>r.type==='const'&&r.correct).length;
      const balOK = s.results.filter(r=>r.type==='balanced'&&r.correct).length;
      this.rv('rv-dj-const', `${constOK}/2`, constOK===2?'ok':'warn');
      this.rv('rv-dj-bal', `${balOK}/2`, balOK===2?'ok':'warn');
      this.rv('rv-dj-speed', `1 vs ${s.N/2+1}`, s.accuracy>=0.75?'ok':'warn');
      const g = document.getElementById('g-s23');
      if (s.accuracy >= 1.0) { g.textContent=this.t('doychzhozha_1'); g.className='grade pass'; }
      else if (s.accuracy >= 0.75) { g.textContent=this.t('tochnost'); g.className='grade partial'; }
      else { g.textContent=this.t('ne_rabotaet'); g.className='grade fail'; }
      this.drawDJChart(s);
    } catch(e) { console.error('stage23 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.accuracy >= 0.75)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.accuracy*100||0).toFixed(0) + '%')(d); } catch(e) { return '—'; }
}
