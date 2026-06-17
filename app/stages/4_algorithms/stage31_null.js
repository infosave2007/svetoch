// Stage 31: Null

export async function run() {
this.setRun(this.t('etap'), 'Null-test...', 104);
    this.showColor('#808080');
    await this.sleep(800);

    this.log(this.t('nulltest_proverka_bez_patterno'));
    this.log(this.t('vse_testy_dolzhny_provalitsya_'));

    const nullResults = {};
    let falsePositives = 0;
    const totalChecks = 5;

    // Check 1: Contrast on gray (should be ~0)
    this.setRun(this.t('etap'), this.t('null_kontrast'), 104.1);
    this.showColor('#808080');
    await this.sleep(800);
    const fGray = await this.captureStable(8, 50);
    const nullContrast = this.measureStripContrast(fGray);
    const contrastPass = nullContrast > 0.05;
    if (contrastPass) falsePositives++;
    nullResults.contrast = { value: nullContrast, falsePositive: contrastPass };
    this.log(this.t('kontrast_na_serom', {var0: nullContrast.toFixed(4), var1: contrastPass ? '⚠️ ЛОЖНО-ПОЗИТИВНЫЙ' : '✓ ноль'}),
      contrastPass ? 'warn' : 'ok');

    // Check 2: Left-right difference on gray (should be ~0)
    this.setRun(this.t('etap'), 'Null: L-R...', 104.2);
    const qL = this.quadrantMean(fGray, 'left');
    const qR = this.quadrantMean(fGray, 'right');
    const lrDiff = Math.abs(qL - qR);
    // Threshold raised: camera vignetting causes natural L-R gradient ~0.15
    const lrPass = lrDiff > 0.25;
    if (lrPass) falsePositives++;
    nullResults.leftRight = { left: qL, right: qR, diff: lrDiff, falsePositive: lrPass };
    this.log(this.t('lr_raznitsa', {var0: lrDiff.toFixed(4), var1: lrPass ? '⚠️ ЛОЖНО-ПОЗИТИВНЫЙ' : '✓ виньетирование'}),
      lrPass ? 'warn' : 'ok');

    // Check 3: RGB correlation on gray (should be ~0 or undefined)
    this.setRun(this.t('etap'), 'Null: RGB...', 104.3);
    const nullRGB = this.regionMeanRGB(fGray);
    const rgSpread = Math.max(...nullRGB) - Math.min(...nullRGB);
    const rgbPass = rgSpread > 20;
    if (rgbPass) falsePositives++;
    nullResults.rgb = { r: nullRGB[0], g: nullRGB[1], b: nullRGB[2], spread: rgSpread, falsePositive: rgbPass };
    this.log(this.t('rgb_spred', {var0: rgSpread.toFixed(1), var1: rgbPass ? '⚠️ ЛОЖНО-ПОЗИТИВНЫЙ' : '✓ мало'}),
      rgbPass ? 'warn' : 'ok');

    // Check 4: Spatial variance on gray (should be ~0)
    this.setRun(this.t('etap'), 'Null: spatial var...', 104.4);
    const bins = this.measureNBins(fGray, 8);
    const meanB = bins.reduce((a,b)=>a+b,0) / 8;
    const spatVar = bins.reduce((s,v)=>s+(v-meanB)**2,0) / 8;
    // Threshold raised: lens vignetting causes natural gradient σ²~0.007
    const varPass = spatVar > 0.02;
    if (varPass) falsePositives++;
    nullResults.spatialVar = { bins, variance: spatVar, falsePositive: varPass };
    this.log(this.t('prostranstvennaya', {var0: spatVar.toFixed(6), var1: varPass ? '⚠️ ЛОЖНО-ПОЗИТИВНЫЙ' : '✓ ноль'}),
      varPass ? 'warn' : 'ok');

    // Check 5: 4-bin correlation with random vector (should be ~0)
    this.setRun(this.t('etap'), 'Null: correlation...', 104.5);
    const randomVec = [0.1, 0.9, 0.3, 0.7];
    const bins4 = this.measureNBins(fGray, 4);
    const nullCorr = Math.abs(this.pearsonCorr(bins4, randomVec));
    const corrPass = nullCorr > 0.5;
    if (corrPass) falsePositives++;
    nullResults.correlation = { value: nullCorr, falsePositive: corrPass };
    this.log(this.t('korr_s_random', {var0: nullCorr.toFixed(4), var1: corrPass ? '⚠️ ЛОЖНО-ПОЗИТИВНЫЙ' : '✓ мало'}),
      corrPass ? 'warn' : 'ok');

    const integrity = 1 - falsePositives / totalChecks;
    this.log(this.t('nulltest_lozhnopozitivnykh', {var0: falsePositives, var1: totalChecks}));
    this.log(this.t('tselostnost', {var0: (integrity*100).toFixed(0), var1: integrity >= 0.8 ? '✓ ТЕСТЫ ВАЛИДНЫ' : '⚠️ ПРОБЛЕМА'}),
      integrity >= 0.8 ? 'ok' : 'warn');

    this.results.stage31 = { nullResults, falsePositives, totalChecks, integrity };
}

export function render(r) {
if (r.stage31) { try {
      const s = r.stage31;
      this.rv('rv-null-fp', s.falsePositives+'/'+s.totalChecks, s.integrity>=0.8?'ok':'warn');
      this.rv('rv-null-int', (s.integrity*100||0).toFixed(0)+'%', s.integrity>=0.8?'ok':'warn');
      const g = document.getElementById('g-s31');
      if (s.integrity>=0.8) { g.textContent=this.t('nulevoy_test_proyden'); g.className='grade pass'; }
      else { g.textContent=this.t('lozhnye_srabatyvaniya'); g.className='grade fail'; }
    } catch(e) { console.error('stage31 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.integrity >= 0.8)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'FP=' + (d.falsePositives||0) + '/' + (d.totalChecks||0))(d); } catch(e) { return '—'; }
}
