// Stage 70: Optical Hamming Code — Error Correction through Physical Channel
//
// Hamming(7,4): encode 4 data bits → 7 bits with 3 parity bits
// Transmit through REAL optical channel (screen → mirror → camera)
// Channel noise (PSF, gamma, quantization) introduces real errors
// Decode and correct → demonstrate error correction in physics
//
// Educational: information theory, error-correcting codes,
// Shannon's theorem — the optical channel IS the noisy channel!

export async function run() {
  this.setRun(this.t('etap'), this.t('hamming_start'), 128.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};

  // Mirror-aware column reader
  const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true; // default assume mirror
  this.log(`  Mirror: ${isMirrored ? 'YES → reversing columns' : 'no'}`);

  const measureColumns = (frame, nCols) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = Math.floor(fh * 0.3), y1 = Math.floor(fh * 0.7);
    const width = x1 - x0;
    const colW = width / nCols;
    const values = [];
    for (let c = 0; c < nCols; c++) {
      // Read center 60% of each column to avoid PSF bleed
      const cx0 = x0 + Math.floor(c * colW) + Math.floor(colW * 0.2);
      const cx1 = x0 + Math.floor((c + 1) * colW) - Math.floor(colW * 0.2);
      let sum = 0, count = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = cx0; x < cx1; x++) {
          const i = (y * fw + x) * 4;
          sum += (d[i] + d[i + 1] + d[i + 2]) / 3; count++;
        }
      }
      values.push(count > 0 ? sum / count : 0);
    }
    // CRITICAL: mirror inverts left↔right, so reverse column order
    if (isMirrored) values.reverse();
    return values;
  };

  // ── Gamma calibration ──
  // Use extreme brightness difference for reliable bit detection
  const gamma = cal.gamma || 2.0;
  const V_ZERO = 10;  // near-black for bit 0
  const V_ONE  = 250; // near-white for bit 1

  // Calibrate threshold
  this.showColor(`rgb(${V_ZERO},${V_ZERO},${V_ZERO})`);
  await this.sleep(500);
  const fZ = await this.captureStable(8, 50);
  const zMean = measureColumns(fZ, 1)[0];
  
  this.showColor(`rgb(${V_ONE},${V_ONE},${V_ONE})`);
  await this.sleep(500);
  const fO = await this.captureStable(8, 50);
  const oMean = measureColumns(fO, 1)[0];
  
  const threshold = (zMean + oMean) / 2;
  this.log(`  cal: 0→${zMean.toFixed(1)}, 1→${oMean.toFixed(1)}, threshold=${threshold.toFixed(1)}`);

  // ── Hamming(7,4) encoding ──
  // Generator matrix G (4×7): data × G = codeword
  // d = [d1,d2,d3,d4] → c = [d1,d2,d3,d4,p1,p2,p3]
  // p1 = d1⊕d2⊕d4, p2 = d1⊕d3⊕d4, p3 = d2⊕d3⊕d4
  const encode = (d) => {
    const p1 = d[0] ^ d[1] ^ d[3];
    const p2 = d[0] ^ d[2] ^ d[3];
    const p3 = d[1] ^ d[2] ^ d[3];
    return [...d, p1, p2, p3];
  };

  // Syndrome decoding
  // H = parity check matrix, syndrome s = H × r^T
  // s = [s1,s2,s3] identifies error position (0=no error)
  const decode = (r) => {
    const s1 = r[0] ^ r[1] ^ r[3] ^ r[4]; // check p1
    const s2 = r[0] ^ r[2] ^ r[3] ^ r[5]; // check p2
    const s3 = r[1] ^ r[2] ^ r[3] ^ r[6]; // check p3
    const syndrome = s1 + 2 * s2 + 4 * s3;
    const errorPos = [0, 4, 5, 0, 6, 1, 2, 3]; // syndrome → position map
    const corrected = [...r];
    if (syndrome > 0 && syndrome < 8) {
      const pos = errorPos[syndrome];
      corrected[pos] ^= 1;
    }
    return { data: corrected.slice(0, 4), syndrome, corrected };
  };

  // ── Transmit through optical channel ──
  this.setRun(this.t('etap'), this.t('hamming_transmit'), 128.2);
  this.log('━━━ OPTICAL HAMMING(7,4) CHANNEL ━━━');

  // All 16 possible 4-bit messages
  const messages = [];
  for (let i = 0; i < 16; i++) {
    messages.push([(i >> 3) & 1, (i >> 2) & 1, (i >> 1) & 1, i & 1]);
  }

  let totalBits = 0, rawErrors = 0, correctedErrors = 0;
  const transmissions = [];

  for (let mi = 0; mi < messages.length; mi++) {
    const msg = messages[mi];
    const codeword = encode(msg);
    this.setRun(this.t('etap'), `TX: ${msg.join('')}...`, 128.2 + mi * 0.03);

    // Display: 1 guard + 7 data + 1 guard = 9 columns
    // Guards are mid-gray to prevent PSF bleed from screen edges
    const V_GUARD = Math.round((V_ZERO + V_ONE) / 2);
    const N_DISPLAY = 9; // 1 guard + 7 data + 1 guard
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = `rgb(${V_GUARD},${V_GUARD},${V_GUARD})`;
      ctx.fillRect(0, 0, w, h);
      const colW = w / N_DISPLAY;
      // Guard columns 0 and 8 already filled with guard color
      for (let i = 0; i < 7; i++) {
        const v = codeword[i] ? V_ONE : V_ZERO;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        // Data columns are at positions 1..7 (skip guard 0)
        ctx.fillRect(Math.floor((i + 1) * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(400);
    const frame = await this.captureStable(8, 50);
    // Read 9 columns, take center 7 (skip guards)
    const allCols = measureColumns(frame, N_DISPLAY);
    const colValues = allCols.slice(1, 8); // skip guard columns

    // Threshold decode
    const received = colValues.map(v => v > threshold ? 1 : 0);
    const rawBitErrors = codeword.reduce((s, b, i) => s + (b !== received[i] ? 1 : 0), 0);
    rawErrors += rawBitErrors;

    // Hamming decode + error correction
    const { data: decoded, syndrome } = decode(received);
    const dataErrors = msg.reduce((s, b, i) => s + (b !== decoded[i] ? 1 : 0), 0);
    correctedErrors += dataErrors;
    totalBits += 4;

    transmissions.push({
      msg: msg.join(''), codeword: codeword.join(''),
      received: received.join(''), decoded: decoded.join(''),
      rawBitErrors, dataErrors, syndrome
    });

    if (mi < 4 || rawBitErrors > 0) {
      this.log(`  TX=${msg.join('')} → code=${codeword.join('')} → RX=${received.join('')} → dec=${decoded.join('')}${dataErrors === 0 ? ' ✓' : ' ✗'}`);
    }
  }

  this.showColor('#000');

  const rawBER = rawErrors / (totalBits / 4 * 7);
  const correctedBER = correctedErrors / totalBits;
  const allDecoded = correctedErrors === 0;

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  Transmitted: ${messages.length} messages (${totalBits} data bits)`);
  this.log(`  Raw channel BER: ${(rawBER * 100).toFixed(1)}% (${rawErrors}/${messages.length * 7} bits)`);
  this.log(`  After Hamming correction: ${(correctedBER * 100).toFixed(1)}% (${correctedErrors}/${totalBits} data bits)`);
  this.log(`  Error correction: ${allDecoded ? '✓ ALL recovered' : `${correctedErrors} uncorrectable`}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage70 = {
    method: 'Hamming(7,4) through optical channel',
    totalMessages: messages.length, totalDataBits: totalBits,
    rawBER: +(rawBER * 100).toFixed(2),
    correctedBER: +(correctedBER * 100).toFixed(2),
    rawErrors, correctedErrors, allDecoded,
    transmissions: transmissions.slice(0, 8)
  };
}

export function render(r) {
  if (r.stage70) { try {
    const s = r.stage70;
    this.rv('rv-ham-raw', `Raw BER=${s.rawBER}%`, s.rawBER < 20 ? 'ok' : 'warn');
    this.rv('rv-ham-ecc', `After ECC=${s.correctedBER}%`, s.correctedBER < 5 ? 'ok' : 'warn');
    const g = document.getElementById('g-s70');
    if (g) { g.textContent = s.allDecoded ? '✅ Hamming ECC ✓' : `⚠️ ${s.correctedErrors} err`; g.className = 'grade ' + (s.allDecoded ? 'pass' : 'partial'); }
  } catch(e) { console.error('s70:', e); } }
}

export function check(d) { try { return d && d.correctedBER < 10; } catch(e) { return false; } }
export function metric(d) { try { return `BER=${d.correctedBER}%`; } catch(e) { return '—'; } }
