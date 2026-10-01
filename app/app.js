/* ============================================================
   DeCA — Documento electrónico de Control Administrativo
   App móvil (PWA). Réplica del generador deca_pdf.py del skill
   deca-albaran: mismos textos, mismas medidas, mismo QR.

   Base legal:
     - Orden FOM/2861/2012, art. 6      (datos a–h)
     - Resolución 5/06/2026 DGTyF       (PDF nativo + QR https)
     - Ley 9/2025, disp. transitoria 8ª (obligatorio 5/10/2026)
   ============================================================ */
'use strict';

/* ───────────────────────── datos por defecto (config.json) ── */
const POR_DEFECTO = {
  conductor: 'ANDRÉS PÉREZ DE TUDELA MARTÍNEZ',
  conductor_dni: '52825598-A',
  observaciones: 'Traslado entre centros Hero — Alcantarilla, provincia de Murcia.',
  caracter_transporte: 'Mercancías propias del cargador — transporte privado complementario (LOTT art. 102), sin retribución económica.',
  cargador: {
    nombre: 'HERO ESPAÑA, S.A.', nif: 'A-30000632-2',
    domicilio: 'Avenida de Murcia, 1 — 30820 Alcantarilla (Murcia)'
  },
  transportista: {
    nombre: 'HERO ESPAÑA, S.A.', nif: 'A-30000632-2',
    domicilio: 'Avenida de Murcia, 1 — 30820 Alcantarilla (Murcia)'
  },
  conjuntos: [{ nombre: 'Conjunto 1', tractor: '8003-HBR', remolque: 'R-3579-BCM' }],
  rutas: {
    exterior_a_hero: {
      etiqueta: 'González Perellón → Hero',
      origen: 'GONZALEZ PERELLON, S.L. — Ctra. Nacional 340 — 30835 Sangonera La Seca (Murcia)',
      destino: 'HERO ESPAÑA, S.A. — Avenida de Murcia, 1 — 30820 Alcantarilla (Murcia)'
    },
    hero_a_exterior: {
      etiqueta: 'Hero → González Perellón',
      origen: 'HERO ESPAÑA, S.A. — Avenida de Murcia, 1 — 30820 Alcantarilla (Murcia)',
      destino: 'GONZALEZ PERELLON, S.L. — Ctra. Nacional 340 — 30835 Sangonera La Seca (Murcia)'
    }
  },
  repo: 'andresperezdetudelamartinez-eng/deca-documentos-k7m2x',
  url_base: 'https://andresperezdetudelamartinez-eng.github.io/deca-documentos-k7m2x'
};

/* ───────────────────────────── ajustes (localStorage) ── */
const CLAVE_AJUSTES = 'deca_ajustes_v1';

function cargarAjustes() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || '{}');
    return Object.assign({}, POR_DEFECTO, g, {
      cargador: Object.assign({}, POR_DEFECTO.cargador, g.cargador || {}),
      transportista: Object.assign({}, POR_DEFECTO.transportista, g.transportista || {}),
      rutas: Object.assign({}, POR_DEFECTO.rutas, g.rutas || {}),
      conjuntos: g.conjuntos && g.conjuntos.length ? g.conjuntos : POR_DEFECTO.conjuntos
    });
  } catch (e) { return JSON.parse(JSON.stringify(POR_DEFECTO)); }
}
function guardarAjustes(a) { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(a)); }

/* ───────────────────────────── utilidades ── */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/** Escapa texto para insertarlo en plantillas HTML (datos del usuario/OCR). */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** '8.760,3' (formato español) → 8760.3 · null si no hay número */
function numES(texto) {
  if (texto === null || texto === undefined) return null;
  let s = String(texto).trim().toLowerCase().replace(/kg/g, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function decimalesDe(texto) {
  const s = String(texto || '');
  return s.includes(',') ? s.split(',').pop().trim().length : 0;
}
/** 8760.3 → '8.760,3' */
function fmtES(n, dec = 1) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
/** ['A'] → 'A' · ['A','B','C'] → 'A, B y C' */
function listaES(els) {
  const v = els.map(e => String(e == null ? '' : e).trim()).filter(Boolean);
  if (!v.length) return '';
  if (v.length === 1) return v[0];
  return v.slice(0, -1).join(', ') + ' y ' + v[v.length - 1];
}
/** slug aleatorio, nunca empieza por '-' (git/curl lo leerían como opción) */
function slug(n = 12) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const r = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += abc[r[i] % abc.length];
  if (s[0] === '-') s = 'x' + s.slice(1);
  return s;
}
async function sha256hex(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function bytesABase64(bytes, trozo = 0x8000) {
  let s = '';
  for (let i = 0; i < bytes.length; i += trozo) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + trozo));
  }
  return btoa(s);
}
function fechaHoyES() {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' +
         String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}
function fechaHoyInput() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}
function inputAFechaES(v) { // '2026-10-01' → '01/10/2026'
  if (!v) return '';
  const p = v.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
}
function fechaESaInput(v) { // '01/10/2026' → '2026-10-01'
  if (!v) return '';
  const p = String(v).split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : v;
}

/* ═══════════════════════════════════════ PDF (clon de deca_pdf.py) ═══ */

/** QR como data URL PNG. ERROR_CORRECT_M, cellSize 10, margin 2 (igual que el script). */
function qrDataURL(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  return qr.createDataURL(10, 8);
}

const AZUL = [31, 58, 95], GRIS = [90, 100, 114], BORDE = [201, 209, 219],
      GRIS2 = [60, 70, 84];

/**
 * Genera el PDF del DeCA. Mismo diseño que deca_pdf.py:
 * A4, margen 40, cabecera azul 92, bloques con filas de 27.
 * Devuelve Uint8Array.
 */
