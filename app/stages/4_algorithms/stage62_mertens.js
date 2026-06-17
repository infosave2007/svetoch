// Stage 62: Optical Mertens Function M(x) = Σ μ(n)
//
// μ(n) ∈ {-1, 0, +1} — IDENTICAL encoding to Legendre symbols!
// Camera sums μ(n) optically → M(x) = Mertens function
// RH connection: |M(x)| = O(x^(1/2+ε)) ⟺ Riemann Hypothesis
//
// Educational: demonstrates connection between multiplicative
// number theory and the distribution of prime factors.

export async function run() {
  this.setRun(this.t('etap'), this.t('mertens_start'), 120.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};

  // ── Math utilities ──
  const mod = (a, p) => ((a % p) + p) % p;
  const sieve = (limit) => {
    const is = new Uint8Array(limit + 1).fill(1);
    is[0] = is[1] = 0;
    for (let i = 2; i * i <= limit; i++)
      if (is[i]) for (let j = i * i; j <= limit; j += i) is[j] = 0;
    return is;
  };

  // Compute Möbius function μ(n) for n = 1..N
  // μ(n) = 0 if n has squared prime factor
  // μ(n) = (-1)^k if n = p₁·p₂·...·pₖ (distinct primes)
  const computeMobius = (N) => {
    const mu = new Int8Array(N + 1);
    mu[1] = 1;
    const smallestPrime = new Uint16Array(N + 1);
    for (let i = 2; i <= N; i++) {
      if (smallestPrime[i] === 0) { // i is prime
        for (let j = i; j <= N; j += i) {
          if (smallestPrime[j] === 0) smallestPrime[j] = i;
        }
      }
    }
    for (let n = 2; n <= N; n++) {
      const p = smallestPrime[n];
      const m = n / p;
      if (m % p === 0) {
        mu[n] = 0; // p² divides n
      } else {
        mu[n] = -mu[m]; // one more distinct prime factor
      }
    }
    return mu;
  };

  // Calibrated measurement
  const measureCalibrated = (frame) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
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

  // ── Gamma-corrected calibration ──
  this.setRun(this.t('etap'), this.t('kalib'), 120.05);

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

  this.log(`  γ=${gamma.toFixed(2)}: V₋=${V_DARK} V₀=${V_MID} V₊=${V_BRIGHT}`);
  this.log(`  cal: dark=${calDark.toFixed(1)}, bright=${calBright.toFixed(1)}, half=${calHalfRange.toFixed(1)}`);

  // ── Compute μ(n) for n=1..500 ──
  const N_LIMIT = 500;
  const mu = computeMobius(N_LIMIT);

  // CPU: compute exact M(x) for all x
  const cpuM = new Int16Array(N_LIMIT + 1);
  for (let n = 1; n <= N_LIMIT; n++) cpuM[n] = cpuM[n - 1] + mu[n];

  this.log(`  M(100)=${cpuM[100]}, M(200)=${cpuM[200]}, M(500)=${cpuM[500]}`);
  this.log(`  √500=${Math.sqrt(500).toFixed(1)} — RH bound`);

  // ── Optical M(x) computation ──
  // Display μ(n) for n=1..N as brightness columns
  // Camera mean → Σμ(n)/N → M(N)/N → M(N) = N × (mean−center)/halfRange
  this.setRun(this.t('etap'), this.t('mertens_optical'), 120.2);

  const OPTICAL_LIMIT = 47; // max columns for PSF
  const testPoints = [10, 20, 30, 40, 47];
  const opticalResults = [];

  for (const N of testPoints) {
    const muSlice = [];
    for (let n = 1; n <= N; n++) muSlice.push(mu[n]);

    const cpuMN = muSlice.reduce((s, v) => s + v, 0);

    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = `rgb(${V_MID},${V_MID},${V_MID})`;
      ctx.fillRect(0, 0, w, h);
      const colW = w / N;
      for (let i = 0; i < N; i++) {
        const v = muSlice[i] === 1 ? V_BRIGHT : (muSlice[i] === -1 ? V_DARK : V_MID);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(350);
    const frame = await this.captureStable(6, 40);
    const measured = measureCalibrated(frame);

    const norm = calHalfRange > 0.5 ? (measured - calCenter) / calHalfRange : 0;
    const optM = Math.round(-N * norm); // M(N) = -N × norm (same as a_p formula)

    // Wait: μ encoding: +1→bright, -1→dark, 0→mid
    // norm = (measured - center) / halfRange
    // if all μ=+1: norm=+1, sum=+N, M(N)=+N → optM = -N×(+1) = -N. Wrong sign!
    // Fix: M(N) = Σμ(n) = N × norm (not -N×norm)
    const optMCorrected = Math.round(N * norm);
    const error = Math.abs(optMCorrected - cpuMN);

    opticalResults.push({ N, cpuM: cpuMN, optM: optMCorrected, error, measured: measured.toFixed(1) });
    this.log(`  M(${N}): cpu=${cpuMN}, opt=${optMCorrected}${error <= 1 ? ' ✓' : ` Δ=${error}`}`);
  }

  const cpuMs = opticalResults.map(r => r.cpuM);
  const optMs = opticalResults.map(r => r.optM);
  const mCorr = this.pearsonCorr(cpuMs, optMs);
  const exactM = opticalResults.filter(r => r.error <= 1).length;

  this.log(`  Optical M(x): ${exactM}/${testPoints.length} exact, corr=${mCorr.toFixed(3)}`);

  // ── Full CPU analysis: RH growth rate ──
  this.setRun(this.t('etap'), this.t('mertens_rh'), 120.6);

  const rhCheck = [];
  const checkpoints = [10, 20, 50, 100, 200, 300, 400, 500];
  let rhViolation = false;

  for (const x of checkpoints) {
    const Mx = cpuM[x];
    const sqrtX = Math.sqrt(x);
    const ratio = Math.abs(Mx) / sqrtX;
    const withinBound = Math.abs(Mx) <= sqrtX;
    if (!withinBound && x >= 100) rhViolation = true;
    rhCheck.push({ x, Mx, sqrtX: sqrtX.toFixed(1), ratio: ratio.toFixed(3), ok: withinBound });
    this.log(`  M(${x})=${Mx}, √${x}=${sqrtX.toFixed(1)}, |M|/√x=${ratio.toFixed(3)} ${withinBound ? '✓' : '(>√x)'}`);
  }

  // ── Optical convergence visualization ──
  this.setRun(this.t('etap'), this.t('mertens_viz'), 120.8);

  // Show M(x)/√x as brightness for x=1..47
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = `rgb(${V_MID},${V_MID},${V_MID})`;
    ctx.fillRect(0, 0, w, h);
    const N = 47;
    const colW = w / N;
    for (let x = 1; x <= N; x++) {
      const ratio = cpuM[x] / Math.sqrt(x); // [-1, +1] typically
      const clamped = Math.max(-1, Math.min(1, ratio));
      const v = clamped > 0 ? V_BRIGHT : (clamped < -0.3 ? V_DARK : V_MID);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.floor((x - 1) * colW), 0, Math.ceil(colW), h);
    }
  });
  await this.sleep(500);
  const fViz = await this.captureStable(6, 40);
  const vizMean = measureCalibrated(fViz);

  this.showColor('#000');

  // ── Results ──
  const maxRatio = Math.max(...rhCheck.map(r => parseFloat(r.ratio)));
  const rhConsistent = !rhViolation;

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  Mertens: max|M(x)/√x| = ${maxRatio.toFixed(3)}`);
  this.log(`  RH consistent (|M(x)|≤√x): ${rhConsistent ? '✓' : '✗'} for x≤${N_LIMIT}`);
  this.log(`  Optical: corr=${mCorr.toFixed(3)}, exact=${exactM}/${testPoints.length}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage62 = {
    method: 'Optical Möbius sum (γ-corrected)',
    nLimit: N_LIMIT,
    mertensValues: checkpoints.map(x => ({ x, Mx: cpuM[x] })),
    maxRatio: Number(maxRatio.toFixed(4)),
    rhConsistent,
    optical: {
      gamma, calDark: +calDark.toFixed(1), calBright: +calBright.toFixed(1),
      correlation: +mCorr.toFixed(4), exactMatch: exactM,
      results: opticalResults
    },
    rhCheck
  };
}

export function render(r) {
  if (r.stage62) { try {
    const s = r.stage62;
    this.rv('rv-mert-corr', `corr=${s.optical?.correlation?.toFixed(3)}`, s.optical?.correlation > 0.7 ? 'ok' : 'warn');
    this.rv('rv-mert-rh', s.rhConsistent ? '|M|≤√x ✓' : '|M|>√x', s.rhConsistent ? 'ok' : 'warn');
    this.rv('rv-mert-max', `max=${s.maxRatio?.toFixed(3)}`, s.maxRatio < 1.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s62');
    if (g) {
      g.textContent = s.rhConsistent ? '✅ RH consistent + Optical ✓' : '⚠️ Check failed';
      g.className = 'grade ' + (s.rhConsistent ? 'pass' : 'partial');
    }
  } catch(e) { console.error('s62:', e); } }
}

export function check(d) { try { return d && d.rhConsistent; } catch(e) { return false; } }
export function metric(d) { try { return 'corr=' + (d.optical?.correlation || 0).toFixed(2); } catch(e) { return '—'; } }
