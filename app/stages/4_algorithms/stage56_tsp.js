// Stage 56: TSP

export async function run() {
this.setRun(this.t('etap'), this.t('tsp_gorodov'), 116.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};

    // Permutation generator
    const permutations = (arr) => {
      if (arr.length <= 1) return [arr];
      const result = [];
      for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const p of permutations(rest)) result.push([arr[i], ...p]);
      }
      return result;
    };

    // Distance matrices for different city counts
    const configs = [
      {
        n: 4, label: this.t('goroda'),
        cities: ['A','B','C','D'],
        dist: [
          [0, 10, 15, 20],
          [10, 0, 35, 25],
          [15, 35, 0, 30],
          [20, 25, 30, 0],
        ]
      },
      {
        n: 5, label: this.t('gorodov'),
        cities: ['A','B','C','D','E'],
        dist: [
          [0, 10, 15, 20, 25],
          [10, 0, 35, 25, 30],
          [15, 35, 0, 30, 20],
          [20, 25, 30, 0, 18],
          [25, 30, 20, 18, 0],
        ]
      },
      {
        n: 6, label: this.t('gorodov_1'),
        cities: ['A','B','C','D','E','F'],
        dist: [
          [0, 10, 15, 20, 25, 12],
          [10, 0, 35, 25, 30, 22],
          [15, 35, 0, 30, 20, 28],
          [20, 25, 30, 0, 18, 14],
          [25, 30, 20, 18, 0, 24],
          [12, 22, 28, 14, 24, 0],
        ]
      }
    ];

    const allResults = [];
    let maxSolved = 0;

    for (const cfg of configs) {
      const { n, label, cities, dist } = cfg;
      this.setRun(this.t('etap'), `TSP ${label}...`, 116.0 + (n-4) * 0.3);
      this.log(`\n  ── TSP ${label} ──`);

      // Generate all routes (fix start at city 0, permute rest)
      const restIndices = Array.from({length: n-1}, (_, i) => i + 1);
      const perms = permutations(restIndices);

      // Remove reverse duplicates for efficiency
      const seen = new Set();
      const uniquePerms = [];
      for (const p of perms) {
        const key = p.join(',');
        const revKey = [...p].reverse().join(',');
        if (!seen.has(key) && !seen.has(revKey)) {
          seen.add(key);
          uniquePerms.push(p);
        }
      }

      const routes = uniquePerms.map(p => {
        const path = [0, ...p, 0];
        let cost = 0;
        for (let i = 0; i < path.length - 1; i++) cost += dist[path[i]][path[i+1]];
        return { path, cost, label: path.map(i => cities[i]).join('→') };
      });

      const nRoutes = routes.length;
      this.log(this.t('marshrutov_unikalnykh', {var0: nRoutes}));

      // Check if we have enough screen resolution
      const screenW = (cal.x1 || 1050) - (cal.x0 || 0);
      const pxPerBin = Math.floor(screenW / nRoutes);
      if (pxPerBin < 10) {
        this.log(this.t('propusk_pxbin_slishkom_malo', {var0: pxPerBin}), 'warn');
        allResults.push({ n, nRoutes, match: false, skipped: true });
        continue;
      }

      // Classical optimal
      const classicalBest = routes.reduce((a, b) => a.cost < b.cost ? a : b);
      this.log(this.t('klassicheskiy_optimum', {var0: classicalBest.label, var1: classicalBest.cost}));

      // Optical: encode costs as brightness
      const maxCost = Math.max(...routes.map(r => r.cost));
      const costNorm = routes.map(r => 1 - r.cost / (maxCost * 1.2));

      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const binW = Math.floor(w / nRoutes);
        for (let i = 0; i < nRoutes; i++) {
          const v = Math.round(costNorm[i] * 220);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(i * binW + 1, 0, binW - 2, h);
        }
      });
      await this.sleep(600);
      const frame = await this.captureStable(8, 50);
      const bins = this.measureNBins(frame, nRoutes);

      // Find brightest bin
      let maxBin = 0, maxVal = 0;
      for (let i = 0; i < bins.length; i++) {
        if (bins[i] > maxVal) { maxVal = bins[i]; maxBin = i; }
      }

      const opticalBest = routes[maxBin];
      const match = opticalBest.cost === classicalBest.cost;

      this.log(this.t('opticheskiy', {var0: opticalBest.label, var1: opticalBest.cost, var2: match ? '✓' : '✗'}));
      if (match) maxSolved = n;

      allResults.push({ n, nRoutes, pxPerBin,
        classical: { route: classicalBest.label, cost: classicalBest.cost },
        optical: { route: opticalBest.label, cost: opticalBest.cost },
        match
      });

      this.showColor('#808080'); await this.sleep(200);
    }

    // Summary
    this.log(this.t('tsp_progressivnyy'));
    for (const r of allResults) {
      if (r.skipped) this.log(this.t('gorodov_propushcheno_marshruto', {var0: r.n, var1: r.nRoutes}));
      else this.log(this.t('gorodov_marshrutov_pxbin', {var0: r.n, var1: r.nRoutes, var2: r.pxPerBin, var3: r.match ? '✓' : '✗'}));
    }
    const pass = maxSolved >= 4;
    this.log(this.t('tsp_maksimum_gorodov', {var0: maxSolved}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage56 = {
      maxSolved,
      results: allResults,
      pass
    };
}

export function render(r) {
if (r.stage56) { try {
      const s = r.stage56;
      const g = document.getElementById('g-s56');
      if (s.pass) { g.textContent=this.t('tsp_maksimum_gorodov_1', {var0: s.maxSolved}); g.className='grade pass'; }
      else { g.textContent=this.t('tsp_maksimum', {var0: s.maxSolved}); g.className='grade partial'; }
    } catch(e) { console.error('stage56 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'opt=' + (d.opticalBest?.cost||'?'))(d); } catch(e) { return '—'; }
}
