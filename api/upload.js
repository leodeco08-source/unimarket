/* =========================================================
   Función de servidor (Vercel): sube una foto a ImgBB.
   La clave de ImgBB vive SOLO en Vercel, en la variable de entorno IMGBB_KEY
   (Vercel → tu proyecto → Settings → Environment Variables). Nunca en el código.

   Solo acepta fotos de vendedores con sesión iniciada (Google o correo):
   el navegador manda su token de Firebase y aquí se verifica con Google.
   ========================================================= */

// Clave web pública de Firebase (no es secreta; sirve para verificar tokens de ESTE proyecto).
const FIREBASE_WEB_KEY = process.env.FIREBASE_WEB_KEY || 'AIzaSyCMulJeBpIBgWTbLSLWy2tgVLj20tYiRdw';
const MAX_BASE64 = 2 * 1024 * 1024; // ~1.5 MB de imagen; las fotos ya llegan comprimidas (~150 KB)

// Solo se aceptan peticiones hechas desde estas páginas.
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?hiusu\.com$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];

// Límite de velocidad (por usuario y por IP). Es "en memoria": cada servidor de Vercel lleva su
// propia cuenta, así que es una barrera razonable contra abusos, no un candado perfecto.
const WINDOW_MS = 10 * 60 * 1000;   // 10 minutos
const MAX_PER_USER = 20;            // fotos por usuario en esa ventana
const MAX_PER_IP = 40;
const hits = new Map();
function tooMany(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear(); // evita que la memoria crezca sin límite
  return list.length > max;
}
// Revisa que el contenido de verdad sea una imagen JPEG, PNG, WebP o GIF (por sus primeros bytes).
function looksLikeImage(b64) {
  const head = Buffer.from(b64.slice(0, 24), 'base64');
  const hex = head.toString('hex');
  return hex.startsWith('ffd8ff') || hex.startsWith('89504e47') || hex.startsWith('47494638')
    || (head.slice(0, 4).toString() === 'RIFF' && head.slice(8, 12).toString() === 'WEBP');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const origin = String(req.headers.origin || '');
  if (origin && !ALLOWED_ORIGINS.some(re => re.test(origin))) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
  if (tooMany('ip:' + ip, MAX_PER_IP)) return res.status(429).json({ error: 'Demasiadas fotos en poco tiempo. Espera unos minutos.' });

  const imgbbKey = process.env.IMGBB_KEY;
  if (!imgbbKey) return res.status(500).json({ error: 'Falta configurar IMGBB_KEY en Vercel.' });

  // 1) ¿Quién sube? Verificamos el token de Firebase del usuario.
  const idToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return res.status(401).json({ error: 'Inicia sesión para subir fotos.' });
  let user;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const j = await r.json();
    user = r.ok && j.users && j.users[0];
  } catch {
    return res.status(502).json({ error: 'No se pudo verificar tu sesión. Intenta de nuevo.' });
  }
  if (!user) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
  // Los invitados (sesión anónima) no tienen proveedor: no pueden vender ni subir fotos.
  if (!user.providerUserInfo || !user.providerUserInfo.length) {
    return res.status(403).json({ error: 'Inicia sesión con Google o correo para subir fotos.' });
  }
  // Con correo y contraseña, el correo debe estar verificado.
  if (user.providerUserInfo.every(p => p.providerId === 'password') && !user.emailVerified) {
    return res.status(403).json({ error: 'Verifica tu correo antes de subir fotos.' });
  }

  if (tooMany('uid:' + user.localId, MAX_PER_USER)) {
    return res.status(429).json({ error: 'Subiste muchas fotos en poco tiempo. Espera unos minutos.' });
  }

  // 2) La foto (base64, sin el prefijo "data:image/...;base64,").
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const image = String(body.image || '').replace(/^data:image\/[\w.+-]+;base64,/, '');
  if (!image || image.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: 'La foto no es válida o es demasiado grande.' });
  }
  if (!looksLikeImage(image)) return res.status(400).json({ error: 'El archivo no es una imagen válida.' });

  // 3) Subida a ImgBB con la clave secreta.
  try {
    const form = new URLSearchParams();
    form.append('image', image);
    form.append('name', `hiusu-${user.localId}-${Date.now()}`);
    const up = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`, { method: 'POST', body: form });
    const d = await up.json().catch(() => ({}));
    if (!up.ok || !d.success) return res.status(502).json({ error: 'ImgBB rechazó la foto.' });
    const data = d.data;
    return res.status(200).json({
      url: data.display_url || data.url,
      thumb: (data.medium && data.medium.url) || data.display_url || data.url,
    });
  } catch {
    return res.status(502).json({ error: 'No se pudo conectar con ImgBB.' });
  }
};

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