function generarPDF(datos, docId, url) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const W = 595.28, H = 841.89, M = 40;
  const anchoUtil = W - 2 * M;
  const ahora = new Date();
  const sello = ahora.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  doc.setProperties({
    title: docId,
    author: 'HERO ESPAÑA, S.A.',
    subject: 'Documento electronico de Control Administrativo',
    creator: 'Generador DeCA - App movil',
    keywords: 'DeCA, transporte, control administrativo'
  });

  const yJs = (y) => H - y; // reportlab (abajo-izq) → jsPDF (arriba-izq)

  function recorta(texto, ancho, tam) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(tam);
    if (doc.getTextWidth(texto) <= ancho) return texto;
    while (texto && doc.getTextWidth(texto + '…') > ancho) texto = texto.slice(0, -1);
    return texto + '…';
  }

  function campo(x, y, ancho, etiqueta, valor) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text(String(etiqueta).toUpperCase(), x, yJs(y));
    doc.setTextColor(0, 0, 0);
    const texto = (valor === null || valor === undefined || valor === '' ||
                   (Array.isArray(valor) && !valor.length)) ? '—' : String(valor);
    let tam = 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tam);
    while (tam > 7.5 && doc.getTextWidth(texto) > ancho) { tam -= 0.5; doc.setFontSize(tam); }
    doc.text(recorta(texto, ancho, tam), x, yJs(y - 13));
  }

  function bloque(x, y, ancho, titulo, filas) {
    const alto = 22 + filas.length * 27 + 10;
    doc.setDrawColor(BORDE[0], BORDE[1], BORDE[2]); doc.setLineWidth(0.6);
    doc.roundedRect(x, yJs(y), ancho, alto, 4, 4, 'S');
    doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(String(titulo).toUpperCase(), x + 8, yJs(y - 12));
    doc.line(x, yJs(y - 19), x + ancho, yJs(y - 19));
    const util = ancho - 20;
    filas.forEach((fila, i) => {
      const base = y - 22 - 13 - i * 27;
      const total = fila.reduce((s, f) => s + f[0], 0);
      let cx = x + 10;
      for (const [peso, etiqueta, valor] of fila) {
        campo(cx, base, util * (peso / total), etiqueta, valor);
        cx += util * (peso / total);
      }
    });
    return alto + 12;
  }

  /* ─ cabecera ─ */
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.rect(0, 0, W, 92, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('DOCUMENTO ELECTRÓNICO DE CONTROL ADMINISTRATIVO', M, yJs(H - 40));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('DeCA — Orden FOM/2861/2012, art. 6  ·  Resolución de 5 de junio de 2026', M, yJs(H - 57));
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(docId, M, yJs(H - 78));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text('Creado: ' + sello, W - M, yJs(H - 78), { align: 'right' });

  let y = H - 110;

  const car = datos.cargador || {}, tra = datos.transportista || {},
        mer = datos.mercancia || {}, veh = datos.vehiculos || {};
  const pesoTexto = ((mer.peso || '') + ' ' + (mer.unidad || '')).trim();

  y -= bloque(M, y, anchoUtil, 'a) Cargador contractual', [
    [[3, 'Nombre o denominación social', car.nombre], [2, 'NIF', car.nif]],
    [[1, 'Domicilio (calle y número, CP, población y provincia)', car.domicilio]]
  ]);
  y -= bloque(M, y, anchoUtil, 'b) Transportista efectivo', [
    [[3, 'Nombre o denominación social', tra.nombre], [2, 'NIF', tra.nif]],
    [[1, 'Domicilio (calle y número, CP, población y provincia)', tra.domicilio]],
    [[2, 'Conductor', datos.conductor], [1, 'DNI del conductor', datos.conductor_dni]]
  ]);
  y -= bloque(M, y, anchoUtil, 'c) Lugar de origen y destino', [
    [[1, 'Origen — nombre y dirección completa', datos.origen]],
    [[1, 'Destino — nombre y dirección completa', datos.destino]]
  ]);
  y -= bloque(M, y, anchoUtil, 'd) Naturaleza y peso de la mercancía', [
    [[3, 'Naturaleza', mer.naturaleza], [2, 'Peso / cantidad', pesoTexto]],
    [[1, 'Carácter del transporte', datos.caracter_transporte]]
  ]);
  y -= bloque(M, y, anchoUtil,
    'e) Autorización especial de circulación   ·   f) Fecha de realización', [
    [[1, 'Autorización complementaria de circulación (ACC)', datos.autorizacion_especial],
     [1, 'Fecha de realización', datos.fecha_transporte]]
  ]);
  y -= bloque(M, y, anchoUtil,
    'g) Matrícula del vehículo   ·   h) Observaciones y reservas', [
    [[2, 'Matrícula tractor', veh.tractor], [2, 'Remolque / semirremolque', veh.remolque]],
    [[1, 'Observaciones', datos.observaciones]]
  ]);

  /* ─ QR ─ */
  if (url) {
    const lado = 84;
    doc.setDrawColor(BORDE[0], BORDE[1], BORDE[2]); doc.setLineWidth(0.6);
    doc.roundedRect(M, yJs(y), anchoUtil, lado + 14, 4, 4, 'S');
    doc.addImage(qrDataURL(url), 'PNG', M + 12, yJs(y), lado, lado);
    doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('VERIFICACIÓN DEL DOCUMENTO', M + lado + 30, yJs(y - 26));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(GRIS2[0], GRIS2[1], GRIS2[2]);
    doc.text('Escanee el código o abra la URL para descargar este PDF.', M + lado + 30, yJs(y - 41));
    doc.text('Acceso directo, sin credenciales ni pasos intermedios.', M + lado + 30, yJs(y - 53));
    doc.setFontSize(7);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    let urlTxt = url;
    const anchoUrl = anchoUtil - lado - 50;
    if (doc.getTextWidth(urlTxt) > anchoUrl) {
      while (urlTxt && doc.getTextWidth(urlTxt + '…') > anchoUrl) urlTxt = urlTxt.slice(0, -1);
      urlTxt += '…';
    }
    doc.text(urlTxt, M + lado + 30, yJs(y - 72));
  }

  /* ─ pie ─ */
  doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  doc.text('Documento generado electrónicamente a partir de datos estructurados el ' +
           sello + '. Conservación mínima: 1 año.', M, yJs(38));
  doc.text('Cargador contractual: datos a), b), c) y d).  Transportista efectivo: datos e), f) y g).  ' +
           'Observaciones (h): cada parte responde de las suyas.', M, yJs(28));

  return new Uint8Array(doc.output('arraybuffer'));
}

/* ───────────── composición de datos (clon de fusionar/componer_albaranes) ── */

