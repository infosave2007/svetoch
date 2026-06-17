// Stage 61: TxtC

export async function run() {
this.setRun(this.t('etap'), this.t('lzss_bounce_szhatie_teksta'), 121.0);
    this.showColor('#808080');
    await this.sleep(600);

    // Prefix-free compress/decompress
    const compressPass = (bits) => {
      const out = [];
      for (let i = 0; i + 1 < bits.length; i += 2) {
        const b0 = bits[i], b1 = bits[i+1];
        if (b0 === 0 && b1 === 0) out.push(0);
        else if (b0 === 0 && b1 === 1) out.push(1, 0);
        else if (b0 === 1 && b1 === 0) out.push(1, 1, 0);
        else out.push(1, 1, 1);
      }
      if (bits.length % 2 === 1) out.push(bits[bits.length - 1]);
      return out;
    };
    const decompressPass = (bits) => {
      const out = []; let i = 0;
      while (i < bits.length) {
        if (bits[i] === 0) { out.push(0, 0); i++; }
        else if (i+1 < bits.length && bits[i+1] === 0) { out.push(0, 1); i += 2; }
        else if (i+2 < bits.length && bits[i+1] === 1 && bits[i+2] === 0) { out.push(1, 0); i += 3; }
        else if (i+2 < bits.length && bits[i+1] === 1 && bits[i+2] === 1) { out.push(1, 1); i += 3; }
        else { out.push(bits[i]); i++; }
      }
      return out;
    };

    // LZSS compress (sliding window with grouped flags)
    const lzCompress = (data) => {
      const out = []; const WIN = 255, MIN = 3, MAX = 18;
      let i = 0;
      while (i < data.length) {
        let flag = 0; const items = [];
        for (let b = 0; b < 8 && i < data.length; b++) {
          let bestLen = 0, bestDist = 0;
          for (let j = Math.max(0, i - WIN); j < i; j++) {
            let l = 0;
            while (i + l < data.length && data[j + l] === data[i + l] && l < MAX) l++;
            if (l > bestLen) { bestLen = l; bestDist = i - j; }
          }
          if (bestLen >= MIN) {
            flag |= (1 << b); items.push(bestDist, bestLen - MIN); i += bestLen;
          } else { items.push(data[i]); i++; }
        }
        out.push(flag, ...items);
      }
      return out;
    };
    const lzDecompress = (data) => {
      const out = []; let i = 0;
      while (i < data.length) {
        const flag = data[i++];
        for (let b = 0; b < 8 && i < data.length; b++) {
          if (flag & (1 << b)) {
            const d = data[i++], l = data[i++] + 3;
            const s = out.length - d;
            for (let j = 0; j < l; j++) out.push(out[s + j]);
          } else { out.push(data[i++]); }
        }
      }
      return out;
    };

    // Helpers
    const textToBytes = (t) => Array.from(new TextEncoder().encode(t));
    const bytesToText = (b) => new TextDecoder().decode(new Uint8Array(b));
    const bytesToBits = (bytes) => {
      const bits = [];
      for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
      return bits;
    };
    const bitsToBytes = (bits) => {
      const bytes = [];
      for (let i = 0; i + 7 < bits.length; i += 8) {
        let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
        bytes.push(b);
      }
      return bytes;
    };
    const deltaEncode = (b) => { const o = [b[0]]; for (let i = 1; i < b.length; i++) o.push(b[i] ^ b[i-1]); return o; };
    const deltaDecode = (b) => { const o = [b[0]]; for (let i = 1; i < b.length; i++) o.push(b[i] ^ o[i-1]); return o; };

    // Iterative bounce compress/decompress
    const bounceCompress = (bits) => {
      const oL = []; let cur = [...bits];
      for (let p = 0; p < 10; p++) {
        if (cur.length <= 1) break;
        const c = compressPass(cur);
        if (c.length >= cur.length) break;
        oL.push(cur.length); cur = c;
      }
      return { bits: cur, oL };
    };
    const bounceDecompress = (bits, oL) => {
      let cur = [...bits];
      for (let i = oL.length - 1; i >= 0; i--) { cur = decompressPass(cur); cur = cur.slice(0, oL[i]); }
      return cur;
    };

    // Full adaptive compress: try 4 methods, pick best
    const fullCompress = (text) => {
      const bytes = textToBytes(text);
      const origBits = bytes.length * 8;
      const lz = lzCompress(bytes);
      const methods = [
        { name: 'raw', pre: bytes, useLZ: false, useDelta: false },
        { name: 'delta', pre: deltaEncode(bytes), useLZ: false, useDelta: true },
        { name: 'lz+delta', pre: deltaEncode(lz), useLZ: true, useDelta: true },
        { name: 'lz', pre: lz, useLZ: true, useDelta: false },
      ];
      const results = methods.map(m => {
        const r = bounceCompress(bytesToBits(m.pre));
        return { ...m, compBits: r.bits, oL: r.oL, len: r.bits.length };
      });
      const best = results.reduce((a, b) => a.len < b.len ? a : b);
      // Verify
      let dec = bitsToBytes(bounceDecompress(best.compBits, best.oL));
      if (best.useDelta) dec = deltaDecode(dec);
      if (best.useLZ) dec = lzDecompress(dec);
      const ok = bytesToText(dec) === text;
      return { origBits, best, ratio: origBits / Math.max(best.len, 1), ok,
        allRatios: results.map(r => ({ name: r.name, ratio: origBits / Math.max(r.len, 1) })) };
    };

    // Test texts — diverse real-world content
    const texts = [
      { name: this.t('povtory'), text: 'Hello World! Hello World! Hello World! Hello World!' },
      { name: this.t('proza'), text: 'The quick brown fox jumps over the lazy dog. NVG bounce compression.' },
      { name: this.t('kod'), text: 'function f(x) { return x * x; } function g(x) { return x + x; }' },
      { name: 'XML', text: '<item id="1">Hello</item><item id="2">World</item><item id="3">Test</item>' },
      { name: this.t('logi'), text: '2026-01-01 INFO Start\n2026-01-01 INFO Load\n2026-01-01 INFO Ready\n2026-01-01 INFO Done' },
      { name: this.t('dnk'), text: 'ATCGATCGATCGATCGATCGATCGATCGATCGATCG' },
    ];

    const allResults = [];
    for (const tc of texts) {
      const r = fullCompress(tc.text);
      this.log(`  "${tc.text.slice(0, 30)}${tc.text.length > 30 ? '...' : ''}"`);
      this.log(`    ${r.allRatios.map(a => a.name + '=' + a.ratio.toFixed(2) + '×').join(', ')}`);
      this.log(`    BEST: ${r.best.name} ${r.origBits}→${r.best.len}b = ${r.ratio.toFixed(2)}× ${r.ok ? '✓' : '✗'}`);
      allResults.push({ name: tc.name, text: tc.text, origBits: r.origBits,
        compBits: r.best.len, ratio: Number(r.ratio.toFixed(2)),
        method: r.best.name, ok: r.ok });
    }

    // Optical demo with best-compressing text
    const bestResult = allResults.reduce((a, b) => a.ratio > b.ratio ? a : b);
    const demoR = fullCompress(bestResult.text);
    this.log(this.t('n_opticheskaya_verifikatsiya', {var0: bestResult.text.slice(0, 25)}));

    // Read original bits chunked
    const origBitsArr = bytesToBits(demoR.best.useLZ ?
      (demoR.best.useDelta ? deltaEncode(lzCompress(textToBytes(bestResult.text))) : lzCompress(textToBytes(bestResult.text))) :
      (demoR.best.useDelta ? deltaEncode(textToBytes(bestResult.text)) : textToBytes(bestResult.text)));
    const showBits = origBitsArr.slice(0, 64);
    this.log(this.t('vkhod_b', {var0: showBits.join(''), var1: showBits.length}));
    const optIn = await this.readBitsChunked(showBits, 16, 3);
    const inOK = showBits.reduce((s, b, i) => s + (optIn[i] === b ? 1 : 0), 0);
    this.log(this.t('kamera_bit', {var0: inOK, var1: showBits.length, var2: (inOK/showBits.length*100).toFixed(1), var3: inOK === showBits.length ? '✓' : '~'}));

    // Read compressed bits chunked
    const showComp = demoR.best.compBits.slice(0, Math.min(demoR.best.compBits.length, 64));
    if (showComp.length >= 4) {
      this.log(this.t('szhatoe_b', {var0: showComp.join(''), var1: showComp.length}));
      const optOut = await this.readBitsChunked(showComp, 16, 3);
      const outOK = showComp.reduce((s, b, i) => s + (optOut[i] === b ? 1 : 0), 0);
      this.log(this.t('kamera_szh_bit', {var0: outOK, var1: showComp.length, var2: (outOK/showComp.length*100).toFixed(1), var3: outOK === showComp.length ? '✓' : '~'}));
    }

    const allOK = allResults.every(r => r.ok);
    const pass = allOK && bestResult.ratio > 1.3;

    this.log(this.t('tekstovoe_szhatie_lzssbounce'));
    for (const r of allResults) {
      this.log(`  ${r.name}: ${r.origBits}→${r.compBits}b = ${r.ratio}× (${r.method}) ${r.ok ? '✓' : '✗'}`);
    }
    this.log(this.t('vse_lossless', {var0: allOK ? 'ДА' : 'НЕТ'}));
    this.log(this.t('tekstovoe_szhatie', {var0: pass ? 'РАБОТАЕТ!' : 'частично'}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage61 = {
      texts: allResults, bestRatio: bestResult.ratio,
      bestText: bestResult.text.slice(0, 30), bestMethod: bestResult.method,
      allLossless: allOK, pass
    };
}

export function render(r) {
if (r.stage61) { try {
      const s = r.stage61;
      const g = document.getElementById('g-s61');
      if (s.pass) { g.textContent=this.t('tekst', {var0: (s.bestText||'').slice(0,12), var1: s.bestRatio}); g.className='grade pass'; }
      else { g.textContent=this.t('tekst_1', {var0: s.bestRatio}); g.className='grade partial'; }
    } catch(e) { console.error('stage61 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.bestRatio||0).toFixed(1) + '×')(d); } catch(e) { return '—'; }
}
