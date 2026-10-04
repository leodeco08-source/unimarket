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
    const auth = firebase.auth();
    const db = firebase.firestore();
    const now = () => firebase.firestore.FieldValue.serverTimestamp();
    auth.useDeviceLanguage();

    const norm = u => u && {
      uid: u.uid,
      name: u.displayName || (u.email || 'Usuario').split('@')[0],
      email: u.email || '',
      photo: u.photoURL || '',
      provider: (u.providerData[0] || {}).providerId || 'password',
    };
    const toObj = d => {
      const x = d.data({ serverTimestamps: 'estimate' });
      for (const k in x) if (x[k] && typeof x[k].toMillis === 'function') x[k] = x[k].toMillis();
      return { id: d.id, ...x };
    };
    const ensureDomain = async () => {
      const u = auth.currentUser;
      if (u && !emailAllowed(u.email)) { await auth.signOut(); throw mkErr('app/domain-not-allowed'); }
    };
    async function withProvider(provider) {
      try {
        await auth.signInWithPopup(provider);
      } catch (e) {
        // En algunos navegadores móviles los popups están bloqueados: usamos redirección.
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
          return auth.signInWithRedirect(provider);
        }
        throw e;
      }
      await ensureDomain();
    }
    auth.getRedirectResult().then(ensureDomain).catch(e => console.warn('redirect', e));

    const col = n => db.collection(n);

    return {
      mode: 'firebase',
      onAuth(cb) {
        return auth.onAuthStateChanged(u => {
          if (u && !emailAllowed(u.email)) { auth.signOut(); return; }
          cb(norm(u));
        });
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
        const { user } = await auth.createUserWithEmailAndPassword(email, pass);
        await user.updateProfile({ displayName: name });
        user.sendEmailVerification().catch(() => {});
        return norm(auth.currentUser);
      },
      resetPassword: email => auth.sendPasswordResetEmail(email),
      logout: () => auth.signOut(),

      async getProfile(uid) { const d = await col('users').doc(uid).get(); return d.exists ? d.data() : null; },
      saveProfile: (uid, data) => col('users').doc(uid).set(data, { merge: true }),

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
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const wait = (v, ms = 200) => new Promise(r => setTimeout(() => r(v), ms));
    const authCbs = new Set();
    const watchers = new Set();
    let session = ss.get();
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

    const products = () => ls.get(K.p, []);
    const orders = () => ls.get(K.o, []);

    return {
      mode: 'demo',
      onAuth(cb) { authCbs.add(cb); setTimeout(() => cb(session), 0); return () => authCbs.delete(cb); },
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
      async logout() { session = null; ss.set(null); emit(); },

      getProfile: async uid => ls.get(K.u, {})[uid] || null,
      async saveProfile(uid, data) { const u = ls.get(K.u, {}); u[uid] = { ...(u[uid] || {}), ...data }; ls.set(K.u, u); },

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

  window.Backend = configured ? FirebaseBackend() : DemoBackend();
})();