function componerAlbaranes(datos) {
  const albs = (datos.albaranes || []).filter(a => a && (a.entrega || a.pedido || a.palets ||
    a.kg_brutos || a.kg_netos));
  if (!albs.length) return datos;
  const out = Object.assign({}, datos);
  const palets = albs.reduce((s, a) => s + (String(a.palets || '').trim() &&
    /^\d+$/.test(String(a.palets).trim()) ? parseInt(a.palets, 10) : 0), 0);
  const brutos = albs.map(a => numES(a.kg_brutos)).filter(n => n !== null);
  const netos = albs.map(a => numES(a.kg_netos)).filter(n => n !== null);

  let nat = 'Mercancía paletizada, mercancías varias';
  if (palets) nat += ` (${palets} palets)`;
  out.mercancia = { naturaleza: nat };
  if (brutos.length) {
    const dec = Math.max(...albs.map(a => decimalesDe(a.kg_brutos)));
    const totalB = brutos.reduce((s, n) => s + n, 0);
    out.mercancia.peso = fmtES(totalB, dec);
    out.mercancia.unidad = netos.length
      ? `kg brutos / ${fmtES(netos.reduce((s, n) => s + n, 0), dec)} kg netos`
      : 'kg brutos';
  }
  const entregas = albs.map(a => a.entrega).filter(Boolean);
  const pedidos = albs.map(a => a.pedido).filter(Boolean);
  const refs = [];
  if (entregas.length) refs.push((entregas.length > 1 ? 'Entregas ' : 'Entrega ') + listaES(entregas));
  if (pedidos.length) refs.push((pedidos.length > 1 ? 'Pedidos ' : 'Pedido ') + listaES(pedidos));
  if (refs.length) {
    let base = String(out.observaciones || '').trim();
    if (base && !/[.·]$/.test(base)) base += '.';
    out.observaciones = (base ? base + ' ' : '') + refs.join(' · ') + '.';
  }
  return out;
}

/** Campos esenciales (mismo chequeo que deca_completo.py). Devuelve lista de faltas. */
function faltanEsenciales(d) {
  const f = [];
  if (!(d.cargador && d.cargador.nombre)) f.push('a) cargador');
  if (!(d.transportista && d.transportista.nombre)) f.push('b) transportista');
  if (!d.origen) f.push('c) origen');
  if (!d.destino) f.push('c) destino');
  if (!(d.mercancia && d.mercancia.naturaleza)) f.push('d) naturaleza');
  if (!(d.mercancia && d.mercancia.peso)) f.push('d) peso');
  if (!d.fecha_transporte) f.push('f) fecha');
  if (!(d.vehiculos && d.vehiculos.tractor)) f.push('g) matrícula tractora');
  if (!(d.vehiculos && d.vehiculos.remolque)) f.push('g) matrícula remolque');
  if (!d.caracter_transporte) f.push('d) carácter del transporte');
  return f;
}

/* ═══════════════════════════════════════════ OCR del albarán ═══ */

/**
 * Prepara la foto para el OCR: la reduce (máx. 2200 px de lado mayor), la pasa
 * a gris con algo de contraste y la devuelve como PNG.
 * Probado con el albarán real: en PNG gris el lector acierta todos los campos;
 * en JPEG a color fallaba la entrega, los palets y los kilos.
 */
function reducirImagen(file, max = 2200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const esc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * esc);
      c.height = Math.round(img.height * esc);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      try { ctx.filter = 'grayscale(1) contrast(1.15)'; } catch (e) { /* sin filtro */ }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo procesar la imagen')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

/** OCR con Tesseract.js (español). onProgreso(0..1). */
async function leerAlbaran(file, onProgreso) {
  const img = await reducirImagen(file);
  const { data } = await Tesseract.recognize(img, 'spa', {
    workerPath: 'vendor/tesseract-worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m) => {
      if (onProgreso && m.status === 'recognizing text') onProgreso(m.progress);
    }
  });
  return data.text || '';
}

/** Limpia el número: O/o→0, l/I→1, fuera todo lo que no sea dígito. */
function soloDigitos(s) {
  return String(s || '').replace(/[OoQ]/g, '0').replace(/[lI|]/g, '1').replace(/\D/g, '');
}

/**
 * Extrae los campos del albarán de Hero desde el texto OCR.
 * El OCR confunde letras («n.º de entrega» lo lee «Adeentega»), así que las
 * etiquetas se buscan con holgura (ent·rega / entega) y los números se limpian
 * de confusiones (O→0, l/I→1) antes de validarlos.
 */
