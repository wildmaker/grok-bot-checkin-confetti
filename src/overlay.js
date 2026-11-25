/* Shadow DOM overlay: drifting Grok Bot icons, one-bot confetti, pause/hide controls. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HOST_ID = 'grok-bot-checkin-host';
  const MAX_PARTICLES = 160;
  const FAILSAFE_MS = 7000;
  const PALETTE = ['#FF6700', '#1084FE', '#00BCA6', '#FF309B', '#FFD23F', '#885cf5', '#4ADE80'];
  // Vector "friends" from the thumbnail-tool cover art: flat brand colours, no shadow, big and lively.
  const BOTS = [
    { side: 'left', top: '8%', dx: '22px', dy: '84px', dur: '9s', delay: '-2s', size: '132px', rot: '-10deg' },
    { side: 'right', top: '16%', dx: '-20px', dy: '100px', dur: '11s', delay: '-6s', size: '116px', rot: '9deg' },
    { side: 'left', top: '50%', dx: '18px', dy: '-76px', dur: '10s', delay: '-4s', size: '124px', rot: '12deg' },
    { side: 'right', top: '58%', dx: '-22px', dy: '-92px', dur: '12s', delay: '-8s', size: '108px', rot: '-14deg' },
  ];
  const LABELS = {
    en: { pause: 'Pause bots', resume: 'Resume bots', hide: 'Hide bots', show: 'Show bots', badge: 'Checked in!' },
    zh: { pause: '暂停', resume: '继续', hide: '隐藏', show: '显示', badge: '签到成功！' },
  };

  function svgEl(doc, name, attrs) {
    const el = doc.createElementNS(SVG_NS, name);
    for (const key of Object.keys(attrs || {})) el.setAttribute(key, attrs[key]);
    return el;
  }

  function buildBotSvg(doc, art) {
    const svg = svgEl(doc, 'svg', { viewBox: art.viewBox, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl(doc, 'path', { class: 'head', d: art.head }));
    for (const d of art.eyes) svg.appendChild(svgEl(doc, 'path', { class: 'eye', d }));
    return svg;
  }

  function buildBotVisual(doc, options, index) {
    const shapes = options.botShapes;
    if (shapes && shapes.length) {
      const shape = shapes[index % shapes.length];
      const svg = svgEl(doc, 'svg', { viewBox: shape.viewBox, 'aria-hidden': 'true', focusable: 'false' });
      svg.appendChild(svgEl(doc, 'path', { d: shape.d, fill: shape.fill, 'fill-rule': 'evenodd', 'clip-rule': 'evenodd' }));
      return svg;
    }
    return buildBotSvg(doc, options.art);
  }

  function setImportant(el, prop, value) {
    el.style.setProperty(prop, value, 'important');
  }

  function createOverlay(options) {
    const doc = options.document || root.document;
    const win = doc.defaultView;
    const art = options.art;
    const rng = options.rng || Math.random;
    const lang = (win.navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
    const labels = LABELS[lang];
    const timers = new Set();
    let settings = Object.assign({ paused: false, hidden: false }, options.settings);
    let destroyed = false;
    let particleCount = 0;
    let celebrations = 0;
    let skipped = 0;
    let activeCleanup = null;

    const host = doc.createElement('div');
    host.id = HOST_ID;
    setImportant(host, 'all', 'initial');
    setImportant(host, 'position', 'fixed');
    setImportant(host, 'inset', '0');
    setImportant(host, 'display', 'block');
    setImportant(host, 'pointer-events', 'none');
    setImportant(host, 'z-index', '2147483646');
    const shadow = host.attachShadow({ mode: 'open' });

    if (options.cssText) {
      if (win.CSSStyleSheet && 'adoptedStyleSheets' in shadow) {
        const sheet = new win.CSSStyleSheet();
        sheet.replaceSync(options.cssText);
        shadow.adoptedStyleSheets = [sheet];
      } else {
        const style = doc.createElement('style');
        style.textContent = options.cssText;
        shadow.appendChild(style);
      }
    }

    const stage = doc.createElement('div');
    stage.className = 'stage';
    stage.setAttribute('aria-hidden', 'true');
    const bots = BOTS.map((cfg, index) => {
      const bot = doc.createElement('div');
      bot.className = 'bot';
      bot.style[cfg.side] = '10px';
      bot.style.top = cfg.top;
      bot.style.setProperty('--dx', cfg.dx);
      bot.style.setProperty('--dy', cfg.dy);
      bot.style.setProperty('--dur', cfg.dur);
      bot.style.setProperty('--delay', cfg.delay);
      bot.style.setProperty('--size', cfg.size || '88px');
      bot.style.setProperty('--rot', cfg.rot || '-6deg');
      const hop = doc.createElement('div');
      hop.className = 'hop';
      hop.appendChild(buildBotVisual(doc, options, index));
      bot.appendChild(hop);
      stage.appendChild(bot);
      return { el: bot, hop };
    });
    shadow.appendChild(stage);

    const controls = doc.createElement('div');
    controls.className = 'controls';
    const pauseBtn = doc.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.dataset.action = 'pause';
    const hideBtn = doc.createElement('button');
    hideBtn.type = 'button';
    hideBtn.dataset.action = 'hide';
    controls.append(pauseBtn, hideBtn);
    shadow.appendChild(controls);

    function publish() {
      host.toggleAttribute('data-paused', settings.paused);
      host.toggleAttribute('data-hidden', settings.hidden);
      host.setAttribute('data-celebrations', String(celebrations));
      host.setAttribute('data-skipped', String(skipped));
      host.setAttribute('data-dropped', String(queue.stats().dropped));
      host.setAttribute('data-particles', String(particleCount));
      host.setAttribute('data-queued', String(queue.stats().pending + (queue.stats().running ? 1 : 0)));
      pauseBtn.textContent = settings.paused ? labels.resume : labels.pause;
      pauseBtn.setAttribute('aria-label', pauseBtn.textContent);
      pauseBtn.hidden = settings.hidden;
      hideBtn.textContent = settings.hidden ? labels.show : labels.hide;
      hideBtn.setAttribute('aria-label', hideBtn.textContent);
    }

    function setSettings(next) {
      settings = Object.assign({}, settings, next);
      publish();
    }

    function onControl(patch) {
      return () => {
        setSettings(patch());
        if (options.onSettingsChange) options.onSettingsChange(Object.assign({}, settings));
      };
    }
    pauseBtn.addEventListener('click', onControl(() => ({ paused: !settings.paused })));
    hideBtn.addEventListener('click', onControl(() => ({ hidden: !settings.hidden })));

    function later(fn, ms) {
      const id = win.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    }

    function visibleBots() {
      return bots.filter((b) => win.getComputedStyle(b.el).display !== 'none');
    }

    function playCelebration(index, done) {
      const candidates = settings.hidden || settings.paused || doc.hidden ? [] : visibleBots();
      if (destroyed || candidates.length === 0) {
        skipped += 1;
        publish();
        done();
        return;
      }
      const bot = candidates[index % candidates.length];
      celebrations += 1;
      const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const animations = [];
      let made = 0;

      const layer = doc.createElement('div');
      layer.className = 'confetti';
      const fx = doc.createElement('div');
      fx.className = 'fx';
      layer.appendChild(fx);

      const badge = doc.createElement('div');
      badge.className = 'badge';
      badge.textContent = '\u2713 ' + labels.badge;
      fx.appendChild(badge);

      if (reduced) {
        animations.push(bot.hop.animate([{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }], { duration: 700 }));
        animations.push(
          badge.animate(
            [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
            { duration: 1800, fill: 'both' }
          )
        );
      } else {
        const W = win.innerWidth;
        const H = win.innerHeight;
        const rect = bot.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const compact = W < 700 ? 0.6 : 1;

        // Every visible bot hops in a wave; the chosen one jumps highest.
        const ordered = [bot].concat(candidates.filter((b) => b !== bot));
        ordered.forEach((b, i) => {
          const big = i === 0;
          animations.push(
            b.hop.animate(
              [
                { transform: 'translateY(0) scale(1) rotate(0deg)' },
                { transform: `translateY(${big ? -34 : -20}px) scale(${big ? 1.5 : 1.3}) rotate(-12deg)`, offset: 0.25 },
                { transform: 'translateY(-4px) scale(1.12) rotate(10deg)', offset: 0.5 },
                { transform: `translateY(${big ? -22 : -12}px) scale(${big ? 1.35 : 1.2}) rotate(-6deg)`, offset: 0.72 },
                { transform: 'translateY(0) scale(1) rotate(0deg)' },
              ],
              { duration: 1200, delay: i * 120, easing: 'ease-out', fill: 'backwards' }
            )
          );
        });

        // Shockwave rings from the chosen bot.
        [0, 170].forEach((delay, i) => {
          const ring = doc.createElement('span');
          ring.className = 'ring';
          ring.style.borderColor = PALETTE[i === 0 ? 0 : 1];
          fx.appendChild(ring);
          animations.push(
            ring.animate(
              [
                { transform: `translate(${cx - 40}px, ${cy - 40}px) scale(0.3)`, opacity: 0.95 },
                { transform: `translate(${cx - 40}px, ${cy - 40}px) scale(4.2)`, opacity: 0 },
              ],
              { duration: 900, delay, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'both' }
            )
          );
        });

        animations.push(
          badge.animate(
            [
              { transform: 'translate(-50%, -26px) scale(0.4)', opacity: 0 },
              { transform: 'translate(-50%, 0) scale(1.18)', opacity: 1, offset: 0.16 },
              { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.26 },
              { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.82 },
              { transform: 'translate(-50%, -16px) scale(0.92)', opacity: 0 },
            ],
            { duration: 2400, easing: 'ease-out', fill: 'both' }
          )
        );

        const rand = (a, b) => a + rng() * (b - a);
        const pick = () => PALETTE[Math.floor(rng() * PALETTE.length)];

        function makeParticle(kind) {
          const p = doc.createElement('span');
          p.className = 'p';
          if (kind === 'bot' && options.botShapes && options.botShapes.length) {
            p.classList.add('mini');
            const size = rand(34, 52);
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.appendChild(buildBotVisual(doc, options, Math.floor(rng() * options.botShapes.length)));
            return p;
          }
          const shape = Math.floor(rng() * 3);
          let w;
          let h;
          if (shape === 0) { w = rand(9, 15); h = w * 0.55; }
          else if (shape === 1) { w = rand(8, 13); h = w; p.style.borderRadius = '50%'; }
          else { w = 4; h = rand(16, 28); }
          p.style.width = w + 'px';
          p.style.height = h + 'px';
          if (shape !== 1) p.style.borderRadius = '2px';
          p.style.background = pick();
          return p;
        }

        // Physics-ish flight: horizontal drag, gravity, spin and paper-like flip, fading out near the end.
        function launch(x, y, angle, speed, delay, kind) {
          if (made >= MAX_PARTICLES) return;
          const p = makeParticle(kind);
          layer.appendChild(p);
          made += 1;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          const g = rand(1100, 1700);
          const k = rand(1.4, 2.2);
          const T = rand(1.9, 3.0);
          const spin = rand(-900, 900);
          const flip = rand(6, 14);
          const steps = 9;
          const frames = [];
          for (let i = 0; i <= steps; i++) {
            const f = i / steps;
            const t = T * f;
            const e = (1 - Math.exp(-k * t)) / k;
            const px = x + vx * e;
            const py = y + vy * e + (g / k) * (t - e);
            const fade = f < 0.7 ? 1 : Math.max(0, 1 - (f - 0.7) / 0.3);
            frames.push({
              transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${(spin * f).toFixed(0)}deg) scale(1, ${Math.cos(f * flip).toFixed(2)})`,
              opacity: fade,
              offset: f,
            });
          }
          animations.push(p.animate(frames, { duration: T * 1000, delay, easing: 'linear', fill: 'both' }));
        }

        const n = (count) => Math.max(1, Math.round(count * compact));
        const up = -Math.PI / 2;
        // Two confetti cannons from the bottom corners, fired in two volleys.
        [[0, 24, 0], [260, 18, 1]].forEach(([delay, count]) => {
          for (let i = 0; i < n(count); i++) {
            const kind = i % 7 === 0 ? 'bot' : 'paper';
            launch(-10, H + 10, up + 0.38 + rand(-0.32, 0.32), rand(900, 1700), delay + rand(0, 90), kind);
            launch(W + 10, H + 10, up - 0.38 + rand(-0.32, 0.32), rand(900, 1700), delay + rand(0, 90), kind);
          }
        });
        // Radial burst from the chosen bot.
        for (let i = 0; i < n(36); i++) {
          const a = (i / n(36)) * Math.PI * 2 + rand(-0.15, 0.15);
          launch(cx, cy, a, rand(450, 1000), rand(0, 60), i % 9 === 0 ? 'bot' : 'paper');
        }
        // Confetti rain across the top.
        for (let i = 0; i < n(30); i++) {
          launch(rand(0, W), -24, Math.PI / 2 + rand(-0.4, 0.4), rand(120, 420), rand(80, 900), i % 10 === 0 ? 'bot' : 'paper');
        }
        particleCount += made;
      }
      stage.appendChild(layer);
      publish();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        activeCleanup = null;
        for (const anim of animations) anim.cancel();
        particleCount = Math.max(0, particleCount - made);
        layer.remove();
        done();
        publish();
      };
      activeCleanup = finish;
      Promise.allSettled(animations.map((a) => a.finished)).then(finish);
      later(finish, FAILSAFE_MS);
    }

    const queue = root.GrokBotCheckin.createCelebrationQueue(playCelebration, options.maxPending);
    publish();
    (doc.documentElement || doc.body).appendChild(host);

    return {
      host,
      celebrate: () => {
        const accepted = queue.enqueue();
        publish();
        return accepted;
      },
      setSettings,
      contains: (node) => node === host || host.contains(node),
      stats: () => Object.assign({ celebrations, skipped, particles: particleCount }, queue.stats()),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        queue.destroy();
        if (activeCleanup) activeCleanup();
        for (const id of timers) win.clearTimeout(id);
        timers.clear();
        host.remove();
      },
    };
  }

  return { createOverlay, HOST_ID };
});
