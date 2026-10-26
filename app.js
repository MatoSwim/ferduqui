'use strict';
/* =========================================================
   Ferduqui — para que veas a dónde se va tu dinero
   ---------------------------------------------------------
   1) Pega en API_URL la URL de tu Apps Script (termina en /exec).
      Si la dejas vacía, la app corre en "modo prueba": todo se
      guarda solo en ese cel y no hay cuentas en la nube.
   2) DUENO es el nombre que aparece en el aviso de privacidad.
   ========================================================= */
const API_URL = 'https://script.google.com/macros/s/AKfycbxdNNMXt1VkX_l8-PXlUuCDyFGzmfzrn4OuH7Isx35RskgFalqQ5Fokr_QxlzBqy-bN/exec';
const DUENO = 'Matías';

/* =========================================================
   Utilidades
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const redondear = n => Math.round((+n || 0) * 100) / 100;
const suma = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);

const fmt0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function dinero(n) { n = redondear(n); return (Number.isInteger(n) ? fmt0 : fmt2).format(n); }
function leerMonto(t) { const n = parseFloat(String(t ?? '').replace(/[$,\s]/g, '')); return isFinite(n) ? redondear(n) : 0; }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function deIso(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function hoy() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function masDias(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diasHasta(d) { return Math.round((d - hoy()) / 86400000); }
function lunesDe(d) { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() - (r.getDay() + 6) % 7); return r; }
function fechaEnMes(y, m, dia) { const ultimo = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(dia, ultimo)); }
function fechaCorta(d) { return `${d.getDate()} ${MESES_C[d.getMonth()]}`; }
function fechaLarga(d) { return `${d.getDate()} de ${MESES[d.getMonth()]}`; }
function mesClave(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function cuando(s) {
  const d = deIso(s), n = diasHasta(d);
  if (n === 0) return 'Hoy';
  if (n === -1) return 'Ayer';
  return fechaCorta(d);
}
function enFaltan(n) {
  if (n === 0) return 'es hoy';
  if (n === 1) return 'es mañana';
  if (n > 1) return `faltan ${n} días`;
  if (n === -1) return 'se pasó ayer';
  return `se pasó hace ${-n} días`;
}
function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const LS = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('Tu cel no dejó guardar. Revisa que tengas espacio.'); } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nada */ } },
};

/* =========================================================
   Íconos
   ========================================================= */
const ICONO = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10h17a8.5 8.5 0 0 1-17 0Z"/><path d="M8.5 20.5h7"/><path d="M10 6.5c0-1.2 1.4-1.4 1.4-2.6M14 6.5c0-1.2 1.4-1.4 1.4-2.6"/></svg>',
  tarjetas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  metas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9" fill="currentColor"/></svg>',
  meses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 20v-7M10 20V6M15 20v-9M20 20v-5"/></svg>',
  mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  izq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
  der: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

/* =========================================================
   Catálogos
   ========================================================= */
const CATS_BASE = [
  ['g-comida', 'gasto', '🍔', 'Comida'],
  ['g-antojos', 'gasto', '🍵', 'Cafecito y antojos'],
  ['g-transporte', 'gasto', '🚗', 'Transporte'],
  ['g-escuela', 'gasto', '📚', 'Escuela y útiles'],
  ['g-ropa', 'gasto', '🛍️', 'Ropa y compras'],
  ['g-salidas', 'gasto', '🎉', 'Salidas'],
  ['g-cuidado', 'gasto', '💅', 'Cuidado personal'],
  ['g-casa', 'gasto', '🏠', 'Casa'],
  ['g-subs', 'gasto', '📱', 'Saldo y suscripciones'],
  ['g-regalos', 'gasto', '🎁', 'Regalos'],
  ['g-salud', 'gasto', '💊', 'Salud'],
  ['g-otros', 'gasto', '✨', 'Otros'],
  ['i-deposito', 'ingreso', '💸', 'Me depositaron'],
  ['i-pago', 'ingreso', '💼', 'Me pagaron'],
  ['i-mesada', 'ingreso', '🏦', 'Mesada'],
  ['i-venta', 'ingreso', '🛒', 'Vendí algo'],
  ['i-regalo', 'ingreso', '🎀', 'Me regalaron'],
  ['i-otro', 'ingreso', '✨', 'Otro'],
];

const COLORES = {
  matcha: { bg: '#557F32', tx: '#FFFFFF', n: 'Matcha' },
  sakura: { bg: '#EE9CB5', tx: '#3A1220', n: 'Sakura' },
  koicha: { bg: '#2F3F22', tx: '#FFFFFF', n: 'Verde oscuro' },
  lavanda: { bg: '#7660BD', tx: '#FFFFFF', n: 'Lavanda' },
  cielo: { bg: '#3574A3', tx: '#FFFFFF', n: 'Azul' },
  miel: { bg: '#E7B651', tx: '#2B2108', n: 'Miel' },
  durazno: { bg: '#F0A887', tx: '#2E1508', n: 'Durazno' },
  carbon: { bg: '#34362F', tx: '#FFFFFF', n: 'Negro' },
};
const TIPO_METODO = { debito: 'Débito', credito: 'Crédito', efectivo: 'Efectivo' };
const EMOJIS_META = ['✈️', '👟', '🎧', '📱', '💻', '🎁', '🎓', '🏖️', '🍵', '🌸', '🚗', '🐶'];
const FRECUENCIA = { semana: 'cada semana', quincena: 'cada quincena', mes: 'cada mes' };
const COLORES_GRAFICA = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

/* =========================================================
   Estado
   ========================================================= */
const COLS = ['metodos', 'movs', 'fijos', 'metas', 'cats'];
let sesion = LS.get('fq:sesion', null);
let D = null;          // datos del usuario
let pend = {};         // cambios por subir: { 'col|id': upd }
const ui = { vista: 'inicio', semana: 0, mesSel: null, filtro: 'todos', limite: 40, auth: 'bienvenida', animar: true };
const sync = { activo: false, error: null, ultima: 0, timer: null };
let instalador = null;
let fm = null;          // estado del formulario de movimiento
let pendienteTrasNueva = null; // si creas una tarjeta desde el +, regresamos al + al terminar
let planForm = {};             // lo que ya debías, repartido por mes (formulario de tarjeta)
let focoPrevio = null;

const uid = () => sesion.usuarioId;
function cargarDatos() {
  D = LS.get('fq:datos:' + uid(), null) || {};
  COLS.forEach(c => { if (!D[c] || typeof D[c] !== 'object') D[c] = {}; });
  pend = LS.get('fq:pend:' + uid(), {});
  sembrar();
}
function guardarDatos() {
  LS.set('fq:datos:' + uid(), D);
  LS.set('fq:pend:' + uid(), pend);
}
function sembrar() {
  CATS_BASE.forEach(([id, tipo, emoji, nombre], i) => {
    if (!D.cats[id]) D.cats[id] = { id, tipo, emoji, nombre, orden: i, upd: 1 };
  });
  if (!D.metodos.efectivo) D.metodos.efectivo = { id: 'efectivo', nombre: 'Efectivo', tipo: 'efectivo', color: 'miel', saldoInicial: 0, creado: 0, upd: 1 };
}
function poner(col, rec) {
  const previo = D[col][rec.id];
  rec.upd = Math.max(Date.now(), (previo?.upd || 0) + 1);
  D[col][rec.id] = rec;
  pend[col + '|' + rec.id] = rec.upd;
  guardarDatos();
  programarSync();
}
function quitar(col, id) { if (D[col][id]) poner(col, { id, del: true }); }
const lista = col => Object.values(D[col]).filter(r => r && !r.del);

/* =========================================================
   Cálculos
   ========================================================= */
const metodo = id => (D.metodos[id] && !D.metodos[id].del ? D.metodos[id] : null);
const nombreMetodo = id => metodo(id)?.nombre || 'Tarjeta borrada';
function cat(id) { const c = D.cats[id]; return c && !c.del ? c : { id, emoji: '✨', nombre: 'Sin categoría', tipo: 'gasto' }; }
function catsDe(tipo) { return lista('cats').filter(c => c.tipo === tipo).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre)); }
function metodosOrden() {
  return lista('metodos').sort((a, b) => (b.tipo === 'efectivo') - (a.tipo === 'efectivo') || (a.creado || 0) - (b.creado || 0));
}
function color(m) { return COLORES[m?.color] || COLORES.matcha; }
function estiloColor(m) { const c = color(m); return `--tc-bg:${c.bg};--tc-tx:${c.tx}`; }
const movs = () => lista('movs');
function movsOrden() { return movs().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0)); }

function efecto(v, mid) {
  const x = +v.monto || 0;
  if (v.tipo === 'gasto') return v.metodoId === mid ? -x : 0;
  if (v.tipo === 'ingreso') return v.metodoId === mid ? x : 0;
  if (v.tipo === 'mover') return (v.metodoId === mid ? -x : 0) + (v.destinoId === mid ? x : 0);
  return 0;
}
function base(m) { return m.tipo === 'credito' ? -(+m.deudaInicial || 0) : (+m.saldoInicial || 0); }
function saldo(m) { let s = base(m); for (const v of movs()) s += efecto(v, m.id); return redondear(s); }

/* ---------- crédito y compras a meses ---------- */
// Cuántos cortes (c) caen entre d y C, contando ambos: d <= c <= C
function cortesHasta(d, C, dc) {
  let primero = fechaEnMes(d.getFullYear(), d.getMonth(), dc);
  if (primero < d) primero = fechaEnMes(d.getFullYear(), d.getMonth() + 1, dc);
  if (primero > C) return 0;
  return (C.getFullYear() - primero.getFullYear()) * 12 + C.getMonth() - primero.getMonth() + 1;
}
// Calendario de lo que ya debías: { 'AAAA-MM': monto } por mes de pago
const planDe = m => Object.entries(m.plan || {}).filter(([, v]) => +v > 0);
function pagoDe(C, dp) {
  let pago = fechaEnMes(C.getFullYear(), C.getMonth(), dp);
  if (pago <= C) pago = fechaEnMes(C.getFullYear(), C.getMonth() + 1, dp);
  return pago;
}
const esMsi = v => v.tipo === 'gasto' && +v.meses > 1;
// Lo que el banco ya te cobró (en estados de cuenta) hasta el corte C, sin restar pagos
function exigibleAl(m, C) {
  const dc = +m.diaCorte, Ci = iso(C), mesPago = mesClave(pagoDe(C, +m.diaPago));
  let x = (+m.deudaInicial || 0) - suma(planDe(m), ([, v]) => +v);
  for (const [mes, v] of planDe(m)) if (mes <= mesPago) x += +v;
  for (const v of movs()) {
    const e = efecto(v, m.id);
    if (e >= 0) continue;
    if (esMsi(v)) x += (-e) * Math.min(+v.meses, cortesHasta(deIso(v.fecha), C, dc)) / +v.meses;
    else if ((v.fecha || '') <= Ci) x += -e;
  }
  return x;
}
function abonosDe(m) { return suma(movs(), v => Math.max(0, efecto(v, m.id))); }
function infoCredito(m) {
  const dc = +m.diaCorte, dp = +m.diaPago, h = hoy();
  const s = saldo(m), deuda = Math.max(0, -s), limite = +m.limite || 0;
  const r = { deuda, limite, disponible: limite ? redondear(limite - deuda) : null, porPagar: 0, corte: null, pago: null, sigCorte: null, diasPago: null, siguiente: 0, aMeses: [], faltaMeses: 0, proximos: [] };
  if (!dc || !dp) return r;
  let corte = fechaEnMes(h.getFullYear(), h.getMonth(), dc);
  if (corte > h) corte = fechaEnMes(h.getFullYear(), h.getMonth() - 1, dc);
  let pago = fechaEnMes(corte.getFullYear(), corte.getMonth(), dp);
  if (pago <= corte) pago = fechaEnMes(corte.getFullYear(), corte.getMonth() + 1, dp);
  let sig = fechaEnMes(h.getFullYear(), h.getMonth(), dc);
  if (sig <= h) sig = fechaEnMes(h.getFullYear(), h.getMonth() + 1, dc);
  const abonos = abonosDe(m);
  r.porPagar = redondear(Math.max(0, exigibleAl(m, corte) - abonos));
  r.siguiente = redondear(Math.max(0, exigibleAl(m, sig) - abonos));
  r.corte = corte; r.pago = pago; r.sigCorte = sig; r.diasPago = diasHasta(pago);
  // próximos pagos: el de ahora y lo que ya está programado para los siguientes meses
  r.proximos = [{ pago, monto: r.porPagar, actual: true }];
  let C = corte, prev = exigibleAl(m, corte);
  for (let k = 1; k <= 24; k++) {
    C = fechaEnMes(corte.getFullYear(), corte.getMonth() + k, dc);
    const x = exigibleAl(m, C);
    r.proximos.push({ pago: pagoDe(C, dp), monto: redondear(Math.max(0, x - prev)) });
    prev = x;
  }
  while (r.proximos.length > 2 && r.proximos[r.proximos.length - 1].monto <= 0) r.proximos.pop();
  // lista de compras a meses que siguen vivas
  for (const v of movs()) {
    if (!esMsi(v) || v.metodoId !== m.id) continue;
    const n = +v.meses, faltan = n - Math.min(n, cortesHasta(deIso(v.fecha), corte, dc));
    if (faltan > 0) r.aMeses.push({ nombre: v.nota || cat(v.catId).nombre, emoji: cat(v.catId).emoji, mensualidad: redondear(v.monto / n), total: n, faltan, faltaDinero: redondear(v.monto * faltan / n), id: v.id });
  }
  r.faltaMeses = redondear(suma(r.aMeses, a => a.faltaDinero));
  return r;
}

