/**
 * Ferduqui — servidor en Google Sheets (Apps Script)
 * ------------------------------------------------------------
 * Pega este archivo completo en Extensiones > Apps Script de tu
 * Google Sheet. Las hojas "Usuarios", "Sesiones" y "Registros"
 * se crean solas la primera vez que alguien crea su cuenta.
 *
 * Las contraseñas NO se guardan: se guarda una huella cifrada
 * (SHA-256 con sal, repetido muchas veces).
 */

const DUENO = 'Matías';
const MAX_CUENTAS = 8;              // tope de cuentas (la URL es pública)
const VUELTAS_HASH = 1000;          // más vueltas = más difícil adivinar contraseñas
const COLECCIONES = ['metodos', 'movs', 'fijos', 'metas', 'cats'];

const HOJAS = {
  usuarios:  { nombre: 'Usuarios',  columnas: ['usuarioId', 'nombreNorm', 'nombre', 'sal', 'hash', 'creado'], texto: 'A:E' },
  sesiones:  { nombre: 'Sesiones',  columnas: ['token', 'usuarioId', 'creado', 'ultimoUso'], texto: 'A:B' },
  registros: { nombre: 'Registros', columnas: ['usuarioId', 'coleccion', 'id', 'upd', 'srv', 'borrado', 'datos'], texto: 'A:C' },
};

/* ============================================================
   Entrada
   ============================================================ */
function doGet() {
  return salida({ ok: true, app: 'Ferduqui', mensaje: 'El servidor de Ferduqui está funcionando.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (p.accion) {
      case 'registrar': return salida(registrar(p));
      case 'entrar':    return salida(entrar(p));
      case 'sync':      return salida(sincronizar(p));
      case 'salir':     return salida(salir(p));
      default:          return salida({ ok: false, codigo: 'accion', error: 'Acción desconocida.' });
    }
  } catch (err) {
    return salida({ ok: false, codigo: err.codigo || 'error', error: err.codigo ? err.message : 'Error en el servidor: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* nada */ }
  }
}

/* ============================================================
   Cuentas
   ============================================================ */
function registrar(p) {
  const nombre = limpiarNombre(p.nombre);
  const norm = normalizar(nombre);
  const pass = String(p.contrasena || '');
  if (norm.length < 3) throw fallo('datos', 'Escribe tu nombre completo.');
  if (pass.length < 6) throw fallo('datos', 'La contraseña necesita al menos 6 caracteres.');

  const sh = hoja('usuarios');
  const filas = sh.getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (filas[i][1] === norm) throw fallo('existe', 'Ya hay una cuenta con ese nombre. Si es tuya, toca "Ya tengo cuenta".');
  }
  if (MAX_CUENTAS && filas.length - 1 >= MAX_CUENTAS) {
    throw fallo('lleno', 'Ya no hay lugar para más cuentas. Pregúntale a ' + DUENO + '.');
  }
  const usuarioId = 'u' + Utilities.getUuid().replace(/-/g, '').slice(0, 14);
  const sal = Utilities.getUuid();
  sh.appendRow([usuarioId, seguro(norm), seguro(nombre), sal, hashear(pass, sal), new Date()]);
  return { ok: true, usuarioId: usuarioId, nombre: nombre, token: crearSesion(usuarioId) };
}

function entrar(p) {
  const norm = normalizar(p.nombre);
  const pass = String(p.contrasena || '');
  const sh = hoja('usuarios');
  const filas = sh.getDataRange().getValues();
  let i = -1;
  for (let k = 1; k < filas.length; k++) if (filas[k][1] === norm) { i = k; break; }
  if (i < 0) {
    Utilities.sleep(600);
    throw fallo('noexiste', 'No encontramos ese nombre. Escríbelo igual que cuando creaste tu cuenta.');
  }
  const usuarioId = String(filas[i][0]), nombre = String(filas[i][2]), sal = String(filas[i][3]), hash = String(filas[i][4]);

  // Contraseña reiniciada por el administrador: la que escriba ahora se vuelve la nueva.
  if (!hash) {
    if (pass.length < 6) throw fallo('datos', 'Tu contraseña se reinició. Inventa una nueva de al menos 6 caracteres.');
    const nuevaSal = Utilities.getUuid();
    sh.getRange(i + 1, 4, 1, 2).setValues([[nuevaSal, hashear(pass, nuevaSal)]]);
    return { ok: true, usuarioId: usuarioId, nombre: nombre, token: crearSesion(usuarioId), nueva: true };
  }
  if (hashear(pass, sal) !== hash) {
    Utilities.sleep(800);
    throw fallo('contrasena', 'La contraseña no coincide. Revisa mayúsculas y vuelve a intentar.');
  }
  return { ok: true, usuarioId: usuarioId, nombre: nombre, token: crearSesion(usuarioId) };
}

function salir(p) {
  const sh = hoja('sesiones');
  const filas = sh.getDataRange().getValues();
  for (let i = filas.length - 1; i >= 1; i--) {
    if (filas[i][0] === String(p.token || '')) sh.deleteRow(i + 1);
  }
  return { ok: true };
}

function crearSesion(usuarioId) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const ahora = new Date();
  hoja('sesiones').appendRow([token, usuarioId, ahora, ahora]);
  return token;
}

