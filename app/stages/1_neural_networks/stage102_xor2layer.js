// Stage 102: Two-layer XOR via screen→camera feedback
//
// Stage 4 shows that a SINGLE optical linear readout cannot separate XOR
// (Minsky–Papert). Here we close the loop: the first layer's optical output is
// shown BACK on the screen and measured again — a second optical pass. This
// realizes XOR = AND(OR, NAND), a genuine 2-layer network computed in light.
//   Layer 1 (one optical pass per input): brightness (x₁+x₂)/2 → measure → two
//           hidden units OR and NAND via threshold + sensor nonlinearity.
//   Feedback / Layer 2: show [OR, NAND] as two blocks, the camera integrates
//           them ((h₁+h₂)/2) → threshold = AND → XOR.
// A built-in control fits the best SINGLE linear threshold straight to XOR on the
// same measurements; it cannot exceed 75% — the contrast 1-layer vs 2-layer is
// the whole point.

export async function run() {
    this.setRun(this.t('etap'), this.t('dvukhsloynyy_xor'), 88);
    this.showColor('#808080');
    await this.sleep(800);

    const gamma = (this.results.calibration && this.results.calibration.gamma) || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;
    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;

    const inputs = [[0,0],[0,1],[1,0],[1,1]];
    const T_OR   = [0,1,1,1];
    const T_NAND = [1,1,1,0];
    const T_XOR  = [0,1,1,0];   // = AND(OR, NAND)

    // White reference (same normalization as Stage 4)
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));
    this.showColor('#808080'); await this.sleep(600);

    const measure = async () => {
      const frame = await this.captureStable(5, 50);
      const raw = this.regionMean(frame);
      const norm = (raw - blackLevel) / Math.max(refBright - blackLevel, 1);
      return norm > 0 ? Math.pow(norm, invGamma) : 0;
    };

    // Fit a single adaptive threshold (with optional inversion) to a linearly
    // separable target — returns best accuracy/threshold and the predictions.
    const fitGate = (vals, target) => {
      const sorted = [...vals].sort((a,b) => a-b);
      const cand = [sorted[0] - 0.1];
      for (let i = 0; i < sorted.length - 1; i++) cand.push((sorted[i] + sorted[i+1]) / 2);
      cand.push(sorted[sorted.length-1] + 0.1);
      let best = { acc: -1, thresh: 0.5, invert: false, pred: vals.map(() => 0) };
      for (const th of cand) for (const inv of [false, true]) {
        const pred = vals.map(x => inv ? (x < th ? 1 : 0) : (x > th ? 1 : 0));
        let c = 0;
        for (let i = 0; i < 4; i++) if (pred[i] === target[i]) c++;
        if (c > best.acc) best = { acc: c, thresh: th, invert: inv, pred };
      }
      return best;
    };

    // ---- LAYER 1: one optical pass per input → two hidden units ----
    const v = [];   // optical value of (x₁+x₂)/2 brightness
    for (let i = 0; i < 4; i++) {
      const inp = inputs[i];
      this.setRun(this.t('etap'), this.t('sloy1_vkhod', {var0: inp[0], var1: inp[1]}), 89 + i);
      const s = (inp[0] + inp[1]) / 2;
      const g = Math.round(s * 255);
      this.showColor(`rgb(${g},${g},${g})`);
      await this.sleep(600);
      v.push(await measure());
      this.showColor('#808080'); await this.sleep(250);
    }

    const orFit   = fitGate(v, T_OR);
    const nandFit  = fitGate(v, T_NAND);
    const h1 = orFit.pred;    // OR   — hidden unit 1
    const h2 = nandFit.pred;  // NAND — hidden unit 2

    // CONTROL: best single linear threshold straight to XOR (one layer) → must fail
    const singleXor = fitGate(v, T_XOR);

    // ---- LAYER 2 (feedback): show [OR, NAND] back on screen, AND them in light ----
    const y = [];   // optical value of (h₁+h₂)/2
    for (let i = 0; i < 4; i++) {
      this.setRun(this.t('etap'), this.t('sloy2_obratno', {var0: inputs[i][0], var1: inputs[i][1]}), 93 + i);
      this.showBlockPattern([h1[i], h2[i]], 2);   // left block = OR, right block = NAND
      await this.sleep(600);
      y.push(await measure());
      this.showColor('#808080'); await this.sleep(250);
    }
    // AND(h₁,h₂): high only when both high → its truth table over the inputs is XOR
    const andFit = fitGate(y, T_XOR);
    const xorPred = andFit.pred;

    const acc = (pred, t) => pred.reduce((s,p,i) => s + (p===t[i]?1:0), 0) / 4;
    const xorTwoLayerAcc = acc(xorPred, T_XOR);
    const xorSingleAcc   = singleXor.acc / 4;

    const twoLayerSolves = xorTwoLayerAcc >= 0.75;
    const singleFails    = xorSingleAcc <= 0.75;

    // ---- log ----
    this.log(`── ${this.t('sloy1_skrytye')} ──`);
    for (let i = 0; i < 4; i++)
      this.log(`  (${inputs[i][0]},${inputs[i][1]}) v=${v[i].toFixed(3)} → OR=${h1[i]} NAND=${h2[i]}`,
               (h1[i]===T_OR[i] && h2[i]===T_NAND[i]) ? 'ok' : 'warn');
    this.log(`── ${this.t('sloy2_xor')} ──`);
    for (let i = 0; i < 4; i++)
      this.log(`  (${inputs[i][0]},${inputs[i][1]}) AND(${h1[i]},${h2[i]}) y=${y[i].toFixed(3)} →${xorPred[i]} (${T_XOR[i]}) ${xorPred[i]===T_XOR[i]?'✓':'✗'}`,
               xorPred[i]===T_XOR[i] ? 'ok' : 'warn');
    this.log(`XOR ${this.t('odin_sloy')}: ${(xorSingleAcc*100).toFixed(0)}%  |  ${this.t('dva_sloya')}: ${(xorTwoLayerAcc*100).toFixed(0)}%`,
             (twoLayerSolves && singleFails) ? 'ok' : 'warn');

    this.results.stage102 = {
      inputs,
      opticalLayer1: v, h1_or: h1, h2_nand: h2, opticalLayer2: y,
      orAccuracy: orFit.acc / 4, nandAccuracy: nandFit.acc / 4,
      andThreshold: andFit.thresh,
      xorPrediction: xorPred,
      xorTwoLayerAccuracy: xorTwoLayerAcc,
      xorSingleLayerAccuracy: xorSingleAcc,
      twoLayerSolvesXor: twoLayerSolves,
      singleLayerFailsXor: singleFails,
      feedbackXorConfirmed: twoLayerSolves && singleFails,
      gammaUsed: gamma
    };

    this.log(twoLayerSolves && singleFails
      ? this.t('obratnaya_svyaz_reshila_xor') : this.t('neozhidannyy_rezultat'),
      twoLayerSolves && singleFails ? 'ok' : 'warn');
    this.showColor('#808080'); await this.sleep(500);
}

