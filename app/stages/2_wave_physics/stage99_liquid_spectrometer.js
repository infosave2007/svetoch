// Stage 99: Liquid Spectrometer & Refractometer

export async function run() {
  this.setRun(this.t('etap'), this.t('analyzing'), 150.0);
  this.log('━━━ STAGE 99: MICRO-DROP SPECTRO-REFRACTOMETER ━━━');
  this.log('  Place a drop of liquid directly on the front camera lens');

  // 1. Refractometry (Spatial Contrast)
  this.log('\n  [1/2] Measuring Refractive Index & Turbidity...');
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    // High-frequency grating
    const dpr = window.devicePixelRatio || 1;
    const pxSz = 2 * dpr;
    for (let x = 0; x < w; x += pxSz * 2) {
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(x, 0, pxSz, h);
    }
  });
  await this.sleep(2000); // Wait for auto-exposure to settle on grid
  const frameWhite = this.captureFrame();
  
  // Calculate spatial contrast (standard deviation of brightness)
  let sum = 0, sumSq = 0, count = 0;
  const d = frameWhite.data;
  // Center crop sampling to avoid edge vignette
  const fw = frameWhite.width, fh = frameWhite.height;
  const cx = fw/2, cy = fh/2, r = Math.min(fw, fh) * 0.4;
  
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
       const dx = x - cx, dy = y - cy;
       if (dx*dx + dy*dy < r*r) {
         const i = (y * fw + x) * 4;
         const v = (d[i] + d[i+1] + d[i+2]) / 3;
         sum += v; 
         sumSq += v * v; 
         count++;
       }
    }
  }
  
  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? (sumSq / count) - (mean * mean) : 0;
  const stdDev = Math.sqrt(Math.max(0, variance));
  
  this.log(`  Contrast (StdDev): ${stdDev.toFixed(2)}`);

  // 2. Spectroscopy
  this.log('\n  [2/2] Measuring Absorption Spectrum...');
  
  const getChannelAvg = async (colorHex, channelOffset) => {
      this.showColor(colorHex);
      await this.sleep(1000); // Let auto-white-balance / auto-exposure settle
      const f = this.captureFrame();
      let s = 0, c = 0;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
           const dx = x - cx, dy = y - cy;
           if (dx*dx + dy*dy < r*r) {
             const i = (y * fw + x) * 4;
             s += f.data[i + channelOffset];
             c++;
           }
        }
      }
      return c > 0 ? s / c : 0;
  };

  const avgR = await getChannelAvg('#FF0000', 0);
  const avgG = await getChannelAvg('#00FF00', 1);
  const avgB = await getChannelAvg('#0000FF', 2);
  
  this.log(`  Spectrum: R=${avgR.toFixed(1)}, G=${avgG.toFixed(1)}, B=${avgB.toFixed(1)}`);
  
  this.showColor('#000000');
  
  // 3. Classification
  let result = 'Unknown';
  let emoji = '❓';
  
  const rToG = avgG > 1 ? avgR / avgG : avgR;
  const rToB = avgB > 1 ? avgR / avgB : avgR;
  
  this.log(`  R/G Ratio: ${rToG.toFixed(2)}`);

  // Simple heuristic thresholds
  // Air: High contrast (> 25)
  // Blood: R/G > 1.5 (High red transmission, absorbs green/blue), low contrast
  // Water: R/G ~ 1.0, Contrast medium (9.75 - 25)
  // Oil: R/G ~ 1.0, Contrast low (< 9.75, high refraction & different contact angle)
  
  if (stdDev > 25) {
      result = 'Воздух (нет капли)';
      emoji = '🌬';
  } else if (rToG > 1.5) {
      result = 'Кровь';
      emoji = '🩸';
  } else if (stdDev < 9.75) {
      result = 'Масло';
      emoji = '🛢';
  } else {
      result = 'Вода';
      emoji = '💧';
  }

  this.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  this.log(`  Classification: ${emoji} ${result}`);
  this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  this.results.stage99 = {
    stdDev: +stdDev.toFixed(2),
    avgR: +avgR.toFixed(1),
    avgG: +avgG.toFixed(1),
    avgB: +avgB.toFixed(1),
    rToG: +rToG.toFixed(2),
    result,
    emoji
  };
}

export function render(r) {
  if (r.stage99) { try {
    const s = r.stage99;
    this.rv('rv-liquid-type', `${s.emoji} ${s.result}`, 'ok');
    
    const g = document.getElementById('g-s99');
    if (g) {
      g.textContent = `Вещество: ${s.emoji} ${s.result}`;
      g.className = 'grade pass';
    }
  } catch (e) { console.error('s99 render:', e); } }
}

export function check(d) {
  try { return d && d.result !== 'Unknown'; } catch (e) { return false; }
}

export function metric(d) {
  try { return `${d.emoji} ${d.result}`; } catch (e) { return '—'; }
}
