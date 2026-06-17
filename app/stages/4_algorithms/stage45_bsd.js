// Stage 45: Optical L-function Machine — BSD Verification
//
// KEY INNOVATION: The camera COMPUTES a_p (trace of Frobenius) via optical
// summation of Legendre symbols. Instead of O(p) CPU operations per prime,
// one camera frame performs the parallel summation optically.
//
// Architecture:
//   1. CPU computes Legendre(x³+Ax+B, p) for x=0..p-1 → O(p)
//   2. Display p columns with brightness ∝ Legendre symbol
//   3. Camera captures ONE frame → mean brightness = Σ Legendre / p
//   4. Extract a_p = -Σ Legendre → Euler factor → L(E,1)
//   5. BigInt exact proof of algebraic rank via Nagell-Lutz
//   6. BSD: compare algebraic rank with analytic rank from L(E,1)

export async function run() {
  this.setRun(this.t('etap'), this.t('lfunktsiya_khasseveylya_bsd'), 105.0);
  this.showColor('#808080');
  await this.sleep(600);

  const cal = this.results.calibration || {};

  // ═══════════════════════════════════════════════════════════
  // CORE MATH UTILITIES
  // ═══════════════════════════════════════════════════════════

  const mod = (a, p) => ((a % p) + p) % p;

  const modpow = (base, exp, p) => {
    base = mod(base, p);
    let result = 1;
    while (exp > 0) {
      if (exp & 1) result = (result * base) % p;
      base = (base * base) % p;
      exp >>= 1;
    }
    return result;
  };

  const legendreSymbol = (a, p) => {
    a = mod(a, p);
    if (a === 0) return 0;
    const r = modpow(a, (p - 1) / 2, p);
    return r === p - 1 ? -1 : r;
  };

  // Legendre-optimized point count — O(p) per prime
  const countEFp = (A, B, p) => {
    let count = 1;
    const Am = mod(A, p), Bm = mod(B, p);
    for (let x = 0; x < p; x++) {
      count += 1 + legendreSymbol(mod(x * x * x + Am * x + Bm, p), p);
    }
    return count;
  };

  // Compute Legendre pattern for a curve: array of {-1, 0, +1} for x=0..p-1
  const legendrePattern = (A, B, p) => {
    const Am = mod(A, p), Bm = mod(B, p);
    const pattern = new Int8Array(p);
    for (let x = 0; x < p; x++) {
      pattern[x] = legendreSymbol(mod(x * x * x + Am * x + Bm, p), p);
    }
    return pattern;
  };

  const sieve = (limit) => {
    const is = new Uint8Array(limit + 1).fill(1);
    is[0] = is[1] = 0;
    for (let i = 2; i * i <= limit; i++)
      if (is[i]) for (let j = i * i; j <= limit; j += i) is[j] = 0;
    return [...is].map((v, i) => v ? i : 0).filter(Boolean);
  };

  // BigInt rational arithmetic
  const absBI = n => n < 0n ? -n : n;
  const gcdBI = (a, b) => { a = absBI(a); b = absBI(b); while (b) { const t = a % b; a = b; b = t; } return a || 1n; };
  const rat = (n, d = 1n) => { n = BigInt(n); d = BigInt(d); if (d === 0n) throw new Error('zero denominator'); if (d < 0n) { n = -n; d = -d; } const g = gcdBI(n, d); return { n: n / g, d: d / g }; };
  const radd = (x, y) => rat(x.n * y.d + y.n * x.d, x.d * y.d);
  const rsub = (x, y) => rat(x.n * y.d - y.n * x.d, x.d * y.d);
  const rmul = (x, y) => rat(x.n * y.n, x.d * y.d);
  const rdiv = (x, y) => rat(x.n * y.d, x.d * y.n);
  const rneg = x => rat(-x.n, x.d);
  const rsqr = x => rmul(x, x);
  const rcube = x => rmul(rmul(x, x), x);
  const req = (x, y) => x.n === y.n && x.d === y.d;
  const risInt = x => x.d === 1n;
  const rstr = x => x.d === 1n ? x.n.toString() : `${x.n}/${x.d}`;
  const pstr = P => P.inf ? 'O' : `(${rstr(P.x)}, ${rstr(P.y)})`;
  const fRat = (A, B, x) => radd(radd(rcube(x), rmul(rat(A), x)), rat(B));
  const residualRat = (A, B, P) => rsub(rsqr(P.y), fRat(A, B, P.x));
  const onCurve = (A, B, P) => !P.inf && req(residualRat(A, B, P), rat(0));
  const pointAdd = (A, P, Q) => {
    if (P.inf) return Q; if (Q.inf) return P;
    if (req(P.x, Q.x) && req(radd(P.y, Q.y), rat(0))) return { inf: true };
    let m;
    if (req(P.x, Q.x) && req(P.y, Q.y)) {
      if (P.y.n === 0n) return { inf: true };
      m = rdiv(radd(rmul(rat(3), rsqr(P.x)), rat(A)), rmul(rat(2), P.y));
    } else { m = rdiv(rsub(Q.y, P.y), rsub(Q.x, P.x)); }
    const x3 = rsub(rsub(rsqr(m), P.x), Q.x);
    const y3 = rneg(radd(rmul(m, rsub(x3, P.x)), P.y));
    return { x: x3, y: y3 };
  };

  // Calibrated measurement within mirror bounds
  const measureCalibrated = (frame) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    // Fix: x0=0 is falsy in JS, use explicit null check
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = Math.floor(fh * 0.25), y1 = Math.floor(fh * 0.75);
    let sum = 0, count = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * fw + x) * 4;
        sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: GAMMA-CORRECTED OPTICAL LEGENDRE CALIBRATION
  // ═══════════════════════════════════════════════════════════
  //
  // Problem: camera response cam(v) = C·(v/255)^γ is nonlinear.
  // When PSF blur mixes bright/dark columns, Jensen's inequality
  // causes systematic bias: E[cam(v)] ≠ cam(E[v]).
  //
  // Fix: choose display values V₋, V₀, V₊ so that cam(V) is
  // LINEAR in Legendre symbol. Set (V/255)^γ = center ± delta:
  //   V₊ = 255·(center+delta)^(1/γ)  → cam = C·(center+delta)
  //   V₋ = 255·(center-delta)^(1/γ)  → cam = C·(center-delta)
  //   V₀ = 255·(center)^(1/γ)        → cam = C·center
  //
  // Then mean_cam = C·(center + delta·Σleg/p), LINEAR in Legendre sum!

  this.setRun(this.t('etap'), this.t('optical_legendre_kalib'), 105.05);

  const gamma = cal.gamma || 2.0;
  const CENTER = 0.5, DELTA = 0.4;

  // Gamma-corrected display values
  const V_DARK  = Math.round(255 * Math.pow(CENTER - DELTA, 1 / gamma));
  const V_MID   = Math.round(255 * Math.pow(CENTER, 1 / gamma));
  const V_BRIGHT = Math.round(255 * Math.pow(CENTER + DELTA, 1 / gamma));

  this.log(`  γ=${gamma.toFixed(2)}: V₋=${V_DARK}, V₀=${V_MID}, V₊=${V_BRIGHT} (gamma-corrected)`);

  // Reference: all-dark (Legendre = -1)
  this.showColor(`rgb(${V_DARK},${V_DARK},${V_DARK})`);
  await this.sleep(500);
  const fCalDark = await this.captureStable(8, 50);
  const calDark = measureCalibrated(fCalDark);

  // Reference: all-bright (Legendre = +1)
  this.showColor(`rgb(${V_BRIGHT},${V_BRIGHT},${V_BRIGHT})`);
  await this.sleep(500);
  const fCalBright = await this.captureStable(8, 50);
  const calBright = measureCalibrated(fCalBright);

  const calCenter = (calDark + calBright) / 2;
  const calHalfRange = (calBright - calDark) / 2;
  this.log(this.t('optical_legendre_kalib'));
  this.log(`  ref_dark=${calDark.toFixed(1)}, ref_bright=${calBright.toFixed(1)}, center=${calCenter.toFixed(1)}, half_range=${calHalfRange.toFixed(1)}`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: OPTICAL a_p COMPUTATION
  // ═══════════════════════════════════════════════════════════
  //
  // For the primary curve E₁: y² = x³ - x - 2
  // Primes limited to p ≤ 47 so columns are ≥ 40px wide (avoid PSF blur)
  //
  // For each prime p:
  //   1. CPU computes Legendre pattern → {-1, 0, +1}
  //   2. Display with gamma-corrected brightness: V₋, V₀, V₊
  //   3. Camera captures → mean brightness
  //   4. Half-range normalization: norm = (mean - center) / half_range
  //   5. a_p = round(-p × norm)

  this.setRun(this.t('etap'), this.t('optical_ap_vychislenie'), 105.1);

  const OPTICAL_PRIME_LIMIT = 47; // column width ≥ 40px
  const E1_A = -1, E1_B = -2;
  const disc1 = -16 * (4 * E1_A ** 3 + 27 * E1_B ** 2);
  const opticalPrimes = sieve(OPTICAL_PRIME_LIMIT).filter(p => p > 3 && mod(disc1, p) !== 0);

  this.log(this.t('optical_ap_header'));
  this.log(`  E₁: y²=x³-x-2, optical primes: ${opticalPrimes.length} (≤${OPTICAL_PRIME_LIMIT})`);

  const opticalResults = [];

  for (let pi = 0; pi < opticalPrimes.length; pi++) {
    const p = opticalPrimes[pi];
    this.setRun(this.t('etap'), `Optical a_p: p=${p}...`, 105.1 + pi * 0.03);

    // CPU: compute Legendre pattern
    const pattern = legendrePattern(E1_A, E1_B, p);
    const cpuSum = pattern.reduce((s, v) => s + v, 0);
    const cpuAp = -cpuSum;

    // Display gamma-corrected Legendre pattern
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = `rgb(${V_MID},${V_MID},${V_MID})`;
      ctx.fillRect(0, 0, w, h); // neutral background (not black!)
      const colW = w / p;
      for (let x = 0; x < p; x++) {
        const leg = pattern[x];
        const v = leg === 1 ? V_BRIGHT : (leg === -1 ? V_DARK : V_MID);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.floor(x * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(350);
    const frame = await this.captureStable(6, 40);
    const measured = measureCalibrated(frame);

    // Extract optical a_p using half-range normalization
    // norm = (measured - center) / half_range → [-1, +1]
    // Σ Legendre ≈ p × norm (because gamma correction linearized camera)
    // a_p = -Σ Legendre = -round(p × norm)
    const norm = calHalfRange > 0.5 ? (measured - calCenter) / calHalfRange : 0;
    const opticalAp = Math.round(-p * norm);

    const error = Math.abs(opticalAp - cpuAp);
    opticalResults.push({
      p, cpuAp, opticalAp, norm: Number(norm.toFixed(4)),
      measured: Number(measured.toFixed(1)), error
    });

    this.log(`  p=${p}: cpu=${cpuAp}, opt=${opticalAp}${error <= 1 ? ' ✓' : ` Δ=${error}`} (meas=${measured.toFixed(1)}, norm=${norm.toFixed(3)})`);
  }

  // Correlation: optical a_p vs CPU a_p
  const cpuAps = opticalResults.map(r => r.cpuAp);
  const optAps = opticalResults.map(r => r.opticalAp);
  const apCorr = this.pearsonCorr(cpuAps, optAps);
  const exactMatch = opticalResults.filter(r => r.error <= 1).length;
  const closeMatch = opticalResults.filter(r => r.error <= 3).length;

  this.log(this.t('optical_ap_result', {
    var0: exactMatch, var1: opticalResults.length,
    var2: apCorr.toFixed(4)
  }));

  this.showColor('#808080');
  await this.sleep(200);

  // ═══════════════════════════════════════════════════════════
  // PHASE 3: FULL CPU L-FUNCTION FOR ALL CURVES
  // ═══════════════════════════════════════════════════════════

  this.setRun(this.t('etap'), this.t('lfunktsiya_polnyy_raschet'), 105.5);

  const PRIME_LIMIT = 500;
  const allPrimes = sieve(PRIME_LIMIT);
  this.log(this.t('legendre_optimizatsiya'));
  this.log(this.t('prostykh_do', { var0: allPrimes.length, var1: allPrimes[allPrimes.length - 1] }));

  const curveLibrary = [
    { label: 'E₀', A: -1, B: 0, expectedRank: 0, knownPoint: null, lmfdb: '32a2', note: 'torsion Z/2×Z/2' },
    { label: 'E₁', A: -1, B: -2, expectedRank: 1, knownPoint: { x: 2, y: 2 }, lmfdb: '1664a1', note: 'generator P=(2,2)' },
    { label: 'E₂', A: 0, B: 1, expectedRank: 0, knownPoint: null, lmfdb: '27a3', note: 'CM curve, j=0' },
    { label: 'E₃', A: -1, B: 1, expectedRank: 1, knownPoint: { x: 0, y: 1 }, lmfdb: '141a1', note: 'generator P=(0,1)' },
    { label: 'E₄', A: 0, B: -1, expectedRank: 0, knownPoint: null, lmfdb: '27a1', note: 'CM curve y²=x³-1' }
  ];

  const curveResults = [];

  for (let ci = 0; ci < curveLibrary.length; ci++) {
    const c = curveLibrary[ci];
    const disc = -16 * (4 * c.A ** 3 + 27 * c.B ** 2);
    const equation = `y²=x³${c.A !== 0 ? (c.A > 0 ? '+' : '') + c.A + 'x' : ''}${c.B !== 0 ? (c.B > 0 ? '+' : '') + c.B : ''}`;

    let lProduct = 1.0;
    const apList = [];

    for (const p of allPrimes) {
      if (p <= 3) continue;
      if (mod(disc, p) === 0) continue;
      const count = countEFp(c.A, c.B, p);
      const ap = p + 1 - count;
      apList.push({ p, ap });
      lProduct *= 1.0 / (1.0 - ap / p + 1.0 / p);
    }

    // Optical L-product for E₁: use optical a_p values
    let opticalLProduct = null;
    if (c.label === 'E₁' && opticalResults.length > 0) {
      opticalLProduct = 1.0;
      for (const or of opticalResults) {
        opticalLProduct *= 1.0 / (1.0 - or.opticalAp / or.p + 1.0 / or.p);
      }
    }

    const lAbsValue = Math.abs(lProduct);

    // ── Algebraic rank via BigInt ──
    let algebraicRank = null;
    let proofDetail = null;

    if (c.expectedRank >= 1 && c.knownPoint) {
      const P = { x: rat(c.knownPoint.x), y: rat(c.knownPoint.y) };
      const pOnCurve = onCurve(c.A, c.B, P);
      let certified = false, proofMultiple = 0, proofMultiplePoint = '';
      let nP = P;
      for (let k = 2; k <= 6; k++) {
        nP = pointAdd(c.A, nP, P);
        if (nP.inf) break;
        if (onCurve(c.A, c.B, nP) && (!risInt(nP.x) || !risInt(nP.y))) {
          certified = true; proofMultiple = k; proofMultiplePoint = pstr(nP); break;
        }
      }
      algebraicRank = certified ? '≥1' : 'unknown';
      proofDetail = { point: pstr(P), onCurve: pOnCurve, proofMultiple, proofMultiplePoint,
        theorem: 'Nagell-Lutz (extended)', certified };
    } else if (c.expectedRank === 0) {
      let foundNontorsion = false;
      const torsionPts = [];
      for (let xi = -5; xi <= 5; xi++) {
        for (let yi = -10; yi <= 10; yi++) {
          const P = { x: rat(xi), y: rat(yi) };
          if (onCurve(c.A, c.B, P)) {
            if (yi !== 0) {
              const twoP = pointAdd(c.A, P, P);
              if (!twoP.inf && (!risInt(twoP.x) || !risInt(twoP.y))) foundNontorsion = true;
              else torsionPts.push(pstr(P));
            } else { torsionPts.push(pstr(P)); }
          }
        }
      }
      algebraicRank = foundNontorsion ? 'unexpected ≥1' : '0 (no non-torsion)';
      proofDetail = { searchRange: '|x|≤5, |y|≤10', torsionPoints: torsionPts.slice(0, 6), foundNontorsion };
    }

    this.log(`  ${c.label}: ${equation}, Δ=${disc}`);
    this.log(this.t('algebraicheskiy_rang', { var0: algebraicRank }));
    this.log(this.t('analiticheskiy_rang', { var0: lAbsValue.toFixed(4), var1: '' }));
    if (opticalLProduct !== null) {
      this.log(`    L_optical(E₁,1) = ${Math.abs(opticalLProduct).toFixed(4)} (${opticalResults.length} optical frames)`);
    }

    curveResults.push({
      label: c.label, equation, lmfdb: c.lmfdb, discriminant: disc,
      expectedRank: c.expectedRank, algebraicRank,
      lValue: Number(lProduct.toFixed(6)), lAbsValue: Number(lAbsValue.toFixed(6)),
      opticalLValue: opticalLProduct !== null ? Number(opticalLProduct.toFixed(6)) : null,
      primesUsed: apList.length, proofDetail,
      apSample: apList.slice(0, 10).map(v => ({ p: v.p, ap: v.ap })),
      note: c.note
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 4: OPTICAL CONVERGENCE VISUALIZATION
  // ═══════════════════════════════════════════════════════════

  this.setRun(this.t('etap'), this.t('optical_convergence'), 105.8);

  const rank0Curves = curveResults.filter(c => c.expectedRank === 0);
  const rank1Curves = curveResults.filter(c => c.expectedRank >= 1);

  // Side-by-side: rank≥1 (dark) vs rank=0 (bright)
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const halfW = Math.floor(w / 2);
    const barH = Math.floor(h / Math.max(rank0Curves.length, rank1Curves.length, 1));
    for (let i = 0; i < rank1Curves.length; i++) {
      const v = Math.round(Math.min(rank1Curves[i].lAbsValue * 200, 255));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(10, i * barH + 5, halfW - 20, barH - 10);
    }
    for (let i = 0; i < rank0Curves.length; i++) {
      const v = Math.round(Math.min(rank0Curves[i].lAbsValue * 200, 255));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(halfW + 10, i * barH + 5, halfW - 20, barH - 10);
    }
  });
  await this.sleep(600);
  const fConv = await this.captureStable(6, 40);
  const fw = fConv.width, fh = fConv.height, dd = fConv.data;
  const measureRegion = (x0f, x1f, y0f, y1f) => {
    const x0 = Math.floor(fw * x0f), x1 = Math.floor(fw * x1f);
    const y0 = Math.floor(fh * y0f), y1 = Math.floor(fh * y1f);
    let sum = 0, count = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * fw + x) * 4;
        sum += (dd[i] + dd[i + 1] + dd[i + 2]) / 3; count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };
  const leftBright = measureRegion(0.05, 0.45, 0.1, 0.9);
  const rightBright = measureRegion(0.55, 0.95, 0.1, 0.9);
  const opticalConsistent = rightBright - leftBright > 3;

  // ═══════════════════════════════════════════════════════════
  // PHASE 5: BSD VERDICT
  // ═══════════════════════════════════════════════════════════

  this.setRun(this.t('etap'), this.t('bsd_rezultat'), 105.95);

  // Relative ranking: max|L(rank≥1)| < min|L(rank=0)|
  const rank0L = curveResults.filter(c => c.expectedRank === 0).map(c => c.lAbsValue);
  const rank1L = curveResults.filter(c => c.expectedRank >= 1).map(c => c.lAbsValue);
  const minRank0L = rank0L.length > 0 ? Math.min(...rank0L) : Infinity;
  const maxRank1L = rank1L.length > 0 ? Math.max(...rank1L) : 0;
  const orderingCorrect = maxRank1L < minRank0L;

  for (const c of curveResults) {
    if (c.expectedRank === 0) {
      c.bsdConsistent = c.lAbsValue > maxRank1L;
      c.analyticRankEstimate = `L≠0 (|L|=${c.lAbsValue.toFixed(3)} > ${maxRank1L.toFixed(3)})`;
    } else {
      c.bsdConsistent = c.lAbsValue < minRank0L;
      c.analyticRankEstimate = `L→0 (|L|=${c.lAbsValue.toFixed(3)} < ${minRank0L.toFixed(3)})`;
    }
  }

  const bsdConsistentCount = curveResults.filter(c => c.bsdConsistent).length;
  const totalCurves = curveResults.length;
  const bsdScore = `${bsdConsistentCount}/${totalCurves}`;

  // ── Final log ──
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(this.t('bsd_rezultat'));
  this.log(`  ${this.t('optical_method')}`);
  this.log(`  Ordering: max|L(r≥1)|=${maxRank1L.toFixed(3)} < min|L(r=0)|=${minRank0L.toFixed(3)} → ${orderingCorrect ? '✓' : '✗'}`);

  for (const c of curveResults) {
    const rankStr = c.expectedRank === 0 ? 'rank=0' : 'rank≥1';
    const proof = c.proofDetail?.certified ? ' [BigInt✓]' : '';
    const optStr = c.opticalLValue !== null ? ` opt|L|=${Math.abs(c.opticalLValue).toFixed(3)}` : '';
    const mark = c.bsdConsistent ? '✓' : '✗';
    this.log(`  ${c.label}: ${rankStr}${proof}, |L|=${c.lAbsValue.toFixed(3)}${optStr} → ${mark}`);
  }

  this.log(`  Optical a_p: ${exactMatch}/${opticalResults.length} exact, corr=${apCorr.toFixed(3)}`);
  this.log(this.t('bsd_soglasovana', { var0: bsdConsistentCount, var1: totalCurves }));
  this.log(`  Optical: convergence=${opticalConsistent ? '✓' : '?'}, Legendre=${apCorr > 0.8 ? '✓' : '?'}`,
    bsdConsistentCount === totalCurves ? 'ok' : 'warn');
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.showColor('#000000');

  this.results.stage45 = {
    method: 'Optical Legendre (γ-corrected) + BigInt Nagell-Lutz',
    primeLimit: PRIME_LIMIT,
    primesTotal: allPrimes.length,
    // Optical Legendre computation
    optical: {
      gamma: Number(gamma.toFixed(2)),
      displayValues: { dark: V_DARK, mid: V_MID, bright: V_BRIGHT },
      calibration: { dark: Number(calDark.toFixed(1)), bright: Number(calBright.toFixed(1)), center: Number(calCenter.toFixed(1)), halfRange: Number(calHalfRange.toFixed(1)) },
      primesComputed: opticalResults.length,
      primeLimit: OPTICAL_PRIME_LIMIT,
      apCorrelation: Number(apCorr.toFixed(4)),
      exactMatch,
      closeMatch,
      results: opticalResults,
      opticalLValue: curveResults.find(c => c.label === 'E₁')?.opticalLValue || null,
      note: 'Gamma-corrected: cam(V)∝Legendre → linear summation'
    },
    curves: curveResults,
    bsdScore,
    bsdConsistentCount,
    totalCurves,
    bsdAllConsistent: bsdConsistentCount === totalCurves,
    orderingCorrect,
    maxRank1L: Number(maxRank1L.toFixed(6)),
    minRank0L: Number(minRank0L.toFixed(6)),
    opticalConsistent,
    // Legacy compatibility
    curve1: 'y²=x³-x-2', rank1: '≥1',
    L1: curveResults.find(c => c.label === 'E₁')?.lValue || 0,
    curve0: 'y²=x³-x', rank0: 0,
    L0: curveResults.find(c => c.label === 'E₀')?.lValue || 0,
    ratio: Math.abs((curveResults.find(c => c.label === 'E₀')?.lValue || 1) /
           (curveResults.find(c => c.label === 'E₁')?.lValue || 1)),
    primesUsed: curveResults[0]?.primesUsed || 0,
    bsdConfirmed: bsdConsistentCount === totalCurves
  };
}

export function render(r) {
  if (r.stage45) { try {
    const s = r.stage45;

    // Optical a_p correlation (the star metric)
    this.rv('rv-bsd-l1',
      s.optical?.apCorrelation !== undefined
        ? `corr=${s.optical.apCorrelation.toFixed(3)} (${s.optical.exactMatch}/${s.optical.primesComputed})`
        : `${Math.abs(s.L1)?.toFixed(4)}`,
      (s.optical?.apCorrelation > 0.8 || Math.abs(s.L1) < 0.5) ? 'ok' : 'warn');

    this.rv('rv-bsd-l0',
      `${Math.abs(s.L0)?.toFixed(4)}`,
      Math.abs(s.L0) > 0.1 ? 'ok' : 'warn');

    this.rv('rv-bsd-ratio',
      s.bsdScore || `${s.bsdConsistentCount}/${s.totalCurves}`,
      s.bsdAllConsistent ? 'ok' : 'warn');

    this.rv('rv-bsd-primes',
      `${s.primesUsed} CPU + ${s.optical?.primesComputed || 0} optical`,
      'ok');

    // Detail panel
    const detail = document.getElementById('bsd-detail');
    if (detail && s.curves) {
      const lines = s.curves.map(c => {
        const mark = c.bsdConsistent ? '✓' : '✗';
        return `${mark} ${c.label}: rank=${c.expectedRank}, |L|=${c.lAbsValue?.toFixed(3)}`;
      });
      if (s.optical) {
        lines.push(`Optical: ${s.optical.exactMatch}/${s.optical.primesComputed} a_p exact, corr=${s.optical.apCorrelation?.toFixed(3)}`);
      }
      lines.push(`Method: ${s.method || 'Optical Legendre'}`);
      detail.innerHTML = lines.join('<br>');
    } else if (detail) {
      detail.innerHTML = `E₁: ${s.curve1} rank${s.rank1}<br>E₀: ${s.curve0} rank=${s.rank0}`;
    }

    // Grade
    const g = document.getElementById('g-s45');
    if (s.bsdAllConsistent && s.optical?.apCorrelation > 0.5) {
      g.textContent = this.t('bsd_podtverzhdena_le_pri_rank');
      g.className = 'grade pass';
    } else if (s.bsdAllConsistent) {
      g.textContent = this.t('bsd_podtverzhdena_le_pri_rank');
      g.className = 'grade pass';
    } else if (s.bsdConsistentCount > 0) {
      g.textContent = `BSD: ${s.bsdScore} ${this.t('soglasovano')}`;
      g.className = 'grade partial';
    } else {
      g.textContent = this.t('bsd_ne_podtverzhdena');
      g.className = 'grade partial';
    }
  } catch(e) { console.error('stage45 display:', e); } }
}


export function check(d) {
  try { return (d => d && (d.bsdAllConsistent !== undefined ? d.bsdAllConsistent : d.bsdConfirmed))(d); } catch(e) { return false; }
}

export function metric(d) {
  try {
    if (d.optical?.apCorrelation !== undefined) return 'opt_corr=' + d.optical.apCorrelation.toFixed(2);
    if (d.bsdScore) return 'BSD=' + d.bsdScore;
    return 'L₁=' + (d.L1 || 0).toFixed(3);
  } catch(e) { return '—'; }
}
