// Stage 60: BnCm

export async function run() {
this.setRun(this.t('etap'), 'Bounce Compression...', 120.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};

    // Same prefix-free codes as Stage 59
    const compressPass = (bits) => {
      const out = [];
      for (let i = 0; i + 1 < bits.length; i += 2) {
        const b0 = bits[i], b1 = bits[i+1];
        if (b0 === 0 && b1 === 0) out.push(0);
        else if (b0 === 0 && b1 === 1) out.push(1, 0);
        else if (b0 === 1 && b1 === 0) out.push(1, 1, 0);
        else out.push(1, 1, 1);
      }
      if (bits.length % 2 === 1) out.push(bits[bits.length - 1]);
      return out;
    };
    const decompressPass = (bits) => {
      const out = [];
      let i = 0;
      while (i < bits.length) {
        if (bits[i] === 0) { out.push(0, 0); i++; }
        else if (i+1 < bits.length && bits[i+1] === 0) { out.push(0, 1); i += 2; }
        else if (i+2 < bits.length && bits[i+1] === 1 && bits[i+2] === 0) { out.push(1, 0); i += 3; }
        else if (i+2 < bits.length && bits[i+1] === 1 && bits[i+2] === 1) { out.push(1, 1); i += 3; }
        else { out.push(bits[i]); i++; }
      }
      return out;
    };

    // Critical density: prefix-free break-even at q²+q-1=0 → q=(√5-1)/2
    // ρ_c = 1-q = (3-√5)/2 ≈ 0.382 (golden ratio!)
    const rho_c = (3 - Math.sqrt(5)) / 2;
    this.log(this.t('kriticheskaya_plotnost_c', {var0: rho_c.toFixed(4)}));
    this.log(this.t('fridman_h_c'));

    // Input: 128-bit sparse data
    const input = Array.from({length: 128}, () => Math.random() < 0.92 ? 0 : 1);
    const origLen = input.length;
    this.log(this.t('vkhod_bit_plotnost', {var0: origLen, var1: (input.filter(b=>b).length/origLen).toFixed(3)}));

    // ═══ CONTRACTION PHASE ═══
    this.log(this.t('n_kontraktsiya_szhatie'));
    let current = [...input];
    const originalLens = [];
    const trajectory = []; // {a, rho, H2, size}

    const rho0 = current.filter(b => b).length / current.length;
    trajectory.push({ a: 1.0, rho: rho0, H2: rho0 * (1 - rho0/rho_c), size: current.length });

    for (let step = 0; step < 10; step++) {
      if (current.length <= 1) break;

      const ones = current.filter(b => b === 1).length;
      const rho = ones / current.length;
      const H2 = rho * (1 - rho / rho_c);

      this.log(this.t('t_a_h', {var0: step, var1: (current.length/origLen).toFixed(3), var2: rho.toFixed(3), var3: H2.toFixed(4), var4: H2 <= 0 ? ' ← БАУНС!' : ''}));

      if (H2 <= 0) break; // ρ ≥ ρ_c → bounce!

      const compressed = compressPass(current);
      if (compressed.length >= current.length) {
        this.log(this.t('t_stop_net_uluchsheniya_bauns', {var0: step}));
        break;
      }

      originalLens.push(current.length);
      current = compressed;

      const rhoNew = current.filter(b => b === 1).length / current.length;
      trajectory.push({ a: current.length / origLen, rho: rhoNew,
        H2: rhoNew * (1 - rhoNew / rho_c), size: current.length });
    }

    const bounceIdx = trajectory.length - 1;
    const a_min = trajectory[bounceIdx].a;
    const compressionRatio = 1 / a_min;
    this.log(this.t('bauns_amin_szhatie', {var0: a_min.toFixed(4), var1: compressionRatio.toFixed(1)}));

    // ═══ EXPANSION PHASE (decompress) ═══
    this.log(this.t('n_ekspansiya_raspakovka'));
    let expanding = [...current];
    const expansionTrajectory = [];

    for (let i = originalLens.length - 1; i >= 0; i--) {
      expanding = decompressPass(expanding);
      expanding = expanding.slice(0, originalLens[i]);
      const rho = expanding.filter(b => b === 1).length / expanding.length;
      expansionTrajectory.push({ a: expanding.length / origLen, rho, size: expanding.length });
      this.log(`  t=${bounceIdx + (originalLens.length - i)}: a=${(expanding.length/origLen).toFixed(3)}, size=${expanding.length}`);
    }

    // Verify lossless
    const lossless = expanding.length === input.length &&
                     expanding.every((b, i) => b === input[i]);
    this.log(this.t('lossless', {var0: lossless ? 'ДА ✓' : 'НЕТ ✗'}));

    // Full V-curve: contraction + expansion
    const a_full = [...trajectory.map(t => t.a), ...expansionTrajectory.map(t => t.a)];
    const nSteps = a_full.length;

    // Theoretical NVG bounce curve
    const a_theory = [];
    for (let i = 0; i < nSteps; i++) {
      const t = (i - bounceIdx) / Math.max(bounceIdx, nSteps - 1 - bounceIdx);
      a_theory.push(a_min + (1 - a_min) * t * t);
    }

    // Correlation a_full ↔ a_theory
    const meanA = a_full.reduce((s,v) => s+v, 0) / nSteps;
    const meanT = a_theory.reduce((s,v) => s+v, 0) / nSteps;
    let num = 0, denA = 0, denT = 0;
    for (let i = 0; i < nSteps; i++) {
      num += (a_full[i] - meanA) * (a_theory[i] - meanT);
      denA += (a_full[i] - meanA) ** 2;
      denT += (a_theory[i] - meanT) ** 2;
    }
    const corr = num / Math.sqrt(denA * denT + 1e-12);

    this.log(`\n  a(t) = [${a_full.map(a => a.toFixed(3)).join(', ')}]`);
    this.log(this.t('teoriya', {var0: a_theory.map(a => a.toFixed(3)).join(', ')}));
    this.log(this.t('korrelyatsiya_dannyebauns', {var0: corr.toFixed(4)}));

    // ═══ OPTICAL VERIFICATION ═══
    // Display V-curve as brightness bars (like Stage 57)
    const nBars = Math.min(nSteps, 16);
    const barValues = [];
    for (let i = 0; i < nBars; i++) {
      const idx = Math.round(i * (nSteps - 1) / (nBars - 1));
      barValues.push(a_full[Math.min(idx, nSteps - 1)]);
    }

    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const barW = Math.floor(w / nBars);
      for (let i = 0; i < nBars; i++) {
        const v = Math.round(barValues[i] * 220);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(i * barW + 2, 0, barW - 4, h);
      }
    });
    await this.sleep(500);
    const frame = await this.captureStable(6, 40);
    const bins = this.measureNBins(frame, nBars);

    // Normalize camera reading
    const bMax = Math.max(...bins), bMin = Math.min(...bins);
    const a_camera = bins.map(b => (b - bMin) / Math.max(bMax - bMin, 1e-6));

    // Camera ↔ theory correlation
    const a_cam_theory = [];
    for (let i = 0; i < nBars; i++) {
      const idx = Math.round(i * (nSteps - 1) / (nBars - 1));
      a_cam_theory.push(a_theory[Math.min(idx, nSteps - 1)]);
    }
    const camMean = a_camera.reduce((s,v) => s+v, 0) / nBars;
    const thMean = a_cam_theory.reduce((s,v) => s+v, 0) / nBars;
    let cNum = 0, cDA = 0, cDT = 0;
    for (let i = 0; i < nBars; i++) {
      cNum += (a_camera[i] - camMean) * (a_cam_theory[i] - thMean);
      cDA += (a_camera[i] - camMean) ** 2;
      cDT += (a_cam_theory[i] - thMean) ** 2;
    }
    const camCorr = cNum / Math.sqrt(cDA * cDT + 1e-12);

    this.log(this.t('kamera_at', {var0: a_camera.map(a => a.toFixed(2)).join(', ')}));
    this.log(this.t('korr_kamerateoriya', {var0: camCorr.toFixed(4)}));

    // Symmetry check
    let symSum = 0, symN = 0;
    for (let i = 0; i < Math.floor(nSteps / 2); i++) {
      const j = nSteps - 1 - i;
      if (j > i) {
        symSum += 1 - Math.abs(a_full[i] - a_full[j]) / Math.max(a_full[i], a_full[j], 1e-6);
        symN++;
      }
    }
    const symmetry = symN > 0 ? symSum / symN : 0;

    const pass = lossless && corr > 0.9 && compressionRatio > 1.5;

    this.log(`━━━ BOUNCE COMPRESSION ━━━`);
    this.log(this.t('c_zolotoe_sechenie', {var0: rho_c.toFixed(4)}));
    this.log(this.t('szhatie_b', {var0: origLen, var1: trajectory[bounceIdx].size, var2: compressionRatio.toFixed(1)}));
    this.log(this.t('simmetriya_vkrivoy', {var0: (symmetry * 100).toFixed(1)}));
    this.log(this.t('korr_atteoriya', {var0: corr.toFixed(4)}));
    this.log(this.t('lossless', {var0: lossless ? 'ДА' : 'НЕТ'}));
    this.log(this.t('bounce_compression', {var0: pass ? 'ПОДТВЕРЖДЁН!' : 'частично'}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage60 = {
      origLen, bounceSize: trajectory[bounceIdx].size,
      compressionRatio: Number(compressionRatio.toFixed(2)),
      rho_c: Number(rho_c.toFixed(4)),
      corr: Number(corr.toFixed(4)),
      camCorr: Number(camCorr.toFixed(4)),
      symmetry: Number(symmetry.toFixed(4)),
      trajectory: a_full.map(a => Number(a.toFixed(4))),
      lossless, pass
    };
}

export function render(r) {
if (r.stage60) { try {
      const s = r.stage60;
      const g = document.getElementById('g-s60');
      if (s.pass) { g.textContent=`✅ Bounce: ${s.compressionRatio}×, corr=${s.corr.toFixed(3)}`; g.className='grade pass'; }
      else { g.textContent=`⚠️ Bounce: ${s.compressionRatio}×`; g.className='grade partial'; }
    } catch(e) { console.error('stage60 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.compressionRatio||0).toFixed(1) + '×')(d); } catch(e) { return '—'; }
}
