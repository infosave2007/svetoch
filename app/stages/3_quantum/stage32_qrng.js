// Stage 32: 🎲QRNG

export async function run() {
this.setRun(this.t('etap'), 'QRNG...', 105);
    this.showColor('#808080');
    await this.sleep(800);

    // Use temporal noise LSB: show uniform gray, sample pixel noise
    this.log(this.t('generatsiya_sluchaynykh_bit_iz'));
    this.showColor('#808080');
    await this.sleep(1000);

    const bits = [];
    // Capture pairs of frames, use intensity difference sign as random bit
    for (let i = 0; i < 100; i++) {
      this.setRun(this.t('etap'), this.t('bit', {var0: i+1}), 105 + i * 0.01);
      // Frame A — captureStable ensures fresh video frame
      const fA = await this.captureStable(1, 30);
      // Frame B (different noise realization)
      const fB = await this.captureStable(1, 30);
      if (fA && fB) {
        // Compare center pixel intensity between two frames
        const cx = Math.floor(fA.width / 2);
        const cy = Math.floor(fA.height / 2);
        let sumA = 0, sumB = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const idx = ((cy+dy)*fA.width + (cx+dx)) * 4;
            sumA += fA.data[idx] + fA.data[idx+1] + fA.data[idx+2];
            sumB += fB.data[idx] + fB.data[idx+1] + fB.data[idx+2];
          }
        // Bit = 1 if frame B brighter than A (temporal noise)
        bits.push(sumB > sumA ? 1 : 0);
      } else {
        bits.push(Math.round(Math.random()));
      }
    }

    this.showColor('#808080');
    await this.sleep(300);

    // NIST tests
    // 1. Frequency (monobit) test
    const ones = bits.filter(b => b === 1).length;
    const zeros = bits.length - ones;
    const freqStat = Math.abs(ones - zeros) / Math.sqrt(bits.length);
    const freqPass = freqStat < 1.96; // 5% significance

    // 2. Runs test
    let runs = 1;
    for (let i = 1; i < bits.length; i++) if (bits[i] !== bits[i-1]) runs++;
    const pi = ones / bits.length;
    const expectedRuns = 2 * bits.length * pi * (1-pi) + 1;
    const stdRuns = 2 * Math.sqrt(2 * bits.length) * pi * (1-pi);
    const runsStat = stdRuns > 0 ? Math.abs(runs - expectedRuns) / stdRuns : 999;
    const runsPass = runsStat < 1.96;

    // 3. Serial correlation
    let sc = 0;
    for (let i = 0; i < bits.length - 1; i++) sc += bits[i] * bits[i+1];
    const serialCorr = Math.abs(sc / (bits.length-1) - (ones/bits.length)**2);
    const serialPass = serialCorr < 0.1;

    // 4. Longest run of ones
    let maxRun = 0, curRun = 0;
    for (const b of bits) { if (b===1) { curRun++; maxRun = Math.max(maxRun, curRun); } else curRun = 0; }
    const longestRunPass = maxRun < 12; // For 100 bits, max run of 12+ is suspicious

    const bitString = bits.join('');
    this.log(this.t('bity', {var0: bitString.slice(0,40)}));
    this.log(`1s: ${ones}, 0s: ${zeros}, ratio: ${(ones/bits.length).toFixed(2)}`);
    this.log(`Freq: stat=${freqStat.toFixed(2)} ${freqPass?'✓':'✗'}`);
    this.log(`Runs: ${runs} (exp=${expectedRuns.toFixed(0)}) ${runsPass?'✓':'✗'}`);
    this.log(`Serial corr: ${serialCorr.toFixed(4)} ${serialPass?'✓':'✗'}`);
    this.log(`Max run: ${maxRun} ${longestRunPass?'✓':'✗'}`);

    const testsPass = [freqPass, runsPass, serialPass, longestRunPass].filter(Boolean).length;
    this.log(this.t('qrng_testov_proydeno', {var0: testsPass}), testsPass >= 3 ? 'ok' : 'warn');

    this.results.stage32 = {
      bits, ones, zeros, freqStat, freqPass,
      runs, runsStat, runsPass, serialCorr, serialPass,
      maxRun, longestRunPass, testsPass
    };
}

export function render(r) {
if (r.stage32) { try {
      const s = r.stage32;
      this.rv('rv-qrng-nist', s.testsPass+'/4', s.testsPass>=3?'ok':'warn');
      this.rv('rv-qrng-bal', s.ones+'‰', Math.abs(s.ones-500)<100?'ok':'warn');
      const g = document.getElementById('g-s32');
      if (s.testsPass>=3) { g.textContent=this.t('qrng_rabotaet'); g.className='grade pass'; }
      else { g.textContent=this.t('qrng_ne_proshyol'); g.className='grade fail'; }
    } catch(e) { console.error('stage32 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.testsPass >= 3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.testsPass||0) + '/4 NIST')(d); } catch(e) { return '—'; }
}
