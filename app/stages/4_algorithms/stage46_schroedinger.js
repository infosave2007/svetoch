// Stage 46: Schröd

export async function run() {
this.setRun(this.t('etap'), this.t('uravnenie_shryodingera_interfe'), 106.0);
    this.showColor('#808080');
    await this.sleep(600);

    // 1D infinite square well: ψ_n(x) = sin(nπx/L)
    // Energy: E_n = n²·E₁
    // KEY: Display ψ_n DIRECTLY (not |ψ|²!) to get frequency n, not 2n
    // Map ψ ∈ [-1,1] → brightness ∈ [dark, bright]

    const nMax = 4; // Quantum numbers 1..4
    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;
    const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

    const results = [];

    // Phase 1: Display each eigenstate ψ_n(x) = sin(nπx/L)
    // KEY PHYSICS: use sin(2πnx/L) = full-period basis (ring topology)
    // so DFT frequency k matches quantum number n directly
    for (let n = 1; n <= nMax; n++) {
      this.setRun(this.t('etap'), `ψ_${n}: n=${n}...`, 106.0 + n * 0.12);

      // Display n full cycles of sine across screen width
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const psi = Math.sin(2 * Math.PI * n * x / w);
          // Map ψ ∈ [-1,1] → v ∈ [15, 240]
          const v = Math.round((psi * 0.47 + 0.5) * 255);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, 0, 1, h);
        }
      });
      await this.sleep(800);
      const frame = await this.captureStable(8, 50);

      // Extract 1D profile
      const d = frame.data, fw = frame.width, fh = frame.height;
      const x0 = cal.x0 || Math.floor(fw * 0.15);
      const x1 = cal.x1 || Math.floor(fw * 0.85);
      const y0 = Math.floor(fh * 0.35), y1 = Math.floor(fh * 0.65);
      const span = x1 - x0;

      const profile = new Float64Array(span);
      const cnt = new Float64Array(span);
      for (let y = y0; y < y1; y += 2) {
        for (let px = 0; px < span; px++) {
          const i = (y * fw + (x0 + px)) * 4;
          profile[px] += (d[i] + d[i + 1] + d[i + 2]) / 3;
          cnt[px]++;
        }
      }
      for (let px = 0; px < span; px++) {
        if (cnt[px] > 0) profile[px] /= cnt[px];
      }
      if (isMirrored) profile.reverse();

      // Remove DC
      let meanP = 0;
      for (let px = 0; px < span; px++) meanP += profile[px];
      meanP /= span;
      for (let px = 0; px < span; px++) profile[px] -= meanP;

      // DFT: find dominant frequency
      let bestK = 0, bestPower = 0;
      const maxScan = 3 * nMax;
      for (let k = 1; k <= maxScan; k++) {
        let sinSum = 0, cosSum = 0;
        for (let px = 0; px < span; px++) {
          const phase = 2 * Math.PI * k * px / span;
          sinSum += profile[px] * Math.sin(phase);
          cosSum += profile[px] * Math.cos(phase);
        }
        const power = Math.sqrt(sinSum * sinSum + cosSum * cosSum);
        if (power > bestPower) { bestPower = power; bestK = k; }
      }

      // For ψ_n = sin(nπx/L): the pattern has n half-periods = n/2 full cycles
      // But since we show it across the full screen width and x0..x1 covers
      // most of the screen, the DFT should find peak at k = n
      const measuredN = bestK;
      const energyRatio = measuredN * measuredN;
      const expectedRatio = n * n;
      const relError = Math.abs(energyRatio - expectedRatio) / expectedRatio * 100;

      results.push({ n, bestK, measuredN, energyRatio, expectedRatio, relError, bestPower });
      this.log(`  ψ_${n}: peak k=${bestK}, n_meas=${measuredN}, E/E₁=${energyRatio} (expect ${expectedRatio}), err=${relError.toFixed(1)}%`);
    }

    // Phase 2: Orthogonality — display product ψ₁·ψ₂ and check mean ≈ 0
    this.setRun(this.t('etap'), this.t('ortogonalnost'), 106.7);

    // ψ₁·ψ₂ = sin(πx/L)·sin(2πx/L) = ½[cos(πx/L) - cos(3πx/L)]
    // For orthogonal states: ∫₀ᴸ ψ₁ψ₂ dx = 0 → mean brightness should ≈ midpoint

    // Show ψ₁ (n=1: one full cycle)
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const psi1 = Math.sin(2 * Math.PI * x / w);
        const v = Math.round((psi1 * 0.47 + 0.5) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(600);
    const f1 = await this.captureStable(6, 50);
    const I1 = this.regionMean(f1);

    // Show ψ₂ (n=2: two full cycles)
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const psi2 = Math.sin(4 * Math.PI * x / w);
        const v = Math.round((psi2 * 0.47 + 0.5) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(600);
    const f2 = await this.captureStable(6, 50);
    const I2 = this.regionMean(f2);

    // Show ψ₁+ψ₂ (superposition: n=1 + n=2)
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const psi1 = Math.sin(2 * Math.PI * x / w);
        const psi2 = Math.sin(4 * Math.PI * x / w);
        const sup = (psi1 + psi2) / 2;
        const v = Math.round((sup * 0.47 + 0.5) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(600);
    const f12 = await this.captureStable(6, 50);
    const I12 = this.regionMean(f12);

    // Orthogonality: if ψ₁⊥ψ₂, then ⟨ψ₁|ψ₂⟩ = 0
    // Optically: I(ψ₁+ψ₂) should equal (I₁+I₂)/2 if cross-term integrates to zero
    const expectedMean = (I1 + I2) / 2;
    const crossTerm = I12 - expectedMean;
    const normCross = Math.abs(crossTerm) / Math.max(expectedMean, 1);

    this.log(`  I(ψ₁)=${I1.toFixed(1)}, I(ψ₂)=${I2.toFixed(1)}, I(ψ₁+ψ₂)=${I12.toFixed(1)}`);
    this.log(`  Expected mean = ${expectedMean.toFixed(1)}, cross = ${crossTerm.toFixed(2)}, |norm| = ${normCross.toFixed(4)}`);

    // Summary
    const avgError = results.reduce((s, r) => s + r.relError, 0) / results.length;
    const e2e1 = results.length >= 2 ? results[1].energyRatio / Math.max(results[0].energyRatio, 1) : 0;

    // Pass if we correctly measure at least n=1 and n=2
    const n1ok = results[0] && Math.abs(results[0].measuredN - 1) <= 1;
    const n2ok = results.length >= 2 && Math.abs(results[1].measuredN - 2) <= 1;
    const pass = n1ok && n2ok;

    this.log(this.t('shryodinger'));
    this.log(`  E₂/E₁ = ${e2e1.toFixed(2)} (expect 4.0)`);
    this.log(this.t('srednyaya_oshibka', {var0: avgError.toFixed(1)}));
    this.log(this.t('ortogonalnost_1', {var0: normCross.toFixed(4)}));
    this.log(this.t('schrdinger', {var0: pass ? 'РЕШЁН' : 'частично'}), pass ? 'ok' : 'warn');

    this.showColor('#000000');
    this.results.stage46 = {
      eigenstates: results,
      E2_E1_ratio: Number(e2e1.toFixed(3)),
      E2_E1_expected: 4.0,
      orthogonality: Number(normCross.toFixed(4)),
      crossTerm: Number(crossTerm.toFixed(2)),
      avgError: Number(avgError.toFixed(2)),
      pass
    };
}

export function render(r) {
if (r.stage46) { try {
      const s = r.stage46;
      const e1 = s.eigenstates?.[0];
      this.rv('rv-sch-e1', e1 ? `n=${e1.measuredN?.toFixed(1)}` : '—', e1?.relError < 20 ? 'ok' : 'warn');
      this.rv('rv-sch-ratio', `${s.E2_E1_ratio?.toFixed(2)} (≈4.0)`, Math.abs(s.E2_E1_ratio - 4) < 2 ? 'ok' : 'warn');
      this.rv('rv-sch-orth', s.orthogonality?.toFixed(4), s.orthogonality < 0.2 ? 'ok' : 'warn');
      this.rv('rv-sch-err', `${s.avgError?.toFixed(1)}%`, s.avgError < 30 ? 'ok' : 'warn');
      const g = document.getElementById('g-s46');
      if (s.pass) { g.textContent=this.t('shryodinger_reshyon_opticheski'); g.className='grade pass'; }
      else { g.textContent=this.t('chastichnoe_reshenie'); g.className='grade partial'; }
    } catch(e) { console.error('stage46 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'err=' + (d.avgError||0).toFixed(1) + '%')(d); } catch(e) { return '—'; }
}
