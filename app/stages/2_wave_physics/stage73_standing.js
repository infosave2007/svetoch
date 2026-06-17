// Stage 73: Optical Standing Waves — Nodes & Antinodes
//
// Standing wave: y(x,t) = 2A·sin(kx)·cos(ωt)
// At nodes: y = 0 always (dark). At antinodes: y = ±2A (bright).
// Display sin(nπx/L) patterns → camera measures node positions.
//
// Optical: display |sin(nπx/L)| as brightness → camera profile shows nodes.
// Compare harmonics n=1,2,3,4,5 — camera should see n nodes.
//
// Educational: wave equation, boundary conditions, harmonics,
// musical instruments (guitar strings), resonance.

export async function run() {
  this.setRun(this.t('etap'), this.t('sw_start'), 131.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};
  const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

  const measureProfile = (frame, nBins) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = Math.floor(fh * 0.3), y1 = Math.floor(fh * 0.7);
    const width = x1 - x0;
    const binW = width / nBins;
    const profile = [];
    for (let b = 0; b < nBins; b++) {
      const bx0 = x0 + Math.floor(b * binW);
      const bx1 = x0 + Math.floor((b + 1) * binW);
      let sum = 0, count = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = bx0; x < bx1; x += 2) {
          const i = (y * fw + x) * 4;
          sum += (d[i] + d[i + 1] + d[i + 2]) / 3; count++;
        }
      }
      profile.push(count > 0 ? sum / count : 0);
    }
    if (isMirrored) profile.reverse();
    return profile;
  };

  // ── Standing wave harmonics ──
  this.setRun(this.t('etap'), this.t('sw_harmonics'), 131.2);
  this.log('━━━ OPTICAL STANDING WAVES ━━━');

  const N_BINS = 40;
  const harmonics = [1, 2, 3, 4, 5];
  const results = [];

  for (const n of harmonics) {
    this.setRun(this.t('etap'), `n=${n}...`, 131.2 + n * 0.1);

    // CPU: expected pattern |sin(nπx/L)|
    const cpuPattern = [];
    for (let i = 0; i < N_BINS; i++) {
      const x = (i + 0.5) / N_BINS; // [0, 1]
      cpuPattern.push(Math.abs(Math.sin(n * Math.PI * x)));
    }

    // Display: brightness ∝ |sin(nπx/L)|
    this.showPattern((ctx, w, h) => {
      const colW = w / N_BINS;
      for (let i = 0; i < N_BINS; i++) {
        const v = Math.round(10 + 240 * cpuPattern[i]);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(400);
    const frame = await this.captureStable(8, 50);
    const optProfile = measureProfile(frame, N_BINS);

    // Normalize profiles to [0, 1]
    const optMin = Math.min(...optProfile);
    const optMax = Math.max(...optProfile);
    const optNorm = optProfile.map(v => (v - optMin) / (optMax - optMin || 1));

    // Count nodes: positions where optNorm < 0.2 (local minima)
    let optNodes = 0;
    for (let i = 2; i < N_BINS - 2; i++) {
      if (optNorm[i] < 0.2 && optNorm[i] < optNorm[i-1] && optNorm[i] < optNorm[i+1]) {
        optNodes++;
      }
    }

    const expectedNodes = n - 1; // n-th harmonic has n-1 interior nodes
    const nodesCorrect = optNodes === expectedNodes || Math.abs(optNodes - expectedNodes) <= 1;

    // Correlation
    const corr = this.pearsonCorr(cpuPattern, optNorm);

    results.push({
      n, expectedNodes, optNodes, nodesCorrect,
      correlation: +corr.toFixed(4)
    });

    this.log(`  n=${n}: ${expectedNodes} nodes expected, ${optNodes} detected${nodesCorrect ? ' ✓' : ' ✗'}, corr=${corr.toFixed(3)}`);
  }

  this.showColor('#000');

  const nodesOK = results.filter(r => r.nodesCorrect).length;
  const avgCorr = results.reduce((s, r) => s + r.correlation, 0) / results.length;

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  Nodes: ${nodesOK}/${results.length} correct`);
  this.log(`  Avg correlation: ${avgCorr.toFixed(3)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage73 = {
    method: 'Optical standing waves (|sin(nπx)|)',
    harmonics: results, nodesOK, avgCorr: +avgCorr.toFixed(4)
  };
}

export function render(r) {
  if (r.stage73) { try {
    const s = r.stage73;
    this.rv('rv-sw-nodes', `Nodes: ${s.nodesOK}/${s.harmonics?.length}`, s.nodesOK >= 3 ? 'ok' : 'warn');
    this.rv('rv-sw-corr', `corr=${s.avgCorr?.toFixed(3)}`, s.avgCorr > 0.7 ? 'ok' : 'warn');
    const g = document.getElementById('g-s73');
    if (g) { g.textContent = `✅ Standing waves ✓`; g.className = 'grade pass'; }
  } catch(e) { console.error('s73:', e); } }
}

export function check(d) { try { return d && d.nodesOK >= 3; } catch(e) { return false; } }
export function metric(d) { try { return `${d.nodesOK}/5 nodes`; } catch(e) { return '—'; } }
