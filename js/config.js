/* =========================================================
   CONFIGURACIÓN DE LA APP
   1) Pega aquí la configuración de tu proyecto de Firebase
      (Consola de Firebase → Configuración del proyecto → Tus apps → Web).
   2) Mientras apiKey empiece con "TU_", la página funciona en
      MODO DEMO (los datos se guardan solo en tu navegador).
   3) Para probar en modo demo aunque Firebase esté configurado,
      abre la página con ?demo  →  http://localhost:5173/?demo
   ========================================================= */
window.APP_CONFIG = {
  appName: 'Hiusu',
  universityName: 'CUGDL',

  firebase: {
    apiKey: 'AIzaSyCMulJeBpIBgWTbLSLWy2tgVLj20tYiRdw',
    authDomain: 'unimarket-6cdb6.firebaseapp.com',
    projectId: 'unimarket-6cdb6',
    storageBucket: 'unimarket-6cdb6.firebasestorage.app',
    messagingSenderId: '708590078045',
    appId: '1:708590078045:web:564cefdba8287a230865b4',
    measurementId: 'G-XBW8PNC2B9',
  },

  // Compras sin cuenta: el comprador llena sus datos y su pedido se guarda en su dispositivo.
  // Pon false cuando quieran exigir inicio de sesión para comprar.
  guestCheckout: true,
  // A los invitados se les muestra menos info (descripción recortada, 1 foto, sin WhatsApp del vendedor)
  // para animarlos a iniciar sesión. Pon false para mostrarles todo.
  limitGuestDetails: true,

  // Deja vacío para permitir cualquier correo. Ejemplo: ['miuni.edu', 'alumnos.miuni.edu']
  allowedEmailDomains: [],

  // Moneda y formato
  currencySymbol: '$',
  locale: 'es',

  // Números guardados antes sin lada (10 dígitos) se tratan como de este país.
  whatsappCountryCode: '52',

  // Países para el WhatsApp. El primero con iso === defaultCountry sale preseleccionado.
  // `digits` = cuántos dígitos lleva el número sin la lada (México: 10).
  defaultCountry: 'MX',
  phoneCountries: [
    { iso: 'MX', name: 'México', flag: '🇲🇽', code: '52', digits: 10 },
    { iso: 'US', name: 'EE. UU. / Canadá', flag: '🇺🇸', code: '1', digits: 10 },
    { iso: 'GT', name: 'Guatemala', flag: '🇬🇹', code: '502', digits: 8 },
    { iso: 'SV', name: 'El Salvador', flag: '🇸🇻', code: '503', digits: 8 },
    { iso: 'HN', name: 'Honduras', flag: '🇭🇳', code: '504', digits: 8 },
    { iso: 'NI', name: 'Nicaragua', flag: '🇳🇮', code: '505', digits: 8 },
    { iso: 'CR', name: 'Costa Rica', flag: '🇨🇷', code: '506', digits: 8 },
    { iso: 'PA', name: 'Panamá', flag: '🇵🇦', code: '507', digits: 8 },
    { iso: 'CU', name: 'Cuba', flag: '🇨🇺', code: '53', digits: 8 },
    { iso: 'CO', name: 'Colombia', flag: '🇨🇴', code: '57', digits: 10 },
    { iso: 'VE', name: 'Venezuela', flag: '🇻🇪', code: '58', digits: 10 },
    { iso: 'EC', name: 'Ecuador', flag: '🇪🇨', code: '593', digits: 9 },
    { iso: 'PE', name: 'Perú', flag: '🇵🇪', code: '51', digits: 9 },
    { iso: 'BO', name: 'Bolivia', flag: '🇧🇴', code: '591', digits: 8 },
    { iso: 'CL', name: 'Chile', flag: '🇨🇱', code: '56', digits: 9 },
    { iso: 'AR', name: 'Argentina', flag: '🇦🇷', code: '54', digits: 10 },
    { iso: 'UY', name: 'Uruguay', flag: '🇺🇾', code: '598', digits: 8 },
    { iso: 'PY', name: 'Paraguay', flag: '🇵🇾', code: '595', digits: 9 },
    { iso: 'BR', name: 'Brasil', flag: '🇧🇷', code: '55', digits: 11 },
    { iso: 'ES', name: 'España', flag: '🇪🇸', code: '34', digits: 9 },
  ],

  // Métodos de pago posibles. Cada vendedor elige cuáles acepta en su perfil o en cada publicación.
  paymentMethods: ['Efectivo', 'Transferencia'],

  // ImgBB: las fotos se suben ahí y en Firebase solo se guarda el enlace.
  // Ojo: esta clave queda visible en el código de la página (cualquiera podría usarla para subir fotos a tu cuenta de ImgBB).
  // Déjala vacía ('') para guardar las fotos comprimidas dentro de Firestore.
  imgbbKey: '5739458d5f0480bd110d767cd9e20940',

  // Sonido y vibración cuando llega un pedido nuevo (cada usuario puede apagarlo en su perfil)
  orderSound: true,

  // Lugares sugeridos para entregas dentro del campus
  campusSpots: ['Biblioteca', 'Cafetería central', 'Entrada principal', 'Explanada', 'Facultad de Ingeniería', 'Gimnasio', 'Laboratorio de cómputo'],

  // `subs` son los estilos/subcategorías que aparecen como segundo filtro.
  categories: [
    { id: 'comida', label: 'Comida', emoji: '🍔', color: '#f97316', subs: ['Antojitos / Comida rápida', 'Comida corrida / Platos', 'Snacks', 'Saludable'] },
    { id: 'postres', label: 'Postres', emoji: '🧁', color: '#ec4899', subs: ['Pasteles y pays', 'Galletas y brownies', 'Dulces', 'Helados y fríos'] },
    { id: 'bebidas', label: 'Bebidas', emoji: '🧋', color: '#0ea5e9', subs: ['Aguas frescas y jugos', 'Café y té', 'Boba y frappés', 'Refrescos y embotellados'] },
    { id: 'libros', label: 'Libros y apuntes', emoji: '📚', color: '#8b5cf6', subs: ['Libros', 'Apuntes', 'Guías de examen'] },
    { id: 'tecnologia', label: 'Tecnología', emoji: '💻', color: '#14b8a6', subs: ['Calculadoras', 'Accesorios', 'Computadoras y tablets', 'Audio'] },
    { id: 'ropa', label: 'Ropa y accesorios', emoji: '👕', color: '#eab308', subs: ['Ropa', 'Calzado', 'Accesorios'] },
    { id: 'servicios', label: 'Servicios', emoji: '🛠️', color: '#22c55e', subs: ['Tutorías', 'Impresiones', 'Diseño', 'Reparaciones'] },
    { id: 'otros', label: 'Otros', emoji: '✨', color: '#64748b', subs: [] },
  ],
};