function usuarioDeToken(token) {
  token = String(token || '');
  if (!token) throw fallo('sesion', 'Tu sesión ya no es válida. Vuelve a entrar.');
  const sh = hoja('sesiones');
  const filas = sh.getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (filas[i][0] === token) {
      sh.getRange(i + 1, 4).setValue(new Date());
      return String(filas[i][1]);
    }
  }
  throw fallo('sesion', 'Tu sesión ya no es válida. Vuelve a entrar.');
}

/* ============================================================
   Sincronización
   Cada registro (tarjeta, movimiento, meta…) es una fila.
   Gana la versión más nueva ("upd"). "srv" es la hora del
   servidor, para que cada cel pida solo lo que cambió.
   ============================================================ */
function sincronizar(p) {
  const usuarioId = usuarioDeToken(p.token);
  const sh = hoja('registros');
  const ahora = Date.now();
  const datos = sh.getDataRange().getValues();

  const indice = {};
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] === usuarioId) indice[datos[i][1] + '|' + datos[i][2]] = i;
  }

  // Quita duplicados del lote (se queda el más nuevo)
  const lote = {};
  (Array.isArray(p.cambios) ? p.cambios : []).slice(0, 800).forEach(function (c) {
    if (!c || COLECCIONES.indexOf(c.col) < 0 || !/^[\w-]{1,48}$/.test(String(c.id))) return;
    const k = c.col + '|' + c.id;
    if (!lote[k] || Number(c.upd) > Number(lote[k].upd)) lote[k] = c;
  });

  const nuevas = [];
  Object.keys(lote).forEach(function (k) {
    const c = lote[k];
    const upd = Number(c.upd) || 0;
    const json = c.del ? '' : JSON.stringify(c.datos || {});
    if (json.length > 45000) return;
    const fila = [usuarioId, c.col, String(c.id), upd, ahora, c.del ? 1 : 0, json];
    const i = indice[k];
    if (i !== undefined) {
      if (Number(datos[i][3]) > upd) return;           // el servidor ya tiene algo más nuevo
      datos[i] = fila;
      sh.getRange(i + 1, 1, 1, 7).setValues([fila]);
    } else {
      nuevas.push(fila);
    }
  });
  if (nuevas.length) sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, 7).setValues(nuevas);

  const desde = Number(p.since) || 0;
  const registros = [];
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] === usuarioId && Number(datos[i][4]) >= desde) registros.push(aRegistro(datos[i]));
  }
  nuevas.forEach(function (f) { registros.push(aRegistro(f)); });
  return { ok: true, now: ahora, registros: registros };
}

