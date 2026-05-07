// ============================================================
//  COCHERA MANAGER — app.js
//  Firebase Realtime Database + Cloudinary (imágenes)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, push, onValue, remove, update
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ============================================================
//  🖼️ CONFIGURACIÓN CLOUDINARY
// ============================================================
const CLOUDINARY_CLOUD  = "dxqd2n0sj";
const CLOUDINARY_PRESET = "garage_preset";

// ============================================================
//  🔧 CONFIGURACIÓN FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyAL6rHw1I5UUXFiV1lAwBLsMdavIxfc8v0",
  authDomain:        "jpsoft-garage.firebaseapp.com",
  databaseURL:       "https://jpsoft-garage-default-rtdb.firebaseio.com",
  projectId:         "jpsoft-garage",
  storageBucket:     "jpsoft-garage.firebasestorage.app",
  messagingSenderId: "53748268483",
  appId:             "1:53748268483:web:8f0ecc612788a9adb5d176"
};

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ============================================================
//  ESTADO GLOBAL
// ============================================================
let vehiculos     = {};
let pagos         = {};   // { "YYYY-MM": { vehiculoId: { pagado, metodo, admin, monto, fecha } } }
let totalEspacios = 20;
let editandoId    = null;
let pendingFrente = null;
let pendingDorso  = null;

// Mes activo en la vista de pagos
let listaEspera   = {};   // { id: { nombre, wsp, notas, fecha } }
let esperaEditId  = null;
let mantenimiento = {};   // { id: { nombre, rubro, wsp, notas } }
let mantEditId    = null;
let gastos        = {};   // { "YYYY-MM": { id: { detalle, monto, categoria, notas } } }
let gastosEditId  = null;
let facturacion   = {};   // { id: { nombre, razon, condicion, cuit, dni, notas } }
let factEditId    = null;
let aumentos      = {};   // { "YYYY-MM": { activo, precioAuto, precioMoto, notas } }
let aumentosMesActivo = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`; })();
let gastosMesActivo = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`; })();

let mesActivo = (() => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
})();

// ============================================================
//  CLOUDINARY: SUBIR IMAGEN
// ============================================================
async function subirImagenCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) throw new Error("Error al subir imagen a Cloudinary");
  const data = await res.json();
  return data.secure_url;
}

// ============================================================
//  FIREBASE: ESCUCHAR CAMBIOS EN TIEMPO REAL
// ============================================================
function initFirebase() {
  onValue(ref(db, "vehiculos"), (snap) => {
    vehiculos = snap.val() || {};
    renderAll();
  });

  onValue(ref(db, "config/totalEspacios"), (snap) => {
    if (snap.val() !== null) {
      totalEspacios = snap.val();
      document.getElementById("esp-num").textContent = totalEspacios;
    }
    renderAll();
  });

  onValue(ref(db, "pagos"), (snap) => {
    pagos = snap.val() || {};
    renderPagos();
  });

  onValue(ref(db, "espera"), (snap) => {
    listaEspera = snap.val() || {};
    renderEspera();
  });

  onValue(ref(db, "mantenimiento"), (snap) => {
    mantenimiento = snap.val() || {};
    renderMantenimiento();
  });

  onValue(ref(db, "gastos"), (snap) => {
    gastos = snap.val() || {};
    renderGastos();
  });

  onValue(ref(db, "facturacion"), (snap) => {
    facturacion = snap.val() || {};
    renderFacturacion();
  });

  onValue(ref(db, "aumentos"), (snap) => {
    aumentos = snap.val() || {};
    renderAumentos();
  });
}

function saveTotalEspacios(n) {
  set(ref(db, "config/totalEspacios"), n);
}

// ============================================================
//  HELPERS
// ============================================================
const ICONOS = { auto: "🚗", moto: "🏍️", camioneta: "🚙", pickup: "🛻", otro: "🚌" };
const TIPOS  = { auto: "Auto", moto: "Moto", camioneta: "Camioneta / SUV", pickup: "Pickup", otro: "Otro" };

function iniciales(nombre) {
  return (nombre || "?").trim().split(/[\s,]+/).filter(Boolean)
    .map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function formatMonto(n) {
  if (!n && n !== 0) return "—";
  return "$ " + Number(n).toLocaleString("es-AR");
}

function ocupados() {
  return Object.values(vehiculos).map(v => Number(v.cochera));
}

function vehiculoPorCochera(n) {
  return Object.entries(vehiculos).find(([, v]) => Number(v.cochera) === n) || null;
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast" + (type ? " " + type : "");
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 2800);
}

// ============================================================
//  RENDER
// ============================================================
function renderAll() {
  renderStats();
  renderMapa();
  renderVehiculos();
  renderAlquileres();
  renderPagos();
  renderEspera();
  renderMantenimiento();
  renderGastos();
  renderFacturacion();
  renderAumentos();
}

const MESES_NOMBRES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function mesLabel(clave) {
  const [anio, mes] = clave.split("-");
  return `${MESES_NOMBRES[Number(mes) - 1]} ${anio}`;
}

function mesOffset(clave, offset) {
  const [anio, mes] = clave.split("-").map(Number);
  const d = new Date(anio, mes - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderStats() {
  const ocu = Object.keys(vehiculos).length;
  const lib = Math.max(0, totalEspacios - ocu);
  document.getElementById("mini-libres").textContent   = `${lib} libre${lib !== 1 ? "s" : ""}`;
  document.getElementById("mini-ocupados").textContent = `${ocu} ocupado${ocu !== 1 ? "s" : ""}`;
}

// ---- MAPA ----
function renderMapa() {
  const grid = document.getElementById("cocheras-grid");
  grid.innerHTML = "";

  for (let i = 1; i <= totalEspacios; i++) {
    const entrada = vehiculoPorCochera(i);
    const libre   = !entrada;
    const v       = entrada ? entrada[1] : null;
    const id      = entrada ? entrada[0] : null;

    const card = document.createElement("div");
    card.className = `cochera-card ${libre ? "libre" : "ocupado"}`;
    card.innerHTML = `
      <span class="cochera-num">${String(i).padStart(2, "0")}</span>
      <span class="cochera-label">${libre ? "Libre" : (v.nombre || "").split(/[\s,]+/)[0]}</span>
      <span class="cochera-tipo-pill ${libre ? "pill-libre" : "pill-" + (v.tipo || "otro")}">${libre ? "Libre" : (TIPOS[v.tipo] || v.tipo || "—")}</span>
    `;
    card.title = libre ? `Cochera ${i} — libre` : `${v.nombre} · ${v.patente || ""}`;
    card.addEventListener("click", () => {
      if (libre) abrirModal(null, i);
      else        abrirDetalle(id);
    });
    grid.appendChild(card);
  }
}

// ---- VEHÍCULOS ----
function renderVehiculos(filtroTexto = "", filtroTipo = "") {
  const grid = document.getElementById("vehiculos-grid");
  grid.innerHTML = "";

  const lista = Object.entries(vehiculos).filter(([, v]) => {
    const txt      = filtroTexto.toLowerCase();
    const matchTxt = !txt ||
      (v.nombre   || "").toLowerCase().includes(txt) ||
      (v.patente  || "").toLowerCase().includes(txt) ||
      (v.modelo   || "").toLowerCase().includes(txt) ||
      String(v.cochera).includes(txt);
    const matchTipo = !filtroTipo || v.tipo === filtroTipo;
    return matchTxt && matchTipo;
  }).sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  if (lista.length === 0) {
    grid.innerHTML = `<div class="v-empty">No se encontraron vehículos.</div>`;
    return;
  }

  lista.forEach(([id, v]) => {
    const card = document.createElement("div");
    card.className = "vehiculo-card";
    card.innerHTML = `
      <div class="vehiculo-card-header">
        <div class="v-avatar">${iniciales(v.nombre)}</div>
        <div>
          <div class="v-nombre">${v.nombre || "Sin nombre"}</div>
          <div class="v-tipo">${v.modelo || TIPOS[v.tipo] || "—"}</div>
        </div>
        <span class="v-cochera-badge">Nº ${v.cochera}</span>
      </div>
      <div class="v-details">
        <div class="v-detail-row">
          <span class="v-detail-key">Patente</span>
          <span class="v-patente">${v.patente || "—"}</span>
        </div>
        ${v.dni ? `<div class="v-detail-row"><span class="v-detail-key">DNI</span><span class="v-detail-val">${v.dni}</span></div>` : ""}
        ${v.domicilio ? `<div class="v-detail-row"><span class="v-detail-key">Domicilio</span><span class="v-detail-val">${v.domicilio}</span></div>` : ""}
        <div class="v-detail-row">
          <span class="v-detail-key">WhatsApp</span>
          <span class="v-detail-val">${v.wsp ? "+54 " + v.wsp : "—"}</span>
        </div>
        <div class="v-detail-row">
          <span class="v-detail-key">Alquiler</span>
          <span class="v-detail-val">${formatMonto(v.monto)}</span>
        </div>
        ${v.seguro ? `<div class="v-detail-row"><span class="v-detail-key">Seguro</span><span class="v-detail-val">${v.seguro}</span></div>` : ""}
        ${v.notas ? `<div class="v-detail-row"><span class="v-detail-key">Notas</span><span class="v-detail-val">${v.notas}</span></div>` : ""}
      </div>
    `;
    card.addEventListener("click", () => abrirDetalle(id));
    grid.appendChild(card);
  });
}

// ---- ALQUILERES ----
function renderAlquileres() {
  const list = document.getElementById("alquileres-list");
  list.innerHTML = "";

  const lista = Object.entries(vehiculos)
    .sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  let total = 0;
  lista.forEach(([id, v]) => {
    const monto = Number(v.monto) || 0;
    total += monto;

    const row = document.createElement("div");
    row.className = "alquiler-row";
    row.innerHTML = `
      <span class="alq-cochera">#${v.cochera}</span>
      <span class="alq-nombre">${v.nombre || "—"}</span>
      <span class="alq-monto">${formatMonto(v.monto)}</span>
      <input type="number" class="alq-input-monto" value="${monto || ""}" placeholder="$ nuevo monto" min="0" data-id="${id}" />
      <button class="alq-save-btn" data-id="${id}">Guardar</button>
    `;
    list.appendChild(row);
  });

  document.getElementById("alq-total").textContent = formatMonto(total);

  list.querySelectorAll(".alq-save-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id    = btn.dataset.id;
      const input = list.querySelector(`.alq-input-monto[data-id="${id}"]`);
      const val   = Number(input.value);
      if (isNaN(val) || val < 0) { showToast("Ingresá un monto válido", "error"); return; }
      update(ref(db, `vehiculos/${id}`), { monto: val });
      showToast("Monto actualizado ✓", "success");
    });
  });
}

