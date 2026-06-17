// Stage 37: LSTM

export async function run() {
this.setRun(this.t('etap'), 'Optical LSTM...', 109);
    this.showColor('#808080');
    await this.sleep(800);

    // 3 orthogonal patterns (with wide stripes to survive camera defocus)
    const patterns = [
      { name: this.t('a_goriz'), draw: (ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const step = Math.floor(h / 6);
        for (let y = 0; y < h; y += step) {
          ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, y, w, Math.floor(step / 2));
        }
      }},
      { name: this.t('b_vertik'), draw: (ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const step = Math.floor(w / 6);
        for (let x = 0; x < w; x += step) {
          ctx.fillStyle = '#c0c0c0'; ctx.fillRect(x, 0, Math.floor(step / 2), h);
        }
      }},
      { name: this.t('c_diag'), draw: (ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const step = Math.floor(w / 6);
        for (let d = -h; d < w + h; d += step) {
          ctx.beginPath();
          ctx.moveTo(d, 0); ctx.lineTo(d + h, h);
          ctx.lineWidth = Math.floor(step / 2); ctx.strokeStyle = '#c0c0c0'; ctx.stroke();
        }
      }}
    ];

    // 3 speed modes
    const speeds = [
      { name: this.t('bystryy'), delay: 50 },
      { name: this.t('sredniy'), delay: 200 },
      { name: this.t('medlennyy'), delay: 1000 }
    ];

    const allResults = [];

    for (const speed of speeds) {
      this.setRun(this.t('etap'), `${speed.name} (Δt=${speed.delay}ms)...`, 109);
      this.log(this.t('rezhim_tms', {var0: speed.name, var1: speed.delay}));

      // Phase 1: Show A → B → C rapidly, capture each
      // Use spatial frequency fingerprinting instead of horizontal bins
      // (measureNBins gives same gradient for all patterns due to vignetting)
      const refs = [];
      for (const pat of patterns) {
        this.showPattern(pat.draw);
        await this.sleep(speed.delay + 180); // Wait for camera delay (180ms) + display settle
        const f = await this.captureStable(1, 30);
        refs.push(f ? this.spatialFingerprint(f) : new Array(6).fill(0.5));
      }

      // Phase 2: Black screen — measure decay
      this.showColor('#000000');
      const decayCorrs = [];
      const decayTimes = [0, 50, 100, 200, 400]; // ms after black

      for (const dt of decayTimes) {
        await this.sleep(dt > 0 ? dt - (decayTimes[decayTimes.indexOf(dt) - 1] || 0) : 30);
        const fDecay = await this.captureStable(1, 20);
        const fp = fDecay ? this.spatialFingerprint(fDecay) : new Array(6).fill(0.5);

        const corrA = this.pearsonCorr(fp, refs[0]);
        const corrB = this.pearsonCorr(fp, refs[1]);
        const corrC = this.pearsonCorr(fp, refs[2]);

        decayCorrs.push({ dt, corrA, corrB, corrC });
      }

      // Log results
      for (const d of decayCorrs) {
        this.log(`  t+${d.dt}ms: A=${d.corrA.toFixed(3)} B=${d.corrB.toFixed(3)} C=${d.corrC.toFixed(3)}`);
      }

      // Metrics
      const firstDecay = decayCorrs[0];
      const persistence = Math.abs(firstDecay.corrC);
      const chronological = Math.abs(firstDecay.corrC) > Math.abs(firstDecay.corrA);

      // Fit exponential decay: find τ where corr drops to 1/e
      let tauMemory = 0;
      const c0 = Math.abs(decayCorrs[0].corrC);
      if (c0 > 0.01) {
        for (let i = 1; i < decayCorrs.length; i++) {
          if (Math.abs(decayCorrs[i].corrC) < c0 * 0.368) {
            // Linear interpolation
            const prev = Math.abs(decayCorrs[i-1].corrC);
            const curr = Math.abs(decayCorrs[i].corrC);
            const t0 = decayCorrs[i-1].dt;
            const t1 = decayCorrs[i].dt;
            tauMemory = t0 + (t1 - t0) * (prev - c0*0.368) / (prev - curr);
            break;
          }
        }
        if (tauMemory === 0) tauMemory = decayCorrs[decayCorrs.length-1].dt; // didn't decay
      }

      this.log(`  ${speed.name}: persist=${persistence.toFixed(3)}, chrono=${chronological}, τ=${tauMemory.toFixed(0)}ms`);

      allResults.push({
        speed: speed.name, delay: speed.delay,
        persistence, chronological, tauMemory,
        decayCorrs
      });

      this.showColor('#808080'); await this.sleep(500);
    }

    // Overall assessment
    const fast = allResults[0];
    const medium = allResults[1];
    const slow = allResults[2];

    const memoryExists = fast.persistence > 0.1;
    const chronoOK = fast.chronological;
    const tauOK = fast.tauMemory > 30;
    const speedDependent = fast.persistence > medium.persistence && medium.persistence > slow.persistence;

    const pass = memoryExists && chronoOK && tauOK;

    this.log(`LSTM: memory=${memoryExists}, chrono=${chronoOK}, τ=${fast.tauMemory.toFixed(0)}ms`);
    this.log(`  Speed-dependent: ${speedDependent} (fast=${fast.persistence.toFixed(3)} > med=${medium.persistence.toFixed(3)} > slow=${slow.persistence.toFixed(3)})`);
    this.log(`Optical LSTM ${pass ? 'ПОДТВЕРЖДЁН' : 'слабый'}`, pass ? 'ok' : 'warn');

    this.results.stage37 = {
      results: allResults,
      memoryExists, chronoOK, tauOK, speedDependent, pass,
      tauFast: fast.tauMemory
    };
}

export function render(r) {
if (r.stage37) { try {
      const s = r.stage37;
      this.rv('rv-lstm-pers', (s.results?.[0]?.persistence||0).toFixed(3), s.pass?'ok':'warn');
      this.rv('rv-lstm-tau', (s.tauFast||0).toFixed(0)+'ms', s.pass?'ok':'warn');
      const g = document.getElementById('g-s37');
      if (s.pass) { g.textContent='✅ LSTM память'; g.className='grade pass'; }
      else { g.textContent='❌ Нет памяти'; g.className='grade fail'; }
    } catch(e) { console.error('stage37 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'persist=' + (d.results?.[0]?.persistence||0).toFixed(3))(d); } catch(e) { return '—'; }
}
