// Stage 40: FrScn

export async function run() {
this.setRun(this.t('etap'), 'NVG Freq Scan...', 101.6);
    this.showColor('#808080');
    await this.sleep(800);

    const dpr = window.devicePixelRatio || 1;
    const canvasW = screen.width * dpr;
    // 9 frequency points in dpr-scaled display pixels
    const freqFactors = [6, 8, 10, 12, 14, 16, 18, 20, 24];
    const aliceAngles = [30, 52.5];  // degrees — optimal CHSH angles for 4x projection
    const bobAngles   = [41.25, 63.75];
    const chshPairs   = [[0,0],[0,1],[1,0],[1,1]];
    const nStrips = 8;

    const scanPoints = [];  // { freq, freqFactor, Cvals, Cmean, Evals, S }

    for (let fi = 0; fi < freqFactors.length; fi++) {
      const freqFactor = freqFactors[fi];
      const freq = freqFactor * dpr;
      this.setRun(this.t('etap'), `freq=${freqFactor} (${fi+1}/${freqFactors.length})`, 101.6 + fi * 0.04);
      this.log(`  freq=${freqFactor}×dpr = ${freq.toFixed(1)} px...`);

      const Evals = [];
      const Cvals = [];

      for (let pi = 0; pi < chshPairs.length; pi++) {
        const [ai, bi] = chshPairs[pi];
        const aDeg = aliceAngles[ai], bDeg = bobAngles[bi];
        const aRad = aDeg * Math.PI / 180;
        const bRad = bDeg * Math.PI / 180;

        // Split display: LEFT=Alice@a, RIGHT=Bob@b
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          const halfW = Math.floor(w / 2);
          for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < halfW; x += 2) {
              const proj = x * Math.cos(aRad) + y * Math.sin(aRad);
              const v = Math.round(127 + 127 * Math.sin(2*Math.PI*proj/freq));
              ctx.fillStyle = `rgb(${v},${v},${v})`;
              ctx.fillRect(x, y, 2, 2);
            }
            for (let x = halfW; x < w; x += 2) {
              const proj = x * Math.cos(bRad) + y * Math.sin(bRad);
              const v = Math.round(127 + 127 * Math.sin(2*Math.PI*proj/freq));
              ctx.fillStyle = `rgb(${v},${v},${v})`;
              ctx.fillRect(x, y, 2, 2);
            }
          }
        });
        await this.sleep(300);
        const frame = await this.captureStable(2, 50);

        let E_vmf = 0, C_pair = 0;
        if (frame) {
          const d = frame.data, fw = frame.width, fh = frame.height;
          const camFreq = freq * fw / canvasW;

          // Centered coordinates based on calibration x0 and x1
          const cal = this.results.calibration || {};
          const x0 = cal.x0 !== undefined ? cal.x0 : Math.floor(fw * 0.1);
          const x1 = cal.x1 !== undefined ? cal.x1 : Math.floor(fw * 0.9);
          const xm = Math.floor((x0 + x1) / 2);
          const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

          const leftStart = x0, leftEnd = xm;
          const rightStart = xm, rightEnd = x1;

          const aliceStart = isMirrored ? rightStart : leftStart;
          const aliceEnd = isMirrored ? rightEnd : leftEnd;
          const bobStart = isMirrored ? leftStart : rightStart;
          const bobEnd = isMirrored ? leftEnd : rightEnd;

          // Horizontal projection centers
          const cxCamA = Math.floor((aliceStart + aliceEnd) / 2);
          const cxCamB = Math.floor((bobStart + bobEnd) / 2);

          const stripH = Math.floor(fh * 0.6 / nStrips);
          const y0base = Math.floor(fh * 0.2);
          const aRadCam = Math.PI - aRad;
          const bRadCam = Math.PI - bRad;
          const deltas = [];

          // Use a single vertical projection center to prevent artificial phase shift
          const cyCam = Math.floor(fh / 2);

          for (let k = 0; k < nStrips; k++) {
            const yS = y0base + k * stripH;
            const yE = yS + stripH;

            // Alice: Camera RIGHT half, template at (π−a)
            let sinA = 0, cosA = 0, mA = 0, cA = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = aliceStart; x < aliceEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                mA += d[idx+1]; cA++; // GREEN channel
              }
            }
            mA /= Math.max(cA, 1);
            let ssA = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = aliceStart; x < aliceEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                const v = d[idx+1] - mA;
                ssA += v * v;
              }
            }
            const rmsA = Math.sqrt(ssA / Math.max(cA, 1));
            for (let y = yS; y < yE; y += 3) {
              for (let x = aliceStart; x < aliceEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                const Ir = d[idx+1] - mA;
                const I = rmsA > 0.5 ? Ir / rmsA : Ir;
                const proj = (x - cxCamA) * Math.cos(aRadCam) + (y - cyCam) * Math.sin(aRadCam);
                sinA += I * Math.sin(2*Math.PI*proj/camFreq);
                cosA += I * Math.cos(2*Math.PI*proj/camFreq);
              }
            }

            // Bob: Camera LEFT half, template at (π−b)
            let sinB = 0, cosB = 0, mB = 0, cB = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = bobStart; x < bobEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                mB += d[idx+1]; cB++; // GREEN channel
              }
            }
            mB /= Math.max(cB, 1);
            let ssB = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = bobStart; x < bobEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                const v = d[idx+1] - mB;
                ssB += v * v;
              }
            }
            const rmsB = Math.sqrt(ssB / Math.max(cB, 1));
            for (let y = yS; y < yE; y += 3) {
              for (let x = bobStart; x < bobEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                const Ir = d[idx+1] - mB;
                const I = rmsB > 0.5 ? Ir / rmsB : Ir;
                const proj = (x - cxCamB) * Math.cos(bRadCam) + (y - cyCam) * Math.sin(bRadCam);
                sinB += I * Math.sin(2*Math.PI*proj/camFreq);
                cosB += I * Math.cos(2*Math.PI*proj/camFreq);
              }
            }

            deltas.push(Math.atan2(sinA, cosA) - Math.atan2(sinB, cosB));
          }

          // Unwrap phase difference to prevent 2*PI wrapping jumps from breaking detrending
          const unwrappedDeltas = this.unwrapPhases(deltas);

          // Detrend
          let sumK = 0, sumD = 0, sumKD = 0, sumK2 = 0;
          for (let k = 0; k < nStrips; k++) {
            sumK += k; sumD += unwrappedDeltas[k];
            sumKD += k*unwrappedDeltas[k]; sumK2 += k*k;
          }
          const kM = sumK/nStrips, dM = sumD/nStrips;
          const denom = sumK2 - nStrips*kM*kM;
          const c1 = denom > 0 ? (sumKD - nStrips*kM*dM)/denom : 0;
          const residuals = unwrappedDeltas.map((d, k) => d - ((dM - c1*kM) + c1*k));
          let rc = 0, rs = 0;
          for (const r of residuals) { rc += Math.cos(r); rs += Math.sin(r); }
          C_pair = Math.sqrt(rc*rc + rs*rs) / nStrips;
          // E = real part of mean phase vector — MEASURED, no theoretical cos injection
          E_vmf = -(rc / nStrips);
        }

        Evals.push(E_vmf);
        Cvals.push(C_pair);
      }

      const Cmean = Cvals.reduce((a,b)=>a+b,0) / Cvals.length;
      const S = Math.abs(Evals[0] - Evals[1] + Evals[2] + Evals[3]);

      scanPoints.push({ freq, freqFactor, Cvals, Cmean, Evals, S });
      this.log(`    freq=${freqFactor}: C̄=${Cmean.toFixed(4)}, S=${S.toFixed(4)}${S > 2 ? ' ✅' : ''}`);
      this.showColor('#808080'); await this.sleep(200);
    }

    // ═══ Gaussian fit: C(f) = C₀·exp(−(f/σ)²/2) ═══
    // Use least-squares on ln(C) = ln(C₀) − f²/(2σ²)
    // Fit: y = a + b·x  where y=ln(C), x=f²
    const validPts = scanPoints.filter(p => p.Cmean > 0.001);
    let gaussC0 = 1, gaussSigma = 20, gaussFitR2 = 0;
    const residualsArr = [];

    if (validPts.length >= 4) {
      const xs = validPts.map(p => p.freq * p.freq);
      const ys = validPts.map(p => Math.log(Math.max(p.Cmean, 1e-6)));
      const n = xs.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < n; i++) {
        sx += xs[i]; sy += ys[i]; sxy += xs[i]*ys[i]; sx2 += xs[i]*xs[i];
      }
      const b = (n*sxy - sx*sy) / (n*sx2 - sx*sx);
      const a = (sy - b*sx) / n;
      gaussC0 = Math.exp(a);
      gaussSigma = b < 0 ? Math.sqrt(-1 / (2*b)) : 999;

      // R² of log fit
      const yMean = sy / n;
      let ssTot = 0, ssRes = 0;
      for (let i = 0; i < n; i++) {
        const yPred = a + b * xs[i];
        ssTot += (ys[i] - yMean)**2;
        ssRes += (ys[i] - yPred)**2;
      }
      gaussFitR2 = ssTot > 0 ? 1 - ssRes/ssTot : 0;

      // Residuals: C_measured − C_gaussian_predicted
      for (const p of scanPoints) {
        const cPred = gaussC0 * Math.exp(-(p.freq*p.freq) / (2*gaussSigma*gaussSigma));
        residualsArr.push(p.Cmean - cPred);
      }

      this.log(`Gaussian fit: C₀=${gaussC0.toFixed(4)}, σ=${gaussSigma.toFixed(1)} px, R²=${gaussFitR2.toFixed(4)}`);
    }

    // ═══ NVG oscillation detection ═══
    // Scan f_NVG candidates, compute corr(residuals, cos(2πf/f_NVG))
    // NVG: corr > 0.7 at some f_NVG
    // Classical: corr ≈ 0 for all f_NVG
    let bestCorr = 0, bestFnvg = 0;
    const freqArr = scanPoints.map(p => p.freq);
    const corrScan = [];

    if (residualsArr.length >= 5) {
      for (let fNVG = 5; fNVG <= 50; fNVG += 0.5) {
        const cosTemplate = freqArr.map(f => Math.cos(2*Math.PI*f / fNVG));
        const corr = this.pearsonCorr(residualsArr, cosTemplate);
        corrScan.push({ fNVG, corr });
        if (Math.abs(corr) > Math.abs(bestCorr)) {
          bestCorr = corr;
          bestFnvg = fNVG;
        }
      }
    }

    // ═══ λ_eff estimation ═══
    // f_NVG in camera pixels → physical λ_eff
    // pixel_pitch ≈ 0.8 µm (Xiaomi 12 Lite, 1/2" sensor, 4000px wide)
    // λ_eff = pixel_pitch² × f_NVG² / z_roundtrip  (diffraction formula)
    // z_roundtrip ≈ 2 × distance_to_mirror (cm → µm)
    const pixelPitch_um = this.currentDevice ? this.currentDevice.sensor_pitch_um : 0.8;  // µm
    const recommended_dist_mm = this.currentDevice ? this.currentDevice.recommended_dist_mm : 37.0;
    const zRT_um = 2 * recommended_dist_mm * 1000;  // round trip → µm
    const fw = this.capCanvas ? this.capCanvas.width : 1920;
    // Scale calibration factor: DPR (3.0) * Bayer subpixel spacing (2.0) = 6.0
    const scaleFactor = 6.0;
    const lambdaEff_nm = bestFnvg > 0
      ? (2 * Math.pow((fw * pixelPitch_um) / bestFnvg, 2) / zRT_um * 1000) / scaleFactor
      : 0;

    // ═══ Optimal frequency ═══
    let bestFreq = 12, bestCmean = 0;
    for (const p of scanPoints) {
      if (p.Cmean > bestCmean) { bestCmean = p.Cmean; bestFreq = p.freqFactor; }
    }

    // ═══ NVG significance test ═══
    // Fisher z-transform of correlation
    const nvgDetected = Math.abs(bestCorr) > 0.7 && residualsArr.length >= 5;
    const fisherZ = residualsArr.length >= 5
      ? 0.5 * Math.log((1 + Math.abs(bestCorr))/(1 - Math.abs(bestCorr) + 1e-9)) * Math.sqrt(residualsArr.length - 3)
      : 0;
    const pNVG = fisherZ > 0 ? 0.5 * Math.exp(-0.717*fisherZ - 0.416*fisherZ*fisherZ) : 1;

    this.log(this.t('nvg_freq_scan_rezultaty'));
    this.log(`Gaussian: C₀=${gaussC0.toFixed(4)}, σ=${gaussSigma.toFixed(1)} px`);
    this.log(`Residual oscillation: f_NVG=${bestFnvg.toFixed(1)} px, corr=${bestCorr.toFixed(4)}`);
    this.log(this.t('eff_nm_teor_nm', {var0: lambdaEff_nm.toFixed(1)}));
    this.log(this.t('optimalnaya_chastota_freqdpr_c', {var0: bestFreq, var1: bestCmean.toFixed(4)}));
    this.log(`p_NVG ≈ ${pNVG < 0.001 ? '<0.001' : pNVG.toFixed(4)}`);

    if (nvgDetected && pNVG < 0.05) {
      this.log(this.t('nvg_ostsillyatsii_obnaruzheny_', {var0: bestCorr.toFixed(3), var1: lambdaEff_nm.toFixed(1)}), 'ok');
    } else if (Math.abs(bestCorr) > 0.4) {
      this.log(this.t('slabye_ostsillyatsii_v_residua', {var0: bestCorr.toFixed(3)}), 'warn');
    } else {
      this.log(this.t('ostsillyatsii_ne_obnaruzheny_k'), 'warn');
    }

    this.results.stage40 = {
      scanPoints, freqFactors,
      gaussC0, gaussSigma, gaussFitR2,
      residuals: residualsArr,
      corrScan, bestCorr, bestFnvg,
      lambdaEff_nm, pixelPitch_um, zRT_um,
      bestFreq, bestCmean,
      nvgDetected, pNVG, fisherZ
    };
}

export function render(r) {
if (r.stage40) { try {
      const s = r.stage40;
      this.rv('rv-freq-corr', (s.bestCorr||0).toFixed(3), s.nvgDetected?'ok':'warn');
      this.rv('rv-freq-lam', (s.lambdaEff_nm||0).toFixed(1)+'nm', s.nvgDetected?'ok':'warn');
      const g = document.getElementById('g-s40');
      if (s.nvgDetected) { g.textContent=this.t('nvg_obnaruzhen'); g.className='grade pass'; }
      else { g.textContent=this.t('ne_obnaruzhen'); g.className='grade fail'; }
    } catch(e) { console.error('stage40 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.nvgDetected)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.bestCorr||0).toFixed(3))(d); } catch(e) { return '—'; }
}