// ============================================================
//  MODAL REGISTRO / EDICIÓN
// ============================================================
function poblarSelectCochera(cocheraActual = null) {
  const sel  = document.getElementById("f-cochera");
  const ocup = ocupados();
  sel.innerHTML = "";

  for (let i = 1; i <= totalEspacios; i++) {
    const estaOcup = ocup.includes(i);
    const esMia    = Number(cocheraActual) === i;
    if (!estaOcup || esMia) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Cochera ${i}`;
      if (esMia) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  if (sel.options.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No hay cocheras libres";
    opt.disabled = true;
    sel.appendChild(opt);
  }
}

function resetFotos(v = {}) {
  // Frente
  const wrapF = document.getElementById("preview-wrap-frente");
  const imgF  = document.getElementById("preview-frente");
  if (v.cedulaFrente) {
    imgF.src = v.cedulaFrente;
    wrapF.classList.remove("hidden");
  } else {
    imgF.src = "";
    wrapF.classList.add("hidden");
  }
  document.getElementById("f-cedula-frente").value = "";

  // Dorso
  const wrapD = document.getElementById("preview-wrap-dorso");
  const imgD  = document.getElementById("preview-dorso");
  if (v.cedulaDorso) {
    imgD.src = v.cedulaDorso;
    wrapD.classList.remove("hidden");
  } else {
    imgD.src = "";
    wrapD.classList.add("hidden");
  }
  document.getElementById("f-cedula-dorso").value = "";

  pendingFrente = null;
  pendingDorso  = null;
}

function abrirModal(id = null, cocheraPredef = null) {
  editandoId = id;
  document.getElementById("modal-titulo").textContent = id ? "Editar vehículo" : "Registrar vehículo";

  const v = id ? (vehiculos[id] || {}) : {};
  document.getElementById("f-nombre").value    = v.nombre    || "";
  document.getElementById("f-patente").value   = (v.patente  || "").toUpperCase();
  document.getElementById("f-tipo").value      = v.tipo      || "auto";
  document.getElementById("f-dni").value       = v.dni       || "";
  document.getElementById("f-domicilio").value = v.domicilio || "";
  document.getElementById("f-modelo").value    = v.modelo    || "";
  document.getElementById("f-seguro").value    = v.seguro    || "";
  document.getElementById("f-wsp").value       = v.wsp       || "";
  document.getElementById("f-monto").value     = v.monto     || "";
  document.getElementById("f-notas").value     = v.notas     || "";

  resetFotos(v);
  poblarSelectCochera(v.cochera || cocheraPredef);
  if (cocheraPredef && !id) document.getElementById("f-cochera").value = cocheraPredef;

  const btnEl = document.getElementById("btn-eliminar");
  id ? btnEl.classList.remove("hidden") : btnEl.classList.add("hidden");

  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("f-nombre").focus();
}

function cerrarModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  editandoId    = null;
  pendingFrente = null;
  pendingDorso  = null;
}

async function guardar() {
  const nombre  = document.getElementById("f-nombre").value.trim();
  const patente = document.getElementById("f-patente").value.trim().toUpperCase();
  const cochera = document.getElementById("f-cochera").value;

  if (!nombre)  { document.getElementById("f-nombre").focus();  showToast("Ingresá el nombre", "error"); return; }
  if (!patente) { document.getElementById("f-patente").focus(); showToast("Ingresá la patente", "error"); return; }
  if (!cochera) { showToast("Seleccioná una cochera", "error"); return; }

  // Conservar URLs existentes si no hay archivo nuevo
  const vActual = editandoId ? (vehiculos[editandoId] || {}) : {};

  const datos = {
    nombre,
    patente,
    cochera:      Number(cochera),
    tipo:         document.getElementById("f-tipo").value,
    dni:          document.getElementById("f-dni").value.trim(),
    domicilio:    document.getElementById("f-domicilio").value.trim(),
    modelo:       document.getElementById("f-modelo").value.trim(),
    seguro:       document.getElementById("f-seguro").value.trim(),
    wsp:          document.getElementById("f-wsp").value.trim(),
    monto:        Number(document.getElementById("f-monto").value) || 0,
    notas:        document.getElementById("f-notas").value.trim(),
    cedulaFrente: vActual.cedulaFrente || "",
    cedulaDorso:  vActual.cedulaDorso  || ""
  };

  // Subir fotos si hay archivos nuevos
  try {
    if (pendingFrente) {
      showToast("Subiendo frente de cédula…", "");
      datos.cedulaFrente = await subirImagenCloudinary(pendingFrente);
    }
    if (pendingDorso) {
      showToast("Subiendo dorso de cédula…", "");
      datos.cedulaDorso = await subirImagenCloudinary(pendingDorso);
    }
  } catch (e) {
    showToast("Error al subir fotos. Revisá Cloudinary.", "error");
    console.error(e);
    return;
  }

  try {
    if (editandoId) {
      await update(ref(db, `vehiculos/${editandoId}`), datos);
      showToast("Registro actualizado ✓", "success");
    } else {
      await push(ref(db, "vehiculos"), datos);
      showToast("Vehículo registrado ✓", "success");
    }
    cerrarModal();
  } catch (e) {
    showToast("Error al guardar. Revisá la conexión.", "error");
    console.error(e);
  }
}

async function eliminar() {
  if (!editandoId) return;
  if (!confirm("¿Eliminás este vehículo de la cochera?")) return;
  await remove(ref(db, `vehiculos/${editandoId}`));
  showToast("Registro eliminado", "");
  cerrarModal();
}

// ============================================================
//  MODAL DETALLE
// ============================================================
function abrirDetalle(id) {
  const v = vehiculos[id];
  if (!v) return;

  document.getElementById("detalle-titulo").textContent = `Cochera Nº ${v.cochera}`;

  const body = document.getElementById("detalle-body");
  body.innerHTML = `
    <div class="detalle-row"><span class="detalle-key">Nombre</span><span class="detalle-val">${v.nombre || "—"}</span></div>
    ${v.dni       ? `<div class="detalle-row"><span class="detalle-key">DNI</span><span class="detalle-val">${v.dni}</span></div>` : ""}
    ${v.domicilio ? `<div class="detalle-row"><span class="detalle-key">Domicilio</span><span class="detalle-val">${v.domicilio}</span></div>` : ""}
    <div class="detalle-row"><span class="detalle-key">Patente</span><span class="detalle-val"><span class="v-patente">${v.patente || "—"}</span></span></div>
    <div class="detalle-row"><span class="detalle-key">Vehículo</span><span class="detalle-val">${v.modelo || TIPOS[v.tipo] || "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">Seguro</span><span class="detalle-val">${v.seguro || "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">WhatsApp</span><span class="detalle-val">${v.wsp ? "+54 " + v.wsp : "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">Alquiler</span><span class="detalle-val">${formatMonto(v.monto)}</span></div>
    ${v.notas ? `<div class="detalle-row"><span class="detalle-key">Notas</span><span class="detalle-val">${v.notas}</span></div>` : ""}
    ${v.cedulaFrente || v.cedulaDorso ? `
      <div class="detalle-row" style="flex-direction:column;gap:8px">
        <span class="detalle-key" style="margin-bottom:2px">Cédula</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${v.cedulaFrente ? `<div style="text-align:center"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Frente</div><img src="${v.cedulaFrente}" class="detalle-tarjeta" style="max-width:160px" /></div>` : ""}
          ${v.cedulaDorso  ? `<div style="text-align:center"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Dorso</div><img src="${v.cedulaDorso}"  class="detalle-tarjeta" style="max-width:160px" /></div>` : ""}
        </div>
      </div>` : ""}
  `;

  const btnWsp = document.getElementById("detalle-wsp");
  if (v.wsp) {
    btnWsp.classList.remove("hidden");
    btnWsp.onclick = () => {
      const num = v.wsp.replace(/\D/g, "");
      window.open(`https://wa.me/54${num}`, "_blank");
    };
  } else {
    btnWsp.classList.add("hidden");
  }

  document.getElementById("detalle-editar").onclick = () => {
    cerrarDetalle();
    abrirModal(id);
  };

  document.getElementById("detalle-overlay").classList.remove("hidden");
}

function cerrarDetalle() {
  document.getElementById("detalle-overlay").classList.add("hidden");
  // Restaurar botones por si se usó para historial
  document.getElementById("detalle-editar").classList.remove("hidden");
  document.getElementById("detalle-wsp").classList.remove("hidden");
}

// ============================================================
//  AJUSTE GLOBAL DE ALQUILERES
// ============================================================
document.getElementById("btn-aplicar-ajuste").addEventListener("click", async () => {
  const tipo  = document.getElementById("ajuste-tipo").value;
  const valor = Number(document.getElementById("ajuste-valor").value);

  if (!valor || valor <= 0) { showToast("Ingresá un valor válido", "error"); return; }
  if (!confirm("¿Aplicar ajuste a TODOS los alquileres?")) return;

  const updates = {};
  Object.entries(vehiculos).forEach(([id, v]) => {
    const montoActual = Number(v.monto) || 0;
    const nuevoMonto  = tipo === "porcentaje"
      ? Math.round(montoActual * (1 + valor / 100))
      : valor;
    updates[`vehiculos/${id}/monto`] = nuevoMonto;
  });

  await update(ref(db), updates);
  showToast("Alquileres actualizados ✓", "success");
  document.getElementById("ajuste-valor").value = "";
});

// ============================================================
//  PAGOS
// ============================================================
function renderPagos() {
  // Etiqueta del mes
  document.getElementById("mes-label").textContent = mesLabel(mesActivo);

  const pagosMes = (pagos[mesActivo] || {});
  const lista = Object.entries(vehiculos)
    .sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  // Contadores resumen
  let pagados = 0, pendientes = 0;
  let jqEf = 0, jqTr = 0, fdEf = 0, fdTr = 0;

  lista.forEach(([vid, v]) => {
    const p = pagosMes[vid];
    if (p && p.pagado) {
      pagados++;
      const m = Number(p.monto) || 0;
      if (p.admin === "joaquin") { p.metodo === "transferencia" ? jqTr += m : jqEf += m; }
      else                       { p.metodo === "transferencia" ? fdTr += m : fdEf += m; }
    } else {
      pendientes++;
    }
  });

  document.getElementById("pill-pagados").textContent    = `${pagados} pagado${pagados !== 1 ? "s" : ""}`;
  document.getElementById("pill-pendientes").textContent = `${pendientes} pendiente${pendientes !== 1 ? "s" : ""}`;
  document.getElementById("jq-ef").textContent  = formatMonto(jqEf);
  document.getElementById("jq-tr").textContent  = formatMonto(jqTr);
  document.getElementById("jq-tot").textContent = formatMonto(jqEf + jqTr);
  document.getElementById("fd-ef").textContent  = formatMonto(fdEf);
  document.getElementById("fd-tr").textContent  = formatMonto(fdTr);
  document.getElementById("fd-tot").textContent = formatMonto(fdEf + fdTr);

  // Lista
  const list = document.getElementById("pagos-list");
  list.innerHTML = "";

  if (lista.length === 0) {
    list.innerHTML = `<div class="v-empty">No hay inquilinos registrados.</div>`;
    return;
  }

  lista.forEach(([vid, v]) => {
    const p       = pagosMes[vid] || {};
    const esPagado = !!p.pagado;
    const monto   = Number(v.monto) || 0;

    const row = document.createElement("div");
    row.className = `pago-row${esPagado ? " pagado" : ""}`;
    row.innerHTML = `
      <div class="pago-row-top">
        <span class="pago-num">${String(v.cochera).padStart(2,"0")}</span>
        <div class="pago-info">
          <div class="pago-nombre">${v.nombre || "—"}</div>
          <div class="pago-monto-label">${formatMonto(monto)}</div>
        </div>
      </div>
      <div class="pago-row-bottom">
        <div class="pago-toggle" title="Marcar como pagado">
          <div class="toggle-switch"></div>
          <span class="toggle-label">${esPagado ? "Pagado" : "Pendiente"}</span>
        </div>
        <select class="pago-select" id="met-${vid}" ${!esPagado ? "disabled" : ""}>
          <option value="efectivo"      ${p.metodo === "efectivo"      ? "selected" : ""}>💵 Efectivo</option>
          <option value="transferencia" ${p.metodo === "transferencia" ? "selected" : ""}>📲 Transferencia</option>
        </select>
        <select class="pago-select" id="adm-${vid}" ${!esPagado ? "disabled" : ""}>
          <option value="joaquin"  ${p.admin === "joaquin"  ? "selected" : ""}>Joaquín</option>
          <option value="federico" ${p.admin === "federico" ? "selected" : ""}>Federico</option>
        </select>
        <div class="pago-acciones">
          <button class="pago-historial-btn" title="Historial de pagos" data-vid="${vid}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          ${esPagado ? `<button class="pago-recibo-btn" title="Descargar recibo PDF" data-vid="${vid}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </button>` : ""}
        </div>
      </div>
    `;

    // Toggle pagado/pendiente
    const toggle = row.querySelector(".pago-toggle");
    toggle.addEventListener("click", async () => {
      const nuevoPagado = !esPagado;

      // Confirmar solo si se revierte de pagado a pendiente
      if (esPagado && !nuevoPagado) {
        const nombre = vehiculos[vid]?.nombre || "este inquilino";
        if (!confirm(`¿Querés marcar como pendiente el pago de ${nombre}?`)) return;
      }

      const metodo = row.querySelector(`#met-${vid}`).value || "efectivo";
      const admin  = row.querySelector(`#adm-${vid}`).value || "joaquin";
      const datos  = nuevoPagado
        ? { pagado: true, metodo, admin, monto, fecha: new Date().toISOString() }
        : { pagado: false, metodo: "", admin: "", monto: 0, fecha: "" };
      await set(ref(db, `pagos/${mesActivo}/${vid}`), datos);
    });

    // Cambio de método o admin (solo si pagado)
    const selMet = row.querySelector(`#met-${vid}`);
    const selAdm = row.querySelector(`#adm-${vid}`);
    const guardarSelects = async () => {
      if (!esPagado) return;
      await update(ref(db, `pagos/${mesActivo}/${vid}`), {
        metodo: selMet.value,
        admin:  selAdm.value
      });
    };
    selMet.addEventListener("change", guardarSelects);
    selAdm.addEventListener("change", guardarSelects);

    // Botón historial
    row.querySelector(".pago-historial-btn").addEventListener("click", () => {
      abrirHistorial(vid, v.nombre);
    });

    // Botón recibo PDF
    const btnRecibo = row.querySelector(".pago-recibo-btn");
    if (btnRecibo) {
      btnRecibo.addEventListener("click", (e) => {
        e.stopPropagation();
        generarReciboPDF(vid, v, p, mesActivo);
      });
    }

    list.appendChild(row);
  });
}

