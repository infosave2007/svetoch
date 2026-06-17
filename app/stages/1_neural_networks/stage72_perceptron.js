// Stage 72: Optical Perceptron — Camera computes w·x + b
//
// Single neuron: y = σ(Σ wᵢxᵢ + b)
// Optical: display wᵢ×xᵢ as brightness columns → camera sums = dot product
// Then apply threshold → binary classification
//
// Educational: foundation of neural networks. Shows that a single
// camera frame performs multiply-accumulate (MAC) in O(1).

export async function run() {
  this.setRun(this.t('etap'), this.t('perc_start'), 130.0);
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

  // ── Calibration ──
  const gamma = cal.gamma || 2.0;
  const V0 = 10, V_MID = 128, V1 = 250;

  this.showColor(`rgb(${V0},${V0},${V0})`);
  await this.sleep(400);
  const calDark = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V_MID},${V_MID},${V_MID})`);
  await this.sleep(400);
  const calMid = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V1},${V1},${V1})`);
  await this.sleep(400);
  const calBright = measureCalibrated(await this.captureStable(8, 50));
  const calCenter = calMid, calHalf = (calBright - calDark) / 2;

  this.log(`  cal: dark=${calDark.toFixed(1)}, mid=${calMid.toFixed(1)}, bright=${calBright.toFixed(1)}`);

  // ── PRNG ──
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };

  // ── Perceptron: learn AND, OR, XOR ──
  this.setRun(this.t('etap'), this.t('perc_learn'), 130.2);
  this.log('━━━ OPTICAL PERCEPTRON ━━━');

  const N_INPUTS = 8; // 8 inputs for richer patterns
  const N_COLS = 32; // display columns

  // Generate training data for 3 functions
  const tasks = [
    { name: 'AND (≥6/8)', fn: (x) => x.filter(v => v > 0.5).length >= 6 ? 1 : 0 },
    { name: 'OR (≥1/8)', fn: (x) => x.some(v => v > 0.5) ? 1 : 0 },
    { name: 'MAJORITY (>4/8)', fn: (x) => x.filter(v => v > 0.5).length > 4 ? 1 : 0 },
  ];

  const allResults = [];

  for (const task of tasks) {
    this.log(`\n  === ${task.name} ===`);

    // Initialize weights
    const w = new Float32Array(N_INPUTS);
    for (let i = 0; i < N_INPUTS; i++) w[i] = (rng() - 0.5) * 0.5;
    let bias = 0;

    // Generate 20 training examples
    const trainData = [];
    for (let i = 0; i < 20; i++) {
      const x = Array.from({length: N_INPUTS}, () => rng() > 0.5 ? 1 : 0);
      trainData.push({ x, y: task.fn(x) });
    }

    // CPU: train perceptron (simple perceptron learning rule)
    const lr = 0.1;
    for (let epoch = 0; epoch < 50; epoch++) {
      for (const { x, y } of trainData) {
        const z = x.reduce((s, xi, i) => s + w[i] * xi, bias);
        const pred = z > 0 ? 1 : 0;
        const err = y - pred;
        if (err !== 0) {
          for (let i = 0; i < N_INPUTS; i++) w[i] += lr * err * x[i];
          bias += lr * err;
        }
      }
    }

    // Test: CPU accuracy
    let cpuCorrect = 0;
    for (const { x, y } of trainData) {
      const z = x.reduce((s, xi, i) => s + w[i] * xi, bias);
      if ((z > 0 ? 1 : 0) === y) cpuCorrect++;
    }
    this.log(`  CPU: w=[${w.slice(0, 4).map(v => v.toFixed(2)).join(',')},...], b=${bias.toFixed(2)}, acc=${cpuCorrect}/${trainData.length}`);

    // ── Optical inference ──
    // For each test input x: display w·x as brightness pattern
    // product[i] = w[i] * x[i] ∈ [-1, +1] → brightness
    let optCorrect = 0;

    for (let ti = 0; ti < Math.min(trainData.length, 10); ti++) {
      const { x, y } = trainData[ti];
      const products = x.map((xi, i) => w[i] * xi); // w·x components
      const maxProd = Math.max(0.01, ...products.map(Math.abs));

      // Display: N_INPUTS columns with brightness ∝ w[i]*x[i]
      this.showPattern((ctx, cw, ch) => {
        ctx.fillStyle = `rgb(${V_MID},${V_MID},${V_MID})`;
        ctx.fillRect(0, 0, cw, ch);
        const colW = cw / N_INPUTS;
        for (let i = 0; i < N_INPUTS; i++) {
          const normalized = products[i] / maxProd; // [-1, +1]
          const clamped = Math.max(-1, Math.min(1, normalized));
          const v = Math.round(V_MID + (clamped > 0 ? (V1 - V_MID) : (V0 - V_MID)) * Math.abs(clamped));
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), ch);
        }
      });
      await this.sleep(200);
      const frame = await this.captureStable(4, 30);
      const measured = measureCalibrated(frame);

      // Optical dot product: (measured - calCenter) / calHalf * maxProd * N_INPUTS
      const optDot = calHalf > 0.5 ? (measured - calCenter) / calHalf * maxProd * N_INPUTS : 0;
      const optPred = (optDot + bias) > 0 ? 1 : 0;
      if (optPred === y) optCorrect++;
    }

    const tested = Math.min(trainData.length, 10);
    allResults.push({ name: task.name, cpuAcc: cpuCorrect / trainData.length, optAcc: optCorrect / tested, tested });
    this.log(`  Optical: ${optCorrect}/${tested} correct`);
  }

  this.showColor('#000');

  const avgOptAcc = allResults.reduce((s, r) => s + r.optAcc, 0) / allResults.length;
  const avgCpuAcc = allResults.reduce((s, r) => s + r.cpuAcc, 0) / allResults.length;

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const r of allResults) {
    this.log(`  ${r.name}: cpu=${(r.cpuAcc * 100).toFixed(0)}%, opt=${(r.optAcc * 100).toFixed(0)}%`);
  }
  this.log(`  Avg: cpu=${(avgCpuAcc * 100).toFixed(0)}%, optical=${(avgOptAcc * 100).toFixed(0)}%`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage72 = {
    method: 'Optical Perceptron (camera MAC)',
    tasks: allResults, avgCpuAcc: +avgCpuAcc.toFixed(4), avgOptAcc: +avgOptAcc.toFixed(4)
  };
}

export function render(r) {
  if (r.stage72) { try {
    const s = r.stage72;
    this.rv('rv-perc-cpu', `CPU=${(s.avgCpuAcc*100).toFixed(0)}%`, s.avgCpuAcc > 0.8 ? 'ok' : 'warn');
    this.rv('rv-perc-opt', `Opt=${(s.avgOptAcc*100).toFixed(0)}%`, s.avgOptAcc > 0.5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s72');
    if (g) { g.textContent = `✅ Perceptron: ${(s.avgOptAcc*100).toFixed(0)}%`; g.className = 'grade pass'; }
  } catch(e) { console.error('s72:', e); } }
}

export function check(d) { try { return d && d.avgCpuAcc > 0.7; } catch(e) { return false; } }
export function metric(d) { try { return `opt=${(d.avgOptAcc*100).toFixed(0)}%`; } catch(e) { return '—'; } }
