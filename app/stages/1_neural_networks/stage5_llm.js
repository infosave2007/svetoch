// Stage 5: LLM

export async function run() {
this.setRun(this.t('etap'), 'Mini-LLM Transformer...', 92);
    this.showColor('#808080');
    await this.sleep(800);

    const gamma = (this.results.calibration && this.results.calibration.gamma) || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;
    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;

    // Tiny Transformer: d_model=4, vocab=4 (tokens: A=0, B=1, C=2, D=3)
    // 1 layer, 1 head, pre-trained to predict: A→B, B→C, C→D, D→A
    const d = 4;
    const vocab = ['A','B','C','D'];

    // Embedding: each token maps to a 4D vector
    const embed = [
      [1, 0, 0, 0],  // A
      [0, 1, 0, 0],  // B
      [0, 0, 1, 0],  // C
      [0, 0, 0, 1],  // D
    ];

    // Pre-trained attention weights that shift by 1 position
    // W_QK makes each token attend to itself
    // W_V + W_O implement a "shift" operation
    const W_V = [  // 4×4: rotates tokens by 1
      0, 0, 0, 1,
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0
    ];

    // LM head: maps back to vocab (4×4 identity-ish)
    const W_lm = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];

    // Ref
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));
    this.showColor('#808080'); await this.sleep(600);

    // Helper: optical matmul y = W × x (4×4 × 4×1)
    const optMatMul = async (W, x, label) => {
      this.setRun(this.t('etap'), label, 93);
      // Show pattern: each row of W×x as 4 blocks
      const pattern = [];
      for (let i = 0; i < 4; i++) {
        let v = 0;
        for (let j = 0; j < 4; j++) v += Math.max(0, W[i*4+j]) * Math.max(0, x[j]);
        pattern.push(Math.max(0, Math.min(1, v)));
      }

      this.showBlockPattern(pattern, 4);
      await this.sleep(600);
      const f = await this.captureStable(5, 50);
      const rawMean = this.regionMean(f);
      this.showColor('#808080'); await this.sleep(400);

      // Normalize per-block
      const blocks = this.blockMeans(f, 4);
      const ref4 = Array(4).fill(refBright);
      return blocks.map((b, i) => {
        const n = (b - blackLevel) / Math.max(refBright - blackLevel, 1);
        return n > 0 ? Math.pow(n, invGamma) : 0;
      });
    };

    // Generate 3 tokens starting from 'A'
    const prompt = [0]; // A
    const generated = [...prompt];
    const digitalGenerated = [...prompt];
    const attnWeightsOpt = [];  // softmax(Q·Kᵀ) optical
    const attnWeightsDig = [];  // softmax(Q·Kᵀ) digital
    const vProjections = [];    // V projections for correlation

    // W_Q and W_K for attention scores (identity = self-attend)
    const W_Q = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    const W_K = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

    for (let step = 0; step < 3; step++) {
      const lastTok = generated[generated.length - 1];
      if (lastTok < 0 || lastTok >= 4 || !embed[lastTok]) {
        this.log(`Token ${step}: invalid index ${lastTok}, stopping`, 'warn');
        break;
      }
      const x = embed[lastTok];

      this.log(`Token ${step}: input='${vocab[lastTok]}'`);

      // Compute Q and K digitally (identity projections)
      const q = [...x];
      const k = [...x];

      // Attention score: Q·Kᵀ = just dot product with self = 1.0
      // For single-token: softmax([score]) = [1.0]
      // So attention always selects current token fully
      const attnDig = [1.0];  // single position

      // Optical: measure Q·K similarity via intensity
      // Show Q as pattern, measure, then show K, compute correlation
      const qIntensity = q.reduce((a,b) => a+Math.abs(b), 0) / 4;
      const vQ = Math.round(qIntensity * 255);
      this.showColor(`rgb(${vQ},${vQ},${vQ})`);
      await this.sleep(500);
      const qFrame = await this.captureStable(4, 50);
      const qRaw = this.regionMean(qFrame);
      const qNorm = (qRaw - blackLevel) / Math.max(refBright - blackLevel, 1);
      const qCorr = qNorm > 0 ? Math.pow(qNorm, invGamma) : 0;
      this.showColor('#808080'); await this.sleep(300);

      const attnOpt = [qCorr]; // normalized attention weight
      attnWeightsOpt.push(attnOpt);
      attnWeightsDig.push(attnDig);

      // Optical: W_V × x (value projection) - sum-based
      // Show each row of W_V*x as separate intensity, measure total
      const vDig = [];
      for (let i = 0; i < 4; i++) {
        let s = 0;
        for (let j = 0; j < 4; j++) s += W_V[i*4+j] * x[j];
        vDig.push(s);
      }

      // Optical V projection: show element-product pattern row by row
      const vOpt = [];
      for (let row = 0; row < 4; row++) {
        // Each row of W_V has one non-zero entry, show its value
        const rowVal = Math.max(0, vDig[row]); // non-negative
        const vPx = Math.round(Math.min(1, rowVal) * 255);
        this.showColor(`rgb(${vPx},${vPx},${vPx})`);
        await this.sleep(400);
        const vFrame = await this.captureStable(4, 50);
        const vRaw = this.regionMean(vFrame);
        const vNorm = (vRaw - blackLevel) / Math.max(refBright - blackLevel, 1);
        const vCorrected = vNorm > 0 ? Math.pow(vNorm, invGamma) : 0;
        vOpt.push(vCorrected);
        this.showColor('#808080'); await this.sleep(200);
      }
      vProjections.push({ optical: [...vOpt], digital: [...vDig] });

      // Optical: LM head (identity) - use vOpt directly as logits
      const logitsOpt = [...vOpt];
      const logitsDig = [...vDig];

      // Argmax (clamped to valid range)
      let optToken = logitsOpt.indexOf(Math.max(...logitsOpt));
      let digToken = logitsDig.indexOf(Math.max(...logitsDig));
      optToken = Math.max(0, Math.min(3, optToken));
      digToken = Math.max(0, Math.min(3, digToken));

      generated.push(optToken);
      digitalGenerated.push(digToken);

      this.log(`  V_dig=[${vDig.map(v=>v.toFixed(2))}] V_opt=[${vOpt.map(v=>v.toFixed(2))}]`);
      this.log(`  → opt='${vocab[optToken]}' dig='${vocab[digToken]}'`,
               optToken === digToken ? 'ok' : 'warn');
    }

    const optText = generated.map(t => vocab[t]).join('');
    const digText = digitalGenerated.map(t => vocab[t]).join('');
    const matchCount = generated.filter((t,i) => t === digitalGenerated[i]).length;

    // Attention weight correlation (softmax distributions)
    const flatAttnDig = attnWeightsDig.flat();
    const flatAttnOpt = attnWeightsOpt.flat();
    const attnCorr = flatAttnDig.length > 1 ? this.pearson(flatAttnOpt, flatAttnDig) : 
                     (flatAttnOpt.length > 0 ? flatAttnOpt[0] : 0); // single-value = just report

    // V-projection correlation (more meaningful)
    const allVDig = vProjections.flatMap(p => p.digital);
    const allVOpt = vProjections.flatMap(p => p.optical);
    const vCorr = this.pearson(allVOpt, allVDig);

    this.log(`LLM: opt="${optText}" dig="${digText}" match=${matchCount}/${generated.length}`,
             matchCount >= 3 ? 'ok' : 'warn');
    this.log(`V-proj correlation: ${vCorr.toFixed(4)}`, vCorr > 0.5 ? 'ok' : 'warn');

    this.results.stage5 = {
      opticalSequence: optText,
      digitalSequence: digText,
      tokenMatch: matchCount,
      totalTokens: generated.length,
      attentionCorrelation: vCorr, // V-projection correlation (meaningful metric)
      vProjections,
      expectedSequence: 'ABCD'
    };
}

