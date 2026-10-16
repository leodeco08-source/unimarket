/* =========================================================
   Aviso por correo al vendedor cuando le hacen un pedido.
   Lo llama el navegador del comprador justo después de crear el pedido.
   Para que nadie pueda usarlo para mandar spam:
   - solo el comprador de ESE pedido puede pedir el aviso,
   - solo en los primeros 15 minutos y una sola vez por pedido,
   - el correo va únicamente al correo verificado de la cuenta del vendedor,
     y solo si el vendedor activó "Avisos por correo" en su perfil.
   Variables en Vercel: FIREBASE_SERVICE_ACCOUNT, SMTP_HOST, SMTP_PORT,
   ORDERS_SMTP_USER y ORDERS_SMTP_PASS (la cuenta pedidos@hiusu.com).
   ========================================================= */
const { verifyUser, userEmail, getDoc, patchDoc } = require('./_lib/google');
const { sendMail, layout } = require('./_lib/mail');

const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?hiusu\.com$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];
const SITE = 'https://www.hiusu.com';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const hits = new Map();
const tooMany = ip => { const now = Date.now(); const l = (hits.get(ip) || []).filter(t => now - t < 3600e3); l.push(now); hits.set(ip, l); if (hits.size > 5000) hits.clear(); return l.length > 30; };
const money = n => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!ALLOWED_ORIGINS.some(re => re.test(String(req.headers.origin || '')))) return res.status(403).json({ error: 'Origen no permitido.' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (tooMany(ip)) return res.status(429).json({ error: 'Demasiadas peticiones.' });

  const { SMTP_HOST, SMTP_PORT, ORDERS_SMTP_USER, ORDERS_SMTP_PASS } = process.env;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !SMTP_HOST || !ORDERS_SMTP_USER || !ORDERS_SMTP_PASS) {
    return res.status(200).json({ ok: true, sent: false, why: 'no-config' });
  }
  try {
    const user = await verifyUser(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!user) return res.status(401).json({ error: 'Sesión inválida.' });
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const orderId = String((body || {}).orderId || '');
    if (!ID_RE.test(orderId)) return res.status(400).json({ error: 'Pedido inválido.' });

    const order = await getDoc(`orders/${orderId}`);
    if (!order || order.buyerId !== user.localId) return res.status(403).json({ error: 'No es tu pedido.' });
    if (order.notifiedAt) return res.status(200).json({ ok: true, sent: false, why: 'ya-avisado' });
    if (Date.now() - (order.createdAt || 0) > 15 * 60e3) return res.status(200).json({ ok: true, sent: false, why: 'muy-viejo' });
    // Se marca primero (con candado de versión) para que dos llamadas no manden dos correos.
    try { await patchDoc(`orders/${orderId}`, { notifiedAt: new Date() }, order._updateTime); }
    catch { return res.status(200).json({ ok: true, sent: false, why: 'en-curso' }); }

    const seller = await getDoc(`users/${order.sellerId}`);
    if (!seller || seller.notifyOrders !== true) return res.status(200).json({ ok: true, sent: false, why: 'desactivado' });
    const to = await userEmail(order.sellerId);
    if (!to) return res.status(200).json({ ok: true, sent: false, why: 'sin-correo-verificado' });

    const rows = [
      ['Producto', `${order.qty}× ${order.productTitle}`],
      order.options ? ['Opciones', order.options] : null,
      ['Total', money(order.total)],
      ['Pago', order.payment || '—'],
      ['Entrega', order.spot || 'Por acordar'],
      order.pickupAt ? ['Para', new Date(order.pickupAt).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })] : null,
      ['Comprador', order.buyerName || 'Invitado'],
      order.note ? ['Nota', order.note] : null,
    ].filter(Boolean);
    const intro = `${order.buyerName || 'Alguien'} te acaba de hacer un pedido en Hiusu. Entra a tu panel para aceptarlo o rechazarlo.`;
    const footer = 'Recibes este aviso porque activaste "Avisos de pedidos por correo" en tu perfil de Hiusu. Puedes desactivarlo en Mi panel → Perfil.';
    await sendMail({
      host: SMTP_HOST, port: SMTP_PORT || 465, user: ORDERS_SMTP_USER, pass: ORDERS_SMTP_PASS,
      from: ORDERS_SMTP_USER, fromName: 'Hiusu Pedidos', to,
      subject: `🛎️ Nuevo pedido: ${order.qty}× ${order.productTitle} · ${money(order.total)}`,
      text: `${intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nVer mis pedidos: ${SITE}/#/panel/pedidos\n\n${footer}`,
      html: layout({ title: '🛎️ ¡Tienes un pedido nuevo!', intro, rows, button: { text: 'Ver mis pedidos', url: `${SITE}/#/panel/pedidos` }, footer }),
      unsubscribe: `${SITE}/#/panel/perfil`,
    });
    return res.status(200).json({ ok: true, sent: true });
  } catch (e) {
    console.error('notify-order', e.message);
    return res.status(200).json({ ok: true, sent: false, why: 'error' });
  }
};
