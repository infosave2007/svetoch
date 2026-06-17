// Stage 48: 2-Slit

export async function run() {
this.setRun(this.t('etap'), this.t('nvg_dvushchelevoy_opyt'), 108.0);
    this.showColor('#000000');
    await this.sleep(800);

    const cal = this.results.calibration || {};
    const slitWidth = 0.08; // fraction of screen width
    const slitSep = 0.3;   // separation between slit centers

    // Helper: draw slit pattern
    const drawSlits = (ctx, w, h, showA, showB) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const sw = Math.round(w * slitWidth);
      if (showA) {
        const cx = Math.round(w * (0.5 - slitSep/2));
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - sw/2, 0, sw, h);
      }
      if (showB) {
        const cx = Math.round(w * (0.5 + slitSep/2));
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - sw/2, 0, sw, h);
      }
    };

    // Measure I_A (slit A only)
    this.setRun(this.t('etap'), this.t('shchel_a'), 108.1);
    this.showPattern((ctx, w, h) => drawSlits(ctx, w, h, true, false));
    await this.sleep(800);
    const fA = await this.captureStable(8, 50);
    const IA = this.regionMean(fA);

    this.showColor('#000000'); await this.sleep(400);

    // Measure I_B (slit B only)
    this.setRun(this.t('etap'), this.t('shchel_b'), 108.3);
    this.showPattern((ctx, w, h) => drawSlits(ctx, w, h, false, true));
    await this.sleep(800);
    const fB = await this.captureStable(8, 50);
    const IB = this.regionMean(fB);

    this.showColor('#000000'); await this.sleep(400);

    // Measure I_AB (both slits)
    this.setRun(this.t('etap'), this.t('obe_shcheli_ab'), 108.5);
    this.showPattern((ctx, w, h) => drawSlits(ctx, w, h, true, true));
    await this.sleep(800);
    const fAB = await this.captureStable(8, 50);
    const IAB = this.regionMean(fAB);

    // Interference term: 2Re(Ψ₁*Ψ₂) = I_AB - I_A - I_B
    const crossTerm = IAB - IA - IB;
    const normCross = crossTerm / Math.max(IA + IB, 1);
    const interferenceDetected = Math.abs(normCross) > 0.02;

    this.log(`  I_A=${IA.toFixed(1)}, I_B=${IB.toFixed(1)}, I_AB=${IAB.toFixed(1)}`);
    this.log(`  I_A+I_B=${(IA+IB).toFixed(1)}`);
    this.log(this.t('interferentsionnyy_chlen', {var0: crossTerm.toFixed(2), var1: (normCross*100).toFixed(1)}));
    this.log(this.t('nvg', {var0: interferenceDetected ? 'I_AB ≠ I_A+I_B: осмотическое давление обнаружено' : 'слабый сигнал'}), interferenceDetected ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage48 = {
      IA: Number(IA.toFixed(2)), IB: Number(IB.toFixed(2)), IAB: Number(IAB.toFixed(2)),
      crossTerm: Number(crossTerm.toFixed(2)), normCross: Number(normCross.toFixed(4)),
      interferenceDetected
    };
}

export function render(r) {
if (r.stage48) { try {
      const s = r.stage48;
      this.rv('rv-nvg48-iab', s.IAB?.toFixed(1), 'ok');
      this.rv('rv-nvg48-isum', (s.IA + s.IB)?.toFixed(1), 'ok');
      this.rv('rv-nvg48-cross', `${(s.normCross*100)?.toFixed(1)}%`, s.interferenceDetected ? 'ok' : 'warn');
      const g = document.getElementById('g-s48');
      if (s.interferenceDetected) { g.textContent=this.t('nvg_iabiaib_osmoticheskoe_davl'); g.className='grade pass'; }
      else { g.textContent=this.t('interferentsiya_slabaya'); g.className='grade partial'; }
    } catch(e) { console.error('stage48 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.interferenceDetected)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'cross=' + ((d.normCross||0)*100).toFixed(1) + '%')(d); } catch(e) { return '—'; }
}
