/*
 * DJ INSANITY intro: Stardust (ported from public/intros/option-2-stardust.html; drawing code and glyph data unchanged).
 * The pen sheds thousands of points that settle into grooves, pour out into a wave sheet and condense into the letters.
 * One time value drives every pixel:  play(container, { onComplete, speed, reducedMotion })  ->  { skip, destroy, duration }
 */
// ---------------------------------------------------------------- utils
var TAU = Math.PI * 2;
function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function lerp(a, b, t) { return a + (b - a) * t; }
/** progress of t through [a,b], clamped 0..1 */
function seg(t, a, b) { return c01((t - a) / (b - a)); }
var E = {
  in2: function (x) { return x * x; },
  out2: function (x) { return 1 - (1 - x) * (1 - x); },
  in3: function (x) { return x * x * x; },
  out3: function (x) { return 1 - Math.pow(1 - x, 3); },
  inOut3: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  out5: function (x) { return 1 - Math.pow(1 - x, 5); },
  inOut5: function (x) { return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2; },
  outExpo: function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
  inOutSine: function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; },
  smooth: function (x) { return x * x * (3 - 2 * x); },
  outBack: function (x) { var c = 1.35; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
};
/** deterministic PRNG (mulberry32) so every run is identical */
function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- title glyphs
// Outlines of "DJ INSANITY" in Inter Black (900), traced once and embedded so the
// intro has no font dependency at runtime. Units: 1/4000 em, origin on the baseline, y down.
var G = {"unit":4000,"text":"DJ INSANITY","pos":[0,2891,5273,6070,7234,10313,12977,16043,19121,20285,23031],"total":26133,"cap":2910,"glyphs":{"D":[[[183,-2910],[190,-2915],[1390,-2914],[1530,-2903],[1710,-2873],[1820,-2843],[1910,-2812],[1980,-2783],[2060,-2744],[2150,-2692],[2220,-2644],[2310,-2571],[2383,-2500],[2452,-2420],[2524,-2320],[2572,-2240],[2612,-2160],[2653,-2060],[2682,-1970],[2703,-1890],[2717,-1810],[2723,-1790],[2743,-1620],[2748,-1450],[2743,-1290],[2724,-1130],[2704,-1030],[2687,-970],[2683,-950],[2654,-860],[2613,-760],[2586,-710],[2573,-680],[2544,-630],[2462,-510],[2422,-460],[2360,-394],[2300,-337],[2250,-297],[2210,-266],[2120,-208],[2070,-179],[1960,-127],[1910,-107],[1820,-76],[1710,-47],[1610,-28],[1510,-16],[1310,-5],[190,-5],[183,-10]],[[975,-2240],[980,-2243],[1250,-2243],[1390,-2234],[1470,-2223],[1550,-2204],[1610,-2184],[1640,-2173],[1710,-2133],[1770,-2083],[1824,-2020],[1854,-1970],[1884,-1910],[1903,-1860],[1924,-1790],[1943,-1680],[1953,-1580],[1955,-1460],[1953,-1340],[1944,-1240],[1933,-1170],[1912,-1080],[1892,-1020],[1874,-980],[1834,-910],[1803,-870],[1767,-830],[1740,-807],[1700,-777],[1650,-749],[1570,-717],[1530,-707],[1480,-695],[1370,-680],[1270,-677],[980,-677],[975,-680],[972,-690],[972,-2230]]],"J":[[[1414,-2910],[1420,-2915],[2180,-2915],[2191,-2910],[2190,-920],[2183,-780],[2173,-700],[2167,-680],[2154,-610],[2124,-520],[2085,-430],[2044,-360],[1983,-280],[1920,-215],[1850,-157],[1770,-106],[1690,-66],[1590,-28],[1510,-6],[1370,21],[1240,32],[1140,35],[1030,31],[940,23],[870,13],[760,-7],[690,-26],[580,-67],[500,-106],[420,-157],[354,-210],[290,-273],[227,-350],[180,-430],[147,-500],[116,-590],[96,-670],[87,-720],[76,-810],[74,-1090],[80,-1097],[850,-1097],[860,-1094],[863,-1090],[863,-900],[866,-830],[877,-770],[887,-740],[906,-700],[935,-660],[970,-628],[1030,-595],[1070,-586],[1140,-580],[1200,-585],[1250,-596],[1270,-606],[1308,-630],[1343,-660],[1371,-700],[1393,-750],[1404,-800],[1414,-900]]],"I":[[[183,-2910],[190,-2915],[960,-2915],[972,-2910],[972,-10],[970,-8],[960,-5],[190,-5],[183,-10]]],"N":[[[183,-2910],[190,-2915],[1030,-2915],[1040,-2915],[1045,-2910],[1456,-2230],[1483,-2190],[1487,-2180],[1513,-2140],[1517,-2130],[1544,-2090],[1657,-1900],[1713,-1810],[1814,-1640],[1901,-1480],[1985,-1310],[2062,-1130],[2110,-1004],[2115,-1010],[2116,-1020],[2114,-1070],[2097,-1300],[2075,-1700],[2074,-2910],[2080,-2915],[2880,-2915],[2885,-2910],[2885,-10],[2880,-5],[2030,-5],[2024,-10],[1377,-1070],[1267,-1260],[1196,-1390],[1105,-1570],[1026,-1740],[960,-1892],[956,-1890],[953,-1880],[956,-1820],[973,-1590],[994,-1190],[995,-10],[990,-5],[190,-5],[183,-10]]],"S":[[[1245,-2950],[1360,-2955],[1460,-2953],[1580,-2942],[1750,-2913],[1850,-2884],[1910,-2862],[2030,-2805],[2100,-2764],[2170,-2714],[2250,-2645],[2292,-2600],[2362,-2510],[2393,-2460],[2414,-2420],[2453,-2330],[2472,-2270],[2494,-2170],[2505,-2070],[2506,-2010],[2500,-2005],[1760,-2005],[1750,-2007],[1747,-2010],[1743,-2050],[1733,-2090],[1714,-2140],[1681,-2190],[1650,-2222],[1600,-2254],[1560,-2273],[1530,-2284],[1440,-2301],[1360,-2305],[1300,-2303],[1210,-2292],[1150,-2274],[1120,-2261],[1090,-2242],[1070,-2226],[1039,-2190],[1018,-2150],[1008,-2110],[1006,-2080],[1009,-2050],[1016,-2020],[1028,-1990],[1048,-1960],[1080,-1928],[1110,-1906],[1160,-1879],[1190,-1866],[1270,-1838],[1340,-1817],[1650,-1752],[1770,-1724],[1870,-1693],[1950,-1663],[2020,-1633],[2120,-1583],[2200,-1534],[2280,-1473],[2330,-1426],[2364,-1390],[2382,-1370],[2432,-1300],[2465,-1240],[2494,-1170],[2514,-1110],[2524,-1070],[2534,-1020],[2537,-980],[2543,-950],[2545,-860],[2543,-780],[2533,-700],[2523,-650],[2505,-580],[2494,-550],[2464,-480],[2433,-420],[2413,-390],[2384,-350],[2342,-300],[2300,-258],[2240,-207],[2150,-147],[2050,-95],[2010,-77],[1980,-66],[1860,-26],[1740,-2],[1720,3],[1550,25],[1370,30],[1190,24],[1080,14],[1010,3],[840,-36],[720,-76],[630,-116],[570,-147],[520,-179],[440,-238],[350,-324],[318,-360],[287,-400],[228,-490],[187,-580],[168,-630],[147,-700],[128,-790],[116,-870],[108,-1020],[120,-1027],[850,-1027],[858,-1020],[866,-960],[877,-910],[887,-880],[916,-820],[936,-790],[962,-760],[993,-730],[1020,-708],[1090,-666],[1140,-648],[1220,-628],[1290,-620],[1360,-617],[1410,-620],[1470,-627],[1560,-647],[1610,-669],[1640,-686],[1680,-718],[1713,-760],[1723,-780],[1734,-810],[1741,-860],[1733,-920],[1714,-960],[1681,-1000],[1640,-1032],[1600,-1055],[1560,-1074],[1440,-1113],[1270,-1153],[960,-1218],[820,-1258],[740,-1286],[670,-1316],[590,-1356],[480,-1426],[402,-1490],[360,-1531],[327,-1570],[297,-1610],[266,-1660],[263,-1670],[238,-1720],[217,-1780],[197,-1860],[185,-1950],[183,-2030],[185,-2100],[197,-2200],[216,-2280],[237,-2340],[268,-2410],[296,-2460],[336,-2520],[377,-2570],[420,-2616],[480,-2673],[560,-2734],[640,-2784],[760,-2843],[860,-2883],[1020,-2924],[1160,-2944]]],"A":[[[1026,-2910],[1030,-2914],[1040,-2915],[2100,-2915],[2107,-2910],[3084,-10],[3080,-6],[2200,-5],[2190,-8],[2034,-530],[2023,-560],[2020,-563],[2010,-563],[1130,-563],[1127,-560],[1117,-530],[973,-20],[968,-10],[960,-5],[100,-5],[90,-6],[86,-10]],[[1560,-2260],[1564,-2250],[1574,-2210],[1646,-1900],[1746,-1510],[1843,-1170],[1845,-1160],[1840,-1153],[1310,-1153],[1300,-1154],[1296,-1160],[1342,-1320],[1393,-1520],[1463,-1820],[1547,-2220]]],"T":[[[105,-2910],[110,-2915],[2620,-2915],[2633,-2910],[2633,-2290],[2630,-2280],[2620,-2277],[1770,-2277],[1763,-2270],[1763,-10],[1760,-7],[980,-5],[974,-10],[974,-2270],[970,-2275],[960,-2277],[110,-2277],[106,-2280],[105,-2290]]],"Y":[[[87,-2910],[90,-2913],[100,-2915],[1010,-2915],[1015,-2910],[1054,-2830],[1444,-2010],[1492,-1900],[1534,-1790],[1557,-1720],[1560,-1713],[1570,-1710],[1597,-1800],[1613,-1840],[1637,-1910],[1666,-1980],[2081,-2910],[2090,-2915],[2990,-2915],[3000,-2914],[3004,-2910],[1955,-1020],[1954,-10],[1950,-6],[1180,-5],[1168,-10],[1168,-1010],[1166,-1020],[403,-2360],[287,-2560],[283,-2570],[167,-2770],[163,-2780]]]}};