function ahorrado(meta) { return redondear(suma(movs().filter(v => v.tipo === 'ahorro' && v.metaId === meta.id), v => v.monto)); }
function apartadoEn(mid) {
  return redondear(suma(movs().filter(v => v.tipo === 'ahorro' && v.metodoId === mid && D.metas[v.metaId] && !D.metas[v.metaId].del), v => v.monto));
}
function inicioPeriodo(frec) {
  const h = hoy();
  if (frec === 'semana') return lunesDe(h);
  if (frec === 'quincena') return new Date(h.getFullYear(), h.getMonth(), h.getDate() >= 16 ? 16 : 1);
  return new Date(h.getFullYear(), h.getMonth(), 1);
}
function aportadoEnPeriodo(meta) {
  const desde = iso(inicioPeriodo(meta.frecuencia));
  return redondear(suma(movs().filter(v => v.tipo === 'ahorro' && v.metaId === meta.id && v.monto > 0 && v.fecha >= desde), v => v.monto));
}
function diasPorPeriodo(frec) { return frec === 'semana' ? 7 : frec === 'quincena' ? 15 : 30; }
function planMeta(meta) {
  const llevas = ahorrado(meta), objetivo = +meta.objetivo || 0, falta = Math.max(0, redondear(objetivo - llevas));
  const ap = +meta.aportacion || 0;
  let texto = '';
  if (falta <= 0) texto = '¡Ya la completaste! 🎉';
  else if (meta.fechaLimite) {
    const dias = diasHasta(deIso(meta.fechaLimite));
    const periodos = Math.max(1, Math.ceil(dias / diasPorPeriodo(meta.frecuencia)));
    const necesitas = Math.ceil(falta / periodos);
    texto = dias < 0
      ? `Tu fecha era el ${fechaLarga(deIso(meta.fechaLimite))}. Te faltan ${dinero(falta)}.`
      : `Para llegar al ${fechaLarga(deIso(meta.fechaLimite))} aparta ${dinero(necesitas)} ${FRECUENCIA[meta.frecuencia] || 'cada semana'}.`;
  } else if (ap > 0) {
    const n = Math.ceil(falta / ap);
    const fecha = masDias(hoy(), n * diasPorPeriodo(meta.frecuencia));
    texto = `Si apartas ${dinero(ap)} ${FRECUENCIA[meta.frecuencia]}, la completas por ahí del ${fechaLarga(fecha)}.`;
  } else texto = `Te faltan ${dinero(falta)}.`;
  return { llevas, objetivo, falta, pct: objetivo ? Math.min(100, (llevas / objetivo) * 100) : 0, texto };
}

