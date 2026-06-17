// Stage 59: Cmpr

export async function run() {
this.setRun(this.t('etap'), this.t('opticheskoe_szhatie_bitov'), 119.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};

    // Compress: prefix-free pair encoding
    const compressPass = (bits) => {
      const out = [];
      for (let i = 0; i + 1 < bits.length; i += 2) {
        const b0 = bits[i], b1 = bits[i+1];
        if (b0 === 0 && b1 === 0) { out.push(0); }            // 00→0
        else if (b0 === 0 && b1 === 1) { out.push(1, 0); }     // 01→10
        else if (b0 === 1 && b1 === 0) { out.push(1, 1, 0); }  // 10→110
        else { out.push(1, 1, 1); }                             // 11→111
      }
      if (bits.length % 2 === 1) out.push(bits[bits.length - 1]);
      return out;
    };

    // Decompress: read prefix-free codes
    const decompressPass = (bits) => {
      const out = [];
      let i = 0;
      while (i < bits.length) {
        if (bits[i] === 0) {
          out.push(0, 0); i++;                    // 0→00
        } else if (i + 1 < bits.length && bits[i+1] === 0) {
          out.push(0, 1); i += 2;                 // 10→01
        } else if (i + 2 < bits.length && bits[i+1] === 1 && bits[i+2] === 0) {
          out.push(1, 0); i += 3;                 // 110→10
        } else if (i + 2 < bits.length && bits[i+1] === 1 && bits[i+2] === 1) {
          out.push(1, 1); i += 3;                 // 111→11
        } else {
          out.push(bits[i]); i++;                  // trailing bit
        }
      }
      return out;
    };

    // Iterative compression (stop when no improvement)
    const iterativeCompress = (bits, maxIter = 8) => {
      const passes = [];
      const originalLens = []; // store original length for each pass
      let current = [...bits];
      for (let iter = 0; iter < maxIter; iter++) {
        if (current.length <= 1) break;
        const compressed = compressPass(current);
        if (compressed.length >= current.length) break; // no gain → stop
        originalLens.push(current.length);
        passes.push({ inputLen: current.length, outputLen: compressed.length });
        current = compressed;
      }
      return { finalBits: current, passes, nPasses: passes.length, originalLens };
    };

    // Test cases
    const testCases = [
      { name: 'All zeros', bits: new Array(64).fill(0) },
      { name: 'Sparse 95%', bits: Array.from({length: 64}, () => Math.random() < 0.95 ? 0 : 1) },
      { name: 'Sparse 90%', bits: Array.from({length: 64}, () => Math.random() < 0.9 ? 0 : 1) },
      { name: 'Structured', bits: [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { name: 'Random', bits: Array.from({length: 64}, () => Math.random() > 0.5 ? 1 : 0) },
    ];

    const allResults = [];
    let bestDemo = null;

    for (const tc of testCases) {
      const input = tc.bits;
      const { finalBits, passes, nPasses, originalLens } = iterativeCompress(input);
      const ratio = input.length / Math.max(finalBits.length, 1);
      const savings = (1 - finalBits.length / input.length) * 100;

      // Verify lossless (with length truncation)
      let reconstructed = [...finalBits];
      for (let i = nPasses - 1; i >= 0; i--) {
        reconstructed = decompressPass(reconstructed);
        reconstructed = reconstructed.slice(0, originalLens[i]); // truncate to original length
      }
      const match = input.length === reconstructed.length &&
                     input.every((b, j) => b === reconstructed[j]);

      const passLog = passes.map(p => `${p.inputLen}→${p.outputLen}`).join(' → ');
      this.log(`  ${tc.name}: ${input.length}→${finalBits.length}b [${passLog}] ${ratio.toFixed(1)}× ${match ? '✓' : '✗'}`);

      allResults.push({ name: tc.name, inputLen: input.length,
        compressedLen: finalBits.length, nPasses,
        ratio: Number(ratio.toFixed(2)), savings: Number(savings.toFixed(1)), match });

      if (!bestDemo || ratio > bestDemo.ratio) {
        bestDemo = { input, finalBits, ratio, name: tc.name };
      }
    }

    // Optical verification: chunked read (16 bits/chunk, 3 frames, majority vote)
    if (bestDemo && bestDemo.input.length >= 8) {
      this.log(this.t('n_opticheskaya_verifikatsiya', {var0: bestDemo.name}));
      this.log(this.t('vkhod_b', {var0: bestDemo.input.join(''), var1: bestDemo.input.length}));

      const optIn = await this.readBitsChunked(bestDemo.input, 16, 3);
      const inCorrect = bestDemo.input.reduce((s, b, i) => s + (optIn[i] === b ? 1 : 0), 0);
      const inAcc = (inCorrect / bestDemo.input.length * 100).toFixed(1);
      this.log(this.t('kamera_bit', {var0: inCorrect, var1: bestDemo.input.length, var2: inAcc, var3: inCorrect === bestDemo.input.length ? '✓' : '~'}));

      if (bestDemo.finalBits.length >= 4) {
        this.log(this.t('szhatoe_b', {var0: bestDemo.finalBits.join(''), var1: bestDemo.finalBits.length, var2: bestDemo.ratio.toFixed(1)}));
        const optOut = await this.readBitsChunked(bestDemo.finalBits, 16, 3);
        const outCorrect = bestDemo.finalBits.reduce((s, b, i) => s + (optOut[i] === b ? 1 : 0), 0);
        const outAcc = (outCorrect / bestDemo.finalBits.length * 100).toFixed(1);
        this.log(this.t('szhatoe_bit', {var0: outCorrect, var1: bestDemo.finalBits.length, var2: outAcc, var3: outCorrect === bestDemo.finalBits.length ? '✓' : '~'}));
      }
    }

    const bestResult = allResults.reduce((a, b) => a.ratio > b.ratio ? a : b);
    const allMatch = allResults.every(r => r.match);
    const pass = allMatch && bestResult.ratio > 1.2;

    this.log(this.t('opticheskoe_szhatie'));
    for (const r of allResults) {
      this.log(`  ${r.name}: ${r.inputLen}→${r.compressedLen}b = ${r.ratio}× (${r.savings > 0 ? '+' : ''}${r.savings}%) ${r.nPasses}p`);
    }
    this.log(this.t('dekompressiya', {var0: allMatch ? 'ВСЕ LOSSLESS' : 'ОШИБКИ'}));
    this.log(this.t('szhatie', {var0: pass ? 'РАБОТАЕТ!' : 'частично'}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage59 = {
      tests: allResults, bestRatio: bestResult.ratio,
      bestCase: bestResult.name, allDecompressCorrect: allMatch, pass
    };
}

export function render(r) {
if (r.stage59) { try {
      const s = r.stage59;
      const g = document.getElementById('g-s59');
      if (s.pass) { g.textContent=this.t('szhatie_1', {var0: s.bestCase, var1: s.bestRatio.toFixed(1)}); g.className='grade pass'; }
      else { g.textContent=this.t('szhatie_2', {var0: s.bestRatio.toFixed(2)}); g.className='grade partial'; }
    } catch(e) { console.error('stage59 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'best=' + (d.bestRatio||0).toFixed(1) + '×')(d); } catch(e) { return '—'; }
}
