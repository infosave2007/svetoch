// Stage 11: RoPE

export async function run() {
this.setRun(this.t('etap'), 'Chromatic RoPE...', 99.5);
    this.showColor('#808080');
    await this.sleep(800);

    const oled_pitch_um = this.currentDevice ? this.currentDevice.oled_pitch_um : 63.2;
    const recommended_dist_mm = this.currentDevice ? this.currentDevice.recommended_dist_mm : 37.0;

    // Talbot distances for OLED pixel pitch:
    // z_T(λ) = (2 * a² / λ) * 10
    const zT_R = Math.round((2 * oled_pitch_um * oled_pitch_um / 63) * 10) / 10; // mm
    const zT_G = Math.round((2 * oled_pitch_um * oled_pitch_um / 53) * 10) / 10; // mm
    const zT_B = Math.round((2 * oled_pitch_um * oled_pitch_um / 47) * 10) / 10; // mm
    const z_roundtrip = recommended_dist_mm * 2; // mm (round-trip to mirror)

    // Fractional Talbot positions
    const fracR = z_roundtrip / zT_R; // ~0.789
    const fracG = z_roundtrip / zT_G; // ~0.663
    const fracB = z_roundtrip / zT_B; // ~0.589

    this.log(`Talbot: z_T(R)=${zT_R}mm z_T(G)=${zT_G}mm z_T(B)=${zT_B}mm`);
    this.log(this.t('fraktsii_r_g_b', {var0: fracR.toFixed(3), var1: fracG.toFixed(3), var2: fracB.toFixed(3)}));

    // Show WHITE stripes at multiple spatial frequencies
    // Measure contrast separately in R, G, B camera channels
    const stripeSizes = [32, 24, 16, 12, 8, 6];
    const contrastsR = [];
    const contrastsG = [];
    const contrastsB = [];

    // Reference: gray screen for AE stabilization
    this.showColor('#808080');
    await this.sleep(1000);

    for (let si = 0; si < stripeSizes.length; si++) {
      const sz = stripeSizes[si];
      this.setRun(this.t('etap'), this.t('poloski_px_rgb', {var0: sz}), 99.5 + si * 0.08);
      this.log(this.t('poloski_px', {var0: sz}));

      // Show WHITE vertical stripes
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        const pxSz = sz * dpr;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += pxSz * 2) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, 0, pxSz, h);
        }
      });
      await this.sleep(1000);
      const frame = await this.captureStable(8, 60);

      // Measure contrast per-channel
      const rgbContrasts = this.measureStripContrastRGB(frame);
      contrastsR.push(rgbContrasts[0]);
      contrastsG.push(rgbContrasts[1]);
      contrastsB.push(rgbContrasts[2]);

      this.log(`  R=${rgbContrasts[0].toFixed(4)} G=${rgbContrasts[1].toFixed(4)} B=${rgbContrasts[2].toFixed(4)}`);

      this.showColor('#808080');
      await this.sleep(600);
    }

    // Compute chromatic phase shift ratios
    // RoPE angle: the ratio of contrasts between channels varies with frequency
    // This encodes position because z/z_T differs per channel
    const phaseShiftsRG = []; // contrast ratio R/G at each frequency
    const phaseShiftsGB = []; // contrast ratio G/B at each frequency

    for (let i = 0; i < stripeSizes.length; i++) {
      const rg = contrastsG[i] > 0.001 ? contrastsR[i] / contrastsG[i] : 1;
      const gb = contrastsB[i] > 0.001 ? contrastsG[i] / contrastsB[i] : 1;
      phaseShiftsRG.push(rg);
      phaseShiftsGB.push(gb);
    }

    // Chromatic dispersion: variance of R/G ratios across frequencies
    const meanRG = phaseShiftsRG.reduce((a,b) => a+b, 0) / phaseShiftsRG.length;
    const meanGB = phaseShiftsGB.reduce((a,b) => a+b, 0) / phaseShiftsGB.length;
    const varRG = phaseShiftsRG.reduce((s,v) => s + (v-meanRG)**2, 0) / phaseShiftsRG.length;
    const varGB = phaseShiftsGB.reduce((s,v) => s + (v-meanGB)**2, 0) / phaseShiftsGB.length;
    const dispersion = Math.sqrt(varRG + varGB);

    // RoPE uniqueness: are the R/G and G/B ratios distinguishable at each frequency?
    // If ratios differ across frequencies, position can be encoded
    const rgbVectors = stripeSizes.map((_, i) => [phaseShiftsRG[i], phaseShiftsGB[i]]);
    let uniquePairs = 0, totalPairs = 0;
    for (let i = 0; i < rgbVectors.length; i++) {
      for (let j = i + 1; j < rgbVectors.length; j++) {
        const dist = Math.sqrt((rgbVectors[i][0]-rgbVectors[j][0])**2 + (rgbVectors[i][1]-rgbVectors[j][1])**2);
        if (dist > 0.05) uniquePairs++;
        totalPairs++;
      }
    }
    const uniqueness = totalPairs > 0 ? uniquePairs / totalPairs : 0;

    this.log(this.t('rg_sdvig_sredn_gb_sdvig_sredn', {var0: meanRG.toFixed(3), var1: meanGB.toFixed(3)}));
    this.log(this.t('dispersiya_unikalnost', {var0: dispersion.toFixed(4), var1: (uniqueness*100).toFixed(0)}));
    this.log(this.t('chromatic_rope', {var0: dispersion > 0.02 ? 'работает' : 'слабый'}), dispersion > 0.02 ? 'ok' : 'warn');

    this.results.stage11 = {
      stripeSizes, contrastsR, contrastsG, contrastsB,
      phaseShiftsRG, phaseShiftsGB,
      meanRG, meanGB, dispersion, uniqueness,
      talbotDistances: { R: zT_R, G: zT_G, B: zT_B },
      talbotFractions: { R: fracR, G: fracG, B: fracB }
    };
}

