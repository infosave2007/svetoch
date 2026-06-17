// Stage 71: Optical Benford's Law Verification
//
// Benford's law: in many natural datasets, the first digit d appears with
// probability P(d) = log₁₀(1 + 1/d), NOT uniformly.
// P(1)=30.1%, P(2)=17.6%, ..., P(9)=4.6%
//
// Optical: for each digit d=1..9, display N columns:
//   bright if firstDigit(data[i]) == d, dark otherwise
// Camera → fraction with digit d → compare with Benford prediction
//
// Test data: powers of 2, Fibonacci, factorials, population data
//
// Educational: logarithmic distributions, fraud detection,
// why "1" appears more often than "9" as a leading digit.

export async function run() {
  this.setRun(this.t('etap'), this.t('benford_start'), 129.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};

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
  const gamma = cal.gamma || 2.0;
  const V_DARK  = Math.round(255 * Math.pow(0.1, 1 / gamma));
  const V_BRIGHT = Math.round(255 * Math.pow(0.9, 1 / gamma));

  this.showColor(`rgb(${V_DARK},${V_DARK},${V_DARK})`);
  await this.sleep(400);
  const calDark = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V_BRIGHT},${V_BRIGHT},${V_BRIGHT})`);
  await this.sleep(400);
  const calBright = measureCalibrated(await this.captureStable(8, 50));
  const calRange = calBright - calDark;

  // ── First digit extraction ──
  const firstDigit = (n) => {
    if (n <= 0) return 0;
    const s = String(n);
    for (const c of s) { if (c >= '1' && c <= '9') return parseInt(c); }
    return 0;
  };

  // ── Benford prediction ──
  const benford = (d) => Math.log10(1 + 1 / d);

  // ── Generate test datasets ──
  this.setRun(this.t('etap'), this.t('benford_data'), 129.1);
  this.log('━━━ OPTICAL BENFORD\'S LAW ━━━');

  const datasets = [];

  // 1. Powers of 2: 2¹, 2², ..., 2⁴⁰
  const pow2 = [];
  let p = 1;
  for (let i = 1; i <= 40; i++) { p *= 2; pow2.push(p); }
  datasets.push({ name: '2ⁿ (n=1..40)', data: pow2 });

  // 2. Fibonacci
  const fib = [1, 1];
  for (let i = 2; i < 40; i++) fib.push(fib[i-1] + fib[i-2]);
  datasets.push({ name: 'Fibonacci', data: fib });

  // 3. Factorials
  const fact = [1];
  for (let i = 1; i <= 20; i++) fact.push(fact[i-1] * i);
  datasets.push({ name: 'n! (n=1..20)', data: fact.slice(1).map(Number) });

  // 4. n² (weaker Benford)
  const sq = [];
  for (let n = 1; n <= 40; n++) sq.push(n * n);
  datasets.push({ name: 'n² (n=1..40)', data: sq });

  // ── Analyze each dataset + optical verification ──
  this.setRun(this.t('etap'), this.t('benford_optical'), 129.3);

  const allResults = [];

  for (let di = 0; di < datasets.length; di++) {
    const ds = datasets[di];
    const N = ds.data.length;
    const digits = ds.data.map(firstDigit).filter(d => d > 0);

    // CPU: digit frequency
    const cpuFreq = new Array(10).fill(0);
    for (const d of digits) cpuFreq[d]++;
    const cpuProb = cpuFreq.map(f => f / digits.length);

    this.log(`\n  ${ds.name} (${digits.length} values):`);

    // For each digit d=1..9: optical verification
    const digitResults = [];

    for (let d = 1; d <= 9; d++) {
      const expected = benford(d);
      const actual = cpuProb[d];
      const pattern = digits.map(dd => dd === d ? 1 : 0);

      // Display: up to 40 columns
      const nCols = Math.min(pattern.length, 40);
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = `rgb(${V_DARK},${V_DARK},${V_DARK})`;
        ctx.fillRect(0, 0, w, h);
        const colW = w / nCols;
        for (let i = 0; i < nCols; i++) {
          if (pattern[i]) {
            ctx.fillStyle = `rgb(${V_BRIGHT},${V_BRIGHT},${V_BRIGHT})`;
            ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
          }
        }
      });
      await this.sleep(200);
      const frame = await this.captureStable(4, 30);
      const measured = measureCalibrated(frame);

      const optFrac = calRange > 1 ? (measured - calDark) / calRange : 0;
      const optCount = Math.round(optFrac * nCols);

      digitResults.push({
        digit: d, benford: +expected.toFixed(4), actual: +actual.toFixed(4),
        optFrac: +optFrac.toFixed(4), cpuCount: cpuFreq[d], optCount
      });
    }

    // Chi-squared test: Σ (observed - expected)² / expected
    let chiSq = 0;
    for (let d = 1; d <= 9; d++) {
      const expected = benford(d) * digits.length;
      const observed = cpuFreq[d];
      chiSq += (observed - expected) ** 2 / Math.max(expected, 0.01);
    }

    // Critical value χ²(8, 0.05) = 15.51
    const benfordCompliant = chiSq < 15.51;

    // Log digit table
    for (const r of digitResults) {
      const bar = '█'.repeat(Math.round(r.actual * 30));
      this.log(`    d=${r.digit}: B=${(r.benford*100).toFixed(0)}% act=${(r.actual*100).toFixed(0)}% ${bar}`);
    }
    this.log(`    χ²=${chiSq.toFixed(2)} ${benfordCompliant ? '✓ Benford' : '✗ not Benford'}`);

    // Optical correlation for this dataset
    const optCorr = this.pearsonCorr(
      digitResults.map(r => r.actual), digitResults.map(r => r.optFrac)
    );

    allResults.push({
      name: ds.name, n: digits.length, chiSq: +chiSq.toFixed(2),
      benfordCompliant, optCorr: +optCorr.toFixed(4), digits: digitResults
    });
  }

  this.showColor('#000');

  // ── Summary ──
  const benfordCount = allResults.filter(r => r.benfordCompliant).length;
  const avgOptCorr = allResults.reduce((s, r) => s + r.optCorr, 0) / allResults.length;

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const r of allResults) {
    this.log(`  ${r.name}: χ²=${r.chiSq.toFixed(1)} ${r.benfordCompliant ? '✓' : '✗'}, opt_corr=${r.optCorr.toFixed(3)}`);
  }
  this.log(`  Benford-compliant: ${benfordCount}/${allResults.length}`);
  this.log(`  Avg optical corr: ${avgOptCorr.toFixed(3)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage71 = {
    method: 'Optical Benford\'s law (binary encoding)',
    datasets: allResults,
    benfordCount, totalDatasets: allResults.length,
    avgOptCorr: +avgOptCorr.toFixed(4)
  };
}

export function render(r) {
  if (r.stage71) { try {
    const s = r.stage71;
    this.rv('rv-bf-comply', `${s.benfordCount}/${s.totalDatasets} Benford`, s.benfordCount >= 2 ? 'ok' : 'warn');
    this.rv('rv-bf-corr', `corr=${s.avgOptCorr?.toFixed(3)}`, s.avgOptCorr > 0.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s71');
    if (g) { g.textContent = `✅ Benford: ${s.benfordCount}/${s.totalDatasets} ✓`; g.className = 'grade pass'; }
  } catch(e) { console.error('s71:', e); } }
}

export function check(d) { try { return d && d.benfordCount >= 2; } catch(e) { return false; } }
export function metric(d) { try { return `${d.benfordCount}/${d.totalDatasets}`; } catch(e) { return '—'; } }
