# Hiusu

![Hiusu](assets/hiusu-logo.jpg)

Marketplace para comprar y vender dentro de la universidad. Hecho con **HTML + CSS + JavaScript** puro (sin build) y **Firebase** (Auth + Firestore).

- Cualquiera puede **ver** productos sin iniciar sesión.
- La sesión se pide solo al **publicar**, **comprar** o abrir el **panel**.
- Inicio de sesión con **Google** y **correo/contraseña**.
- **Panel de vendedor**: resumen con estadísticas, editar/pausar/eliminar publicaciones, pedidos en **tiempo real** (aceptar → entregado), mis compras y perfil.
- Contacto directo por **WhatsApp** con mensaje prellenado.
- Diseño mobile-first con barra inferior, modo oscuro automático y animaciones.
- **Modalidad Inmediato / Pre-orden**: los productos sobre pedido no manejan stock y el comprador elige fecha y hora de entrega.
- **Subcategorías (estilos)** como segundo filtro, más filtro por modalidad.
- **Compra rápida** con el botón **+** de cada tarjeta.
- **Catálogo en tiempo real**: si alguien publica, aparece sin recargar.
- **Tablero Kanban** de pedidos (Nuevos → En proceso → Entregados): en computadora se arrastran los pedidos entre columnas.
- **Ventas de hoy** en el panel, sonido y vibración al llegar un pedido, y contador de pendientes en el título de la pestaña.
- **Matrícula / código de estudiante** opcional en el perfil, visible para el vendedor.
- **Disponibilidad en tiempo real**: desde *Mis publicaciones* (o la página del producto) el vendedor cambia con un toque entre ⚡ Inmediato (con cuántos tiene listos) y 📅 Pre-orden.
- **Métodos de pago por vendedor**: efectivo, transferencia o ambos. Se configura una vez en el perfil y se puede aplicar a todas las publicaciones. Los datos bancarios son privados: el comprador solo los ve cuando el vendedor acepta su pedido.
- **Fotos en ImgBB**: se suben a ImgBB y Firestore solo guarda el enlace (clave en `imgbbKey` de `js/config.js`).
- **Compra sin cuenta (invitado)**: el comprador llena nombre, WhatsApp y matrícula opcional. Sus pedidos se guardan en su dispositivo y, si después inicia sesión, pasan a su cuenta. Requiere activar **Anónimo** en Firebase → Authentication → Sign-in method. Se apaga con `guestCheckout: false`.
- **Más info con cuenta**: a los invitados se les muestra la descripción recortada, una sola foto y sin WhatsApp del vendedor (`limitGuestDetails` en `js/config.js`).
- **Detector de pedidos falsos**: marca como “⚠️ Posible fake” los pedidos con nombre al azar o de prueba, datos vacíos, WhatsApp inválido o repetido, cantidades raras o muchos pedidos pendientes del mismo comprador. Hay un filtro “Posibles fake” en Pedidos.

## Estructura

```
index.html        Estructura base (header, barra inferior, scripts)
css/styles.css    Todos los estilos
js/config.js      ⚙️  Configuración: Firebase, nombre, categorías, lugares, moneda
js/data.js        Capa de datos (Firebase real o modo demo con localStorage)
js/app.js         Interfaz: rutas, catálogo, pedidos, editor y panel
firestore.rules   Reglas de seguridad para Firestore
```

## 1. Probarlo ya (modo demo)

**La forma más fácil:** haz doble clic en **`iniciar.command`**. Abre la página en `http://localhost:5173`.
(La primera vez macOS puede pedir permiso: clic derecho → Abrir.)

No abras `index.html` con doble clic: Google solo permite iniciar sesión en páginas `http://` o `https://`.
También puedes iniciar el servidor a mano:

```bash
python3 -m http.server 5173
```

o la extensión **Live Server** de VS Code. Luego abre `http://localhost:5173`.

> Tip: la sesión demo es por pestaña. Abre dos pestañas, entra con una cuenta distinta en cada una (una vende, otra compra) y verás los pedidos llegar en tiempo real.
> Para borrar los datos demo: en la consola del navegador ejecuta `localStorage.clear()`.

> Ya está configurado tu proyecto `unimarket-6cdb6`. Para seguir usando el modo demo abre `http://localhost:5173/?demo`.
> Esta versión usa las colecciones `products`, `productImages`, `orders` y `users`. Los datos de la versión anterior (`productos`, `pedidos`) no aparecerán.

## 2. Conectar Firebase

1. Entra a <https://console.firebase.google.com> → **Agregar proyecto**.
2. **Configuración del proyecto → Tus apps → Web (`</>`)** → registra la app y copia el objeto `firebaseConfig` dentro de `firebase: { ... }` en `js/config.js`.
3. **Authentication → Sign-in method**, activa:
   - **Correo electrónico/contraseña**
   - **Google**
4. **Firestore Database → Crear base de datos** (modo producción) → pestaña **Reglas** → pega el contenido de `firestore.rules` → **Publicar**.
5. **Authentication → Settings → Authorized domains**: agrega el dominio donde publiques la página (`localhost` ya viene incluido).

### Solo correos de la universidad (opcional)

- En `js/config.js`: `allowedEmailDomains: ['miuni.edu']`
- Y para que sea seguro de verdad, en `firestore.rules` cambia la función `allowedUser()`:
  ```
  function allowedUser() { return signedIn() && request.auth.token.email.matches('.*@miuni[.]edu$'); }
  ```

## 3. Publicar en internet (gratis)

**Firebase Hosting**:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

(En `init`, usa `.` como carpeta pública y responde **No** a "single-page app".)
También funciona en Netlify, Vercel o GitHub Pages: solo sube la carpeta.

## Notas

- **Fotos**: se comprimen en el navegador y se guardan en Firestore (una miniatura en `products` y las fotos completas en `productImages`). Así funciona con el **plan gratuito** de Firebase sin necesidad de Storage. Máximo 4 fotos por producto.
- **Pagos**: el pago es en persona (efectivo o transferencia). Los métodos se configuran en `paymentMethods`.
- **Inventario**: al aceptar un pedido se descuenta del stock; si el vendedor cancela un pedido aceptado, se devuelve.
- **Personalizar**: cambia `appName`, `universityName`, `categories`, `campusSpots`, `currencySymbol` y `whatsappCountryCode` en `js/config.js`. Los colores están al inicio de `css/styles.css` (`--brand`, `--accent`).
