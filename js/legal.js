/* =========================================================
   PÁGINAS LEGALES Y DE AYUDA
   Se muestran en #/legal/<página>. Los datos (responsable, correo, ciudad…)
   salen de `legal` en js/config.js.
   Importante: es una base razonable para un proyecto estudiantil en México,
   pero no sustituye la revisión de un abogado.
   ========================================================= */
window.HIUSU_LEGAL = function (C) {
  const L = C.legal || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = esc(C.appName);
  const uni = esc(C.universityName);
  const owner = esc(L.owner || C.appName);
  const city = esc(L.city || 'México');
  const mail = L.contactEmail
    ? `<a href="mailto:${esc(L.contactEmail)}">${esc(L.contactEmail)}</a>`
    : '<mark>[correo de contacto pendiente]</mark>';
  const link = (slug, text) => `<a href="#/legal/${slug}">${text}</a>`;

  return {
    terminos: {
      title: 'Términos y condiciones',
      intro: `Estos términos regulan el uso de ${app}. Al usar la plataforma, comprar o publicar, aceptas lo que aquí se describe.`,
      sections: [
        ['1. Qué es ' + app,
          `<p>${app} es una plataforma digital operada por <b>${owner}</b> que conecta a estudiantes y miembros de la comunidad universitaria que quieren comprar y vender productos y servicios entre sí, principalmente dentro de ${uni}.</p>
           <p>${app} <b>no vende, no compra, no fabrica, no almacena ni entrega</b> los productos publicados, <b>no cobra comisiones</b> y <b>no procesa pagos</b>. Cada compra es un acuerdo directo entre comprador y vendedor; ${app} solo ofrece el espacio para encontrarse.</p>`],
        ['2. Relación con la universidad',
          `<p>${app} es un proyecto independiente. <b>No está afiliado, patrocinado ni respaldado</b> por ${uni} ni por ninguna institución educativa, salvo que se indique expresamente. Los nombres de instituciones se usan solo para describir dónde se realizan las entregas.</p>`],
        ['3. Cuentas y uso como invitado',
          `<ul>
             <li>Puedes ver productos y comprar sin cuenta (como invitado). Para vender necesitas iniciar sesión con Google o con correo y contraseña.</li>
             <li>Debes tener <b>18 años o más</b>, o contar con la autorización de tu madre, padre o tutor.</li>
             <li>Los datos que proporciones (nombre, WhatsApp, matrícula) deben ser verdaderos. Eres responsable de lo que se haga con tu cuenta y de mantener seguro tu acceso.</li>
             <li>Los pedidos hechos como invitado se guardan en tu dispositivo; si borras los datos del navegador puedes perder el acceso a ellos.</li>
           </ul>`],
        ['4. Publicaciones',
          `<p>Quien publica es el único responsable de su publicación y de lo que vende. Al publicar te comprometes a que:</p>
           <ul>
             <li>La descripción, el precio, la disponibilidad y las fotos son reales y tienes derecho a usarlas.</li>
             <li>El producto o servicio es legal y cumple con las ${link('reglas', 'Reglas de la comunidad')}.</li>
             <li>Si vendes alimentos, los preparas y entregas con higiene, informas ingredientes y posibles alérgenos si te los piden, y respetas las disposiciones sanitarias y del campus aplicables.</li>
             <li>Atenderás tus pedidos y cancelarás a tiempo los que no puedas cumplir.</li>
           </ul>
           <p>Al publicar nos das permiso (no exclusivo y gratuito) para mostrar tu publicación y sus fotos dentro de ${app} mientras esté activa.</p>`],
        ['5. Pedidos, pagos y entregas',
          `<ul>
             <li>Un pedido en ${app} es una <b>solicitud</b> al vendedor; se vuelve un acuerdo cuando el vendedor lo acepta.</li>
             <li>El pago se hace <b>directamente al vendedor</b> en efectivo o por transferencia, según lo que él acepte. ${app} no recibe, guarda ni reembolsa dinero.</li>
             <li>Los datos bancarios que un vendedor comparte solo se muestran al comprador cuando acepta su pedido. Verifica siempre a quién transfieres.</li>
             <li>Las entregas se acuerdan entre ambas partes. Recomendamos hacerlas en lugares concurridos dentro del campus y revisar el producto al recibirlo.</li>
           </ul>`],
        ['6. Cancelaciones, reclamaciones y devoluciones',
          `<p>Las cancelaciones, cambios, devoluciones y cualquier reclamación sobre un producto se resuelven directamente entre comprador y vendedor. ${app} puede, a su criterio y sin obligación, ayudar a mediar, ocultar publicaciones o suspender cuentas cuando detecte abusos. Si tienes un problema serio, escríbenos a ${mail}.</p>`],
        ['7. Conductas no permitidas',
          `<p>No está permitido: hacer pedidos falsos o de broma, suplantar a otra persona, acosar o insultar a otros usuarios, publicar artículos prohibidos, usar ${app} para estafas o fraudes, intentar vulnerar la seguridad del sitio, ni copiar o extraer masivamente su contenido. ${app} marca automáticamente los pedidos que parecen falsos para ayudar a los vendedores.</p>`],
        ['8. Suspensión y eliminación',
          `<p>Podemos ocultar o eliminar publicaciones y suspender o cancelar cuentas que incumplan estos términos o las ${link('reglas', 'Reglas de la comunidad')}, sin previo aviso cuando haya riesgo para otros usuarios.</p>`],
        ['9. Limitación de responsabilidad',
          `<p>${app} se ofrece "tal cual" y de forma gratuita. En la medida que lo permita la ley, ${owner} no es responsable de la calidad, seguridad, legalidad o entrega de los productos, de la veracidad de las publicaciones, de los pagos entre usuarios, ni de daños derivados de los acuerdos entre ellos. Tampoco garantizamos que el servicio esté disponible sin interrupciones.</p>`],
        ['10. Propiedad intelectual',
          `<p>El nombre ${app}, su logotipo, el diseño y el código del sitio pertenecen a ${owner}. No puedes usarlos sin autorización. El contenido que publican los usuarios sigue siendo de sus autores.</p>`],
        ['11. Datos personales',
          `<p>El tratamiento de tus datos se describe en el ${link('privacidad', 'Aviso de privacidad')} y el uso de almacenamiento del navegador en la ${link('cookies', 'Política de cookies')}.</p>`],
        ['12. Cambios a estos términos',
          `<p>Podemos actualizar estos términos. Publicaremos la versión vigente en esta página con su fecha de actualización. Si sigues usando ${app} después de un cambio, se entiende que lo aceptas.</p>`],
        ['13. Ley aplicable',
          `<p>Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de ${city}, renunciando a cualquier otro fuero, sin perjuicio de los derechos que te otorga la Ley Federal de Protección al Consumidor cuando aplique.</p>`],
        ['14. Contacto', `<p>Dudas o reportes: ${mail}.</p>`],
      ],
    },

    privacidad: {
      title: 'Aviso de privacidad',
      intro: `En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, te informamos cómo tratamos tus datos en ${app}.`,
      sections: [
        ['Responsable',
          `<p><b>${owner}</b>, con domicilio en ${city}, es responsable del tratamiento de los datos personales que se recaban a través de ${app}. Contacto: ${mail}.</p>`],
        ['Datos que recabamos',
          `<ul>
             <li><b>Identificación y contacto:</b> nombre, correo electrónico (si inicias sesión), número de WhatsApp, matrícula o código de estudiante (opcional), facultad o carrera (opcional) y foto de perfil de Google (si entras con Google).</li>
             <li><b>De tus pedidos y publicaciones:</b> productos, cantidades, precios, punto y fecha de entrega, notas y estado del pedido; fotos y descripciones de lo que publicas.</li>
             <li><b>De pago (solo vendedores, opcional):</b> los datos para transferencia que decidas capturar (por ejemplo banco, CLABE y titular).</li>
             <li><b>Técnicos:</b> un identificador de sesión (también para invitados) y preferencias guardadas en tu navegador.</li>
           </ul>
           <p>No solicitamos datos personales sensibles.</p>`],
        ['Para qué los usamos',
          `<p><b>Finalidades necesarias:</b> crear y administrar tu cuenta; mostrar tus publicaciones; enviar tus pedidos al vendedor y permitir que se pongan en contacto por WhatsApp; mostrar el estado de tus pedidos; mostrar tus datos de transferencia solo a compradores cuyo pedido aceptaste; detectar pedidos falsos, abusos y fraudes; y cumplir obligaciones legales.</p>
           <p><b>Finalidades secundarias:</b> mejorar la plataforma con estadísticas generales de uso. Si no quieres que usemos tus datos para esto, escríbenos a ${mail}; no afecta tu uso del servicio.</p>`],
        ['Con quién compartimos tus datos',
          `<ul>
             <li><b>Con la otra parte de tu pedido:</b> el vendedor ve tu nombre, WhatsApp, matrícula (si la diste), nota y detalles del pedido; el comprador ve el nombre y WhatsApp del vendedor y, si aceptó un pago por transferencia, sus datos bancarios.</li>
             <li><b>Proveedores que nos dan servicio</b> (encargados): Google Firebase (inicio de sesión y base de datos), ImgBB (almacenamiento de las fotos, que son públicas), Vercel (alojamiento del sitio) y Google reCAPTCHA (protección contra bots y abusos, que analiza datos técnicos de tu navegador). Pueden estar fuera de México.</li>
             <li><b>El equipo de administración de ${app}:</b> puede revisar publicaciones, pedidos, reseñas y reportes solo para atender reportes, soporte o abusos. Cada acción queda registrada.</li>
             <li>Autoridades, cuando una ley o una orden lo requiera.</li>
           </ul>
           <p>No vendemos ni rentamos tus datos.</p>`],
        ['Tus derechos ARCO',
          `<p>Puedes <b>Acceder</b> a tus datos, <b>Rectificarlos</b>, <b>Cancelarlos</b> u <b>Oponerte</b> a su uso, así como revocar tu consentimiento. Muchos datos los puedes cambiar tú mismo en tu perfil. Para todo lo demás, escribe a ${mail} indicando tu nombre, el correo o WhatsApp con el que usas ${app} y lo que solicitas. Te responderemos en un máximo de 20 días hábiles.</p>`],
        ['Cuánto tiempo los guardamos',
          `<p>Mientras tengas una cuenta o pedidos activos, y después solo el tiempo necesario para resolver aclaraciones o cumplir obligaciones legales. Los datos de invitado guardados en tu dispositivo puedes borrarlos tú desde tu navegador.</p>`],
        ['Cookies y almacenamiento',
          `<p>Consulta la ${link('cookies', 'Política de cookies')}.</p>`],
        ['Cambios a este aviso',
          `<p>Cualquier cambio se publicará en esta página con su fecha de actualización.</p>`],
      ],
    },

    cookies: {
      title: 'Política de cookies',
      intro: `${app} no usa cookies de publicidad ni de rastreo. Solo usa el almacenamiento de tu navegador para que el sitio funcione.`,
      sections: [
        ['Qué guardamos en tu navegador',
          `<ul>
             <li><b>Sesión:</b> Google Firebase guarda tu sesión (o tu sesión de invitado) para que no tengas que volver a entrar y puedas ver tus pedidos.</li>
             <li><b>Tus datos de invitado:</b> nombre, WhatsApp y matrícula, para llenar tu próximo pedido, y una copia de los pedidos hechos desde ese dispositivo.</li>
             <li><b>Preferencias:</b> vista de pedidos, sonido de avisos y si cerraste algún aviso.</li>
           </ul>`],
        ['Servicios de terceros',
          `<p>El sitio carga tipografías de Google Fonts, las fotos desde ImgBB, los servicios de Google Firebase y Google reCAPTCHA (que puede usar sus propias cookies para distinguir personas de bots). Estos proveedores pueden registrar datos técnicos de la conexión (como tu dirección IP) según sus propias políticas.</p>`],
        ['Cómo borrarlo',
          `<p>Puedes borrar estos datos en cualquier momento desde la configuración de tu navegador (borrar datos del sitio). Si lo haces, se cerrará tu sesión y perderás los pedidos de invitado guardados en ese dispositivo.</p>`],
      ],
    },

    reglas: {
      title: 'Reglas de la comunidad',
      intro: `${app} funciona porque confiamos unos en otros. Estas reglas aplican a todas las publicaciones y pedidos.`,
      sections: [
        ['Artículos y servicios prohibidos',
          `<ul>
             <li>Bebidas alcohólicas, tabaco, cigarros electrónicos y vapeadores.</li>
             <li>Drogas o sustancias ilegales, medicamentos y suplementos sin registro.</li>
             <li>Armas, réplicas, explosivos, pirotecnia y objetos peligrosos.</li>
             <li>Productos robados, falsificados, piratas o de procedencia dudosa.</li>
             <li>Documentos oficiales, credenciales o identificaciones.</li>
             <li>Contenido sexual o para adultos.</li>
             <li>Animales vivos.</li>
             <li>Servicios académicos deshonestos: hacer exámenes, tareas o trabajos por otra persona, o vender exámenes.</li>
             <li>Apuestas, rifas sin permiso, esquemas piramidales o "inversiones".</li>
             <li>Cualquier cosa prohibida por la ley o por el reglamento de la institución donde se entrega.</li>
           </ul>`],
        ['Si vendes comida',
          `<ul>
             <li>Prepárala con higiene y entrégala en buen estado y a buena temperatura.</li>
             <li>Indica en la descripción si contiene alérgenos comunes (nueces, cacahuate, lácteos, gluten, mariscos…).</li>
             <li>No vendas alimentos caducados o en mal estado.</li>
           </ul>`],
        ['Cómo comportarnos',
          `<ul>
             <li>Sé respetuoso en mensajes y entregas. Cero acoso o discriminación.</li>
             <li>No hagas pedidos falsos o de broma; los vendedores invierten tiempo y dinero.</li>
             <li>Si no puedes cumplir un pedido o ir a una entrega, cancela o avisa a tiempo.</li>
             <li>Publica precios y fotos reales.</li>
           </ul>`],
        ['Si algo sale mal',
          `<p>Repórtalo a ${mail} con capturas de pantalla. Podemos ocultar publicaciones y suspender cuentas que rompan estas reglas.</p>`],
      ],
    },

    ayuda: {
      title: 'Ayuda',
      intro: `Respuestas rápidas sobre cómo funciona ${app}.`,
      sections: [
        ['¿Cómo compro?',
          `<p>Elige un producto y toca <b>Pedir ahora</b> (o el botón <b>+</b> en el catálogo). Puedes pedir sin cuenta: solo escribe tu nombre y WhatsApp. El vendedor recibe tu pedido al instante y te contacta para la entrega.</p>`],
        ['¿Cómo pago?',
          `<p>Directamente al vendedor, en efectivo al recibir o por transferencia si él lo acepta. Los datos para transferir te aparecen en <b>Mis compras</b> cuando el vendedor acepta tu pedido.</p>`],
        ['¿Cómo vendo?',
          `<p>Inicia sesión y toca <b>Vender</b>. Sube fotos, precio y si es entrega inmediata o pre-orden. Tus pedidos llegan a <b>Mi panel</b>, donde los aceptas y marcas como entregados.</p>`],
        ['¿Qué es pre-orden?',
          `<p>Productos que se preparan sobre pedido. Al pedir eliges el día y la hora de entrega.</p>`],
        ['¿Por qué conviene iniciar sesión?',
          `<p>Ves toda la información y las fotos, puedes escribir al vendedor por WhatsApp y tus pedidos te siguen a cualquier dispositivo.</p>`],
        ['Consejos de seguridad',
          `<ul>
             <li>Haz las entregas en lugares concurridos del campus.</li>
             <li>Revisa el producto antes de pagar en efectivo.</li>
             <li>Antes de transferir, confirma por WhatsApp con el vendedor.</li>
           </ul>`],
        ['¿Necesitas más ayuda?', `<p>Escríbenos a ${mail}.</p>`],
      ],
    },
  };
};
