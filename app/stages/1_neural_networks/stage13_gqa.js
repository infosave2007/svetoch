// Stage 13: GQA

export async function run() {
this.setRun(this.t('etap'), 'Grouped Query Attention...', 99.7);
  const cal = this.results.calibration || {};
    
    // First, show a black pattern to capture the baseline dark/reflections
    this.showColor('#000000');
    await this.sleep(1000);
    const fBase = await this.captureStable(6, 50);
    const baseRGB = this.regionMeanRGBRaw(fBase);

    this.showColor('#808080');
    await this.sleep(800);

    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const bw = Math.floor(w / 5);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect((i + 0.5) * bw, h * 0.2, bw * 0.8, h * 0.6);
      }
    });
    await this.sleep(800);
    const flatRFrame = await this.captureStable(6, 50);
    const flatRRaw = this.regionMeanRGBRaw(flatRFrame);

    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const bw = Math.floor(w / 5);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect((i + 0.5) * bw, h * 0.2, bw * 0.8, h * 0.6);
      }
    });
    await this.sleep(800);
    const flatGFrame = await this.captureStable(6, 50);
    const flatGRaw = this.regionMeanRGBRaw(flatGFrame);
    const flatR = flatRRaw.rBins.map((v, i) => Math.max(v - baseRGB.rBins[i], 1));
    const flatG = flatGRaw.gBins.map((v, i) => Math.max(v - baseRGB.gBins[i], 1));

    this.showColor('#808080');
    await this.sleep(500);

    // GQA: 2 Q-heads (R, G channels) share common K,V (white channel)
    // Test: show 4 tokens via white K/V projections, read Q-responses per R and G channels
    const tokens = ['A','B','C','D'];
    const kvWeights = [
      [0,1,0,0], // K for token A → selects B
      [0,0,1,0], // K for token B → selects C
      [0,0,0,1], // K for token C → selects D
      [1,0,0,0]  // K for token D → selects A (wrap)
    ];

    const headR_results = [];
    const headG_results = [];
    const kvCorrelations = [];

    for (let t = 0; t < 3; t++) {
      this.setRun(this.t('etap'), this.t('gqa_token', {var0: tokens[t]}), 99.7 + t*0.03);
      // Show K in RED channel, V in GREEN channel (different inputs for each head)
      const kv = kvWeights[t];
      // V-weights: shifted version of K (V encodes a different relationship)
      const vWeights = kvWeights[(t + 1) % kvWeights.length];
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const bw = Math.floor(w / (kv.length + 1));
        for (let i = 0; i < kv.length; i++) {
          const r = Math.round(kv[i] * 255);     // K in Red
          const g = Math.round(vWeights[i] * 255); // V in Green
          ctx.fillStyle = `rgb(${r},${g},0)`;
          ctx.fillRect((i + 0.5) * bw, h * 0.2, bw * 0.8, h * 0.6);
        }
      });
      await this.sleep(1000);
      const frame = await this.captureStable(8, 60);

      // Read R and G channels separately (2 Q-heads)
      const rawRGB = this.regionMeanRGBRaw(frame);
      
      // Subtract baseline and scale to [0,1]
      const diffR = rawRGB.rBins.map((v, i) => Math.max(0, v - baseRGB.rBins[i]) / flatR[i]);
      const diffG = rawRGB.gBins.map((v, i) => Math.max(0, v - baseRGB.gBins[i]) / flatG[i]);
      
      const scale = (arr) => {
        const min = Math.min(...arr), max = Math.max(...arr);
        return arr.map(v => (max - min > 1e-4) ? (v - min) / (max - min) : 0);
      };
      
      let rFinal = scale(diffR);
      let gFinal = scale(diffG);
      if (cal.isMirrored) {
        rFinal = [...rFinal].reverse();
        gFinal = [...gFinal].reverse();
      }

      headR_results.push(rFinal);
      headG_results.push(gFinal);

      // KV correlation per channel
      const corrR = this.pearsonCorr(kv, rFinal);
      const corrG = this.pearsonCorr(vWeights, gFinal);
      kvCorrelations.push((corrR + corrG) / 2);

      this.log(`  ${tokens[t]}: K(R)=${corrR.toFixed(3)} V(G)=${corrG.toFixed(3)} R=[${rFinal.map(v=>v.toFixed(2)).join(',')}] G=[${gFinal.map(v=>v.toFixed(2)).join(',')}]`);
      this.showColor('#808080');
      await this.sleep(500);
    }

    // Check if both heads agree on token selection
    let headR_match = 0, headG_match = 0;
    for (let t = 0; t < 3; t++) {
      const rArgmax = headR_results[t].indexOf(Math.max(...headR_results[t]));
      const gArgmax = headG_results[t].indexOf(Math.max(...headG_results[t]));
      const expectedK = kvWeights[t].indexOf(1);
      const expectedV = kvWeights[(t + 1) % kvWeights.length].indexOf(1);
      if (rArgmax === expectedK) headR_match++;
      if (gArgmax === expectedV) headG_match++;
    }

    const avgKVCorr = kvCorrelations.reduce((a,b)=>a+b,0) / kvCorrelations.length;

    this.log(`GQA: R-head ${headR_match}/3, G-head ${headG_match}/3, avgKV=${avgKVCorr.toFixed(3)}`);
    this.log(this.t('gqa', {var0: (headR_match+headG_match) >= 4 ? 'работает' : 'слабый'}), (headR_match+headG_match) >= 4 ? 'ok' : 'warn');

    this.results.stage13 = {
      headR_match, headG_match,
      kvCorrelations, avgKVCorr,
      headR_results, headG_results
    };
}

export function render(r) {
if (r.stage13) { try {
      const s = r.stage13;
      this.rv('rv-gqa-r', `${s.headR_match}/3`, s.headR_match >= 2 ? 'ok' : 'warn');
      this.rv('rv-gqa-g', `${s.headG_match}/3`, s.headG_match >= 2 ? 'ok' : 'warn');
      this.rv('rv-gqa-kv', s.avgKVCorr.toFixed(3), s.avgKVCorr > 0.5 ? 'ok' : 'warn');
      const g = document.getElementById('g-s13');
      if ((s.headR_match + s.headG_match) >= 4) {
        g.textContent=this.t('gqa_rabotaet'); g.className='grade pass';
      } else if ((s.headR_match + s.headG_match) >= 2) {
        g.textContent=this.t('chastichnaya_gqa'); g.className='grade partial';
      } else { g.textContent=this.t('gqa_ne_rabotaet'); g.className='grade fail'; }
      this.drawGQAChart(s);
    } catch(e) { console.error('stage13 display:', e); } }
}


export function check(d) {
  try { return (d => d && (d.headR_match+d.headG_match) >= 3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'R:' + (d.headR_match||0) + ' G:' + (d.headG_match||0))(d); } catch(e) { return '—'; }
}
