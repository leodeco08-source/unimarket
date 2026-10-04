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
  appName: 'CampusMarket',
  universityName: 'Mi Universidad',

  firebase: {
    apiKey: 'AIzaSyCMulJeBpIBgWTbLSLWy2tgVLj20tYiRdw',
    authDomain: 'unimarket-6cdb6.firebaseapp.com',
    projectId: 'unimarket-6cdb6',
    storageBucket: 'unimarket-6cdb6.firebasestorage.app',
    messagingSenderId: '708590078045',
    appId: '1:708590078045:web:564cefdba8287a230865b4',
    measurementId: 'G-XBW8PNC2B9',
  },

  // Deja vacío para permitir cualquier correo. Ejemplo: ['miuni.edu', 'alumnos.miuni.edu']
  allowedEmailDomains: [],

  // Moneda y formato
  currencySymbol: '$',
  locale: 'es',

  // Código de país que se agrega a los números de WhatsApp de 10 dígitos o menos (ej. '52' México, '54' Argentina).
  whatsappCountryCode: '',

  paymentMethods: ['Efectivo', 'Transferencia'],

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