function extraerCampos(texto) {
  const bruto = String(texto || '').replace(/\u00a0/g, ' ');
  const lineas = bruto.split(/\n+/);
  const res = {};
  let pesoBruto = null, pesoNeto = null;

  const RX_ENTREGA = /ent\w{0,2}ega/i;   // entrega / entega / Adeentega
  const numero = (t, min, max) => {
    const d = soloDigitos(t);
    return d.length >= min && d.length <= max ? d : null;
  };

  for (const linea of lineas) {
    const l = linea.trim();
    if (!l) continue;
    const ln = l.toLowerCase();

    if (!res.entrega && RX_ENTREGA.test(l) && !/fecha/i.test(l)) {
      const i = l.search(RX_ENTREGA);
      const d = numero(l.slice(i).replace(RX_ENTREGA, ''), 8, 13);
      if (d) res.entrega = d;
    }
    if (!res.pedido && /pedido/i.test(ln)) {
      const d = numero(l.replace(/^.*?pedido[^0-9]{0,40}/i, ''), 8, 13);
      if (d) res.pedido = d;
    }
    if (!res.palets && /palets?|bultos/i.test(ln)) {
      const m = l.match(/(\d{1,4})\s*(?:palets?|bultos)/i) ||
                l.match(/(?:palets?|bultos)[^\d]{0,8}(\d{1,4})/i);
      if (m) res.palets = m[1];
    }
    if (!res.fecha && /fecha\s*de\s*entrega/i.test(ln)) {
      const m = l.match(/(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
      if (m) res.fecha = `${m[1]}/${m[2]}/${m[3]}`;
    }
    if (pesoBruto === null && /peso\s*bruto/i.test(ln)) {
      const m = l.match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
      if (m) { pesoBruto = m[1]; pesoNeto = m[2]; }
    }
  }

  // «Suma de palets» es el total del albarán: manda sobre la etiqueta de arriba.
  const mSuma = bruto.match(/suma\s+de\s+palets[^\d]{0,8}(\d{1,4})/i);
  if (mSuma) res.palets = mSuma[1];

  // Si el peso bruto trae decimales y el neto los perdió («9,4 / 94»), se
  // reconstruye con la misma precisión: 94 → 9,4.
  if (pesoBruto !== null && pesoNeto !== null) {
    const dec = decimalesDe(pesoBruto);
    const digitosNeto = soloDigitos(pesoNeto);
    if (dec > 0 && !/[.,]/.test(pesoNeto) && digitosNeto.length === soloDigitos(pesoBruto).length) {
      pesoNeto = digitosNeto.slice(0, -dec) + ',' + digitosNeto.slice(-dec);
    }
    res.kg_brutos = pesoBruto;
    res.kg_netos = pesoNeto;
  }

  // Ruta sugerida: mirar qué viene tras «Enviado desde»
  const iDesde = lineas.findIndex(l => /enviado\s+desde/i.test(l));
  if (iDesde >= 0) {
    const zona = lineas.slice(iDesde, iDesde + 7).join(' ').toUpperCase();
    if (/GONZALEZ|PERELL|SANGONERA|NACIONAL\s*340/.test(zona)) res.ruta = 'exterior_a_hero';
    else if (/SLOC|AV\s*DE\s*MURCIA|ALCANTARILLA/.test(zona)) res.ruta = 'hero_a_exterior';
  }
  return res;
}

/* ═══════════════════════════════════════════ GitHub (publicar + verificar) ═══ */

async function publicarPDF(ajustes, rutaArchivo, bytes) {
  const url = `https://api.github.com/repos/${ajustes.repo}/contents/${rutaArchivo}`;
  const cabeceras = {
    'Authorization': 'Bearer ' + ajustes.token,
    'Accept': 'application/vnd.github+json'
  };
  // Si el fichero ya existe (reintento tras un fallo de red), GitHub exige el sha actual.
  const cuerpo = {
    message: 'Publicar DeCA ' + rutaArchivo.replace(/\.pdf$/, ''),
    content: bytesABase64(bytes)
  };
  try {
    const previo = await fetch(url, { headers: cabeceras });
    if (previo.ok) { const j = await previo.json(); if (j && j.sha) cuerpo.sha = j.sha; }
  } catch (e) { /* si falla, se intenta el PUT igualmente */ }
  const r = await fetch(url, {
    method: 'PUT',
    headers: cabeceras,
    body: JSON.stringify(cuerpo)
  });
  if (!r.ok) {
    let detalle = 'HTTP ' + r.status;
    try { const j = await r.json(); if (j && j.message) detalle += ' — ' + j.message; } catch (e) {}
    throw new Error(detalle);
  }
  return r.json();
}

/** Comprueba la URL pública EXACTAMENTE como la vería el guardia:
    sin sesión (credentials omit), sin caché del móvil y siguiendo redirecciones.
    Devuelve { ok, motivo, http }. motivos: ok · sin_publicar · no_pdf · otro_pdf ·
    vacio · sin_red · http_<código> */
async function comprobarURL(url, shaEsperado) {
  try {
    const r = await fetch(url + '?v=' + Date.now(),
      { cache: 'no-store', credentials: 'omit', redirect: 'follow' });
    if (r.status === 404) return { ok: false, motivo: 'sin_publicar', http: 404 };
    if (!r.ok) return { ok: false, motivo: 'http_' + r.status, http: r.status };
    const ctype = (r.headers.get('Content-Type') || '').toLowerCase();
    if (!ctype.includes('pdf')) return { ok: false, motivo: 'no_pdf', http: r.status };
    const buf = new Uint8Array(await r.arrayBuffer());
    if (!buf.length) return { ok: false, motivo: 'vacio', http: r.status };
    if (shaEsperado && await sha256hex(buf) !== shaEsperado) {
      return { ok: false, motivo: 'otro_pdf', http: r.status };
    }
    return { ok: true, motivo: 'ok', http: r.status };
  } catch (e) {
    return { ok: false, motivo: 'sin_red', http: 0 };
  }
}

/** Igual que comprobarURL pero insistiendo, por si GitHub Pages aún no lo sirve. */
async function comprobarConEspera(url, shaEsperado, esperasMs = [5000, 8000, 12000, 15000], onIntento) {
  let ultimo = { ok: false, motivo: 'sin_red', http: 0 };
  for (let i = 0; i <= esperasMs.length; i++) {
    if (onIntento) onIntento(i + 1, esperasMs.length + 1);
    ultimo = await comprobarURL(url, shaEsperado);
    if (ultimo.ok) return ultimo;
    // Si el fichero no existe (404), subir otra vez no sirve: insistir tampoco.
    if (ultimo.motivo === 'sin_publicar') return ultimo;
    if (i < esperasMs.length) await new Promise(r => setTimeout(r, esperasMs[i]));
  }
  return ultimo;
}

/** ¿GitHub está caído ahora mismo? (para distinguir "mi PDF" de "internet"). */
async function githubCaido() {
  try {
    const r = await fetch('https://www.githubstatus.com/api/v2/status.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const j = await r.json();
    return j && j.status && j.status.indicator && j.status.indicator !== 'none';
  } catch (e) { return false; }
}

const MOTIVOS = {
  sin_publicar: 'el PDF todavía no está en internet',
  no_pdf: 'internet devuelve otra cosa en vez del PDF',
  otro_pdf: 'internet sirve un PDF distinto al generado',
  vacio: 'el archivo de internet está vacío',
  sin_red: 'este teléfono no tiene conexión ahora mismo'
};

/* ═══════════════════════════════════════════ archivo local (IndexedDB) ═══ */

let dbCache = null;
function abrirDB() {
  if (dbCache) return Promise.resolve(dbCache);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('deca', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { dbCache = req.result; resolve(dbCache); };
    req.onerror = () => reject(req.error);
  });
}
async function guardarDoc(doc) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('docs', 'readwrite');
    tx.objectStore('docs').put(doc);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
async function listarDocs() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('docs', 'readonly');
    const req = tx.objectStore('docs').getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => (b.creado || '').localeCompare(a.creado || '')));
    req.onerror = () => reject(req.error);
  });
}
async function borrarDoc(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('docs', 'readwrite');
    tx.objectStore('docs').delete(id);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
/** Poda: fuera los documentos de más de 13 meses (se conservan 12). */
async function podar() {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - 13);
  const docs = await listarDocs();
  for (const d of docs) {
    if (d.creado && new Date(d.creado) < limite) await borrarDoc(d.id);
  }
}