function gastosPorCat(desde, hasta) {
  const m = new Map();
  for (const v of movs()) {
    if (v.tipo !== 'gasto' || v.fecha < desde || v.fecha > hasta) continue;
    m.set(v.catId, (m.get(v.catId) || 0) + (+v.monto || 0));
  }
  return [...m].map(([catId, total]) => ({ catId, total: redondear(total) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
}
function totalTipo(tipo, desde, hasta) {
  return redondear(suma(movs().filter(v => v.tipo === tipo && v.fecha >= desde && v.fecha <= hasta), v => v.monto));
}
function topConOtros(arr, n = 5) {
  if (arr.length <= n) return arr.map((d, i) => ({ ...d, color: COLORES_GRAFICA[i] }));
  const top = arr.slice(0, n).map((d, i) => ({ ...d, color: COLORES_GRAFICA[i] }));
  const resto = arr.slice(n);
  top.push({ catId: '__otros', total: redondear(suma(resto, d => d.total)), cuantas: resto.length, color: 'var(--c-otros)' });
  return top;
}
function etiquetaCat(d) {
  if (d.catId === '__otros') return { emoji: '🫧', nombre: `Otras ${d.cuantas} categorías` };
  return cat(d.catId);
}
function rangoMes(clave) {
  const [y, m] = clave.split('-').map(Number);
  return [`${clave}-01`, iso(new Date(y, m, 0))];
}

/* =========================================================
   Pendientes (lo que la app te recuerda)
   ========================================================= */
function pendientes() {
  const out = [], h = hoy(), mes = mesClave(h);
  for (const m of lista('metodos').filter(x => x.tipo === 'credito')) {
    const ic = infoCredito(m);
    if (ic.pago && ic.porPagar > 0 && ic.diasPago <= 7) {
      out.push({
        orden: ic.diasPago, tipo: ic.diasPago <= 2 ? 'urgente' : 'aviso', ico: '💳',
        titulo: `Paga ${dinero(ic.porPagar)} de tu ${m.nombre}`,
        texto: ic.diasPago >= 0 ? `Antes del ${fechaLarga(ic.pago)}, ${enFaltan(ic.diasPago)}.` : `Tu fecha de pago era el ${fechaLarga(ic.pago)}. Si ya pagaste, regístralo.`,
        acciones: [['pagarTarjeta', 'Ya pagué', m.id, 'btn']],
        notificar: ic.diasPago <= 3,
      });
    }
    if (ic.limite && ic.disponible !== null && ic.disponible < ic.limite * 0.15) {
      out.push({
        orden: 20, tipo: 'aviso', ico: '⚠️',
        titulo: `Tu ${m.nombre} ya casi llega al límite`,
        texto: ic.disponible > 0 ? `Solo te quedan ${dinero(ic.disponible)} disponibles.` : 'Ya no te queda crédito disponible.',
        acciones: [['verMetodo', 'Ver tarjeta', m.id, 'btn suave']],
      });
    }
  }
  for (const f of lista('fijos')) {
    if (f.ultimo === mes) continue;
    const fecha = fechaEnMes(h.getFullYear(), h.getMonth(), +f.dia || 1);
    const n = diasHasta(fecha);
    if (n > 3) continue;
    const esGasto = f.tipo !== 'ingreso';
    out.push({
      orden: 10 + n, tipo: esGasto && n <= 0 ? 'aviso' : '', ico: esGasto ? '📌' : '🪙',
      titulo: `${f.nombre}: ${dinero(f.monto)}`,
      texto: esGasto ? `Se paga el ${fechaLarga(fecha)} (${enFaltan(n)}).` : `Te llega el ${fechaLarga(fecha)}.`,
      acciones: [['fijoHecho', esGasto ? 'Ya lo pagué' : 'Ya me llegó', f.id, 'btn'], ['fijoSaltar', 'Este mes no', f.id, 'btn suave']],
    });
  }
  for (const meta of lista('metas')) {
    const p = planMeta(meta);
    if (p.falta <= 0 || !(+meta.aportacion > 0)) continue;
    const periodo = iso(inicioPeriodo(meta.frecuencia));
    if (LS.get(`fq:saltar:${uid()}:${meta.id}`, '') === periodo) continue;
    const falta = Math.min(p.falta, redondear(+meta.aportacion - aportadoEnPeriodo(meta)));
    if (falta <= 0) continue;
    out.push({
      orden: 30, tipo: '', ico: meta.emoji || '🎯',
      titulo: `Te toca apartar ${dinero(falta)} para ${meta.nombre}`,
      texto: `Lo guardas en ${nombreMetodo(meta.metodoId)}. ${meta.frecuencia === 'semana' ? 'Es de esta semana.' : meta.frecuencia === 'quincena' ? 'Es de esta quincena.' : 'Es de este mes.'}`,
      acciones: [['apartar', 'Apartar', meta.id, 'btn'], ['saltarMeta', 'Ahora no', meta.id, 'btn suave']],
    });
  }
  return out.sort((a, b) => a.orden - b.orden);
}

/* =========================================================
   Gráficas (SVG hecho a mano, funciona sin internet)
   ========================================================= */
function sector(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const g = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)} A${r1} ${r1} 0 ${g} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${g} 0 ${p(r0, a0)} Z`;
}
function taza(segs, { chica = false, arriba = '', numero = '', abajo = '' } = {}) {
  const total = suma(segs, s => s.total);
  const c = 150, r1 = 128, r0 = 86;
  let anillo = '';
  if (!total) {
    anillo = `<circle cx="${c}" cy="${c}" r="${(r0 + r1) / 2}" fill="none" stroke="var(--matcha-velo)" stroke-width="${r1 - r0}"/>`;
  } else if (segs.length === 1) {
    anillo = `<circle cx="${c}" cy="${c}" r="${(r0 + r1) / 2}" fill="none" stroke="${segs[0].color}" stroke-width="${r1 - r0}"><title>${esc(etiquetaCat(segs[0]).nombre)}: ${dinero(segs[0].total)}</title></circle>`;
  } else {
    let a = -Math.PI / 2;
    for (const s of segs) {
      const da = (s.total / total) * Math.PI * 2;
      anillo += `<path d="${sector(c, c, r0, r1, a, a + da)}" fill="${s.color}" stroke="var(--espuma)" stroke-width="3" stroke-linejoin="round"><title>${esc(etiquetaCat(s).nombre)}: ${dinero(s.total)}</title></path>`;
      a += da;
    }
  }
  const anim = ui.animar ? ' class="anillo-anim"' : '';
  return `<div class="taza${chica ? ' chica' : ''}">
    <svg viewBox="0 0 300 300" role="img" aria-label="${esc(arriba)} ${esc(numero)} ${esc(abajo)}">
      <defs><radialGradient id="espuma" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#EEF4E1"/><stop offset=".7" stop-color="#D6E5BE"/><stop offset="1" stop-color="#C3D8A4"/></radialGradient></defs>
      <circle cx="${c}" cy="${c}" r="146" fill="var(--ceramica)"/>
      <circle cx="${c}" cy="${c}" r="139" fill="var(--espuma)"/>
      <g${anim}>${anillo}</g>
      <circle cx="${c}" cy="${c}" r="${r0 - 6}" fill="url(#espuma)"/>
    </svg>
    <div class="centro"><small>${esc(arriba)}</small><strong>${esc(numero)}</strong><small>${esc(abajo)}</small></div>
  </div>`;
}
function leyenda(segs, total, deltas) {
  if (!segs.length) return '';
  return `<ul class="leyenda">${segs.map(s => {
    const c = etiquetaCat(s), pct = total ? Math.round((s.total / total) * 100) : 0;
    let extra = `<span class="pct">${pct}%</span>`;
    if (deltas) {
      const d = deltas.get(s.catId);
      if (d == null) extra = '<span class="delta">nuevo</span>';
      else if (Math.abs(d) < 1) extra = '<span class="delta">igual</span>';
      else extra = `<span class="delta ${d > 0 ? 'sube' : 'baja'}">${d > 0 ? '▲' : '▼'} ${dinero(Math.abs(d))}</span>`;
    }
    return `<li><span class="muestra" style="background:${s.color}"></span><span class="nombre">${esc(c.emoji)} ${esc(c.nombre)}</span><span class="cuanto">${dinero(s.total)}</span>${extra}</li>`;
  }).join('')}</ul>`;
}
function barras(meses, sel) {
  const W = 340, H = 190, top = 30, abajo = 30, alto = H - top - abajo;
  const max = Math.max(1, ...meses.map(m => m.total));
  const ancho = W / meses.length, bw = 30;
  const cols = meses.map((m, i) => {
    const x = i * ancho + (ancho - bw) / 2;
    const h = m.total > 0 ? Math.max(6, (m.total / max) * alto) : 3;
    const y = top + alto - h;
    const activo = m.clave === sel;
    const r = Math.min(6, h / 2);
    const d = `M${x} ${top + alto} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${top + alto} Z`;
    return `<g class="col" data-a="elegirMes" data-mes="${m.clave}" tabindex="0" role="button" aria-pressed="${activo}" aria-label="${esc(m.nombre)}: ${dinero(m.total)}">
      <rect class="fondo-col" x="${i * ancho + 2}" y="0" width="${ancho - 4}" height="${H}" rx="10" fill="transparent"/>
      <path d="${d}" fill="${activo ? 'var(--matcha)' : 'var(--matcha-palido)'}"/>
      ${activo ? `<text x="${x + bw / 2}" y="${y - 9}" text-anchor="middle" font-size="13" font-weight="800" fill="var(--koicha)">${dinero(m.total)}</text>` : ''}
      <text x="${x + bw / 2}" y="${H - 9}" text-anchor="middle" font-size="13" font-weight="${activo ? 800 : 600}" fill="${activo ? 'var(--koicha)' : 'var(--tinta-2)'}">${m.corto}</text>
    </g>`;
  }).join('');
  return `<svg class="barras" viewBox="0 0 ${W} ${H}" role="group" aria-label="Lo que gastaste cada mes">
    <line x1="0" x2="${W}" y1="${top + alto + .5}" y2="${top + alto + .5}" stroke="var(--linea)" stroke-width="1"/>
    ${cols}
  </svg>`;
}

/* =========================================================
   Pantallas
   ========================================================= */
function primerNombre() {
  const n = (sesion?.nombre || '').trim().split(' ')[0] || '';
  return n.charAt(0).toUpperCase() + n.slice(1);
}
function esInstalada() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

function chipSync() {
  let clase = '', txt = 'Guardado';
  const n = Object.keys(pend).length;
  if (!API_URL) { clase = 'prueba'; txt = 'Modo prueba'; }
  else if (sync.activo) { clase = 'subiendo'; txt = 'Guardando…'; }
  else if (!navigator.onLine) { clase = 'offline'; txt = n ? `Sin internet (${n})` : 'Sin internet'; }
  else if (sync.error) { clase = 'error'; txt = 'No se pudo subir'; }
  else if (n) { clase = 'pendiente'; txt = 'Por subir'; }
  return `<button class="chip-sync ${clase}" id="chip-sync" data-a="cuenta" aria-label="Estado de guardado: ${txt}"><span class="punto"></span>${txt}</button>`;
}
function pintarSync() { const el = $('#chip-sync'); if (el) el.outerHTML = chipSync(); }

function barra() {
  return `<header class="barra">
    <span class="marca"><img src="iconos/icono-192.png" alt="">Ferduqui</span>
    <span class="espacio"></span>
    ${chipSync()}
    <button class="avatar" data-a="cuenta" aria-label="Mi cuenta">${esc(primerNombre().charAt(0) || 'F')}</button>
  </header>`;
}
function navegacion() {
  const tab = (v, txt) => `<li><button class="tab" data-a="ir" data-v="${v}" ${ui.vista === v ? 'aria-current="page"' : ''}>${ICONO[v]}<span>${txt}</span></button></li>`;
  return `<nav class="nav" aria-label="Secciones"><ul>
    ${tab('inicio', 'Inicio')}${tab('tarjetas', 'Tarjetas')}
    <li style="display:grid"><button class="mas-grande" data-a="nuevoMov" aria-label="Registrar gasto o ingreso">${ICONO.mas}</button></li>
    ${tab('metas', 'Metas')}${tab('meses', 'Meses')}
  </ul></nav>`;
}

function render() {
  const app = $('#app');
  if (!sesion) { app.innerHTML = vistaAuth(); return; }
  const vista = VISTAS[ui.vista] || VISTAS.inicio;
  app.innerHTML = `<div class="pantalla">${barra()}<main id="principal">${vista()}</main></div>${navegacion()}`;
  ui.animar = false;
}

/* ---------- Inicio ---------- */
function bannerInstalar() {
  if (esInstalada() || LS.get('fq:no-instalar', false)) return '';
  return `<div class="banner-instalar">
    <img src="iconos/icono-192.png" alt="">
    <p>Ponla en la pantalla de tu cel para abrirla como app.</p>
    <div class="btns"><button class="btn chico rosa" data-a="instalar">Cómo</button><button class="btn-texto" data-a="noInstalar">Ahora no</button></div>
  </div>`;
}
function seccionSemana() {
  const ini = masDias(lunesDe(hoy()), ui.semana * 7), fin = masDias(ini, 6);
  const datos = gastosPorCat(iso(ini), iso(fin));
  const total = redondear(suma(datos, d => d.total));
  const segs = topConOtros(datos);
  const titulo = ui.semana === 0 ? 'Esta semana' : ui.semana === -1 ? 'La semana pasada' : `Semana del ${fechaCorta(ini)}`;
  let frase = '', frase2 = '';
  if (!total) {
    frase = ui.semana === 0
      ? 'Vas en ceros. Cuando gastes algo, toca el <strong>+</strong> y aquí vas a ver a dónde se va tu dinero.'
      : 'Esa semana no registraste gastos.';
  } else {
    const top = datos[0], c = cat(top.catId), pct = Math.round((top.total / total) * 100);
    frase = `Lo que más se te fue: <strong>${esc(c.emoji)} ${esc(c.nombre)}</strong>, ${dinero(top.total)} (${pct}% de todo).`;
    const antIni = masDias(ini, -7), anterior = totalTipo('gasto', iso(antIni), iso(masDias(antIni, 6)));
    if (anterior > 0) {
      if (ui.semana === 0) frase2 = `La semana pasada gastaste ${dinero(anterior)} en total.`;
      else frase2 = total > anterior ? `Fueron ${dinero(total - anterior)} más que la semana anterior.` : total < anterior ? `Fueron ${dinero(anterior - total)} menos que la semana anterior.` : 'Igual que la semana anterior.';
    }
  }
  return `<section aria-labelledby="t-semana">
    <div class="semana-nav">
      <button class="flecha" data-a="semana" data-d="-1" aria-label="Semana anterior">${ICONO.izq}</button>
      <div class="titulo"><h2 id="t-semana">${titulo}</h2><p>${fechaCorta(ini)} al ${fechaCorta(fin)}</p></div>
      <button class="flecha" data-a="semana" data-d="1" aria-label="Semana siguiente" ${ui.semana >= 0 ? 'disabled' : ''}>${ICONO.der}</button>
    </div>
    ${taza(segs, { arriba: 'Gastaste', numero: dinero(total), abajo: datos.length ? `en ${datos.length} ${datos.length === 1 ? 'categoría' : 'categorías'}` : ' ' })}
    <p class="frase">${frase}</p>
    ${frase2 ? `<p class="frase secundaria">${frase2}</p>` : ''}
    ${leyenda(segs, total)}
  </section>`;
}
function seccionPendientes() {
  const ps = pendientes();
  if (!ps.length) return '';
  return `<section class="bloque" aria-labelledby="t-pend">
    <div class="bloque-cabeza"><h2 id="t-pend">Pendientes</h2></div>
    <div class="notas">${ps.map(p => `
      <div class="nota ${p.tipo}">
        <span class="ico" aria-hidden="true">${esc(p.ico)}</span>
        <div><strong>${esc(p.titulo)}</strong><p>${esc(p.texto)}</p></div>
        <div class="acciones">${p.acciones.map(([a, t, id, cls]) => `<button class="${cls}" data-a="${a}" data-id="${esc(id)}">${t}</button>`).join('')}</div>
      </div>`).join('')}
    </div>
  </section>`;
}
function seccionGuia() {
  if (LS.get('fq:sin-guia:' + uid(), false)) return '';
  const pasos = [
    { hecho: (D.metodos.efectivo?.upd || 0) > 1, txt: 'Dime cuánto efectivo traes', a: 'editarMetodo', id: 'efectivo' },
    { hecho: lista('metodos').some(m => m.tipo !== 'efectivo'), txt: 'Agrega tu tarjeta', a: 'nuevoMetodo' },
    { hecho: lista('movs').some(v => v.tipo === 'gasto'), txt: 'Registra tu primer gasto con el +', a: 'nuevoMov' },
    { hecho: lista('metas').length > 0, txt: 'Crea una meta para ahorrar', a: 'nuevaMeta' },
  ];
  if (pasos.every(p => p.hecho)) return '';
  return `<section class="bloque guia" aria-labelledby="t-guia">
    <h2 id="t-guia">Empieza aquí</h2>
    <ol>${pasos.map(p => `<li class="${p.hecho ? 'hecho' : ''}"><button data-a="${p.a}" data-id="${p.id || ''}">${p.txt}</button></li>`).join('')}</ol>
    <button class="btn-texto" data-a="sinGuia">Ya le entendí, quitar esto</button>
  </section>`;
}
function miniTarjeta(m) {
  let valor, sub;
  if (m.tipo === 'credito') { const ic = infoCredito(m); valor = dinero(ic.deuda); sub = 'Debes'; }
  else { valor = dinero(saldo(m)); sub = m.tipo === 'efectivo' ? 'Traes' : 'Tienes'; }
  return `<button class="mini" style="${estiloColor(m)}" data-a="verMetodo" data-id="${esc(m.id)}">
    <span class="n">${esc(m.nombre)}</span><span class="v"><small>${sub}</small>${valor}</span>
  </button>`;
}
function seccionTarjetasMini() {
  return `<section class="bloque" aria-labelledby="t-mini">
    <div class="bloque-cabeza"><h2 id="t-mini">Tu dinero</h2><button class="btn-texto" data-a="ir" data-v="tarjetas">Ver todo</button></div>
    <div class="carrusel">${metodosOrden().map(miniTarjeta).join('')}
      <button class="mini agregar" data-a="nuevoMetodo"><span>+</span>Agregar tarjeta</button>
    </div>
  </section>`;
}
function filaMov(v, conFecha = true) {
  let emoji = '✨', titulo = '', sub = '', monto = dinero(v.monto), clase = '';
  if (v.tipo === 'gasto' || v.tipo === 'ingreso') {
    const c = cat(v.catId);
    emoji = c.emoji; titulo = v.nota || c.nombre;
    sub = v.nota ? `${c.nombre}, ${v.tipo === 'gasto' ? 'con' : 'a'} ${nombreMetodo(v.metodoId)}` : `${v.tipo === 'gasto' ? 'Con' : 'A'} ${nombreMetodo(v.metodoId)}`;
    if (esMsi(v)) sub += `, a ${v.meses} meses`;
    if (v.tipo === 'gasto') monto = '−' + monto; else { monto = '+' + monto; clase = 'entra'; }
  } else if (v.tipo === 'mover') {
    const des = metodo(v.destinoId), ori = metodo(v.metodoId);
    emoji = '🔁';
    titulo = v.nota || (des?.tipo === 'credito' ? 'Pago de tarjeta' : des?.tipo === 'efectivo' && ori?.tipo !== 'efectivo' ? 'Saqué efectivo' : 'Pasé dinero');
    sub = `${nombreMetodo(v.metodoId)} a ${nombreMetodo(v.destinoId)}`;
    clase = 'neutro';
  } else if (v.tipo === 'ahorro') {
    const meta = D.metas[v.metaId];
    emoji = meta?.emoji || '🎯';
    titulo = v.monto >= 0 ? `Aparté para ${meta?.nombre || 'una meta'}` : `Saqué de ${meta?.nombre || 'una meta'}`;
    sub = `En ${nombreMetodo(v.metodoId)}`;
    monto = dinero(Math.abs(v.monto)); clase = 'neutro';
  }
  return `<li><button class="mov" data-a="verMov" data-id="${esc(v.id)}">
    <span class="burbuja" aria-hidden="true">${esc(emoji)}</span>
    <span style="min-width:0"><span class="t">${esc(titulo)}</span><span class="s">${esc(sub)}</span></span>
    <span class="m ${clase}">${monto}${conFecha ? `<small>${cuando(v.fecha)}</small>` : ''}</span>
  </button></li>`;
}
function seccionUltimos() {
  const ult = movsOrden().slice(0, 5);
  return `<section class="bloque" aria-labelledby="t-ult">
    <div class="bloque-cabeza"><h2 id="t-ult">Lo último</h2>${ult.length ? '<button class="btn-texto" data-a="ir" data-v="movs">Ver todos</button>' : ''}</div>
    ${ult.length ? `<ul class="lista">${ult.map(v => filaMov(v)).join('')}</ul>`
      : `<div class="vacio"><span class="emoji">🍵</span><p>Aquí van a salir tus gastos e ingresos.</p><button class="btn" data-a="nuevoMov">Registrar el primero</button></div>`}
  </section>`;
}
function vistaInicio() {
  return `${bannerInstalar()}<h1 class="saludo">Hola, ${esc(primerNombre())}</h1>
    ${seccionSemana()}${seccionPendientes()}${seccionGuia()}${seccionTarjetasMini()}${seccionUltimos()}`;
}

/* ---------- Tarjetas ---------- */
function tarjetaGrande(m, { boton = true } = {}) {
  const c = color(m);
  let abajo = '';
  if (m.tipo === 'credito') {
    const ic = infoCredito(m);
    const usado = ic.limite ? Math.min(100, (ic.deuda / ic.limite) * 100) : 0;
    abajo = `<small>Debes</small><span class="grande">${dinero(ic.deuda)}</span>
      ${ic.limite ? `<small>Te quedan ${dinero(Math.max(0, ic.disponible))} de ${dinero(ic.limite)}</small><div class="barrita"><i style="width:${usado}%"></i></div>` : ''}`;
  } else {
    const ap = apartadoEn(m.id);
    abajo = `<small>${m.tipo === 'efectivo' ? 'Traes' : 'Tienes'}</small><span class="grande">${dinero(saldo(m))}</span>${ap > 0 ? `<small>${dinero(ap)} apartados para metas</small>` : ''}`;
  }
  const dentro = `<div class="arriba"><span class="nombre">${esc(m.nombre)}</span><span class="tipo">${TIPO_METODO[m.tipo] || ''}</span></div>
    ${m.tipo !== 'efectivo' ? '<span class="chip" aria-hidden="true"></span>' : ''}
    <div class="abajo">${abajo}</div>
    ${m.ultimos4 ? `<span class="ultimos" aria-label="Termina en ${esc(m.ultimos4)}">•••• ${esc(m.ultimos4)}</span>` : ''}`;
  return boton
    ? `<button class="tarjeta ${m.tipo}" style="--tc-bg:${c.bg};--tc-tx:${c.tx}" data-a="verMetodo" data-id="${esc(m.id)}">${dentro}</button>`
    : `<div class="tarjeta ${m.tipo}" style="--tc-bg:${c.bg};--tc-tx:${c.tx}">${dentro}</div>`;
}
function vistaTarjetas() {
  const ms = metodosOrden();
  const tienes = redondear(suma(ms.filter(m => m.tipo !== 'credito'), saldo));
  const debes = redondear(suma(ms.filter(m => m.tipo === 'credito'), m => infoCredito(m).deuda));
  return `<h1 class="saludo">Tus tarjetas</h1>
    <div class="resumen">
      <div class="dato"><small>Tienes en total</small><strong>${dinero(tienes)}</strong></div>
      <div class="dato${debes > 0 ? ' malo' : ''}"><small>Debes en crédito</small><strong>${dinero(debes)}</strong></div>
    </div>
    <div class="lista-tarjetas">${ms.map(m => tarjetaGrande(m)).join('')}</div>
    <div class="fila-botones"><button class="btn ancho grande" data-a="nuevoMetodo">Agregar tarjeta</button></div>
    <details class="explica"><summary>¿Qué es la fecha de corte y la de pago?</summary>
      <p><strong>Fecha de corte:</strong> el día que el banco junta todo lo que gastaste con tu tarjeta de crédito en el mes.</p>
      <p><strong>Fecha de pago:</strong> el último día para pagar eso. Si pagas todo antes de esa fecha, no te cobran intereses.</p>
      <p>Las dos vienen en tu estado de cuenta o en la app de tu banco.</p>
    </details>
    <details class="explica"><summary>¿Débito o crédito?</summary>
      <p><strong>Débito:</strong> gastas tu propio dinero. Si no hay, no pasa.</p>
      <p><strong>Crédito:</strong> el banco te presta. Todo lo que gastes lo tienes que pagar después, y si no lo pagas a tiempo te cobran intereses.</p>
    </details>`;
}

/* ---------- Metas ---------- */
function tarjetaMeta(meta) {
  const p = planMeta(meta);
  return `<article class="meta${p.falta <= 0 ? ' completa' : ''}">
    <button class="meta-cabeza" data-a="verMeta" data-id="${esc(meta.id)}">
      <span class="burbuja" aria-hidden="true">${esc(meta.emoji || '🎯')}</span>
      <span><h3>${esc(meta.nombre)}</h3><p>Llevas ${dinero(p.llevas)} de ${dinero(p.objetivo)}</p></span>
    </button>
    <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.pct)}" aria-label="Avance de ${esc(meta.nombre)}"><i style="width:${p.pct}%"></i></div>
    <p class="plan">${esc(p.texto)}</p>
    ${p.falta > 0 ? `<div class="fila-botones"><button class="btn" data-a="apartar" data-id="${esc(meta.id)}">Apartar</button></div>` : ''}
  </article>`;
}
function vistaMetas() {
  const ms = lista('metas').sort((a, b) => (a.creado || 0) - (b.creado || 0));
  const total = redondear(suma(ms, ahorrado));
  return `<h1 class="saludo">Tus metas</h1>
    ${ms.length ? `<p class="ayuda" style="margin-bottom:16px">Llevas ${dinero(total)} apartados en total. Ese dinero sigue en tu tarjeta, solo que ya tiene dueño.</p>
      <div class="metas">${ms.map(tarjetaMeta).join('')}</div>`
      : `<div class="vacio"><span class="emoji">🌸</span><p>¿Para qué quieres juntar? Unos tenis, un viaje, tu matcha de cada semana.</p><p class="ayuda" style="margin-top:6px">Te digo cuánto apartar y cuándo la vas a completar.</p></div>`}
    <div class="fila-botones"><button class="btn ancho grande" data-a="nuevaMeta">Nueva meta</button></div>`;
}

/* ---------- Meses ---------- */
function vistaMeses() {
  const h = hoy();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1), clave = mesClave(d), [a, b] = rangoMes(clave);
    meses.push({ clave, nombre: MESES[d.getMonth()], corto: MESES_C[d.getMonth()], total: totalTipo('gasto', a, b) });
  }
  if (!ui.mesSel || !meses.some(m => m.clave === ui.mesSel)) ui.mesSel = meses[5].clave;
  const i = meses.findIndex(m => m.clave === ui.mesSel), sel = meses[i];
  const [a, b] = rangoMes(sel.clave);
  const dPrev = new Date(+sel.clave.slice(0, 4), +sel.clave.slice(5) - 2, 1), prevClave = mesClave(dPrev), [pa, pb] = rangoMes(prevClave);
  const prevTotal = totalTipo('gasto', pa, pb);
  const entro = totalTipo('ingreso', a, b), quedo = redondear(entro - sel.total);
  const datos = gastosPorCat(a, b), segs = topConOtros(datos);
  const prevMap = new Map(gastosPorCat(pa, pb).map(d => [d.catId, d.total]));
  const deltas = new Map(segs.map(s => {
    if (s.catId === '__otros') return [s.catId, 0];
    return [s.catId, prevMap.has(s.catId) ? redondear(s.total - prevMap.get(s.catId)) : null];
  }));
  const esteMes = sel.clave === mesClave(h);
  let frase;
  if (!sel.total) frase = esteMes ? 'Este mes todavía no registras gastos.' : `En ${sel.nombre} no registraste gastos.`;
  else {
    frase = `En ${sel.nombre} ${esteMes ? 'llevas' : 'gastaste'} <strong>${dinero(sel.total)}</strong>`;
    if (prevTotal > 0) {
      const dif = redondear(sel.total - prevTotal);
      frase += dif > 0 ? `, ${dinero(dif)} más que en ${MESES[dPrev.getMonth()]}.` : dif < 0 ? `, ${dinero(-dif)} menos que en ${MESES[dPrev.getMonth()]}.` : `, igual que en ${MESES[dPrev.getMonth()]}.`;
    } else frase += '.';
  }
  let subio = '';
  let mejor = null;
  for (const d of datos) {
    const dif = d.total - (prevMap.get(d.catId) || 0);
    if (prevMap.size && dif > 0 && (!mejor || dif > mejor.dif)) mejor = { ...d, dif };
  }
  if (mejor) { const c = cat(mejor.catId); subio = `Lo que más subió: <strong>${esc(c.emoji)} ${esc(c.nombre)}</strong>, ${dinero(mejor.dif)} más que el mes anterior.`; }
  return `<h1 class="saludo">Mes a mes</h1>
    <p class="ayuda">Toca un mes para ver en qué se fue.</p>
    ${barras(meses, ui.mesSel)}
    <p class="frase" style="text-align:left;max-width:none;margin-top:4px">${frase}</p>
    <div class="resumen tres" style="margin-top:16px">
      <div class="dato"><small>Te entró</small><strong>${dinero(entro)}</strong></div>
      <div class="dato"><small>Gastaste</small><strong>${dinero(sel.total)}</strong></div>
      <div class="dato${quedo < 0 ? ' malo' : ''}"><small>${quedo < 0 ? 'Te faltó' : 'Te quedó'}</small><strong>${quedo < 0 ? '▼ ' : ''}${dinero(Math.abs(quedo))}</strong></div>
    </div>
    ${quedo < 0 ? `<p class="cuidado" style="margin-top:0">Gastaste más de lo que te entró este mes. La diferencia salió de lo que ya tenías o de tu tarjeta de crédito.</p>` : ''}
    <section class="bloque" aria-labelledby="t-enque">
      <h2 id="t-enque">En qué se fue</h2>
      ${sel.total ? `${taza(segs, { chica: true, arriba: sel.nombre.charAt(0).toUpperCase() + sel.nombre.slice(1), numero: dinero(sel.total), abajo: ' ' })}
        ${subio ? `<p class="frase">${subio}</p>` : ''}
        ${leyenda(segs, sel.total, prevMap.size ? deltas : null)}`
      : '<div class="vacio" style="margin-top:12px"><span class="emoji">🫖</span><p>Sin gastos este mes.</p></div>'}
    </section>`;
}

/* ---------- Todos los movimientos ---------- */
function vistaMovs() {
  let vs = movsOrden();
  if (ui.filtro === 'gasto') vs = vs.filter(v => v.tipo === 'gasto');
  if (ui.filtro === 'ingreso') vs = vs.filter(v => v.tipo === 'ingreso');
  if (ui.filtro === 'otros') vs = vs.filter(v => v.tipo === 'mover' || v.tipo === 'ahorro');
  const mostrar = vs.slice(0, ui.limite);
  let html = '', diaActual = '', abierto = false;
  for (const v of mostrar) {
    if (v.fecha !== diaActual) {
      if (abierto) html += '</ul>';
      diaActual = v.fecha;
      const d = deIso(v.fecha), n = diasHasta(d);
      const t = n === 0 ? 'Hoy' : n === -1 ? 'Ayer' : `${DIAS[d.getDay()].charAt(0).toUpperCase() + DIAS[d.getDay()].slice(1)} ${fechaLarga(d)}`;
      html += `<h3 class="dia">${t}</h3><ul class="lista">`;
      abierto = true;
    }
    html += filaMov(v, false);
  }
  if (abierto) html += '</ul>';
  const f = (v, t) => `<label><input type="radio" name="filtro" value="${v}" ${ui.filtro === v ? 'checked' : ''}><span>${t}</span></label>`;
  return `<button class="volver" data-a="ir" data-v="inicio">${ICONO.izq}Inicio</button>
    <h1 class="saludo">Tus movimientos</h1>
    <div class="chips filtros" role="radiogroup" aria-label="Mostrar">${f('todos', 'Todo')}${f('gasto', 'Gastos')}${f('ingreso', 'Ingresos')}${f('otros', 'Movimientos y ahorro')}</div>
    ${html || '<div class="vacio" style="margin-top:14px"><span class="emoji">🍃</span><p>No hay nada por aquí todavía.</p></div>'}
    ${vs.length > ui.limite ? '<div class="fila-botones"><button class="btn suave ancho" data-a="verMas">Ver más</button></div>' : ''}`;
}

const VISTAS = { inicio: vistaInicio, tarjetas: vistaTarjetas, metas: vistaMetas, meses: vistaMeses, movs: vistaMovs };

/* =========================================================
   Entrar / crear cuenta
   ========================================================= */
function textoPrivacidad() {
  return `<p>Tus datos se guardan en una hoja de Google de ${esc(DUENO)}. Tu contraseña va cifrada, así que nadie la puede ver.</p>
    <p>Tus movimientos solo los usa la app para mostrarte tus resúmenes; no se comparten ni se usan para nada más.</p>
    <p>No guardes números completos de tarjeta ni CVV.</p>
    <p>Si quieres borrar tu cuenta y tus datos, pídeselo a ${esc(DUENO)}.</p>`;
}
function avisoSinInternet() {
  return API_URL && !navigator.onLine ? '<p class="cuidado">Necesitas internet para crear tu cuenta o entrar por primera vez en este cel.</p>' : '';
}
function campoContrasena(nombre, auto) {
  return `<div class="con-ojo"><input class="input" type="password" name="${nombre}" autocomplete="${auto}" minlength="6" required>
    <button type="button" data-a="ojo" aria-label="Mostrar contraseña">Mostrar</button></div>`;
}
function vistaAuth() {
  if (ui.auth === 'registro') {
    return `<div class="entrada">
      <button class="volver" data-a="auth" data-v="bienvenida">${ICONO.izq}Atrás</button>
      <h1>Crea tu cuenta</h1>
      <p class="ayuda">Solo necesitas tu nombre y una contraseña.</p>
      <form data-form="registro" novalidate>
        <label class="campo"><span>Tu nombre completo</span>
          <input class="input" name="nombre" autocomplete="name" autocapitalize="words" required placeholder="Ej. Fernanda López">
          <span class="ayuda">Úsalo igual cada vez que entres. No importan acentos ni mayúsculas.</span></label>
        <label class="campo"><span>Inventa una contraseña</span>${campoContrasena('contrasena', 'new-password')}
          <span class="ayuda">Mínimo 6 caracteres. No se la compartas a nadie.</span></label>
        <div class="aviso-priv" style="margin-top:22px"><h3>Antes de crear tu cuenta</h3>${textoPrivacidad()}</div>
        <label class="check"><input type="checkbox" name="acepto" required><span>Entendido</span></label>
        ${avisoSinInternet()}
        <p class="error" role="alert"></p>
        <button class="btn ancho grande" type="submit" style="margin-top:14px">Crear mi cuenta</button>
      </form>
    </div>`;
  }
  if (ui.auth === 'entrar') {
    return `<div class="entrada">
      <button class="volver" data-a="auth" data-v="bienvenida">${ICONO.izq}Atrás</button>
      <h1>Qué bueno verte</h1>
      <form data-form="entrar" novalidate>
        <label class="campo"><span>Tu nombre completo</span>
          <input class="input" name="nombre" autocomplete="username" autocapitalize="words" required></label>
        <label class="campo"><span>Tu contraseña</span>${campoContrasena('contrasena', 'current-password')}</label>
        ${avisoSinInternet()}
        <p class="error" role="alert"></p>
        <button class="btn ancho grande" type="submit" style="margin-top:14px">Entrar</button>
      </form>
      <p class="ayuda" style="margin-top:18px">¿Se te olvidó tu contraseña? Pídele a ${esc(DUENO)} que la reinicie y luego entra con una nueva.</p>
    </div>`;
  }
  return `<div class="entrada">
    <img class="logo-grande" src="iconos/icono-512.png" alt="">
    <div class="wordmark">Ferduqui</div>
    <p class="lema">Para que veas a dónde se va tu dinero.</p>
    <div class="empuje"></div>
    <div class="pila">
      <button class="btn ancho grande" data-a="auth" data-v="registro">Crear mi cuenta</button>
      <button class="btn suave ancho grande" data-a="auth" data-v="entrar">Ya tengo cuenta</button>
    </div>
  </div>`;
}

/* ---------- servidor (o modo prueba) ---------- */
function falla(codigo, mensaje) { const e = new Error(mensaje); e.codigo = codigo; return e; }
async function llamar(accion, datos = {}) {
  if (!API_URL) return local(accion, datos);
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 25000);
  let r;
  try { r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ accion, ...datos }), signal: ctrl.signal }); }
  catch { throw falla('red', 'No hay conexión. Revisa tu internet y vuelve a intentar.'); }
  finally { clearTimeout(t); }
  let j;
  try { j = await r.json(); } catch { throw falla('servidor', `El servidor no respondió bien. Avísale a ${DUENO}.`); }
  if (!j.ok) throw falla(j.codigo || 'error', j.error || 'Algo salió mal.');
  return j;
}
async function sha256(t) {
  if (!crypto?.subtle) return 'x' + Array.from(t).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function local(accion, d) {
  const us = LS.get('fq:local:usuarios', {});
  const n = normalizar(d.nombre);
  if (accion === 'registrar') {
    if (us[n]) throw falla('existe', 'Ya hay una cuenta con ese nombre en este cel. Si es tuya, toca "Ya tengo cuenta".');
    const sal = nuevoId(), usuarioId = 'u' + nuevoId();
    us[n] = { usuarioId, nombre: d.nombre, sal, hash: await sha256(sal + '|' + d.contrasena) };
    LS.set('fq:local:usuarios', us);
    return { ok: true, usuarioId, nombre: d.nombre, token: 'local' };
  }
  if (accion === 'entrar') {
    const u = us[n];
    if (!u) throw falla('noexiste', 'No encontramos ese nombre. Escríbelo igual que cuando creaste tu cuenta.');
    if (await sha256(u.sal + '|' + d.contrasena) !== u.hash) throw falla('contrasena', 'La contraseña no coincide. Revisa mayúsculas y vuelve a intentar.');
    return { ok: true, usuarioId: u.usuarioId, nombre: u.nombre, token: 'local' };
  }
  if (accion === 'sync') return { ok: true, now: Date.now(), registros: [] };
  return { ok: true };
}
function validarCuenta(nombre, contrasena) {
  if (normalizar(nombre).length < 3) return 'Escribe tu nombre completo.';
  if (contrasena.length < 6) return 'La contraseña necesita al menos 6 caracteres.';
  return '';
}
async function enviarAuth(form, accion) {
  const err = $('.error', form), btn = $('button[type=submit]', form);
  const nombre = form.nombre.value.replace(/\s+/g, ' ').trim(), contrasena = form.contrasena.value;
  let msg = validarCuenta(nombre, contrasena);
  if (!msg && accion === 'registrar' && !form.acepto.checked) msg = 'Marca "Entendido" para continuar.';
  if (msg) { err.textContent = msg; return; }
  err.textContent = '';
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = accion === 'registrar' ? 'Creando tu cuenta…' : 'Entrando…';
  try {
    const r = await llamar(accion, { nombre, contrasena });
    sesion = { usuarioId: r.usuarioId, nombre: r.nombre || nombre, token: r.token };
    LS.set('fq:sesion', sesion);
    cargarDatos();
    ui.vista = 'inicio'; ui.animar = true;
    render();
    window.scrollTo(0, 0);
    if (r.nueva) toast('Listo, tu contraseña nueva quedó guardada.');
    else if (accion === 'registrar') toast(`¡Listo, ${primerNombre()}! Ya tienes tu cuenta.`);
    sincronizar();
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false; btn.textContent = original;
  }
}

/* =========================================================
   Sincronización
   ========================================================= */
function programarSync(ms = 1500) {
  if (!API_URL) return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(sincronizar, ms);
  pintarSync();
}
async function sincronizar() {
  if (!API_URL || !sesion || sync.activo) return;
  if (!navigator.onLine) { pintarSync(); return; }
  sync.activo = true; pintarSync();
  const yo = sesion.usuarioId;
  try {
    const cambios = Object.keys(pend).map(k => {
      const i = k.indexOf('|'), col = k.slice(0, i), id = k.slice(i + 1), r = D[col]?.[id];
      if (!r) return null;
      const { upd, del, ...datos } = r;
      return { col, id, upd, del: !!del, datos };
    }).filter(Boolean);
    const since = LS.get('fq:since:' + yo, 0);
    const res = await llamar('sync', { token: sesion.token, since, cambios });
    if (!sesion || sesion.usuarioId !== yo) return;
    let cambio = false;
    for (const reg of res.registros || []) {
      if (!COLS.includes(reg.col)) continue;
      const loc = D[reg.col][reg.id];
      if (loc && loc.upd > reg.upd) continue;
      if (loc && loc.upd === reg.upd) continue;
      D[reg.col][reg.id] = reg.del ? { id: reg.id, upd: reg.upd, del: true } : { ...(reg.datos || {}), id: reg.id, upd: reg.upd };
      cambio = true;
    }
    for (const c of cambios) { const k = c.col + '|' + c.id; if (pend[k] === c.upd) delete pend[k]; }
    LS.set('fq:since:' + yo, res.now || 0);
    guardarDatos();
    sync.error = null; sync.ultima = Date.now();
    if (cambio && $('#hoja').hidden) render();
  } catch (e) {
    sync.error = e;
    if (e.codigo === 'sesion') {
      toast('Tu sesión se cerró. Vuelve a entrar; tus cambios siguen guardados en tu cel.');
      sesion = null; LS.del('fq:sesion'); ui.auth = 'entrar'; cerrarHoja(); render();
    }
  } finally {
    sync.activo = false; pintarSync();
    if (sesion && Object.keys(pend).length && !sync.error) programarSync(4000);
  }
}

/* =========================================================
   Hoja (ventana que sube desde abajo)
   ========================================================= */
function abrirHoja(html) {
  const h = $('#hoja'), f = $('#hoja-fondo');
  if (h.hidden) focoPrevio = document.activeElement;
  h.innerHTML = html;
  h.hidden = false; f.hidden = false;
  document.body.classList.add('hoja-abierta');
  h.scrollTop = 0;
  h.focus({ preventScroll: true });
}
function cerrarHoja() {
  const h = $('#hoja');
  if (h.hidden) return;
  h.hidden = true; $('#hoja-fondo').hidden = true; h.innerHTML = '';
  document.body.classList.remove('hoja-abierta');
  fm = null; pendienteTrasNueva = null;
  if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus({ preventScroll: true });
}
function cabeza(titulo) {
  return `<div class="hoja-cabeza"><h2 id="hoja-titulo">${titulo}</h2><button type="button" class="cerrar" data-a="cerrar" aria-label="Cerrar">${ICONO.x}</button></div>`;
}
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('ver'), 3600);
}

/* ---------- registrar gasto / ingreso / movimiento ---------- */
function chipsMetodos(nombre, sel, { excluir = null, soloTipos = null, nueva = true } = {}) {
  const ms = metodosOrden().filter(m => (!soloTipos || soloTipos.includes(m.tipo)));
  return `<div class="chips">${ms.map(m => `<label><input type="radio" name="${nombre}" value="${esc(m.id)}" ${m.id === sel ? 'checked' : ''} ${m.id === excluir ? 'disabled' : ''}>
    <span style="${estiloColor(m)}"><i></i>${esc(m.nombre)}</span></label>`).join('')}
    ${nueva ? `<label><input type="radio" name="${nombre}" value="__nueva"><span>+ Nueva</span></label>` : ''}</div>`;
}
function gridCats(tipo, sel) {
  return `<div class="cats">${catsDe(tipo).map(c => `<label><input type="radio" name="catId" value="${esc(c.id)}" ${c.id === sel ? 'checked' : ''}><span><b aria-hidden="true">${esc(c.emoji)}</b>${esc(c.nombre)}</span></label>`).join('')}</div>`;
}
function hojaMov(datos = {}) {
  const ult = LS.get('fq:ultimo-metodo:' + uid(), 'efectivo');
  fm = { tipo: 'gasto', monto: '', metodoId: metodo(ult) ? ult : 'efectivo', destinoId: '', catId: '', nota: '', fecha: iso(hoy()), editId: null, meses: 1, ...datos };
  pintarHojaMov();
}
function pintarHojaMov() {
  const s = fm, editando = !!s.editId;
  const seg = (v, t) => `<label><input type="radio" name="tipo" value="${v}" ${s.tipo === v ? 'checked' : ''}><span>${t}</span></label>`;
  let cuerpo = '';
  if (s.tipo === 'gasto') {
    cuerpo = `<fieldset><legend>¿En qué fue?</legend>${gridCats('gasto', s.catId)}</fieldset>
      <fieldset><legend>¿Con qué pagaste?</legend>${chipsMetodos('metodoId', s.metodoId)}</fieldset>
      <fieldset class="a-meses" ${metodo(s.metodoId)?.tipo === 'credito' ? '' : 'hidden'}><legend>¿A meses?</legend>
        <div class="chips">${[1, 3, 6, 9, 12, 18, 24].map(n => `<label><input type="radio" name="meses" value="${n}" ${(+s.meses || 1) === n ? 'checked' : ''}><span>${n === 1 ? 'De contado' : n + ' meses'}</span></label>`).join('')}</div>
        <p class="ayuda info-meses" style="margin-top:8px"></p></fieldset>`;
  } else if (s.tipo === 'ingreso') {
    cuerpo = `<fieldset><legend>¿De dónde vino?</legend>${gridCats('ingreso', s.catId)}</fieldset>
      <fieldset><legend>¿A dónde llegó?</legend>${chipsMetodos('metodoId', s.metodoId)}</fieldset>`;
  } else {
    cuerpo = `<fieldset><legend>¿Qué hiciste?</legend><div class="chips">
        <label><input type="radio" name="preset" value="retiro"><span>💵 Saqué efectivo</span></label>
        <label><input type="radio" name="preset" value="pago"><span>💳 Pagué mi tarjeta</span></label>
        <label><input type="radio" name="preset" value="otro"><span>🔁 Pasé dinero</span></label>
      </div></fieldset>
      <fieldset><legend>¿De dónde salió?</legend>${chipsMetodos('metodoId', s.metodoId)}</fieldset>
      <fieldset><legend>¿A dónde llegó?</legend>${chipsMetodos('destinoId', s.destinoId)}</fieldset>`;
  }
  const textoBoton = s.tipo === 'gasto' ? 'Guardar gasto' : s.tipo === 'ingreso' ? 'Guardar ingreso' : 'Guardar movimiento';
  const ayer = iso(masDias(hoy(), -1));
  abrirHoja(`<form data-form="mov" novalidate>
    ${cabeza(editando ? 'Editar' : 'Registrar')}
    <div class="segmento" role="radiogroup" aria-label="¿Qué pasó?">${seg('gasto', 'Gasté')}${seg('ingreso', 'Me llegó')}${seg('mover', 'Moví')}</div>
    <label class="monto-grande"><span class="signo" aria-hidden="true">$</span><span class="solo-lector">Cantidad</span>
      <input name="monto" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(s.monto)}" enterkeyhint="done" style="${anchoMonto(s.monto)}"></label>
    ${s.tipo === 'mover' ? '<p class="ayuda" style="text-align:center">Mover dinero no cuenta como gasto: solo cambia de lugar.</p>' : ''}
    ${cuerpo}
    <label class="campo"><span>Nota <span class="muted" style="font-weight:600">(si quieres)</span></span>
      <input class="input" name="nota" maxlength="60" value="${esc(s.nota)}" placeholder="${s.tipo === 'ingreso' ? 'Ej. mi papá' : 'Ej. matcha con Ana'}"></label>
    <fieldset><legend>¿Cuándo?</legend>
      <div class="chips" style="margin-bottom:10px">
        <label><input type="radio" name="cuandoRapido" value="${iso(hoy())}" ${s.fecha === iso(hoy()) ? 'checked' : ''}><span>Hoy</span></label>
        <label><input type="radio" name="cuandoRapido" value="${ayer}" ${s.fecha === ayer ? 'checked' : ''}><span>Ayer</span></label>
      </div>
      <input class="input" type="date" name="fecha" value="${esc(s.fecha)}" max="${iso(hoy())}" aria-label="Otro día">
    </fieldset>
    <p class="error" role="alert"></p>
    <button class="btn ancho grande" type="submit" style="margin-top:12px">${textoBoton}</button>
    ${editando ? `<button type="button" class="btn peligro ancho" style="margin-top:10px" data-a="borrarMov" data-id="${esc(s.editId)}">Borrar</button>` : ''}
  </form>`);
  infoMeses($('#hoja form'));
  if (!editando && !s.monto) setTimeout(() => $('#hoja input[name=monto]')?.focus({ preventScroll: true }), 280);
}
function anchoMonto(v) { return `width:${Math.min(9, Math.max(1, String(v ?? '').length)) + 0.4}ch`; }
function leerFormMov(form) {
  const f = new FormData(form);
  fm.tipo = f.get('tipo') || fm.tipo;
  fm.monto = form.monto.value;
  fm.metodoId = f.get('metodoId') || '';
  fm.destinoId = f.get('destinoId') || '';
  fm.catId = f.get('catId') || fm.catId;
  fm.nota = form.nota.value;
  fm.fecha = form.fecha.value || iso(hoy());
  fm.meses = +f.get('meses') || 1;
}
function infoMeses(form) {
  const caja = $('.a-meses', form), p = $('.info-meses', form);
  if (!caja || !p) return;
  const f = new FormData(form), m = metodo(f.get('metodoId'));
  caja.hidden = m?.tipo !== 'credito';
  const n = +f.get('meses') || 1, monto = leerMonto(form.monto.value);
  p.textContent = caja.hidden ? '' : n > 1
    ? (monto > 0 ? `Serían ${dinero(redondear(monto / n))} al mes durante ${n} meses. De tu límite se aparta todo desde hoy.` : `Lo pagas en ${n} mensualidades.`)
    : 'Todo se paga en tu siguiente fecha de pago.';
}
function guardarMov(form) {
  leerFormMov(form);
  const err = $('.error', form);
  const monto = leerMonto(fm.monto);
  let msg = '';
  if (!(monto > 0)) msg = 'Escribe cuánto fue.';
  else if (fm.tipo !== 'mover' && !fm.catId) msg = fm.tipo === 'gasto' ? 'Elige en qué fue.' : 'Elige de dónde vino.';
  else if (!metodo(fm.metodoId)) msg = fm.tipo === 'gasto' ? 'Elige con qué pagaste.' : fm.tipo === 'ingreso' ? 'Elige a dónde llegó.' : 'Elige de dónde salió.';
  else if (fm.tipo === 'mover' && !metodo(fm.destinoId)) msg = 'Elige a dónde llegó.';
  else if (fm.tipo === 'mover' && fm.destinoId === fm.metodoId) msg = 'El dinero tiene que ir a otro lado.';
  else if (fm.fecha > iso(hoy())) msg = 'La fecha no puede ser en el futuro.';
  if (msg) { err.textContent = msg; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  const previo = fm.editId ? D.movs[fm.editId] : null;
  const rec = {
    id: fm.editId || nuevoId(), tipo: fm.tipo, monto, metodoId: fm.metodoId, fecha: fm.fecha,
    nota: fm.nota.trim(), creado: previo?.creado || Date.now(),
  };
  if (fm.tipo === 'mover') rec.destinoId = fm.destinoId; else rec.catId = fm.catId;
  if (previo?.fijoId) rec.fijoId = previo.fijoId;
  if (fm.tipo === 'gasto' && metodo(fm.metodoId)?.tipo === 'credito' && fm.meses > 1) rec.meses = fm.meses;
  poner('movs', rec);
  LS.set('fq:ultimo-metodo:' + uid(), fm.metodoId);
  const tipo = fm.tipo, catId = fm.catId, editando = !!fm.editId;
  cerrarHoja();
  render();
  if (editando) return toast('Cambios guardados.');
  if (tipo === 'gasto') {
    const ini = lunesDe(hoy()), lleva = suma(gastosPorCat(iso(ini), iso(masDias(ini, 6))).filter(d => d.catId === catId), d => d.total);
    const c = cat(catId), m = metodo(rec.metodoId);
    let extra = rec.fecha >= iso(ini) ? ` Esta semana llevas ${dinero(lleva)} en ${c.emoji} ${c.nombre}.` : '';
    if (rec.meses > 1) extra += ` Lo pagas en ${rec.meses} mensualidades de ${dinero(redondear(monto / rec.meses))}.`;
    else if (m?.tipo === 'credito') extra += ' Ojo: lo pagaste con crédito, se suma a lo que debes.';
    toast('Gasto guardado.' + extra);
  } else toast(tipo === 'ingreso' ? 'Ingreso guardado.' : 'Movimiento guardado.');
}
function aplicarPreset(form, preset) {
  const ms = metodosOrden();
  const debito = ms.find(m => m.tipo === 'debito'), efectivo = ms.find(m => m.tipo === 'efectivo'), credito = ms.find(m => m.tipo === 'credito');
  let de = null, a = null;
  if (preset === 'retiro') { de = debito; a = efectivo; }
  if (preset === 'pago') { de = debito || efectivo; a = credito; }
  const marca = (n, m) => { if (!m) return; const r = form.querySelector(`input[name=${n}][value="${CSS.escape(m.id)}"]`); if (r) r.checked = true; };
  marca('metodoId', de); marca('destinoId', a);
  if (preset === 'pago' && !credito) toast('Primero agrega tu tarjeta de crédito en Tarjetas.');
}

/* ---------- detalle de movimiento ---------- */
function hojaDetalleMov(id) {
  const v = D.movs[id];
  if (!v || v.del) return;
  if (v.tipo === 'ahorro') {
    const meta = D.metas[v.metaId];
    return abrirHoja(`${cabeza(v.monto >= 0 ? 'Apartado para meta' : 'Sacado de meta')}
      <p class="detalle-monto">${dinero(Math.abs(v.monto))}</p>
      <p class="detalle-sub">${esc(meta?.emoji || '🎯')} ${esc(meta?.nombre || 'Meta borrada')}</p>
      <dl class="tabla-detalle"><div><dt>Dónde</dt><dd>${esc(nombreMetodo(v.metodoId))}</dd></div><div><dt>Cuándo</dt><dd>${fechaLarga(deIso(v.fecha))}</dd></div></dl>
      <div class="fila-botones"><button class="btn peligro" data-a="borrarMov" data-id="${esc(id)}">Borrar</button></div>`);
  }
  hojaMov({ ...v, monto: String(v.monto), editId: id, catId: v.catId || '', destinoId: v.destinoId || '', nota: v.nota || '' });
}

/* ---------- tarjetas: alta, edición y detalle ---------- */
function opcionesDia(sel) {
  return `<option value="">Elige</option>` + Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${+sel === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('');
}
function hojaMetodo(id) {
  const m = id ? metodo(id) : null;
  const tipo = m?.tipo || 'debito';
  const actualSaldo = m && m.tipo !== 'credito' ? saldo(m) : '';
  const actualDeuda = m && m.tipo === 'credito' ? infoCredito(m).deuda : '';
  const colorSel = m?.color || (tipo === 'efectivo' ? 'miel' : 'matcha');
  const seg = (v, t) => `<label><input type="radio" name="tipo" value="${v}" ${tipo === v ? 'checked' : ''}><span>${t}</span></label>`;
  planForm = { ...(m?.plan || {}) };
  abrirHoja(`<form data-form="metodo" data-id="${esc(id || '')}" data-tipo="${tipo}" novalidate>
    ${cabeza(m ? (m.tipo === 'efectivo' && m.id === 'efectivo' ? 'Tu efectivo' : 'Editar tarjeta') : 'Nueva tarjeta')}
    ${m?.id === 'efectivo' ? `<input type="hidden" name="tipo" value="efectivo">` : `<div class="segmento" role="radiogroup" aria-label="Tipo">${seg('debito', 'Débito')}${seg('credito', 'Crédito')}${seg('efectivo', 'Efectivo')}</div>`}
    <label class="campo"><span>Nombre</span>
      <input class="input" name="nombre" maxlength="30" required value="${esc(m?.nombre || '')}" placeholder="Ej. BBVA azul, Nu, Alcancía"></label>
    <div class="solo-banco">
      <label class="campo"><span>Últimos 4 números <span class="muted" style="font-weight:600">(si quieres)</span></span>
        <input class="input" name="ultimos4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${esc(m?.ultimos4 || '')}" placeholder="1234"></label>
      <p class="cuidado">Nunca pongas el número completo de tu tarjeta ni el CVV. Con un nombre y los últimos 4 basta.</p>
    </div>
    <div class="solo-dinero">
      <label class="campo"><span>¿Cuánto tienes ahorita?</span>
        <input class="input" name="saldo" inputmode="decimal" value="${esc(actualSaldo)}" placeholder="$0">
        <span class="ayuda">${m ? 'Si no cuadra con tu banco, escribe lo que tienes de verdad y lo ajusto.' : 'Lo que tienes hoy. De aquí en adelante la app lleva la cuenta.'}</span></label>
    </div>
    <div class="solo-credito">
      <label class="campo"><span>Límite de crédito</span>
        <input class="input" name="limite" inputmode="decimal" value="${esc(m?.limite || '')}" placeholder="$0">
        <span class="ayuda">Lo máximo que el banco te deja gastar.</span></label>
      <label class="campo"><span>¿Cuánto debes ahorita en total?</span>
        <input class="input" name="deuda" inputmode="decimal" value="${esc(actualDeuda)}" placeholder="$0">
        <span class="ayuda">Todo junto, también lo de meses. Lo ves en la app de tu banco. Si no debes nada, déjalo en 0.</span></label>
      <div class="dos-col">
        <label class="campo"><span>Día de corte</span><select class="input" name="diaCorte">${opcionesDia(m?.diaCorte)}</select></label>
        <label class="campo"><span>Día de pago</span><select class="input" name="diaPago">${opcionesDia(m?.diaPago)}</select></label>
      </div>
      <p class="ayuda" style="margin-top:8px">Vienen en tu estado de cuenta. El de pago es el último día para pagar sin intereses.</p>
      <fieldset class="caja-meses"><legend>¿Cuánto te toca pagar cada mes?</legend>
        <p class="ayuda">Si lo que debes ya viene repartido (por ejemplo, compras a meses), pon cuánto pagas cada mes. Lo ves en la app de tu banco. Si pagas todo de una vez, déjalo vacío.</p>
        <div id="plan"></div>
        <button type="button" class="btn suave ancho" style="margin-top:12px" data-a="otroMes">+ Otro mes</button>
        <p class="ayuda" id="plan-suma" style="margin-top:10px;font-weight:800"></p>
      </fieldset>
    </div>
    <fieldset><legend>Color</legend><div class="colores">${Object.entries(COLORES).map(([k, c]) => `<label><input type="radio" name="color" value="${k}" ${k === colorSel ? 'checked' : ''} aria-label="${c.n}"><span style="--tc-bg:${c.bg}"></span></label>`).join('')}</div></fieldset>
    <p class="error" role="alert"></p>
    <button class="btn ancho grande" type="submit" style="margin-top:18px">${m ? 'Guardar cambios' : 'Agregar'}</button>
  </form>`);
  ajustarFormMetodo($('#hoja form'));
  pintarPlan();
}
// meses que se muestran: desde el mes de tu siguiente pago (o este mes) hasta el último que tenga algo, mínimo 3
function mesesPlan(form) {
  const dp = +form.diaPago.value, dc = +form.diaCorte.value, h = hoy();
  let inicio = new Date(h.getFullYear(), h.getMonth(), 1);
  if (dc && dp) {
    let corte = fechaEnMes(h.getFullYear(), h.getMonth(), dc);
    if (corte > h) corte = fechaEnMes(h.getFullYear(), h.getMonth() - 1, dc);
    const p = pagoDe(corte, dp);
    inicio = new Date(p.getFullYear(), p.getMonth(), 1);
  }
  const ini = mesClave(inicio);
  const conDato = Object.keys(planForm).filter(k => k >= ini && +planForm[k] > 0).sort();
  let n = Math.max(3, +form.dataset.mesesPlan || 0);
  if (conDato.length) {
    const ult = deIso(conDato[conDato.length - 1] + '-01');
    n = Math.max(n, (ult.getFullYear() - inicio.getFullYear()) * 12 + ult.getMonth() - inicio.getMonth() + 1);
  }
  form.dataset.mesesPlan = n;
  return Array.from({ length: n }, (_, i) => { const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1); return { clave: mesClave(d), nombre: MESES[d.getMonth()] + (d.getFullYear() !== h.getFullYear() ? ' ' + d.getFullYear() : '') }; });
}
function pintarPlan() {
  const form = $('#hoja form'), caja = $('#plan', form);
  if (!caja) return;
  caja.innerHTML = mesesPlan(form).map(({ clave, nombre }) => `<label class="fila-plan"><span>${nombre.charAt(0).toUpperCase() + nombre.slice(1)}</span>
    <input class="input" inputmode="decimal" data-mes="${clave}" value="${planForm[clave] ? esc(planForm[clave]) : ''}" placeholder="$0"></label>`).join('');
  sumaPlan();
}
function sumaPlan() {
  const form = $('#hoja form'), el = $('#plan-suma', form);
  if (!el) return;
  const total = redondear(suma(Object.values(planForm), v => +v)), deuda = leerMonto(form.deuda.value);
  if (!total) { el.textContent = ''; return; }
  el.textContent = !form.dataset.id && deuda && Math.abs(total - deuda) > 0.5
    ? `Suman ${dinero(total)} y dijiste que debes ${dinero(deuda)}.${total < deuda ? ` Los ${dinero(deuda - total)} que faltan se cobran en tu siguiente pago.` : ''}`
    : `Suman ${dinero(total)}. ✓`;
}
function ajustarFormMetodo(form) {
  const tipo = new FormData(form).get('tipo') || 'debito';
  form.dataset.tipo = tipo;
  $$('.solo-banco', form).forEach(el => { el.hidden = tipo === 'efectivo'; });
  $$('.solo-dinero', form).forEach(el => { el.hidden = tipo === 'credito'; });
  $$('.solo-credito', form).forEach(el => { el.hidden = tipo !== 'credito'; });
}
function guardarMetodo(form) {
  const f = new FormData(form), err = $('.error', form);
  const id = form.dataset.id, previo = id ? metodo(id) : null;
  const tipo = f.get('tipo') || 'debito', nombre = String(f.get('nombre') || '').trim();
  const ultimos4 = String(f.get('ultimos4') || '').replace(/\D/g, '');
  let msg = '';
  if (!nombre) msg = 'Ponle un nombre, como "BBVA azul".';
  else if (tipo !== 'efectivo' && ultimos4 && ultimos4.length !== 4) msg = 'Los últimos números son 4, nada más.';
  else if (tipo === 'credito' && (!f.get('diaCorte') || !f.get('diaPago'))) msg = 'Elige el día de corte y el de pago.';
  if (msg) { err.textContent = msg; return; }
  const rec = { ...(previo || {}), id: previo?.id || nuevoId(), nombre, tipo, color: f.get('color') || 'matcha', creado: previo?.creado || Date.now() };
  delete rec.upd;
  if (tipo === 'efectivo') delete rec.ultimos4; else rec.ultimos4 = ultimos4;
  // Ajuste: guardamos un "saldo inicial" para que el saldo de hoy sea el que escribiste.
  const efectos = redondear(suma(movs(), v => efecto(v, rec.id)));
  if (tipo === 'credito') {
    rec.limite = leerMonto(f.get('limite'));
    rec.deudaInicial = redondear(leerMonto(f.get('deuda')) + efectos);
    rec.diaCorte = +f.get('diaCorte'); rec.diaPago = +f.get('diaPago');
    rec.plan = Object.fromEntries(Object.entries(planForm).filter(([, v]) => +v > 0).map(([k, v]) => [k, redondear(+v)]));
    const totalPlan = redondear(suma(Object.values(rec.plan), v => v));
    let deuda = leerMonto(f.get('deuda'));
    if (!String(f.get('deuda') || '').trim() && totalPlan) deuda = totalPlan;
    if (totalPlan > deuda + 0.5) { err.textContent = `Lo que repartiste por mes (${dinero(totalPlan)}) es más de lo que debes en total (${dinero(deuda)}).`; err.scrollIntoView({ block: 'center' }); return; }
    rec.deudaInicial = redondear(deuda + efectos);
    delete rec.msiPrevias;
    delete rec.saldoInicial;
  } else {
    rec.saldoInicial = redondear(leerMonto(f.get('saldo')) - efectos);
    delete rec.limite; delete rec.deudaInicial; delete rec.diaCorte; delete rec.diaPago; delete rec.msiPrevias; delete rec.plan;
  }
  poner('metodos', rec);
  const volverA = pendienteTrasNueva;
  cerrarHoja();
  render();
  toast(previo ? 'Listo, guardado.' : `${nombre} agregada.`);
  if (volverA && !previo) { const { campo, ...resto } = volverA; hojaMov({ ...resto, [campo]: rec.id }); }
}
function hojaDetalleMetodo(id) {
  const m = metodo(id);
  if (!m) return;
  let extra = '';
  if (m.tipo === 'credito') {
    const ic = infoCredito(m);
    if (ic.pago) {
      extra += ic.porPagar > 0
        ? `<div class="caja-pago"><p>Para no pagar intereses, paga</p><strong>${dinero(ic.porPagar)}</strong><p>antes del ${fechaLarga(ic.pago)} (${enFaltan(ic.diasPago)}).</p>
            <div class="fila-botones"><button class="btn" data-a="pagarTarjeta" data-id="${esc(m.id)}">Ya pagué</button></div></div>`
        : `<div class="caja-pago ok"><p>Vas al corriente: no tienes nada pendiente de este corte. 🍵</p></div>`;
      if (ic.proximos.length > 1 && ic.proximos.slice(1).some(x => x.monto > 0)) {
        extra += `<section class="bloque" style="margin-top:20px"><h3>Tus próximos pagos</h3>
          <dl class="tabla-detalle" style="margin-top:10px">${ic.proximos.map(x => `<div><dt>${MESES[x.pago.getMonth()].charAt(0).toUpperCase() + MESES[x.pago.getMonth()].slice(1)}${x.pago.getFullYear() !== hoy().getFullYear() ? ' ' + x.pago.getFullYear() : ''} <span class="muted" style="font-size:13px">(${fechaCorta(x.pago)})</span></dt>
            <dd>${x.actual && x.monto <= 0 ? 'Pagado ✓' : dinero(x.monto)}</dd></div>`).join('')}</dl>
          <p class="ayuda" style="margin-top:8px">Lo que compres de contado se suma al pago que sigue; lo de meses, a cada mes.</p></section>`;
      }
      if (ic.aMeses.length) {
        extra += `<section class="bloque" style="margin-top:20px"><h3>Compras a meses</h3>
          <p class="ayuda" style="margin:4px 0 10px">Te falta pagar ${dinero(ic.faltaMeses)} en total. Cada mes solo se cobra la mensualidad.</p>
          <ul class="lista" style="background:var(--leche)">${ic.aMeses.map(a => `<li><div class="mov" style="cursor:default">
            <span class="burbuja" aria-hidden="true">${esc(a.emoji)}</span>
            <span style="min-width:0"><span class="t">${esc(a.nombre)}</span><span class="s">Te faltan ${a.faltan} de ${a.total} mensualidades</span>
              <span class="progreso" style="margin:6px 0 0;height:6px"><i style="width:${Math.round(((a.total - a.faltan) / a.total) * 100)}%"></i></span></span>
            <span class="m">${dinero(a.mensualidad)}<small>al mes</small></span></div></li>`).join('')}</ul></section>`;
      }
      extra += `<dl class="tabla-detalle">
        <div><dt>Próximo corte</dt><dd>${fechaLarga(ic.sigCorte)}</dd></div>
        <div><dt>Debes en total</dt><dd>${dinero(ic.deuda)}</dd></div>
        ${ic.limite ? `<div><dt>Te queda disponible</dt><dd>${dinero(ic.disponible)}</dd></div>` : ''}
      </dl>
      <p class="ayuda" style="margin-top:10px">Lo que gastes después del corte se paga hasta el siguiente mes.</p>`;
    }
  } else {
    const ap = apartadoEn(m.id);
    if (saldo(m) < 0) extra += `<p class="cuidado">No cuadra: aquí sale que tienes menos de $0. Seguro falta registrar algún ingreso. Toca Editar y escribe lo que ${m.tipo === 'efectivo' ? 'traes' : 'tienes'} de verdad.</p>`;
    if (ap > 0) extra += `<dl class="tabla-detalle"><div><dt>Apartado para metas</dt><dd>${dinero(ap)}</dd></div><div><dt>Libre para gastar</dt><dd>${dinero(saldo(m) - ap)}</dd></div></dl>`;
  }
  const vs = movsOrden().filter(v => v.metodoId === m.id || v.destinoId === m.id).slice(0, 15);
  abrirHoja(`${cabeza(esc(m.nombre))}
    ${tarjetaGrande(m, { boton: false })}
    ${extra}
    <section class="bloque" style="margin-top:22px"><h3 style="margin-bottom:10px">Movimientos</h3>
      ${vs.length ? `<ul class="lista" style="background:var(--leche)">${vs.map(v => filaMov(v)).join('')}</ul>` : '<p class="ayuda">Todavía no hay movimientos aquí.</p>'}
    </section>
    <div class="fila-botones">
      <button class="btn suave" data-a="editarMetodo" data-id="${esc(m.id)}">Editar</button>
      ${m.id !== 'efectivo' ? `<button class="btn peligro" data-a="borrarMetodo" data-id="${esc(m.id)}">Borrar</button>` : ''}
    </div>`);
}

/* ---------- metas ---------- */
function hojaMeta(id) {
  const meta = id ? D.metas[id] : null;
  const ms = metodosOrden().filter(m => m.tipo !== 'credito');
  const metodoSel = meta?.metodoId || ms.find(m => m.tipo === 'debito')?.id || 'efectivo';
  const frec = meta?.frecuencia || 'semana';
  abrirHoja(`<form data-form="meta" data-id="${esc(id || '')}" novalidate>
    ${cabeza(meta ? 'Editar meta' : 'Nueva meta')}
    <fieldset><legend>Elige un dibujito</legend><div class="chips">${EMOJIS_META.map(e => `<label><input type="radio" name="emoji" value="${e}" ${e === (meta?.emoji || EMOJIS_META[0]) ? 'checked' : ''}><span style="font-size:22px;padding:6px 12px">${e}</span></label>`).join('')}</div></fieldset>
    <label class="campo"><span>¿Para qué es?</span><input class="input" name="nombre" maxlength="30" required value="${esc(meta?.nombre || '')}" placeholder="Ej. Viaje a la playa"></label>
    <label class="campo"><span>¿Cuánto necesitas?</span><input class="input" name="objetivo" inputmode="decimal" value="${esc(meta?.objetivo || '')}" placeholder="$0"></label>
    <fieldset><legend>¿En dónde lo vas a guardar?</legend>
      <div class="chips">${ms.map(m => `<label><input type="radio" name="metodoId" value="${esc(m.id)}" ${m.id === metodoSel ? 'checked' : ''}><span style="${estiloColor(m)}"><i></i>${esc(m.nombre)}</span></label>`).join('')}</div>
      <p class="ayuda" style="margin-top:8px">El dinero se queda en esa tarjeta; la app solo lo marca como apartado.</p>
    </fieldset>
    <label class="campo"><span>¿Para cuándo la quieres? <span class="muted" style="font-weight:600">(si quieres)</span></span>
      <input class="input" type="date" name="fechaLimite" min="${iso(masDias(hoy(), 1))}" value="${esc(meta?.fechaLimite || '')}"></label>
    <fieldset><legend>¿Cada cuánto vas a apartar?</legend>
      <div class="segmento" role="radiogroup" aria-label="Cada cuánto">
        ${['semana', 'quincena', 'mes'].map(v => `<label><input type="radio" name="frecuencia" value="${v}" ${frec === v ? 'checked' : ''}><span>${v === 'semana' ? 'Semana' : v === 'quincena' ? 'Quincena' : 'Mes'}</span></label>`).join('')}
      </div>
    </fieldset>
    <label class="campo"><span>¿Cuánto vas a apartar cada vez?</span><input class="input" name="aportacion" inputmode="decimal" value="${esc(meta?.aportacion || '')}" placeholder="$0"></label>
    <div class="sugerencia" aria-live="polite"></div>
    <p class="error" role="alert"></p>
    <button class="btn ancho grande" type="submit" style="margin-top:16px">${meta ? 'Guardar cambios' : 'Crear meta'}</button>
  </form>`);
  sugerirMeta($('#hoja form'));
}
function sugerirMeta(form) {
  const caja = $('.sugerencia', form);
  if (!caja) return;
  const objetivo = leerMonto(form.objetivo.value), fecha = form.fechaLimite.value, frec = new FormData(form).get('frecuencia') || 'semana';
  const id = form.dataset.id, llevas = id && D.metas[id] ? ahorrado(D.metas[id]) : 0;
  const falta = objetivo - llevas;
  if (!(falta > 0) || !fecha) { caja.innerHTML = ''; return; }
  const dias = diasHasta(deIso(fecha));
  if (dias <= 0) { caja.innerHTML = ''; return; }
  const periodos = Math.max(1, Math.ceil(dias / diasPorPeriodo(frec)));
  const n = Math.ceil(falta / periodos);
  caja.innerHTML = `<span>Para llegar a tiempo aparta <strong>${dinero(n)}</strong> ${FRECUENCIA[frec]}.</span><button type="button" class="btn chico" data-a="usarSugerencia" data-n="${n}">Usar</button>`;
}
function guardarMeta(form) {
  const f = new FormData(form), err = $('.error', form), id = form.dataset.id, previo = id ? D.metas[id] : null;
  const nombre = String(f.get('nombre') || '').trim(), objetivo = leerMonto(f.get('objetivo'));
  let msg = '';
  if (!nombre) msg = 'Ponle nombre a tu meta.';
  else if (!(objetivo > 0)) msg = 'Escribe cuánto necesitas juntar.';
  else if (!metodo(f.get('metodoId'))) msg = 'Elige en dónde lo vas a guardar.';
  if (msg) { err.textContent = msg; return; }
  poner('metas', {
    ...(previo || {}), id: previo?.id || nuevoId(), nombre, objetivo, emoji: f.get('emoji') || '🎯',
    metodoId: f.get('metodoId'), frecuencia: f.get('frecuencia') || 'semana', aportacion: leerMonto(f.get('aportacion')),
    fechaLimite: f.get('fechaLimite') || '', creado: previo?.creado || Date.now(),
  });
  cerrarHoja(); render();
  toast(previo ? 'Meta guardada.' : '¡Meta creada! 🌸');
}
function hojaDetalleMeta(id) {
  const meta = D.metas[id];
  if (!meta || meta.del) return;
  const p = planMeta(meta);
  const vs = movsOrden().filter(v => v.tipo === 'ahorro' && v.metaId === id);
  abrirHoja(`${cabeza(`${esc(meta.emoji || '🎯')} ${esc(meta.nombre)}`)}
    <p class="detalle-monto">${dinero(p.llevas)}</p>
    <p class="detalle-sub">de ${dinero(p.objetivo)}, guardado en ${esc(nombreMetodo(meta.metodoId))}</p>
    <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.pct)}"><i style="width:${p.pct}%"></i></div>
    <p class="ayuda">${esc(p.texto)}</p>
    <div class="fila-botones">
      ${p.falta > 0 ? `<button class="btn" data-a="apartar" data-id="${esc(id)}">Apartar</button>` : ''}
      ${p.llevas > 0 ? `<button class="btn suave" data-a="sacarMeta" data-id="${esc(id)}">Sacar dinero</button>` : ''}
    </div>
    <section class="bloque" style="margin-top:22px"><h3 style="margin-bottom:10px">Historial</h3>
      ${vs.length ? `<ul class="lista" style="background:var(--leche)">${vs.map(v => filaMov(v)).join('')}</ul>` : '<p class="ayuda">Aún no apartas nada. ¡El primer paso es el más difícil!</p>'}
    </section>
    <div class="fila-botones">
      <button class="btn suave" data-a="editarMeta" data-id="${esc(id)}">Editar</button>
      <button class="btn peligro" data-a="borrarMeta" data-id="${esc(id)}">Borrar meta</button>
    </div>`);
}
function hojaApartar(id, sacar = false) {
  const meta = D.metas[id];
  if (!meta) return;
  const p = planMeta(meta);
  const sugerido = sacar ? '' : Math.max(0, Math.min(p.falta, redondear((+meta.aportacion || p.falta) - aportadoEnPeriodo(meta)))) || '';
  abrirHoja(`<form data-form="apartar" data-id="${esc(id)}" data-sacar="${sacar ? 1 : ''}" novalidate>
    ${cabeza(sacar ? `Sacar de ${esc(meta.nombre)}` : `Apartar para ${esc(meta.nombre)}`)}
    <label class="monto-grande"><span class="signo" aria-hidden="true">$</span><span class="solo-lector">Cantidad</span>
      <input name="monto" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(sugerido)}" style="${anchoMonto(sugerido)}"></label>
    <p class="ayuda" style="text-align:center">${sacar ? `Tienes ${dinero(p.llevas)} apartados.` : `Se queda en ${esc(nombreMetodo(meta.metodoId))}, marcado para tu meta.`}</p>
    <p class="error" role="alert"></p>
    <button class="btn ancho grande" type="submit" style="margin-top:16px">${sacar ? 'Sacar' : 'Apartar'}</button>
  </form>`);
  setTimeout(() => $('#hoja input[name=monto]')?.focus({ preventScroll: true }), 280);
}
function guardarApartar(form) {
  const id = form.dataset.id, sacar = !!form.dataset.sacar, meta = D.metas[id], err = $('.error', form);
  const monto = leerMonto(form.monto.value), p = planMeta(meta);
  if (!(monto > 0)) { err.textContent = 'Escribe cuánto.'; return; }
  if (sacar && monto > p.llevas) { err.textContent = `Solo tienes ${dinero(p.llevas)} apartados.`; return; }
  poner('movs', { id: nuevoId(), tipo: 'ahorro', metaId: id, metodoId: meta.metodoId, monto: sacar ? -monto : monto, fecha: iso(hoy()), creado: Date.now() });
  cerrarHoja(); render();
  const despues = planMeta(meta);
  if (!sacar && despues.falta <= 0) toast(`🎉 ¡Completaste tu meta ${meta.nombre}!`);
  else toast(sacar ? 'Listo, lo sacaste de tu meta.' : `Apartado. Llevas ${dinero(despues.llevas)} de ${dinero(despues.objetivo)}.`);
}

/* ---------- fijos ---------- */
function hojaFijos() {
  const fs = lista('fijos').sort((a, b) => (+a.dia || 0) - (+b.dia || 0));
  abrirHoja(`${cabeza('Gastos e ingresos fijos')}
    <p class="ayuda">Lo que se repite cada mes: Netflix, tu mesada, el gym. Cuando se acerque el día te lo recuerdo en Pendientes.</p>
    ${fs.length ? `<ul class="hoja-lista">${fs.map(f => `<li><button class="opcion" data-a="editarFijo" data-id="${esc(f.id)}">
      <span class="ico">${esc(cat(f.catId).emoji)}</span><span>${esc(f.nombre)}<small>${f.tipo === 'ingreso' ? 'Te llega' : 'Se paga'} el día ${f.dia}, ${f.tipo === 'ingreso' ? 'a' : 'con'} ${esc(nombreMetodo(f.metodoId))}</small></span>
      <span class="mas">${f.tipo === 'ingreso' ? '+' : '−'}${dinero(f.monto)}</span></button></li>`).join('')}</ul>`
      : '<div class="vacio" style="margin-top:14px"><span class="emoji">📌</span><p>Todavía no tienes fijos.</p></div>'}
    <div class="fila-botones"><button class="btn ancho" data-a="nuevoFijo">Agregar fijo</button></div>`);
}
function opcionesCat(tipo, sel) { return catsDe(tipo).map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.nombre)}</option>`).join(''); }
function hojaFijo(id) {
  const f = id ? D.fijos[id] : null, tipo = f?.tipo || 'gasto';
  const seg = (v, t) => `<label><input type="radio" name="tipo" value="${v}" ${tipo === v ? 'checked' : ''}><span>${t}</span></label>`;
  abrirHoja(`<form data-form="fijo" data-id="${esc(id || '')}" novalidate>
    ${cabeza(f ? 'Editar fijo' : 'Nuevo fijo')}
    <div class="segmento" style="--n:2" role="radiogroup" aria-label="Tipo">${seg('gasto', 'Gasto fijo')}${seg('ingreso', 'Ingreso fijo')}</div>
    <label class="campo"><span>Nombre</span><input class="input" name="nombre" maxlength="30" value="${esc(f?.nombre || '')}" placeholder="Ej. Spotify, Mesada"></label>
    <div class="dos-col">
      <label class="campo"><span>¿Cuánto?</span><input class="input" name="monto" inputmode="decimal" value="${esc(f?.monto || '')}" placeholder="$0"></label>
      <label class="campo"><span>¿Qué día?</span><select class="input" name="dia">${opcionesDia(f?.dia)}</select></label>
    </div>
    <label class="campo"><span>Categoría</span><select class="input" name="catId">${opcionesCat(tipo, f?.catId)}</select></label>
    <fieldset><legend>${tipo === 'ingreso' ? '¿A dónde llega?' : '¿Con qué se paga?'}</legend>${chipsMetodos('metodoId', f?.metodoId || 'efectivo', { nueva: false })}</fieldset>
    <p class="error" role="alert"></p>
    <button class="btn ancho grande" type="submit" style="margin-top:16px">Guardar</button>
    ${f ? `<button type="button" class="btn peligro ancho" style="margin-top:10px" data-a="borrarFijo" data-id="${esc(id)}">Borrar</button>` : ''}
  </form>`);
}
function guardarFijo(form) {
  const f = new FormData(form), err = $('.error', form), id = form.dataset.id, previo = id ? D.fijos[id] : null;
  const nombre = String(f.get('nombre') || '').trim(), monto = leerMonto(f.get('monto')), dia = +f.get('dia');
  let msg = '';
  if (!nombre) msg = 'Ponle nombre.';
  else if (!(monto > 0)) msg = 'Escribe cuánto es.';
  else if (!dia) msg = 'Elige el día del mes.';
  else if (!metodo(f.get('metodoId'))) msg = 'Elige la tarjeta o efectivo.';
  if (msg) { err.textContent = msg; return; }
  poner('fijos', { ...(previo || {}), id: previo?.id || nuevoId(), tipo: f.get('tipo'), nombre, monto, dia, catId: f.get('catId'), metodoId: f.get('metodoId'), creado: previo?.creado || Date.now() });
  hojaFijos(); render();
  toast('Fijo guardado.');
}

