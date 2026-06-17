// Stage 2: DotProd

export async function run() {
this.setRun(this.t('etap'), 'Dot Product (sum-based)...', 55);
    this.showColor('#808080');
    await this.sleep(800);

    // Sum-based approach: show N patterns with known mean intensity,
    // capture total brightness, check correlation: digital_mean vs optical_mean
    // This avoids spatial non-uniformity issues!

    const gamma = (this.results.calibration && this.results.calibration.gamma) || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;
    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;

    // Reference: white
    this.setRun(this.t('etap'), this.t('referens_belyy'), 57);
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));

    this.showColor('#808080'); await this.sleep(600);

    // Generate 12 test levels, sorted dark→bright (AE stays stable!)
    const nTests = 12;
    const testLevels = Array.from({length: nTests}, (_, i) => 0.05 + i * 0.9 / (nTests - 1));
    // testLevels = [0.05, 0.13, 0.21, ... 0.95] — monotonic

    const digitalMeans = [];
    const opticalMeans = [];

    for (let t = 0; t < nTests; t++) {
      const intensity = testLevels[t];
      digitalMeans.push(intensity);

      this.setRun(this.t('etap'), this.t('test', {var0: t+1, var1: nTests, var2: Math.round(intensity*100)}), 58 + t*1.2);

      const v = Math.round(intensity * 255);
      this.showColor(`rgb(${v},${v},${v})`);
      await this.sleep(600);
      const frame = await this.captureStable(6, 50);
      const rawMean = this.regionMean(frame);

      // Normalize by ref and gamma-correct
      const normalized = (rawMean - blackLevel) / Math.max(refBright - blackLevel, 1);
      const corrected = normalized > 0 ? Math.pow(normalized, invGamma) : 0;
      opticalMeans.push(corrected);

      // Brief stabilizer (short — levels are sorted, AE barely changes)
      this.showColor('#808080');
      await this.sleep(300);
    }

    // Correlation: do optical values track digital values?
    const corrIntensity = this.pearson(opticalMeans, digitalMeans);

    // Now do actual vector dot product test
    // Generate two 4-element vectors, compute digital dot, then optically
    this.setRun(this.t('etap'), 'Dot product (4×1 × 4×1)...', 75);
    const rng = this.mulberry32(42);
    const vecA = Array.from({length: 4}, () => rng());
    const vecB = Array.from({length: 4}, () => rng());
    const digitalDot = vecA.reduce((s,v,i) => s + v * vecB[i], 0);
    const digitalMean = digitalDot / 4; // average element

    // Show A*B as 4 big vertical stripes, measure total
    const ab = vecA.map((v,i) => v * vecB[i]);
    this.showBlockPattern(ab, 4);  // 4 columns, 1 row
    await this.sleep(700);
    const fAB = await this.captureStable(6, 60);
    const abRaw = this.regionMean(fAB);
    const abNorm = (abRaw - blackLevel) / Math.max(refBright - blackLevel, 1);
    const abCorrected = abNorm > 0 ? Math.pow(abNorm, invGamma) : 0;
    const opticalDot = abCorrected * 4; // scale back from mean to sum

    const dotErr = Math.abs(opticalDot - digitalDot) / Math.max(Math.abs(digitalDot), 0.01) * 100;

    this.showColor('#808080'); await this.sleep(500);

    this.log(this.t('intensity_tracking_r_testov', {var0: corrIntensity.toFixed(4), var1: nTests}));
    this.log(`Dot: digital=${digitalDot.toFixed(3)} optical=${opticalDot.toFixed(3)} err=${dotErr.toFixed(0)}%`);
    this.log(`Intensity corr: ${corrIntensity.toFixed(4)}`, corrIntensity > 0.9 ? 'ok' : corrIntensity > 0.7 ? 'warn' : 'err');

    this.results.stage2 = {
      digitalDot, opticalDot, dotError: dotErr,
      intensityCorrelation: corrIntensity,
      digitalMeans, opticalMeans,
      vecA, vecB, gammaUsed: gamma
    };

    this.showColor('#808080'); await this.sleep(500);
}

export function render(r) {
if (r.stage2) { try {
      const s = r.stage2;
      const ic = s.intensityCorrelation || 0;
      this.rv('rv-corr', ic.toFixed(4), ic>0.9?'ok':ic>0.7?'warn':'bad');
      this.rv('rv-doterr', s.dotError.toFixed(1)+'%', s.dotError<50?'ok':s.dotError<100?'warn':'bad');
      const g = document.getElementById('g-s2');
      if (ic>0.9) { g.textContent=this.t('intensity_tracking_otlichno'); g.className='grade pass'; }
      else if (ic>0.7) { g.textContent=this.t('chastichno'); g.className='grade partial'; }
      else { g.textContent=this.t('net_svyazi'); g.className='grade fail'; }
      this.drawDotChart(s);
    } catch(e) { console.error('stage2 display:', e); } }
}


export function check(d) {
  try { return (d => d && (d.intensityCorrelation||0) > 0.7)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.intensityCorrelation||0).toFixed(3))(d); } catch(e) { return '—'; }
}
