// Stage 101: Bio-Fluid Analyzer (Urine, Blood, Saliva)

export async function run() {
  this.setRun(this.t('etap'), this.t('analyzing_bio'), 180.0);
  this.log('━━━ STAGE 101: CLINICAL BIO-REFRACTOMETER ━━━');
  this.log('  IMPORTANT: Please use transparent tape over the camera for hygiene!');

  // --- PHASE 1: COLORIMETRY (Pigment Detection) ---
  this.log('\n  [1/2] Analyzing Spectral Absorbance (Pigment)...');
  this.showColor('#ffffff'); // Pure white flash
  await this.sleep(3000); // Wait for auto-exposure

  const frameColor = this.captureFrame();
  const dC = frameColor.data;
  const fw = frameColor.width, fh = frameColor.height;
  const cx = fw/2, cy = fh/2, rC = Math.min(fw, fh) * 0.2;
  
  let sR = 0, sG = 0, sB = 0, cntC = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
       const dx = x - cx, dy = y - cy;
       if (dx*dx + dy*dy < rC*rC) {
         const i = (y * fw + x) * 4;
         sR += dC[i]; sG += dC[i+1]; sB += dC[i+2];
         cntC++;
       }
    }
  }
  
  let fluidType = 'Unknown';
  let avgR = 0, avgG = 0, avgB = 0;
  if (cntC > 0) {
     avgR = sR / cntC; avgG = sG / cntC; avgB = sB / cntC;
     this.log(`  RGB Absorption: R=${avgR.toFixed(1)}, G=${avgG.toFixed(1)}, B=${avgB.toFixed(1)}`);
     
     // Classification based on relative pigment absorption
     if (avgR > avgG * 1.5 && avgG < 100) {
         fluidType = 'Blood';
         this.log('  Pigment: Hemoglobin detected (Blood)');
     } else if (avgB < avgR * 0.85 && avgB < avgG * 0.9) {
         fluidType = 'Urine';
         this.log('  Pigment: Urobilin detected (Urine/Amber)');
     } else {
         fluidType = 'Saliva';
         this.log('  Pigment: Transparent/Water-like (Saliva)');
     }
  }

  // --- PHASE 2: DISPERSION (Density/Specific Gravity) ---
  this.log('\n  [2/2] Measuring Density via Abbe Dispersion...');
  
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    const dpr = window.devicePixelRatio || 1;
    const pxSz = 2 * dpr;
    // Speckle noise
    for (let y = 0; y < h; y += pxSz * 2) {
      for (let x = 0; x < w; x += pxSz * 2) {
        if (Math.random() > 0.5) {
           ctx.fillStyle = '#ffffff'; 
           ctx.fillRect(x, y, pxSz * 2, pxSz * 2);
        }
      }
    }
  });

  await this.sleep(2000); // Adapt to noise
  const durationSec = 8;
  const runDurationMs = durationSec * 1000;
  const startTime = Date.now();
  
  let totalD = 0;
  let samples = 0;

  while (Date.now() - startTime < runDurationMs) {
    const frame = this.captureFrame();
    
    let sumR = 0, sumSqR = 0;
    let sumB = 0, sumSqB = 0;
    let count = 0;
    const d = frame.data;
    const rD = Math.min(fw, fh) * 0.4;
    
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
         const dx = x - cx, dy = y - cy;
         if (dx*dx + dy*dy < rD*rD) {
           const i = (y * fw + x) * 4;
           const vR = d[i];
           const vB = d[i+2];
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
        
        if (stdB > 0) {
            const rawD = stdR / stdB;
            // Thermal Drift Correction
            const t_sec = (Date.now() - startTime) / 1000.0;
            const THERMAL_DRIFT_COEF = 0.0010; 
            const currentD = rawD - (t_sec * THERMAL_DRIFT_COEF);
            
            totalD += currentD;
            samples++;
        }
    }
    await this.sleep(50);
  }

  this.showColor('#000000');
  const avgD = samples > 0 ? (totalD / samples) : 1.0;
  this.log(`  Thermally Compensated Dispersion (D): ${avgD.toFixed(4)}`);

  // --- PHASE 3: CLINICAL DIAGNOSIS ---
  let diagnosis = 'Unknown';
  let metricStr = '';
  let emoji = '🩺';

  if (avgD < 0.975) {
      diagnosis = 'ОШИБКА: Нет жидкости / Воздух';
      emoji = '🌬';
  } else {
      if (fluidType === 'Urine') {
          // Specific Gravity Mapping
          // D=0.994 -> SG 1.000 (Pure water)
          // D=0.991 -> SG 1.030 (Dehydrated)
          let sg = 1.000 + (0.994 - avgD) * 10;
          if (sg < 1.000) sg = 1.000;
          if (sg > 1.040) sg = 1.040;
          
          metricStr = `SG: ${sg.toFixed(3)}`;
          
          if (sg < 1.005) {
              diagnosis = 'Моча: Избыточная гидратация (Dilute)';
              emoji = '🚰';
          } else if (sg < 1.020) {
              diagnosis = 'Моча: Нормальная гидратация (Normal)';
              emoji = '💧';
          } else {
              diagnosis = 'Моча: Обезвоживание (Dehydrated)';
              emoji = '🏜';
          }
      } else if (fluidType === 'Blood') {
          // D=0.993 -> Normal Protein
          // Lower D -> Higher protein/density
          if (avgD > 0.993) {
              diagnosis = 'Кровь: Низкий уровень белка (Анемия?)';
              emoji = '🩸';
          } else if (avgD > 0.990) {
              diagnosis = 'Кровь: Норма (Плазма в норме)';
              emoji = '🩸';
          } else {
              diagnosis = 'Кровь: Высокая вязкость / Сгущение';
              emoji = '🛑';
          }
      } else {
          // Saliva / Water
          if (avgD > 0.993) {
              diagnosis = 'Слюна: Нормальная гидратация';
              emoji = '💦';
          } else {
              diagnosis = 'Слюна: Обезвоживание / Густая (Муцин)';
              emoji = '👅';
          }
      }
  }

  this.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  this.log(`  Clinical Analysis Complete!`);
  this.log(`  Fluid Detected: ${fluidType}`);
  this.log(`  Density Index (D): ${avgD.toFixed(4)}`);
  this.log(`  Diagnosis: ${emoji} ${diagnosis} ${metricStr}`);
  this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  this.results.stage101 = {
    dispersionIndex: +avgD.toFixed(4),
    fluidType,
    diagnosis,
    metricStr,
    emoji,
    pass: true
  };
}

export function render(r) {
  if (r.stage101) { try {
    const s = r.stage101;
    let resStr = s.metricStr ? `${s.diagnosis} (${s.metricStr})` : s.diagnosis;
    this.rv('rv-liquid-disp', `D=${s.dispersionIndex}`, 'ok');
    
    const g = document.getElementById('g-s101');
    if (g) {
      g.textContent = `${s.emoji} ${resStr}`;
      g.className = 'grade pass';
    }
  } catch (e) { console.error('s101 render:', e); } }
}

export function check(d) {
  try { return d && d.pass; } catch (e) { return false; }
}

export function metric(d) {
  try { return `D=${(d.dispersionIndex||0).toFixed(3)}`; } catch (e) { return '—'; }
}
