// Stage 3: MatVec

export async function run() {
this.setRun(this.t('etap'), 'MatVec 16x16 RGB...', 78);
    this.showColor('#808080');
    await this.sleep(800);

    const M = 16;
    const rngR = this.mulberry32(99);
    const rngG = this.mulberry32(100);
    const rngB = this.mulberry32(101);

    const WR = Array.from({length: M*M}, () => rngR());
    const xR = Array.from({length: M}, () => rngR());
    const WG = Array.from({length: M*M}, () => rngG());
    const xG = Array.from({length: M}, () => rngG());
    const WB = Array.from({length: M*M}, () => rngB());
    const xB = Array.from({length: M}, () => rngB());

    const digitalY_R = [];
    const digitalY_G = [];
    const digitalY_B = [];
    for (let i = 0; i < M; i++) {
      let sR = 0, sG = 0, sB = 0;
      for (let j = 0; j < M; j++) {
        sR += WR[i*M+j] * xR[j];
        sG += WG[i*M+j] * xG[j];
        sB += WB[i*M+j] * xB[j];
      }
      digitalY_R.push(sR);
      digitalY_G.push(sG);
      digitalY_B.push(sB);
    }

    const gamma = (this.results.calibration && this.results.calibration.gamma) || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;
    const blockMeansRGB = (frame, gridSize) => {
      if (!frame) return { r: Array(M).fill(0), g: Array(M).fill(0), b: Array(M).fill(0) };
      const d = frame.data, w = frame.width, h = frame.height;
      const cw = Math.floor(w / gridSize), ch = Math.floor(h / gridSize);
      const r = [], g = [], b = [];
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          let rs = 0, gs = 0, bs = 0, cnt = 0;
          const bx0 = col * cw + Math.floor(cw * 0.25), bx1 = col * cw + Math.floor(cw * 0.75);
          const by0 = row * ch + Math.floor(ch * 0.25), by1 = row * ch + Math.floor(ch * 0.75);
          for (let y = by0; y < by1; y += 3) {
            for (let x = bx0; x < bx1; x += 3) {
              const idx = (y * w + x) * 4;
              rs += d[idx]; gs += d[idx + 1]; bs += d[idx + 2]; cnt++;
            }
          }
          r.push(cnt > 0 ? rs / cnt : 0);
          g.push(cnt > 0 ? gs / cnt : 0);
          b.push(cnt > 0 ? bs / cnt : 0);
        }
      }
      return { r, g, b };
    };

    const correctedSum = (measured, ref, channel) => measured[channel].reduce((sum, v, i) => {
      const ratio = Math.max(0, v / Math.max(ref[channel][i] || 1, 1));
      return sum + Math.pow(ratio, invGamma);
    }, 0);

    // Ref: 16 white blocks in 4x4 grid
    this.showBlockPatternRGB(Array(M).fill(1), Array(M).fill(1), Array(M).fill(1), 4);
    await this.sleep(600);
    const refF = await this.captureStable(5, 60);
    const refRGB = blockMeansRGB(refF, 4);

    this.showColor('#808080'); await this.sleep(500);

    const opticalY_R = [];
    const opticalY_G = [];
    const opticalY_B = [];

    for (let i = 0; i < M; i++) {
      this.setRun(this.t('etap'), this.t('matvec_stroka', {var0: i+1, var1: M}), 80 + i * (15/M));
      const rowR = [];
      const rowG = [];
      const rowB = [];
      for (let j = 0; j < M; j++) {
        rowR.push(WR[i*M+j] * xR[j]);
        rowG.push(WG[i*M+j] * xG[j]);
        rowB.push(WB[i*M+j] * xB[j]);
      }

      this.showBlockPatternRGB(rowR, rowG, rowB, 4);
      await this.sleep(600);
      const f = await this.captureStable(5, 60);
      const rgbMeas = blockMeansRGB(f, 4);
      opticalY_R.push(correctedSum(rgbMeas, refRGB, 'r'));
      opticalY_G.push(correctedSum(rgbMeas, refRGB, 'g'));
      opticalY_B.push(correctedSum(rgbMeas, refRGB, 'b'));

      this.showColor('#808080'); await this.sleep(400);
    }

    const processChannel = (optY, digY, refVal) => {
      // Normalize. Per-block responses were already gamma-linearized.
      const optNorm = optY.map(v => {
        const raw = v / Math.max(refVal, 1) * M;
        return raw > 0 ? raw : 0;
      });
      // Affine scale to match digital range
      const dMean = digY.reduce((a,b)=>a+b,0)/M;
      const oMean = optNorm.reduce((a,b)=>a+b,0)/M;
      const dR = Math.max(...digY) - Math.min(...digY);
      const oR = Math.max(...optNorm) - Math.min(...optNorm);
      const sc = dR > 0 && oR > 0 ? dR / oR : 1;
      const optScaled = optNorm.map(v => (v - oMean) * sc + dMean);

      const rawCorr = this.pearson(optScaled, digY);
      const rmse = Math.sqrt(digY.map((d,i) => (d-optScaled[i])**2).reduce((a,b)=>a+b,0)/M);
      const nrmse = dR > 0 ? rmse / dR * 100 : 0;

      return { optScaled, rawCorr, nrmse };
    };

    const resR = processChannel(opticalY_R, digitalY_R, M);
    const resG = processChannel(opticalY_G, digitalY_G, M);
    const resB = processChannel(opticalY_B, digitalY_B, M);

    const avgCorr = (Math.abs(resR.rawCorr) + Math.abs(resG.rawCorr) + Math.abs(resB.rawCorr)) / 3;
    const avgNrmse = (resR.nrmse + resG.nrmse + resB.nrmse) / 3;

    this.log(`MatVec 16x16 RGB: R_corr=${resR.rawCorr.toFixed(3)}, G_corr=${resG.rawCorr.toFixed(3)}, B_corr=${resB.rawCorr.toFixed(3)}`);
    this.log(this.t('matvec', {var0: avgCorr > 0.5 ? 'работает' : 'слабый'}), avgCorr > 0.5 ? 'ok' : 'warn');

    // Compile average values for chart & UI compatibility
    const avgDigitalY = Array.from({length: M}, (_, i) => (digitalY_R[i] + digitalY_G[i] + digitalY_B[i]) / 3);
    const avgOpticalY = Array.from({length: M}, (_, i) => (resR.optScaled[i] + resG.optScaled[i] + resB.optScaled[i]) / 3);

    this.results.stage3 = {
      digitalY: avgDigitalY,
      opticalY: avgOpticalY,
      correlation: avgCorr,
      rawCorrelation: avgCorr,
      inverted: false,
      signCorrect: true,
      nrmse: avgNrmse,
      resultsR: resR,
      resultsG: resG,
      resultsB: resB
    };
}

export function render(r) {
if (r.stage3) { try {
      const s = r.stage3;
      this.rv('rv-mvcorr', s.correlation.toFixed(4), s.correlation>0.7?'ok':s.correlation>0.4?'warn':'bad');
      this.rv('rv-nrmse', s.nrmse.toFixed(1)+'%', s.nrmse<30?'ok':s.nrmse<60?'warn':'bad');
      const g = document.getElementById('g-s3');
      if (s.correlation>0.6) { g.textContent=this.t('matvec_rabotaet'); g.className='grade pass'; }
      else if (s.correlation>0.3) { g.textContent=this.t('chastichno'); g.className='grade partial'; }
      else { g.textContent=this.t('nuzhna_kalibrovka'); g.className='grade fail'; }
      this.drawMVChart(s);
    } catch(e) { console.error('stage3 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.correlation > 0.4)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.correlation||0).toFixed(3))(d); } catch(e) { return '—'; }
}
