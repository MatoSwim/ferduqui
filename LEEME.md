# Ferduqui 🍵

App de finanzas para tus amigos: tarjetas de débito y crédito, efectivo, gastos e ingresos con categorías, fijos, metas de ahorro, avisos de pago y gráficas de la semana y de cada mes. Se instala en el cel, funciona sin internet y sube los datos cuando hay conexión.

## Qué hay en la carpeta

| Archivo | Para qué |
|---|---|
| `index.html`, `estilos.css`, `app.js` | La app |
| `sw.js`, `manifest.json` | Para instalarla y que abra sin internet |
| `iconos/`, `fuentes/` | Logo y letras (van incluidas para que funcione offline) |
| `apps-script/Codigo.gs` | El servidor en Google Sheets (no se sube a GitHub, se pega en Apps Script) |

## 1. Servidor en Google Sheets (5 min)

1. Crea una Google Sheet nueva, por ejemplo "Ferduqui datos".
2. **Extensiones → Apps Script**. Borra lo que trae y pega todo `apps-script/Codigo.gs`. Guarda.
3. **Implementar → Nueva implementación → Tipo: App web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Autoriza los permisos (te va a decir que la app no está verificada: *Configuración avanzada → Ir a…*).
5. Copia la **URL de la app web** (termina en `/exec`).

Las hojas `Usuarios`, `Sesiones` y `Registros` se crean solas cuando alguien hace su cuenta.

## 2. Conectar la app

Abre `app.js` y pega la URL en la línea 10:

```js
const API_URL = 'https://script.google.com/macros/s/XXXX/exec';
```

Si la dejas vacía, la app corre en **modo prueba**: funciona completa pero todo se queda solo en ese cel.

## 3. Subir a GitHub Pages

1. Sube todo (menos la carpeta `apps-script`, si quieres) a un repo, por ejemplo `ferduqui`.
2. **Settings → Pages → Branch: main / root → Save**.
3. Comparte el link `https://<tu-usuario>.github.io/ferduqui/` con tus amigos.

Para instalarla: en Android, Chrome → menú ⋮ → *Instalar app*. En iPhone, Safari → Compartir → *Agregar a inicio*. La app también se los explica en "Mi cuenta → Instalar en mi cel".

## Cuando cambies algo

Sube el número en la primera línea de `sw.js` (`ferduqui-v1` → `ferduqui-v2`). Si no, los cels siguen usando la versión guardada. La versión nueva les llega la segunda vez que abren la app.

Si cambias `Codigo.gs`: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva → Implementar**. Así la URL no cambia.

## Cosas de administrador

En `Codigo.gs`, hasta abajo:

- **Olvidó su contraseña:** escribe su nombre en `NOMBRE_ADMIN`, guarda y ejecuta `reiniciarContrasena`. La próxima vez que entre, la contraseña que escriba se vuelve la nueva.
- **Borrar una cuenta y todos sus datos:** igual, pero ejecuta `borrarCuenta`.
- **Ver quién tiene cuenta:** ejecuta `verCuentas` y revisa el registro de ejecución.

El tope de cuentas está en `MAX_CUENTAS` (8). Así, aunque alguien encuentre el link, no te llenan la hoja.

## Cómo funciona por dentro

- **Cuentas:** nombre completo + contraseña. El nombre se compara sin acentos, mayúsculas ni espacios de más. La contraseña se guarda como huella SHA-256 con sal (1000 vueltas), nunca en texto.
- **Sin internet:** todo se guarda primero en el cel. Cada cambio queda "por subir" y se manda solo al volver la conexión (lo ves en la bolita de arriba: *Guardado*, *Por subir*, *Sin internet*).
- **Varios cels:** cada tarjeta, movimiento o meta es una fila en `Registros`. Si se edita lo mismo en dos cels, gana el cambio más reciente.
- **Saldos:** la app guarda cuánto tenías al registrar la tarjeta y le suma o resta cada movimiento. "Moví" (sacar efectivo, pagar la tarjeta) no cuenta como gasto, solo cambia el dinero de lugar.
- **Tarjeta de crédito:** con el día de corte y de pago calcula cuánto pagar para no generar intereses y cuántos días faltan. Lo que gastas después del corte se paga hasta el siguiente.
- **Metas:** el dinero apartado sigue en su tarjeta; la app solo lo marca como apartado y te dice cuánto te toca juntar cada semana, quincena o mes.
- **Avisos:** la app muestra en *Pendientes* lo que toca pagar. Si activan los avisos del cel, al abrirla también manda la notificación. En iPhone solo funcionan con la app instalada en el inicio. No hay avisos con la app cerrada (eso necesitaría un servidor de pago).
