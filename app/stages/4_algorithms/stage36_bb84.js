// Stage 36: BB84

export async function run() {
this.setRun(this.t('etap'), 'BB84 QKD...', 108);
    this.showColor('#808080');
    await this.sleep(800);

    // In-situ calibration
    this.showColor('#282828'); await this.sleep(500);
    const fDark = await this.captureStable(5, 40);
    const darkRef = this.regionMean(fDark);
    this.showColor('#c8c8c8'); await this.sleep(500);
    const fBright = await this.captureStable(5, 40);
    const brightRef = this.regionMean(fBright);
    const thresh = (darkRef + brightRef) / 2;
    this.log(`BB84 cal: dark=${darkRef.toFixed(1)}, bright=${brightRef.toFixed(1)}`);

    const nBits = 16;
    // Alice: random bits and bases
    const aliceBits = [];
    const aliceBases = []; // 0=rectilinear, 1=diagonal
    const bobBases = [];
    const bobBits = [];

    for (let i = 0; i < nBits; i++) {
      this.setRun(this.t('etap'), this.t('bit', {var0: i+1, var1: nBits}), 108 + i * 0.5 / nBits);

      // Alice chooses random bit and basis
      const aBit = Math.random() > 0.5 ? 1 : 0;
      const aBasis = Math.random() > 0.5 ? 1 : 0;
      aliceBits.push(aBit);
      aliceBases.push(aBasis);

      // Encode: basis 0 = brightness, basis 1 = stripe orientation
      if (aBasis === 0) {
        // Rectilinear: |0⟩ = dark, |1⟩ = bright
        const v = aBit ? 200 : 40;
        this.showColor(`rgb(${v},${v},${v})`);
      } else {
        // Diagonal: |+⟩ = horizontal stripes, |-⟩ = vertical stripes
        const period = 12;
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          for (let p = 0; p < (aBit ? w : h); p += period) {
            ctx.fillStyle = '#c8c8c8';
            if (aBit) {
              ctx.fillRect(p, 0, period/2, h); // vertical
            } else {
              ctx.fillRect(0, p, w, period/2); // horizontal
            }
          }
        });
      }
      await this.sleep(300);

      // Bob measures in random basis
      const bBasis = Math.random() > 0.5 ? 1 : 0;
      bobBases.push(bBasis);

      const frame = await this.captureStable(3, 30);
      if (frame) {
        if (bBasis === 0) {
          // Rectilinear measurement: brightness threshold
          const val = this.regionMean(frame);
          bobBits.push(val > thresh ? 1 : 0);
        } else {
          // Diagonal measurement: check stripe orientation via spatial gradient analysis
          const d = frame.data, fw = frame.width, fh = frame.height;
          let diffX = 0, diffY = 0;
          const y0 = Math.floor(fh * 0.3), y1 = Math.floor(fh * 0.7);
          const x0 = Math.floor(fw * 0.3), x1 = Math.floor(fw * 0.7);
          
          for (let y = y0; y < y1; y += 4) {
            for (let x = x0; x < x1; x += 4) {
              const i = (y * fw + x) * 4;
              const iRight = (y * fw + (x + 2)) * 4;
              const iDown = ((y + 2) * fw + x) * 4;
              
              const val = (d[i] + d[i+1] + d[i+2]) / 3;
              const valRight = (d[iRight] + d[iRight+1] + d[iRight+2]) / 3;
              const valDown = (d[iDown] + d[iDown+1] + d[iDown+2]) / 3;
              
              diffX += Math.abs(val - valRight);
              diffY += Math.abs(val - valDown);
            }
          }
          bobBits.push(diffX > diffY ? 1 : 0);
        }
      } else {
        bobBits.push(0);
      }

      this.showColor('#808080'); await this.sleep(100);
    }

    // Sift: keep only matching bases
    const siftedAlice = [], siftedBob = [];
    for (let i = 0; i < nBits; i++) {
      if (aliceBases[i] === bobBases[i]) {
        siftedAlice.push(aliceBits[i]);
        siftedBob.push(bobBits[i]);
      }
    }

    // QBER
    let errors = 0;
    for (let i = 0; i < siftedAlice.length; i++) {
      if (siftedAlice[i] !== siftedBob[i]) errors++;
    }
    const qber = siftedAlice.length > 0 ? errors / siftedAlice.length : 1;
    const keyLength = siftedAlice.length;
    const basisMatch = keyLength / nBits;

    this.log(this.t('bb_bit_sovpalo_bazisov', {var0: nBits, var1: keyLength, var2: (basisMatch*100).toFixed(0)}));
    this.log(this.t('qber_oshibki', {var0: (qber*100).toFixed(1), var1: errors, var2: keyLength}));
    this.log(this.t('klyuch', {var0: siftedAlice.join('')}));
    const secure = qber < 0.11 && keyLength >= 4;
    this.log(this.t('bb', {var0: secure ? 'КАНАЛ БЕЗОПАСЕН' : 'небезопасно'}), secure ? 'ok' : 'warn');

    this.results.stage36 = {
      nBits, keyLength, basisMatch, qber, errors, secure,
      aliceBits, aliceBases, bobBases, bobBits, siftedAlice, siftedBob
    };
}

export function render(r) {
if (r.stage36) { try {
      const s = r.stage36;
      this.rv('rv-bb84-qber', ((s.qber||0)*100).toFixed(1)+'%', s.secure?'ok':'warn');
      this.rv('rv-bb84-key', s.keyLength+this.t('bit_1'), s.keyLength>0?'ok':'warn');
      const g = document.getElementById('g-s36');
      if (s.secure) { g.textContent=this.t('bb_bezopasen'); g.className='grade pass'; }
      else { g.textContent=this.t('qber_slishkom_vysok'); g.className='grade fail'; }
    } catch(e) { console.error('stage36 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.secure)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'QBER=' + (d.qber*100||0).toFixed(1) + '%')(d); } catch(e) { return '—'; }
}
