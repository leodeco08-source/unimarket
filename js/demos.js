/* =========================================================
   DEMOS CON DATOS DE EJEMPLO (solo modo demo, nada toca Firebase)
   Ábrelas con ?demo=<nombre>, por ejemplo  https://www.hiusu.com/?demo=estrella
   Se cargan la primera vez; para empezar de cero agrega &reset.
   ========================================================= */
window.HIUSU_DEMOS = {
  estrella: {
    session: { uid: 'seed-estrella', name: 'Estrella', email: 'estrella.demo@gmail.com', photo: '', provider: 'google.com' },
    hash: '#/panel/pedidos',
    seed({ ls, K, newId }) {
      const H = 3600e3, D = 24 * H, now = Date.now();
      const uid = this.session.uid;
      // La entrega es entre semana a las 8:50 am: el siguiente día hábil.
      const nextDelivery = (() => {
        const d = new Date(now + D);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        d.setHours(8, 50, 0, 0);
        return d.getTime();
      })();
      const atNineAgo = days => { const d = new Date(now - days * D); d.setHours(8, 50, 0, 0); return d.getTime(); };

      const avena = {
        id: 'avena-estrella', title: 'Avena trasnochada 🥣', price: 40, category: 'comida', sub: 'Saludable', mode: 'preorden',
        description: 'Avenita trasnochada remojada en lechita deslactosada, vainilla, canela y miel.\n\n'
          + 'Incluye dos frutas y dos toppings a tu elección, y además una porción de crema de cacao 🍫\n\n'
          + 'La llevo todos los días de 8:50 a 9:20 am. Pídela un día antes 😁',
        stock: null, spot: 'Entrada principal', schedule: 'Lun a Vie · 8:50 a 9:20 am', phone: '',
        payments: ['Efectivo', 'Transferencia'], active: true,
        thumb: 'assets/demo/avena-estrella.jpg', images: ['assets/demo/avena-estrella.jpg'],
        options: [
          { name: 'Frutas', pick: 2, choices: ['Fresa 🍓', 'Uva verde 🍇', 'Manzana 🍎', 'Plátano 🍌'] },
          { name: 'Toppings', pick: 2, choices: ['Granola', 'Chispas de chocolate', 'Arándano', 'Almendra', 'Nuez', 'Coco tostado'] },
        ],
        sold: 0, sellerId: uid, sellerName: 'Estrella', sellerPhoto: '', createdAt: now - 21 * D, updatedAt: now - 2 * H,
      };

      const buyers = [
        ['Mariana González', '+523314829607'], ['José Luis Hernández', '+523320957148'], ['Fernanda Ríos', '+523338416290'],
        ['Daniela Pérez', '+523312074863'], ['Ricardo Morales', '+523345190728'], ['Ximena Cárdenas', '+523329638105'],
        ['Andrés Navarro', '+523317205946'], ['Paola Jiménez', '+523336892014'], ['Luis Fernando Ortiz', '+523321478059'],
        ['Karla Mendoza', '+523340917382'], ['Sebastián Flores', '+523318350694'], ['Valentina Cruz', '+523327049815'],
        ['Alejandra Vega', '+523335712048'], ['Emiliano Rojas', '+523313968270'], ['Regina Salazar', '+523342580167'],
        ['Diego Castañeda', '+523319406728'], ['Sofía Aguirre', '+523326157093'], ['Miguel Ángel Ruiz', '+523334820951'],
        ['Natalia Herrera', '+523311693582'], ['Jorge Delgado', '+523347215609'],
      ];
      const F = avena.options[0].choices, T = avena.options[1].choices;
      const combos = [
        [0, 1, 0, 1], [0, 3, 1, 2], [1, 3, 2, 3], [0, 2, 0, 4], [3, 1, 1, 5], [0, 3, 1, 3], [1, 2, 0, 2], [0, 1, 4, 5],
        [2, 3, 0, 1], [0, 3, 1, 4], [1, 3, 0, 2], [0, 2, 3, 5], [0, 1, 1, 2], [3, 2, 0, 5], [0, 3, 2, 4], [1, 0, 1, 3],
      ];
      const optText = ([a, b, c, d]) => `Frutas: ${F[a]}, ${F[b]} · Toppings: ${T[c]}, ${T[d]}`;
      const notes = ['', '', 'Sin miel porfa 🙏', '', 'Salgo de clase a las 9:10, ¿me esperas en la entrada?', '', 'Que la crema de cacao venga aparte', ''];
      const spots = ['Entrada principal', 'Entrada principal', 'Biblioteca', 'Entrada principal', 'Explanada'];

      // [estado, días atrás que se pidió, cantidad, pago]
      const plan = [
        ['pendiente', 0.08, 1, 'Efectivo'], ['pendiente', 0.2, 2, 'Transferencia'], ['pendiente', 0.35, 1, 'Efectivo'],
        ['pendiente', 0.5, 1, 'Transferencia'], ['pendiente', 0.7, 1, 'Efectivo'],
        ['aceptado', 0.9, 1, 'Efectivo'], ['aceptado', 1.0, 2, 'Efectivo'], ['aceptado', 1.1, 1, 'Transferencia'],
        ['entregado', 2, 1, 'Efectivo'], ['entregado', 2, 1, 'Transferencia'], ['entregado', 3, 2, 'Efectivo'],
        ['entregado', 3, 1, 'Efectivo'], ['entregado', 4, 1, 'Transferencia'], ['entregado', 5, 1, 'Efectivo'],
        ['entregado', 6, 1, 'Efectivo'], ['entregado', 7, 2, 'Transferencia'], ['entregado', 8, 1, 'Efectivo'],
        ['entregado', 9, 1, 'Efectivo'], ['entregado', 10, 1, 'Transferencia'], ['entregado', 11, 1, 'Efectivo'],
        ['entregado', 13, 1, 'Efectivo'], ['entregado', 15, 2, 'Efectivo'],
        ['rechazado', 6, 1, 'Efectivo'], ['cancelado', 4, 1, 'Transferencia'],
      ];
      const orders = plan.map(([status, daysAgo, qty, payment], i) => {
        const [buyerName, buyerPhone] = buyers[i % buyers.length];
        const createdAt = now - daysAgo * D;
        const active = status === 'pendiente' || status === 'aceptado';
        return {
          id: 'demo-o' + (i + 1), productId: avena.id, productTitle: avena.title, productThumb: avena.thumb, category: avena.category,
          price: avena.price, qty, total: avena.price * qty, sellerId: uid, sellerName: avena.sellerName, sellerPhone: '',
          buyerId: 'demo-buyer-' + (i % buyers.length), buyerName, buyerEmail: '', buyerPhone, guest: i % 5 === 3,
          spot: spots[i % spots.length], payment, note: notes[i % notes.length], options: optText(combos[i % combos.length]),
          status, mode: 'preorden', pickupAt: active ? nextDelivery : atNineAgo(Math.max(0, daysAgo - 1)),
          buyerCode: i % 3 ? '' : String(220000000 + i * 7919), createdAt, updatedAt: createdAt + H,
        };
      });
      avena.sold = orders.filter(o => o.status === 'entregado').reduce((a, o) => a + o.qty, 0);

      // 10 reseñas: 8 de 5★ y 2 de 4★ = 4.8
      const reviewTexts = [
        [5, '¡Riquísima! La granola súper crujiente y la fruta fresquita 😍'], [5, 'La mejor avena del CUGDL, ya la pido diario.'],
        [4, 'Muy rica, solo tardó un poquito en la entrega.'], [5, 'Llega a tiempo y bien servida. 100% recomendada.'],
        [5, 'La crema de cacao le queda perfecta 🤤'], [5, 'Me salvó el desayuno antes del examen jaja, gracias!'],
        [5, 'Súper atenta y la avena deliciosa.'], [4, 'Rica y llenadora, me gustaría que hubiera más toppings.'],
        [5, 'Fresa con plátano y chispas, combinación ganadora 🍓🍌'], [5, 'Excelente precio por lo que trae.'],
      ];
      const delivered = orders.filter(o => o.status === 'entregado');
      const reviews = reviewTexts.map(([rating, comment], i) => {
        const o = delivered[i];
        return { id: o.id, productId: avena.id, sellerId: uid, buyerId: o.buyerId, buyerName: o.buyerName.split(' ')[0],
          rating, comment, productTitle: avena.title, createdAt: o.pickupAt + 3 * H };
      });

      ls.set(K.p, [...ls.get(K.p, []), avena]);
      ls.set(K.o, orders);
      ls.set('cm_reviews', reviews);
      ls.set(K.u, { [uid]: { name: 'Estrella', phone: '', faculty: '', studentCode: '', payments: ['Efectivo', 'Transferencia'], nameConfirmed: true } });
    },
  },
};
