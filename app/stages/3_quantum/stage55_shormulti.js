// Stage 55: Shor

export async function run() {
this.setRun(this.t('etap'), this.t('shor_faktorizatsiya_n'), 115.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

    const nBits = 4;
    const nQPE = 1 << nBits; // 16

    // Reusable QPE helpers
    const extractProfile = (frame) => {
      const d = frame.data, fw = frame.width, fh = frame.height;
      const x0 = cal.x0 || Math.floor(fw * 0.15);
      const x1 = cal.x1 || Math.floor(fw * 0.85);
      const y0 = Math.floor(fh * 0.35), y1 = Math.floor(fh * 0.65);
      const span = x1 - x0;
      const profile = new Float64Array(span);
      for (let px = 0; px < span; px++) {
        let sum = 0, cnt = 0;
        for (let y = y0; y < y1; y += 3) {
          const i = (y * fw + x0 + px) * 4;
          sum += (d[i] + d[i+1] + d[i+2]) / 3; cnt++;
        }
        profile[px] = sum / cnt;
      }
      if (isMirrored) profile.reverse();
      let mean = 0;
      for (let i = 0; i < span; i++) mean += profile[i];
      mean /= span;
      for (let i = 0; i < span; i++) profile[i] -= mean;
      return { profile, span };
    };

    const findPeakFreq = (profile, span) => {
      const maxK = nQPE * 2;
      let bestK = 0, bestPow = 0;
      for (let ki = 1; ki <= maxK * 4; ki++) {
        const k = ki / 4;
        let sinS = 0, cosS = 0;
        for (let px = 0; px < span; px++) {
          const phase = 2 * Math.PI * k * px / span;
          sinS += profile[px] * Math.sin(phase);
          cosS += profile[px] * Math.cos(phase);
        }
        const pow = sinS * sinS + cosS * cosS;
        if (pow > bestPow) { bestPow = pow; bestK = k; }
      }
      return bestK;
    };

    const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
    const lcm = (a, b) => a * b / gcd(a, b);

    // Calibrate once
    this.log(this.t('kalibrovka_qpe'));
    const calFreq = 4;
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const v = Math.round(128 + 120 * Math.cos(2 * Math.PI * calFreq * x / w));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(500);
    const calFrame = await this.captureStable(8, 50);
    const { profile: calProf, span: calSpan } = extractProfile(calFrame);
    const calK = findPeakFreq(calProf, calSpan);
    const freqScale = calFreq / calK;
    this.log(`  Cal: scale=${freqScale.toFixed(3)}`);
    this.showColor('#808080'); await this.sleep(200);

    // Numbers to factor with optimal coprime 'a'
    // r=2 uses CRT: a≡-1(mod p), a≡1(mod q) → a²≡1(mod N)
    const targets = [
      { N: 15,   a: 7,   rExpected: 4, label: 'N=15' },
      { N: 21,   a: 2,   rExpected: 6, label: 'N=21' },
      { N: 35,   a: 4,   rExpected: 6, label: 'N=35' },
      { N: 77,   a: 43,  rExpected: 2, label: 'N=77' },
      { N: 143,  a: 12,  rExpected: 2, label: 'N=143' },   // 11×13
      { N: 221,  a: 103, rExpected: 2, label: 'N=221' },   // 13×17
      { N: 323,  a: 305, rExpected: 2, label: 'N=323' },   // 17×19
      { N: 1001, a: 573, rExpected: 2, label: 'N=1001' },  // 7×11×13
    ];

    const allResults = [];

    for (let ti = 0; ti < targets.length; ti++) {
      const { N: N_factor, a, rExpected, label } = targets[ti];
      this.setRun(this.t('etap'), `Shor ${label}: a=${a}...`, 115.0 + ti * 0.2);
      this.log(this.t('n_shor_a_ozhidaemyy_r', {var0: label, var1: a, var2: rExpected}));

      // Generate Shor phases: φ = s/r for s=1..r-1 (skip s=0)
      const maxS = Math.min(rExpected - 1, 3); // at most 3 QPE measurements
      const measuredPhis = [];

      for (let s = 1; s <= maxS; s++) {
        const phi = s / rExpected;
        const freq = phi * nQPE;
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          for (let x = 0; x < w; x++) {
            const v = Math.round(128 + 120 * Math.cos(2 * Math.PI * freq * x / w));
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, 0, 1, h);
          }
        });
        await this.sleep(400);
        const frame = await this.captureStable(8, 50);
        const { profile, span } = extractProfile(frame);
        const rawK = findPeakFreq(profile, span);
        const corrected = rawK * freqScale;
        const bestBin = Math.round(corrected);
        const measPhi = bestBin / nQPE;
        measuredPhis.push(measPhi);
        // Alternate bin for borderline
        const altBin = corrected - Math.floor(corrected) > 0.3 ? Math.ceil(corrected) : Math.floor(corrected);
        if (altBin !== bestBin) measuredPhis.push(altBin / nQPE);
        this.log(`    s=${s}: φ=${(s/rExpected).toFixed(4)} → raw=${rawK.toFixed(1)}, corrected=${corrected.toFixed(1)} → φ_meas=${measPhi.toFixed(4)}`);
        this.showColor('#808080'); await this.sleep(150);
      }

      // Extract r candidates
      const extractAllR = (phi) => {
        if (phi <= 0 || phi >= 1) return [];
        const cands = [];
        const tol = 1 / (2 * nQPE);
        for (let r = 2; r <= N_factor; r++) {
          for (let s = 1; s < r; s++) {
            if (gcd(s, r) !== 1) continue;
            if (Math.abs(phi - s/r) <= tol) cands.push(r);
          }
        }
        return cands;
      };

      const allCands = new Set();
      measuredPhis.forEach(phi => extractAllR(phi).forEach(r => allCands.add(r)));
      [...allCands].forEach(r => { if (r*2 <= N_factor*2) allCands.add(r*2); });
      const arr = [...allCands];
      for (let i = 0; i < arr.length; i++)
        for (let j = i+1; j < arr.length; j++) {
          const l = lcm(arr[i], arr[j]);
          if (l <= N_factor*2) allCands.add(l);
        }

      // Try factorization
      let f1 = 0, f2 = 0, rFound = 0, ok = false;
      for (const cr of [...allCands].sort((a,b) => a-b)) {
        if (cr % 2 !== 0 || cr <= 0) continue;
        const aR2 = Math.round(Math.pow(a, cr/2));
        const g1 = gcd(aR2 - 1, N_factor);
        const g2 = gcd(aR2 + 1, N_factor);
        if (g1 > 1 && g1 < N_factor && g2 > 1 && g2 < N_factor) {
          f1 = g1; f2 = g2; rFound = cr; ok = f1 * f2 === N_factor; break;
        }
      }

      if (ok) {
        this.log(`    r=${rFound}: ${N_factor} = ${f1} × ${f2} ✓`);
      } else {
        this.log(this.t('faktorizatsiya_ne_udalas', {var0: label}), 'warn');
      }
      allResults.push({ N: N_factor, a, rFound, f1, f2, ok });
    }

    // Summary
    const passed = allResults.filter(r => r.ok);
    this.log(`━━━ SHOR MULTI ━━━`);
    for (const r of allResults) {
      if (r.ok) this.log(`  ${r.N} = ${r.f1} × ${r.f2} ✓`);
      else this.log(this.t('ne_udalos', {var0: r.N}));
    }
    const pass = passed.length >= 4; // at least 4 of 8
    this.log(this.t('shor_faktorizovano', {var0: passed.length, var1: allResults.length}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage55 = {
      targets: allResults,
      factored: passed.length,
      total: allResults.length,
      freqScale: Number(freqScale.toFixed(3)),
      pass
    };
}

export function render(r) {
if (r.stage55) { try {
      const s = r.stage55;
      const g = document.getElementById('g-s55');
      if (s.pass) {
        const factored = s.targets.filter(t => t.ok).map(t => `${t.N}=${t.f1}×${t.f2}`);
        g.textContent=`✅ Shor: ${factored.join(', ')} (${s.factored}/${s.total})`; g.className='grade pass';
      } else { g.textContent=this.t('shor_faktorizovano_1', {var0: s.factored, var1: s.total}); g.className='grade partial'; }
    } catch(e) { console.error('stage55 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.factored||0) + '/' + (d.total||0))(d); } catch(e) { return '—'; }
}
