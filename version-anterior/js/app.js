/* =========================================================
   CampusMarket · interfaz (SPA con rutas por #hash)
   #/               catálogo (público)
   #/p/:id          detalle de producto (público)
   #/vender         nueva publicación (requiere sesión)
   #/editar/:id     editar publicación (requiere sesión)
   #/panel/:tab     panel: resumen | publicaciones | pedidos | compras | perfil
   ========================================================= */
(function () {
  'use strict';
  const C = window.APP_CONFIG;
  const B = window.Backend;
  const view = document.getElementById('view');

  /* ---------------------- utilidades ---------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => C.currencySymbol + Number(n || 0).toLocaleString(C.locale, { maximumFractionDigits: 2 });
  const cat = id => C.categories.find(c => c.id === id) || C.categories[C.categories.length - 1];
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const hue = s => [...String(s || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const avatar = (name, photo, size = '') => photo
    ? `<img class="avatar ${size}" src="${esc(photo)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="avatar ${size}" style="--h:${hue(name)}">${esc(initials(name))}</span>`;
  const myName = () => (state.profile && state.profile.name) || (state.user && state.user.name) || 'Usuario';
  const waLink = (phone, text) => {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (C.whatsappCountryCode && d.length <= 10) d = C.whatsappCountryCode + d;
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  };
  const timeAgo = ms => {
    if (!ms) return '';
    const s = (Date.now() - ms) / 1000;
    if (s < 60) return 'justo ahora';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
    return new Date(ms).toLocaleDateString(C.locale, { day: 'numeric', month: 'short' });
  };
  // Preferencias por dispositivo (vista de pedidos, sonido). Si el navegador bloquea storage, usamos el valor por defecto.
  function pref(k, d) { try { const v = localStorage.getItem('cm_pref_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
  function setPref(k, v) { try { localStorage.setItem('cm_pref_' + k, JSON.stringify(v)); } catch {} }
  const isPre = p => p.mode === 'preorden';
  const modeBadge = p => isPre(p)
    ? '<span class="mode-badge pre">📅 Pre-orden</span>'
    : '<span class="mode-badge now">⚡ Inmediato</span>';
  const fmtDate = ms => new Date(ms).toLocaleString(C.locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const toLocalInput = ms => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  let audioCtx;
  function chime() {
    if (!pref('sound', C.orderSound !== false)) return;
    try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {}
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [880, 1320].forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * 0.16;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.32);
      });
    } catch {}
  }
  const media = p => p.thumb || p.productThumb
    ? `<img src="${esc(p.thumb || p.productThumb)}" alt="" loading="lazy">`
    : `<span class="ph-emoji">${cat(p.category).emoji}</span>`;

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const GOOGLE = '<svg class="ic" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  const STATUS = {
    pendiente: { label: 'Pendiente', cls: 'warn' },
    aceptado: { label: 'Aceptado', cls: 'info' },
    entregado: { label: 'Entregado', cls: 'ok' },
    rechazado: { label: 'Rechazado', cls: 'danger' },
    cancelado: { label: 'Cancelado', cls: 'muted' },
  };

  const AUTH_ERR = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': '',
    'auth/account-exists-with-different-credential': 'Ese correo ya está registrado con otro método. Entra con el método que usaste antes.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).',
    'auth/operation-not-allowed': 'Este método de inicio de sesión no está activado en Firebase.',
    'auth/operation-not-supported-in-this-environment': location.protocol === 'file:'
      ? 'Abriste el archivo con doble clic y así Google no puede iniciar sesión. Abre la página con “iniciar.command” (o en http://localhost:5173).'
      : 'Tu navegador bloquea el inicio de sesión. Activa las cookies/almacenamiento del sitio o sal del modo incógnito.',
    'app/domain-not-allowed': 'Solo se permiten correos de: ' + (C.allowedEmailDomains || []).join(', '),
    'app/storage-full': 'El almacenamiento del navegador está lleno (modo demo). Usa menos fotos o conecta Firebase.',
    'permission-denied': 'No tienes permiso para hacer esto. Revisa las reglas de Firestore.',
  };
  const errMsg = e => (e && e.code in AUTH_ERR) ? AUTH_ERR[e.code] : (e && e.message) || 'Ocurrió un error. Intenta de nuevo.';

  /* ---------------------- estado ---------------------- */
  const state = {
    user: null, profile: null, ready: false,
    products: [], productsLoaded: false, myProducts: [],
    filter: { q: '', cat: 'all', sub: 'all', sort: 'new', mode: 'all' },
    orderFilter: 'todos',
    ordersView: pref('ordersView', 'lista'),
    productsError: null,
    sellerOrders: [], buyerOrders: [], ordersInit: { seller: false, buyer: false },
    unsubs: [], afterLogin: null, loginModal: null, pendingName: null, panelTab: null,
  };

  /* ---------------------- UI base: toasts, modales ---------------------- */
  function toast(msg, type = 'ok', ms = 3200) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${icon(type === 'err' ? 'x' : type === 'info' ? 'bell' : 'check')}<span>${esc(msg)}</span>`;
    $('#toasts').append(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
  }

  function openModal(inner, { cls = '', onClose } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal-backdrop" data-close></div>
      <div class="modal ${cls}" role="dialog" aria-modal="true">
        <span class="modal-grip"></span>
        <button type="button" class="modal-x btn-icon" data-close aria-label="Cerrar">${icon('x')}</button>
        ${inner}
      </div>`;
    $('#modal-root').append(wrap);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => wrap.classList.add('open'));
    let closed = false;
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      if (closed) return;
      closed = true;
      wrap.classList.remove('open');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => {
        wrap.remove();
        if (!$('#modal-root').children.length) document.body.classList.remove('no-scroll');
      }, 260);
      onClose && onClose();
    }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    return { el: wrap.querySelector('.modal'), close };
  }

  function confirmDialog({ title, text, ok = 'Confirmar', danger = false }) {
    return new Promise(res => {
      let v = false;
      const m = openModal(`<div class="dialog">
          <h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button>
          </div></div>`, { cls: 'modal-sm', onClose: () => res(v) });
      m.el.querySelector('[data-ok]').onclick = () => { v = true; m.close(); };
    });
  }

  async function busy(btn, fn) {
    if (!btn) return fn();
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('loading');
    try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('loading'); }
  }

  const emptyState = (emoji, title, text, action = '') =>
    `<div class="empty"><div class="empty-emoji">${emoji}</div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>${action}</div>`;
  const loader = () => '<div class="page-loader"><span class="spinner"></span></div>';

  /* ---------------------- imágenes ---------------------- */
  function compressImage(src, max, quality) {
    return new Promise((res, rej) => {
      const url = src instanceof Blob ? URL.createObjectURL(src) : null;
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        if (url) URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { if (url) URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen.')); };
      img.src = url || src;
    });
  }

  /* ---------------------- autenticación ---------------------- */
  function openLogin(reason) {
    if (state.user) return;
    if (state.loginModal) return;
    const R = {
      publicar: 'Para publicar necesitas una cuenta. ¡Es gratis y toma segundos!',
      comprar: 'Inicia sesión para hacer tu pedido.',
      panel: 'Inicia sesión para ver tu panel de ventas.',
    };
    let mode = 'login';
    const m = openModal(`
      <div class="auth">
        <div class="auth-head">
          <span class="logo-mark lg">🛍️</span>
          <h2>Bienvenido a ${esc(C.appName)}</h2>
          <p class="muted">${esc(R[reason] || 'Inicia sesión o crea tu cuenta.')}</p>
        </div>
        <div class="auth-providers">
          <button type="button" class="btn btn-provider" data-prov="google">${GOOGLE}<span>Continuar con Google</span></button>
        </div>
        <div class="divider"><span>o con tu correo</span></div>
        <div class="segmented" role="tablist">
          <button type="button" class="active" data-mode="login">Iniciar sesión</button>
          <button type="button" data-mode="register">Crear cuenta</button>
        </div>
        <form class="auth-form" novalidate>
          <label class="field reg-only" hidden><span>Nombre</span><input name="name" autocomplete="name" placeholder="¿Cómo te llamas?" maxlength="60"></label>
          <label class="field"><span>Correo</span><input name="email" type="email" autocomplete="email" inputmode="email" placeholder="tucorreo@universidad.edu"></label>
          <label class="field"><span>Contraseña</span>
            <div class="pass-wrap"><input name="pass" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres">
            <button type="button" class="btn-icon" data-eye aria-label="Mostrar contraseña">${icon('eye')}</button></div>
          </label>
          <p class="form-error" hidden></p>
          <button class="btn btn-primary btn-block btn-lg" type="submit" data-submit>Entrar</button>
          <button type="button" class="link-btn login-only" data-forgot>¿Olvidaste tu contraseña?</button>
        </form>
        ${B.mode === 'demo' ? '<p class="demo-note">Modo demo: Google crea un usuario de prueba. Abre otra pestaña con otra cuenta para probar comprar y vender a la vez.</p>' : ''}
      </div>`, {
      cls: 'modal-auth',
      onClose: () => { state.loginModal = null; if (!state.user) state.afterLogin = null; },
    });
    state.loginModal = m;
    const el = m.el, form = $('form', el), F = form.elements, errEl = $('.form-error', el);
    const showErr = msg => { errEl.textContent = msg; errEl.hidden = !msg; };

    $('.segmented', el).onclick = e => {
      const b = e.target.closest('[data-mode]'); if (!b) return;
      mode = b.dataset.mode;
      $$('.segmented button', el).forEach(x => x.classList.toggle('active', x === b));
      $$('.reg-only', el).forEach(x => (x.hidden = mode !== 'register'));
      $$('.login-only', el).forEach(x => (x.hidden = mode === 'register'));
      $('[data-submit]', el).textContent = mode === 'register' ? 'Crear cuenta' : 'Entrar';
      F.pass.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
      showErr('');
      (mode === 'register' ? F.name : F.email).focus();
    };
    $('[data-eye]', el).onclick = () => { F.pass.type = F.pass.type === 'password' ? 'text' : 'password'; };

    $$('[data-prov]', el).forEach(btn => {
      btn.onclick = () => busy(btn, async () => {
        showErr('');
        try { await B.loginGoogle(); }
        catch (e) { const msg = errMsg(e); if (msg) showErr(msg); }
      });
    });

    form.onsubmit = e => {
      e.preventDefault();
      const name = F.name.value.trim(), email = F.email.value.trim(), pass = F.pass.value;
      if (mode === 'register' && name.length < 2) return showErr('Escribe tu nombre.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return showErr('Escribe un correo válido.');
      if (pass.length < 6) return showErr('La contraseña debe tener al menos 6 caracteres.');
      busy($('[data-submit]', el), async () => {
        showErr('');
        try {
          if (mode === 'register') {
            state.pendingName = name;
            const u = await B.register(name, email, pass);
            await B.saveProfile(u.uid, { name });
            state.profile = { ...(state.profile || {}), name };
            renderAccount();
            if (B.mode === 'firebase') toast('Cuenta creada. Te enviamos un correo de verificación.');
          } else {
            await B.loginEmail(email, pass);
          }
        } catch (err) { showErr(errMsg(err)); }
        finally { state.pendingName = null; }
      });
    };
    $('[data-forgot]', el).onclick = async () => {
      const email = F.email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return showErr('Escribe tu correo arriba y vuelve a tocar “¿Olvidaste tu contraseña?”.');
      try { await B.resetPassword(email); toast('Te enviamos un correo para restablecer tu contraseña.'); }
      catch (err) { showErr(errMsg(err)); }
    };
    setTimeout(() => F.email.focus({ preventScroll: true }), 300);
  }

  async function handleAuth(user) {
    const prevUid = state.user && state.user.uid;
    state.user = user;
    if (user) {
      try { state.profile = await B.getProfile(user.uid); } catch (e) { state.profile = null; }
      if (!state.profile) {
        state.profile = { name: state.pendingName || user.name, phone: '', faculty: '' };
        B.saveProfile(user.uid, state.profile).catch(() => {});
      }
      if (prevUid !== user.uid) startWatchers();
    } else {
      stopWatchers();
      state.profile = null;
    }
    renderAccount();
    const after = user ? state.afterLogin : null;
    if (user) { state.afterLogin = null; state.loginModal && state.loginModal.close(); }
    const firstRun = !state.ready;
    state.ready = true;
    if (firstRun || prevUid !== (user && user.uid)) router();
    if (user && prevUid !== user.uid && !firstRun) toast(`¡Hola, ${myName().split(' ')[0]}! 👋`);
    if (after) after();
  }

  async function logout() {
    await B.logout();
    toast('Cerraste sesión');
    location.hash = '#/';
  }

  function requireAuth(fn, reason) {
    if (state.user) return fn();
    view.innerHTML = `<div class="container">${emptyState('🔐', 'Inicia sesión para continuar',
      'Puedes ver todos los productos sin cuenta. Para publicar, comprar o ver tu panel necesitas iniciar sesión.',
      '<div class="empty-actions"><button class="btn btn-primary" id="gate-login">Iniciar sesión</button><a class="btn btn-ghost" href="#/">Seguir explorando</a></div>')}</div>`;
    $('#gate-login').onclick = () => openLogin(reason);
    openLogin(reason);
  }

  /* ---------------------- pedidos en tiempo real ---------------------- */
  function startWatchers() {
    stopWatchers();
    const uid = state.user.uid;
    state.ordersInit = { seller: false, buyer: false };
    state.unsubs.push(B.watchOrders('sellerId', uid, list => {
      const prev = new Set(state.sellerOrders.map(o => o.id));
      if (state.ordersInit.seller) {
        const fresh = list.filter(o => !prev.has(o.id) && o.status === 'pendiente');
        fresh.forEach(o => toast(`🛎️ Nuevo pedido: ${o.qty}× ${o.productTitle}`, 'info', 6000));
        if (fresh.length) chime();
      }
      state.sellerOrders = list; state.ordersInit.seller = true;
      updateBadges(); refreshPanel(['resumen', 'pedidos']);
    }));
    state.unsubs.push(B.watchOrders('buyerId', uid, list => {
      if (state.ordersInit.buyer) {
        const prev = new Map(state.buyerOrders.map(o => [o.id, o.status]));
        list.filter(o => prev.has(o.id) && prev.get(o.id) !== o.status && o.status !== 'cancelado')
          .forEach(o => toast(`Tu pedido de “${o.productTitle}” fue ${STATUS[o.status].label.toLowerCase()}`, o.status === 'rechazado' ? 'err' : 'info', 6000));
      }
      state.buyerOrders = list; state.ordersInit.buyer = true;
      refreshPanel(['compras']);
    }));
  }
  function stopWatchers() {
    state.unsubs.forEach(u => u && u());
    state.unsubs = []; state.sellerOrders = []; state.buyerOrders = [];
    updateBadges();
  }
  function refreshPanel(tabs) {
    if (state.panelTab && tabs.includes(state.panelTab) && $('#tab')) renderTab(state.panelTab);
  }
  function updateBadges() {
    const n = state.sellerOrders.filter(o => o.status === 'pendiente').length;
    $$('[data-badge]').forEach(b => { b.textContent = n; b.hidden = !n; });
    document.title = (n ? `(${n}) ` : '') + C.appName;
  }

  /* ---------------------- cabecera y navegación ---------------------- */
  function renderAccount() {
    const el = $('#account');
    if (!state.user) {
      el.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" id="btn-login">Iniciar sesión</button>';
      $('#btn-login').onclick = () => openLogin();
    } else {
      el.innerHTML = `<button type="button" class="account-btn" id="btn-acc" aria-haspopup="menu" aria-label="Mi cuenta">${avatar(myName(), state.user.photo)}</button>`;
      $('#btn-acc').onclick = toggleMenu;
    }
  }
  function toggleMenu(e) {
    e.stopPropagation();
    const old = $('.menu');
    if (old) return old.remove();
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="menu-head">${avatar(myName(), state.user.photo)}<div><strong>${esc(myName())}</strong><small>${esc(state.user.email)}</small></div></div>
      <a href="#/panel">${icon('grid')}Mi panel</a>
      <a href="#/panel/pedidos">${icon('inbox')}Pedidos recibidos</a>
      <a href="#/panel/compras">${icon('bag')}Mis compras</a>
      <a href="#/panel/perfil">${icon('user')}Mi perfil</a>
      <button type="button" data-logout>${icon('logout')}Cerrar sesión</button>`;
    $('#account').append(menu);
    menu.onclick = ev => { if (ev.target.closest('[data-logout]')) logout(); menu.remove(); };
    setTimeout(() => document.addEventListener('click', function h() { menu.remove(); document.removeEventListener('click', h); }), 0);
  }
  function updateNav(path) {
    const key = path === '/' || path.startsWith('/p/') ? 'home'
      : path === '/vender' || path.startsWith('/editar') ? 'vender'
      : path === '/panel/compras' ? 'compras'
      : path === '/panel/perfil' ? 'cuenta'
      : path.startsWith('/panel') ? 'panel' : '';
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === key));
  }

  /* ---------------------- router ---------------------- */
  function router() {
    if (!state.ready) return;
    const menu = $('.menu'); if (menu) menu.remove();
    const path = (location.hash.replace(/^#/, '') || '/').replace(/\/$/, '') || '/';
    state.panelTab = null;
    let m;
    if (path === '/') renderHome();
    else if ((m = path.match(/^\/p\/([\w-]+)$/))) renderProduct(m[1]);
    else if (path === '/vender') requireAuth(() => renderEditor(null), 'publicar');
    else if ((m = path.match(/^\/editar\/([\w-]+)$/))) requireAuth(() => renderEditor(m[1]), 'publicar');
    else if ((m = path.match(/^\/panel(?:\/(\w+))?$/))) requireAuth(() => renderPanel(m[1] || 'resumen'), 'panel');
    else view.innerHTML = `<div class="container">${emptyState('🧭', 'Página no encontrada', 'El enlace no existe o fue eliminado.', '<a class="btn btn-primary" href="#/">Ir al inicio</a>')}</div>`;
    updateNav(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------------- catálogo ---------------------- */
  const productCard = (p, href = `#/p/${p.id}`, { quick = false } = {}) => {
    const c = cat(p.category);
    const soldOut = p.stock === 0;
    const own = state.user && state.user.uid === p.sellerId;
    const canQuick = quick && !soldOut && !own && p.active !== false;
    return `<div class="card-wrap">
      <a class="card ${soldOut ? 'sold' : ''}" href="${href}">
        <div class="card-media" style="--c:${c.color}">${media(p)}
          ${soldOut ? '<span class="card-badge">Agotado</span>' : p.stock != null && p.stock <= 3 ? `<span class="card-badge hot">¡Quedan ${p.stock}!</span>` : ''}
          ${isPre(p) ? '<span class="card-mode">📅 Pre-orden</span>' : ''}
        </div>
        <div class="card-body">
          <div class="card-price">${money(p.price)}</div>
          <h3 class="card-title">${esc(p.title || 'Sin título')}</h3>
          <div class="card-meta">${p.spot ? `${icon('pin')}<span>${esc(p.spot)}</span>` : `<span>${c.emoji} ${esc(p.sub || c.label)}</span>`}</div>
          <div class="card-seller">${avatar(p.sellerName, p.sellerPhoto, 'xs')}<span>${esc(p.sellerName || '')}</span><time>${timeAgo(p.createdAt)}</time></div>
        </div>
      </a>
      ${canQuick ? `<button type="button" class="quick-buy" data-quick="${p.id}" aria-label="Pedir ${esc(p.title)}">${icon('plus')}</button>` : ''}
    </div>`;
  };

  // Abre el pedido directo desde el catálogo (pide sesión si hace falta).
  function startOrder(p) {
    if (!state.user) { state.afterLogin = () => openOrder(p); openLogin('comprar'); }
    else openOrder(p);
  }

  // El catálogo se mantiene sincronizado en tiempo real para todos los visitantes.
  function watchCatalog() {
    B.watchProducts(list => {
      state.products = list; state.productsLoaded = true; state.productsError = null;
      if ($('#grid')) drawGrid();
    }, e => {
      state.productsError = e;
      if ($('#grid')) drawGrid();
    });
  }

  const subChips = () => {
    const c = C.categories.find(x => x.id === state.filter.cat);
    if (!c || !(c.subs || []).length) return '';
    return `<button class="chip ${state.filter.sub === 'all' ? 'active' : ''}" data-sub="all">Todos</button>`
      + c.subs.map(s => `<button class="chip ${state.filter.sub === s ? 'active' : ''}" data-sub="${esc(s)}">${esc(s)}</button>`).join('');
  };

  function renderHome() {
    const f = state.filter;
    view.innerHTML = `
      <section class="hero">
        <div class="hero-inner">
          <span class="eyebrow">${esc(C.universityName)}</span>
          <h1>Compra y vende <span class="hl">dentro del campus</span></h1>
          <p class="hero-sub">Todo lo que antes buscabas en mil grupos de WhatsApp, ahora en un solo lugar.</p>
          <label class="search">${icon('search')}<input id="q" type="search" enterkeyhint="search" placeholder="Busca brownies, apuntes, calculadoras…" value="${esc(f.q)}" autocomplete="off"></label>
          <div class="hero-stats" id="hero-stats"></div>
        </div>
      </section>
      <div class="container">
        <div class="chips" id="cats">
          <button class="chip ${f.cat === 'all' ? 'active' : ''}" data-cat="all">🔥 Todo</button>
          ${C.categories.map(c => `<button class="chip ${f.cat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.label)}</button>`).join('')}
        </div>
        <div class="chips sub" id="subs">${subChips()}</div>
        <div class="toolbar">
          <span id="count" class="muted"></span>
          <div class="toolbar-right">
            <label class="select-wrap"><span class="sr-only">Modalidad</span>
              <select id="mode">
                <option value="all" ${f.mode === 'all' ? 'selected' : ''}>Toda modalidad</option>
                <option value="inmediato" ${f.mode === 'inmediato' ? 'selected' : ''}>⚡ Inmediato</option>
                <option value="preorden" ${f.mode === 'preorden' ? 'selected' : ''}>📅 Pre-orden</option>
              </select>
            </label>
            <label class="select-wrap"><span class="sr-only">Ordenar</span>
              <select id="sort">
                <option value="new" ${f.sort === 'new' ? 'selected' : ''}>Más recientes</option>
                <option value="low" ${f.sort === 'low' ? 'selected' : ''}>Menor precio</option>
                <option value="high" ${f.sort === 'high' ? 'selected' : ''}>Mayor precio</option>
              </select>
            </label>
          </div>
        </div>
        <div class="grid" id="grid">${'<div class="card skel"><div class="card-media"></div><div class="card-body"><i></i><i></i><i></i></div></div>'.repeat(8)}</div>
      </div>`;
    const q = $('#q');
    q.oninput = debounce(() => { f.q = q.value.trim(); drawGrid(); }, 120);
    $('#cats').onclick = e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      f.cat = b.dataset.cat; f.sub = 'all';
      $$('#cats .chip').forEach(x => x.classList.toggle('active', x === b));
      b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      $('#subs').innerHTML = subChips();
      drawGrid();
    };
    $('#subs').onclick = e => {
      const b = e.target.closest('[data-sub]'); if (!b) return;
      f.sub = b.dataset.sub;
      $$('#subs .chip').forEach(x => x.classList.toggle('active', x === b));
      drawGrid();
    };
    $('#sort').onchange = e => { f.sort = e.target.value; drawGrid(); };
    $('#mode').onchange = e => { f.mode = e.target.value; drawGrid(); };
    $('#grid').onclick = e => {
      const b = e.target.closest('[data-quick]'); if (!b) return;
      e.preventDefault();
      const p = state.products.find(x => x.id === b.dataset.quick);
      if (p) startOrder(p);
    };
    if (state.productsLoaded || state.productsError) drawGrid();
  }

  function drawGrid() {
    const f = state.filter, g = $('#grid');
    if (!g) return;
    if (state.productsError && !state.productsLoaded) {
      g.innerHTML = emptyState('⚠️', 'No pudimos cargar los productos', errMsg(state.productsError));
      return;
    }
    const q = normTxt(f.q);
    const visible = state.products.filter(p => p.active !== false);
    let list = visible.filter(p => (f.cat === 'all' || p.category === f.cat)
      && (f.sub === 'all' || p.sub === f.sub)
      && (f.mode === 'all' || (f.mode === 'preorden') === isPre(p))
      && (!q || normTxt(`${p.title} ${p.description} ${p.sellerName} ${p.spot} ${p.sub || ''}`).includes(q)));
    if (f.sort === 'low') list.sort((a, b) => a.price - b.price);
    else if (f.sort === 'high') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    $('#count').textContent = `${list.length} ${list.length === 1 ? 'producto' : 'productos'}`;
    const filtered = f.q || f.cat !== 'all' || f.mode !== 'all';
    g.innerHTML = list.length ? list.map(p => productCard(p, undefined, { quick: true })).join('')
      : emptyState('🔎', 'No encontramos nada', filtered ? 'Prueba con otra búsqueda, categoría o modalidad.' : 'Todavía no hay publicaciones. ¡Sé el primero en vender!',
        '<a class="btn btn-primary" href="#/vender">Publicar algo</a>');
    const sellers = new Set(visible.map(p => p.sellerId)).size;
    const hs = $('#hero-stats');
    if (hs) hs.innerHTML = `<span><b>${visible.length}</b> productos</span><span><b>${sellers}</b> vendedores</span><span><span class="live-dot"></span>En vivo</span>`;
  }

  /* ---------------------- detalle de producto ---------------------- */
  async function renderProduct(id) {
    view.innerHTML = loader();
    let p;
    try { p = await B.getProduct(id); } catch (e) { console.error(e); }
    if (!p) {
      view.innerHTML = `<div class="container">${emptyState('🫥', 'Esta publicación ya no existe', 'Puede que el vendedor la haya eliminado.', '<a class="btn btn-primary" href="#/">Ver otros productos</a>')}</div>`;
      return;
    }
    const own = state.user && state.user.uid === p.sellerId;
    const c = cat(p.category);
    const soldOut = p.stock === 0, paused = p.active === false;
    const wa = waLink(p.phone, `Hola ${p.sellerName}, vi tu publicación “${p.title}” en ${C.appName}. ¿Sigue disponible?`);
    view.innerHTML = `
      <div class="container detail">
        <button type="button" class="back-link" id="back">${icon('back')} Volver</button>
        <div class="detail-grid">
          <div class="gallery">
            <div class="gallery-main" style="--c:${c.color}">${media(p)}</div>
            <div class="gallery-thumbs" id="thumbs"></div>
          </div>
          <div class="detail-info">
            <div class="detail-top">
              <div class="pills"><a class="pill" style="--c:${c.color}" href="#/" data-cat-link="${c.id}">${c.emoji} ${esc(p.sub || c.label)}</a>${modeBadge(p)}</div>
              <button type="button" class="btn-icon" id="share" aria-label="Compartir">${icon('share')}</button>
            </div>
            <h1 class="detail-title">${esc(p.title)}</h1>
            <div class="detail-price">${money(p.price)}</div>
            ${paused ? '<div class="notice warn">Esta publicación está pausada y no aparece en el catálogo.</div>' : ''}
            ${isPre(p) && !paused ? '<div class="notice info">📅 Se prepara sobre pedido: al pedir eliges el día y la hora de entrega.</div>' : ''}
            <ul class="facts">
              ${p.spot ? `<li>${icon('pin')}<div><small>Entrega en</small><strong>${esc(p.spot)}</strong></div></li>` : ''}
              ${p.schedule ? `<li>${icon('clock')}<div><small>Horario</small><strong>${esc(p.schedule)}</strong></div></li>` : ''}
              <li>${icon('box')}<div><small>Disponibles</small><strong>${isPre(p) ? 'Sobre pedido' : p.stock == null ? 'Sin límite' : soldOut ? 'Agotado' : p.stock}</strong></div></li>
            </ul>
            ${p.description ? `<div class="desc"><h3>Descripción</h3><p>${esc(p.description).replace(/\n/g, '<br>')}</p></div>` : ''}
            <div class="seller-card">
              ${avatar(p.sellerName, p.sellerPhoto, 'lg')}
              <div><small class="muted">Vendido por</small><strong>${esc(p.sellerName)}</strong><span class="muted small">Publicado ${timeAgo(p.createdAt)}</span></div>
            </div>
            <div class="buy-bar">
              ${own
                ? `<a class="btn btn-primary btn-lg grow" href="#/editar/${p.id}">${icon('edit')} Editar publicación</a>`
                : `<div class="buy-price"><small>Precio</small><strong>${money(p.price)}</strong></div>
                   <button type="button" class="btn btn-primary btn-lg grow" id="buy" ${soldOut || paused ? 'disabled' : ''}>${icon('bag')} ${soldOut ? 'Agotado' : 'Pedir ahora'}</button>
                   ${wa ? `<a class="btn btn-wa btn-lg" target="_blank" rel="noopener" href="${esc(wa)}" aria-label="Escribir por WhatsApp">${icon('chat')}</a>` : ''}`}
            </div>
          </div>
        </div>
      </div>`;
    $('#back').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
    $('[data-cat-link]').onclick = () => { state.filter.cat = c.id; };
    $('#share').onclick = async () => {
      const url = location.href;
      try {
        if (navigator.share) await navigator.share({ title: p.title, text: `${p.title} · ${money(p.price)}`, url });
        else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
      } catch {}
    };
    const buy = $('#buy');
    if (buy) buy.onclick = () => startOrder(p);
    B.getImages(id).then(imgs => { if (imgs.length && $('.gallery-main')) mountGallery(imgs); }).catch(() => {});
  }

  function mountGallery(imgs) {
    const main = $('.gallery-main'), thumbs = $('#thumbs');
    main.innerHTML = `<div class="track">${imgs.map(s => `<img src="${esc(s)}" alt="">`).join('')}</div>
      ${imgs.length > 1 ? `<div class="dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}`;
    thumbs.innerHTML = imgs.length > 1 ? imgs.map((s, i) => `<button type="button" class="${i ? '' : 'on'}" data-i="${i}"><img src="${esc(s)}" alt=""></button>`).join('') : '';
    const track = $('.track', main);
    thumbs.onclick = e => { const b = e.target.closest('[data-i]'); if (b) track.scrollTo({ left: track.clientWidth * b.dataset.i, behavior: 'smooth' }); };
    track.addEventListener('scroll', debounce(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      $$('.dots i', main).forEach((d, k) => d.classList.toggle('on', k === i));
      $$('button', thumbs).forEach((d, k) => d.classList.toggle('on', k === i));
    }, 50));
  }

  /* ---------------------- hacer pedido ---------------------- */
  function openOrder(p) {
    if (state.user.uid === p.sellerId) return toast('Esta es tu propia publicación', 'err');
    const pre = isPre(p);
    const max = pre || p.stock == null ? 50 : p.stock;
    const minPickup = Date.now() + 60 * 60e3;
    if (max <= 0) return toast('Este producto está agotado', 'err');
    let qty = 1;
    const spots = [...new Set([p.spot, ...C.campusSpots].filter(Boolean)), 'Por acordar'];
    const m = openModal(`
      <form class="order-form" novalidate>
        <h2>Hacer pedido</h2>
        <div class="order-item">
          <div class="order-thumb" style="--c:${cat(p.category).color}">${media(p)}</div>
          <div><strong>${esc(p.title)}</strong><span class="muted small">${money(p.price)} c/u · ${esc(p.sellerName)}</span>${modeBadge(p)}</div>
        </div>
        <div class="field"><span>Cantidad</span>
          <div class="stepper"><button type="button" data-step="-1" aria-label="Menos">−</button><output id="qty">1</output><button type="button" data-step="1" aria-label="Más">+</button>
          ${p.stock != null ? `<small class="muted">${p.stock} disponibles</small>` : ''}</div>
        </div>
        ${pre ? `<label class="field"><span>¿Para cuándo lo quieres? *</span>
          <input name="pickup" type="datetime-local" min="${toLocalInput(minPickup)}" value="${toLocalInput(Date.now() + 24 * 3600e3)}">
          ${p.schedule ? `<small class="muted">Horario del vendedor: ${esc(p.schedule)}</small>` : ''}</label>` : ''}
        <label class="field"><span>Punto de entrega</span>
          <select name="spot">${spots.map(s => `<option>${esc(s)}</option>`).join('')}</select></label>
        <div class="field"><span>Método de pago</span>
          <div class="choice">${C.paymentMethods.map((x, i) => `<label><input type="radio" name="pay" value="${esc(x)}" ${i ? '' : 'checked'}><span>${i ? icon('cash') : '💵'} ${esc(x)}</span></label>`).join('')}</div></div>
        <label class="field"><span>Tu WhatsApp <em>para que te contacten</em></span>
          <input name="phone" type="tel" inputmode="tel" value="${esc((state.profile && state.profile.phone) || '')}" placeholder="Ej. 5512345678"></label>
        <label class="field"><span>Nota para el vendedor <em>opcional</em></span>
          <textarea name="note" rows="2" maxlength="300" placeholder="Ej. Salgo de clase a las 12, ¿nos vemos en la biblioteca?"></textarea></label>
        <div class="order-total"><span>Total</span><strong id="total">${money(p.price)}</strong></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" data-submit>Confirmar pedido</button>
        <p class="muted small center">Pagas en persona cuando recibas tu producto.</p>
      </form>`, { cls: 'modal-sheet' });
    const form = $('form', m.el), F = form.elements;
    const sync = () => {
      $('#qty', m.el).textContent = qty;
      $('#total', m.el).textContent = money(p.price * qty);
      $('[data-step="-1"]', m.el).disabled = qty <= 1;
      $('[data-step="1"]', m.el).disabled = qty >= max;
    };
    sync();
    $('.stepper', m.el).onclick = e => {
      const b = e.target.closest('[data-step]'); if (!b) return;
      qty = Math.min(max, Math.max(1, qty + Number(b.dataset.step)));
      sync();
      const out = $('#qty', m.el); out.classList.remove('bump'); void out.offsetWidth; out.classList.add('bump');
    };
    form.onsubmit = e => {
      e.preventDefault();
      let pickupAt = null;
      if (pre) {
        pickupAt = F.pickup.value ? new Date(F.pickup.value).getTime() : NaN;
        if (!(pickupAt >= minPickup - 60e3)) { toast('Elige una fecha y hora de entrega (mínimo 1 hora a partir de ahora)', 'err'); F.pickup.focus(); return; }
      }
      busy($('[data-submit]', m.el), async () => {
        const phone = F.phone.value.trim();
        const order = {
          productId: p.id, productTitle: p.title, productThumb: p.thumb || '', category: p.category,
          price: Number(p.price), qty, total: Number(p.price) * qty,
          sellerId: p.sellerId, sellerName: p.sellerName, sellerPhone: p.phone || '',
          buyerId: state.user.uid, buyerName: myName(), buyerEmail: state.user.email, buyerPhone: phone,
          spot: F.spot.value, payment: F.pay.value, note: F.note.value.trim(), status: 'pendiente',
          mode: pre ? 'preorden' : 'inmediato', pickupAt, buyerCode: (state.profile && state.profile.studentCode) || '',
        };
        try {
          await B.createOrder(order);
          if (phone && state.profile && !state.profile.phone) {
            state.profile.phone = phone;
            B.saveProfile(state.user.uid, { phone }).catch(() => {});
          }
          m.close();
          orderSuccess(order);
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    };
  }

  function orderSuccess(o) {
    const wa = waLink(o.sellerPhone, `Hola ${o.sellerName}, te hice un pedido en ${C.appName}: ${o.qty}× ${o.productTitle} (${money(o.total)}). Entrega: ${o.spot}${o.pickupAt ? ', ' + fmtDate(o.pickupAt) : ''}.`);
    const m = openModal(`
      <div class="success">
        <div class="success-check">${icon('check')}</div>
        <h2>¡Pedido enviado!</h2>
        <p class="muted">${esc(o.sellerName)} recibió tu pedido de <b>${o.qty}× ${esc(o.productTitle)}</b>${o.pickupAt ? ` para el <b>${esc(fmtDate(o.pickupAt))}</b>` : ''}. Te avisaremos aquí cuando lo acepte.</p>
        <div class="success-actions">
          ${wa ? `<a class="btn btn-wa btn-block" href="${esc(wa)}" target="_blank" rel="noopener">${icon('chat')} Avisar por WhatsApp</a>` : ''}
          <a class="btn btn-primary btn-block" href="#/panel/compras" data-close>Ver mis compras</a>
          <button type="button" class="btn btn-ghost btn-block" data-close>Seguir comprando</button>
        </div>
      </div>`, { cls: 'modal-sm' });
    return m;
  }

  /* ---------------------- crear / editar publicación ---------------------- */
  async function renderEditor(id) {
    view.innerHTML = loader();
    let p = { title: '', price: '', category: C.categories[0].id, sub: '', mode: 'inmediato', description: '', stock: null, spot: '', schedule: '', phone: (state.profile && state.profile.phone) || '', active: true };
    let images = [];
    if (id) {
      try { p = await B.getProduct(id); } catch { p = null; }
      if (!p || p.sellerId !== state.user.uid) {
        view.innerHTML = `<div class="container">${emptyState('🚫', 'No puedes editar esta publicación', 'Solo el vendedor puede editarla.', '<a class="btn btn-primary" href="#/panel/publicaciones">Mis publicaciones</a>')}</div>`;
        return;
      }
      images = await B.getImages(id).catch(() => []);
      if (!images.length && p.thumb) images = [p.thumb];
    }
    const MAX_IMG = 4;
    view.innerHTML = `
      <div class="container editor">
        <div class="page-head">
          <a class="back-link" href="#/panel/publicaciones">${icon('back')} Mis publicaciones</a>
          <h1>${id ? 'Editar publicación' : 'Nueva publicación'}</h1>
          <p class="muted">${id ? 'Los cambios se ven al instante en el catálogo.' : 'Llena los datos y tu producto aparecerá al instante en el catálogo.'}</p>
        </div>
        <div class="editor-grid">
          <form id="ed" class="surface" novalidate>
            <section class="form-sec">
              <h3>Fotos <small class="muted" id="img-count"></small></h3>
              <div class="uploader" id="up"></div>
              <input type="file" id="file" accept="image/*" multiple hidden>
              <p class="hint">La primera foto es la portada. Toca ★ para cambiarla.</p>
            </section>
            <section class="form-sec">
              <h3>Información</h3>
              <label class="field"><span>Título *</span><input name="title" maxlength="80" placeholder="Ej. Brownies de chocolate (caja de 4)"></label>
              <div class="field"><span>Modalidad</span>
                <div class="choice mode-choice">
                  <label><input type="radio" name="mode" value="inmediato"><span>⚡ Inmediato<small>Ya lo tienes listo</small></span></label>
                  <label><input type="radio" name="mode" value="preorden"><span>📅 Pre-orden<small>Lo preparas sobre pedido</small></span></label>
                </div>
              </div>
              <div class="row2">
                <label class="field"><span>Precio *</span><div class="input-prefix"><b>${esc(C.currencySymbol)}</b><input name="price" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></div></label>
                <label class="field" id="stock-field"><span>Disponibles</span><input name="stock" type="number" inputmode="numeric" min="0" step="1" placeholder="Sin límite"></label>
                <div class="field pre-note" id="pre-note" hidden><span>Disponibles</span><p>Sin límite: el comprador elige fecha y hora.</p></div>
              </div>
              <div class="field"><span>Categoría *</span>
                <div class="cat-picker">${C.categories.map(c => `<label><input type="radio" name="category" value="${c.id}"><span>${c.emoji} ${esc(c.label)}</span></label>`).join('')}</div>
              </div>
              <label class="field" id="sub-field"><span>Estilo / subcategoría</span><select name="sub"></select></label>
              <label class="field"><span>Descripción</span><textarea name="description" rows="4" maxlength="1000" placeholder="Cuenta los detalles: sabor, estado, talla, qué incluye…"></textarea><small class="counter" id="cnt"></small></label>
            </section>
            <section class="form-sec">
              <h3>Entrega y contacto</h3>
              <label class="field"><span>Punto de entrega</span><input name="spot" list="spots" maxlength="60" placeholder="Ej. Biblioteca"><datalist id="spots">${C.campusSpots.map(s => `<option value="${esc(s)}">`).join('')}</datalist></label>
              <label class="field"><span>Horario</span><input name="schedule" maxlength="60" placeholder="Ej. Lun a Vie, 10:00 a 14:00"></label>
              <label class="field"><span>WhatsApp <em>opcional, para que te escriban</em></span><input name="phone" type="tel" inputmode="tel" maxlength="20" placeholder="Ej. 5512345678"></label>
              <label class="switch-row"><div><strong>Publicación activa</strong><small class="muted">Si la pausas, no aparecerá en el catálogo.</small></div>
                <span class="switch"><input type="checkbox" name="active"><i></i></span></label>
            </section>
            <p class="form-error" hidden></p>
            <div class="form-actions">
              ${id ? `<button type="button" class="btn btn-danger-ghost" id="del">${icon('trash')}<span class="hide-xs">Eliminar</span></button>` : ''}
              <span class="grow"></span>
              <a class="btn btn-ghost" href="#/panel/publicaciones">Cancelar</a>
              <button class="btn btn-primary" type="submit" data-submit>${id ? 'Guardar cambios' : 'Publicar'}</button>
            </div>
          </form>
          <aside class="preview"><h3>Vista previa</h3><div id="pv"></div></aside>
        </div>
      </div>`;
    const form = $('#ed'), F = form.elements, up = $('#up'), file = $('#file'), errEl = $('.form-error', form);
    F.title.value = p.title || '';
    F.price.value = p.price ?? '';
    F.stock.value = p.stock ?? '';
    F.category.value = p.category;
    F.mode.value = p.mode === 'preorden' ? 'preorden' : 'inmediato';
    const fillSubs = keep => {
      const subs = cat(F.category.value).subs || [];
      $('#sub-field').hidden = !subs.length;
      F.sub.innerHTML = '<option value="">Sin especificar</option>' + subs.map(x => `<option>${esc(x)}</option>`).join('');
      F.sub.value = subs.includes(keep) ? keep : '';
    };
    const syncMode = () => {
      const pre = F.mode.value === 'preorden';
      $('#stock-field').hidden = pre;
      $('#pre-note').hidden = !pre;
    };
    fillSubs(p.sub);
    syncMode();
    F.description.value = p.description || '';
    F.spot.value = p.spot || '';
    F.schedule.value = p.schedule || '';
    F.phone.value = p.phone || '';
    F.active.checked = p.active !== false;

    const collect = () => ({
      title: F.title.value.trim(),
      price: F.price.value === '' ? '' : Number(F.price.value),
      stock: F.mode.value === 'preorden' || F.stock.value === '' ? null : Math.max(0, Math.floor(Number(F.stock.value))),
      category: F.category.value,
      sub: F.sub.value,
      mode: F.mode.value,
      description: F.description.value.trim(),
      spot: F.spot.value.trim(),
      schedule: F.schedule.value.trim(),
      phone: F.phone.value.trim(),
      active: F.active.checked,
    });
    const preview = () => {
      const d = collect();
      $('#pv').innerHTML = productCard({ ...d, title: d.title || 'Título de tu producto', price: d.price || 0, thumb: images[0] || '', sellerName: myName(), sellerPhoto: state.user.photo, createdAt: Date.now() }, 'javascript:void 0');
      $('#cnt').textContent = `${F.description.value.length}/1000`;
    };
    const drawUp = () => {
      up.innerHTML = images.map((s, i) => `
        <div class="up-item">
          <img src="${esc(s)}" alt="">
          ${i === 0 ? '<span class="up-tag">Portada</span>' : `<button type="button" class="up-cover" data-cover="${i}" aria-label="Usar como portada">${icon('star')}</button>`}
          <button type="button" class="up-del" data-del="${i}" aria-label="Quitar foto">${icon('x')}</button>
        </div>`).join('')
        + (images.length < MAX_IMG ? `<button type="button" class="up-add" data-add>${icon('image')}<span>Agregar foto</span></button>` : '');
      $('#img-count').textContent = `${images.length}/${MAX_IMG}`;
      preview();
    };
    const addFiles = async files => {
      const list = [...files].filter(f => f.type.startsWith('image/')).slice(0, MAX_IMG - images.length);
      if (!list.length) return;
      up.classList.add('working');
      try { for (const f of list) images.push(await compressImage(f, 1000, 0.72)); }
      catch (e) { toast(e.message, 'err'); }
      up.classList.remove('working');
      drawUp();
    };
    up.onclick = e => {
      if (e.target.closest('[data-add]')) return file.click();
      const del = e.target.closest('[data-del]');
      if (del) { images.splice(Number(del.dataset.del), 1); return drawUp(); }
      const cov = e.target.closest('[data-cover]');
      if (cov) { const [img] = images.splice(Number(cov.dataset.cover), 1); images.unshift(img); drawUp(); }
    };
    file.onchange = () => { addFiles(file.files); file.value = ''; };
    up.ondragover = e => { e.preventDefault(); up.classList.add('drag'); };
    up.ondragleave = () => up.classList.remove('drag');
    up.ondrop = e => { e.preventDefault(); up.classList.remove('drag'); addFiles(e.dataTransfer.files); };
    const pulse = debounce(() => {
      const card = $('#pv .card'); if (!card) return;
      card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse');
    }, 60);
    form.oninput = () => { preview(); pulse(); };
    form.onchange = e => {
      if (e.target.name === 'category') fillSubs('');
      if (e.target.name === 'mode') syncMode();
      preview(); pulse();
    };
    drawUp();

    if (id) $('#del').onclick = async () => {
      if (await deleteProduct(id, p.title)) location.hash = '#/panel/publicaciones';
    };

    form.onsubmit = e => {
      e.preventDefault();
      const d = collect();
      const fail = (msg, el) => { errEl.textContent = msg; errEl.hidden = false; el && el.focus(); };
      errEl.hidden = true;
      if (d.title.length < 3) return fail('Escribe un título de al menos 3 letras.', F.title);
      if (d.price === '' || !(d.price >= 0)) return fail('Escribe un precio válido.', F.price);
      busy($('[data-submit]', form), async () => {
        try {
          const thumb = images[0] ? await compressImage(images[0], 420, 0.7) : '';
          const data = { ...d, thumb, sellerId: state.user.uid, sellerName: myName(), sellerPhoto: state.user.photo || '' };
          let pid = id;
          if (id) await B.updateProduct(id, data);
          else pid = await B.createProduct(data);
          await B.setImages(pid, images, state.user.uid);
          if (d.phone && state.profile && !state.profile.phone) {
            state.profile.phone = d.phone;
            B.saveProfile(state.user.uid, { phone: d.phone }).catch(() => {});
          }
          toast(id ? 'Cambios guardados ✨' : '¡Publicado! Ya aparece en el catálogo 🎉');
          location.hash = id ? '#/panel/publicaciones' : `#/p/${pid}`;
        } catch (err) { console.error(err); fail(errMsg(err)); }
      });
    };
  }

  async function deleteProduct(id, title) {
    const ok = await confirmDialog({ title: '¿Eliminar publicación?', text: `“${title}” se eliminará para siempre. Los pedidos anteriores se conservan.`, ok: 'Eliminar', danger: true });
    if (!ok) return false;
    try {
      await B.deleteProduct(id);
      state.products = state.products.filter(p => p.id !== id);
      state.myProducts = state.myProducts.filter(p => p.id !== id);
      toast('Publicación eliminada');
      return true;
    } catch (e) { toast(errMsg(e), 'err'); return false; }
  }

  /* ---------------------- panel de control ---------------------- */
  const TABS = [
    ['resumen', 'Resumen', 'grid'],
    ['publicaciones', 'Publicaciones', 'box'],
    ['pedidos', 'Pedidos', 'inbox'],
    ['compras', 'Mis compras', 'bag'],
    ['perfil', 'Perfil', 'user'],
  ];
  function renderPanel(tab) {
    if (!TABS.some(t => t[0] === tab)) tab = 'resumen';
    view.innerHTML = `
      <div class="container panel">
        <div class="panel-head">
          <div class="panel-hello">${avatar(myName(), state.user.photo, 'lg')}<div><h1>Hola, ${esc(myName().split(' ')[0])}</h1><p class="muted">Administra tus ventas y compras</p></div></div>
          <a class="btn btn-primary hide-mobile" href="#/vender">${icon('plus')} Nueva publicación</a>
        </div>
        <nav class="tabs" id="tabs">${TABS.map(([k, label, ic]) => `<a href="#/panel/${k}" class="${k === tab ? 'active' : ''}">${icon(ic)}${label}${k === 'pedidos' ? '<span class="badge" data-badge hidden></span>' : ''}</a>`).join('')}</nav>
        <div id="tab" class="tab-body"></div>
      </div>`;
    const active = $('#tabs .active');
    active && active.scrollIntoView({ inline: 'center', block: 'nearest' });
    updateBadges();
    state.panelTab = tab;
    renderTab(tab, true);
  }
  function renderTab(tab, fresh) {
    const el = $('#tab');
    ({ resumen: tabResumen, publicaciones: tabPublicaciones, pedidos: tabPedidos, compras: tabCompras, perfil: tabPerfil })[tab](el, fresh);
  }

  const stat = (label, value, ic, tone) => `<div class="stat ${tone}"><span class="stat-ic">${icon(ic)}</span><div><strong>${value}</strong><small>${label}</small></div></div>`;

  async function loadMine(force) {
    if (force || !state.myProducts.length) state.myProducts = await B.myProducts(state.user.uid);
    return state.myProducts;
  }

  async function tabResumen(el, fresh) {
    if (fresh) el.innerHTML = loader();
    let mine = state.myProducts;
    try { mine = await loadMine(fresh); } catch (e) { console.error(e); }
    if (state.panelTab !== 'resumen') return;
    const so = state.sellerOrders;
    const pending = so.filter(o => o.status === 'pendiente');
    const delivered = so.filter(o => o.status === 'entregado');
    const revenue = delivered.reduce((s, o) => s + Number(o.total || 0), 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todays = so.filter(o => o.createdAt >= today.getTime() && o.status !== 'cancelado' && o.status !== 'rechazado');
    const todayTotal = todays.reduce((s, o) => s + Number(o.total || 0), 0);
    el.innerHTML = `
      <div class="stats">
        <div class="stat wide hero-stat"><span class="stat-ic">${icon('cash')}</span><div><small>Ventas de hoy</small><strong>${money(todayTotal)}</strong><small>${todays.length} ${todays.length === 1 ? 'pedido' : 'pedidos'} hoy · ${todays.filter(o => o.status === 'entregado').length} entregado(s)</small></div></div>
        ${stat('Publicaciones activas', mine.filter(p => p.active !== false).length, 'box', 'brand')}
        ${stat('Pedidos pendientes', pending.length, 'bell', 'warn')}
        ${stat('Ventas entregadas', delivered.length, 'check', 'ok')}
        ${stat('Ingresos totales', money(revenue), 'cash', 'info')}
      </div>
      <div class="two-col">
        <section class="surface">
          <div class="sec-head"><h3>Pedidos por atender</h3><a href="#/panel/pedidos">Ver todos</a></div>
          ${pending.length ? `<div class="orders">${pending.slice(0, 3).map(o => orderCard(o, 'seller')).join('')}</div>`
            : emptyState('📭', 'Sin pedidos pendientes', 'Cuando alguien te compre, lo verás aquí al instante.')}
        </section>
        <section class="surface">
          <div class="sec-head"><h3>Tus publicaciones</h3><a href="#/panel/publicaciones">Administrar</a></div>
          ${mine.length ? `<div class="mini-list">${mine.slice(0, 5).map(p => `
              <a class="mini" href="#/p/${p.id}"><span class="mini-thumb" style="--c:${cat(p.category).color}">${media(p)}</span>
              <span class="grow"><b>${esc(p.title)}</b><small class="muted">${money(p.price)} · ${p.active === false ? 'Pausada' : p.stock === 0 ? 'Agotado' : 'Activa'}</small></span></a>`).join('')}</div>`
            : emptyState('🛒', 'Aún no vendes nada', 'Publica tu primer producto en menos de un minuto.', '<a class="btn btn-primary" href="#/vender">Publicar</a>')}
        </section>
      </div>`;
  }

  async function tabPublicaciones(el, fresh) {
    if (fresh) el.innerHTML = loader();
    try { await loadMine(true); } catch (e) { el.innerHTML = emptyState('⚠️', 'Error al cargar', errMsg(e)); return; }
    if (state.panelTab !== 'publicaciones') return;
    const draw = () => {
      const mine = state.myProducts;
      const count = id => state.sellerOrders.filter(o => o.productId === id && o.status !== 'cancelado' && o.status !== 'rechazado').length;
      el.innerHTML = `
        <div class="sec-head"><h3>${mine.length} ${mine.length === 1 ? 'publicación' : 'publicaciones'}</h3><a class="btn btn-primary btn-sm" href="#/vender">${icon('plus')} Nueva</a></div>
        ${mine.length ? `<div class="prod-list">${mine.map(p => `
          <div class="prod-row ${p.active === false ? 'paused' : ''}">
            <a class="pr-thumb" href="#/p/${p.id}" style="--c:${cat(p.category).color}">${media(p)}</a>
            <div class="pr-info">
              <a href="#/p/${p.id}" class="pr-title">${esc(p.title)}</a>
              <div class="pr-meta"><b>${money(p.price)}</b><span>${p.stock == null ? 'Sin límite' : p.stock === 0 ? '<em class="txt-danger">Agotado</em>' : `${p.stock} disp.`}</span><span>${count(p.id)} ${count(p.id) === 1 ? "pedido" : "pedidos"}</span></div>
            </div>
            <label class="switch" title="${p.active === false ? 'Pausada' : 'Activa'}"><input type="checkbox" data-toggle="${p.id}" ${p.active !== false ? 'checked' : ''} aria-label="Activa"><i></i></label>
            <a class="btn-icon" href="#/editar/${p.id}" aria-label="Editar">${icon('edit')}</a>
            <button type="button" class="btn-icon danger" data-del="${p.id}" aria-label="Eliminar">${icon('trash')}</button>
          </div>`).join('')}</div>`
          : emptyState('📦', 'No tienes publicaciones', 'Publica lo que vendes y llega a toda la universidad.', '<a class="btn btn-primary" href="#/vender">Publicar mi primer producto</a>')}`;
    };
    draw();
    el.onchange = async e => {
      const t = e.target.closest('[data-toggle]'); if (!t) return;
      const id = t.dataset.toggle, active = t.checked;
      try {
        await B.updateProduct(id, { active });
        const p = state.myProducts.find(x => x.id === id); if (p) p.active = active;
        t.closest('.prod-row').classList.toggle('paused', !active);
        toast(active ? 'Publicación activada' : 'Publicación pausada', 'info');
      } catch (err) { t.checked = !active; toast(errMsg(err), 'err'); }
    };
    el.onclick = async e => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      const p = state.myProducts.find(x => x.id === d.dataset.del);
      if (p && await deleteProduct(p.id, p.title)) draw();
    };
  }

  function orderCard(o, role, { compact = false } = {}) {
    const s = STATUS[o.status] || STATUS.pendiente;
    const other = role === 'seller'
      ? { label: 'Comprador', name: o.buyerName, phone: o.buyerPhone }
      : { label: 'Vendedor', name: o.sellerName, phone: o.sellerPhone };
    const steps = ['pendiente', 'aceptado', 'entregado'];
    const idx = steps.indexOf(o.status);
    const wa = waLink(other.phone, role === 'seller'
      ? `Hola ${o.buyerName}, soy ${myName()} de ${C.appName}. Sobre tu pedido de ${o.qty}× ${o.productTitle}:`
      : `Hola ${o.sellerName}, te escribo por mi pedido en ${C.appName}: ${o.qty}× ${o.productTitle}.`);
    let actions = '';
    if (role === 'seller') {
      if (o.status === 'pendiente') actions = `<button type="button" class="btn btn-ghost btn-sm" data-act="reject" data-id="${o.id}">Rechazar</button><button type="button" class="btn btn-primary btn-sm" data-act="accept" data-id="${o.id}">${icon('check')} Aceptar</button>`;
      else if (o.status === 'aceptado') actions = `<button type="button" class="btn btn-ghost btn-sm" data-act="seller-cancel" data-id="${o.id}">Cancelar</button><button type="button" class="btn btn-ok btn-sm" data-act="deliver" data-id="${o.id}">${icon('check')} Entregado</button>`;
    } else if (o.status === 'pendiente') {
      actions = `<button type="button" class="btn btn-ghost btn-sm" data-act="cancel" data-id="${o.id}">Cancelar pedido</button>`;
    }
    return `<article class="order st-${o.status} ${compact ? 'compact' : ''}" ${compact && role === 'seller' && (o.status === 'pendiente' || o.status === 'aceptado') ? `draggable="true" data-drag="${o.id}"` : ''}>
      <header>
        <a class="order-thumb" href="#/p/${o.productId}" style="--c:${cat(o.category).color}">${media(o)}</a>
        <div class="grow"><a href="#/p/${o.productId}" class="order-title">${esc(o.productTitle)}</a><small class="muted">${o.qty} × ${money(o.price)} · ${timeAgo(o.createdAt)}</small></div>
        <span class="status ${s.cls}">${s.label}</span>
      </header>
      ${o.pickupAt ? `<div class="pickup ${o.pickupAt < Date.now() && o.status !== 'entregado' ? 'late' : ''}">${icon('clock')}<span>Pre-orden para <b>${esc(fmtDate(o.pickupAt))}</b></span></div>` : ''}
      ${idx >= 0 && !compact ? `<ol class="progress">${steps.map((st, i) => `<li class="${i <= idx ? 'done' : ''}"><i></i>${STATUS[st].label}</li>`).join('')}</ol>` : ''}
      <dl class="order-meta">
        <div><dt>${other.label}</dt><dd>${esc(other.name)}${role === 'seller' && o.buyerCode ? `<small class="muted"> · ${esc(o.buyerCode)}</small>` : ''}</dd></div>
        <div><dt>Entrega</dt><dd>${esc(o.spot || 'Por acordar')}</dd></div>
        <div><dt>Pago</dt><dd>${esc(o.payment || '')}</dd></div>
        <div><dt>Total</dt><dd><b>${money(o.total)}</b></dd></div>
      </dl>
      ${o.note ? `<p class="order-note">“${esc(o.note)}”</p>` : ''}
      ${wa || actions ? `<footer>${wa ? `<a class="btn btn-wa btn-sm" href="${esc(wa)}" target="_blank" rel="noopener">${icon('chat')} WhatsApp</a>` : ''}<span class="grow"></span>${actions}</footer>` : ''}
    </article>`;
  }

  async function orderAction(act, id, btn) {
    const o = [...state.sellerOrders, ...state.buyerOrders].find(x => x.id === id);
    if (!o) return;
    const adjustStock = async delta => {
      try {
        const p = await B.getProduct(o.productId);
        if (p && p.stock != null) await B.updateProduct(p.id, { stock: Math.max(0, p.stock + delta) });
        state.myProducts = [];
      } catch (e) { console.warn('stock', e); }
    };
    try {
      if (act === 'accept') {
        await busy(btn, async () => { await B.updateOrder(id, { status: 'aceptado' }); await adjustStock(-o.qty); });
        toast('Pedido aceptado. ¡Coordina la entrega! ✅');
      } else if (act === 'deliver') {
        await busy(btn, () => B.updateOrder(id, { status: 'entregado' }));
        toast('¡Venta completada! 🎉');
      } else if (act === 'reject') {
        if (!await confirmDialog({ title: '¿Rechazar pedido?', text: `El pedido de ${o.buyerName} se marcará como rechazado.`, ok: 'Rechazar', danger: true })) return;
        await B.updateOrder(id, { status: 'rechazado' });
        toast('Pedido rechazado', 'info');
      } else if (act === 'seller-cancel') {
        if (!await confirmDialog({ title: '¿Cancelar pedido aceptado?', text: 'Se devolverá el inventario a tu publicación.', ok: 'Cancelar pedido', danger: true })) return;
        await B.updateOrder(id, { status: 'cancelado' });
        await adjustStock(o.qty);
        toast('Pedido cancelado', 'info');
      } else if (act === 'cancel') {
        if (!await confirmDialog({ title: '¿Cancelar tu pedido?', text: `Se avisará a ${o.sellerName}.`, ok: 'Sí, cancelar', danger: true })) return;
        await B.updateOrder(id, { status: 'cancelado' });
        toast('Pedido cancelado', 'info');
      }
    } catch (e) { toast(errMsg(e), 'err'); }
  }
  const bindOrderActions = el => {
    el.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (b) orderAction(b.dataset.act, b.dataset.id, b);
    };
  };

  function tabPedidos(el) {
    const so = state.sellerOrders;
    const board = state.ordersView === 'tablero';
    const toggle = `<div class="segmented view-toggle" id="ov">
        <button type="button" class="${board ? '' : 'active'}" data-v="lista">☰ Lista</button>
        <button type="button" class="${board ? 'active' : ''}" data-v="tablero">▦ Tablero</button>
      </div>`;
    if (!state.ordersInit.seller) { el.innerHTML = toggle + loader(); }
    else if (board) {
      const cols = [
        ['pendiente', '🚨 Nuevos', 'Arrastra a “En proceso” o toca Aceptar'],
        ['aceptado', '🍳 En proceso', 'Arrastra a “Entregados” al terminar'],
        ['entregado', '✅ Entregados', 'Ventas completadas'],
      ];
      el.innerHTML = toggle + `<div class="kanban">${cols.map(([st, title, hint]) => {
        const items = so.filter(o => o.status === st);
        const shown = st === 'entregado' ? items.slice(0, 15) : items;
        return `<section class="kb-col" data-col="${st}">
          <header class="kb-head"><span>${title}</span><span class="chip-n">${items.length}</span></header>
          <div class="kb-list">${shown.length ? shown.map(o => orderCard(o, 'seller', { compact: true })).join('') : `<p class="kb-empty">${hint}</p>`}</div>
        </section>`;
      }).join('')}</div>`;
      bindKanbanDrag(el);
    } else {
      const groups = {
        todos: so,
        pendiente: so.filter(o => o.status === 'pendiente'),
        aceptado: so.filter(o => o.status === 'aceptado'),
        entregado: so.filter(o => o.status === 'entregado'),
        cerrado: so.filter(o => o.status === 'cancelado' || o.status === 'rechazado'),
      };
      const labels = { todos: 'Todos', pendiente: 'Pendientes', aceptado: 'Aceptados', entregado: 'Entregados', cerrado: 'Cancelados' };
      const f = state.orderFilter in groups ? state.orderFilter : 'todos';
      const list = groups[f];
      el.innerHTML = toggle + `
        <div class="chips small" id="of">${Object.keys(groups).map(k => `<button class="chip ${k === f ? 'active' : ''}" data-f="${k}">${labels[k]} <span class="chip-n">${groups[k].length}</span></button>`).join('')}</div>
        ${list.length ? `<div class="orders">${list.map(o => orderCard(o, 'seller')).join('')}</div>`
          : emptyState('📭', f === 'todos' ? 'Todavía no tienes pedidos' : `Sin pedidos ${labels[f].toLowerCase()}`, 'Los pedidos de tus compradores llegan aquí en tiempo real.')}`;
      $('#of', el).onclick = e => { const b = e.target.closest('[data-f]'); if (b) { state.orderFilter = b.dataset.f; tabPedidos(el); } };
    }
    $('#ov', el).onclick = e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      state.ordersView = b.dataset.v; setPref('ordersView', state.ordersView);
      tabPedidos(el);
    };
    bindOrderActions(el);
  }

  // Arrastrar tickets entre columnas (en computadora). En celular se usan los botones.
  function bindKanbanDrag(el) {
    const next = { pendiente: ['aceptado', 'accept'], aceptado: ['entregado', 'deliver'] };
    let dragId = null;
    el.ondragstart = e => {
      const t = e.target.closest('[data-drag]'); if (!t) return;
      dragId = t.dataset.drag;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch {}
      t.classList.add('dragging');
    };
    el.ondragend = e => {
      const t = e.target.closest('[data-drag]'); if (t) t.classList.remove('dragging');
      $$('.kb-col', el).forEach(c => c.classList.remove('drop-ok'));
    };
    el.ondragover = e => {
      const col = e.target.closest('[data-col]'); if (!col || !dragId) return;
      const o = state.sellerOrders.find(x => x.id === dragId);
      const ok = o && next[o.status] && next[o.status][0] === col.dataset.col;
      $$('.kb-col', el).forEach(c => c.classList.toggle('drop-ok', ok && c === col));
      if (ok) e.preventDefault();
    };
    el.ondrop = e => {
      e.preventDefault();
      const col = e.target.closest('[data-col]');
      const o = state.sellerOrders.find(x => x.id === dragId);
      dragId = null;
      $$('.kb-col', el).forEach(c => c.classList.remove('drop-ok'));
      if (col && o && next[o.status] && next[o.status][0] === col.dataset.col) orderAction(next[o.status][1], o.id, null);
    };
  }

  function tabCompras(el) {
    const list = state.buyerOrders;
    el.innerHTML = !state.ordersInit.buyer ? loader() : list.length
      ? `<div class="orders">${list.map(o => orderCard(o, 'buyer')).join('')}</div>`
      : emptyState('🛍️', 'Aún no has comprado nada', 'Explora lo que venden en tu universidad.', '<a class="btn btn-primary" href="#/">Explorar productos</a>');
    bindOrderActions(el);
  }

  function tabPerfil(el) {
    const pr = state.profile || {};
    const prov = { 'google.com': 'Google', password: 'Correo y contraseña' }[state.user.provider] || 'Correo';
    el.innerHTML = `
      <div class="two-col">
        <form class="surface" id="pf" novalidate>
          <h3>Tu perfil público</h3>
          <p class="muted small">Así te verán los compradores.</p>
          <label class="field"><span>Nombre</span><input name="name" maxlength="60"></label>
          <label class="field"><span>WhatsApp</span><input name="phone" type="tel" inputmode="tel" maxlength="20" placeholder="Ej. 5512345678"></label>
          <label class="field"><span>Facultad / carrera</span><input name="faculty" maxlength="60" placeholder="Ej. Ingeniería en Sistemas"></label>
          <label class="field"><span>Matrícula / código de estudiante <em>opcional, lo ve el vendedor en tus pedidos</em></span><input name="studentCode" maxlength="20" placeholder="Ej. A01234567"></label>
          <button class="btn btn-primary" type="submit" data-submit>Guardar perfil</button>
        </form>
        <section class="surface">
          <h3>Cuenta</h3>
          <div class="account-info">${avatar(myName(), state.user.photo, 'lg')}<div><strong>${esc(state.user.email)}</strong><small class="muted">Sesión con ${prov}</small></div></div>
          <label class="switch-row"><div><strong>🔔 Sonido de pedidos nuevos</strong><small class="muted">Suena y vibra cuando alguien te compra (en este dispositivo).</small></div>
            <span class="switch"><input type="checkbox" id="snd" ${pref('sound', C.orderSound !== false) ? 'checked' : ''}><i></i></span></label>
          ${B.mode === 'demo' ? '<p class="notice info">Estás en modo demo. Conecta Firebase en <code>js/config.js</code> para usar cuentas reales.</p>' : ''}
          <button type="button" class="btn btn-danger-ghost btn-block" id="lo">${icon('logout')} Cerrar sesión</button>
        </section>
      </div>`;
    const F = $('#pf').elements;
    F.name.value = pr.name || state.user.name || '';
    F.phone.value = pr.phone || '';
    F.faculty.value = pr.faculty || '';
    F.studentCode.value = pr.studentCode || '';
    $('#snd').onchange = e => {
      setPref('sound', e.target.checked);
      if (e.target.checked) { chime(); toast('Sonido activado 🔔', 'info'); }
    };
    $('#pf').onsubmit = e => {
      e.preventDefault();
      const data = { name: F.name.value.trim() || state.user.name, phone: F.phone.value.trim(), faculty: F.faculty.value.trim(), studentCode: F.studentCode.value.trim() };
      busy($('[data-submit]', el), async () => {
        try {
          await B.saveProfile(state.user.uid, data);
          state.profile = { ...pr, ...data };
          renderAccount();
          $('.panel-hello h1').textContent = `Hola, ${myName().split(' ')[0]}`;
          toast('Perfil guardado');
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    };
    $('#lo').onclick = logout;
  }

  /* ---------------------- inicio ---------------------- */
  document.title = C.appName;
  $$('[data-appname]').forEach(e => (e.textContent = C.appName));
  $$('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
  if (B.mode === 'demo') $('#demo-banner').hidden = false;
  if (location.protocol === 'file:') {
    const b = $('#demo-banner');
    b.classList.add('warn');
    b.innerHTML = '<strong>⚠️ Abriste el archivo directamente.</strong> Puedes ver productos, pero para iniciar sesión abre la página con <code>iniciar.command</code> (doble clic) o en <code>http://localhost:5173</code>.';
    b.hidden = false;
  }
  $('#nav-account').onclick = () => (state.user ? (location.hash = '#/panel/perfil') : openLogin());
  window.addEventListener('hashchange', router);
  watchCatalog();
  B.onAuth(handleAuth);
})();
