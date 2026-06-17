// Stage 41: OptSGD

export async function run() {
this.setRun(this.t('etap'), 'Optical SGD...', 102.5);
    this.showColor('#808080');
    await this.sleep(800);

    // Target output vector (8 values in range [0.15, 0.85])
    const yTarget = [0.15, 0.35, 0.70, 0.85, 0.50, 0.20, 0.60, 0.40];
    
    // Initial weights (randomized)
    let W = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5].map(v => v + (Math.random() - 0.5) * 0.2);
    
    const nIterations = 8;
    const learningRate = 0.7;
    const losses = [];
    const history = [];

    const displayWeights = (weights) => {
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const colW = Math.floor(w / 8);
        for (let i = 0; i < 8; i++) {
          const val = Math.round(Math.max(0, Math.min(1, weights[i])) * 255);
          ctx.fillStyle = `rgb(${val},${val},${val})`;
          ctx.fillRect(i * colW, 0, colW, h);
        }
      });
    };

    const measureOutput = async () => {
      const frame = await this.captureStable(5, 50);
      return this.measureCalibratedBins ? this.measureCalibratedBins(frame, 8, { mirror: true }) : this.measureNBins(frame, 8);
    };

    for (let iter = 0; iter < nIterations; iter++) {
      this.setRun(this.t('etap'), this.t('sgd_iteratsiya', {var0: iter+1, var1: nIterations}), 102.5 + iter * 0.05);

      displayWeights(W);
      await this.sleep(600);
      const yOpt = await measureOutput();

      // Compute Loss (MSE)
      let mse = 0;
      for (let i = 0; i < 8; i++) {
        mse += (yOpt[i] - yTarget[i]) ** 2;
      }
      mse = mse / 8;
      losses.push(mse);

      // Update Weights using Gradient Descent (Delta Rule)
      const nextW = [];
      for (let i = 0; i < 8; i++) {
        const grad = yOpt[i] - yTarget[i];
        let wNew = W[i] - learningRate * grad;
        wNew = Math.max(0.01, Math.min(0.99, wNew)); // clamp weights
        nextW.push(wNew);
      }

      this.log(this.t('shag_loss_w_y', {var0: iter+1, var1: mse.toFixed(6), var2: W.map(w=>w.toFixed(2)).join(','), var3: yOpt.map(y=>y.toFixed(2)).join(',')}));
      history.push({ iter, W: [...W], yOpt: [...yOpt], mse });
      W = nextW;

      this.showColor('#808080'); await this.sleep(200);
    }

    displayWeights(W);
    await this.sleep(700);
    const finalY = await measureOutput();
    let finalEvalLoss = 0;
    for (let i = 0; i < 8; i++) finalEvalLoss += (finalY[i] - yTarget[i]) ** 2;
    finalEvalLoss /= 8;
    losses.push(finalEvalLoss);

    // Evaluation
    const initialLoss = losses[0];
    const finalLoss = finalEvalLoss;
    const lossReduction = initialLoss > 0 ? (initialLoss - finalLoss) / initialLoss * 100 : 0;
    const pass = lossReduction >= 50 && finalLoss < 0.05;

    this.log(this.t('optical_sgd_nachalnyy_loss_kon', {var0: initialLoss.toFixed(5), var1: finalLoss.toFixed(5)}));
    this.log(this.t('snizhenie_oshibki_trebuetsya', {var0: lossReduction.toFixed(1)}));
    this.log(this.t('obuchenie', {var0: pass ? 'УСПЕШНО ✅' : 'НЕЭФФЕКТИВНО ❌'}), pass ? 'ok' : 'warn');

    this.results.stage41 = {
      history,
      losses,
      yTarget,
      finalW: [...W],
      finalY,
      initialLoss,
      finalLoss,
      lossReduction,
      pass
    };
}

export function render(r) {
if (r.stage41) { try {
      const s = r.stage41;
      this.rv('rv-sgd-init', (s.initialLoss||0).toFixed(4), 'ok');
      this.rv('rv-sgd-final', (s.finalLoss||0).toFixed(4), s.pass?'ok':'warn');
      this.rv('rv-sgd-red', '-'+(s.lossReduction||0).toFixed(0)+'%', s.pass?'ok':'warn');
      const g = document.getElementById('g-s41');
      if (s.pass) { g.textContent=this.t('sgd_skhoditsya'); g.className='grade pass'; }
      else { g.textContent=this.t('sgd_ne_skhoditsya'); g.className='grade fail'; }
    } catch(e) { console.error('stage41 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'Loss:' + (d.initialLoss||0).toFixed(2) + '→' + (d.finalLoss||0).toFixed(2))(d); } catch(e) { return '—'; }
}