/* ---------- categorías ---------- */
function hojaCategorias() {
  const grupo = (tipo, titulo) => `<h3 style="margin-top:18px">${titulo}</h3><ul class="hoja-lista">${catsDe(tipo).map(c => `<li><div class="opcion" style="cursor:default"><span class="ico">${esc(c.emoji)}</span><span>${esc(c.nombre)}</span>
    <button class="btn-texto mas" data-a="borrarCat" data-id="${esc(c.id)}" aria-label="Quitar ${esc(c.nombre)}">Quitar</button></div></li>`).join('')}</ul>`;
  abrirHoja(`${cabeza('Categorías')}
    <form data-form="cat" class="guia" style="margin-top:6px" novalidate>
      <h3>Agregar una</h3>
      <div class="segmento" style="--n:2;margin-top:10px" role="radiogroup" aria-label="Tipo"><label><input type="radio" name="tipo" value="gasto" checked><span>De gasto</span></label><label><input type="radio" name="tipo" value="ingreso"><span>De ingreso</span></label></div>
      <div style="display:grid;grid-template-columns:76px 1fr;gap:10px">
        <label class="campo"><span>Emoji</span><input class="input" name="emoji" maxlength="8" placeholder="🧋" style="text-align:center;font-size:22px"></label>
        <label class="campo"><span>Nombre</span><input class="input" name="nombre" maxlength="24" placeholder="Ej. Boba"></label>
      </div>
      <p class="error" role="alert"></p>
      <button class="btn ancho" type="submit" style="margin-top:12px">Agregar</button>
    </form>
    ${grupo('gasto', 'De gasto')}${grupo('ingreso', 'De ingreso')}`);
}
function guardarCat(form) {
  const f = new FormData(form), err = $('.error', form);
  const nombre = String(f.get('nombre') || '').trim(), emoji = String(f.get('emoji') || '').trim() || '✨';
  if (!nombre) { err.textContent = 'Ponle nombre.'; return; }
  poner('cats', { id: 'c' + nuevoId(), tipo: f.get('tipo'), emoji, nombre, orden: 50 });
  hojaCategorias(); render();
  toast(`${emoji} ${nombre} agregada.`);
}