/* ═══════════════════════════════════════════ estado y navegación ═══ */

const estado = {
  ajustes: null,
  fotoOriginal: null,
  ocr: {},
  albaranes: [],
  ultimoDoc: null,
  contadorDiaClave: null
};

function ir(pantalla) {
  $$('.pantalla').forEach(p => p.classList.remove('activa'));
  const el = $('#pantalla-' + pantalla);
  if (el) el.classList.add('activa');
  window.scrollTo(0, 0);
}

function nuevoId() {
  const d = new Date();
  const clave = 'deca_contador_' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const n = (parseInt(localStorage.getItem(clave) || '0', 10) || 0) + 1;
  localStorage.setItem(clave, String(n));
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `DeCA-${d.getFullYear()}-${mm}${dd}-${String(n).padStart(3, '0')}`;
}

/* ═══════════════════════════════════════════ UI: formulario ═══ */

function pintarAlbaranes() {
  const cont = $('#lista-albaranes');
  cont.innerHTML = '';
  estado.albaranes.forEach((a, i) => {
    const div = document.createElement('div');
    div.className = 'albaran';
    div.innerHTML = `
      <div class="albaran-cab">
        <strong>Albarán ${i + 1}</strong>
        ${estado.albaranes.length > 1 ? `<button class="mini rojo" data-quitar="${i}">Quitar</button>` : ''}
      </div>
      <div class="rejilla">
        <label>N.º entrega<input inputmode="numeric" data-campo="entrega" data-i="${i}" value="${esc(a.entrega)}"></label>
        <label>Pedido<input inputmode="numeric" data-campo="pedido" data-i="${i}" value="${esc(a.pedido)}"></label>
        <label>Palets<input inputmode="numeric" data-campo="palets" data-i="${i}" value="${esc(a.palets)}"></label>
        <label>Kg brutos<input inputmode="decimal" data-campo="kg_brutos" data-i="${i}" value="${esc(a.kg_brutos)}"></label>
        <label>Kg netos<input inputmode="decimal" data-campo="kg_netos" data-i="${i}" value="${esc(a.kg_netos)}"></label>
      </div>`;
    cont.appendChild(div);
  });
  cont.querySelectorAll('input[data-campo]').forEach(inp => {
    inp.addEventListener('input', () => {
      estado.albaranes[+inp.dataset.i][inp.dataset.campo] = inp.value;
    });
  });
  cont.querySelectorAll('button[data-quitar]').forEach(b => {
    b.addEventListener('click', () => {
      estado.albaranes.splice(+b.dataset.quitar, 1);
      pintarAlbaranes();
    });
  });
}

function pintarConjuntos() {
  const sel = $('#sel-conjunto');
  sel.innerHTML = '';
  estado.ajustes.conjuntos.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `${c.nombre}: ${c.tractor} + ${c.remolque}`;
    sel.appendChild(o);
  });
}

function pintarRutas() {
  const sel = $('#sel-ruta');
  sel.innerHTML = '';
  Object.entries(estado.ajustes.rutas).forEach(([k, r]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = r.etiqueta || k;
    sel.appendChild(o);
  });
  const o = document.createElement('option');
  o.value = 'otra';
  o.textContent = 'Otra (escribir origen y destino)';
  sel.appendChild(o);
}

function abrirFormulario(campos) {
  pintarAlbaranes();
  pintarConjuntos();
  pintarRutas();
  $('#f-fecha').value = fechaESaInput(campos.fecha || '') || fechaHoyInput();
  $('#f-acc').value = 'No precisa';
  $('#f-observaciones').value = estado.ajustes.observaciones;
  if (campos.ruta) $('#sel-ruta').value = campos.ruta;
  actualizarRutaVisible();
  $('#aviso-form').style.display = 'none';
  ir('form');
}

function actualizarRutaVisible() {
  const otra = $('#sel-ruta').value === 'otra';
  $('#bloque-ruta-otra').style.display = otra ? 'block' : 'none';
}

function leerFormulario() {
  const ajustes = estado.ajustes;
  const idx = parseInt($('#sel-conjunto').value || '0', 10);
  const conjunto = ajustes.conjuntos[idx] || ajustes.conjuntos[0];
  const rutaSel = $('#sel-ruta').value;
  let origen, destino;
  if (rutaSel === 'otra') {
    origen = $('#f-origen').value.trim();
    destino = $('#f-destino').value.trim();
  } else {
    const r = ajustes.rutas[rutaSel];
    origen = r ? r.origen : '';
    destino = r ? r.destino : '';
  }
  return {
    conductor: ajustes.conductor,
    conductor_dni: ajustes.conductor_dni,
    cargador: ajustes.cargador,
    transportista: ajustes.transportista,
    vehiculos: { tractor: conjunto.tractor, remolque: conjunto.remolque },
    origen, destino,
    fecha_transporte: inputAFechaES($('#f-fecha').value),
    autorizacion_especial: $('#f-acc').value.trim(),
    observaciones: $('#f-observaciones').value.trim() || ajustes.observaciones,
    caracter_transporte: ajustes.caracter_transporte,
    albaranes: estado.albaranes.map(a => Object.assign({}, a))
  };
}

/* ═══════════════════════════════════════════ acciones ═══ */

async function procesarFoto(file) {
  estado.fotoOriginal = file;
  ir('carga');
  const barra = $('#barra-progreso');
  const texto = $('#texto-estado-carga');
  texto.textContent = 'Preparando la imagen…';
  barra.style.width = '5%';
  try {
    const raw = await leerAlbaran(file, (p) => {
      texto.textContent = 'Leyendo el albarán… ' + Math.round(p * 100) + '%';
      barra.style.width = (10 + p * 85) + '%';
    });
    const campos = extraerCampos(raw);
    estado.ocr = campos;
    estado.albaranes = [{
      entrega: campos.entrega || '', pedido: campos.pedido || '',
      palets: campos.palets || '', kg_brutos: campos.kg_brutos || '', kg_netos: campos.kg_netos || ''
    }];
    barra.style.width = '100%';
    texto.textContent = 'Listo';
    abrirFormulario(campos);
  } catch (e) {
    texto.textContent = 'No se pudo leer el albarán: ' + e.message +
      '. Puedes rellenar los datos a mano.';
    estado.albaranes = [{ entrega: '', pedido: '', palets: '', kg_brutos: '', kg_netos: '' }];
    setTimeout(() => abrirFormulario({}), 1200);
  }
}

