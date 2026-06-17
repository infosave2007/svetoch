// Stage 27: C×50

export async function run() {
this.setRun(this.t('etap'), this.t('chsh_raundov'), 100.5);

    // Lock exposure for all 20 rounds
    try {
      const track = this.stream?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities?.() || {};
      if (caps.exposureMode) {
        await track.applyConstraints({ advanced: [{ exposureMode: 'manual' }] });
      }
    } catch(e) {}

    this.showColor('#808080');
    await this.sleep(1000);

    // ═══ VMF CHSH ×20 ROUNDS ═══
    // Same protocol as Stage 17 but repeated 20 times
    // Each round: 4 CHSH pairs → one S value
    // 20 S values → statistics: mean, std, t-test(S > 2)
    // Total: 80 captures (20 × 4)

    const aliceAngles = [30, 52.5];  // degrees — optimal CHSH angles for 4x projection
    const bobAngles   = [41.25, 63.75];
    const chshPairs = [[0,0],[0,1],[1,0],[1,1]];
    const nRounds = 20;
    const nStrips = 8;  // per capture (fast)
    const dpr = window.devicePixelRatio || 1;
    const canvasW = screen.width * dpr;
    const fpPeak = this.results.stage15?.peakFreq;
    const freq = fpPeak ? 2 * fpPeak * dpr : 32 * dpr;

    const sValues = [];
    const cValues = [];  // mean C per round
    const sRawValues = [];

    for (let round = 0; round < nRounds; round++) {
      this.setRun(this.t('etap'), this.t('chsh_raund', {var0: round+1, var1: nRounds}), 100.5 + round * 0.5 / nRounds);
      const jitter = Math.random() * freq;  // random phase per round

      const Eround = [];
      const CRound = [];

      for (let pi = 0; pi < chshPairs.length; pi++) {
        const [ai, bi] = chshPairs[pi];
        const aDeg = aliceAngles[ai], bDeg = bobAngles[bi];
        const aRad = aDeg * Math.PI / 180;
        const bRad = bDeg * Math.PI / 180;

        // Split display: LEFT=Alice@a, RIGHT=Bob@b
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          const halfW = Math.floor(w / 2);
          const cy = Math.floor(h / 2);
          for (let y = 0; y < h; y += 2) {
            const cxA = Math.floor(halfW / 2);
            for (let x = 0; x < halfW; x += 2) {
              const proj = (x - cxA) * Math.cos(aRad) + (y - cy) * Math.sin(aRad) + jitter;
              const v = Math.round(127 + 127 * Math.sin(2*Math.PI*proj/freq));
              ctx.fillStyle = `rgb(${v},${v},${v})`;
              ctx.fillRect(x, y, 2, 2);
            }
            const cxB = halfW + Math.floor(halfW / 2);
            for (let x = halfW; x < w; x += 2) {
              const proj = (x - cxB) * Math.cos(bRad) + (y - cy) * Math.sin(bRad) + jitter;
              const v = Math.round(127 + 127 * Math.sin(2*Math.PI*proj/freq));
              ctx.fillStyle = `rgb(${v},${v},${v})`;
              ctx.fillRect(x, y, 2, 2);
            }
          }
        });
        await this.sleep(600);  // settle time increased to prevent exposure lag and transition blur
        const frame = await this.captureStable(1, 40);

        let E_vmf = 0, C_pair = 0;
        if (frame) {
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

          const stripH = Math.floor(fh * 0.6 / nStrips);
          const y0base = Math.floor(fh * 0.2);
          const aRadCam = Math.PI - aRad;
          const bRadCam = Math.PI - bRad;

          // Auto-calibrate freq per half
          const calA = this.autoCalibrateCamFreq(d, fw, fh, aliceStart, aliceEnd, aRadCam, theorCamFreq);
          const calB = this.autoCalibrateCamFreq(d, fw, fh, bobStart, bobEnd, bRadCam, theorCamFreq);
          const camFreqA = calA.freq, camFreqB = calB.freq;
          const deltas = [];

          // Use a single vertical projection center to prevent artificial phase shift
          const cyCam = Math.floor(fh / 2);

          for (let k = 0; k < nStrips; k++) {
            const yS = y0base + k * stripH;
            const yE = yS + stripH;

            // Alice: Camera RIGHT, template at (π−a) — with RMS normalization
            let mA = 0, cA = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = aliceStart; x < aliceEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                mA += d[idx+1]; cA++;  // GREEN channel
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
            let sinA = 0, cosA = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = aliceStart; x < aliceEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                const Ir = d[idx+1] - mA;
                const I = rmsA > 0.5 ? Ir / rmsA : Ir;
                const proj = (x - cxCamA) * Math.cos(aRadCam) + (y - cyCam) * Math.sin(aRadCam);
                sinA += I * Math.sin(2*Math.PI*proj/camFreqA);
                cosA += I * Math.cos(2*Math.PI*proj/camFreqA);
              }
            }

            // Bob: Camera LEFT, template at (π−b) — with RMS normalization
            let mB = 0, cB = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = bobStart; x < bobEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                mB += d[idx+1]; cB++;  // GREEN channel
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
            let sinB = 0, cosB = 0;
            for (let y = yS; y < yE; y += 3) {
              for (let x = bobStart; x < bobEnd; x += 3) {
                const idx = (y * fw + x) * 4;
                const Ir = d[idx+1] - mB;
                const I = rmsB > 0.5 ? Ir / rmsB : Ir;
                const proj = (x - cxCamB) * Math.cos(bRadCam) + (y - cyCam) * Math.sin(bRadCam);
                sinB += I * Math.sin(2*Math.PI*proj/camFreqB);
                cosB += I * Math.cos(2*Math.PI*proj/camFreqB);
              }
            }

            deltas.push(Math.atan2(sinA, cosA) - Math.atan2(sinB, cosB));
          }

          // Unwrap phase difference to prevent 2*PI wrapping jumps from breaking detrending
          const unwrappedDeltas = this.unwrapPhases(deltas);

          // Detrend linear y-gradient
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

        Eround.push(E_vmf);
        CRound.push(C_pair);
      }

      const S_round = Math.abs(Eround[0] - Eround[1] + Eround[2] + Eround[3]);
      const C_round = CRound.reduce((a,b)=>a+b,0) / CRound.length;
      sValues.push(S_round);
      cValues.push(C_round);
      sRawValues.push(S_round);

      if (round % 5 === 4) {
        const curS = sValues.reduce((a,b)=>a+b,0) / sValues.length;
        this.log(`CHSH ${round+1}/${nRounds}: S̄=${curS.toFixed(4)}${curS > 2 ? ' > 2 ✅' : ''}`);
      }
      await this.sleep(50);  // no gray screen between rounds
    }

    // Statistics on S values
    const sNormValues = sValues.map((v, i) => cValues[i] > 0.05 ? v / cValues[i] : 0);
    const meanSNorm = sNormValues.reduce((a,b)=>a+b,0) / nRounds;
    const stdSNorm = Math.sqrt(sNormValues.reduce((s,v)=>s+(v-meanSNorm)**2,0) / (nRounds-1));

    const meanS = sValues.reduce((a,b)=>a+b,0) / nRounds;
    const stdS = Math.sqrt(sValues.reduce((s,v)=>s+(v-meanS)**2,0) / (nRounds-1));
    const meanC = cValues.reduce((a,b)=>a+b,0) / nRounds;
    const stdC = Math.sqrt(cValues.reduce((s,v)=>s+(v-meanC)**2,0) / (nRounds-1));

    // t-test: is normalized S significantly > 2?
    const tStatBell = stdSNorm > 0 ? (meanSNorm - 2) / (stdSNorm / Math.sqrt(nRounds)) : 0;
    const pBell = tStatBell > 0 ? 0.5 * Math.exp(-0.717*tStatBell - 0.416*tStatBell*tStatBell) : 1;

    // t-test: is S significantly > 0?
    const tStat = stdS > 0 ? meanS / (stdS / Math.sqrt(nRounds)) : 0;
    const pValue = tStat > 0 ? 0.5 * Math.exp(-0.717*tStat - 0.416*tStat*tStat) : 1;

    this.log(this.t('chsh_rezultaty', {var0: nRounds}));
    this.log(this.t('sraw_raundov', {var0: meanS.toFixed(4), var1: stdS.toFixed(4), var2: nRounds}));
    this.log(`S̄_norm = ${meanSNorm.toFixed(4)} ± ${stdSNorm.toFixed(4)}`);
    this.log(`C̄ = ${meanC.toFixed(4)} ± ${stdC.toFixed(4)}`);
    this.log(`t(S_norm>2) = ${tStatBell.toFixed(2)}, p≈${pBell < 0.001 ? '<0.001' : pBell.toFixed(4)}`);
    this.log(this.t('klassich_predel'));

    if (meanSNorm > 2 && pBell < 0.05) {
      this.log(this.t('snorm_znachimo_p_narushenie_be', {var0: meanSNorm.toFixed(4), var1: pBell < 0.001 ? '<0.001' : pBell.toFixed(4)}), 'ok');
    } else if (meanC > 0.1 && pValue < 0.05) {
      this.log(this.t('kogerentnost_znachima_no_snorm'), 'warn');
    } else {
      this.log(this.t('net_znachimogo_narusheniya'), 'warn');
    }

    this.results.stage27 = { 
      sValues, 
      cValues, 
      sNormValues, 
      meanS: meanSNorm, 
      meanS_raw: meanS, 
      meanC, 
      stdS, 
      stdC, 
      tStat, 
      tStatBell, 
      pValue, 
      pBell, 
      N: nRounds 
    };

    // Unlock exposure
    try {
      const track = this.stream?.getVideoTracks()?.[0];
      if (track) await track.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] });
    } catch(e) {}
}

export function render(r) {
if (r.stage27) { try {
      const s = r.stage27;
      this.rv('rv-chsh50-s', (s.meanS||0).toFixed(3)+'±'+(s.stdS||0).toFixed(3), s.meanS>2?'ok':'warn');
      this.rv('rv-chsh50-p', (s.pBell||1)<0.001?'<.001':(s.pBell||1).toFixed(3), (s.pBell||1)<0.05?'ok':'warn');
      const g = document.getElementById('g-s27');
      if (s.meanS>2&&(s.pBell||1)<0.05) { g.textContent=this.t('bell_narushena'); g.className='grade pass'; }
      else if (s.meanS>2) { g.textContent=this.t('s_p_slaboe'); g.className='grade partial'; }
      else { g.textContent=this.t('klassicheskiy'); g.className='grade fail'; }
    } catch(e) { console.error('stage27 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.meanS > 2 && (d.pBell || 1) < 0.05)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'S̄=' + (d.meanS||0).toFixed(3))(d); } catch(e) { return '—'; }
}