/* ---------- cuenta, privacidad, instalar ---------- */
function hojaCuenta() {
  const n = Object.keys(pend).length;
  let estado;
  if (!API_URL) estado = 'Modo prueba: tus datos solo viven en este cel.';
  else if (!navigator.onLine) estado = n ? `Sin internet. Tienes ${n} ${n === 1 ? 'cambio' : 'cambios'} guardados en tu cel; se suben solos cuando vuelvas a tener internet.` : 'Sin internet. Todo lo que registres se guarda en tu cel y se sube después.';
  else if (sync.error) estado = `No se pudo subir: ${sync.error.message}`;
  else if (n) estado = `Hay ${n} ${n === 1 ? 'cambio' : 'cambios'} por subir.`;
  else estado = 'Todo está guardado en la nube. ✓';
  const avisos = 'Notification' in window ? Notification.permission : 'no';
  abrirHoja(`${cabeza(esc(sesion.nombre))}
    <p class="ayuda">${esc(estado)}</p>
    ${API_URL ? '<div class="fila-botones" style="margin-top:12px"><button class="btn suave" data-a="syncAhora">Subir ahora</button></div>' : ''}
    <ul class="hoja-lista" style="margin-top:14px">
      <li><button class="opcion" data-a="fijos"><span class="ico">📌</span><span>Gastos e ingresos fijos<small>Netflix, mesada, gym…</small></span><span class="mas">›</span></button></li>
      <li><button class="opcion" data-a="categorias"><span class="ico">🏷️</span><span>Categorías<small>Agrega o quita las tuyas</small></span><span class="mas">›</span></button></li>
      <li><button class="opcion" data-a="avisos"><span class="ico">🔔</span><span>Avisos de pago<small>${avisos === 'granted' ? 'Activados' : avisos === 'denied' ? 'Bloqueados en tu cel' : avisos === 'no' ? 'Tu cel no los permite aquí' : 'Te aviso cuando toque pagar'}</small></span><span class="mas">›</span></button></li>
      <li><button class="opcion" data-a="instalar"><span class="ico">📲</span><span>Instalar en mi cel</span><span class="mas">›</span></button></li>
      <li><button class="opcion" data-a="privacidad"><span class="ico">🔒</span><span>Aviso de privacidad</span><span class="mas">›</span></button></li>
      <li><button class="opcion" data-a="salir"><span class="ico">👋</span><span>Cerrar sesión</span></button></li>
    </ul>`);
}
function hojaInstalar() {
  let cuerpo;
  if (esInstalada()) cuerpo = '<p>Ya la tienes instalada. 🍵</p>';
  else if (instalador) cuerpo = `<p>Tu cel la puede instalar directo.</p><div class="fila-botones"><button class="btn" data-a="instalarYa">Instalar Ferduqui</button></div>`;
  else if (esIOS()) cuerpo = `<p>En iPhone se hace desde Safari:</p><ol class="pasos">
      <li>Toca el botón de <strong>Compartir</strong> (el cuadrito con una flecha hacia arriba).</li>
      <li>Baja y elige <strong>Agregar a inicio</strong>.</li>
      <li>Toca <strong>Agregar</strong>. Listo, ya te sale con su icono.</li></ol>
      <p class="ayuda" style="margin-top:12px">Si la abriste desde otra app (Instagram, WhatsApp), primero ábrela en Safari.</p>`;
  else cuerpo = `<ol class="pasos"><li>Abre el menú de Chrome (los tres puntitos arriba a la derecha).</li><li>Toca <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.</li><li>Confirma. Ya te sale con su icono.</li></ol>`;
  abrirHoja(`${cabeza('Instalar en tu cel')}${cuerpo}<p class="ayuda" style="margin-top:14px">Ya instalada funciona aunque no tengas internet: lo que registres se sube solo después.</p>`);
}
async function pedirAvisos() {
  if (!('Notification' in window)) {
    return toast(esIOS() && !esInstalada() ? 'En iPhone primero instálala en tu inicio; luego podrás activar los avisos.' : 'Tu cel no permite avisos aquí. Los verás en Pendientes al abrir la app.');
  }
  if (Notification.permission === 'denied') return toast('Los avisos están bloqueados. Actívalos en los ajustes de tu cel para esta app.');
  const r = await Notification.requestPermission();
  if (r === 'granted') { toast('Listo, te aviso cuando toque pagar.'); LS.del('fq:avisado:' + uid()); revisarAvisos(); }
  hojaCuenta();
}
async function revisarAvisos() {
  if (!sesion || !('Notification' in window) || Notification.permission !== 'granted') return;
  const h = iso(hoy());
  if (LS.get('fq:avisado:' + uid(), '') === h) return;
  const ps = pendientes().filter(p => p.notificar);
  if (!ps.length) return;
  const body = ps.map(p => `${p.titulo}. ${p.texto}`).join('\n');
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification('Ferduqui', { body, icon: 'iconos/icono-192.png', badge: 'iconos/icono-192.png', tag: 'pagos' });
    else new Notification('Ferduqui', { body, icon: 'iconos/icono-192.png' });
    LS.set('fq:avisado:' + uid(), h);
  } catch { /* algunos navegadores no dejan; ya se ve en Pendientes */ }
}

