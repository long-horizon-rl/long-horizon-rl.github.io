(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- trajectory generator ----------
     Draws N gently wavy lines from x0 toward x1. Each path has pathLength=1 so
     stroke-dashoffset = 1 - fraction shows exactly that share of the line. */
  const X0 = 10, X1 = 905, HOUR = 380;
  const ENDS = [
    [230, 300, 262, 330, 352, 290, 368, 340],   // today: everything ends before an hour
    [230, 300, 262, 470, 520, 540, 500, 530],   // unlock 1: a day
    [230, 300, 262, 470, 520, 700, 660, 720],   // unlock 2: a week
    [230, 300, 262, 470, 520, 800, 905, 905]    // unlock 3: still running
  ];
  function rng(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function wavy(y, rnd, amp) {
    const pts = [];
    for (let x = X0; x <= X1 + 1; x += 45) pts.push([Math.min(x, X1), y + (rnd() - .5) * amp]);
    let d = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1], [qx, qy] = pts[i], m = (px + qx) / 2;
      d += ` C${m},${py.toFixed(1)} ${m},${qy.toFixed(1)} ${qx},${qy.toFixed(1)}`;
    }
    return d;
  }
  function buildTraj(container, opts) {
    const rnd = rng(opts.seed), n = ENDS[0].length, paths = [];
    for (let i = 0; i < n; i++) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', wavy(opts.y0 + i * opts.dy, rnd, opts.amp));
      p.setAttribute('pathLength', '1');
      p.style.strokeDashoffset = '1';
      container.appendChild(p);
      paths.push(p);
    }
    return paths;
  }
  function setState(paths, state, colors, sw) {
    const ends = ENDS[state], w = sw || { short: 2, long: 2.6, far: 3.2 };
    paths.forEach((p, i) => {
      const end = ends[i], frac = (end - X0) / (X1 - X0), long = end > HOUR;
      p.style.strokeDashoffset = String(1 - frac);
      p.style.stroke = long ? colors.blue : colors.grey;
      p.style.strokeWidth = String(long ? (end >= X1 ? w.far : w.long) : w.short);
      p.style.opacity = long ? '1' : '.7';
    });
  }
  const COLORS = { blue: '#0176d3', grey: '#98a7b8' };

  // hero: ambient lines, drawn fully on load
  const heroSvg = document.querySelector('.hero-traj');
  if (heroSvg) {
    const paths = buildTraj(heroSvg, { seed: 11, y0: 18, dy: 16, amp: 8 });
    paths.forEach((p, i) => { p.style.transitionDelay = reduce ? '0s' : (i * .12) + 's'; });
    requestAnimationFrame(() => requestAnimationFrame(() => setState(paths, 3, { blue: '#0176d3', grey: '#b9c5d3' })));
  }

  // vision: chart states follow the focused step
  const chart = document.getElementById('vision-chart');
  const visionGroup = document.getElementById('vision-traj');
  let visionPaths = [], visionState = -1;
  if (chart && visionGroup) {
    visionPaths = buildTraj(visionGroup, { seed: 7, y0: 96, dy: 34, amp: 16 });
    setVisionState(0, true);
  }
  function setVisionState(s, force) {
    if (s === visionState && !force) return;
    visionState = s;
    setState(visionPaths, s, COLORS, { short: 3, long: 4.2, far: 5 });
    chart.classList.remove('s0', 's1', 's2', 's3');
    chart.classList.add('s' + s);
  }

  /* ---------- reveal on entry ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // drawn SVG strokes: once fully drawn, drop the dash pattern (avoids dash-seam artifacts)
  document.querySelectorAll('.thesis path[pathLength], .loop .larrows path').forEach((p) => {
    p.addEventListener('animationend', () => { p.style.strokeDasharray = 'none'; p.style.strokeDashoffset = '0'; });
  });

  // segments: one-shot .in for SVG animations
  const segs = Array.from(document.querySelectorAll('.seg'));
  const segIo = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); segIo.unobserve(e.target); } });
  }, { threshold: 0.3 });
  segs.forEach((s) => segIo.observe(s));

  /* ---------- scroll: spine fill, focus, vision steps ---------- */
  const timeline = document.getElementById('timeline');
  const spine = document.querySelector('.spine');
  const fill = document.querySelector('.spine-fill');
  const steps = Array.from(document.querySelectorAll('.step'));
  const navLinks = Array.from(document.querySelectorAll('.top nav a'));
  const navFor = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight, center = y + vh * 0.5;
    document.body.classList.toggle('scrolled', y > 40);

    // spine fill follows the viewport center
    if (spine && fill) {
      const r = spine.getBoundingClientRect();
      const top = r.top + y, h = r.height;
      fill.style.height = Math.max(0, Math.min(h, center - top)) + 'px';
    }

    // active segment: the one containing the viewport center; before the first, none
    let active = -1;
    segs.forEach((s, i) => {
      const r = s.getBoundingClientRect(), t = r.top + y;
      if (center >= t) active = i;
    });
    const timelineTop = timeline ? timeline.getBoundingClientRect().top + y : 0;
    const inTimeline = center >= timelineTop;
    segs.forEach((s, i) => {
      s.classList.toggle('active', inTimeline && i === active);
      s.classList.toggle('passed', inTimeline && i < active);
      s.classList.toggle('dim', inTimeline && i !== active);
      s.classList.toggle('next', inTimeline && i === active + 1);
    });
    // nav: light the link for the active chapter, or the nearest earlier chapter that has one
    let navId = null;
    if (inTimeline) for (let i = active; i >= 0; i--) { if (navFor.has(segs[i].id)) { navId = segs[i].id; break; } }
    navLinks.forEach((a) => a.classList.toggle('current', a.getAttribute('href') === '#' + navId));

    // vision steps: nearest to the viewport center gets focus and sets the chart state
    if (steps.length) {
      let best = 0, bestD = Infinity;
      steps.forEach((st, i) => {
        const r = st.getBoundingClientRect(), c = r.top + r.height / 2 - vh * 0.5;
        const d = Math.abs(c);
        if (d < bestD) { bestD = d; best = i; }
      });
      steps.forEach((st, i) => st.classList.toggle('on', i === best));
      setVisionState(Number(steps[best].dataset.state) || 0);
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', update);
  update();

  /* ---------- papers: see more ---------- */
  const more = document.getElementById('more');
  const btn = document.getElementById('more-btn');
  if (more && btn) {
    const total = document.querySelectorAll('.paper').length;
    btn.textContent = `See all ${total} papers`;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      if (!open) {
        more.hidden = false;
        more.style.maxHeight = more.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
        btn.textContent = 'Show fewer';
        more.addEventListener('transitionend', () => { if (btn.getAttribute('aria-expanded') === 'true') more.style.maxHeight = 'none'; }, { once: true });
      } else {
        more.style.maxHeight = more.scrollHeight + 'px';
        requestAnimationFrame(() => { more.style.maxHeight = '0px'; });
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = `See all ${total} papers`;
        more.addEventListener('transitionend', () => { if (btn.getAttribute('aria-expanded') === 'false') more.hidden = true; }, { once: true });
      }
      requestAnimationFrame(onScroll);
    });
  }
})();
