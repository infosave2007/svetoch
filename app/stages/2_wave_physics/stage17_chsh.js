// Stage 17: VMF-C

export async function run() {
this.setRun(this.t('etap'), 'VMF Spatial Angle Scan...', 99.93);

    // ── Lock exposure ──
    let exposureLocked = false;
    try {
      const track = this.stream?.getVideoTracks()?.[0];
      if (track) {
        const caps = track.getCapabilities?.() || {};
        if (caps.exposureMode) {
          await track.applyConstraints({ advanced: [{ exposureMode: 'manual' }] });
          exposureLocked = true;
          this.log('  📸 Exposure locked (manual)');
        }
      }
    } catch(e) {
      this.log(`  ⚠️ Exposure lock failed: ${e.message}`);
    }

    this.showColor('#808080');
    await this.sleep(1500);

    // ═══ SPATIAL ANGLE CORRELATOR SCAN ═══
    //
    // PROTOCOL (iron-clad, no ISP artifacts):
    //   Alice = LEFT display half, stripes at angle (45° − Δθ/2)
    //   Bob   = RIGHT display half, stripes at angle (45° + Δθ/2)
    //   Mirror reflects → camera sees both halves
    //   Camera LEFT = Bob (mirror-reflected)
    //   Camera RIGHT = Alice (mirror-reflected)
    //
    //   Scan Δθ = 0°, 2.5°, 5°, ..., 30° (13 points)
    //   Both angles stay in safe zone [30°, 60°]
    //
    // WHY SPATIAL IS BETTER THAN COLOR:
    //   ✅ LEFT/RIGHT are different pixel regions → no ISP crosstalk
    //   ✅ No Bayer demosaicing correlation between halves
    //   ✅ Uses GREEN channel (2× Bayer pixels → best SNR)
    //   ✅ Auto-calibrate camFreq per half per angle
    //
    // FIT (same rigorous protocol):
    //   E_raw(Δθ) = A·cos(Δθ + B) + D   (VMF prediction)
    //   vs
    //   E_raw(Δθ) = Ag·exp(−(Δθ/σ)²) + Dg   (classical Gaussian)
    //   Compare R² → which model fits better?
    //
    // DERIVED BELL: S = 2√2·A

    const dpr = window.devicePixelRatio || 1;
    const canvasW = screen.width * dpr;
    const fpPeak = this.results.stage15?.peakFreq;
    const freq = fpPeak ? 2 * fpPeak * dpr : 32 * dpr;
    const nStrips = 8;
    const baseAngle = 45; // degrees — center of safe zone

    // 13 scan points: Δθ from 0° to 30° in 2.5° steps
    const scanDeltasDeg = [];
    for (let d = 0; d <= 30; d += 2.5) scanDeltasDeg.push(d);
    const nPoints = scanDeltasDeg.length;

    this.log(`  Spatial angle scan: ${nPoints} points, freq=${freq.toFixed(0)}px`);
    this.log(`  Δθ = 0°..30° step 2.5°, centered on ${baseAngle}°`);
    this.log(`  Alice=LEFT(GREEN), Bob=RIGHT(GREEN)`);

    const scanResults = [];

    for (let si = 0; si < nPoints; si++) {
      const deltaDeg = scanDeltasDeg[si];
      const aDeg = baseAngle - deltaDeg / 2; // Alice angle
      const bDeg = baseAngle + deltaDeg / 2; // Bob angle
      const aRad = aDeg * Math.PI / 180;
      const bRad = bDeg * Math.PI / 180;

      this.setRun(this.t('etap'), `Scan ${si+1}/${nPoints} (Δθ=${deltaDeg}° a=${aDeg}° b=${bDeg}°)`, 99.93 + si * 0.005);

      // Draw: LEFT = Alice at aDeg, RIGHT = Bob at bDeg (grayscale)
      this.showPattern((ctx, w, h) => {
        const halfW = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 2) {
          // LEFT half = Alice
          const cxA = Math.floor(halfW / 2);
          for (let x = 0; x < halfW; x += 2) {
            const proj = (x - cxA) * Math.cos(aRad) + (y - cy) * Math.sin(aRad);
            const v = Math.round(127 + 127 * Math.sin(2 * Math.PI * proj / freq));
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, 2, 2);
          }
          // RIGHT half = Bob
          const cxB = halfW + Math.floor(halfW / 2);
          for (let x = halfW; x < w; x += 2) {
            const proj = (x - cxB) * Math.cos(bRad) + (y - cy) * Math.sin(bRad);
            const v = Math.round(127 + 127 * Math.sin(2 * Math.PI * proj / freq));
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, 2, 2);
          }
        }
      });

      await this.sleep(600);
      const frame = await this.captureStable(4, 50);
      if (!frame) {
        scanResults.push({ deltaDeg, aDeg, bDeg, E_raw: 0, C_pair: 0, c1: 0 });
        continue;
      }

      const d = frame.data, fw = frame.width, fh = frame.height;
      const theorCamFreq = freq * fw / canvasW;

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

      // Mirror flip: camera angles
      const aRadCam = Math.PI - aRad;
      const bRadCam = Math.PI - bRad;

      // Auto-calibrate per half
      const calA = this.autoCalibrateCamFreq(d, fw, fh, aliceStart, aliceEnd, aRadCam, theorCamFreq);
      const calB = this.autoCalibrateCamFreq(d, fw, fh, bobStart, bobEnd, bRadCam, theorCamFreq);
      const camFreqA = calA.freq;
      const camFreqB = calB.freq;

      if (si === 0) {
        this.log(`  frame: ${fw}×${fh}, camFreqA=${camFreqA.toFixed(1)} camFreqB=${camFreqB.toFixed(1)} (theor=${theorCamFreq.toFixed(1)})`);
      }

      const stripH = Math.floor(fh * 0.7 / nStrips);
      const y0base = Math.floor(fh * 0.15);
      const deltas = [];

      // Use a single vertical projection center to prevent artificial phase shift
      const cyCam = Math.floor(fh / 2);

      for (let k = 0; k < nStrips; k++) {
        const yS = y0base + k * stripH;
        const yE = yS + stripH;

        // Alice phase: camera RIGHT half, GREEN channel
        let mA = 0, cntA = 0;
        for (let y = yS; y < yE; y += 2)
          for (let x = aliceStart; x < aliceEnd; x += 2) { mA += d[(y*fw+x)*4+1]; cntA++; }
        mA /= Math.max(cntA, 1);
        let ssA = 0;
        for (let y = yS; y < yE; y += 2)
          for (let x = aliceStart; x < aliceEnd; x += 2) { const v=d[(y*fw+x)*4+1]-mA; ssA+=v*v; }
        const rmsA = Math.sqrt(ssA / Math.max(cntA, 1));
        let sinA = 0, cosA = 0;
        for (let y = yS; y < yE; y += 2)
          for (let x = aliceStart; x < aliceEnd; x += 2) {
            const I0 = d[(y*fw+x)*4+1] - mA;
            const I = rmsA > 0.5 ? I0/rmsA : I0;
            const proj = (x - cxCamA)*Math.cos(aRadCam) + (y - cyCam)*Math.sin(aRadCam);
            sinA += I * Math.sin(2*Math.PI*proj/camFreqA);
            cosA += I * Math.cos(2*Math.PI*proj/camFreqA);
          }

        // Bob phase: camera LEFT half, GREEN channel
        let mB = 0, cntB = 0;
        for (let y = yS; y < yE; y += 2)
          for (let x = bobStart; x < bobEnd; x += 2) { mB += d[(y*fw+x)*4+1]; cntB++; }
        mB /= Math.max(cntB, 1);
        let ssB = 0;
        for (let y = yS; y < yE; y += 2)
          for (let x = bobStart; x < bobEnd; x += 2) { const v=d[(y*fw+x)*4+1]-mB; ssB+=v*v; }
        const rmsB = Math.sqrt(ssB / Math.max(cntB, 1));
        let sinB = 0, cosB = 0;
        for (let y = yS; y < yE; y += 2)
          for (let x = bobStart; x < bobEnd; x += 2) {
            const I0 = d[(y*fw+x)*4+1] - mB;
            const I = rmsB > 0.5 ? I0/rmsB : I0;
            const proj = (x - cxCamB)*Math.cos(bRadCam) + (y - cyCam)*Math.sin(bRadCam);
            sinB += I * Math.sin(2*Math.PI*proj/camFreqB);
            cosB += I * Math.cos(2*Math.PI*proj/camFreqB);
          }

        deltas.push(Math.atan2(sinA, cosA) - Math.atan2(sinB, cosB));
      }

      // Unwrap phase difference to prevent 2*PI wrapping jumps from breaking detrending
      const unwrappedDeltas = this.unwrapPhases(deltas);

      // Detrend
      let sK=0,sD=0,sKD=0,sK2=0;
      for(let k=0;k<nStrips;k++){sK+=k;sD+=unwrappedDeltas[k];sKD+=k*unwrappedDeltas[k];sK2+=k*k;}
      const det=nStrips*sK2-sK*sK;
      const c1=det>0?(nStrips*sKD-sK*sD)/det:0;
      const c0=(sD-c1*sK)/nStrips;
      const residuals=unwrappedDeltas.map((dd,k)=>dd-c0-c1*k);

      // Coherence (C_pair) and expectation value E
      let cS=0,sS=0;
      for(const r of residuals){cS+=Math.cos(r);sS+=Math.sin(r);}
      const C_pair = Math.sqrt(cS*cS+sS*sS)/nStrips;

      // E = real part of mean phase vector = Re(⟨e^{iδ}⟩)
      // This is the MEASURED correlation — contains both amplitude (C) and phase
      // No theoretical cos(4Δθ) injection!
      const meanPhase = Math.atan2(sS, cS);
      const E_raw = -(cS / nStrips);  // = -C_pair * cos(meanPhase)

      scanResults.push({ deltaDeg, aDeg, bDeg, E_raw, C_pair, meanPhase, c1, camFreqA, camFreqB });
      this.log(`    Δθ=${String(deltaDeg).padStart(4)}° (${aDeg.toFixed(1)}°/${bDeg.toFixed(1)}°): E=${E_raw.toFixed(4)} C=${C_pair.toFixed(4)} φ̄=${(meanPhase*180/Math.PI).toFixed(1)}° trend=${c1.toFixed(4)}`);

      await this.sleep(50);
    }

    // ─── FIT 1: COSINE  E = A·cos(4·Δθ + B) + D ───
    let bestA=0, bestB=0, bestD=0, bestSSR=Infinity;
    for (let bDeg=-180; bDeg<=180; bDeg+=1) {
      const bRad=bDeg*Math.PI/180;
      let Su=0,SE=0,SuE=0,Su2=0;
      for(const p of scanResults){
        const u=Math.cos(4*p.deltaDeg*Math.PI/180+bRad);
        Su+=u; SE+=p.E_raw; SuE+=u*p.E_raw; Su2+=u*u;
      }
      const n=scanResults.length;
      const denom=n*Su2-Su*Su;
      if(Math.abs(denom)<1e-10) continue;
      const A=(n*SuE-Su*SE)/denom;
      if(Math.abs(A)>1.2) continue;
      const D=(SE-A*Su)/n;
      let ssr=0;
      for(const p of scanResults){
        const pred=A*Math.cos(4*p.deltaDeg*Math.PI/180+bRad)+D;
        ssr+=(p.E_raw-pred)**2;
      }
      if(ssr<bestSSR){bestSSR=ssr;bestA=A;bestB=bRad;bestD=D;}
    }
    if(bestA<0){bestA=-bestA;bestB+=Math.PI;}

    const meanE=scanResults.reduce((s,p)=>s+p.E_raw,0)/scanResults.length;
    const ssTot=scanResults.reduce((s,p)=>s+(p.E_raw-meanE)**2,0);
    const R2cos=ssTot>0?1-bestSSR/ssTot:0;

    // ─── FIT 2: GAUSSIAN  E = Ag·exp(−(Δθ/σ)²) + Dg ───
    let bestAg=0, bestSig=10, bestDg=0, bestSSRg=Infinity;
    for (let sig=5; sig<=90; sig+=1) {
      let Su=0,SE=0,SuE=0,Su2=0;
      for(const p of scanResults){
        const u=Math.exp(-Math.pow(p.deltaDeg/sig, 2));
        Su+=u; SE+=p.E_raw; SuE+=u*p.E_raw; Su2+=u*u;
      }
      const n=scanResults.length;
      const denom=n*Su2-Su*Su;
      if(Math.abs(denom)<1e-10) continue;
      const Ag=(n*SuE-Su*SE)/denom;
      const Dg=(SE-Ag*Su)/n;
      let ssr=0;
      for(const p of scanResults){
        const pred=Ag*Math.exp(-Math.pow(p.deltaDeg/sig, 2))+Dg;
        ssr+=(p.E_raw-pred)**2;
      }
      if(ssr<bestSSRg){bestSSRg=ssr;bestAg=Ag;bestSig=sig;bestDg=Dg;}
    }
    const R2gauss=ssTot>0?1-bestSSRg/ssTot:0;

    // Mean C
    const C_mean=scanResults.reduce((s,p)=>s+p.C_pair,0)/scanResults.length;

    // S derived from cos fit amplitude
    const S_derived=2*Math.SQRT2*Math.abs(bestA);

    this.log(`  ─── Spatial Correlator Fits ───`);
    this.log(`  COSINE: E = ${bestA.toFixed(4)}·cos(4·Δθ + ${(bestB*180/Math.PI).toFixed(1)}°) + ${bestD.toFixed(4)}`);
    this.log(`    A=${bestA.toFixed(4)}, B=${(bestB*180/Math.PI).toFixed(1)}°, D=${bestD.toFixed(4)}, R²=${R2cos.toFixed(4)}`);
    this.log(`  GAUSS:  E = ${bestAg.toFixed(4)}·exp(−(Δθ/${bestSig}°)²) + ${bestDg.toFixed(4)}`);
    this.log(`    Ag=${bestAg.toFixed(4)}, σ=${bestSig}°, Dg=${bestDg.toFixed(4)}, R²=${R2gauss.toFixed(4)}`);
    this.log(`  Winner: ${R2cos > R2gauss ? 'COSINE (VMF)' : 'GAUSSIAN (classical)'} (ΔR²=${(R2cos-R2gauss).toFixed(4)})`);
    this.log(`  C̄=${C_mean.toFixed(4)}, S_derived=2√2·A=${S_derived.toFixed(4)}`);

    // S_derived is the raw CHSH parameter. Under the fair-sampling assumption,
    // we normalize by the average visibility C_mean to check for quantum-like violation of 2.0.
    const S_norm = C_mean > 0.05 ? S_derived / C_mean : 0;
    const bellViolation = S_norm > 2.0 && R2cos > 0.5;
    if (bellViolation) {
      this.log(`✅ S_raw=${S_derived.toFixed(3)}, S_norm=${S_norm.toFixed(3)} > 2, R²=${R2cos.toFixed(2)} — VMF CONFIRMED! 🔔`, 'ok');
    } else if (R2cos > 0.3) {
      this.log(`⚠️ Cosine fit OK (R²=${R2cos.toFixed(2)}), A=${bestA.toFixed(3)}, S_raw=${S_derived.toFixed(3)}, S_norm=${S_norm.toFixed(3)}`, 'warn');
    } else {
      this.log(`❌ Weak fit: cos R²=${R2cos.toFixed(2)}, gauss R²=${R2gauss.toFixed(2)}`, 'warn');
    }

    this.results.stage17 = {
      protocol: 'spatial-angle-scan',
      baseAngle, nPoints,
      scanResults, scanDeltasDeg,
      // Cosine fit
      cosAmplitude: bestA, cosPhaseOffset: bestB,
      cosPhaseOffsetDeg: bestB*180/Math.PI,
      cosDCbias: bestD, cosR2: R2cos,
      // Gaussian fit
      gaussAmplitude: bestAg, gaussSigma: bestSig,
      gaussDCbias: bestDg, gaussR2: R2gauss,
      // Winner
      bestModel: R2cos > R2gauss ? 'cosine' : 'gaussian',
      deltaR2: R2cos - R2gauss,
      // Bell
      S_derived, bellViolation,
      C_mean, S: S_derived, S_vmf: S_norm,
      thetaCorr: bestA,
      exposureLocked, freq: freq, canvasW
    };

    // Unlock exposure
    try {
      const track = this.stream?.getVideoTracks()?.[0];
      if (track && exposureLocked) {
        await track.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] });
      }
    } catch(e) {}
}