/* =========================================================
   Acciones (botones)
   ========================================================= */
const ACC = {
  ir(d) { ui.vista = d.v; ui.limite = 40; if (d.v === 'inicio') ui.animar = true; cerrarHoja(); render(); window.scrollTo(0, 0); },
  auth(d) { ui.auth = d.v; render(); window.scrollTo(0, 0); },
  ojo(d, el) { const i = el.previousElementSibling; const ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; el.textContent = ver ? 'Ocultar' : 'Mostrar'; el.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña'); },
  cerrar() { cerrarHoja(); },
  semana(d) { ui.semana = Math.min(0, ui.semana + +d.d); ui.animar = true; render(); },
  elegirMes(d) { ui.mesSel = d.mes; render(); const el = $(`[data-mes="${d.mes}"]`); el?.focus({ preventScroll: true }); },
  verMas() { ui.limite += 60; render(); },
  nuevoMov() { hojaMov(); },
  verMov(d) { hojaDetalleMov(d.id); },
  borrarMov(d) {
    if (!confirm('¿Borrar este movimiento?')) return;
    quitar('movs', d.id); cerrarHoja(); render(); toast('Borrado.');
  },
  nuevoMetodo() { hojaMetodo(null); },
  editarMetodo(d) { hojaMetodo(d.id); },
  verMetodo(d) { hojaDetalleMetodo(d.id); },
  borrarMetodo(d) {
    const m = metodo(d.id);
    if (!m || !confirm(`¿Borrar ${m.nombre}? Sus movimientos se quedan en tu historial.`)) return;
    quitar('metodos', d.id); cerrarHoja(); render(); toast('Tarjeta borrada.');
  },
  pagarTarjeta(d) {
    const m = metodo(d.id); if (!m) return;
    const ic = infoCredito(m), ms = metodosOrden();
    const origen = ms.find(x => x.tipo === 'debito') || ms.find(x => x.tipo === 'efectivo');
    hojaMov({ tipo: 'mover', monto: ic.porPagar ? String(ic.porPagar) : '', metodoId: origen?.id || '', destinoId: m.id, nota: '' });
  },
  otroMes() { const form = $('#hoja form'); form.dataset.mesesPlan = (+form.dataset.mesesPlan || 3) + 1; pintarPlan(); },
  nuevaMeta() { hojaMeta(null); },
  editarMeta(d) { hojaMeta(d.id); },
  verMeta(d) { hojaDetalleMeta(d.id); },
  apartar(d) { hojaApartar(d.id); },
  sacarMeta(d) { hojaApartar(d.id, true); },
  saltarMeta(d) { const m = D.metas[d.id]; if (m) LS.set(`fq:saltar:${uid()}:${m.id}`, iso(inicioPeriodo(m.frecuencia))); render(); },
  borrarMeta(d) {
    const m = D.metas[d.id];
    if (!m || !confirm(`¿Borrar la meta ${m.nombre}? El dinero apartado vuelve a quedar libre.`)) return;
    quitar('metas', d.id); cerrarHoja(); render(); toast('Meta borrada.');
  },
  usarSugerencia(d) { const i = $('#hoja input[name=aportacion]'); if (i) { i.value = d.n; i.focus(); } },
  fijoHecho(d) {
    const f = D.fijos[d.id]; if (!f) return;
    poner('movs', { id: nuevoId(), tipo: f.tipo === 'ingreso' ? 'ingreso' : 'gasto', monto: +f.monto, metodoId: metodo(f.metodoId) ? f.metodoId : 'efectivo', catId: f.catId, nota: f.nombre, fecha: iso(hoy()), creado: Date.now(), fijoId: f.id });
    poner('fijos', { ...f, ultimo: mesClave(hoy()) });
    render(); toast(`${f.nombre} registrado.`);
  },
  fijoSaltar(d) { const f = D.fijos[d.id]; if (!f) return; poner('fijos', { ...f, ultimo: mesClave(hoy()) }); render(); toast('Listo, este mes no.'); },
  fijos() { hojaFijos(); },
  nuevoFijo() { hojaFijo(null); },
  editarFijo(d) { hojaFijo(d.id); },
  borrarFijo(d) { if (!confirm('¿Borrar este fijo?')) return; quitar('fijos', d.id); hojaFijos(); render(); },
  categorias() { hojaCategorias(); },
  borrarCat(d) {
    const c = D.cats[d.id];
    if (!c) return;
    if (catsDe(c.tipo).length <= 1) return toast('Necesitas al menos una categoría.');
    if (!confirm(`¿Quitar ${c.nombre}? Lo que ya registraste se queda igual.`)) return;
    quitar('cats', d.id); hojaCategorias(); render();
  },
  cuenta() { hojaCuenta(); },
  syncAhora() { sync.error = null; sincronizar().then(() => { if (!$('#hoja').hidden) hojaCuenta(); }); },
  avisos() { pedirAvisos(); },
  privacidad() { abrirHoja(`${cabeza('Aviso de privacidad')}<div class="aviso-priv">${textoPrivacidad()}</div>`); },
  instalar() { hojaInstalar(); },
  async instalarYa() { if (!instalador) return; instalador.prompt(); await instalador.userChoice.catch(() => null); instalador = null; cerrarHoja(); render(); },
  noInstalar() { LS.set('fq:no-instalar', true); render(); },
  sinGuia() { LS.set('fq:sin-guia:' + uid(), true); render(); },
  salir() {
    const n = Object.keys(pend).length;
    const msg = n && API_URL
      ? `Tienes ${n} ${n === 1 ? 'cambio' : 'cambios'} sin subir. Se quedan guardados en este cel y se suben cuando vuelvas a entrar. ¿Cerrar sesión?`
      : '¿Cerrar sesión?';
    if (!confirm(msg)) return;
    if (API_URL && navigator.onLine && sesion.token) llamar('salir', { token: sesion.token }).catch(() => {});
    sesion = null; D = null; pend = {};
    LS.del('fq:sesion');
    ui.auth = 'bienvenida'; ui.vista = 'inicio';
    cerrarHoja(); render(); window.scrollTo(0, 0);
  },
};

const FORMS = {
  registro: f => enviarAuth(f, 'registrar'),
  entrar: f => enviarAuth(f, 'entrar'),
  mov: guardarMov,
  metodo: guardarMetodo,
  meta: guardarMeta,
  apartar: guardarApartar,
  fijo: guardarFijo,
  cat: guardarCat,
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const f = ACC[el.dataset.a];
  if (!f) return;
  e.preventDefault();
  f(el.dataset, el);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#hoja').hidden) cerrarHoja();
  const col = e.target.closest?.('.barras .col');
  if (col && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ACC.elegirMes(col.dataset); }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  FORMS[form.dataset.form]?.(form);
});
document.addEventListener('change', e => {
  const t = e.target, form = t.form;
  if (t.name === 'filtro') { ui.filtro = t.value; ui.limite = 40; render(); return; }
  if (!form) return;
  const tipoForm = form.dataset.form;
  if (tipoForm === 'mov') {
    if (t.name === 'tipo') { leerFormMov(form); fm.tipo = t.value; fm.catId = ''; if (t.value === 'mover' && fm.destinoId === fm.metodoId) fm.destinoId = ''; pintarHojaMov(); return; }
    if (t.name === 'preset') return aplicarPreset(form, t.value);
    if (t.name === 'meses' || (t.name === 'metodoId' && t.value !== '__nueva')) { infoMeses(form); return; }
    if (t.name === 'cuandoRapido') { form.fecha.value = t.value; return; }
    if (t.name === 'fecha') { $$('input[name=cuandoRapido]', form).forEach(r => { r.checked = r.value === t.value; }); return; }
    if ((t.name === 'metodoId' || t.name === 'destinoId') && t.value === '__nueva') {
      leerFormMov(form);
      pendienteTrasNueva = { ...fm, campo: t.name };
      fm = null;
      hojaMetodo(null);
      return;
    }
  }
  if (tipoForm === 'metodo' && t.name === 'tipo') ajustarFormMetodo(form);
  if (tipoForm === 'metodo' && (t.name === 'diaCorte' || t.name === 'diaPago')) pintarPlan();
  if (tipoForm === 'meta') sugerirMeta(form);
  if (tipoForm === 'fijo' && t.name === 'tipo') {
    form.catId.innerHTML = opcionesCat(t.value, '');
    const leg = $('fieldset legend', form); if (leg) leg.textContent = t.value === 'ingreso' ? '¿A dónde llega?' : '¿Con qué se paga?';
  }
});
document.addEventListener('input', e => {
  const form = e.target.form;
  if (form?.dataset.form === 'meta' && ['objetivo', 'fechaLimite'].includes(e.target.name)) sugerirMeta(form);
  if (e.target.closest?.('.monto-grande')) e.target.style.cssText = anchoMonto(e.target.value);
  if (form?.dataset.form === 'mov' && e.target.name === 'monto') infoMeses(form);
  if (form?.dataset.form === 'metodo' && e.target.dataset.mes) { planForm[e.target.dataset.mes] = leerMonto(e.target.value); sumaPlan(); }
  if (form?.dataset.form === 'metodo' && e.target.name === 'deuda') sumaPlan();
});
$('#hoja-fondo').addEventListener('click', cerrarHoja);

/* =========================================================
   Arranque
   ========================================================= */
function iniciar() {
  if (sesion) { try { cargarDatos(); } catch { sesion = null; } }
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('online', () => { pintarSync(); sincronizar(); });
  window.addEventListener('offline', pintarSync);
  let dia = iso(hoy());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !sesion) return;
    if (iso(hoy()) !== dia) { dia = iso(hoy()); if ($('#hoja').hidden) render(); }
    sincronizar(); revisarAvisos();
  });
  setInterval(() => { if (document.visibilityState === 'visible' && sesion) sincronizar(); }, 90000);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalador = e; });
  if (sesion) { sincronizar(); revisarAvisos(); }
}
iniciar();
