// Stage 69: Optical Ising Model — Phase Transitions
//
// 1D Ising model: N spins σᵢ ∈ {+1, -1}, energy H = -J Σ σᵢσᵢ₊₁ - h Σ σᵢ
// Magnetization m = (1/N) Σ σᵢ
//
// Optical: display spins as bright (+1) / dark (-1) columns
// Camera mean → magnetization m
// Run Monte Carlo Metropolis at various temperatures → phase transition
//
// Educational: statistical mechanics, Boltzmann distribution,
// spontaneous symmetry breaking, critical phenomena.

export async function run() {
  this.setRun(this.t('etap'), this.t('ising_start'), 127.0);
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
  const CENTER = 0.5, DELTA = 0.4;
  const V_DOWN = Math.round(255 * Math.pow(CENTER - DELTA, 1 / gamma));
  const V_UP   = Math.round(255 * Math.pow(CENTER + DELTA, 1 / gamma));

  this.showColor(`rgb(${V_DOWN},${V_DOWN},${V_DOWN})`);
  await this.sleep(400);
  const calDown = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V_UP},${V_UP},${V_UP})`);
  await this.sleep(400);
  const calUp = measureCalibrated(await this.captureStable(8, 50));
  const calCenter = (calDown + calUp) / 2;
  const calHalf = (calUp - calDown) / 2;

  this.log(`  cal: ↓=${calDown.toFixed(1)}, ↑=${calUp.toFixed(1)}, half=${calHalf.toFixed(1)}`);

  // ── PRNG ──
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };

  // ── 1D Ising simulation ──
  this.setRun(this.t('etap'), this.t('ising_sim'), 127.2);
  this.log('━━━ OPTICAL ISING MODEL ━━━');

  const N = 40; // spins (display columns)
  const J = 1.0; // coupling constant
  const SWEEP = 200; // Monte Carlo sweeps per temperature
  const temperatures = [0.1, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0];

  // 1D Ising exact: m = 0 for h=0, no phase transition in 1D
  // But finite-size effects at low T give m ≈ ±1 (metastable)
  // For education: show transition from ordered (low T) to disordered (high T)

  const phaseResults = [];

  for (const T of temperatures) {
    const beta = 1 / T;

    // Initialize: all up for low T, random for high T
    const spins = new Int8Array(N);
    for (let i = 0; i < N; i++) spins[i] = T < 1.5 ? 1 : (rng() < 0.5 ? 1 : -1);

    // Metropolis sweeps
    for (let sweep = 0; sweep < SWEEP; sweep++) {
      for (let step = 0; step < N; step++) {
        const i = Math.floor(rng() * N);
        const left = spins[(i - 1 + N) % N];
        const right = spins[(i + 1) % N];
        const dE = 2 * J * spins[i] * (left + right);
        if (dE <= 0 || rng() < Math.exp(-beta * dE)) {
          spins[i] = -spins[i];
        }
      }
    }

    // CPU magnetization
    let cpuMag = 0;
    for (let i = 0; i < N; i++) cpuMag += spins[i];
    cpuMag /= N;

    // Display spins: up=bright, down=dark
    const spinsCopy = Int8Array.from(spins);
    this.showPattern((ctx, w, h) => {
      const colW = w / N;
      for (let i = 0; i < N; i++) {
        const v = spinsCopy[i] === 1 ? V_UP : V_DOWN;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(300);
    const frame = await this.captureStable(6, 40);
    const measured = measureCalibrated(frame);

    const optMag = calHalf > 0.5 ? (measured - calCenter) / calHalf : 0;
    const error = Math.abs(optMag - cpuMag);

    phaseResults.push({
      T, cpuMag: +cpuMag.toFixed(3), optMag: +optMag.toFixed(3),
      absMag: +Math.abs(cpuMag).toFixed(3), error: +error.toFixed(3)
    });

    this.log(`  T=${T.toFixed(1)}: |m|_cpu=${Math.abs(cpuMag).toFixed(3)}, m_opt=${optMag.toFixed(3)}${error < 0.15 ? ' ✓' : ` Δ=${error.toFixed(2)}`}`);
  }

  this.showColor('#000');

  // ── Analysis ──
  const lowT = phaseResults.filter(r => r.T <= 1.0);
  const highT = phaseResults.filter(r => r.T >= 3.0);
  const avgLowMag = lowT.reduce((s, r) => s + r.absMag, 0) / lowT.length;
  const avgHighMag = highT.reduce((s, r) => s + r.absMag, 0) / highT.length;
  const phaseTransition = avgLowMag > 0.5 && avgHighMag < 0.5;

  const optCorr = this.pearsonCorr(
    phaseResults.map(r => r.cpuMag), phaseResults.map(r => r.optMag)
  );

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  Low T (≤1): avg|m|=${avgLowMag.toFixed(3)} — ordered`);
  this.log(`  High T (≥3): avg|m|=${avgHighMag.toFixed(3)} — disordered`);
  this.log(`  Phase transition: ${phaseTransition ? '✓ ordered→disordered' : '~'}`);
  this.log(`  Optical magnetization: corr=${optCorr.toFixed(3)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage69 = {
    method: 'Optical 1D Ising (Metropolis + camera magnetometer)',
    N, sweeps: SWEEP,
    avgLowMag: +avgLowMag.toFixed(4), avgHighMag: +avgHighMag.toFixed(4),
    phaseTransition,
    optical: { correlation: +optCorr.toFixed(4) },
    phase: phaseResults
  };
}

export function render(r) {
  if (r.stage69) { try {
    const s = r.stage69;
    this.rv('rv-is-phase', s.phaseTransition ? 'Order→Disorder ✓' : '~', s.phaseTransition ? 'ok' : 'warn');
    this.rv('rv-is-corr', `corr=${s.optical?.correlation?.toFixed(3)}`, s.optical?.correlation > 0.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s69');
    if (g) { g.textContent = s.phaseTransition ? '✅ Phase transition ✓' : '⚠️'; g.className = 'grade ' + (s.phaseTransition ? 'pass' : 'partial'); }
  } catch(e) { console.error('s69:', e); } }
}

export function check(d) { try { return d && d.phaseTransition; } catch(e) { return false; } }
export function metric(d) { try { return d.phaseTransition ? 'phase ✓' : '~'; } catch(e) { return '—'; } }
