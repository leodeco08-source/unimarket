/* =========================================================
   Envío de correo por SMTP (Zoho) sin dependencias.
   Manda versión de texto y HTML (los filtros de spam lo prefieren),
   con cabeceras correctas y aviso de cómo dejar de recibirlos.
   ========================================================= */
const tls = require('tls');

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const enc = s => `=?UTF-8?B?${b64(s)}?=`;
const oneLine = s => String(s || '').replace(/[\r\n]+/g, ' ').trim();
const wrap = s => b64(s).replace(/.{1,76}/g, '$&\r\n');
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {object} o host, port, user, pass: cuenta SMTP · from, fromName · to · replyTo · subject · text · html · unsubscribe (url o mailto)
 */
function sendMail(o) {
  const from = oneLine(o.from || o.user), to = oneLine(o.to);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return Promise.reject(new Error('Correo de destino inválido'));
  const boundary = 'hiusu_' + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${enc(oneLine(o.fromName || 'Hiusu'))} <${from}>`,
    `To: <${to}>`,
    o.replyTo && `Reply-To: <${oneLine(o.replyTo)}>`,
    `Subject: ${enc(oneLine(o.subject))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@hiusu.com>`,
    o.unsubscribe && `List-Unsubscribe: <${oneLine(o.unsubscribe)}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const body = [
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(o.text || ''),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(o.html || escHtml(o.text || '')),
    `--${boundary}--`,
  ].join('\r\n');
  const message = headers.join('\r\n') + '\r\n\r\n' + body;
  const steps = [
    [null, 220], ['EHLO hiusu.com', 250], ['AUTH LOGIN', 334], [b64(o.user), 334], [b64(o.pass), 235],
    [`MAIL FROM:<${from}>`, 250], [`RCPT TO:<${to}>`, 250], ['DATA', 354], [message + '\r\n.', 250], ['QUIT', 221],
  ];
  return new Promise((resolve, reject) => {
    let i = 0, buf = '', done = false;
    const sock = tls.connect({ host: o.host, port: Number(o.port || 465), servername: o.host });
    const finish = err => { if (done) return; done = true; sock.destroy(); err ? reject(err) : resolve(); };
    sock.setEncoding('utf8');
    sock.setTimeout(15000, () => finish(new Error('SMTP: tiempo agotado')));
    sock.on('error', finish);
    sock.on('data', chunk => {
      buf += chunk;
      if (!buf.endsWith('\r\n')) return;
      const last = buf.trim().split('\r\n').pop();
      if (!/^\d{3} /.test(last)) return;
      buf = '';
      if (Number(last.slice(0, 3)) !== steps[i][1]) return finish(new Error('SMTP ' + last.slice(0, 120)));
      if (++i >= steps.length) return finish();
      sock.write(steps[i][0] + '\r\n');
    });
  });
}

// Plantilla HTML sencilla con la marca (sin imágenes externas: menos probabilidad de spam).
function layout({ title, intro, rows = [], button, footer }) {
  const row = ([k, v]) => `<tr><td style="padding:6px 0;color:#6d6a85;font-size:13px;width:120px;vertical-align:top">${escHtml(k)}</td><td style="padding:6px 0;font-size:14px;color:#17142b"><b>${escHtml(v)}</b></td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f5f4fb;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="background:#3f2d9c;color:#fff;border-radius:14px 14px 0 0;padding:16px 20px;font-size:20px;font-weight:bold">Hiusu</div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:20px">
      <h1 style="font-size:19px;margin:0 0 8px;color:#17142b">${escHtml(title)}</h1>
      <p style="margin:0 0 14px;color:#3d3a52;font-size:14px;line-height:1.5;white-space:pre-wrap">${escHtml(intro)}</p>
      ${rows.length ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px">${rows.map(row).join('')}</table>` : ''}
      ${button ? `<a href="${escHtml(button.url)}" style="display:inline-block;background:#3f2d9c;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:bold;font-size:14px">${escHtml(button.text)}</a>` : ''}
    </div>
    <p style="color:#8a87a3;font-size:12px;line-height:1.5;margin:14px 4px 0">${escHtml(footer || '')}</p>
  </div></body></html>`;
}

module.exports = { sendMail, layout, oneLine };