export function render(r) {
if (r.stage11) { try {
      const s = r.stage11;
      this.rv('rv-rope-rg', s.meanRG.toFixed(3), Math.abs(s.meanRG-1)>0.05?'ok':'warn');
      this.rv('rv-rope-gb', s.meanGB.toFixed(3), Math.abs(s.meanGB-1)>0.05?'ok':'warn');
      this.rv('rv-rope-disp', s.dispersion.toFixed(4), s.dispersion>0.02?'ok':s.dispersion>0.005?'warn':'bad');
      this.rv('rv-rope-uniq', (s.uniqueness*100).toFixed(0)+'%', s.uniqueness>0.5?'ok':s.uniqueness>0.2?'warn':'bad');
      const g = document.getElementById('g-s11');
      if (s.dispersion > 0.02 && s.uniqueness > 0.3) {
        g.textContent=this.t('chromatic_rope_rabotaet'); g.className='grade pass';
      } else if (s.dispersion > 0.005) {
        g.textContent=this.t('slabaya_dispersiya'); g.className='grade partial';
      } else {
        g.textContent=this.t('net_khromaticheskoy_raznitsy'); g.className='grade fail';
      }
      // Detail table
      const det = document.getElementById('rope-detail');
      if (det) {
        let h = `<b>z_T: R=${s.talbotDistances.R}mm G=${s.talbotDistances.G}mm B=${s.talbotDistances.B}mm</b><br>`;
        h += `<b>z/z_T: R=${s.talbotFractions.R.toFixed(3)} G=${s.talbotFractions.G.toFixed(3)} B=${s.talbotFractions.B.toFixed(3)}</b><br><br>`;
        h += '<b>px | C(R) | C(G) | C(B) | R/G | G/B</b><br>';
        for (let i = 0; i < s.stripeSizes.length; i++) {
          h += `${s.stripeSizes[i].toString().padStart(2)} | ${s.contrastsR[i].toFixed(4)} | ${s.contrastsG[i].toFixed(4)} | ${s.contrastsB[i].toFixed(4)} | ${s.phaseShiftsRG[i].toFixed(3)} | ${s.phaseShiftsGB[i].toFixed(3)}<br>`;
        }
        det.innerHTML = h;
      }
      this.drawRoPEChart(s);
    } catch(e) { console.error('stage11 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.dispersion > 0.005)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'disp=' + (d.dispersion||0).toFixed(4))(d); } catch(e) { return '—'; }
}