async function generarYPublicar() {
  const btn = $('#btn-generar');
  const aviso = $('#aviso-form');
  const datos = leerFormulario();
  const faltas = faltanEsenciales(componerAlbaranes(datos));
  if (faltas.length) {
    aviso.textContent = 'Faltan campos esenciales: ' + faltas.join(', ');
    aviso.style.display = 'block';
    return;
  }
  aviso.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Generando…';

  try {
    const docId = nuevoId();
    const sl = slug(12);
    const url = `${estado.ajustes.url_base.replace(/\/$/, '')}/${sl}.pdf`;
    const datosComp = componerAlbaranes(datos);
    const bytes = generarPDF(datosComp, docId, url);
    const sha = await sha256hex(bytes);

    const registro = {
      id: docId, creado: new Date().toISOString(), datos: datosComp,
      bytes: bytes.buffer.slice(0), url, sha256: sha, estado: 'pendiente',
      subido: false, ultimaVerif: null, publicadoEn: null
    };

    btn.textContent = 'Publicando el QR…';
    let publicado = false, motivo = '';
    if (estado.ajustes.token) {
      try {
        await publicarPDF(estado.ajustes, sl + '.pdf', bytes);
        registro.subido = true;
        btn.textContent = 'Comprobando que el QR ya funciona…';
        const res = await comprobarConEspera(url, sha, undefined, (i, n) => {
          btn.textContent = `Comprobando el QR… (${i}/${n})`;
        });
        publicado = res.ok;
        motivo = res.motivo;
      } catch (e) {
        motivo = 'subida: ' + e.message;
      }
    } else {
      motivo = 'sin_token';
    }
    registro.estado = publicado ? 'publicado' : 'pendiente';
    registro.ultimaVerif = new Date().toISOString();
    if (publicado) registro.publicadoEn = registro.ultimaVerif;
    registro.error = publicado ? '' : motivo;
    await guardarDoc(registro);
    estado.ultimoDoc = registro;
    programarVigilante();

    $('#r-id').textContent = docId;
    $('#r-estado').textContent = publicado
      ? '✅ Publicado y comprobado — el QR ya funciona'
      : '⏳ ' + textoPendiente(registro);
    $('#r-detalle').textContent = datosComp.mercancia.peso
      ? `${datosComp.mercancia.peso} ${datosComp.mercancia.unidad} · ${(datosComp.albaranes || []).map(a => a.entrega).filter(Boolean).join(', ')}`
      : '';
    ir('resultado');
  } catch (e) {
    aviso.textContent = 'Error al generar: ' + e.message;
    aviso.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generar DeCA';
  }
}

async function compartirDoc(registro) {
  const bytes = new Uint8Array(registro.bytes);
  const nombre = registro.id + '.pdf';
  const file = new File([bytes], nombre, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: registro.id }); return; } catch (e) { /* cancelado */ }
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/* ═════════════════════ verificación continua (segundo plano) ══════════════════
   Todo documento que no esté comprobado se revisa solo: al abrir la app, al
   volver a ella y cada pocos segundos mientras haya alguno pendiente. Cuando
   queda publicado se sella con la hora y (si hay permiso) salta un aviso. */

function textoPendiente(registro) {
  if (!registro.subido) {
    if (registro.error === 'sin_token') {
      return 'Sin publicar — falta el token de GitHub en Ajustes. El PDF lleva el QR, pero hay que publicarlo.';
    }
    return 'No se pudo subir: ' + (registro.error || 'error desconocido');
  }
  if (registro.error === 'sin_red') return 'Subido. Sin conexión para comprobar; se comprobará solo.';
  return 'Subido. GitHub aún no lo sirve; comprobación automática en marcha.';
}

/** Marca un registro como publicado (sella hora y avisa). */
async function marcarPublicado(registro) {
  const primeraVez = registro.estado !== 'publicado';
  registro.estado = 'publicado';
  registro.error = '';
  registro.publicadoEn = registro.publicadoEn || new Date().toISOString();
  registro.ultimaVerif = new Date().toISOString();
  await guardarDoc(registro);
  if (primeraVez) {
    avisarPublicado(registro);
    if (estado.ultimoDoc && estado.ultimoDoc.id === registro.id) {
      estado.ultimoDoc = registro;
      const el = $('#r-estado');
      if (el && $('#pantalla-resultado').classList.contains('activa')) {
        el.textContent = '✅ Publicado y comprobado — el QR ya funciona';
      }
    }
  }
}

/** Aviso local cuando un documento pasa a publicado (si hay permiso). */
function avisarPublicado(registro) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('DeCA publicado ✅', {
        body: registro.id + ' — el QR ya funciona. Comprobado a las ' +
              new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + '.',
        tag: 'deca-' + registro.id
      });
    }
  } catch (e) { /* sin aviso, sin problema */ }
}

/** Resuelve un documento: sube lo que falte y comprueba hasta que esté listo.
    silencioso = true → sin avisos emergentes (rondas de fondo). */
async function resolverDoc(registro, conEspera = true, silencioso = false) {
  const ajustes = estado.ajustes;
  // 1) Si la subida nunca llegó a hacerse, se hace ahora.
  if (!registro.subido) {
    if (!ajustes.token) {
      registro.error = 'sin_token';
      registro.ultimaVerif = new Date().toISOString();
      await guardarDoc(registro);
      if (!silencioso) alert('Falta el token de GitHub en Ajustes.');
      return false;
    }
    const sl = registro.url.split('/').pop().replace(/\.pdf$/, '');
    try {
      await publicarPDF(ajustes, sl + '.pdf', new Uint8Array(registro.bytes));
      registro.subido = true;
      registro.error = '';
    } catch (e) {
      registro.error = 'subida: ' + e.message;
      registro.ultimaVerif = new Date().toISOString();
      await guardarDoc(registro);
      return false;
    }
  }
  // 2) Comprobación en internet (con paciencia si es a petición del usuario).
  const res = conEspera
    ? await comprobarConEspera(registro.url, registro.sha256)
    : await comprobarURL(registro.url, registro.sha256);
  if (res.ok) { await marcarPublicado(registro); return true; }
  registro.estado = 'pendiente';
  registro.error = res.motivo;
  registro.ultimaVerif = new Date().toISOString();
  await guardarDoc(registro);
  return false;
}