// Navegación de meses
document.getElementById("mes-prev").addEventListener("click", () => {
  mesActivo = mesOffset(mesActivo, -1);
  renderPagos();
});
document.getElementById("mes-next").addEventListener("click", () => {
  mesActivo = mesOffset(mesActivo, +1);
  renderPagos();
});

// ---- MODAL HISTORIAL ----
function abrirHistorial(vid, nombre) {
  // Reutilizamos el modal detalle para historial
  document.getElementById("detalle-titulo").textContent = `Historial — ${nombre || "Inquilino"}`;

  const body = document.getElementById("detalle-body");

  // Recopilar todos los meses con pago para este inquilino
  const historial = [];
  Object.entries(pagos).forEach(([mes, mesDatos]) => {
    const p = mesDatos[vid];
    if (p && p.pagado) historial.push({ mes, ...p });
  });

  historial.sort((a, b) => b.mes.localeCompare(a.mes)); // más reciente primero

  if (historial.length === 0) {
    body.innerHTML = `<div class="historial-empty">Sin pagos registrados aún.</div>`;
  } else {
    body.innerHTML = `<div class="historial-list">` +
      historial.map(h => `
        <div class="historial-item">
          <span class="historial-mes">${mesLabel(h.mes)}</span>
          <span class="historial-monto">${formatMonto(h.monto)}</span>
          <span class="historial-meta">
            ${h.metodo === "transferencia" ? "📲" : "💵"}
            ${h.admin === "joaquin" ? "Joaquín" : "Federico"}
          </span>
        </div>
      `).join("") +
    `</div>`;
  }

  // Ocultar botones de editar/wsp del modal detalle
  document.getElementById("detalle-editar").classList.add("hidden");
  document.getElementById("detalle-wsp").classList.add("hidden");

  document.getElementById("detalle-overlay").classList.remove("hidden");
}

// ============================================================
//  NAVEGACIÓN DE VISTAS
// ============================================================
const TITULOS = { mapa: "Cocheras", vehiculos: "Vehículos", alquileres: "Alquileres", pagos: "Pagos", espera: "Lista de espera", mantenimiento: "Mantenimiento", gastos: "Impuestos y Servicios", mensajes: "Mensajes", facturacion: "Facturación", aumentos: "Aumentos", backup: "Backup" };

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const view = item.dataset.view;
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    document.getElementById("topbar-title").textContent = TITULOS[view] || "";
    if (view === "mensajes") renderMensajesSelect();
    if (view === "aumentos") renderAumentos();
    closeSidebar();
  });
});

// ============================================================
//  SIDEBAR MOBILE
// ============================================================
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
}
document.getElementById("menu-btn").addEventListener("click", openSidebar);
document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
document.getElementById("sidebar-overlay").addEventListener("click", closeSidebar);

// ============================================================
//  CONTROL TOTAL ESPACIOS
// ============================================================
document.getElementById("esp-minus").addEventListener("click", () => {
  const ocu = Object.keys(vehiculos).length;
  if (totalEspacios <= ocu) { showToast("No podés reducir por debajo de los espacios ocupados", "error"); return; }
  if (totalEspacios <= 1)   return;
  totalEspacios--;
  document.getElementById("esp-num").textContent = totalEspacios;
  saveTotalEspacios(totalEspacios);
});

document.getElementById("esp-plus").addEventListener("click", () => {
  if (totalEspacios >= 99) return;
  totalEspacios++;
  document.getElementById("esp-num").textContent = totalEspacios;
  saveTotalEspacios(totalEspacios);
});

// ============================================================
//  BÚSQUEDA Y FILTRO
// ============================================================
document.getElementById("search-vehiculos").addEventListener("input", aplicarFiltros);
document.getElementById("filter-tipo").addEventListener("change", aplicarFiltros);

function aplicarFiltros() {
  renderVehiculos(
    document.getElementById("search-vehiculos").value,
    document.getElementById("filter-tipo").value
  );
}

// ============================================================
//  BOTONES MODALES
// ============================================================
document.getElementById("btn-nuevo").addEventListener("click",    () => abrirModal());
document.getElementById("btn-cancelar").addEventListener("click", cerrarModal);
document.getElementById("modal-close").addEventListener("click",  cerrarModal);
document.getElementById("btn-guardar").addEventListener("click",  guardar);
document.getElementById("btn-eliminar").addEventListener("click", eliminar);
document.getElementById("detalle-close").addEventListener("click", cerrarDetalle);

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) cerrarModal();
});
document.getElementById("detalle-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("detalle-overlay")) cerrarDetalle();
});

// ============================================================
//  MANEJO DE FOTOS — CÉDULA FRENTE Y DORSO
// ============================================================
function setupFileDrop(dropId, inputId, previewId, wrapId, removeId, lado) {
  const drop   = document.getElementById(dropId);
  const input  = document.getElementById(inputId);
  const img    = document.getElementById(previewId);
  const wrap   = document.getElementById(wrapId);
  const btnRem = document.getElementById(removeId);

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Solo se aceptan imágenes", "error");
      return;
    }
    if (lado === "frente") pendingFrente = file;
    else                   pendingDorso  = file;

    img.src = URL.createObjectURL(file);
    wrap.classList.remove("hidden");
  }

  input.addEventListener("change", () => handleFile(input.files[0]));

  drop.addEventListener("dragover",  (e) => { e.preventDefault(); drop.classList.add("dragover"); });
  drop.addEventListener("dragleave", ()  => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    handleFile(e.dataTransfer.files[0]);
  });

  btnRem.addEventListener("click", (e) => {
    e.stopPropagation();
    if (lado === "frente") {
      pendingFrente = null;
      if (editandoId && vehiculos[editandoId]) vehiculos[editandoId].cedulaFrente = "";
    } else {
      pendingDorso = null;
      if (editandoId && vehiculos[editandoId]) vehiculos[editandoId].cedulaDorso = "";
    }
    img.src = "";
    input.value = "";
    wrap.classList.add("hidden");
  });
}

