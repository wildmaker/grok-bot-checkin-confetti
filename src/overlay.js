/* Shadow DOM overlay: drifting Grok Bot icons, one-bot confetti, pause/hide controls. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HOST_ID = 'grok-bot-checkin-host';
  const MAX_PARTICLES = 48;
  const FAILSAFE_MS = 4000;
  const PALETTE = ['#885cf5', '#ffd23f', '#3bcee0', '#ff6b8b', '#7ee081', '#ff9f43'];
  const BOTS = [
    { coat: '#885cf5', side: 'left', top: '14%', dx: '14px', dy: '70px', dur: '16s', delay: '-3s' },
    { coat: '#3bcee0', side: 'right', top: '22%', dx: '-12px', dy: '90px', dur: '19s', delay: '-9s' },
    { coat: '#ff6b8b', side: 'left', top: '52%', dx: '10px', dy: '-60px', dur: '17s', delay: '-6s' },
    { coat: '#ffd23f', side: 'right', top: '60%', dx: '-14px', dy: '-80px', dur: '21s', delay: '-12s' },
  ];
  const LABELS = {
    en: { pause: 'Pause bots', resume: 'Resume bots', hide: 'Hide bots', show: 'Show bots' },
    zh: { pause: '暂停', resume: '继续', hide: '隐藏', show: '显示' },
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
    const bots = BOTS.map((cfg) => {
      const bot = doc.createElement('div');
      bot.className = 'bot';
      bot.style[cfg.side] = '6px';
      bot.style.top = cfg.top;
      bot.style.setProperty('--coat', cfg.coat);
      bot.style.setProperty('--dx', cfg.dx);
      bot.style.setProperty('--dy', cfg.dy);
      bot.style.setProperty('--dur', cfg.dur);
      bot.style.setProperty('--delay', cfg.delay);
      const hop = doc.createElement('div');
      hop.className = 'hop';
      hop.appendChild(buildBotSvg(doc, art));
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

      if (reduced) {
        animations.push(bot.hop.animate([{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }], { duration: 700 }));
      } else {
        animations.push(
          bot.hop.animate(
            [
              { transform: 'translateY(0) scale(1) rotate(0deg)' },
              { transform: 'translateY(-16px) scale(1.3) rotate(-10deg)', offset: 0.3 },
              { transform: 'translateY(-6px) scale(1.2) rotate(10deg)', offset: 0.6 },
              { transform: 'translateY(0) scale(1) rotate(0deg)' },
            ],
            { duration: 900, easing: 'cubic-bezier(.3,.7,.4,1)' }
          )
        );
      }

      const layer = doc.createElement('div');
      layer.className = 'confetti';
      if (!reduced) {
        const rect = bot.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const base = Math.atan2(win.innerHeight / 2 - cy, win.innerWidth / 2 - cx);
        const total = 36 + Math.floor(rng() * (MAX_PARTICLES - 36 + 1));
        for (let i = 0; i < total; i++) {
          const p = doc.createElement('span');
          p.className = 'p';
          const shape = i % 3;
          const w = shape === 2 ? 3 : 6 + rng() * 5;
          const h = shape === 2 ? 12 + rng() * 6 : w * (shape === 0 ? 0.6 : 1);
          p.style.width = w + 'px';
          p.style.height = h + 'px';
          p.style.borderRadius = shape === 1 ? '50%' : '1px';
          p.style.background = PALETTE[Math.floor(rng() * PALETTE.length)];
          layer.appendChild(p);
          const angle = base + (rng() - 0.5) * 2.4;
          const speed = 160 + rng() * 280;
          const dx = Math.cos(angle) * speed;
          const dy = Math.sin(angle) * speed;
          const spin = (rng() - 0.5) * 900;
          animations.push(
            p.animate(
              [
                { transform: `translate(${cx}px, ${cy}px) rotate(0deg)`, opacity: 1 },
                { transform: `translate(${cx + dx * 0.7}px, ${cy + dy * 0.7 - 50}px) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.45 },
                { transform: `translate(${cx + dx}px, ${cy + dy + 200}px) rotate(${spin}deg)`, opacity: 0 },
              ],
              { duration: 1300 + rng() * 800, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' }
            )
          );
        }
        particleCount += total;
        stage.appendChild(layer);
      }
      publish();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        activeCleanup = null;
        for (const anim of animations) anim.cancel();
        particleCount = Math.max(0, particleCount - layer.childElementCount);
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
