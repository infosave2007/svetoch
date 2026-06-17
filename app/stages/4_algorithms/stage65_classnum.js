// Stage 65: Optical Class Numbers h(D)
//
// h(D) = class number of imaginary quadratic field Q(√D)
// Formula: h(D) = -(1/|D|) × Σ_{n=1}^{|D|-1} n × χ_D(n)
// where χ_D(n) = Kronecker symbol (D|n) ∈ {-1, 0, +1}
//
// Optical: display χ_D(n) as brightness (same encoding as Legendre/Möbius)
// Camera verifies character sum pattern → CPU computes exact h(D)
//
// Educational: class numbers measure "how far" a number ring is
// from unique factorization. h(D)=1 ↔ unique factorization.

export async function run() {
  this.setRun(this.t('etap'), this.t('classnum_start'), 123.0);
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

  // Kronecker symbol (D|n) for D < 0
  const kronecker = (D, n) => {
    if (n === 0) return 0;
    if (n === 1) return 1;
    if (n < 0) n = -n;
    let result = 1;
    // Handle factors of 2
    while (n % 2 === 0) {
      n /= 2;
      const Dm8 = ((D % 8) + 8) % 8;
      if (Dm8 === 1 || Dm8 === 7) { /* ×1 */ }
      else if (Dm8 === 3 || Dm8 === 5) result = -result;
      else return 0;
    }
    // Handle odd factors
    let temp = n;
    for (let p = 3; p * p <= temp; p += 2) {
      while (n % p === 0) {
        n /= p;
        result *= legendreSymbol(D, p);
        if (result === 0) return 0;
      }
    }
    if (n > 1) result *= legendreSymbol(D, n);
    return result;
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
  this.setRun(this.t('etap'), this.t('kalib'), 123.05);
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

  // ── Fundamental discriminants & class numbers ──
  // h(D) = -(1/|D|) × Σ_{n=1}^{|D|-1} n × χ_D(n)  for D < -4
  this.setRun(this.t('etap'), this.t('classnum_compute'), 123.2);
  this.log('━━━ CLASS NUMBERS h(D) ━━━');

  const discriminants = [
    { D: -3, expected: 1, note: 'Z[ω], UFD' },
    { D: -4, expected: 1, note: 'Z[i], Gaussian integers, UFD' },
    { D: -7, expected: 1, note: 'UFD' },
    { D: -8, expected: 1, note: 'Z[√-2], UFD' },
    { D: -11, expected: 1, note: 'UFD' },
    { D: -15, expected: 2, note: 'not UFD' },
    { D: -19, expected: 1, note: 'UFD (last Heegner)' },
    { D: -20, expected: 2, note: 'not UFD' },
    { D: -23, expected: 3, note: 'h=3' },
    { D: -24, expected: 2, note: 'h=2' },
    { D: -31, expected: 3, note: 'h=3' },
    { D: -35, expected: 2, note: 'h=2' },
    { D: -39, expected: 4, note: 'h=4' },
    { D: -43, expected: 1, note: 'UFD (Heegner)' },
    { D: -47, expected: 5, note: 'h=5' }
  ];

  const classResults = [];

  for (const disc of discriminants) {
    const D = disc.D;
    const absD = Math.abs(D);

    // CPU exact: h(D) = -(1/|D|) × Σ n×χ_D(n) for n=1..|D|-1
    let weightedSum = 0;
    const charValues = [];
    for (let n = 1; n < absD; n++) {
      const chi = kronecker(D, n);
      weightedSum += n * chi;
      charValues.push(chi);
    }

    let cpuH;
    if (D === -3) cpuH = 1;
    else if (D === -4) cpuH = 1;
    else cpuH = Math.round(-weightedSum / absD);

    const correct = cpuH === disc.expected;

    classResults.push({
      D, absD, cpuH, expected: disc.expected, correct,
      weightedSum, note: disc.note,
      charPattern: charValues.slice(0, 20)
    });

    this.log(`  D=${D}: h=${cpuH}${correct ? ' ✓' : ` ✗ (expected ${disc.expected})`} — ${disc.note}`);
  }

  // ── Optical character verification ──
  // For each D with |D| ≤ 47, display χ_D(n) pattern and verify
  this.setRun(this.t('etap'), this.t('classnum_optical'), 123.5);

  const opticalDiscs = discriminants.filter(d => Math.abs(d.D) <= 47);
  const opticalResults = [];

  for (const disc of opticalDiscs) {
    const D = disc.D, absD = Math.abs(D);
    const N = absD - 1;
    const pattern = [];
    for (let n = 1; n <= N; n++) pattern.push(kronecker(D, n));

    const cpuSum = pattern.reduce((s, v) => s + v, 0);

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

    opticalResults.push({ D, cpuSum, optSum, error });
    this.log(`  χ_${D}: Σ=${cpuSum}, opt=${optSum}${error <= 1 ? ' ✓' : ` Δ=${error}`}, h=${classResults.find(r => r.D === D)?.cpuH}`);
  }

  this.showColor('#000');

  const exactC = opticalResults.filter(r => r.error <= 1).length;
  const allCorrect = classResults.every(r => r.correct);

  // Heegner numbers: D where h(D)=1
  const heegner = classResults.filter(r => r.cpuH === 1).map(r => r.D);

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  h(D)=1 (UFD): D ∈ {${heegner.join(', ')}} — числа Хегнера`);
  this.log(`  All h(D) correct: ${allCorrect ? '✓' : '✗'}`);
  this.log(`  Optical: ${exactC}/${opticalResults.length} exact`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage65 = {
    method: 'Optical Kronecker character + class number formula',
    allCorrect,
    heegnerNumbers: heegner,
    classes: classResults.map(r => ({ D: r.D, h: r.cpuH, expected: r.expected, correct: r.correct, note: r.note })),
    optical: { exactMatch: exactC, results: opticalResults }
  };
}

export function render(r) {
  if (r.stage65) { try {
    const s = r.stage65;
    this.rv('rv-cls-ok', s.allCorrect ? 'All h(D) ✓' : 'Error', s.allCorrect ? 'ok' : 'warn');
    this.rv('rv-cls-heeg', `Heegner: ${s.heegnerNumbers?.length || 0}`, 'ok');
    const g = document.getElementById('g-s65');
    if (g) {
      g.textContent = s.allCorrect ? '✅ Class numbers + Heegner ✓' : '⚠️';
      g.className = 'grade ' + (s.allCorrect ? 'pass' : 'partial');
    }
  } catch(e) { console.error('s65:', e); } }
}

export function check(d) { try { return d && d.allCorrect; } catch(e) { return false; } }
export function metric(d) { try { return d.allCorrect ? 'h(D) ✓' : '✗'; } catch(e) { return '—'; } }