setupFileDrop("file-drop-frente", "f-cedula-frente", "preview-frente", "preview-wrap-frente", "remove-frente", "frente");
setupFileDrop("file-drop-dorso",  "f-cedula-dorso",  "preview-dorso",  "preview-wrap-dorso",  "remove-dorso",  "dorso");

// ============================================================
//  INIT
// ============================================================
// initFirebase() se llama desde mostrarApp() tras autenticación exitosa

// ============================================================
//  AUTENTICACIÓN
// ============================================================

// Nombres para mostrar según email
const ADMIN_NOMBRES = {
  "joaquin@jpsoft-garage.com": "Joaquín",
  "federico@jpsoft-garage.com": "Federico"
};

function mostrarApp(user) {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-wrapper").classList.remove("hidden");
  // Mostrar nombre del usuario logueado en el topbar
  const nombre = ADMIN_NOMBRES[user.email] || user.email;
  document.getElementById("user-nombre").textContent = nombre;
  // Iniciar datos solo cuando hay sesión
  initFirebase();
}

function mostrarLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-wrapper").classList.add("hidden");
}

// Observar estado de sesión
onAuthStateChanged(auth, (user) => {
  if (user) {
    mostrarApp(user);
  } else {
    mostrarLogin();
  }
});

// Formulario de login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btnLogin = document.getElementById("btn-login");
  const errorEl  = document.getElementById("login-error");

  errorEl.textContent = "";
  btnLogin.textContent = "Ingresando…";
  btnLogin.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged dispara mostrarApp automáticamente
  } catch (err) {
    let msg = "Error al ingresar. Revisá tus datos.";
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
      msg = "Email o contraseña incorrectos.";
    } else if (err.code === "auth/too-many-requests") {
      msg = "Demasiados intentos. Intentá más tarde.";
    }
    errorEl.textContent = msg;
    btnLogin.textContent = "Ingresar";
    btnLogin.disabled = false;
  }
});

// Botón cerrar sesión
document.getElementById("btn-logout").addEventListener("click", async () => {
  if (!confirm("¿Cerrar sesión?")) return;
  await signOut(auth);
});

// ============================================================
//  LISTA DE ESPERA
// ============================================================
function formatFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderEspera() {
  const lista = Object.entries(listaEspera)
    .sort((a, b) => (a[1].fecha || "").localeCompare(b[1].fecha || ""));

  document.getElementById("espera-total").textContent =
    `${lista.length} en espera`;

  const list = document.getElementById("espera-list");
  if (!list) return;
  list.innerHTML = "";

  if (lista.length === 0) {
    list.innerHTML = `<div class="espera-empty">La lista de espera está vacía.</div>`;
    return;
  }

  lista.forEach(([id, p], idx) => {
    const card = document.createElement("div");
    card.className = "espera-card";
    card.innerHTML = `
      <div class="espera-pos">${idx + 1}</div>
      <div class="espera-info">
        <div class="espera-nombre">${p.nombre || "—"}</div>
        <div class="espera-detalle">${p.wsp ? "+54 " + p.wsp : "Sin WhatsApp"}${p.notas ? " · " + p.notas : ""}</div>
      </div>
      <span class="espera-fecha">${formatFecha(p.fecha)}</span>
      <button class="espera-wsp-btn ${!p.wsp ? "hidden" : ""}" title="Enviar WhatsApp" data-wsp="${p.wsp || ""}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.31A9.954 9.954 0 0 0 11.99 22C17.522 22 22 17.523 22 12S17.522 2 11.99 2zm.01 18.181a8.17 8.17 0 0 1-4.165-1.138l-.299-.177-3.093.812.825-3.02-.194-.31A8.185 8.185 0 0 1 3.818 12C3.818 7.479 7.48 3.818 12 3.818c4.522 0 8.182 3.661 8.182 8.182 0 4.522-3.66 8.181-8.182 8.181z"/></svg>
      </button>
    `;

    // Click en la card → editar (excepto si clickeó el botón WSP)
    card.addEventListener("click", (e) => {
      if (e.target.closest(".espera-wsp-btn")) return;
      abrirEsperaModal(id);
    });

    // Botón WhatsApp
    const btnWsp = card.querySelector(".espera-wsp-btn");
    if (btnWsp) {
      btnWsp.addEventListener("click", (e) => {
        e.stopPropagation();
        const num = p.wsp.replace(/\D/g, "");
        window.open(`https://wa.me/54${num}`, "_blank");
      });
    }

    list.appendChild(card);
  });
}

function abrirEsperaModal(id = null) {
  esperaEditId = id;
  const p = id ? (listaEspera[id] || {}) : {};
  document.getElementById("espera-modal-titulo").textContent = id ? "Editar persona" : "Agregar a lista de espera";
  document.getElementById("esp-nombre").value = p.nombre || "";
  document.getElementById("esp-wsp").value    = p.wsp    || "";
  document.getElementById("esp-notas").value  = p.notas  || "";

  const btnEl = document.getElementById("esp-btn-eliminar");
  id ? btnEl.classList.remove("hidden") : btnEl.classList.add("hidden");

  document.getElementById("espera-modal-overlay").classList.remove("hidden");
  document.getElementById("esp-nombre").focus();
}

function cerrarEsperaModal() {
  document.getElementById("espera-modal-overlay").classList.add("hidden");
  esperaEditId = null;
}

async function guardarEspera() {
  const nombre = document.getElementById("esp-nombre").value.trim();
  if (!nombre) { document.getElementById("esp-nombre").focus(); showToast("Ingresá el nombre", "error"); return; }

  const datos = {
    nombre,
    wsp:   document.getElementById("esp-wsp").value.trim(),
    notas: document.getElementById("esp-notas").value.trim(),
    fecha: esperaEditId ? (listaEspera[esperaEditId]?.fecha || new Date().toISOString()) : new Date().toISOString()
  };

  try {
    if (esperaEditId) {
      await update(ref(db, `espera/${esperaEditId}`), datos);
      showToast("Registro actualizado ✓", "success");
    } else {
      await push(ref(db, "espera"), datos);
      showToast("Persona agregada a la lista ✓", "success");
    }
    cerrarEsperaModal();
  } catch (e) {
    showToast("Error al guardar", "error");
    console.error(e);
  }
}

async function eliminarEspera() {
  if (!esperaEditId) return;
  if (!confirm("¿Eliminás esta persona de la lista de espera?")) return;
  await remove(ref(db, `espera/${esperaEditId}`));
  showToast("Persona eliminada de la lista", "");
  cerrarEsperaModal();
}

// Botones del modal espera
document.getElementById("btn-nuevo-espera").addEventListener("click",   () => abrirEsperaModal());
document.getElementById("esp-btn-guardar").addEventListener("click",    guardarEspera);
document.getElementById("esp-btn-eliminar").addEventListener("click",   eliminarEspera);
document.getElementById("esp-btn-cancelar").addEventListener("click",   cerrarEsperaModal);
document.getElementById("espera-modal-close").addEventListener("click", cerrarEsperaModal);
document.getElementById("espera-modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("espera-modal-overlay")) cerrarEsperaModal();
});
// ============================================================
//  MANTENIMIENTO
// ============================================================
function renderMantenimiento() {
  const lista = Object.entries(mantenimiento)
    .sort((a, b) => (a[1].nombre || "").localeCompare(b[1].nombre || ""));

  document.getElementById("mant-total").textContent =
    `${lista.length} contacto${lista.length !== 1 ? "s" : ""}`;

  const list = document.getElementById("mant-list");
  if (!list) return;
  list.innerHTML = "";

  if (lista.length === 0) {
    list.innerHTML = `<div class="espera-empty">No hay contactos de mantenimiento todavía.</div>`;
    return;
  }

  lista.forEach(([id, p]) => {
    const card = document.createElement("div");
    card.className = "espera-card";
    card.innerHTML = `
      <div class="espera-pos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      </div>
      <div class="espera-info">
        <div class="espera-nombre">${p.nombre || "—"}</div>
        <span class="mant-rubro">${p.rubro || "—"}</span>
        ${p.notas ? `<div class="espera-detalle" style="margin-top:3px">${p.notas}</div>` : ""}
      </div>
      <span class="espera-fecha">${p.wsp ? "+54 " + p.wsp : ""}</span>
      <button class="espera-wsp-btn ${!p.wsp ? "hidden" : ""}" title="Enviar WhatsApp">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.31A9.954 9.954 0 0 0 11.99 22C17.522 22 22 17.523 22 12S17.522 2 11.99 2zm.01 18.181a8.17 8.17 0 0 1-4.165-1.138l-.299-.177-3.093.812.825-3.02-.194-.31A8.185 8.185 0 0 1 3.818 12C3.818 7.479 7.48 3.818 12 3.818c4.522 0 8.182 3.661 8.182 8.182 0 4.522-3.66 8.181-8.182 8.181z"/></svg>
      </button>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".espera-wsp-btn")) return;
      abrirMantModal(id);
    });

    const btnWsp = card.querySelector(".espera-wsp-btn");
    if (btnWsp && p.wsp) {
      btnWsp.addEventListener("click", (e) => {
        e.stopPropagation();
        const num = p.wsp.replace(/\D/g, "");
        window.open(`https://wa.me/54${num}`, "_blank");
      });
    }

    list.appendChild(card);
  });
}

function abrirMantModal(id = null) {
  mantEditId = id;
  const p = id ? (mantenimiento[id] || {}) : {};
  document.getElementById("mant-modal-titulo").textContent = id ? "Editar contacto" : "Agregar contacto";
  document.getElementById("mant-nombre").value = p.nombre || "";
  document.getElementById("mant-rubro").value  = p.rubro  || "";
  document.getElementById("mant-wsp").value    = p.wsp    || "";
  document.getElementById("mant-notas").value  = p.notas  || "";

  const btnEl = document.getElementById("mant-btn-eliminar");
  id ? btnEl.classList.remove("hidden") : btnEl.classList.add("hidden");

  document.getElementById("mant-modal-overlay").classList.remove("hidden");
  document.getElementById("mant-nombre").focus();
}

