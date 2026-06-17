// Stage 64: Optical Dirichlet L-functions & Primes in Progressions
//
// Dirichlet's theorem: if gcd(a,q)=1, there are infinitely many primes ≡ a mod q.
// Proof relies on L(1,χ) ≠ 0 for all characters χ mod q.
//
// Optical: display χ(n) ∈ {-1,0,+1} for real (quadratic) Dirichlet characters
// Camera sums → partial character sums S(N) = Σ χ(n)
// Verify Pólya–Vinogradov: |S(N)| ≤ √q · log q
//
// Educational: the foundation of analytic number theory — how characters
// control the distribution of primes among residue classes.

export async function run() {
  this.setRun(this.t('etap'), this.t('dirichlet_start'), 122.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};
  const mod = (a, p) => ((a % p) + p) % p;
  const modpow = (base, exp, p) => {
    base = mod(base, p); let result = 1;
    while (exp > 0) { if (exp & 1) result = (result * base) % p; base = (base * base) % p; exp >>= 1; }
    return result;
  };
  const legendreSymbol = (a, p) => {
    a = mod(a, p); if (a === 0) return 0;
    const r = modpow(a, (p - 1) / 2, p);
    return r === p - 1 ? -1 : r;
  };
  const sieve = (limit) => {
    const is = new Uint8Array(limit + 1).fill(1);
    is[0] = is[1] = 0;
    for (let i = 2; i * i <= limit; i++) if (is[i]) for (let j = i * i; j <= limit; j += i) is[j] = 0;
    return is;
  };
  const measureCalibrated = (frame) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = Math.floor(fh * 0.25), y1 = Math.floor(fh * 0.75);
    let sum = 0, count = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * fw + x) * 4;
        sum += (d[i] + d[i + 1] + d[i + 2]) / 3; count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };

  // ── Gamma calibration ──
  this.setRun(this.t('etap'), this.t('kalib'), 122.05);
  const gamma = cal.gamma || 2.0;
  const CENTER = 0.5, DELTA = 0.4;
  const V_DARK  = Math.round(255 * Math.pow(CENTER - DELTA, 1 / gamma));
  const V_MID   = Math.round(255 * Math.pow(CENTER, 1 / gamma));
  const V_BRIGHT = Math.round(255 * Math.pow(CENTER + DELTA, 1 / gamma));

  this.showColor(`rgb(${V_DARK},${V_DARK},${V_DARK})`);
  await this.sleep(500);
  const calDark = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V_BRIGHT},${V_BRIGHT},${V_BRIGHT})`);
  await this.sleep(500);
  const calBright = measureCalibrated(await this.captureStable(8, 50));
  const calCenter = (calDark + calBright) / 2;
  const calHalfRange = (calBright - calDark) / 2;

  // ── Quadratic Dirichlet characters χ_q(n) = Legendre(n, q) ──
  // For odd prime q, χ_q is the unique real non-principal character mod q
  this.setRun(this.t('etap'), this.t('dirichlet_chars'), 122.1);

  const isPrime = sieve(1000);
  const testModuli = [5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

  this.log('━━━ DIRICHLET L-FUNCTIONS ━━━');

  const charResults = [];

  for (const q of testModuli) {
    // Compute character values χ_q(n) = Legendre(n, q) for n=1..q-1
    const charValues = [];
    for (let n = 1; n < q; n++) charValues.push(legendreSymbol(n, q));

    // CPU: partial sums and L(1, χ)
    let L1 = 0;
    for (let n = 1; n <= 500; n++) {
      const chi = legendreSymbol(mod(n, q), q);
      L1 += chi / n;
    }

    // CPU: Pólya–Vinogradov bound
    const pvBound = Math.sqrt(q) * Math.log(q);
    let maxPartialSum = 0;
    let partialSum = 0;
    for (let n = 1; n <= 500; n++) {
      partialSum += legendreSymbol(mod(n, q), q);
      maxPartialSum = Math.max(maxPartialSum, Math.abs(partialSum));
    }
    const pvSatisfied = maxPartialSum <= pvBound;

    // Count primes in each residue class mod q
    const primeCounts = new Array(q).fill(0);
    for (let n = 2; n <= 500; n++) {
      if (isPrime[n]) primeCounts[n % q]++;
    }
    const equidist = primeCounts.filter((c, r) => r > 0 && c > 0).length;

    charResults.push({
      q, L1: +L1.toFixed(4), pvBound: +pvBound.toFixed(1),
      maxPartialSum, pvSatisfied, equidist,
      primeCounts: primeCounts.slice(1)
    });
  }

  // ── Optical character sums ──
  this.setRun(this.t('etap'), this.t('dirichlet_optical'), 122.3);

  const opticalModuli = testModuli.filter(q => q <= 47);
  const opticalResults = [];

  for (const q of opticalModuli) {
    // Display χ_q(n) for n=1..q-1 as brightness columns
    const N = q - 1;
    const pattern = [];
    for (let n = 1; n <= N; n++) pattern.push(legendreSymbol(n, q));

    const cpuSum = pattern.reduce((s, v) => s + v, 0); // should be 0 for full period

    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = `rgb(${V_MID},${V_MID},${V_MID})`;
      ctx.fillRect(0, 0, w, h);
      const colW = w / N;
      for (let i = 0; i < N; i++) {
        const v = pattern[i] === 1 ? V_BRIGHT : (pattern[i] === -1 ? V_DARK : V_MID);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(300);
    const frame = await this.captureStable(6, 40);
    const measured = measureCalibrated(frame);
    const norm = calHalfRange > 0.5 ? (measured - calCenter) / calHalfRange : 0;
    const optSum = Math.round(N * norm);
    const error = Math.abs(optSum - cpuSum);

    opticalResults.push({ q, N, cpuSum, optSum, error });
    this.log(`  χ mod ${q}: Σχ=${cpuSum}, opt=${optSum}${error <= 1 ? ' ✓' : ` Δ=${error}`}`);
  }

  const optCorr = opticalResults.length > 2 ?
    this.pearsonCorr(opticalResults.map(r => r.cpuSum), opticalResults.map(r => r.optSum)) : 0;
  const exactD = opticalResults.filter(r => r.error <= 1).length;

  // ── Results ──
  this.showColor('#000');
  this.setRun(this.t('etap'), this.t('dirichlet_result'), 122.8);

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const c of charResults.slice(0, 8)) {
    this.log(`  L(1,χ_${c.q}) = ${c.L1.toFixed(3)}, |S|_max=${c.maxPartialSum} ≤ ${c.pvBound.toFixed(0)} PV:${c.pvSatisfied ? '✓' : '✗'}`);
  }
  const allLnonzero = charResults.every(c => Math.abs(c.L1) > 0.01);
  const allPV = charResults.every(c => c.pvSatisfied);

  this.log(`  L(1,χ) ≠ 0 for all q: ${allLnonzero ? '✓' : '✗'} → Dirichlet theorem`);
  this.log(`  Pólya–Vinogradov bound: ${allPV ? '✓ all satisfied' : '✗'}`);
  this.log(`  Optical: ${exactD}/${opticalResults.length}, corr=${optCorr.toFixed(3)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage64 = {
    method: 'Optical Dirichlet character sums (γ-corrected)',
    allLnonzero, allPV,
    characters: charResults,
    optical: { correlation: +optCorr.toFixed(4), exactMatch: exactD, results: opticalResults }
  };
}

export function render(r) {
  if (r.stage64) { try {
    const s = r.stage64;
    this.rv('rv-dir-l', s.allLnonzero ? 'L(1,χ)≠0 ✓' : 'L=0?', s.allLnonzero ? 'ok' : 'warn');
    this.rv('rv-dir-pv', s.allPV ? 'PV ✓' : 'PV fail', s.allPV ? 'ok' : 'warn');
    this.rv('rv-dir-corr', `corr=${s.optical?.correlation?.toFixed(3)}`, s.optical?.correlation > 0.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s64');
    if (g) {
      g.textContent = s.allLnonzero ? '✅ Dirichlet + Pólya–Vinogradov ✓' : '⚠️';
      g.className = 'grade ' + (s.allLnonzero ? 'pass' : 'partial');
    }
  } catch(e) { console.error('s64:', e); } }
}

export function check(d) { try { return d && d.allLnonzero && d.allPV; } catch(e) { return false; } }
export function metric(d) { try { return d.allLnonzero ? 'L≠0 ✓' : 'L=0?'; } catch(e) { return '—'; } }
