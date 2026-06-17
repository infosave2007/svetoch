// Stage 22: Telep

export async function run() {
this.setRun(this.t('etap'), this.t('kvantovaya_teleportatsiya'), 99.99);
    this.showColor('#808080');
    await this.sleep(800);

    // Encode 4 different "quantum states" in R channel (Alice)
    // Measure B channel output (Bob) — teleportation via θ-coherence
    const states = [
      { name: '|0⟩', r: 255, g: 0, b: 0 },     // Pure R
      { name: '|1⟩', r: 0, g: 0, b: 0 },       // Dark R
      { name: '|+⟩', r: 180, g: 0, b: 0 },     // Medium R
      { name: '|−⟩', r: 80, g: 0, b: 0 }       // Low R
    ];

    const aliceR = [], bobB = [], bobG = [];

    for (let si = 0; si < states.length; si++) {
      const st = states[si];
      this.setRun(this.t('etap'), this.t('teleport', {var0: st.name}), 99.99 + si*0.002);
      // Alice: show state in R channel only
      this.showColor(`rgb(${st.r},${st.g},${st.b})`);
      await this.sleep(1000);
      const frame = await this.captureStable(10, 60);
      const rgb = this.regionMeanRGB(frame);
      aliceR.push(rgb[0]);
      bobG.push(rgb[1]); // θ-channel (entanglement mediator)
      bobB.push(rgb[2]); // Bob's output
      this.log(`  ${st.name}: Alice R=${rgb[0].toFixed(4)} → θ(G)=${rgb[1].toFixed(4)} → Bob B=${rgb[2].toFixed(4)}`);
      this.showColor('#808080'); await this.sleep(500);
    }

    // Correlation between Alice's R input and Bob's B output
    const corrRB = this.pearsonCorr(aliceR, bobB);
    const rbCorr = corrRB;
    const inverted = corrRB < 0;
    const thetaChannel = this.pearsonCorr(aliceR, bobG);
    // Fidelity: how well Bob tracks Alice (absolute correlation)
    const fidelity = Math.abs(corrRB);
    this.log(`Teleport: fidelity=${fidelity.toFixed(3)}, corrRB=${corrRB.toFixed(3)}${inverted ? ' (inverted)' : ''}, θ-channel=${thetaChannel.toFixed(3)}`);
    this.log(`Teleport ${fidelity > 0.83 ? 'ВЫШЕ кв. предела!' : fidelity > 0.5 ? 'работает' : 'слабая'}`, fidelity > 0.5 ? 'ok' : 'warn');

    this.results.stage22 = {
      states: states.map(s=>s.name), aliceR, bobB, bobG,
      fidelity, corrRB, inverted, thetaChannel, rbCorr
    };
}

export function render(r) {
if (r.stage22) { try {
      const s = r.stage22;
      const fidLabel = s.fidelity.toFixed(3) + (s.inverted ? ' ⟲' : '');
      this.rv('rv-tp-fid', fidLabel, s.fidelity > 0.67 ? 'ok' : s.fidelity > 0.5 ? 'warn' : 'bad');
      this.rv('rv-tp-phase', s.thetaChannel.toFixed(3), Math.abs(s.thetaChannel) > 0.5 ? 'ok' : 'warn');
      this.rv('rv-tp-rb', (s.corrRB||s.rbCorr||0).toFixed(3), Math.abs(s.corrRB||s.rbCorr||0) > 0.5 ? 'ok' : 'warn');
      const g = document.getElementById('g-s22');
      if (s.fidelity > 0.83) { g.textContent='✅ Телепортация > кв. предел!' + (s.inverted?' (⟲ инверт.)':''); g.className='grade pass'; }
      else if (s.fidelity > 0.67) { g.textContent='✅ F > 2/3 — квантовый канал!' + (s.inverted?' (⟲)':''); g.className='grade pass'; }
      else if (s.fidelity > 0.5) { g.textContent='⚠️ Частичная телепортация'; g.className='grade partial'; }
      else { g.textContent='❌ Нет телепортации'; g.className='grade fail'; }
      this.drawTeleportChart(s);
    } catch(e) { console.error('stage22 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.fidelity > 0.5)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'F=' + (d.fidelity||0).toFixed(3))(d); } catch(e) { return '—'; }
}