function cerrarMantModal() {
  document.getElementById("mant-modal-overlay").classList.add("hidden");
  mantEditId = null;
}

async function guardarMant() {
  const nombre = document.getElementById("mant-nombre").value.trim();
  const rubro  = document.getElementById("mant-rubro").value.trim();
  if (!nombre) { document.getElementById("mant-nombre").focus(); showToast("Ingresá el nombre", "error"); return; }
  if (!rubro)  { document.getElementById("mant-rubro").focus();  showToast("Ingresá el rubro", "error"); return; }

  const datos = {
    nombre,
    rubro,
    wsp:   document.getElementById("mant-wsp").value.trim(),
    notas: document.getElementById("mant-notas").value.trim()
  };

  try {
    if (mantEditId) {
      await update(ref(db, `mantenimiento/${mantEditId}`), datos);
      showToast("Contacto actualizado ✓", "success");
    } else {
      await push(ref(db, "mantenimiento"), datos);
      showToast("Contacto agregado ✓", "success");
    }
    cerrarMantModal();
  } catch (e) {
    showToast("Error al guardar", "error");
    console.error(e);
  }
}

async function eliminarMant() {
  if (!mantEditId) return;
  if (!confirm("¿Eliminás este contacto?")) return;
  await remove(ref(db, `mantenimiento/${mantEditId}`));
  showToast("Contacto eliminado", "");
  cerrarMantModal();
}

document.getElementById("btn-nuevo-mant").addEventListener("click",    () => abrirMantModal());
document.getElementById("mant-btn-guardar").addEventListener("click",  guardarMant);
document.getElementById("mant-btn-eliminar").addEventListener("click", eliminarMant);
document.getElementById("mant-btn-cancelar").addEventListener("click", cerrarMantModal);
document.getElementById("mant-modal-close").addEventListener("click",  cerrarMantModal);
document.getElementById("mant-modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("mant-modal-overlay")) cerrarMantModal();
});

// ============================================================
//  BACKUP — EXPORTAR / IMPORTAR
// ============================================================

// Clave para guardar fecha del último backup en localStorage
const BACKUP_KEY = "jpsoft_garage_last_backup";

function getLastBackup() {
  return localStorage.getItem(BACKUP_KEY) || null;
}

function setLastBackup() {
  const now = new Date().toISOString();
  localStorage.setItem(BACKUP_KEY, now);
  renderBackupStatus();
}

function renderBackupStatus() {
  const last   = getLastBackup();
  const lastEl = document.getElementById("backup-last-export");
  const alertEl = document.getElementById("backup-alert-mes");
  if (!lastEl) return;

  if (!last) {
    lastEl.textContent = "Último backup: nunca";
    alertEl.classList.remove("hidden");
    return;
  }

  const lastDate = new Date(last);
  const now      = new Date();
  const diasDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
  const fechaStr = lastDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  lastEl.textContent = `Último backup: ${fechaStr} (hace ${diasDiff} día${diasDiff !== 1 ? "s" : ""})`;

  if (diasDiff >= 30) {
    alertEl.classList.remove("hidden");
  } else {
    alertEl.classList.add("hidden");
  }
}

