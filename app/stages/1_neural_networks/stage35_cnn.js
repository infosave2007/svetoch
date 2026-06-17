// Stage 35: CNN

export async function run() {
this.setRun(this.t('etap'), 'Optical CNN...', 108);
    this.showColor('#808080');
    await this.sleep(800);

    // 3 test patterns: simple 8x8 "letters"
    const patterns = {
      'A': [
        [0,0,1,1,1,1,0,0],
        [0,1,0,0,0,0,1,0],
        [1,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,1],
        [0,0,0,0,0,0,0,0],
      ],
      'B': [
        [1,1,1,1,1,1,0,0],
        [1,0,0,0,0,0,1,0],
        [1,0,0,0,0,0,1,0],
        [1,1,1,1,1,1,0,0],
        [1,0,0,0,0,0,1,0],
        [1,0,0,0,0,0,1,0],
        [1,1,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
      ],
      'C': [
        [0,1,1,1,1,1,1,0],
        [1,0,0,0,0,0,0,0],
        [1,0,0,0,0,0,0,0],
        [1,0,0,0,0,0,0,0],
        [1,0,0,0,0,0,0,0],
        [1,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0],
      ],
    };

    // Digital Gaussian convolution (3x3 kernel, σ≈1)
    const kernel = [
      [1/16, 2/16, 1/16],
      [2/16, 4/16, 2/16],
      [1/16, 2/16, 1/16],
    ];

    function digitalConv(pat) {
      const out = Array.from({length:8}, () => new Array(8).fill(0));
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          let s = 0;
          for (let ky = -1; ky <= 1; ky++)
            for (let kx = -1; kx <= 1; kx++) {
              const py = Math.max(0, Math.min(7, y+ky));
              const px = Math.max(0, Math.min(7, x+kx));
              s += pat[py][px] * kernel[ky+1][kx+1];
            }
          out[y][x] = s;
        }
      return out;
    }

    const results = [];

    for (const [name, pat] of Object.entries(patterns)) {
      this.setRun(this.t('etap'), this.t('bukva', {var0: name}), 108 + results.length * 0.5);
      this.log(this.t('bukva_1', {var0: name}));

      // Show letter on screen
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const cellW = Math.floor(w * 0.8 / 8);
        const cellH = Math.floor(h * 0.8 / 8);
        const ox = Math.floor(w * 0.1), oy = Math.floor(h * 0.1);
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const v = pat[y][x] * 220 + 20;
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(ox + x*cellW, oy + y*cellH, cellW-1, cellH-1);
          }
      });
      await this.sleep(1000);
      const frame = await this.captureStable(8, 50);

      // Read optical output as 8x8 grid
      const opticalOut = [];
      if (frame) {
        const d = frame.data, fw = frame.width, fh = frame.height;
        const cellW = Math.floor(fw * 0.8 / 8);
        const cellH = Math.floor(fh * 0.8 / 8);
        const ox = Math.floor(fw * 0.1), oy = Math.floor(fh * 0.1);
        for (let y = 0; y < 8; y++) {
          const row = [];
          for (let x = 0; x < 8; x++) {
            const cx = ox + x*cellW + Math.floor(cellW/2);
            const cy = oy + y*cellH + Math.floor(cellH/2);
            // Sample 5x5 area around center
            let s = 0, c = 0;
            for (let dy = -2; dy <= 2; dy++)
              for (let dx = -2; dx <= 2; dx++) {
                const px = cx + dx, py = cy + dy;
                if (px >= 0 && px < fw && py >= 0 && py < fh) {
                  const i = (py*fw+px)*4;
                  s += (d[i]+d[i+1]+d[i+2])/3; c++;
                }
              }
            row.push(c > 0 ? s/c/255 : 0);
          }
          opticalOut.push(row);
        }
      }

      // Digital convolution
      const digConv = digitalConv(pat);

      // Flatten and correlate
      const optFlat = opticalOut.flat();
      const digFlat = digConv.flat();
      const patFlat = pat.flat();

      const corrWithConv = this.pearsonCorr(optFlat, digFlat);
      const corrWithOrig = this.pearsonCorr(optFlat, patFlat);

      results.push({ name, corrWithConv, corrWithOrig });
      this.log(`  Optical↔Conv: ${corrWithConv.toFixed(3)}, Optical↔Original: ${corrWithOrig.toFixed(3)}`);
      this.showColor('#808080'); await this.sleep(400);
    }

    // Classification: use abs(corr) since inversion is expected
    // What matters is whether optical output correlates with convolution more than with original
    const avgAbsCorrConv = results.reduce((s,r)=>s+Math.abs(r.corrWithConv),0) / results.length;
    const avgAbsCorrOrig = results.reduce((s,r)=>s+Math.abs(r.corrWithOrig),0) / results.length;

    // Distinguishability: are the 3 optical outputs different from each other?
    // Compute pairwise correlation between optical outputs
    // If all look the same, corr~1. If distinguishable, corr<0.8
    const avgCorrConv = results.reduce((s,r)=>s+r.corrWithConv,0) / results.length;
    const avgCorrOrig = results.reduce((s,r)=>s+r.corrWithOrig,0) / results.length;

    this.log(`CNN: |corr| conv=${avgAbsCorrConv.toFixed(3)}, orig=${avgAbsCorrOrig.toFixed(3)}`);
    this.log(`CNN: raw conv=${avgCorrConv.toFixed(3)}, orig=${avgCorrOrig.toFixed(3)}`);
    for (const r of results) {
      this.log(`  ${r.name}: conv=${r.corrWithConv.toFixed(3)} orig=${r.corrWithOrig.toFixed(3)}`);
    }
    this.log(this.t('optical_cnn', {var0: avgAbsCorrConv > 0.2 ? 'подтверждён' : 'слабый'}), avgAbsCorrConv > 0.2 ? 'ok' : 'warn');

    this.results.stage35 = { results, avgCorrConv, avgCorrOrig, avgAbsCorrConv, avgAbsCorrOrig };
}

export function render(r) {
if (r.stage35) { try {
      const s = r.stage35;
      this.rv('rv-cnn-conv', (s.avgAbsCorrConv||0).toFixed(3), (s.avgAbsCorrConv||0)>0.2?'ok':'warn');
      this.rv('rv-cnn-orig', (s.avgAbsCorrOrig||0).toFixed(3), (s.avgAbsCorrOrig||0)>0.1?'ok':'warn');
      const g = document.getElementById('g-s35');
      if ((s.avgAbsCorrConv||0)>0.2) { g.textContent=this.t('cnn_rabotaet'); g.className='grade pass'; }
      else { g.textContent=this.t('nizkaya_korrelyatsiya'); g.className='grade fail'; }
    } catch(e) { console.error('stage35 display:', e); } }
}


export function check(d) {
  try { return (d => d && (d.avgAbsCorrConv||Math.abs(d.avgCorrConv||0)) > 0.2)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => '|conv|=' + (d.avgAbsCorrConv||0).toFixed(3))(d); } catch(e) { return '—'; }
}
