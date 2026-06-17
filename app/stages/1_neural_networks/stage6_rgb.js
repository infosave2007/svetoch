// Stage 6: RGB

export async function run() {
this.setRun(this.t('etap'), 'RGB Multi-Head Attention...', 93);
    this.showColor('#808080');
    await this.sleep(800);

    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;

    // Reference white for each channel
    this.showColor('#ffffff');
    await this.sleep(800);
    const refFrame = await this.captureStable(6, 60);
    const refRGB = this.regionMeanRGB(refFrame);
    this.showColor('#808080'); await this.sleep(600);

    // Test pure RED
    this.setRun(this.t('etap'), this.t('krasnyy_kanal'), 94);
    this.showColor('#ff0000');
    await this.sleep(800);
    const rFrame = await this.captureStable(8, 60);
    const rRGB = this.regionMeanRGB(rFrame);
    this.showColor('#808080'); await this.sleep(600);

    // Test pure GREEN
    this.setRun(this.t('etap'), this.t('zelyonyy_kanal'), 95);
    this.showColor('#00ff00');
    await this.sleep(800);
    const gFrame = await this.captureStable(8, 60);
    const gRGB = this.regionMeanRGB(gFrame);
    this.showColor('#808080'); await this.sleep(600);

    // Test pure BLUE
    this.setRun(this.t('etap'), this.t('siniy_kanal'), 96);
    this.showColor('#0000ff');
    await this.sleep(800);
    const bFrame = await this.captureStable(8, 60);
    const bRGB = this.regionMeanRGB(bFrame);
    this.showColor('#808080'); await this.sleep(600);

    // Compute isolation matrix: 3×3 (R_in→R/G/B_cam, G_in→R/G/B_cam, B_in→R/G/B_cam)
    // Normalize by white reference
    const normR = [rRGB[0]/Math.max(refRGB[0],1), rRGB[1]/Math.max(refRGB[1],1), rRGB[2]/Math.max(refRGB[2],1)];
    const normG = [gRGB[0]/Math.max(refRGB[0],1), gRGB[1]/Math.max(refRGB[1],1), gRGB[2]/Math.max(refRGB[2],1)];
    const normB = [bRGB[0]/Math.max(refRGB[0],1), bRGB[1]/Math.max(refRGB[1],1), bRGB[2]/Math.max(refRGB[2],1)];

    // Isolation for each channel: ratio of target channel to sum of cross channels
    // R isolation: R_cam(when R_OLED) vs (G_cam+B_cam when R_OLED)
    const rIso = normR[0] / Math.max(normR[1] + normR[2], 0.001);
    const gIso = normG[1] / Math.max(normG[0] + normG[2], 0.001);
    const bIso = normB[2] / Math.max(normB[0] + normB[1], 0.001);

    // Convert to dB
    const rIsoDB = 10 * Math.log10(Math.max(rIso, 0.001));
    const gIsoDB = 10 * Math.log10(Math.max(gIso, 0.001));
    const bIsoDB = 10 * Math.log10(Math.max(bIso, 0.001));
    const avgIsoDB = (rIsoDB + gIsoDB + bIsoDB) / 3;

    this.log(this.t('rgb_izolyatsiya_rdb_gdb_bdb', {var0: rIsoDB.toFixed(1), var1: gIsoDB.toFixed(1), var2: bIsoDB.toFixed(1)}));
    this.log(this.t('srednyaya_db', {var0: avgIsoDB.toFixed(1)}), avgIsoDB > 3 ? 'ok' : 'warn');

    this.results.stage6 = {
      rIsolationDB: rIsoDB, gIsolationDB: gIsoDB, bIsolationDB: bIsoDB,
      avgIsolationDB: avgIsoDB,
      matrix: [normR, normG, normB],
      rawR: rRGB, rawG: gRGB, rawB: bRGB, refRGB
    };
}

export function render(r) {
if (r.stage6) { try {
      const s = r.stage6;
      this.rv('rv-r-iso', s.rIsolationDB.toFixed(1)+this.t('db'), s.rIsolationDB>3?'ok':s.rIsolationDB>0?'warn':'bad');
      this.rv('rv-g-iso', s.gIsolationDB.toFixed(1)+this.t('db'), s.gIsolationDB>3?'ok':s.gIsolationDB>0?'warn':'bad');
      this.rv('rv-b-iso', s.bIsolationDB.toFixed(1)+this.t('db'), s.bIsolationDB>3?'ok':s.bIsolationDB>0?'warn':'bad');
      this.rv('rv-avg-iso', s.avgIsolationDB.toFixed(1)+this.t('db'), s.avgIsolationDB>3?'ok':s.avgIsolationDB>0?'warn':'bad');
      const g = document.getElementById('g-s6');
      if (s.avgIsolationDB > 3) { g.textContent=this.t('rgbgolovy_izolirovany'); g.className='grade pass'; }
      else if (s.avgIsolationDB > 0) { g.textContent=this.t('chastichnaya_izolyatsiya'); g.className='grade partial'; }
      else { g.textContent=this.t('kanaly_smeshivayutsya'); g.className='grade fail'; }
      this.drawRGBChart(s);
    } catch(e) { console.error('stage6 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.avgIsolationDB > 0)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.avgIsolationDB||0).toFixed(1) + 'dB')(d); } catch(e) { return '—'; }
}