/** Lay the title out centred on (cx, cy), no wider than maxW and no taller than maxFont px. */
function layoutTitle(maxW, maxFont, cx, cy, tracking) {
  var U = G.unit, n = G.text.length, i, j;
  var emW = G.total / U + tracking * (n - 1);
  var font = Math.min(maxFont, maxW / emW);
  var width = emW * font, x0 = cx - width / 2, cap = G.cap / U * font, base = cy + cap / 2;
  var glyphs = [];
  for (i = 0; i < n; i++) {
    var ch = G.text[i];
    if (ch === ' ') continue;
    var gx = x0 + (G.pos[i] / U + tracking * i) * font;
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    var contours = G.glyphs[ch].map(function (c) {
      var a = new Float32Array(c.length * 2);
      for (j = 0; j < c.length; j++) {
        var x = gx + c[j][0] / U * font, y = base + c[j][1] / U * font;
        a[2 * j] = x; a[2 * j + 1] = y;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      return a;
    });
    // biggest contour first (outer), counters after
    contours.sort(function (a, b) { return Math.abs(polyArea(b)) - Math.abs(polyArea(a)); });
    glyphs.push({ ch: ch, index: i, contours: contours, x0: minx, x1: maxx, y0: miny, y1: maxy });
  }
  return {
    font: font, width: width, x0: x0, base: base, cap: cap, glyphs: glyphs,
    left: glyphs[0].x0, right: glyphs[glyphs.length - 1].x1, top: base - cap, bottom: base
  };
}
function polyArea(a) {
  var s = 0, n = a.length / 2;
  for (var i = 0; i < n; i++) { var j = (i + 1) % n; s += a[2 * i] * a[2 * j + 1] - a[2 * j] * a[2 * i + 1]; }
  return s / 2;
}
/** Path2D of the solid title (fill with 'evenodd'). `from`/`to` restrict to glyph indices. */
function titlePath(title, from, to) {
  var p = new Path2D();
  title.glyphs.forEach(function (g, gi) {
    if (from != null && (gi < from || gi >= to)) return;
    g.contours.forEach(function (c) {
      p.moveTo(c[0], c[1]);
      for (var i = 2; i < c.length; i += 2) p.lineTo(c[i], c[i + 1]);
      p.closePath();
    });
  });
  return p;
}
/** For a vertical line at x: sorted list of [yTop, yBottom] spans inside the title's ink. */
function titleSpans(title, x) {
  var ys = [];
  for (var gi = 0; gi < title.glyphs.length; gi++) {
    var g = title.glyphs[gi];
    if (x < g.x0 || x > g.x1) continue;
    for (var ci = 0; ci < g.contours.length; ci++) {
      var c = g.contours[ci], n = c.length / 2;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n, xa = c[2 * i], xb = c[2 * j];
        if ((xa <= x && xb > x) || (xb <= x && xa > x)) {
          ys.push(c[2 * i + 1] + (x - xa) / (xb - xa) * (c[2 * j + 1] - c[2 * i + 1]));
        }
      }
    }
  }
  ys.sort(function (a, b) { return a - b; });
  var spans = [];
  for (var k = 0; k + 1 < ys.length; k += 2) if (ys[k + 1] - ys[k] > 0.3) spans.push([ys[k], ys[k + 1]]);
  return spans;
}

