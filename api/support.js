/* =========================================================
   Función de servidor (Vercel): manda a soporte@hiusu.com los mensajes
   de "Soporte y sugerencias". La copia principal se guarda en Firestore
   (colección `support`); este correo es el aviso para que no se te pase.

   Variables de entorno en Vercel (Settings → Environment Variables):
     SMTP_HOST   ej. smtp.zoho.com  o  smtp.gmail.com
     SMTP_PORT   465 (conexión cifrada)
     SMTP_USER   la cuenta que envía (ej. soporte@hiusu.com o tu Gmail)
     SMTP_PASS   contraseña de aplicación de esa cuenta (NUNCA en el código)
     SUPPORT_TO  a quién llega (por defecto soporte@hiusu.com)
   ========================================================= */
const tls = require('tls');

const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?hiusu\.com$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];
const KINDS = { problema: '🛠️ Problema', sugerencia: '💡 Sugerencia', otro: '💬 Otro' };

// Máximo 5 mensajes por hora por IP (barrera básica contra spam).
const WINDOW_MS = 60 * 60 * 1000, MAX_PER_IP = 5;
const hits = new Map();
function tooMany(key) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_IP;
}

// Quita saltos de línea (evita que alguien inyecte cabeceras al correo) y recorta.
const clean = (v, max) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const encHeader = s => `=?UTF-8?B?${b64(s)}?=`;

// Cliente SMTP mínimo sobre TLS (puerto 465): EHLO → AUTH LOGIN → MAIL → RCPT → DATA.
function smtpSend({ host, port, user, pass, to, replyTo, subject, text }) {
  const body = b64(text).replace(/.{1,76}/g, '$&\r\n');
  const headers = [
    `From: ${encHeader('Hiusu')} <${user}>`,
    `To: <${to}>`,
    replyTo && `Reply-To: <${replyTo}>`,
    `Subject: ${encHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@hiusu.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean);
  const message = headers.join('\r\n') + '\r\n\r\n' + body.replace(/\r\n$/, '');
  const steps = [
    [null, 220], ['EHLO hiusu.com', 250], ['AUTH LOGIN', 334], [b64(user), 334], [b64(pass), 235],
    [`MAIL FROM:<${user}>`, 250], [`RCPT TO:<${to}>`, 250], ['DATA', 354], [message + '\r\n.', 250], ['QUIT', 221],
  ];
  return new Promise((resolve, reject) => {
    let i = 0, buf = '', done = false;
    const finish = err => { if (done) return; done = true; sock.destroy(); err ? reject(err) : resolve(); };
    const sock = tls.connect({ host, port, servername: host });
    sock.setEncoding('utf8');
    sock.setTimeout(15000, () => finish(new Error('SMTP: tiempo de espera agotado')));
    sock.on('error', finish);
    sock.on('data', chunk => {
      buf += chunk;
      if (!buf.endsWith('\r\n')) return;
      const lines = buf.trim().split('\r\n');
      const last = lines[lines.length - 1];
      if (!/^\d{3} /.test(last)) return;            // respuesta de varias líneas aún incompleta
      buf = '';
      const code = Number(last.slice(0, 3));
      if (code !== steps[i][1]) return finish(new Error('SMTP ' + last.slice(0, 120)));
      i++;
      if (i >= steps.length) return finish();
      sock.write(steps[i][0] + '\r\n');
    });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  const origin = String(req.headers.origin || '');
  if (!ALLOWED_ORIGINS.some(re => re.test(origin))) return res.status(403).json({ error: 'Origen no permitido.' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
  if (tooMany(ip)) return res.status(429).json({ error: 'Enviaste varios mensajes seguidos. Intenta más tarde.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  if (b.website) return res.status(200).json({ ok: true }); // campo trampa: solo lo llenan los bots
  const kind = KINDS[b.kind] ? b.kind : 'otro';
  const name = clean(b.name, 60) || 'Sin nombre';
  const email = clean(b.email, 120);
  const page = clean(b.page, 200);
  const message = String(b.message || '').trim().slice(0, 2000);
  if (message.length < 5) return res.status(400).json({ error: 'Escribe un mensaje un poco más largo.' });
  const replyTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : '';

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const to = process.env.SUPPORT_TO || 'soporte@hiusu.com';
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Sin correo configurado: el mensaje igual queda guardado en Firestore.
    return res.status(200).json({ ok: true, emailed: false });
  }
  try {
    await smtpSend({
      host: SMTP_HOST, port: Number(SMTP_PORT || 465), user: SMTP_USER, pass: SMTP_PASS, to, replyTo,
      subject: `[Hiusu] ${KINDS[kind]} de ${name}`,
      text: `${KINDS[kind]}\n\nDe: ${name}${replyTo ? ` <${replyTo}>` : ' (sin correo)'}\nPágina: ${page || '—'}\nIP: ${ip}\n\n${message}\n\n— Enviado desde el formulario de soporte de hiusu.com`,
    });
    return res.status(200).json({ ok: true, emailed: true });
  } catch (e) {
    console.error('support mail', e.message);
    return res.status(200).json({ ok: true, emailed: false });
  }
};
