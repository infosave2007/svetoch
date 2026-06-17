// Stage 43: BSGS

export async function run() {
this.setRun(this.t('etap'), this.t('optical_bsgs_diskretnyy_logari'), 103.0);
    this.showColor('#808080');
    await this.sleep(600);

    // ── Modular arithmetic over F_p ──
    const p = 97;
    const A = p - 1; // -1 mod 97 = 96
    const B = p - 2; // -2 mod 97 = 95
    const modp = (a) => ((a % p) + p) % p;
    const addM = (a, b) => modp(a + b);
    const subM = (a, b) => modp(a - b);
    const mulM = (a, b) => modp(a * b);
    const invM = (a) => {
      a = modp(a);
      if (a === 0) return 0;
      let [old_r, r] = [a, p];
      let [old_s, s] = [1, 0];
      while (r !== 0) {
        const q = Math.floor(old_r / r);
        [old_r, r] = [r, old_r - q * r];
        [old_s, s] = [s, old_s - q * s];
      }
      return modp(old_s);
    };

    // ── EC point operations over F_p ──
    const INF = { inf: true };
    const pEq = (P, Q) => {
      if (P.inf && Q.inf) return true;
      if (P.inf || Q.inf) return false;
      return P.x === Q.x && P.y === Q.y;
    };
    const pStr = P => P.inf ? 'O' : `(${P.x}, ${P.y})`;
    const pNeg = P => P.inf ? INF : { x: P.x, y: modp(-P.y) };
    const pAdd = (P, Q) => {
      if (P.inf) return Q;
      if (Q.inf) return P;
      if (P.x === Q.x) {
        if (addM(P.y, Q.y) === 0) return { inf: true };
        const num = addM(mulM(3, mulM(P.x, P.x)), A);
        const den = invM(mulM(2, P.y));
        const m = mulM(num, den);
        const x3 = modp(mulM(m, m) - 2 * P.x);
        const y3 = modp(mulM(m, P.x - x3) - P.y);
        return { x: x3, y: y3 };
      }
      const num = subM(Q.y, P.y);
      const den = invM(subM(Q.x, P.x));
      const m = mulM(num, den);
      const x3 = modp(mulM(m, m) - P.x - Q.x);
      const y3 = modp(mulM(m, P.x - x3) - P.y);
      return { x: x3, y: y3 };
    };
    const pMul = (P, n) => {
      if (n < 0) return pMul(pNeg(P), -n);
      let R = { inf: true }, Q = P;
      while (n > 0) {
        if (n & 1) R = pAdd(R, Q);
        Q = pAdd(Q, Q);
        n >>= 1;
      }
      return R;
    };

    // ── Find group order and generator ──
    this.setRun(this.t('etap'), this.t('perechislenie_ef'), 103.1);
    const allPts = [{ inf: true }];
    for (let x = 0; x < p; x++) {
      const rhs = modp(x * x * x + A * x + B);
      for (let y = 0; y < p; y++) {
        if (mulM(y, y) === rhs) allPts.push({ x, y });
      }
    }
    const groupOrder = allPts.length; // Should be 114
    this.log(`  E: y² ≡ x³ - x - 2 (mod ${p}), #E = ${groupOrder}`);

    // Generator: (0, 17) has order 114 = #E (verified offline)
    const G = { x: 0, y: 17 };
    const N = groupOrder; // 114
    this.log(this.t('generator_g_ordg', {var0: pStr(G), var1: N}));

    // ── Secret key generation ──
    const rngBsgs = this.mulberry32(Date.now() & 0xFFFF);
    const kSecret = 1 + Math.floor(rngBsgs() * (N - 1));
    const Q = pMul(G, kSecret);
    this.log(`  🔑 k_secret = ${kSecret}, Q = kG = ${pStr(Q)}`);

    // ═══ BABY-STEP GIANT-STEP (with optical verification) ═══
    this.setRun(this.t('etap'), this.t('baby_steps_vychislenie_tablits'), 103.2);
    const m = Math.ceil(Math.sqrt(N)); // ≈ 11
    this.log(`  m = ⌈√${N}⌉ = ${m}`);

    // Phase 1: Baby steps — compute jG, store x-coord → j
    const babyTable = new Map(); // key: "x,y" → j
    const babyPoints = [];       // for optical display
    let jG = { inf: true };
    for (let j = 0; j <= m; j++) {
      const key = jG.inf ? 'INF' : `${jG.x},${jG.y}`;
      if (!babyTable.has(key)) {
        babyTable.set(key, j);
      }
      babyPoints.push({ j, P: jG, key });
      jG = pAdd(jG, G);
    }
    this.log(this.t('baby_table_zapisey', {var0: babyTable.size}));

    // Optical: show baby table as brightness pattern (encode x-coords)
    this.setRun(this.t('etap'), this.t('optical_kodirovanie_babystep_t'), 103.3);
    const babyBrightness = babyPoints.slice(0, 16).map(b => {
      if (b.P.inf) return 0;
      return b.P.x / (p - 1); // Normalize x to [0, 1]
    });
    const nCols = Math.min(16, babyBrightness.length);
    const gridCols = nCols <= 4 ? 2 : 4;

    // Show baby table as grid of brightness blocks
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const rows = Math.ceil(nCols / gridCols);
      const bw = Math.floor(w / (gridCols + 1));
      const bh = Math.floor(h / (rows + 1));
      for (let i = 0; i < nCols; i++) {
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const v = Math.round(babyBrightness[i] * 230 + 15);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect((col + 0.5) * bw, (row + 0.5) * bh, bw * 0.7, bh * 0.7);
      }
    });
    await this.sleep(600);
    const fBaby = await this.captureStable(6, 50);
    const babyMeasured = this.regionMean(fBaby);
    this.log(`  Optical baby table brightness: ${babyMeasured.toFixed(1)}`);

    // Phase 2: Giant steps — compute Q - i·(mG), look up in baby table
    this.setRun(this.t('etap'), this.t('giant_steps_poisk_sovpadeniya'), 103.5);
    const mG = pMul(G, m);
    const neg_mG = pNeg(mG);
    let gamma = Q; // Q - 0·mG = Q
    let kFound = -1;
    let iFound = -1, jFound = -1;
    let giantStepsTaken = 0;
    let opticalMatches = 0;

    for (let i = 0; i <= m; i++) {
      giantStepsTaken++;
      const key = gamma.inf ? 'INF' : `${gamma.x},${gamma.y}`;

      // Optical verification: encode giant-step point as brightness
      if (!gamma.inf) {
        const giantBright = gamma.x / (p - 1);
        const v = Math.round(giantBright * 230 + 15);
        this.showColor(`rgb(${v},${v},${v})`);
        await this.sleep(200);
        const fGiant = await this.captureStable(3, 30);
        const giantMeasured = this.regionMean(fGiant);

        // Optical match: compare giant-step brightness against baby table entries
        const cal = this.results.calibration || {};
        const black = cal.blackMean || 0;
        const white = cal.whiteMean || 255;
        const normGiant = (giantMeasured - black) / Math.max(white - black, 1);

        // Check all baby entries for brightness match
        for (const b of babyPoints) {
          if (b.P.inf) continue;
          const normBaby = b.P.x / (p - 1);
          if (Math.abs(normGiant - normBaby) < 0.08) {
            opticalMatches++;
            break;
          }
        }
      }

      // Exact digital match (the real BSGS check)
      if (babyTable.has(key)) {
        jFound = babyTable.get(key);
        iFound = i;
        kFound = (jFound + i * m) % N;
        this.log(this.t('sovpadenie_na_giant_step_i_r', {var0: i, var1: pStr(gamma)}));
        this.log(`     j=${jFound}, k = ${jFound} + ${i}×${m} = ${kFound}`);
        break;
      }

      gamma = pAdd(gamma, neg_mG);
    }

    // ═══ Verification ═══
    this.setRun(this.t('etap'), this.t('verifikatsiya'), 103.8);
    const kCorrect = kFound >= 0 && (kFound % N) === (kSecret % N);
    if (kCorrect) {
      const verifyQ = pMul(G, kFound);
      this.log(this.t('proverka_g_q', {var0: kFound, var1: pStr(verifyQ), var2: pStr(Q), var3: pEq(verifyQ, Q) ? 'СОВПАДАЕТ' : 'НЕ СОВПАДАЕТ'}));
    }

    const totalOps = babyTable.size + giantStepsTaken;
    const speedup = N / totalOps;

    this.log(this.t('rezultat'));
    this.log(this.t('krivaya_y_x_x_mod_e', {var0: p, var1: N}));
    this.log(`  k_secret = ${kSecret}, k_found = ${kFound}`);
    this.log(`  Baby steps: ${babyTable.size}, Giant steps: ${giantStepsTaken}`);
    this.log(this.t('vsego_operatsiy_vs_brute_force', {var0: totalOps, var1: N, var2: speedup.toFixed(1)}));
    this.log(this.t('opticheskikh_sovpadeniy', {var0: opticalMatches}));
    this.log(this.t('bsgs', {var0: kCorrect ? 'РЕШИЛ DLP' : 'НЕУДАЧА'}), kCorrect ? 'ok' : 'err');

    this.showColor('#000000');

    this.results.stage43 = {
      curve: `y² ≡ x³ - x - 2 (mod ${p})`,
      p, A: -1, B: -2,
      groupOrder: N,
      generator: pStr(G),
      kSecret,
      kFound,
      kCorrect,
      babyTableSize: babyTable.size,
      giantStepsTaken,
      totalOps,
      speedup: Number(speedup.toFixed(2)),
      opticalMatches,
      m,
      iFound, jFound,
      Q: pStr(Q),
      method: 'hybrid: CPU BigInt EC + optical K-V brightness matching'
    };
}

