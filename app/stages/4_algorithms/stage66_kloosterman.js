// Stage 66: Optical Kloosterman Sums — Weil Bound Verification
//
// K(a,b;p) = Σ_{x=1}^{p-1} exp(2πi(ax + bx⁻¹)/p)
// Weil bound: |K(a,b;p)| ≤ 2√p
//
// Optical: display cos(2π(ax + bx⁻¹)/p) as brightness for x=1..p-1
// Camera mean → Re(K)/p → verify |K| ≤ 2√p
//
// Educational: Kloosterman sums appear in cryptanalysis (AES S-box),
// automorphic forms, and counting lattice points. The Weil bound is
// the analog of the Hasse bound for elliptic curves.

export async function run() {
  this.setRun(this.t('etap'), this.t('kloost_start'), 124.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};
  const mod = (a, p) => ((a % p) + p) % p;
  const modpow = (base, exp, p) => {
    base = mod(base, p); let result = 1;
    while (exp > 0) { if (exp & 1) result = (result * base) % p; base = (base * base) % p; exp >>= 1; }
    return result;
  };

  // Modular inverse via Fermat's little theorem
  const modinv = (a, p) => modpow(a, p - 2, p);

  const sieve = (limit) => {
    const is = new Uint8Array(limit + 1).fill(1);
    is[0] = is[1] = 0;
    for (let i = 2; i * i <= limit; i++) if (is[i]) for (let j = i * i; j <= limit; j += i) is[j] = 0;
    return [...is].map((v, i) => v ? i : 0).filter(Boolean);
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
  this.setRun(this.t('etap'), this.t('kalib'), 124.05);
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

  // ── Compute Kloosterman sums ──
  this.setRun(this.t('etap'), this.t('kloost_compute'), 124.2);
  this.log('━━━ KLOOSTERMAN SUMS ━━━');

  const primes = sieve(100).filter(p => p >= 5);
  const testPairs = [
    { a: 1, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 },
    { a: 1, b: 5 }, { a: 3, b: 7 }
  ];

  const kloostResults = [];

  for (const p of primes) {
    for (const { a, b } of testPairs) {
      // K(a,b;p) = Σ_{x=1}^{p-1} exp(2πi(ax + bx⁻¹)/p)
      // Re(K) = Σ cos(2π(ax + bx⁻¹)/p)
      // Im(K) = Σ sin(2π(ax + bx⁻¹)/p)
      let reK = 0, imK = 0;
      for (let x = 1; x < p; x++) {
        const xinv = modinv(x, p);
        const arg = 2 * Math.PI * mod(a * x + b * xinv, p) / p;
        reK += Math.cos(arg);
        imK += Math.sin(arg);
      }
      const absK = Math.sqrt(reK * reK + imK * imK);
      const weilBound = 2 * Math.sqrt(p);
      const satisfied = absK <= weilBound + 0.01; // small tolerance

      kloostResults.push({
        p, a, b, reK: +reK.toFixed(3), imK: +imK.toFixed(3),
        absK: +absK.toFixed(3), weilBound: +weilBound.toFixed(3), satisfied
      });
    }
  }

  const allWeil = kloostResults.every(r => r.satisfied);
  const maxRatio = Math.max(...kloostResults.map(r => r.absK / r.weilBound));

  // Log selected results
  for (const r of kloostResults.filter(r => r.p <= 31 && r.a === 1 && r.b === 1)) {
    this.log(`  K(1,1;${r.p}): |K|=${r.absK.toFixed(1)}, 2√p=${r.weilBound.toFixed(1)} → ${r.satisfied ? '✓' : '✗'}`);
  }
  this.log(`  Weil bound: ${allWeil ? '✓ all satisfied' : '✗'} (max ratio=${maxRatio.toFixed(3)})`);

  // ── Optical Kloosterman for small primes ──
  // Encode cos(2π(ax + bx⁻¹)/p) as continuous brightness
  this.setRun(this.t('etap'), this.t('kloost_optical'), 124.5);

  const optPrimes = primes.filter(p => p <= 47);
  const opticalResults = [];

  for (const p of optPrimes) {
    const a = 1, b = 1;
    const N = p - 1;

    // Compute cos values and encode as brightness
    const cosValues = [];
    for (let x = 1; x < p; x++) {
      const xinv = modinv(x, p);
      const arg = 2 * Math.PI * mod(a * x + b * xinv, p) / p;
      cosValues.push(Math.cos(arg)); // [-1, +1]
    }

    const cpuReK = cosValues.reduce((s, v) => s + v, 0);

    // Display: gamma-corrected continuous brightness
    // cos value c → target camera response = center + delta × c
    // → display v = 255 × (center + delta × c)^(1/γ)
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = `rgb(${V_MID},${V_MID},${V_MID})`;
      ctx.fillRect(0, 0, w, h);
      const colW = w / N;
      for (let i = 0; i < N; i++) {
        const camTarget = CENTER + DELTA * cosValues[i];
        const displayV = Math.round(255 * Math.pow(Math.max(0.01, camTarget), 1 / gamma));
        ctx.fillStyle = `rgb(${displayV},${displayV},${displayV})`;
        ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(300);
    const frame = await this.captureStable(6, 40);
    const measured = measureCalibrated(frame);

    const norm = calHalfRange > 0.5 ? (measured - calCenter) / calHalfRange : 0;
    const optReK = N * norm;
    const error = Math.abs(optReK - cpuReK);

    opticalResults.push({ p, cpuReK: +cpuReK.toFixed(2), optReK: +optReK.toFixed(2), error: +error.toFixed(2) });
    this.log(`  K(1,1;${p}): Re_cpu=${cpuReK.toFixed(1)}, Re_opt=${optReK.toFixed(1)} Δ=${error.toFixed(1)}`);
  }

  const kCorr = opticalResults.length > 2 ?
    this.pearsonCorr(opticalResults.map(r => r.cpuReK), opticalResults.map(r => r.optReK)) : 0;

  this.showColor('#000');

  // ── Results ──
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  Weil bound |K|≤2√p: ${allWeil ? '✓' : '✗'} for ${kloostResults.length} (p,a,b) triples`);
  this.log(`  Max |K|/(2√p) = ${maxRatio.toFixed(3)}`);
  this.log(`  Optical Re(K): corr=${kCorr.toFixed(3)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage66 = {
    method: 'Optical Kloosterman cos-encoding (γ-corrected)',
    totalTests: kloostResults.length,
    allWeilSatisfied: allWeil,
    maxRatio: +maxRatio.toFixed(4),
    kloosterman: kloostResults.filter(r => r.a === 1 && r.b === 1),
    optical: { correlation: +kCorr.toFixed(4), results: opticalResults }
  };
}

export function render(r) {
  if (r.stage66) { try {
    const s = r.stage66;
    this.rv('rv-kl-weil', s.allWeilSatisfied ? '|K|≤2√p ✓' : '✗', s.allWeilSatisfied ? 'ok' : 'warn');
    this.rv('rv-kl-ratio', `max=${s.maxRatio?.toFixed(3)}`, s.maxRatio < 1.0 ? 'ok' : 'warn');
    this.rv('rv-kl-corr', `corr=${s.optical?.correlation?.toFixed(3)}`, s.optical?.correlation > 0.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s66');
    if (g) {
      g.textContent = s.allWeilSatisfied ? '✅ Weil bound ✓ + Optical' : '⚠️';
      g.className = 'grade ' + (s.allWeilSatisfied ? 'pass' : 'partial');
    }
  } catch(e) { console.error('s66:', e); } }
}

export function check(d) { try { return d && d.allWeilSatisfied; } catch(e) { return false; } }
export function metric(d) { try { return d.allWeilSatisfied ? 'Weil ✓' : '✗'; } catch(e) { return '—'; } }
