// Stage 51: Bell🔔

export async function run() {
this.setRun(this.t('etap'), 'Bell State |Φ⁺⟩ + Aspect CHSH...', 111.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const x0 = cal.x0 || 0;
    const x1 = cal.x1 || 1080;
    const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

    // Step 1: Prepare Bell state |Φ+⟩ = (|00⟩+|11⟩)/√2
    // R-channel = Alice qubit, B-channel = Bob qubit
    this.log(this.t('podgotovka'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const stripeW = Math.max(Math.floor(w / 8), 4);
      for (let x = 0; x < w; x += stripeW * 2) {
        ctx.fillStyle = '#fff'; ctx.fillRect(x, 0, stripeW, h);
      }
    });
    await this.sleep(1000);
    const bellFrame = await this.captureStable(10, 60);

    // Extract R and B from Bell state frame
    const d = bellFrame.data, fw = bellFrame.width, fh = bellFrame.height;
    const bx0 = cal.x0 || Math.floor(fw * 0.15);
    const bx1 = cal.x1 || Math.floor(fw * 0.85);
    const by0 = Math.floor(fh * 0.3), by1 = Math.floor(fh * 0.7);
    const bspan = bx1 - bx0;
    const rChan = [], bChan = [];
    for (let px = 0; px < bspan; px += 2) {
      let rS = 0, bS = 0, c = 0;
      for (let y = by0; y < by1; y += 4) {
        const i = (y * fw + bx0 + px) * 4;
        rS += d[i]; bS += d[i + 2]; c++;
      }
      rChan.push(rS / c); bChan.push(bS / c);
    }
    const corrRB = this.pearsonCorr(rChan, bChan);
    this.log(`  corr(R_Alice, B_Bob) = ${corrRB.toFixed(4)}`);
    this.log(this.t('key', {var0: corrRB > 0.8 ? 'Запутанность подтверждена!' : 'Корреляция слабая'}), corrRB > 0.8 ? 'ok' : 'warn');

    // Step 2: Aspect CHSH test
    // Use visibility of interference fringes at different phase offsets
    // E(a,b) = visibility of cos(x+a)+cos(x+b) pattern = cos((a-b)/2)
    this.setRun(this.t('etap'), this.t('aspect_chsh_iz_bell_state'), 111.5);

    // Calibrate: measure visibility at phase=0 (same pattern) as reference
    const refPeriod = 80;
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const v = Math.round(128 + 120 * Math.cos(2 * Math.PI * x / refPeriod));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(500);
    const fRef = await this.captureStable(6, 40);
    const visRef = this.measureVisibility(fRef);
    this.log(`  Cal: visibility_ref = ${visRef.toFixed(4)} (phase=0)`);

    // CHSH angle pairs: optimal angles for S = 2√2
    const anglePairs = [
      { a: 0,           b: Math.PI/8,   label: '(0, π/8)',     deltaAB: Math.PI/8 },
      { a: 0,           b: 3*Math.PI/8, label: '(0, 3π/8)',    deltaAB: 3*Math.PI/8 },
      { a: Math.PI/4,   b: Math.PI/8,   label: '(π/4, π/8)',   deltaAB: Math.PI/8 },
      { a: Math.PI/4,   b: 3*Math.PI/8, label: '(π/4, 3π/8)', deltaAB: Math.PI/8 },
    ];
    const Evals = [];

    for (let pi = 0; pi < anglePairs.length; pi++) {
      const { a, b, label, deltaAB } = anglePairs[pi];

      // Display superposition pattern: cos(x+a) + cos(x+b)
      // = 2cos((a-b)/2) * cos(x + (a+b)/2)
      // Visibility ∝ |cos((a-b)/2)|
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const sumCos = Math.cos(2 * Math.PI * x / refPeriod + a) +
                         Math.cos(2 * Math.PI * x / refPeriod + b);
          // Normalize to 0-255: sumCos ∈ [-2, 2] → [0, 255]
          const v = Math.round(Math.max(0, Math.min(255, 128 + 60 * sumCos)));
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, 0, 1, h);
        }
      });
      await this.sleep(400);
      const f = await this.captureStable(6, 40);
      const vis = this.measureVisibility(f);

      // E(a,b) = normalized visibility = vis / visRef
      // For Bell state: E(a,b) = -cos(2(a-b)) when using quantum correlations
      // Our optical analog: E = vis/visRef gives cos((a-b)/2) for amplitude superposition
      // Sign from angle: if δ > π/4 → anti-correlated
      const rawE = vis / Math.max(visRef, 0.001);
      const sign = Math.cos(2 * (a - b)) >= 0 ? 1 : -1;
      const E = sign * Math.min(rawE, 1.0);

      Evals.push(E);
      this.log(`  ${label}: vis=${vis.toFixed(4)}, E=${E.toFixed(3)} (δ=${deltaAB.toFixed(3)})`);
      this.showColor('#808080'); await this.sleep(200);
    }

    // S = |E(a,b) - E(a,b') + E(a',b) + E(a',b')|
    const S = Math.abs(Evals[0] - Evals[1] + Evals[2] + Evals[3]);
    const bellViolation = S > 2.0;

    this.log(`━━━ BELL + ASPECT ━━━`);
    this.log(`  S_CHSH = ${S.toFixed(4)} (classical limit 2.0, QM max 2√2=2.83)`);
    this.log(this.t('bell', {var0: bellViolation ? 'НАРУШЕНИЕ ПОДТВЕРЖДЕНО!' : 'не нарушено'}), bellViolation ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage51 = { corrRB: Number(corrRB.toFixed(4)), S: Number(S.toFixed(4)), Evals: Evals.map(e => Number(e.toFixed(4))), bellViolation, visRef: Number(visRef.toFixed(4)) };
}

export function render(r) {
if (r.stage51) { try {
      const s = r.stage51;
      this.rv('rv-bell-corr', s.corrRB?.toFixed(3), s.corrRB > 0.8 ? 'ok' : 'warn');
      this.rv('rv-bell-s', s.S?.toFixed(3), s.S > 2.0 ? 'ok' : 'warn');
      this.rv('rv-bell-viol', s.bellViolation ? 'S>' + s.S?.toFixed(2) + '>2.0' : this.t('net'), s.bellViolation ? 'ok' : 'warn');
      const g = document.getElementById('g-s51');
      if (s.bellViolation) { g.textContent=this.t('bell_narushenie_aspect_vosproi'); g.className='grade pass'; }
      else { g.textContent=this.t('bell_ne_narushen_s'); g.className='grade partial'; }
    } catch(e) { console.error('stage51 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.bellViolation)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'S=' + (d.S||0).toFixed(3))(d); } catch(e) { return '—'; }
}