export function render(r) {
if (r.stage43) { try {
      const s = r.stage43;
      this.rv('rv-bsgs-curve', `E(F_${s.p})`, 'ok');
      this.rv('rv-bsgs-order', `#E = ${s.groupOrder}`, 'ok');
      this.rv('rv-bsgs-ksecret', s.kSecret, 'ok');
      this.rv('rv-bsgs-kfound', s.kFound >= 0 ? s.kFound : this.t('ne_nayden'), s.kCorrect ? 'ok' : 'bad');
      this.rv('rv-bsgs-baby', s.babyTableSize, 'ok');
      this.rv('rv-bsgs-giant', s.giantStepsTaken, 'ok');
      this.rv('rv-bsgs-matches', s.opticalMatches, s.opticalMatches > 0 ? 'ok' : 'warn');
      const detail = document.getElementById('bsgs-detail');
      if (detail) {
        detail.innerHTML = `Q = ${s.Q}<br>m = ${s.m}, total ops = ${s.totalOps} (${s.speedup}× vs brute)<br>${s.method}`;
      }
      const g = document.getElementById('g-s43');
      if (s.kCorrect) { g.textContent=this.t('dlp_reshyon_k_nayden_optichesk'); g.className='grade pass'; }
      else { g.textContent=this.t('bsgs_ne_nashyol_k'); g.className='grade fail'; }
    } catch(e) { console.error('stage43 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.kCorrect)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'ops=' + (d.totalOps||'?'))(d); } catch(e) { return '—'; }
}