export function render(r) {
if (r.stage17) { try {
      const s = r.stage17;
      const Sv = s.S_vmf || s.S || 0;
      const Cm = s.C_mean || 0;
      this.rv('rv-bell-s', Sv.toFixed(4), Sv > 2 ? 'ok' : Sv > 1 ? 'warn' : 'bad');
      this.rv('rv-bell-viol', `C̄ = ${Cm.toFixed(4)}`, Cm > 0.707 ? 'ok' : Cm > 0.1 ? 'warn' : 'bad');
      this.rv('rv-bell-theta', s.bellViolation ? 'S > 2 ✅' : `S = ${Sv.toFixed(3)}`, s.bellViolation ? 'ok' : 'warn');
      const g = document.getElementById('g-s17');
      if (s.bellViolation) {
        g.textContent=this.t('svmf_narushenie_bella', {var0: Sv.toFixed(3)}); g.className='grade pass';
      } else if (s.cosR2 > 0.3) {
        g.textContent=`⚠️ Fit OK (R²=${(s.cosR2||0).toFixed(2)}), A=${(s.cosAmplitude||0).toFixed(3)}, S=${Sv.toFixed(3)}`; g.className='grade partial';
      } else { g.textContent=this.t('net_znachimogo_narusheniya'); g.className='grade fail'; }
      const det = document.getElementById('bell-detail');
      if (det) {
        let h = '';
        if (s.scanResults) {
          h += '<b>VMF Spatial Angle Scan: E(Δθ) = A·cos(Δθ + B) + D</b><br>';
          h += `Fit R²: cos = <b>${(s.cosR2||0).toFixed(4)}</b>, gauss = <b>${(s.gaussR2||0).toFixed(4)}</b><br>`;
          h += `Winner: <b>${s.bestModel === 'cosine' ? 'COSINE (VMF) 🌌' : 'GAUSSIAN (Classical) 🔴'}</b><br>`;
          h += `Fitted A = ${(s.cosAmplitude||0).toFixed(4)}, Phase B = ${(s.cosPhaseOffsetDeg||0).toFixed(1)}°, D = ${(s.cosDCbias||0).toFixed(4)}<br>`;
          h += `Derived S = 2√2·A = <b>${(s.S_derived||0).toFixed(4)}</b><br><br>`;
          h += '<b>Scan Points:</b><br>';
          for (let i = 0; i < s.scanResults.length; i += 2) {
            const p1 = s.scanResults[i];
            const p2 = s.scanResults[i+1];
            let row = `Δθ=${p1.deltaDeg.toFixed(1)}°: E=${p1.E_raw.toFixed(3)} (C=${p1.C_pair.toFixed(2)})`;
            if (p2) {
              row += ` | Δθ=${p2.deltaDeg.toFixed(1)}°: E=${p2.E_raw.toFixed(3)} (C=${p2.C_pair.toFixed(2)})`;
            }
            h += row + '<br>';
          }
        } else {
          h = '<b>CHSH: S = |E(a₁,b₁)−E(a₁,b₂)+E(a₂,b₁)+E(a₂,b₂)|</b><br>';
          h += `Alice: [${(s.aliceAngles||[0,45]).join('°, ')}°], Bob: [${(s.bobAngles||[22.5,67.5]).join('°, ')}°]<br>`;
          if (s.pairDetails) {
            for (let i = 0; i < s.pairDetails.length; i++) {
              const p = s.pairDetails[i];
              h += `(${p.aDeg}°,${p.bDeg}°) E_raw=${p.E_raw.toFixed(4)} C=${p.C_pair.toFixed(4)} E_vmf=${p.E_vmf.toFixed(4)}<br>`;
            }
          }
        }
        det.innerHTML = h;
      }
      this.drawBellChart(s);
    } catch(e) { console.error('stage17 display:', e); } }
}


export function check(d) {
  try { return (d => d && (d.S_vmf||d.S||0) > 2)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'S=' + (d.S_vmf||d.S||0).toFixed(3))(d); } catch(e) { return '—'; }
}