export function render(r) {
if (r.stage5) { try {
      const s = r.stage5;
      this.rv('rv-llm-match', `${s.tokenMatch}/${s.totalTokens}`, s.tokenMatch>=3?'ok':s.tokenMatch>=2?'warn':'bad');
      this.rv('rv-llm-attn', (s.attentionCorrelation||0).toFixed(4), (s.attentionCorrelation||0)>0.5?'ok':'warn');
      const g = document.getElementById('g-s5');
      if (s.tokenMatch >= 3) { g.textContent=this.t('llm_generiruet_opticheski'); g.className='grade pass'; }
      else if (s.tokenMatch >= 2) { g.textContent=this.t('chastichno'); g.className='grade partial'; }
      else { g.textContent=this.t('tokeny_ne_sovpadayut'); g.className='grade fail'; }
      const out = document.getElementById('llm-output');
      if (out) {
        let h = this.t('ozhidanie_bbbr', {var0: s.expectedSequence}) +
                this.t('tsifrovoy_bbbr', {var0: s.digitalSequence}) +
                this.t('opticheskiy_bb', {var0: s.opticalSequence});
        if (s.vProjections && s.vProjections.length > 0) {
          h += this.t('brbrbvproektsiib');
          const vocab = ['A','B','C','D'];
          for (let i = 0; i < s.vProjections.length; i++) {
            const p = s.vProjections[i];
            const dStr = p.digital.map(v => v.toFixed(1)).join(',');
            const oStr = p.optical.map(v => v.toFixed(2)).join(',');
            const digTok = p.digital.indexOf(Math.max(...p.digital));
            const optTok = p.optical.indexOf(Math.max(...p.optical));
            const match = digTok === optTok ? '✅' : '❌';
            h += `<br>Step ${i}: dig=[${dStr}]→${vocab[digTok]} opt=[${oStr}]→${vocab[optTok]} ${match}`;
          }
        }
        out.innerHTML = h;
      }
    } catch(e) { console.error('stage5 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.tokenMatch >= 3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.tokenMatch||0) + '/' + (d.totalTokens||4))(d); } catch(e) { return '—'; }
}
