/* =========================================================
   Acceso de servidor a Firebase (sin dependencias).
   Usa una "cuenta de servicio" de Google guardada SOLO en Vercel
   (variable FIREBASE_SERVICE_ACCOUNT, el JSON completo). Con ella el
   servidor puede leer lo necesario para mandar avisos; el navegador
   nunca la ve. Los archivos que empiezan con "_" no son páginas públicas.
   ========================================================= */
const crypto = require('crypto');

const PROJECT = 'unimarket-6cdb6';
const WEB_KEY = 'AIzaSyCMulJeBpIBgWTbLSLWy2tgVLj20tYiRdw'; // clave web pública (no es secreta)
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
let cached = { token: '', exp: 0 };

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT en Vercel');
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT inválida');
  return sa;
}

// Token de acceso de Google firmado con la cuenta de servicio (dura 1 hora; se reutiliza).
async function accessToken() {
  if (cached.token && Date.now() < cached.exp - 60e3) return cached.token;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit',
  }));
  const sig = b64url(crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('No se pudo obtener acceso a Google');
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

// ¿Quién manda la petición? Verifica el token de sesión de Firebase del navegador.
async function verifyUser(idToken) {
  if (!idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  const j = await r.json().catch(() => ({}));
  return (r.ok && j.users && j.users[0]) || null;
}

// Correo de una cuenta (solo si está verificado).
async function userEmail(uid) {
  const t = await accessToken();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [uid] }),
  });
  const j = await r.json().catch(() => ({}));
  const u = j.users && j.users[0];
  return u && u.email && u.emailVerified ? u.email : '';
}

/* ---- Firestore (formato de la API REST) ---- */
function decode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  return null;
}
const decodeFields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, decode(v)]));
function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
  return { stringValue: String(v) };
}

async function getDoc(path) {
  const t = await accessToken();
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: `Bearer ${t}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore ' + r.status);
  const j = await r.json();
  return { ...decodeFields(j.fields), _updateTime: j.updateTime };
}
// Actualiza solo los campos indicados. Con `ifUpdateTime`, falla si alguien lo cambió antes (evita duplicados).
async function patchDoc(path, data, ifUpdateTime) {
  const t = await accessToken();
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const pre = ifUpdateTime ? `&currentDocument.updateTime=${encodeURIComponent(ifUpdateTime)}` : '';
  const r = await fetch(`${FS}/${path}?${mask}${pre}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)])) }),
  });
  if (!r.ok) throw new Error('Firestore ' + r.status);
  return true;
}
async function addDoc(collection, data) {
  const t = await accessToken();
  const r = await fetch(`${FS}/${collection}`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)])) }),
  });
  if (!r.ok) throw new Error('Firestore ' + r.status);
  return true;
}

module.exports = { verifyUser, userEmail, getDoc, patchDoc, addDoc };