/** Revisa todos los pendientes (rápido, una sola pasada, sin avisos emergentes).
    Devuelve cuántos quedan por resolver "de verdad" (los que no dependen del token). */
async function comprobarPendientes() {
  const docs = await listarDocs();
  const pendientes = docs.filter(d => d.estado !== 'publicado');
  for (const d of pendientes) {
    // Sin token y sin subir: no hay nada que reintentar; que no consuma la ronda.
    if (!d.subido && !estado.ajustes.token) continue;
    await resolverDoc(d, false, true);
  }
  return (await listarDocs()).filter(
    d => d.estado !== 'publicado' && (d.subido || estado.ajustes.token)).length;
}

let vigilanteTimer = null, vigilanteEspera = 20000;
function programarVigilante() {
  clearTimeout(vigilanteTimer);
  vigilanteTimer = setTimeout(async () => {
    let quedan = 0;
    try { quedan = await comprobarPendientes(); } catch (e) { /* sin red: se reintenta */ }
    if (quedan > 0) {
      vigilanteEspera = Math.min(vigilanteEspera * 1.7, 300000); // hasta 5 min
      programarVigilante();
    } else {
      vigilanteEspera = 20000;
      if ($('#pantalla-historial').classList.contains('activa')) pintarHistorial();
    }
  }, vigilanteEspera);
}

/* ═══════════════════════════════════════════ UI: historial y ajustes ═══ */

async function pintarHistorial() {
  const docs = await listarDocs();
  const cont = $('#lista-historial');
  cont.innerHTML = '';
  if (!docs.length) {
    cont.innerHTML = '<p class="gris">Todavía no hay documentos.</p>';
    return;
  }
  for (const d of docs) {
    const div = document.createElement('div');
    div.className = 'doc';
    const fecha = new Date(d.creado).toLocaleString('es-ES',
      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const entregas = ((d.datos && d.datos.albaranes) || []).map(a => a.entrega).filter(Boolean).join(', ');
    const hora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-ES',
      { hour: '2-digit', minute: '2-digit' }) : '';
    const sello = d.estado === 'publicado'
      ? `<span class="ok">✅ publicado</span><span class="gris"> · QR comprobado${d.publicadoEn ? ' a las ' + hora(d.publicadoEn) : ''}</span>`
      : (d.subido
        ? `<span class="pend">⏳ subido, comprobando…</span><span class="gris">${d.ultimaVerif ? ' · última comprobación ' + hora(d.ultimaVerif) : ''}</span>`
        : `<span class="pend">⚠️ sin publicar</span>`);
    div.innerHTML = `
      <div class="doc-cab">
        <strong>${esc(d.id)}</strong>
      </div>
      <div class="gris">${esc(fecha)}${entregas ? ' · entrega ' + esc(entregas) : ''}</div>
      <div class="gris" style="margin-top:4px">${sello}</div>
      <div class="doc-botones">
        <button data-ver="${d.id}">Ver / compartir</button>
        <button data-comp="${d.id}">${d.estado === 'publicado' ? 'Re-comprobar' : (d.subido ? 'Comprobar ahora' : 'Publicar y comprobar')}</button>
        <button data-probar="${d.id}">🔍 Probar</button>
        <button class="rojo" data-borrar="${d.id}">Borrar</button>
      </div>`;
    cont.appendChild(div);
  }
  cont.querySelectorAll('button[data-ver]').forEach(b => b.addEventListener('click', async () => {
    const d = (await listarDocs()).find(x => x.id === b.dataset.ver);
    if (d) compartirDoc(d);
  }));
  cont.querySelectorAll('button[data-comp]').forEach(b => b.addEventListener('click', async () => {
    const d = (await listarDocs()).find(x => x.id === b.dataset.comp);
    if (!d) return;
    b.disabled = true; b.textContent = 'Comprobando…';
    const ok = await resolverDoc(d, true);
    await pintarHistorial();
    if (!ok) {
      const caido = await githubCaido();
      alert(caido
        ? 'GitHub está caído ahora mismo. Tu documento está subido; se comprobará solo.'
        : 'Todavía no: ' + (MOTIVOS[d.error] || d.error || 'no está disponible') + '. Se seguirá comprobando solo.');
    }
  }));
  cont.querySelectorAll('button[data-probar]').forEach(b => b.addEventListener('click', async () => {
    const d = (await listarDocs()).find(x => x.id === b.dataset.probar);
    if (d && d.url) window.open(d.url, '_blank');
  }));
  cont.querySelectorAll('button[data-borrar]').forEach(b => b.addEventListener('click', async () => {
    if (confirm('¿Borrar ' + b.dataset.borrar + ' del archivo del teléfono? (El PDF de internet no se toca)')) {
      await borrarDoc(b.dataset.borrar);
      pintarHistorial();
    }
  }));
}