function aRegistro(f) {
  let d = null;
  if (f[6]) { try { d = JSON.parse(f[6]); } catch (e) { d = null; } }
  return { col: String(f[1]), id: String(f[2]), upd: Number(f[3]), del: Number(f[5]) === 1, datos: d };
}

/* ============================================================
   Ayudantes
   ============================================================ */
function hoja(clave) {
  const def = HOJAS[clave];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.nombre);
  if (!sh) {
    sh = ss.insertSheet(def.nombre);
    sh.getRange(def.texto).setNumberFormat('@');          // ids siempre como texto
    sh.getRange(1, 1, 1, def.columnas.length).setValues([def.columnas]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function hashear(pass, sal) {
  let h = sal + '|' + pass;
  for (let i = 0; i < VUELTAS_HASH; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function limpiarNombre(t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60); }
function seguro(t) { return /^[=+\-@]/.test(t) ? "'" + t : t; }   // que Sheets no lo lea como fórmula

function fallo(codigo, mensaje) { const e = new Error(mensaje); e.codigo = codigo; return e; }

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   Para ti (administrador)
   1. Escribe el nombre de la persona en NOMBRE_ADMIN (como sea, sin importar acentos).
   2. Guarda (Ctrl+S).
   3. Arriba elige la función y dale Ejecutar.
   ============================================================ */
const NOMBRE_ADMIN = '';

/** Ver qué cuentas existen y cuántos registros tiene cada una. */
function verCuentas() {
  const us = hoja('usuarios').getDataRange().getValues().slice(1);
  const regs = hoja('registros').getDataRange().getValues().slice(1);
  us.forEach(function (u) {
    const n = regs.filter(function (r) { return r[0] === u[0]; }).length;
    Logger.log(u[2] + '  —  ' + n + ' registros' + (u[4] ? '' : '  (contraseña reiniciada)'));
  });
  if (!us.length) Logger.log('Todavía no hay cuentas.');
}

/** Olvidó su contraseña: la borra. La próxima vez que entre, la que escriba será la nueva. */
function reiniciarContrasena() {
  const u = buscarAdmin();
  hoja('usuarios').getRange(u.fila, 4, 1, 2).setValues([['', '']]);
  borrarFilas('sesiones', function (f) { return f[1] === u.usuarioId; });
  Logger.log('Listo. ' + u.nombre + ' ya puede entrar con una contraseña nueva.');
}

/** Borra la cuenta y TODOS sus datos. No se puede deshacer. */
function borrarCuenta() {
  const u = buscarAdmin();
  borrarFilas('registros', function (f) { return f[0] === u.usuarioId; });
  borrarFilas('sesiones', function (f) { return f[1] === u.usuarioId; });
  hoja('usuarios').deleteRow(u.fila);
  Logger.log('Cuenta de ' + u.nombre + ' borrada con todos sus datos.');
}

function buscarAdmin() {
  const norm = normalizar(NOMBRE_ADMIN);
  if (!norm) throw new Error('Primero escribe el nombre en NOMBRE_ADMIN y guarda.');
  const filas = hoja('usuarios').getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (filas[i][1] === norm) return { fila: i + 1, usuarioId: String(filas[i][0]), nombre: String(filas[i][2]) };
  }
  throw new Error('No hay ninguna cuenta con el nombre "' + NOMBRE_ADMIN + '". Corre verCuentas para ver los nombres.');
}

function borrarFilas(clave, condicion) {
  const sh = hoja(clave);
  const datos = sh.getDataRange().getValues();
  const quedan = datos.filter(function (f, i) { return i === 0 || !condicion(f); });
  if (quedan.length === datos.length) return;
  sh.getRange(1, 1, datos.length, datos[0].length).clearContent();
  sh.getRange(1, 1, quedan.length, datos[0].length).setValues(quedan);
}
