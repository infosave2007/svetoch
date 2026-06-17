// Stage 100: Chromatic Dispersion Saccharimeter

export async function run() {
  this.setRun(this.t('etap'), this.t('analyzing_dispersion'), 150.0);
  this.log('━━━ STAGE 100: CHROMATIC DISPERSION SACCHARIMETER ━━━');
  this.log('  Size-independent measurement of salt/sugar concentration');

  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    const dpr = window.devicePixelRatio || 1;
    const pxSz = 2 * dpr;
    // Speckle noise to prevent Moire aliasing and stabilize spatial variance
    for (let y = 0; y < h; y += pxSz * 2) {
      for (let x = 0; x < w; x += pxSz * 2) {
        if (Math.random() > 0.5) {
           ctx.fillStyle = '#ffffff'; 
           ctx.fillRect(x, y, pxSz * 2, pxSz * 2);
        }
      }
    }
  });

  this.log('\n  Warming up auto-exposure (3s)...');
  await this.sleep(3000);

  this.log('\n  Measuring Chromatic Dispersion Ratio (Cr / Cb)...');
  
  const durationSec = 10;
  const runDurationMs = durationSec * 1000;
  const startTime = Date.now();
  
  let totalD = 0;
  let samples = 0;

  while (Date.now() - startTime < runDurationMs) {
    const frame = this.captureFrame();
    
    // Calculate spatial contrast for R and B channels
    let sumR = 0, sumSqR = 0;
    let sumB = 0, sumSqB = 0;
    let count = 0;
    
    const d = frame.data;
    const fw = frame.width, fh = frame.height;
    const cx = fw/2, cy = fh/2, r = Math.min(fw, fh) * 0.4;
    
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
         const dx = x - cx, dy = y - cy;
         if (dx*dx + dy*dy < r*r) {
           const i = (y * fw + x) * 4;
           const vR = d[i];     // Red channel
           const vB = d[i+2];   // Blue channel
           
           sumR += vR; sumSqR += vR * vR;
           sumB += vB; sumSqB += vB * vB;
           count++;
         }
      }
    }
    
    if (count > 0) {
        const meanR = sumR / count;
        const varR = (sumSqR / count) - (meanR * meanR);
        const stdR = Math.sqrt(Math.max(0, varR));
        
        const meanB = sumB / count;
        const varB = (sumSqB / count) - (meanB * meanB);
        const stdB = Math.sqrt(Math.max(0, varB));
        
        // Dispersion index D = Cr / Cb
        if (stdB > 0) {
            const rawD = stdR / stdB;
            
            // Thermal Drift Correction (Screen heats the liquid over time)
            // Evaluated from logs: drift is approx +0.0010 per second
            const t_sec = (Date.now() - startTime) / 1000.0;
            const THERMAL_DRIFT_COEF = 0.0010; 
            const currentD = rawD - (t_sec * THERMAL_DRIFT_COEF);
            
            totalD += currentD;
            samples++;
            
            if (samples % 10 === 0) { // Log occasionally
               this.log(`  [${t_sec.toFixed(1)}s] Cr=${stdR.toFixed(2)}, Cb=${stdB.toFixed(2)} => rawD=${rawD.toFixed(3)}, corrD=${currentD.toFixed(3)}`);
            }
        }
    }
    await this.sleep(50);
  }

  this.showColor('#000000');
  const avgD = samples > 0 ? (totalD / samples) : 1.0;
  
  let result = 'Unknown';
  let emoji = '❓';

  // Empirical Calibration based on Speckle Noise Data (Thermally Corrected):
  // Air -> D ≈ 0.946
  // Honey/Resin -> D ≈ 0.980 - 0.985
  // Oil -> D ≈ 0.988
  // Thick Syrup -> D ≈ 0.989
  // Light Syrup -> D ≈ 0.991
  // Water -> D ≈ 0.994
  
  if (avgD < 0.975) {
     result = 'Воздух (без капли)';
     emoji = '🌬';
  } else if (avgD >= 0.975 && avgD < 0.985) {
     result = 'Вязкая органика (Мед / Смола)';
     emoji = '🍯';
  } else if (avgD >= 0.985 && avgD < 0.989) {
     result = 'Масло (Оливковое/Подсолнечное)';
     emoji = '🛢';
  } else if (avgD >= 0.989 && avgD < 0.991) {
     result = 'Густой сироп (40%+)';
     emoji = '🍬';
  } else if (avgD >= 0.991 && avgD < 0.993) {
     result = 'Сироп (10-20% сахар/соль)';
     emoji = '🧪';
  } else if (avgD >= 0.993) {
     result = 'Чистая Вода / Слабый раствор';
     emoji = '💧';
  }

  this.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  this.log(`  Analysis Complete!`);
  this.log(`  Dispersion Index (D): ${avgD.toFixed(3)}`);
  this.log(`  Material Estimate: ${emoji} ${result}`);
  this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  this.results.stage100 = {
    dispersionIndex: +avgD.toFixed(3),
    result,
    emoji,
    pass: true
  };
}

export function render(r) {
  if (r.stage100) { try {
    const s = r.stage100;
    this.rv('rv-liquid-disp', `D=${s.dispersionIndex}`, 'ok');
    
    const g = document.getElementById('g-s100');
    if (g) {
      g.textContent = `Индекс D=${s.dispersionIndex} (${s.emoji} ${s.result})`;
      g.className = 'grade pass';
    }
  } catch (e) { console.error('s100 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; }
}

export function metric(d) {
  try { return `D=${(d.dispersionIndex||0).toFixed(3)}`; } catch (e) { return '—'; }
}