function pintarAjustes() {
  const a = estado.ajustes;
  $('#a-token').value = a.token || '';
  $('#a-repo').value = a.repo;
  $('#a-conductor').value = a.conductor;
  $('#a-dni').value = a.conductor_dni;
  $('#a-cargador').value = a.cargador.nombre;
  $('#a-cargador-nif').value = a.cargador.nif;
  $('#a-cargador-dir').value = a.cargador.domicilio;
  $('#a-observaciones').value = a.observaciones;
  $('#a-caracter').value = a.caracter_transporte;
  const cont = $('#lista-conjuntos');
  cont.innerHTML = '';
  a.conjuntos.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'conjunto';
    div.innerHTML = `
      <input data-c-nombre="${i}" value="${esc(c.nombre)}" placeholder="Nombre">
      <input data-c-tractor="${i}" value="${esc(c.tractor)}" placeholder="Tractora">
      <input data-c-remolque="${i}" value="${esc(c.remolque)}" placeholder="Remolque">
      <button class="mini rojo" data-c-quitar="${i}">Quitar</button>`;
    cont.appendChild(div);
  });
  cont.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
    const i = +(inp.dataset.cNombre || inp.dataset.cTractor || inp.dataset.cRemolque);
    const campo = inp.dataset.cNombre !== undefined ? 'nombre'
      : inp.dataset.cTractor !== undefined ? 'tractor' : 'remolque';
    estado.ajustes.conjuntos[i][campo] = inp.value;
  }));
  cont.querySelectorAll('button[data-c-quitar]').forEach(b => b.addEventListener('click', () => {
    estado.ajustes.conjuntos.splice(+b.dataset.cQuitar, 1);
    if (!estado.ajustes.conjuntos.length) estado.ajustes.conjuntos = [{ nombre: 'Conjunto 1', tractor: '', remolque: '' }];
    pintarAjustes();
  }));
}

function guardarAjustesDesdeUI() {
  const a = estado.ajustes;
  a.token = $('#a-token').value.trim();
  a.repo = $('#a-repo').value.trim();
  a.conductor = $('#a-conductor').value.trim().toUpperCase();
  a.conductor_dni = $('#a-dni').value.trim().toUpperCase();
  a.cargador.nombre = $('#a-cargador').value.trim();
  a.cargador.nif = $('#a-cargador-nif').value.trim();
  a.cargador.domicilio = $('#a-cargador-dir').value.trim();
  a.observaciones = $('#a-observaciones').value.trim();
  a.caracter_transporte = $('#a-caracter').value.trim();
  guardarAjustes(a);
  alert('Guardado.');
  ir('inicio');
}

function exportarArchivo() {
  listarDocs().then(docs => {
    const out = docs.map(d => ({
      id: d.id, creado: d.creado, estado: d.estado, url: d.url, sha256: d.sha256,
      subido: !!d.subido, publicadoEn: d.publicadoEn || null, ultimaVerif: d.ultimaVerif || null,
      datos: d.datos
    }));
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'deca-archivo-' + fechaHoyInput() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  });
}

/* ═══════════════════════════════════════════ arranque ═══ */

/** Configuración por enlace de un solo uso: …/#config=<token>.
    Sirve para dejar el token en el teléfono sin teclearlo. */
function aplicarConfigDeURL() {
  const m = location.hash.match(/^#config=(github_pat_[A-Za-z0-9_]+)$/);
  if (!m) return;
  estado.ajustes.token = m[1];
  guardarAjustes(estado.ajustes);
  history.replaceState(null, '', location.pathname + location.search);
  const aviso = document.createElement('div');
  aviso.className = 'nota';
  aviso.textContent = '✅ Token de publicación guardado en este teléfono.';
  const ini = document.getElementById('pantalla-inicio');
  if (ini) ini.prepend(aviso);
}

function init() {
  estado.ajustes = cargarAjustes();
  aplicarConfigDeURL();

  $('#btn-nueva').addEventListener('click', () => $('#input-foto').click());
  $('#input-foto').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) procesarFoto(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-ver-historial').addEventListener('click', async () => { await pintarHistorial(); ir('historial'); });
  $('#btn-ver-ajustes').addEventListener('click', () => { pintarAjustes(); ir('ajustes'); });
  $$('.btn-volver').forEach(b => b.addEventListener('click', () => ir('inicio')));
  $('#btn-anadir-albaran').addEventListener('click', () => {
    estado.albaranes.push({ entrega: '', pedido: '', palets: '', kg_brutos: '', kg_netos: '' });
    pintarAlbaranes();
  });
  $('#sel-ruta').addEventListener('change', actualizarRutaVisible);
  $('#btn-generar').addEventListener('click', generarYPublicar);
  $('#btn-otra-foto').addEventListener('click', () => $('#input-foto').click());
  $('#btn-nueva-desde-resultado').addEventListener('click', () => ir('inicio'));
  $('#btn-compartir').addEventListener('click', () => { if (estado.ultimoDoc) compartirDoc(estado.ultimoDoc); });
  $('#btn-guardar-ajustes').addEventListener('click', guardarAjustesDesdeUI);
  $('#btn-anadir-conjunto').addEventListener('click', () => {
    estado.ajustes.conjuntos.push({
      nombre: 'Conjunto ' + (estado.ajustes.conjuntos.length + 1), tractor: '', remolque: ''
    });
    pintarAjustes();
  });
  $('#btn-exportar').addEventListener('click', exportarArchivo);
  $('#btn-poda').addEventListener('click', async () => {
    await podar();
    alert('Archivo depurado: se conservan 12 meses (más el mes en curso).');
  });

  podar().catch(() => {});

  // Al abrir la app y cada vez que vuelve a primer plano: revisar lo pendiente.
  programarVigilante();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      vigilanteEspera = 20000;
      comprobarPendientes().catch(() => {});
      if ($('#pantalla-historial').classList.contains('activa')) pintarHistorial();
    }
  });

  // Probar el QR tal y como lo verá el guardia: abre la URL pública del PDF.
  $('#btn-probar-qr').addEventListener('click', () => {
    const d = estado.ultimoDoc;
    if (d && d.url) window.open(d.url, '_blank');
  });

  // Avisos del teléfono cuando un documento pasa a publicado (opcional).
  const btnAviso = $('#btn-avisos');
  const pintarBotonAviso = () => {
    if (!('Notification' in window)) { btnAviso.style.display = 'none'; return; }
    const p = Notification.permission;
    btnAviso.textContent = p === 'granted' ? '🔔 Avisos activados (toca para desactivar)'
      : p === 'denied' ? '🔕 Avisos bloqueados en el navegador'
      : '🔔 Avisarme cuando se publique un documento';
    btnAviso.disabled = p === 'denied';
  };
  if ('Notification' in window) {
    pintarBotonAviso();
    btnAviso.addEventListener('click', async () => {
      if (Notification.permission === 'granted') {
        alert('Para desactivarlos: candado del navegador → Permisos → Notificaciones.');
        return;
      }
      await Notification.requestPermission();
      pintarBotonAviso();
    });
  } else {
    btnAviso.style.display = 'none';
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
