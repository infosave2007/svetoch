// Stage 53: 🔐BB84f

export async function run() {
this.setRun(this.t('etap'), 'BB84 Full QKD...', 113.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const nBits = 32;

    // Alice: random bits and bases
    const aliceBits = Array.from({length: nBits}, () => Math.random() > 0.5 ? 1 : 0);
    const aliceBases = Array.from({length: nBits}, () => Math.random() > 0.5 ? 'D' : 'R'); // R=rectilinear, D=diagonal

    // Calibrate dark/bright
    this.showColor('#101010'); await this.sleep(400);
    const fDark = await this.captureStable(4, 30);
    const darkRef = this.regionMean(fDark);
    this.showColor('#e0e0e0'); await this.sleep(400);
    const fBright = await this.captureStable(4, 30);
    const brightRef = this.regionMean(fBright);
    const threshold = (darkRef + brightRef) / 2;
    this.log(`  BB84 cal: dark=${darkRef.toFixed(1)}, bright=${brightRef.toFixed(1)}, thresh=${threshold.toFixed(1)}`);

    // Send and measure each bit
    const bobBases = Array.from({length: nBits}, () => Math.random() > 0.5 ? 'D' : 'R');
    const bobBits = [];

    for (let i = 0; i < nBits; i++) {
      const bit = aliceBits[i];
      const basis = aliceBases[i];

      if (basis === 'R') {
        // Rectilinear: 0 = left bright, 1 = right bright
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          if (bit === 0) {
            ctx.fillStyle = '#e0e0e0'; ctx.fillRect(0, 0, w / 2, h);
          } else {
            ctx.fillStyle = '#e0e0e0'; ctx.fillRect(w / 2, 0, w / 2, h);
          }
        });
      } else {
        // Diagonal: 0 = top bright, 1 = bottom bright
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          if (bit === 0) {
            ctx.fillStyle = '#e0e0e0'; ctx.fillRect(0, 0, w, h / 2);
          } else {
            ctx.fillStyle = '#e0e0e0'; ctx.fillRect(0, h / 2, w, h / 2);
          }
        });
      }
      await this.sleep(300);
      const f = await this.captureStable(6, 30);

      // Bob measures in his basis
      if (bobBases[i] === 'R') {
        // Rectilinear: measure left half vs right half
        const bins = this.measureNBins(f, 2);
        bobBits.push(cal.isMirrored ? (bins[0] > bins[1] ? 1 : 0) : (bins[1] > bins[0] ? 1 : 0));
      } else {
        // Diagonal: measure top half vs bottom half
        const fd = f.data, ffw = f.width, ffh = f.height;
        const qx0 = cal.x0 || Math.floor(ffw * 0.15);
        const qx1 = cal.x1 || Math.floor(ffw * 0.85);
        const qym = Math.floor(ffh / 2);
        let topSum = 0, topCnt = 0, botSum = 0, botCnt = 0;
        for (let y = Math.floor(ffh * 0.1); y < ffh * 0.9; y += 4) {
          for (let x = qx0; x < qx1; x += 4) {
            const idx = (y * ffw + x) * 4;
            const val = (fd[idx] + fd[idx+1] + fd[idx+2]) / 3;
            if (y < qym) { topSum += val; topCnt++; }
            else { botSum += val; botCnt++; }
          }
        }
        const topMean = topCnt > 0 ? topSum / topCnt : 0;
        const botMean = botCnt > 0 ? botSum / botCnt : 0;
        bobBits.push(topMean > botMean ? 1 : 0);
      }
    }

    // Sifting: keep only matching bases
    const siftedAlice = [], siftedBob = [], siftedBases = [];
    for (let i = 0; i < nBits; i++) {
      if (aliceBases[i] === bobBases[i]) {
        siftedAlice.push(aliceBits[i]);
        siftedBob.push(bobBits[i]);
        siftedBases.push(aliceBases[i]);
      }
    }

    const basisStats = (basis) => {
      let total = 0, errors = 0;
      for (let i = 0; i < siftedAlice.length; i++) {
        if (siftedBases[i] !== basis) continue;
        total++;
        if (siftedAlice[i] !== siftedBob[i]) errors++;
      }
      return { total, errors };
    };

    const rRaw = basisStats('R');
    const dRaw = basisStats('D');
    const invertR = rRaw.total >= 3 && rRaw.errors / rRaw.total > 0.8;
    const invertD = dRaw.total >= 3 && dRaw.errors / dRaw.total > 0.8;
    for (let i = 0; i < siftedBob.length; i++) {
      if ((siftedBases[i] === 'R' && invertR) || (siftedBases[i] === 'D' && invertD)) {
        siftedBob[i] = 1 - siftedBob[i];
      }
    }
    if (invertR || invertD) this.log(`  Orientation correction: R=${invertR ? 'invert' : 'normal'} D=${invertD ? 'invert' : 'normal'}`);

    // Compute QBER with per-basis breakdown
    let errors = 0, rErr = 0, rTot = 0, dErr = 0, dTot = 0;
    for (let i = 0; i < siftedAlice.length; i++) {
      const wrong = siftedAlice[i] !== siftedBob[i];
      if (wrong) errors++;
      if (siftedBases[i] === 'R') { rTot++; if (wrong) rErr++; }
      else { dTot++; if (wrong) dErr++; }
    }
    const qber = siftedAlice.length > 0 ? errors / siftedAlice.length : 1;
    const keyBits = siftedAlice.length;
    const secure = qber < 0.11;

    this.log(this.t('otpravleno_bit_sovpalo_bazisov', {var0: nBits, var1: keyBits}));
    this.log(`  Alice: [${siftedAlice.join('')}]`);
    this.log(`  Bob:   [${siftedBob.join('')}]`);
    this.log(this.t('rbazis_oshibok', {var0: rErr, var1: rTot, var2: rTot > 0 ? (rErr/rTot*100).toFixed(0) : '?'}));
    this.log(this.t('dbazis_oshibok', {var0: dErr, var1: dTot, var2: dTot > 0 ? (dErr/dTot*100).toFixed(0) : '?'}));
    this.log(`  QBER = ${errors}/${keyBits} = ${(qber*100).toFixed(1)}%`);
    this.log(this.t('bb', {var0: secure ? 'КЛЮЧ БЕЗОПАСЕН!' : 'небезопасен'}), secure ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage53 = { nBits, keyBits, qber: Number(qber.toFixed(4)), secure, siftedKey: siftedAlice.join(''), rErr, rTot, dErr, dTot, invertR, invertD };
}

export function render(r) {
if (r.stage53) { try {
      const s = r.stage53;
      this.rv('rv-bb84f-qber', (s.qber * 100)?.toFixed(1) + '%', s.secure ? 'ok' : 'warn');
      this.rv('rv-bb84f-key', s.keyBits + this.t('bit'), 'ok');
      const g = document.getElementById('g-s53');
      if (s.secure) { g.textContent=this.t('bb_qber_klyuch_bezopasen', {var0: (s.qber*100).toFixed(1)}); g.className='grade pass'; }
      else { g.textContent=`⚠️ QBER=${(s.qber*100).toFixed(1)}% > 11%`; g.className='grade partial'; }
    } catch(e) { console.error('stage53 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.secure)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'QBER=' + ((d.qber||0)*100).toFixed(1) + '%')(d); } catch(e) { return '—'; }
}
