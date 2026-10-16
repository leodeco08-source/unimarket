/* =========================================================
   CAPA DE DATOS
   window.Backend expone la misma interfaz en dos modos:
   - 'firebase': Firebase Auth + Cloud Firestore (real)
   - 'demo':     localStorage (para probar sin configurar nada)

   Colecciones en Firestore:
   users/{uid}            perfil público (nombre, WhatsApp, facultad)
   products/{id}          publicaciones (con miniatura pequeña)
   productImages/{id}     fotos en tamaño completo de cada publicación
   orders/{id}            pedidos entre comprador y vendedor
   ========================================================= */
(function () {
  'use strict';
  const C = window.APP_CONFIG;
  const fb = C.firebase || {};
  const PRESETS = window.HIUSU_DEMOS || {};
  let forceDemo = false;
  try { forceDemo = new URLSearchParams(location.search).has('demo'); } catch {}
  const configured = !forceDemo && !!(fb.apiKey && !/^TU_/.test(fb.apiKey) && window.firebase);

  const domains = (C.allowedEmailDomains || []).map(d => d.toLowerCase().replace(/^@/, ''));
  const emailAllowed = email => {
    if (!domains.length) return true;
    const e = String(email || '').toLowerCase();
    return domains.some(d => e.endsWith('@' + d) || e.endsWith('.' + d));
  };
  const mkErr = code => Object.assign(new Error(code), { code });
  const byNewest = arr => arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  /* ---------------------- FIREBASE ---------------------- */
  function FirebaseBackend() {
    firebase.initializeApp(fb);
    // App Check: cada petición a Firebase lleva una prueba de que viene de esta página en un navegador real.
    if (C.appCheckSiteKey && firebase.appCheck) {
      try {
        const P = C.appCheckProvider === 'v3' ? firebase.appCheck.ReCaptchaV3Provider : firebase.appCheck.ReCaptchaEnterpriseProvider;
        firebase.appCheck().activate(new P(C.appCheckSiteKey), true);
      }
      catch (e) { console.warn('App Check', e); }
    }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const now = () => firebase.firestore.FieldValue.serverTimestamp();
    auth.useDeviceLanguage();

    const norm = u => u && {
      uid: u.uid,
      name: u.isAnonymous ? 'Invitado' : u.displayName || (u.email || 'Usuario').split('@')[0],
      anonymous: !!u.isAnonymous,
      emailVerified: !!u.emailVerified,
      email: u.email || '',
      photo: u.photoURL || '',
      provider: (u.providerData[0] || {}).providerId || 'password',
    };
    const toObj = d => {
      const x = d.data({ serverTimestamps: 'estimate' });
      for (const k in x) if (x[k] && typeof x[k].toMillis === 'function') x[k] = x[k].toMillis();
      return { id: d.id, ...x };
    };
    const authCbs = new Set();
    const emit = () => authCbs.forEach(cb => cb(norm(auth.currentUser)));
    const ensureDomain = async () => {
      const u = auth.currentUser;
      if (u && !u.isAnonymous && !emailAllowed(u.email)) { await auth.signOut(); throw mkErr('app/domain-not-allowed'); }
    };
    // Si quien entra venía comprando como invitado, se "vincula" la sesión anónima
    // a su cuenta para que conserve sus pedidos.
    async function withProvider(provider) {
      const cur = auth.currentUser;
      const anon = cur && cur.isAnonymous;
      try {
        if (anon) {
          try { await cur.linkWithPopup(provider); }
          catch (e) {
            if (e.code === 'auth/credential-already-in-use' && e.credential) await auth.signInWithCredential(e.credential);
            else throw e;
          }
        } else await auth.signInWithPopup(provider);
      } catch (e) {
        // En algunos navegadores móviles los popups están bloqueados: usamos redirección.
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code) && location.protocol !== 'file:') {
          return anon ? cur.linkWithRedirect(provider) : auth.signInWithRedirect(provider);
        }
        throw e;
      }
      await ensureDomain();
      emit();
    }
    auth.getRedirectResult().then(ensureDomain).catch(e => console.warn('redirect', e));

    const col = n => db.collection(n);

    return {
      mode: 'firebase',
      onAuth(cb) {
        authCbs.add(cb);
        // onIdTokenChanged también avisa cuando un invitado se vincula a una cuenta.
        const off = auth.onIdTokenChanged(u => {
          if (u && !u.isAnonymous && !emailAllowed(u.email)) { auth.signOut(); return; }
          cb(norm(u));
        });
        return () => { authCbs.delete(cb); off(); };
      },
      async loginAnonymous() {
        if (auth.currentUser) return norm(auth.currentUser);
        return norm((await auth.signInAnonymously()).user);
      },
      loginGoogle() {
        const p = new firebase.auth.GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account', ...(domains.length === 1 ? { hd: domains[0] } : {}) });
        return withProvider(p);
      },
      async loginEmail(email, pass) {
        if (!emailAllowed(email)) throw mkErr('app/domain-not-allowed');
        await auth.signInWithEmailAndPassword(email, pass);
      },
      async register(name, email, pass) {
        if (!emailAllowed(email)) throw mkErr('app/domain-not-allowed');
        const cur = auth.currentUser;
        let user;
        if (cur && cur.isAnonymous) {
          try { user = (await cur.linkWithCredential(firebase.auth.EmailAuthProvider.credential(email, pass))).user; }
          catch (e) { throw ['auth/credential-already-in-use', 'auth/email-already-in-use'].includes(e.code) ? mkErr('auth/email-already-in-use') : e; }
        } else user = (await auth.createUserWithEmailAndPassword(email, pass)).user;
        await user.updateProfile({ displayName: name });
        user.sendEmailVerification().catch(() => {});
        emit();
        return norm(auth.currentUser);
      },
      resetPassword: email => auth.sendPasswordResetEmail(email),
      logout: () => auth.signOut(),
      // Token de sesión para que el servidor sepa quién está subiendo fotos.
      getIdToken: () => (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)),
      // ¿Puede vender? Con correo y contraseña, el correo debe estar verificado (con Google ya lo está).
      async canSell() {
        const u = auth.currentUser;
        if (!u || u.isAnonymous) return false;
        if ((u.providerData[0] || {}).providerId !== 'password' || u.emailVerified) return true;
        await u.reload();                       // por si acaba de verificar en otra pestaña
        if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); return true; }
        return false;
      },
      resendVerification: () => (auth.currentUser ? auth.currentUser.sendEmailVerification() : Promise.resolve()),

      async getProfile(uid) { const d = await col('users').doc(uid).get(); return d.exists ? d.data() : null; },
      saveProfile: (uid, data) => col('users').doc(uid).set(data, { merge: true }),
      // Ajustes privados (ej. datos bancarios): solo los lee el dueño.
      async getPrivate(uid) { const d = await col('users').doc(uid).collection('private').doc('settings').get(); return d.exists ? d.data() : {}; },
      savePrivate: (uid, data) => col('users').doc(uid).collection('private').doc('settings').set(data, { merge: true }),

      async listProducts() { return (await col('products').orderBy('createdAt', 'desc').limit(300).get()).docs.map(toObj); },
      watchProducts(cb, onErr) {
        return col('products').orderBy('createdAt', 'desc').limit(300).onSnapshot(
          s => cb(s.docs.map(toObj)),
          e => { console.error('products', e); onErr && onErr(e); }
        );
      },
      async getProduct(id) { const d = await col('products').doc(id).get(); return d.exists ? toObj(d) : null; },
      async createProduct(data) { return (await col('products').add({ ...data, createdAt: now(), updatedAt: now() })).id; },
      updateProduct: (id, data) => col('products').doc(id).update({ ...data, updatedAt: now() }),
      async deleteProduct(id) {
        await col('productImages').doc(id).delete().catch(() => {});
        await col('products').doc(id).delete();
      },
      async myProducts(uid) { return byNewest((await col('products').where('sellerId', '==', uid).get()).docs.map(toObj)); },
      async getImages(id) { const d = await col('productImages').doc(id).get(); return d.exists ? (d.data().images || []) : []; },
      setImages: (id, images, sellerId) => col('productImages').doc(id).set({ images, sellerId }),

      async createOrder(data) { return (await col('orders').add({ ...data, createdAt: now(), updatedAt: now() })).id; },
      // Reseñas: una por pedido entregado (el id de la reseña es el id del pedido).
      createReview: (orderId, data) => col('reviews').doc(orderId).set({ ...data, createdAt: now() }),
      async listReviews(field, value) {
        return byNewest((await col('reviews').where(field, '==', value).limit(200).get()).docs.map(toObj));
      },
      // Reportes (una por persona y por cosa reportada) y mensajes de soporte: solo los leen los administradores.
      async createReport(id, data) {
        try { await col('reports').doc(id).set({ ...data, createdAt: now() }); }
        catch (e) { if (e.code === 'permission-denied') throw mkErr('app/already-reported'); throw e; }
      },
      createSupport: data => col('support').add({ ...data, createdAt: now() }),
      // Estado de moderación propio (aviso, suspensión o baneo) que ponen los administradores.
      async getModeration(uid) { const d = await col('moderation').doc(uid).get(); return d.exists ? toObj(d) : null; },
      // Las reseñas más recientes de todos (para mostrar las estrellas de cada vendedor en el catálogo).
      async listAllReviews() { return (await col('reviews').orderBy('createdAt', 'desc').limit(500).get()).docs.map(toObj); },
      updateOrder: (id, data) => col('orders').doc(id).update({ ...data, updatedAt: now() }),
      watchOrders(field, uid, cb) {
        return col('orders').where(field, '==', uid).onSnapshot(
          s => cb(byNewest(s.docs.map(toObj))),
          e => console.error('orders', e)
        );
      },
    };
  }

  /* ---------------------- DEMO (localStorage) ---------------------- */
  function DemoBackend() {
    const K = { p: 'cm_products', i: 'cm_images', o: 'cm_orders', u: 'cm_users', a: 'cm_accounts', s: 'cm_session' };
    const ls = {
      get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
      set(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); }
        catch { throw mkErr('app/storage-full'); }
      },
    };
    // La sesión vive en sessionStorage: puedes abrir otra pestaña con otro usuario
    // (uno vende y otro compra) y ver los pedidos en tiempo real.
    const ss = {
      get() { try { return JSON.parse(sessionStorage.getItem(K.s)); } catch { return null; } },
      set(v) { try { v ? sessionStorage.setItem(K.s, JSON.stringify(v)) : sessionStorage.removeItem(K.s); } catch {} },
    };

    // Demos con datos listos para enseñar (?demo=estrella). Se cargan la primera vez o con &reset.
    let preset = '';
    try {
      const q = new URLSearchParams(location.search);
      preset = PRESETS[q.get('demo')] ? q.get('demo') : '';
      if (preset && (localStorage.getItem('cm_demo_preset') !== preset || q.has('reset'))) {
        Object.keys(localStorage).filter(k => /^(cm_|hiusu_)/.test(k)).forEach(k => localStorage.removeItem(k));
        localStorage.setItem('cm_demo_preset', preset);
        ss.set(PRESETS[preset].session);
        preset = { name: preset, fresh: true };
        if (!location.hash || location.hash === '#/') history.replaceState(null, '', location.pathname + location.search + PRESETS[preset.name].hash);
      } else if (preset) preset = { name: preset, fresh: false };
      // Pestaña de comprador (&as=comprador): entra sin cuenta, como cualquier visitante.
      if (preset && q.get('as') === 'comprador') { preset.buyer = true; ss.set(null); }
      if (preset && q.get('as') === 'vendedor') ss.set(PRESETS[preset.name].session);
    } catch {}
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const wait = (v, ms = 200) => new Promise(r => setTimeout(() => r(v), ms));
    const authCbs = new Set();
    const watchers = new Set();
    // El invitado se guarda en el dispositivo (localStorage) para que vea sus pedidos al volver.
    let session = ss.get() || ls.get('cm_guest_session', null);
    const emit = () => authCbs.forEach(cb => cb(session));
    const productWatchers = new Set();
    const fireOrders = () => watchers.forEach(w => w());
    const fireProducts = () => productWatchers.forEach(w => w());
    window.addEventListener('storage', e => {
      if (e.key === K.o) fireOrders();
      if (e.key === K.p) fireProducts();
    });

    const signIn = async u => {
      if (!emailAllowed(u.email)) throw mkErr('app/domain-not-allowed');
      await wait(null, 350);
      // Igual que en Firebase: los pedidos del invitado pasan a la cuenta con la que entra.
      if (session && session.anonymous) {
        ls.set(K.o, ls.get(K.o, []).map(o => (o.buyerId === session.uid ? { ...o, buyerId: u.uid } : o)));
        try { localStorage.removeItem('cm_guest_session'); } catch {}
        fireOrders();
      }
      session = u; ss.set(u); emit();
      return u;
    };
    const demoEmail = base => domains.length ? `${base}@${domains[0]}` : `${base}@gmail.com`;

    (function seed() {
      if (ls.get(K.p)) return;
      const H = 3600e3, t = Date.now();
      const rows = [
        ['Brownies de chocolate (caja de 4)', 60, 'postres', 'Galletas y brownies', 'inmediato', 'Brownies caseros con nuez, recién horneados todos los días. Pide antes de las 11 y te los entrego en el receso.', 12, 'Cafetería central', 'Lun a Vie · 10:00–14:00', 'Valeria Ruiz', 2],
        ['Calculadora científica Casio fx-991EX', 450, 'tecnologia', 'Calculadoras', 'inmediato', 'Como nueva, la usé un semestre. Incluye tapa.', 1, 'Biblioteca', 'Por las tardes', 'Diego Martínez', 5],
        ['Apuntes de Cálculo I (completos)', 80, 'libros', 'Apuntes', 'inmediato', 'Apuntes impresos con ejercicios resueltos de los 3 parciales.', null, 'Facultad de Ingeniería', 'Cualquier día', 'Sofía Hernández', 9],
        ['Café frío de vainilla 16 oz', 45, 'bebidas', 'Café y té', 'inmediato', 'Cold brew con leche y vainilla. También hay de caramelo.', 20, 'Entrada principal', 'Lun a Jue · 8:00–12:00', 'Mateo López', 1],
        ['Empanadas caseras (3 piezas)', 55, 'comida', 'Antojitos / Comida rápida', 'preorden', 'De carne, pollo o queso. Se hacen sobre pedido: encárgalas con un día de anticipación.', null, 'Explanada', 'Mar y Jue · 12:00–15:00', 'Camila Torres', 26],
        ['Pastel de zanahoria completo', 280, 'postres', 'Pasteles y pays', 'preorden', 'Para 10 personas, con betún de queso crema. Ideal para cumpleaños.', null, 'Cafetería central', 'Entrega con 2 días de anticipación', 'Valeria Ruiz', 40],
        ['Sudadera oficial de la universidad · Talla M', 320, 'ropa', 'Ropa', 'inmediato', 'Usada dos veces, sin detalles. Color azul marino.', 1, 'Gimnasio', 'Por acordar', 'Andrea Castillo', 30],
        ['Tutorías de programación (1 hora)', 150, 'servicios', 'Tutorías', 'preorden', 'Te ayudo con Python, Java o C++. Preparación para exámenes y proyectos. Agenda tu sesión.', null, 'Laboratorio de cómputo', 'Lun a Vie · 16:00–19:00', 'Diego Martínez', 50],
        ['Audífonos Bluetooth', 380, 'tecnologia', 'Audio', 'inmediato', 'Batería de 20 horas, con estuche de carga. Funcionan perfecto.', 0, 'Biblioteca', 'Por las tardes', 'Luis Ramírez', 72],
      ];
      ls.set(K.p, rows.map(([title, price, category, sub, mode, description, stock, spot, schedule, sellerName, hoursAgo]) => ({
        id: newId() + Math.random().toString(36).slice(2, 5), title, price, category, sub, mode, description, stock, spot, schedule,
        sellerName, sellerId: 'seed-' + sellerName.toLowerCase().replace(/\W+/g, '-'), sellerPhoto: '', phone: '',
        thumb: '', active: true, createdAt: t - hoursAgo * H, updatedAt: t - hoursAgo * H,
      })));
    })();
    if (preset && preset.fresh) PRESETS[preset.name].seed({ ls, K, newId });

    const products = () => ls.get(K.p, []);
    const orders = () => ls.get(K.o, []);

    return {
      mode: 'demo',
      demoPreset: preset ? preset.name : '',
      demoBuyer: !!(preset && preset.buyer),
      onAuth(cb) { authCbs.add(cb); setTimeout(() => cb(session), 0); return () => authCbs.delete(cb); },
      async loginAnonymous() {
        if (session) return session;
        await wait(null, 200);
        session = { uid: 'guest-' + newId(), name: 'Invitado', email: '', photo: '', provider: 'anonymous', anonymous: true };
        ls.set('cm_guest_session', session);
        emit();
        return session;
      },
      loginGoogle: () => signIn({ uid: 'demo-google', name: 'Estudiante Google', email: demoEmail('estudiante.google'), photo: '', provider: 'google.com' }),
      async loginEmail(email, pass) {
        email = email.toLowerCase();
        const a = ls.get(K.a, {})[email];
        await wait();
        if (!a) throw mkErr('auth/user-not-found');
        if (a.pass !== pass) throw mkErr('auth/wrong-password');
        return signIn({ uid: a.uid, name: a.name, email, photo: '', provider: 'password' });
      },
      async register(name, email, pass) {
        email = email.toLowerCase();
        if (!emailAllowed(email)) throw mkErr('app/domain-not-allowed');
        const accs = ls.get(K.a, {});
        if (accs[email]) throw mkErr('auth/email-already-in-use');
        if (pass.length < 6) throw mkErr('auth/weak-password');
        accs[email] = { uid: 'u-' + newId(), name, pass };
        ls.set(K.a, accs);
        return signIn({ uid: accs[email].uid, name, email, photo: '', provider: 'password' });
      },
      resetPassword: () => wait(),
      getIdToken: async () => null,
      canSell: async () => true,
      resendVerification: async () => {},
      async logout() { session = null; ss.set(null); try { localStorage.removeItem('cm_guest_session'); } catch {} emit(); },

      getProfile: async uid => ls.get(K.u, {})[uid] || null,
      async saveProfile(uid, data) { const u = ls.get(K.u, {}); u[uid] = { ...(u[uid] || {}), ...data }; ls.set(K.u, u); },
      getPrivate: async uid => ls.get('cm_private', {})[uid] || {},
      async savePrivate(uid, data) { const all = ls.get('cm_private', {}); all[uid] = { ...(all[uid] || {}), ...data }; ls.set('cm_private', all); },

      listProducts: () => wait(byNewest(products()), 350),
      watchProducts(cb) {
        const run = () => cb(byNewest(products()));
        productWatchers.add(run);
        setTimeout(run, 350);
        return () => productWatchers.delete(run);
      },
      getProduct: async id => products().find(p => p.id === id) || null,
      async createProduct(data) {
        const id = newId();
        ls.set(K.p, [...products(), { ...data, id, createdAt: Date.now(), updatedAt: Date.now() }]);
        fireProducts();
        return wait(id);
      },
      async updateProduct(id, data) {
        ls.set(K.p, products().map(p => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p)));
        fireProducts();
        return wait();
      },
      async deleteProduct(id) {
        const imgs = ls.get(K.i, {}); delete imgs[id]; ls.set(K.i, imgs);
        ls.set(K.p, products().filter(p => p.id !== id));
        fireProducts();
        return wait();
      },
      myProducts: async uid => byNewest(products().filter(p => p.sellerId === uid)),
      getImages: async id => (ls.get(K.i, {})[id] || {}).images || [],
      async setImages(id, images, sellerId) { const all = ls.get(K.i, {}); all[id] = { images, sellerId }; ls.set(K.i, all); },

      async createReview(orderId, data) {
        const all = ls.get('cm_reviews', []);
        if (all.some(r => r.id === orderId)) throw mkErr('permission-denied');
        all.push({ ...data, id: orderId, createdAt: Date.now() });
        ls.set('cm_reviews', all);
        return wait();
      },
      listReviews: async (field, value) => byNewest(ls.get('cm_reviews', []).filter(r => r[field] === value)),
      listAllReviews: async () => byNewest(ls.get('cm_reviews', [])),
      async createReport(id, data) {
        const all = ls.get('cm_reports', []);
        if (all.some(r => r.id === id)) throw mkErr('app/already-reported');
        all.push({ ...data, id, createdAt: Date.now() }); ls.set('cm_reports', all); return wait();
      },
      async createSupport(data) { const all = ls.get('cm_support', []); all.push({ ...data, id: newId(), createdAt: Date.now() }); ls.set('cm_support', all); return wait(); },
      getModeration: async uid => ls.get('cm_moderation', {})[uid] || null,
      async createOrder(data) {
        const id = newId();
        ls.set(K.o, [...orders(), { ...data, id, createdAt: Date.now(), updatedAt: Date.now() }]);
        fireOrders();
        return wait(id);
      },
      async updateOrder(id, data) {
        ls.set(K.o, orders().map(o => (o.id === id ? { ...o, ...data, updatedAt: Date.now() } : o)));
        fireOrders();
        return wait();
      },
      watchOrders(field, uid, cb) {
        const run = () => cb(byNewest(orders().filter(o => o[field] === uid)));
        watchers.add(run);
        setTimeout(run, 0);
        return () => watchers.delete(run);
      },
    };
  }

  /* ---------------------- BLINDAJE DE DATOS ----------------------
     Todo lo que llega de la base de datos se limpia aquí antes de mostrarse.
     Así, aunque alguien escriba basura o código directamente en Firestore
     (sin usar la página), la interfaz solo recibe tipos y valores válidos. */
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const str = (v, max = 300) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  const num = (v, min = 0, max = 1e7) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const int = (v, min = 0, max = 1e6) => Math.round(num(v, min, max));
  const ms = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  // Solo imágenes https o data:image (nunca javascript: ni otros esquemas).
  const imgUrl = v => (typeof v === 'string' && (/^https:\/\/[^\s"'<>]+$/i.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)
    || /^assets\/demo\/[\w-]+\.(jpe?g|png|webp)$/.test(v)) ? v : '');
  const strList = (v, max, len) => (Array.isArray(v) ? v.slice(0, max).map(x => str(x, len)).filter(Boolean) : []);
  const STATUSES = ['pendiente', 'aceptado', 'entregado', 'rechazado', 'cancelado'];
  // Opciones que el comprador elige (ej. "Frutas: elige 2"). Máximo 4 grupos de 15 opciones.
  const cleanOptions = v => (Array.isArray(v) ? v.slice(0, 4) : []).map(g => {
    const choices = [...new Set(strList(g && g.choices, 15, 30).map(x => x.trim()).filter(Boolean))];
    return { name: str(g && g.name, 30).trim(), pick: Math.min(choices.length, int(g && g.pick, 1, 10)) || 1, choices };
  }).filter(g => g.name && g.choices.length);

  function cleanProduct(p) {
    if (!p || !ID_RE.test(String(p.id || ''))) return null;
    return {
      id: p.id, sellerId: str(p.sellerId, 128), sellerName: str(p.sellerName, 60), sellerPhoto: imgUrl(p.sellerPhoto),
      title: str(p.title, 80), description: str(p.description, 1000), price: num(p.price, 0, 1e6),
      stock: p.stock == null || p.stock === '' ? null : int(p.stock, 0, 1e5),
      category: str(p.category, 30), sub: str(p.sub, 60), mode: p.mode === 'preorden' ? 'preorden' : 'inmediato',
      spot: str(p.spot, 60), schedule: str(p.schedule, 60), phone: str(p.phone, 20),
      payments: strList(p.payments, 4, 20), active: p.active !== false,
      thumb: imgUrl(p.thumb), images: (Array.isArray(p.images) ? p.images.slice(0, 4).map(imgUrl).filter(Boolean) : []),
      sold: int(p.sold, 0, 1e7), options: cleanOptions(p.options),
      createdAt: ms(p.createdAt), updatedAt: ms(p.updatedAt),
    };
  }
  function cleanTransfer(t) {
    if (!t || typeof t !== 'object') return null;
    return { method: t.method === 'card' ? 'card' : 'clabe', holder: str(t.holder, 80), bank: str(t.bank, 40), note: str(t.note, 120),
      clabe: str(t.clabe, 18).replace(/\D/g, ''), card: str(t.card, 16).replace(/\D/g, '') };
  }
  function cleanOrder(o) {
    if (!o || !ID_RE.test(String(o.id || ''))) return null;
    return {
      id: o.id, productId: ID_RE.test(String(o.productId || '')) ? o.productId : '', productTitle: str(o.productTitle, 80), productThumb: imgUrl(o.productThumb),
      category: str(o.category, 30), price: num(o.price, 0, 1e6), qty: int(o.qty, 1, 999), total: num(o.total, 0, 1e9),
      sellerId: str(o.sellerId, 128), sellerName: str(o.sellerName, 60), sellerPhone: str(o.sellerPhone, 20).replace(/[^\d+]/g, ''),
      buyerId: str(o.buyerId, 128), buyerName: str(o.buyerName, 60), buyerEmail: str(o.buyerEmail, 120), buyerPhone: str(o.buyerPhone, 20).replace(/[^\d+]/g, ''),
      buyerCode: str(o.buyerCode, 20), guest: o.guest === true, spot: str(o.spot, 60), payment: o.payment === 'Transferencia' ? 'Transferencia' : 'Efectivo',
      note: str(o.note, 300), options: str(o.options, 300), status: STATUSES.includes(o.status) ? o.status : 'pendiente', mode: o.mode === 'preorden' ? 'preorden' : 'inmediato',
      pickupAt: ms(o.pickupAt) || null, transfer: cleanTransfer(o.transfer), transferInfo: str(o.transferInfo, 400),
      createdAt: ms(o.createdAt), updatedAt: ms(o.updatedAt),
    };
  }
  function cleanReview(r) {
    if (!r || !ID_RE.test(String(r.id || ''))) return null;
    return { id: r.id, productId: str(r.productId, 64), sellerId: str(r.sellerId, 128), buyerId: str(r.buyerId, 128),
      buyerName: str(r.buyerName, 40), rating: int(r.rating, 1, 5), comment: str(r.comment, 300), productTitle: str(r.productTitle, 80), createdAt: ms(r.createdAt) };
  }
  const cleanList = (list, fn) => (list || []).map(fn).filter(Boolean);

  function harden(b) {
    return {
      ...b,
      listProducts: async () => cleanList(await b.listProducts(), cleanProduct),
      getProduct: async id => (ID_RE.test(String(id)) ? cleanProduct(await b.getProduct(id)) : null),
      myProducts: async uid => cleanList(await b.myProducts(uid), cleanProduct),
      getImages: async id => (ID_RE.test(String(id)) ? (await b.getImages(id) || []).slice(0, 4).map(imgUrl).filter(Boolean) : []),
      listReviews: async (field, value) => cleanList(await b.listReviews(field, value), cleanReview),
      listAllReviews: async () => cleanList(await b.listAllReviews(), cleanReview),
      async getModeration(uid) {
        const m = await b.getModeration(uid);
        if (!m) return null;
        return { status: ['warned', 'suspended', 'banned'].includes(m.status) ? m.status : 'ok', reason: str(m.reason, 200), message: str(m.message, 1000), until: ms(m.until) || 0, updatedAt: ms(m.updatedAt) };
      },
      watchProducts: (cb, onErr) => b.watchProducts(list => cb(cleanList(list, cleanProduct)), onErr),
      watchOrders: (field, uid, cb) => b.watchOrders(field, uid, list => cb(cleanList(list, cleanOrder))),
      getPrivate: async uid => { const x = (await b.getPrivate(uid)) || {}; return { ...x, transfer: cleanTransfer(x.transfer), transferInfo: str(x.transferInfo, 400) }; },
    };
  }

  window.Backend = harden(configured ? FirebaseBackend() : DemoBackend());
})();