// ---------------------------------------------------------------- shared drawing helpers
/** Soft round sprite (pen tip, particles) pre-rendered once; draw with drawImage. */
function glowSprite(size, stops) {
  var c = document.createElement('canvas'); c.width = c.height = size;
  var g = c.getContext('2d'), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}
/**
 * Cheap bloom: the frame is downsampled through a small mip chain and added back on top.
 * No ctx.filter / shadowBlur, so the cost is a handful of drawImage calls per frame.
 */
function makeBloom(canvas) {
  var levels = [], w = canvas.width, h = canvas.height;
  for (var i = 0; i < 4; i++) {
    w = Math.max(2, Math.ceil(w / 2)); h = Math.max(2, Math.ceil(h / 2));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    levels.push({ c: c, g: c.getContext('2d') });
  }
  return function (ctx, a1, a2, a3) {
    var src = canvas;
    for (var i = 0; i < levels.length; i++) {
      var L = levels[i];
      L.g.clearRect(0, 0, L.c.width, L.c.height);
      L.g.drawImage(src, 0, 0, L.c.width, L.c.height);
      src = L.c;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    var al = [0, a1, a2, a3 == null ? a2 : a3];
    for (i = 1; i < levels.length; i++) {
      if (al[i] <= 0) continue;
      ctx.globalAlpha = al[i];
      ctx.drawImage(levels[i].c, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
  };
}

// ---------------------------------------------------------------- player
// Slow-device guard: if the first GUARD_FRAMES frames average more than GUARD_MS apart,
// draw every other particle for the rest of the run.
var GUARD_FRAMES = 30, GUARD_MS = 24;

/**
 * play(container, { onComplete, onError, speed, reducedMotion })
 *   container      element that the intro fills (position it yourself; the canvas is absolutely placed inside)
 *   onComplete     called once when the timeline ends or skip() is called
 *   onError        called once if a frame throws mid-run (the animation stops)
 *   speed          1 = designed pace, 0.5 = half speed
 *   reducedMotion  true: no animation, the finished title is shown for a moment instead
 * Returns { skip, destroy, duration } (duration in ms at speed 1). Throws if the canvas cannot be created.
 * Everything on screen is a pure function of one time value.
 */
export function play(container, opts) {
  opts = opts || {};
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'DJ INSANITY');
  container.appendChild(canvas);
  var reduced = !!opts.reducedMotion;
  var speed = opts.speed > 0 ? +opts.speed : 1;
  var scene = null, raf = 0, t0 = 0, cur = 0, finished = false, destroyed = false, holdTimer = 0;
  var lite = false, lastNow = 0, frames = 0, frameSum = 0;

  function resize() {
    var r = container.getBoundingClientRect();
    var W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);          // cap DPR: phones report 3+
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    scene = setup({ W: W, H: H, dpr: dpr, ctx: ctx, canvas: canvas });
    draw(cur);
  }
  function draw(t) {
    cur = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    scene.render(clamp(t, 0, DURATION), lite);
  }
  function finish() {
    if (finished || destroyed) return;
    finished = true;
    cancelAnimationFrame(raf); raf = 0; clearTimeout(holdTimer);
    try { draw(DURATION); } catch { /* the overlay is closing anyway */ }
    if (opts.onComplete) opts.onComplete();
  }
  function fail(err) {
    finished = true;
    cancelAnimationFrame(raf); raf = 0;
    if (opts.onError) opts.onError(err);
  }
  function tick(now) {
    if (destroyed) return;
    if (frames < GUARD_FRAMES) {
      if (lastNow) { frameSum += now - lastNow; frames++; }
      lastNow = now;
      if (frames === GUARD_FRAMES && frameSum / GUARD_FRAMES > GUARD_MS) { lite = true; canvas.dataset.particles = 'half'; }
    }
    var t = (now - t0) * speed;
    if (t >= DURATION) { finish(); return; }
    try { draw(t); } catch (e) { fail(e); return; }
    raf = requestAnimationFrame(tick);
  }
  function onResize() {
    try { resize(); } catch (e) { fail(e); }
  }

  resize();
  if (reduced) {                                                  // no motion: the finished title, briefly
    cur = DURATION; draw(DURATION);
    holdTimer = setTimeout(finish, 600);
  } else {
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  }
  window.addEventListener('resize', onResize);
  return {
    duration: DURATION,
    skip: finish,
    destroy: function () {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(raf); clearTimeout(holdTimer);
      window.removeEventListener('resize', onResize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };
}

// ---------------------------------------------------------------- line geometry shared by the line-based options
/**
 * The record as ONE line: a spiral whose pitch changes to make the spindle, the label ring,
 * three bands of grooves with gaps between tracks, and a closed outer rim.
 * Returned points are evenly spaced along the line, centred on 0,0, radius 1, and the line
 * ends at twelve o'clock travelling to the right (clockwise on screen).
 */
function buildSpiral(N, sections) {
  var M = 30000, turns = 0, i, s;
  for (i = 0; i < sections.length; i++) turns += sections[i][0];
  var fx = new Float64Array(M + 1), fy = new Float64Array(M + 1), fr = new Float64Array(M + 1), cum = new Float64Array(M + 1);
  var total = turns * TAU;
  for (i = 0; i <= M; i++) {
    var th = total * i / M, tt = th / TAU, r0 = 0, r = 0;
    for (s = 0; s < sections.length; s++) {
      var sec = sections[s];
      if (tt <= sec[0] || s === sections.length - 1) {
        var f = c01(tt / sec[0]);
        r = lerp(r0, sec[1], sec[2] ? E.smooth(f) : f);
        break;
      }
      tt -= sec[0]; r0 = sec[1];
    }
    var a = th - total - Math.PI / 2;
    fx[i] = r * Math.cos(a); fy[i] = r * Math.sin(a); fr[i] = r;
    if (i) cum[i] = cum[i - 1] + Math.hypot(fx[i] - fx[i - 1], fy[i] - fy[i - 1]);
  }
  var L = cum[M], x = new Float32Array(N), y = new Float32Array(N), rad = new Float32Array(N), ang = new Float32Array(N), j = 0;
  for (i = 0; i < N; i++) {
    var d = L * i / (N - 1);
    while (j < M - 1 && cum[j + 1] < d) j++;
    var u = (d - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    x[i] = lerp(fx[j], fx[j + 1], u); y[i] = lerp(fy[j], fy[j + 1], u); rad[i] = lerp(fr[j], fr[j + 1], u);
    ang[i] = total * (j + u) / M;
  }
  return { x: x, y: y, r: rad, th: ang, length: L, turns: turns };
}

/** Pen speed while the record is drawn: slow at the centre, flat out through the grooves, easing onto the rim. Maps time 0..1 to length 0..1. */
function penCurve() {
  var LUT = new Float32Array(257), acc = 0, i;
  for (i = 1; i <= 256; i++) {
    var q = i / 256, v = q < 0.7 ? 0.02 + q * q : (0.02 + 0.49) * lerp(1, 0.1, E.smooth((q - 0.7) / 0.3));
    acc += v; LUT[i] = acc;
  }
  return function (q) { var f = c01(q) * 256, k = Math.min(255, f | 0); return lerp(LUT[k], LUT[k + 1], f - k) / acc; };
}
var RECORD = [[0.5, 0.05, 1], [1, 0.05], [0.8, 0.31, 1], [1, 0.31], [0.5, 0.41, 1],
  [5, 0.565], [0.4, 0.61, 1], [5, 0.765], [0.4, 0.81, 1], [5, 0.965], [0.4, 1, 1], [1, 1]];

// ================================================================ OPTION 2 — STARDUST
// 125 BPM grid, one beat = 480 ms.
var T_DRAW = 240,     // the pen starts to move, shedding points
    T_DRAWN = 1440,   // record complete (beat 3); it starts to spin up
    T_FLOW = 1920,    // the rim lets go: grooves fling out sideways (beat 4)
    T_WAVE = 2760,    // everything has landed in the wave sheet
    T_COND = 3300,    // the wave condenses into letters
    T_TITLE = 4080,   // letters formed
    T_SOLID = 4320,   // letters filled (beat 9)
    DURATION = 5280;

function setup(env) {
  var W = env.W, H = env.H, dpr = env.dpr, ctx = env.ctx, canvas = env.canvas;
  var cx = W / 2, cy = H * 0.5;
  var R = Math.min(W * 0.37, H * 0.3, 250);
  var title = layoutTitle(Math.min(W * 0.84, 1040), 150, cx, cy, 0.035);
  var fill = titlePath(title);
  var N = Math.round(clamp(R * 28, 3800, 7000)), i, k;
  var rnd = rng(20261115);
  var sp = buildSpiral(N, RECORD), pen = penCurve();
  var base = clamp(R / 105, 1.3, 2.2);

  var margin = title.font * 0.18;
  var xL = title.left - margin, xR = title.right + margin, Ww = xR - xL;
  var A0 = Math.min(H * 0.13, R * 0.78);

  // ---- per-particle constants
  var ang = new Float32Array(N), rad = new Float32Array(N), birth = new Float32Array(N), bx = new Float32Array(N), by = new Float32Array(N);
  var rel = new Float32Array(N), dur = new Float32Array(N), vv = new Float32Array(N), strand = new Float32Array(N), jx = new Float32Array(N);
  var size = new Float32Array(N), tw = new Float32Array(N), cls = new Uint8Array(N), cnd = new Float32Array(N);
  var tx = new Float32Array(N), ty = new Float32Array(N);
  var q = 0;
  for (i = 0; i < N; i++) {
    var u = i / (N - 1);
    rad[i] = sp.r[i] + (rnd() - 0.5) * 0.006;
    ang[i] = Math.atan2(sp.y[i], sp.x[i]);
    while (q < 1 && pen(q) < u) q += 1 / 2000;                     // when does the pen reach this point?
    birth[i] = T_DRAW + q * (T_DRAWN - T_DRAW);
    var ba = rnd() * TAU, bm = (4 + 22 * rnd() * rnd()) * base;
    bx[i] = Math.cos(ba) * bm; by[i] = Math.sin(ba) * bm;
    rel[i] = T_FLOW + Math.pow(1 - u, 1.15) * 340 + rnd() * 80;    // rim goes first, label last
    dur[i] = 420 + rnd() * 110;
    strand[i] = Math.round(rnd() * 8) / 4 - 1 + (rnd() - 0.5) * 0.07;   // nine strands in the wave sheet
    jx[i] = (rnd() - 0.5);
    size[i] = base * (0.75 + 0.7 * rnd()) * (rnd() < 0.05 ? 1.8 : 1);
    tw[i] = rnd() * TAU;
    var c = rnd();
    cls[i] = sp.r[i] <= 0.312 ? (c < 0.7 ? 3 : 4) : c < 0.5 ? 0 : c < 0.8 ? 1 : c < 0.92 ? 2 : 5;
  }
  strand[N - 1] = 0; size[N - 1] = base * 1.6; bx[N - 1] = by[N - 1] = 0;
  // where each point lands in the wave: every ring opens left and right, outer rings travel furthest
  for (i = 0; i < N; i++) {
    var side = i === N - 1 ? 1 : (rnd() < 0.5 ? -1 : 1);
    vv[i] = c01(0.5 + side * 0.5 * Math.pow(i / (N - 1), 0.85) * (i === N - 1 ? 1 : 0.9 + 0.1 * rnd()));
  }
  // ---- where each point lands in the title: 3/4 spread evenly through the ink, 1/4 on the outlines for crisp edges
  var step = 0.5, COLS = Math.ceil((title.right - title.left) / step) + 1, colSp = [], cum = new Float32Array(COLS + 1);
  for (k = 0; k < COLS; k++) {
    var s2 = titleSpans(title, title.left + k * step), len = 0;
    for (var j = 0; j < s2.length; j++) len += s2[j][1] - s2[j][0];
    colSp.push(s2); cum[k + 1] = cum[k] + len;
  }
  var T = [], nIn = Math.round(N * 0.74), col = 0;
  for (k = 0; k < nIn; k++) {
    var d = (k + rnd()) / nIn * cum[COLS];
    while (col < COLS - 1 && cum[col + 1] < d) col++;
    var rem = d - cum[col], ss = colSp[col], y = title.base;
    for (j = 0; j < ss.length; j++) { var l = ss[j][1] - ss[j][0]; if (rem <= l) { y = ss[j][0] + rem; break; } rem -= l; }
    T.push([title.left + col * step + (rnd() - 0.5) * step, y]);
  }
  var edges = [], per = 0;
  title.glyphs.forEach(function (g) { g.contours.forEach(function (cc) { var n = cc.length / 2; for (var a = 0; a < n; a++) { var b = (a + 1) % n, L = Math.hypot(cc[2 * b] - cc[2 * a], cc[2 * b + 1] - cc[2 * a + 1]); edges.push([cc[2 * a], cc[2 * a + 1], cc[2 * b], cc[2 * b + 1], per, L]); per += L; } }); });
  var ei = 0, nOut = N - nIn;
  for (k = 0; k < nOut; k++) {
    var dd = (k + rnd()) / nOut * per;
    while (ei < edges.length - 1 && edges[ei][4] + edges[ei][5] < dd) ei++;
    var ed = edges[ei], f = c01((dd - ed[4]) / Math.max(1e-6, ed[5]));
    T.push([lerp(ed[0], ed[2], f), lerp(ed[1], ed[3], f)]);
  }
  T.sort(function (a, b) { return a[0] - b[0]; });
  var order = []; for (i = 0; i < N; i++) order.push(i);
  order.sort(function (a, b) { return vv[a] - vv[b] || a - b; });
  for (k = 0; k < N; k++) { tx[order[k]] = T[k][0]; ty[order[k]] = T[k][1]; cnd[order[k]] = T_COND + (k / N) * 330 + rnd() * 70; }

  function rot(t) { var x = Math.max(0, t - T_DRAWN) / 1000; return TAU * (1.05 * (t - T_FLOW) / 1000 + 1.55 * x * x); }   // spins up after it is drawn
  function waveAmp(t) { return A0 * (0.45 + 0.55 * E.smooth(seg(t, T_FLOW + 150, T_WAVE))) * (1 + 0.32 * Math.exp(-Math.max(0, t - 2880) / 190) * (t >= 2880 ? 1 : 0)); }
  var _x = 0, _y = 0, _a = 0, _fly = 0;
  /** Position of particle i at time t — a pure function of time. */
  function place(i, t) {
    _fly = 0;
    if (t < birth[i]) { _a = 0; return; }
    var v = vv[i], st = strand[i];
    var wxp = 0, wyp = 0;
    if (t >= rel[i]) {
      var envp = Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.7) * (0.55 + 0.45 * Math.sin(TAU * 1.3 * v - t * 0.0045));
      wxp = xL + v * Ww + jx[i] * 2.4 * base;
      wyp = cy + waveAmp(t) * envp * (st * Math.sin(TAU * 2.1 * v - t * 0.0068) + 0.34 * Math.sin(TAU * 4.6 * v + t * 0.0095 + st * 1.9));
    }
    if (t < rel[i] + dur[i]) {
      var tt = Math.min(t, rel[i]);
      var a = ang[i] + rot(tt), settle = 1 - E.outExpo(seg(t, birth[i], birth[i] + 340));
      var pulse = Math.exp(-Math.max(0, tt - T_DRAWN) / 260) * (tt >= T_DRAWN ? 1 : 0);
      var rr = R * rad[i] * (1 + 0.035 * pulse), ca = Math.cos(a), sa = Math.sin(a);
      var x0 = cx + rr * ca + bx[i] * settle, y0 = cy + rr * sa + by[i] * settle;
      if (t < rel[i]) {
        _x = x0; _y = y0;
        var cs = (ca * 0.61 - sa * 0.79); cs = cs * cs; cs = cs * cs * cs;       // vinyl sheen, fixed in space
        var groove = rad[i] > 0.4;
        _a = (groove ? 0.3 + 0.7 * cs : 0.9) * (1 - 0.5 * settle) + settle * 0.6 + 0.3 * pulse;
        return;
      }
      // flung off the platter along its tangent, curving in to its place in the wave
      var e = E.out2(seg(t, rel[i], rel[i] + dur[i])), fl = R * (0.5 + 0.9 * rad[i]);
      var cxp = x0 - sa * fl, cyp = y0 + ca * fl, o = 1 - e;
      _x = o * o * x0 + 2 * o * e * cxp + e * e * wxp; _y = o * o * y0 + 2 * o * e * cyp + e * e * wyp;
      _a = 0.85; _fly = 1;
      return;
    }
    if (t < cnd[i]) { _x = wxp; _y = wyp; _a = 0.62 + 0.38 * Math.sin(t * 0.011 + tw[i]); return; }
    var g = E.inOut3(seg(t, cnd[i], cnd[i] + 400));
    _x = lerp(wxp, tx[i], g); _y = lerp(wyp, ty[i], g);
    _a = lerp(0.62 + 0.38 * Math.sin(t * 0.011 + tw[i]), 0.9, g); _fly = g > 0 && g < 1 ? 1 : 0;
  }

  var PX = new Float32Array(N), PY = new Float32Array(N), QX = new Float32Array(N), QY = new Float32Array(N), PB = new Uint8Array(N), FL = new Uint8Array(N);
  var CNT = new Int32Array(64), POS = new Int32Array(64), ORD = new Int32Array(N);
  var tip = glowSprite(96, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,240,205,1)'], [0.3, 'rgba(245,158,11,0.6)'], [0.6, 'rgba(245,158,11,0.14)'], [1, 'rgba(245,158,11,0)']]);
  var bloom = makeBloom(canvas);
  var COL = [[96, 150, 255], [37, 99, 235], [226, 236, 255], [245, 158, 11], [255, 214, 140], [150, 110, 255]];
  var NA = 4, ALPHA = [0.3, 0.55, 0.8, 1];

  /** lite: slow device, draw every other particle (the last one, the pen, always stays). */
  function render(t, lite) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var solid = E.out3(seg(t, T_TITLE - 120, T_SOLID));
    if (solid > 0) { ctx.save(); ctx.globalAlpha = solid; ctx.fillStyle = '#ffffff'; ctx.fill(fill, 'evenodd'); ctx.restore(); }
    var white = E.inOut3(seg(t, T_COND + 150, T_TITLE));           // colours cool to white as the letters form
    var fade = 1 - 0.62 * E.inOut3(seg(t, T_SOLID - 80, T_SOLID + 600));
    var i, b, nb = COL.length * NA;
    CNT.fill(0);
    for (i = 0; i < N; i++) {
      if (lite && (i & 1) && i !== N - 1) { PB[i] = 255; continue; }
      place(i, t);
      if (_a <= 0.02) { PB[i] = 255; continue; }
      PX[i] = _x; PY[i] = _y;
      var al = c01(_a) * fade, lv = al < 0.42 ? 0 : al < 0.68 ? 1 : al < 0.9 ? 2 : 3;
      PB[i] = cls[i] * NA + lv; FL[i] = _fly; CNT[PB[i] + 1]++;
      if (_fly) { var fx = _x, fy = _y; place(i, t - 24); QX[i] = _a > 0.02 ? _x : fx; QY[i] = _a > 0.02 ? _y : fy; }
    }
    // group by colour/alpha bucket so each bucket is one fillStyle (counting sort: one pass, not one pass per bucket)
    for (b = 0; b < nb; b++) CNT[b + 1] += CNT[b];
    for (b = 0; b <= nb; b++) POS[b] = CNT[b];
    for (i = 0; i < N; i++) if (PB[i] !== 255) ORD[POS[PB[i]]++] = i;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (b = 0; b < nb; b++) {
      if (CNT[b + 1] === CNT[b]) continue;
      var c = COL[(b / NA) | 0], a = ALPHA[b % NA];
      var col = 'rgba(' + Math.round(lerp(c[0], 236, white)) + ',' + Math.round(lerp(c[1], 242, white)) + ',' + Math.round(lerp(c[2], 255, white)) + ',' + a + ')';
      ctx.fillStyle = col;
      var any = false, k2;
      for (k2 = CNT[b]; k2 < CNT[b + 1]; k2++) { i = ORD[k2]; var s = size[i]; ctx.fillRect(PX[i] - s / 2, PY[i] - s / 2, s, s); if (FL[i]) any = true; }
      if (any) {                                                     // points in flight leave a short streak
        ctx.beginPath();
        for (k2 = CNT[b]; k2 < CNT[b + 1]; k2++) { i = ORD[k2]; if (FL[i]) { ctx.moveTo(QX[i], QY[i]); ctx.lineTo(PX[i], PY[i]); } }
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = base * 0.9; ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    // the pen: while drawing it rides the spiral; afterwards it is simply the last point of the line
    var tipX, tipY, tipS = 1;
    if (t < T_DRAWN) {
      var f = pen(seg(t, T_DRAW, T_DRAWN)) * (N - 1), i0 = Math.min(N - 2, f | 0), uu = f - i0, rt = rot(t);
      var r0 = lerp(sp.r[i0], sp.r[i0 + 1], uu) * R, a0 = Math.atan2(lerp(sp.y[i0], sp.y[i0 + 1], uu), lerp(sp.x[i0], sp.x[i0 + 1], uu)) + rt;
      tipX = cx + r0 * Math.cos(a0); tipY = cy + r0 * Math.sin(a0);
      tipS = E.outBack(seg(t, 0, 220));
    } else {
      place(N - 1, t); tipX = _x; tipY = _y;
      tipS = 1 + 0.5 * Math.exp(-(t - T_DRAWN) / 260) + 0.9 * Math.exp(-Math.abs(t - T_SOLID) / 120) - E.in2(seg(t, T_SOLID + 300, T_SOLID + 700));
    }
    if (tipS > 0.01) {
      var ts = clamp(R * 0.11, 15, 26) * tipS;
      ctx.drawImage(tip, tipX - ts, tipY - ts, ts * 2, ts * 2);
      ctx.beginPath(); ctx.arc(tipX, tipY, Math.max(0.1, base * 1.5 * Math.min(1.4, tipS)), 0, TAU); ctx.fillStyle = '#fff6e0'; ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    var flash = Math.exp(-Math.abs(t - T_SOLID) / 140);
    bloom(ctx, 0.55 + 0.3 * flash, 0.55 + 0.4 * flash, 0.45 + 0.5 * flash);
  }
  return { render: render };
}