// ---- EXPORTAR JSON ----
function exportarJSON() {
  const datos = { vehiculos, pagos, espera: listaEspera, mantenimiento, gastos, facturacion, aumentos, config: { totalEspacios } };
  const json  = JSON.stringify(datos, null, 2);
  const blob  = new Blob([json], { type: "application/json" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `jpsoft-garage-backup-${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setLastBackup();
  showToast("Backup JSON descargado ✓", "success");
}

// ---- EXPORTAR EXCEL ----
async function exportarExcel() {
  // Cargamos SheetJS dinámicamente
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const wb = XLSX.utils.book_new();
  const fecha = new Date().toLocaleDateString("es-AR");

  // ---- Hoja 1: Vehículos ----
  const vRows = Object.values(vehiculos).sort((a,b) => a.cochera - b.cochera).map(v => ({
    "Cochera Nº":    v.cochera || "",
    "Apellido y Nombre": v.nombre || "",
    "DNI":           v.dni || "",
    "Domicilio":     v.domicilio || "",
    "Patente":       v.patente || "",
    "Tipo":          TIPOS[v.tipo] || v.tipo || "",
    "Marca y Modelo": v.modelo || "",
    "Seguro":        v.seguro || "",
    "WhatsApp":      v.wsp ? "+54 " + v.wsp : "",
    "Alquiler ($)":  v.monto || 0,
    "Notas":         v.notas || ""
  }));
  const wsV = XLSX.utils.json_to_sheet(vRows);
  XLSX.utils.book_append_sheet(wb, wsV, "Vehículos");

  // ---- Hoja 2: Pagos (todos los meses) ----
  const pagosRows = [];
  Object.entries(pagos).sort().forEach(([mes, mesDatos]) => {
    Object.entries(mesDatos).forEach(([vid, p]) => {
      const v = vehiculos[vid] || {};
      pagosRows.push({
        "Mes":           mesLabel(mes),
        "Cochera Nº":    v.cochera || "",
        "Inquilino":     v.nombre || vid,
        "Pagado":        p.pagado ? "Sí" : "No",
        "Método":        p.metodo === "transferencia" ? "Transferencia" : "Efectivo",
        "Cobró":         p.admin === "joaquin" ? "Joaquín" : "Federico",
        "Monto ($)":     p.monto || 0,
        "Fecha pago":    p.fecha ? new Date(p.fecha).toLocaleDateString("es-AR") : ""
      });
    });
  });
  const wsP = XLSX.utils.json_to_sheet(pagosRows);
  XLSX.utils.book_append_sheet(wb, wsP, "Pagos");

  // ---- Hoja 3: Lista de espera ----
  const esperaRows = Object.values(listaEspera)
    .sort((a,b) => (a.fecha||"").localeCompare(b.fecha||""))
    .map((p, i) => ({
      "Posición":      i + 1,
      "Apellido y Nombre": p.nombre || "",
      "WhatsApp":      p.wsp ? "+54 " + p.wsp : "",
      "Notas":         p.notas || "",
      "Fecha ingreso": p.fecha ? new Date(p.fecha).toLocaleDateString("es-AR") : ""
    }));
  const wsE = XLSX.utils.json_to_sheet(esperaRows);
  XLSX.utils.book_append_sheet(wb, wsE, "Lista de espera");

  // ---- Hoja 4: Mantenimiento ----
  const mantRows = Object.values(mantenimiento)
    .sort((a,b) => (a.nombre||"").localeCompare(b.nombre||""))
    .map(p => ({
      "Apellido y Nombre": p.nombre || "",
      "Rubro":         p.rubro || "",
      "WhatsApp":      p.wsp ? "+54 " + p.wsp : "",
      "Notas":         p.notas || ""
    }));
  const wsM = XLSX.utils.json_to_sheet(mantRows);
  XLSX.utils.book_append_sheet(wb, wsM, "Mantenimiento");

  // ---- Hoja 5: Impuestos y Servicios ----
  const gastosRows = [];
  Object.entries(gastos).sort().forEach(([mes, mesDatos]) => {
    Object.values(mesDatos).forEach(g => {
      gastosRows.push({
        "Mes":        mesLabel(mes),
        "Detalle":    g.detalle || "",
        "Categoría":  (GASTO_CATEGORIAS[g.categoria] || GASTO_CATEGORIAS.otro).label,
        "Monto ($)":  g.monto || 0,
        "Notas":      g.notas || ""
      });
    });
  });
  const wsG = XLSX.utils.json_to_sheet(gastosRows);
  XLSX.utils.book_append_sheet(wb, wsG, "Impuestos y Servicios");

  // ---- Hoja 6: Facturación ----
  const factRows = Object.values(facturacion)
    .sort((a,b) => (a.nombre||"").localeCompare(b.nombre||""))
    .map(p => ({
      "Apellido y Nombre": p.nombre || "",
      "Razón Social":      p.razon  || "",
      "Condición Fiscal":  (CONDICIONES[p.condicion] || {label: p.condicion}).label || "",
      "CUIT/CUIL":         p.cuit   || "",
      "DNI":               p.dni    || "",
      "Notas":             p.notas  || ""
    }));
  const wsF = XLSX.utils.json_to_sheet(factRows);
  XLSX.utils.book_append_sheet(wb, wsF, "Facturación");

  // ---- Hoja 7: Aumentos ----
  const aumentosRows = Object.entries(aumentos)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([mes, d]) => ({
      "Mes":             mesLabel(mes),
      "Aumento":         d.activo ? "Sí" : "No",
      "Precio Auto ($)": d.precioAuto || 0,
      "Precio Moto ($)": d.precioMoto || 0,
      "Notas":           d.notas || ""
    }));
  const wsAu = XLSX.utils.json_to_sheet(aumentosRows);
  XLSX.utils.book_append_sheet(wb, wsAu, "Aumentos");

  // ---- Hoja 8: Config ----
  const wsC = XLSX.utils.json_to_sheet([{ "Total de espacios": totalEspacios, "Exportado el": fecha }]);
  XLSX.utils.book_append_sheet(wb, wsC, "Config");

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `jpsoft-garage-backup-${fechaArchivo}.xlsx`);
  setLastBackup();
  showToast("Backup Excel descargado ✓", "success");
}

// ---- IMPORTAR JSON ----
async function importarJSON(file) {
  if (!confirm("⚠️ Esto reemplaza TODOS los datos actuales con los del archivo. ¿Continuás?")) return;
  try {
    const texto = await file.text();
    const datos = JSON.parse(texto);

    const updates = {};
    if (datos.vehiculos)    updates["vehiculos"]           = datos.vehiculos;
    if (datos.pagos)        updates["pagos"]               = datos.pagos;
    if (datos.espera)       updates["espera"]              = datos.espera;
    if (datos.mantenimiento) updates["mantenimiento"]      = datos.mantenimiento;
    if (datos.gastos)       updates["gastos"]              = datos.gastos;
    if (datos.facturacion)  updates["facturacion"]         = datos.facturacion;
    if (datos.aumentos)     updates["aumentos"]            = datos.aumentos;
    if (datos.config?.totalEspacios) updates["config/totalEspacios"] = datos.config.totalEspacios;

    await set(ref(db), updates);
    showToast("Datos restaurados desde JSON ✓", "success");
  } catch (e) {
    showToast("Error al leer el archivo JSON", "error");
    console.error(e);
  }
}

// ---- IMPORTAR EXCEL ----
async function importarExcel(file) {
  if (!confirm("⚠️ Esto reemplaza TODOS los datos actuales con los del archivo. ¿Continuás?")) return;

  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  try {
    const buffer = await file.arrayBuffer();
    const wb     = XLSX.read(buffer, { type: "array" });

    // Parsear vehículos
    const wsV = wb.Sheets["Vehículos"];
    const newVehiculos = {};
    if (wsV) {
      XLSX.utils.sheet_to_json(wsV).forEach(row => {
        const id = "imp_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
        newVehiculos[id] = {
          cochera:   Number(row["Cochera Nº"]) || 0,
          nombre:    row["Apellido y Nombre"] || "",
          dni:       row["DNI"] || "",
          domicilio: row["Domicilio"] || "",
          patente:   row["Patente"] || "",
          tipo:      Object.entries(TIPOS).find(([,v]) => v === row["Tipo"])?.[0] || "auto",
          modelo:    row["Marca y Modelo"] || "",
          seguro:    row["Seguro"] || "",
          wsp:       (row["WhatsApp"] || "").replace("+54 ", "").trim(),
          monto:     Number(row["Alquiler ($)"]) || 0,
          notas:     row["Notas"] || "",
          cedulaFrente: "",
          cedulaDorso:  ""
        };
      });
    }

    // Parsear espera
    const wsE = wb.Sheets["Lista de espera"];
    const newEspera = {};
    if (wsE) {
      XLSX.utils.sheet_to_json(wsE).forEach(row => {
        const id = "imp_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
        newEspera[id] = {
          nombre: row["Apellido y Nombre"] || "",
          wsp:    (row["WhatsApp"] || "").replace("+54 ", "").trim(),
          notas:  row["Notas"] || "",
          fecha:  new Date().toISOString()
        };
      });
    }

    // Parsear mantenimiento
    const wsM = wb.Sheets["Mantenimiento"];
    const newMant = {};
    if (wsM) {
      XLSX.utils.sheet_to_json(wsM).forEach(row => {
        const id = "imp_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
        newMant[id] = {
          nombre: row["Apellido y Nombre"] || "",
          rubro:  row["Rubro"] || "",
          wsp:    (row["WhatsApp"] || "").replace("+54 ", "").trim(),
          notas:  row["Notas"] || ""
        };
      });
    }

    // Parsear config
    // Parsear gastos
    const wsG = wb.Sheets["Impuestos y Servicios"];
    const newGastos = {};
    if (wsG) {
      XLSX.utils.sheet_to_json(wsG).forEach(row => {
        const mes = Object.entries(MESES_NOMBRES).reduce((found, [i, nombre]) => {
          if (row["Mes"] && row["Mes"].startsWith(nombre)) return String(Number(i)+1).padStart(2,"0");
          return found;
        }, null);
        const anio = row["Mes"] ? row["Mes"].split(" ")[1] : new Date().getFullYear();
        if (mes && anio) {
          const clave = `${anio}-${mes}`;
          if (!newGastos[clave]) newGastos[clave] = {};
          const id = "imp_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
          const catEntry = Object.entries(GASTO_CATEGORIAS).find(([,v]) => v.label === row["Categoría"]);
          newGastos[clave][id] = {
            detalle:   row["Detalle"] || "",
            monto:     Number(row["Monto ($)"]) || 0,
            categoria: catEntry ? catEntry[0] : "otro",
            notas:     row["Notas"] || ""
          };
        }
      });
    }

    const wsC = wb.Sheets["Config"];
    let newTotal = totalEspacios;
    if (wsC) {
      const configRows = XLSX.utils.sheet_to_json(wsC);
      if (configRows[0]?.["Total de espacios"]) newTotal = Number(configRows[0]["Total de espacios"]);
    }

    const updates = {
      vehiculos:     newVehiculos,
      espera:        newEspera,
      mantenimiento: newMant,
      gastos:        newGastos,
      "config/totalEspacios": newTotal
    };

    await set(ref(db), updates);
    showToast("Datos restaurados desde Excel ✓", "success");
  } catch (e) {
    showToast("Error al leer el archivo Excel", "error");
    console.error(e);
  }
}

// ---- EVENT LISTENERS BACKUP ----
document.getElementById("btn-export-json").addEventListener("click", exportarJSON);
document.getElementById("btn-export-excel").addEventListener("click", exportarExcel);

document.getElementById("input-import-json").addEventListener("change", (e) => {
  if (e.target.files[0]) importarJSON(e.target.files[0]);
  e.target.value = "";
});

document.getElementById("input-import-excel").addEventListener("change", (e) => {
  if (e.target.files[0]) importarExcel(e.target.files[0]);
  e.target.value = "";
});

// Mostrar estado al entrar a la vista backup
document.querySelectorAll(".nav-item").forEach(item => {
  if (item.dataset.view === "backup") {
    item.addEventListener("click", () => setTimeout(renderBackupStatus, 50));
  }
});

// Chequear al cargar si hace más de 30 días
window.addEventListener("load", () => {
  const last = getLastBackup();
  if (last) {
    const dias = Math.floor((new Date() - new Date(last)) / (1000 * 60 * 60 * 24));
    if (dias >= 30) showToast("⚠️ Hace más de 30 días sin backup. Entrá a la sección Backup.", "");
  } else {
    showToast("⚠️ No tenés ningún backup guardado. Considerá exportar uno.", "");
  }
});

// ============================================================
//  IMPUESTOS Y SERVICIOS
// ============================================================
const GASTO_CATEGORIAS = {
  servicio:      { label: "Servicio",        icon: "💡" },
  impuesto:      { label: "Impuesto / Tasa", icon: "🏛️" },
  seguro:        { label: "Seguro",          icon: "🛡️" },
  mantenimiento: { label: "Mantenimiento",   icon: "🔧" },
  otro:          { label: "Otro",            icon: "📋" }
};

function renderGastos() {
  const labelEl = document.getElementById("gastos-mes-label");
  if (labelEl) labelEl.textContent = mesLabel(gastosMesActivo);

  const mesDatos = gastos[gastosMesActivo] || {};
  const lista    = Object.entries(mesDatos)
    .sort((a, b) => (a[1].detalle || "").localeCompare(b[1].detalle || ""));

  // Total
  const total = lista.reduce((sum, [, g]) => sum + (Number(g.monto) || 0), 0);
  const totalEl = document.getElementById("gastos-total");
  if (totalEl) totalEl.textContent = formatMonto(total);

  const list = document.getElementById("gastos-list");
  if (!list) return;
  list.innerHTML = "";

  if (lista.length === 0) {
    list.innerHTML = `<div class="gastos-empty">No hay gastos registrados para este mes.</div>`;
    return;
  }

  lista.forEach(([id, g]) => {
    const cat  = GASTO_CATEGORIAS[g.categoria] || GASTO_CATEGORIAS.otro;
    const card = document.createElement("div");
    card.className = "gasto-card";
    card.innerHTML = `
      <div class="gasto-cat-icon" title="${cat.label}">${cat.icon}</div>
      <div class="gasto-info">
        <div class="gasto-detalle">${g.detalle || "—"}</div>
        <div class="gasto-cat-label">${cat.label}</div>
      </div>
      <span class="gasto-notas-txt">${g.notas || ""}</span>
      <span class="gasto-monto">${formatMonto(g.monto)}</span>
    `;
    card.addEventListener("click", () => abrirGastoModal(id));
    list.appendChild(card);
  });
}

// Navegación de meses
document.getElementById("gastos-mes-prev").addEventListener("click", () => {
  gastosMesActivo = mesOffset(gastosMesActivo, -1);
  renderGastos();
});
document.getElementById("gastos-mes-next").addEventListener("click", () => {
  gastosMesActivo = mesOffset(gastosMesActivo, +1);
  renderGastos();
});

function abrirGastoModal(id = null) {
  gastosEditId = id;
  const g = id ? ((gastos[gastosMesActivo] || {})[id] || {}) : {};
  document.getElementById("gastos-modal-titulo").textContent = id ? "Editar gasto" : "Agregar gasto";
  document.getElementById("gasto-detalle").value   = g.detalle   || "";
  document.getElementById("gasto-monto").value     = g.monto     || "";
  document.getElementById("gasto-categoria").value = g.categoria || "servicio";
  document.getElementById("gasto-notas").value     = g.notas     || "";

  const btnEl = document.getElementById("gasto-btn-eliminar");
  id ? btnEl.classList.remove("hidden") : btnEl.classList.add("hidden");

  document.getElementById("gastos-modal-overlay").classList.remove("hidden");
  document.getElementById("gasto-detalle").focus();
}

function cerrarGastoModal() {
  document.getElementById("gastos-modal-overlay").classList.add("hidden");
  gastosEditId = null;
}

async function guardarGasto() {
  const detalle = document.getElementById("gasto-detalle").value.trim();
  const monto   = Number(document.getElementById("gasto-monto").value);
  if (!detalle) { document.getElementById("gasto-detalle").focus(); showToast("Ingresá el detalle", "error"); return; }
  if (!monto || monto <= 0) { document.getElementById("gasto-monto").focus(); showToast("Ingresá un monto válido", "error"); return; }

  const datos = {
    detalle,
    monto,
    categoria: document.getElementById("gasto-categoria").value,
    notas:     document.getElementById("gasto-notas").value.trim()
  };

  try {
    if (gastosEditId) {
      await update(ref(db, `gastos/${gastosMesActivo}/${gastosEditId}`), datos);
      showToast("Gasto actualizado ✓", "success");
    } else {
      await push(ref(db, `gastos/${gastosMesActivo}`), datos);
      showToast("Gasto agregado ✓", "success");
    }
    cerrarGastoModal();
  } catch (e) {
    showToast("Error al guardar", "error");
    console.error(e);
  }
}

async function eliminarGasto() {
  if (!gastosEditId) return;
  if (!confirm("¿Eliminás este gasto?")) return;
  await remove(ref(db, `gastos/${gastosMesActivo}/${gastosEditId}`));
  showToast("Gasto eliminado", "");
  cerrarGastoModal();
}

document.getElementById("btn-nuevo-gasto").addEventListener("click",      () => abrirGastoModal());
document.getElementById("gasto-btn-guardar").addEventListener("click",    guardarGasto);
document.getElementById("gasto-btn-eliminar").addEventListener("click",   eliminarGasto);
document.getElementById("gasto-btn-cancelar").addEventListener("click",   cerrarGastoModal);
document.getElementById("gastos-modal-close").addEventListener("click",   cerrarGastoModal);
document.getElementById("gastos-modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("gastos-modal-overlay")) cerrarGastoModal();
});

// ============================================================
//  MENSAJES
// ============================================================
function renderMensajesSelect() {
  const sel = document.getElementById("msg-particular-inquilino");
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">— Seleccioná un inquilino —</option>';

  const conWsp = Object.entries(vehiculos)
    .filter(([, v]) => v.wsp)
    .sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  const sinWsp = Object.entries(vehiculos)
    .filter(([, v]) => !v.wsp)
    .sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  conWsp.forEach(([id, v]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `#${v.cochera} — ${v.nombre}`;
    sel.appendChild(opt);
  });

  if (sinWsp.length > 0) {
    const sep = document.createElement("option");
    sep.disabled = true;
    sep.textContent = "── Sin WhatsApp ──";
    sel.appendChild(sep);
    sinWsp.forEach(([id, v]) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `#${v.cochera} — ${v.nombre} (sin WhatsApp)`;
      opt.disabled = true;
      sel.appendChild(opt);
    });
  }

  // Restaurar selección si sigue siendo válida
  if (valorActual) sel.value = valorActual;

  // Actualizar contador general
  const totalConWsp = Object.values(vehiculos).filter(v => v.wsp).length;
  const counterEl = document.getElementById("msg-general-counter");
  if (counterEl) counterEl.textContent = `${totalConWsp} inquilino${totalConWsp !== 1 ? "s" : ""} con WhatsApp`;
}