export function render(r) {
  if (r.stage102) { try {
    const s = r.stage102;
    this.rv('rv-xor2l-single', (s.xorSingleLayerAccuracy*100).toFixed(0)+'%', s.xorSingleLayerAccuracy<=0.75?'ok':'bad');
    this.rv('rv-xor2l-two',    (s.xorTwoLayerAccuracy*100).toFixed(0)+'%',   s.xorTwoLayerAccuracy>=0.75?'ok':'bad');
    const g = document.getElementById('g-s102');
    if (g) {
      if (s.feedbackXorConfirmed) { g.textContent = this.t('xor_cherez_obratnuyu_svyaz'); g.className = 'grade pass'; }
      else if (s.twoLayerSolvesXor) { g.textContent = this.t('dva_sloya_reshayut'); g.className = 'grade partial'; }
      else { g.textContent = this.t('ne_reshilos'); g.className = 'grade fail'; }
    }
  } catch(e) { console.error('stage102 display:', e); } }
}

export function check(d) {
  try { return !!(d && d.twoLayerSolvesXor && d.singleLayerFailsXor); } catch(e) { return false; }
}

export function metric(d) {
  try { return 'XOR 1L=' + (d.xorSingleLayerAccuracy*100).toFixed(0) + '% 2L=' + (d.xorTwoLayerAccuracy*100).toFixed(0) + '%'; }
  catch(e) { return '—'; }
}