// ---- Mensaje general: ver destinatarios ----
document.getElementById("btn-msg-general-preview").addEventListener("click", () => {
  const texto = document.getElementById("msg-general-texto").value.trim();
  if (!texto) { showToast("Escribí el mensaje primero", "error"); return; }

  const destinatarios = document.getElementById("msg-destinatarios");
  const grid          = document.getElementById("msg-btns-grid");
  grid.innerHTML      = "";

  const lista = Object.values(vehiculos)
    .filter(v => v.wsp)
    .sort((a, b) => Number(a.cochera) - Number(b.cochera));

  if (lista.length === 0) {
    showToast("No hay inquilinos con WhatsApp registrado", "error");
    return;
  }

  lista.forEach(v => {
    const num  = v.wsp.replace(/\D/g, "");
    const url  = `https://wa.me/54${num}?text=${encodeURIComponent(texto)}`;
    const btn  = document.createElement("a");
    btn.href   = url;
    btn.target = "_blank";
    btn.rel    = "noopener";
    btn.className = "msg-btn-inquilino";
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.31A9.954 9.954 0 0 0 11.99 22C17.522 22 22 17.523 22 12S17.522 2 11.99 2zm.01 18.181a8.17 8.17 0 0 1-4.165-1.138l-.299-.177-3.093.812.825-3.02-.194-.31A8.185 8.185 0 0 1 3.818 12C3.818 7.479 7.48 3.818 12 3.818c4.522 0 8.182 3.661 8.182 8.182 0 4.522-3.66 8.181-8.182 8.181z"/></svg>
      #${v.cochera} ${v.nombre.split(/[\s,]+/)[0]}
    `;
    grid.appendChild(btn);
  });

  destinatarios.classList.remove("hidden");
  showToast(`${lista.length} destinatario${lista.length !== 1 ? "s" : ""} listos`, "success");
});

// Ocultar destinatarios si se borra el mensaje
document.getElementById("msg-general-texto").addEventListener("input", () => {
  if (!document.getElementById("msg-general-texto").value.trim()) {
    document.getElementById("msg-destinatarios").classList.add("hidden");
    document.getElementById("msg-btns-grid").innerHTML = "";
  }
});

// ---- Mensaje particular ----
document.getElementById("btn-msg-particular").addEventListener("click", () => {
  const vid    = document.getElementById("msg-particular-inquilino").value;
  const texto  = document.getElementById("msg-particular-texto").value.trim();
  const v      = vehiculos[vid];

  if (!vid)   { showToast("Seleccioná un inquilino", "error"); return; }
  if (!texto) { showToast("Escribí el mensaje primero", "error"); return; }
  if (!v?.wsp){ showToast("Este inquilino no tiene WhatsApp registrado", "error"); return; }

  const num = v.wsp.replace(/\D/g, "");
  window.open(`https://wa.me/54${num}?text=${encodeURIComponent(texto)}`, "_blank");
});

// ============================================================
//  FACTURACIÓN
// ============================================================
const CONDICIONES = {
  responsable_inscripto: { label: "Resp. Inscripto",  pill: "pill-ri"   },
  monotributo:           { label: "Monotributo",       pill: "pill-mono" },
  consumidor_final:      { label: "Cons. Final",       pill: "pill-cf"   },
  exento:                { label: "Exento",            pill: "pill-ex"   },
  no_responsable:        { label: "No Responsable",    pill: "pill-otro" },
  exterior:              { label: "Suj. del Exterior", pill: "pill-otro" }
};

function renderFacturacion() {
  const lista = Object.entries(facturacion)
    .sort((a, b) => (a[1].nombre || "").localeCompare(b[1].nombre || ""));

  const totalEl = document.getElementById("fact-total");
  if (totalEl) totalEl.textContent = `${lista.length} contribuyente${lista.length !== 1 ? "s" : ""}`;

  const list = document.getElementById("fact-list");
  if (!list) return;
  list.innerHTML = "";

  if (lista.length === 0) {
    list.innerHTML = `<div class="fact-empty">No hay contribuyentes registrados.</div>`;
    return;
  }

  lista.forEach(([id, p]) => {
    const cond = CONDICIONES[p.condicion] || { label: p.condicion || "—", pill: "pill-otro" };
    const card = document.createElement("div");
    card.className = "fact-card";
    card.innerHTML = `
      <div class="fact-avatar">${iniciales(p.nombre)}</div>
      <div class="fact-info">
        <div class="fact-nombre">${p.nombre || "—"}</div>
        ${p.razon ? `<div class="fact-razon">${p.razon}</div>` : ""}
        ${p.notas ? `<div class="fact-razon">${p.notas}</div>` : ""}
      </div>
      <div class="fact-detalle">
        <span class="fact-condicion-pill ${cond.pill}">${cond.label}</span>
        ${p.cuit ? `<span class="fact-cuit">CUIT: ${p.cuit}</span>` : ""}
        ${p.dni  ? `<span class="fact-cuit">DNI: ${p.dni}</span>`  : ""}
      </div>
    `;
    card.addEventListener("click", () => abrirFactModal(id));
    list.appendChild(card);
  });
}

function abrirFactModal(id = null) {
  factEditId = id;
  const p = id ? (facturacion[id] || {}) : {};
  document.getElementById("fact-modal-titulo").textContent = id ? "Editar contribuyente" : "Agregar contribuyente";
  document.getElementById("fact-nombre").value    = p.nombre    || "";
  document.getElementById("fact-razon").value     = p.razon     || "";
  document.getElementById("fact-condicion").value = p.condicion || "responsable_inscripto";
  document.getElementById("fact-cuit").value      = p.cuit      || "";
  document.getElementById("fact-dni").value       = p.dni       || "";
  document.getElementById("fact-notas").value     = p.notas     || "";

  const btnEl = document.getElementById("fact-btn-eliminar");
  id ? btnEl.classList.remove("hidden") : btnEl.classList.add("hidden");

  document.getElementById("fact-modal-overlay").classList.remove("hidden");
  document.getElementById("fact-nombre").focus();
}

function cerrarFactModal() {
  document.getElementById("fact-modal-overlay").classList.add("hidden");
  factEditId = null;
}

async function guardarFact() {
  const nombre = document.getElementById("fact-nombre").value.trim();
  if (!nombre) { document.getElementById("fact-nombre").focus(); showToast("Ingresá el nombre", "error"); return; }

  const datos = {
    nombre,
    razon:     document.getElementById("fact-razon").value.trim(),
    condicion: document.getElementById("fact-condicion").value,
    cuit:      document.getElementById("fact-cuit").value.trim(),
    dni:       document.getElementById("fact-dni").value.trim(),
    notas:     document.getElementById("fact-notas").value.trim()
  };

  try {
    if (factEditId) {
      await update(ref(db, `facturacion/${factEditId}`), datos);
      showToast("Contribuyente actualizado ✓", "success");
    } else {
      await push(ref(db, "facturacion"), datos);
      showToast("Contribuyente agregado ✓", "success");
    }
    cerrarFactModal();
  } catch (e) {
    showToast("Error al guardar", "error");
    console.error(e);
  }
}

async function eliminarFact() {
  if (!factEditId) return;
  if (!confirm("¿Eliminás este contribuyente?")) return;
  await remove(ref(db, `facturacion/${factEditId}`));
  showToast("Contribuyente eliminado", "");
  cerrarFactModal();
}

document.getElementById("btn-nuevo-fact").addEventListener("click",      () => abrirFactModal());
document.getElementById("fact-btn-guardar").addEventListener("click",    guardarFact);
document.getElementById("fact-btn-eliminar").addEventListener("click",   eliminarFact);
document.getElementById("fact-btn-cancelar").addEventListener("click",   cerrarFactModal);
document.getElementById("fact-modal-close").addEventListener("click",    cerrarFactModal);
document.getElementById("fact-modal-overlay").addEventListener("click",  (e) => {
  if (e.target === document.getElementById("fact-modal-overlay")) cerrarFactModal();
});
// ============================================================
//  RECIBO PDF
// ============================================================
function generarReciboPDF(vid, v, p, mes) {
  const fechaPago   = p.fecha ? new Date(p.fecha).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" }) : "—";
  const metodoTxt   = p.metodo === "transferencia" ? "Transferencia bancaria" : "Efectivo";
  const adminTxt    = p.admin === "joaquin" ? "Joaquín" : "Federico";
  const montoTxt    = formatMonto(p.monto || v.monto || 0);
  const mesTxt      = mesLabel(mes);
  const nroRecibo   = `${mes.replace("-","")}-${String(v.cochera).padStart(2,"0")}`;
  const hoy         = new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recibo ${nroRecibo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #111;
      padding: 48px;
      max-width: 600px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 36px;
      padding-bottom: 20px;
      border-bottom: 2px solid #111;
    }
    .brand { font-size: 20px; font-weight: 700; color: #111; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #888; margin-top: 3px; }
    .recibo-num { text-align: right; }
    .recibo-num-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .06em; }
    .recibo-num-val { font-size: 18px; font-weight: 700; color: #111; margin-top: 2px; font-family: 'Courier New', monospace; }
    .recibo-fecha { font-size: 12px; color: #888; margin-top: 4px; }
    .titulo {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #888;
      margin-bottom: 20px;
    }
    .monto-box {
      background: #f7f7f8;
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .monto-label { font-size: 13px; color: #666; }
    .monto-val { font-size: 28px; font-weight: 700; color: #111; font-family: 'Courier New', monospace; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 24px;
      margin-bottom: 36px;
    }
    .field-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }
    .field-val { font-size: 14px; font-weight: 500; color: #111; }
    .divider { border: none; border-top: 1px solid #e5e5e5; margin: 28px 0; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .firma-box { text-align: center; }
    .firma-linea { width: 160px; border-top: 1px solid #111; margin-bottom: 6px; }
    .firma-label { font-size: 11px; color: #888; }
    .sello { font-size: 11px; color: #aaa; text-align: right; line-height: 1.6; }
    @media print {
      body { padding: 32px; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">JPSoft | Garage</div>
      <div class="brand-sub">Gestión de cocheras</div>
    </div>
    <div class="recibo-num">
      <div class="recibo-num-label">Recibo Nº</div>
      <div class="recibo-num-val">${nroRecibo}</div>
      <div class="recibo-fecha">Emitido: ${hoy}</div>
    </div>
  </div>

  <div class="titulo">Recibo de pago — ${mesTxt}</div>

  <div class="monto-box">
    <div class="monto-label">Monto abonado</div>
    <div class="monto-val">${montoTxt}</div>
  </div>

  <div class="grid">
    <div>
      <div class="field-label">Inquilino</div>
      <div class="field-val">${v.nombre || "—"}</div>
    </div>
    <div>
      <div class="field-label">Cochera Nº</div>
      <div class="field-val">${String(v.cochera).padStart(2,"0")}</div>
    </div>
    <div>
      <div class="field-label">Período</div>
      <div class="field-val">${mesTxt}</div>
    </div>
    <div>
      <div class="field-label">Fecha de pago</div>
      <div class="field-val">${fechaPago}</div>
    </div>
    <div>
      <div class="field-label">Forma de pago</div>
      <div class="field-val">${metodoTxt}</div>
    </div>
    <div>
      <div class="field-label">Recibió</div>
      <div class="field-val">${adminTxt}</div>
    </div>
    ${v.patente ? `<div>
      <div class="field-label">Vehículo / Patente</div>
      <div class="field-val">${v.modelo ? v.modelo + " — " : ""}${v.patente}</div>
    </div>` : ""}
  </div>

  <hr class="divider" />

  <div class="footer">
    <div class="firma-box">
      <div class="firma-linea"></div>
      <div class="firma-label">Firma</div>
    </div>
    <div class="sello">
      Documento generado por JPSoft | Garage<br>
      ${hoy}
    </div>
  </div>
</body>
</html>`;

  const ventana = window.open("", "_blank", "width=700,height=900");
  ventana.document.write(html);
  ventana.document.close();
  ventana.addEventListener("load", () => {
    ventana.focus();
    ventana.print();
  });
}

// ============================================================
//  AUMENTOS
// ============================================================
let aumentoToggleActivo = false;

function mesAnterior(clave) {
  const [anio, mes] = clave.split("-").map(Number);
  const d = new Date(anio, mes - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function calcVariacion(actual, anterior) {
  if (!anterior || !actual) return null;
  const diff = actual - anterior;
  const pct  = ((diff / anterior) * 100).toFixed(1);
  return { diff, pct: Number(pct) };
}

function formatVariacion(actual, anterior) {
  const v = calcVariacion(actual, anterior);
  if (!v) return { html: "—", cls: "igual" };
  if (v.diff > 0) return { html: `▲ ${formatMonto(v.diff)} (+${v.pct}%)`, cls: "sube" };
  if (v.diff < 0) return { html: `▼ ${formatMonto(Math.abs(v.diff))} (${v.pct}%)`, cls: "baja" };
  return { html: "Sin cambio", cls: "igual" };
}

function renderAumentos() {
  const labelEl = document.getElementById("aumentos-mes-label");
  if (labelEl) labelEl.textContent = mesLabel(aumentosMesActivo);

  const mesData  = aumentos[aumentosMesActivo] || {};
  const mesAnt   = mesAnterior(aumentosMesActivo);
  const mesAntData = aumentos[mesAnt] || {};

  // Cargar datos del mes en el formulario
  aumentoToggleActivo = !!mesData.activo;
  const toggle     = document.getElementById("aumento-toggle");
  const toggleLbl  = document.getElementById("aumento-toggle-label");
  const precios    = document.getElementById("aumentos-precios");

  if (toggle) {
    toggle.classList.toggle("activo", aumentoToggleActivo);
    if (toggleLbl) toggleLbl.textContent = aumentoToggleActivo ? "Con aumento" : "Sin aumento";
    if (precios)   precios.classList.toggle("activo", aumentoToggleActivo);
  }

  const inputAuto = document.getElementById("aumento-precio-auto");
  const inputMoto = document.getElementById("aumento-precio-moto");
  const notasInput = document.getElementById("aumento-notas");
  if (inputAuto) inputAuto.value = mesData.precioAuto || "";
  if (inputMoto) inputMoto.value = mesData.precioMoto || "";
  if (notasInput) notasInput.value = mesData.notas || "";

  // Mostrar variaciones en tiempo real
  actualizarVariaciones();

  // Renderizar tabla historial
  renderAumentosTabla();
}

function actualizarVariaciones() {
  const mesAnt     = mesAnterior(aumentosMesActivo);
  const mesAntData = aumentos[mesAnt] || {};

  const inputAuto = document.getElementById("aumento-precio-auto");
  const inputMoto = document.getElementById("aumento-precio-moto");
  const varAuto   = document.getElementById("var-auto");
  const varMoto   = document.getElementById("var-moto");

  if (inputAuto && varAuto) {
    const v = formatVariacion(Number(inputAuto.value), Number(mesAntData.precioAuto));
    varAuto.textContent = inputAuto.value ? v.html : "";
    varAuto.className   = `aumento-variacion ${v.cls}`;
  }
  if (inputMoto && varMoto) {
    const v = formatVariacion(Number(inputMoto.value), Number(mesAntData.precioMoto));
    varMoto.textContent = inputMoto.value ? v.html : "";
    varMoto.className   = `aumento-variacion ${v.cls}`;
  }
}

function renderAumentosTabla() {
  const tbody = document.getElementById("aumentos-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const lista = Object.entries(aumentos)
    .sort((a, b) => b[0].localeCompare(a[0])); // más reciente primero

  if (lista.length === 0) {
    tbody.innerHTML = `<tr class="tabla-empty"><td colspan="7">No hay registros todavía.</td></tr>`;
    return;
  }

  lista.forEach(([mes, d], idx) => {
    // Buscar mes anterior en la lista ordenada
    const mesAntClave = mesAnterior(mes);
    const mesAntData  = aumentos[mesAntClave] || {};
    const vAuto = formatVariacion(Number(d.precioAuto), Number(mesAntData.precioAuto));
    const vMoto = formatVariacion(Number(d.precioMoto), Number(mesAntData.precioMoto));

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${mesLabel(mes)}</strong></td>
      <td>${d.activo
        ? `<span class="aumento-pill-si">▲ Sí</span>`
        : `<span class="aumento-pill-no">— No</span>`}
      </td>
      <td class="tabla-precio">${d.precioAuto ? formatMonto(d.precioAuto) : "—"}</td>
      <td class="tabla-var ${vAuto.cls}">${d.precioAuto ? vAuto.html : "—"}</td>
      <td class="tabla-precio">${d.precioMoto ? formatMonto(d.precioMoto) : "—"}</td>
      <td class="tabla-var ${vMoto.cls}">${d.precioMoto ? vMoto.html : "—"}</td>
      <td class="tabla-notas">${d.notas || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Toggle aumento
document.getElementById("aumento-toggle").addEventListener("click", () => {
  aumentoToggleActivo = !aumentoToggleActivo;
  const toggle    = document.getElementById("aumento-toggle");
  const toggleLbl = document.getElementById("aumento-toggle-label");
  const precios   = document.getElementById("aumentos-precios");
  toggle.classList.toggle("activo", aumentoToggleActivo);
  toggleLbl.textContent = aumentoToggleActivo ? "Con aumento" : "Sin aumento";
  precios.classList.toggle("activo", aumentoToggleActivo);
});

// Calcular variaciones en tiempo real al escribir
document.getElementById("aumento-precio-auto").addEventListener("input", actualizarVariaciones);
document.getElementById("aumento-precio-moto").addEventListener("input", actualizarVariaciones);

// Navegación de meses
document.getElementById("aumentos-mes-prev").addEventListener("click", () => {
  aumentosMesActivo = mesOffset(aumentosMesActivo, -1);
  renderAumentos();
});
document.getElementById("aumentos-mes-next").addEventListener("click", () => {
  aumentosMesActivo = mesOffset(aumentosMesActivo, +1);
  renderAumentos();
});

// Guardar
document.getElementById("btn-guardar-aumento").addEventListener("click", async () => {
  const datos = {
    activo:     aumentoToggleActivo,
    precioAuto: Number(document.getElementById("aumento-precio-auto").value) || 0,
    precioMoto: Number(document.getElementById("aumento-precio-moto").value) || 0,
    notas:      document.getElementById("aumento-notas").value.trim()
  };

  try {
    await set(ref(db, `aumentos/${aumentosMesActivo}`), datos);
    showToast("Aumento guardado ✓", "success");
  } catch (e) {
    showToast("Error al guardar", "error");
    console.error(e);
  }
});
