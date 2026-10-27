// Claves de almacenamiento local y sincronización en la nube
const STORAGE_KEY_TASKS = 'alejandro_agenda_tareas_v1';
const STORAGE_KEY_REMINDERS = 'alejandro_agenda_recordatorios_v1';
const STORAGE_KEY_DELETED = 'alejandro_agenda_borrados_v1';

// IDs de ejemplo que venían de muestra para ignorarlos al sincronizar datos reales
const IDS_EJEMPLO = new Set(['t-1', 't-2', 't-3', 'r-1']);

const PESO_PRIORIDAD = { urgente: 1, intermedio: 2, simple: 3 };
const ETIQUETA_PRIORIDAD = { urgente: 'Urgente', intermedio: 'Intermedio', simple: 'Simple' };
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function obtenerFechaISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const hoyDate = new Date();
const HOY_ISO = obtenerFechaISO(hoyDate);

let borrados = cargarBorrados();
let tareas = cargarTareasLocal();
let recordatorios = cargarRecordatoriosLocal();

let prioridadSeleccionada = 'simple';
let filtroActual = 'todas';

let mesActualVista = hoyDate.getMonth();
let anioActualVista = hoyDate.getFullYear();
let fechaSeleccionadaISO = HOY_ISO;
let sincronizando = false;

// Elementos del DOM
const viewHome = document.getElementById('view-home');
const viewTasks = document.getElementById('view-tasks');
const viewAgenda = document.getElementById('view-agenda');
const btnHome = document.getElementById('btn-home');
const btnOpenTasks = document.getElementById('btn-open-tasks');
const btnOpenAgenda = document.getElementById('btn-open-agenda');
const btnOpenMod3 = document.getElementById('btn-open-mod3');
const homeTasksCounter = document.getElementById('home-tasks-counter');
const homeAgendaCounter = document.getElementById('home-agenda-counter');
const currentDateEl = document.getElementById('current-date');
const syncStatusEl = document.getElementById('sync-status');

// Aviso de actividades de hoy
const todayAlertBanner = document.getElementById('today-alert-banner');
const todayAlertHeading = document.getElementById('today-alert-heading');
const todayAlertList = document.getElementById('today-alert-list');
const btnAlertGoAgenda = document.getElementById('btn-alert-go-agenda');
const btnAlertClose = document.getElementById('btn-alert-close');

// Elementos de Tareas
const btnNewTask = document.getElementById('btn-new-task');
const formNewTaskBox = document.getElementById('form-new-task-box');
const inputTaskText = document.getElementById('input-task-text');
const prioritySelector = document.getElementById('priority-selector');
const btnCancelTask = document.getElementById('btn-cancel-task');
const btnSaveTask = document.getElementById('btn-save-task');
const tasksList = document.getElementById('tasks-list');
const filterChips = document.querySelectorAll('.filter-chip');

// Elementos de Agenda Mensual
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
const btnJumpToday = document.getElementById('btn-jump-today');
const calendarMonthTitle = document.getElementById('calendar-month-title');
const calendarGrid = document.getElementById('calendar-grid');
const selectedDayBadge = document.getElementById('selected-day-badge');
const selectedDayTitle = document.getElementById('selected-day-title');
const btnNewReminder = document.getElementById('btn-new-reminder');
const inputReminderTime = document.getElementById('input-reminder-time');
const inputReminderText = document.getElementById('input-reminder-text');
const btnSaveReminder = document.getElementById('btn-save-reminder');
const dayRemindersList = document.getElementById('day-reminders-list');

function actualizarEstadoSync(texto, color) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = texto;
  if (color === 'amarillo') {
    syncStatusEl.style.background = 'rgba(234, 179, 8, 0.15)';
    syncStatusEl.style.color = '#facc15';
    syncStatusEl.style.borderColor = 'rgba(234, 179, 8, 0.4)';
  } else {
    syncStatusEl.style.background = 'rgba(34, 197, 94, 0.15)';
    syncStatusEl.style.color = '#4ade80';
    syncStatusEl.style.borderColor = 'rgba(34, 197, 94, 0.4)';
  }
}

function mostrarFechaHoy() {
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const texto = hoyDate.toLocaleDateString('es-AR', opciones);
  currentDateEl.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearFechaLegible(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const texto = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1);
  return isoStr === HOY_ISO ? `Hoy — ${capitalizado}` : capitalizado;
}

function cargarBorrados() {
  const g = localStorage.getItem(STORAGE_KEY_DELETED);
  if (g) {
    try { return JSON.parse(g); } catch (e) { return []; }
  }
  return [];
}

function cargarTareasLocal() {
  const guardado = localStorage.getItem(STORAGE_KEY_TASKS);
  if (guardado) {
    try {
      return JSON.parse(guardado).filter(x => !IDS_EJEMPLO.has(x.id));
    } catch (e) { return []; }
  }
  return [];
}

function cargarRecordatoriosLocal() {
  const guardado = localStorage.getItem(STORAGE_KEY_REMINDERS);
  if (guardado) {
    try {
      return JSON.parse(guardado).filter(x => !IDS_EJEMPLO.has(x.id));
    } catch (e) { return []; }
  }
  return [];
}

function guardarEnLocal() {
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tareas));
  localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(recordatorios));
  localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(borrados));
  actualizarContadoresYAlertas();
}

// ====================================================
// SINCRONIZACIÓN EN LA NUBE (CELULAR <-> COMPUTADORA)
// ====================================================
function combinarListas(listaNube, listaLocal, setBorrados) {
  const mapa = new Map();
  (listaNube || []).forEach(item => {
    if (!IDS_EJEMPLO.has(item.id) && !setBorrados.has(item.id)) {
      mapa.set(item.id, item);
    }
  });
  (listaLocal || []).forEach(item => {
    if (!IDS_EJEMPLO.has(item.id) && !setBorrados.has(item.id)) {
      if (!mapa.has(item.id)) {
        mapa.set(item.id, item);
      } else {
        // Si existe en ambos, usar el que tenga actualización más reciente
        const existente = mapa.get(item.id);
        if ((item.updatedAt || 0) > (existente.updatedAt || 0)) {
          mapa.set(item.id, item);
        }
      }
    }
  });
  return Array.from(mapa.values());
}

const API_SYNC_URL = 'https://agenda-personal-aleok.vercel.app/api/sync';

async function sincronizarDesdeNube() {
  if (sincronizando) return;
  sincronizando = true;
  try {
    const res = await fetch(API_SYNC_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) {
      actualizarEstadoSync('☁️ Modo local', 'amarillo');
      sincronizando = false;
      return;
    }
    const cloud = await res.json();
    const setBorrados = new Set([...(cloud.borrados || []), ...borrados]);
    borrados = Array.from(setBorrados);

    const tareasCombinadas = combinarListas(cloud.tareas || [], tareas, setBorrados);
    const recCombinados = combinarListas(cloud.recordatorios || [], recordatorios, setBorrados);

    // Verificar si este dispositivo tenía cosas nuevas que no estaban en la nube
    const habiaLocalesNuevos =
      tareasCombinadas.length !== (cloud.tareas || []).filter(x => !IDS_EJEMPLO.has(x.id) && !setBorrados.has(x.id)).length ||
      recCombinados.length !== (cloud.recordatorios || []).filter(x => !IDS_EJEMPLO.has(x.id) && !setBorrados.has(x.id)).length;

    tareas = tareasCombinadas;
    recordatorios = recCombinados;
    guardarEnLocal();
    renderizarTareas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();

    if (habiaLocalesNuevos) {
      await guardarEnNube();
    } else {
      actualizarEstadoSync('☁️ Sincronizado', 'verde');
    }
  } catch (e) {
    actualizarEstadoSync('☁️ Guardado en dispositivo', 'amarillo');
  } finally {
    sincronizando = false;
  }
}

async function guardarEnNube() {
  guardarEnLocal();
  actualizarEstadoSync('☁️ Guardando...', 'amarillo');
  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tareas: tareas,
        recordatorios: recordatorios,
        borrados: borrados
      })
    });
    if (res.ok) {
      actualizarEstadoSync('☁️ Sincronizado', 'verde');
    }
  } catch (e) {
    actualizarEstadoSync('☁️ Pendiente de señal', 'amarillo');
  }
}

// Actualizar contadores de los botones y el Aviso Automático de Hoy
function actualizarContadoresYAlertas() {
  const tareasPendientes = tareas.filter(t => !t.realizada).length;
  homeTasksCounter.textContent = tareasPendientes === 1 ? '1 pendiente' : `${tareasPendientes} pendientes`;

  const recordatoriosDeHoyPendientes = recordatorios
    .filter(r => r.fecha === HOY_ISO && !r.realizada)
    .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));

  const cantHoy = recordatoriosDeHoyPendientes.length;
  homeAgendaCounter.textContent = cantHoy === 1 ? '1 actividad para hoy' : `${cantHoy} actividades para hoy`;

  if (cantHoy > 0) {
    todayAlertBanner.classList.remove('hidden');
    todayAlertHeading.textContent = cantHoy === 1
      ? '¡Atención! Tenés 1 actividad programada para hoy en tu Agenda Mensual:'
      : `¡Atención! Tenés ${cantHoy} actividades programadas para hoy en tu Agenda Mensual:`;

    todayAlertList.innerHTML = '';
    recordatoriosDeHoyPendientes.forEach(r => {
      const li = document.createElement('li');
      const horaHtml = r.hora ? `<span class="alert-time-badge">${escaparHTML(r.hora)} hs</span>` : `<span class="alert-time-badge">Hoy</span>`;
      li.innerHTML = `${horaHtml} <span>${escaparHTML(r.texto)}</span>`;
      todayAlertList.appendChild(li);
    });
  } else {
    todayAlertBanner.classList.add('hidden');
  }
}

// Navegación entre pantallas
function irAInicio() {
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewHome.classList.remove('hidden');
  btnHome.classList.add('hidden');
  actualizarContadoresYAlertas();
}

function irATareas() {
  viewHome.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewTasks.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarTareas();
}

function irAAgenda(fechaISO) {
  if (fechaISO) {
    fechaSeleccionadaISO = fechaISO;
    const [y, m] = fechaISO.split('-').map(Number);
    anioActualVista = y;
    mesActualVista = m - 1;
  }
  viewHome.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
}

btnHome.addEventListener('click', irAInicio);
btnOpenTasks.addEventListener('click', irATareas);
btnOpenAgenda.addEventListener('click', () => irAAgenda());
btnAlertGoAgenda.addEventListener('click', () => irAAgenda(HOY_ISO));
btnAlertClose.addEventListener('click', () => todayAlertBanner.classList.add('hidden'));

btnOpenMod3.addEventListener('click', () => {
  alert('Este es el Botón 3. Cuando me digas qué función querés acá, lo armamos.');
});

// ==========================================
// MÓDULO 1: LÓGICA DE LISTA DE TAREAS
// ==========================================
btnNewTask.addEventListener('click', () => {
  formNewTaskBox.classList.toggle('hidden');
  if (!formNewTaskBox.classList.contains('hidden')) {
    inputTaskText.focus();
  }
});

btnCancelTask.addEventListener('click', () => {
  formNewTaskBox.classList.add('hidden');
  inputTaskText.value = '';
});

prioritySelector.querySelectorAll('.prio-option').forEach(btn => {
  btn.addEventListener('click', () => {
    prioritySelector.querySelectorAll('.prio-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    prioridadSeleccionada = btn.dataset.priority;
    inputTaskText.focus();
  });
});

function crearNuevaTarea() {
  const texto = inputTaskText.value.trim();
  if (!texto) {
    inputTaskText.focus();
    return;
  }

  tareas.push({
    id: 'tarea-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    texto: texto,
    prioridad: prioridadSeleccionada,
    realizada: false,
    updatedAt: Date.now()
  });

  renderizarTareas();
  inputTaskText.value = '';
  formNewTaskBox.classList.add('hidden');
  guardarEnNube();
}

btnSaveTask.addEventListener('click', crearNuevaTarea);
inputTaskText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    crearNuevaTarea();
  }
});

filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filtroActual = chip.dataset.filter;
    renderizarTareas();
  });
});

function renderizarTareas() {
  tasksList.innerHTML = '';

  let listaFiltrada = [...tareas];
  if (filtroActual === 'pendientes') {
    listaFiltrada = listaFiltrada.filter(t => !t.realizada);
  } else if (filtroActual === 'realizadas') {
    listaFiltrada = listaFiltrada.filter(t => t.realizada);
  }

  listaFiltrada.sort((a, b) => {
    if (a.realizada !== b.realizada) return a.realizada ? 1 : -1;
    return PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
  });

  if (listaFiltrada.length === 0) {
    tasksList.innerHTML = `<div class="empty-state">No hay tareas en esta vista. Tocá el botón <b>+ Nueva tarea</b> para agregar una.</div>`;
    return;
  }

  listaFiltrada.forEach(tarea => {
    const fila = document.createElement('div');
    fila.className = `task-item prio-${tarea.prioridad} ${tarea.realizada ? 'realizada' : ''}`;

    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill pill-${tarea.prioridad}">
          ${ETIQUETA_PRIORIDAD[tarea.prioridad]}
        </span>
        <span class="task-text">${escaparHTML(tarea.texto)}</span>
      </div>
      <div class="task-actions">
        <button class="btn-done ${tarea.realizada ? 'is-done' : ''}" data-action="toggle">
          ${tarea.realizada ? '↩ Pendiente' : '✓ Realizada'}
        </button>
        <button class="btn-delete" data-action="delete">
          ✕ Eliminar
        </button>
      </div>
    `;

    fila.querySelector('[data-action="toggle"]').addEventListener('click', () => {
      tarea.realizada = !tarea.realizada;
      tarea.updatedAt = Date.now();
      renderizarTareas();
      guardarEnNube();
    });
    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      borrados.push(tarea.id);
      tareas = tareas.filter(x => x.id !== tarea.id);
      renderizarTareas();
      guardarEnNube();
    });

    tasksList.appendChild(fila);
  });
}

// ==========================================
// MÓDULO 2: LÓGICA DE AGENDA MENSUAL
// ==========================================
btnPrevMonth.addEventListener('click', () => {
  mesActualVista--;
  if (mesActualVista < 0) {
    mesActualVista = 11;
    anioActualVista--;
  }
  renderizarCalendario();
});

btnNextMonth.addEventListener('click', () => {
  mesActualVista++;
  if (mesActualVista > 11) {
    mesActualVista = 0;
    anioActualVista++;
  }
  renderizarCalendario();
});

btnJumpToday.addEventListener('click', () => {
  anioActualVista = hoyDate.getFullYear();
  mesActualVista = hoyDate.getMonth();
  fechaSeleccionadaISO = HOY_ISO;
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
});

btnNewReminder.addEventListener('click', () => {
  inputReminderText.focus();
});

inputReminderTime.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    inputReminderText.focus();
  }
});

inputReminderText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    guardarNuevoRecordatorio();
  }
});

btnSaveReminder.addEventListener('click', guardarNuevoRecordatorio);

function guardarNuevoRecordatorio() {
  const texto = inputReminderText.value.trim();
  if (!texto) {
    inputReminderText.focus();
    return;
  }

  recordatorios.push({
    id: 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    fecha: fechaSeleccionadaISO,
    hora: inputReminderTime.value || '',
    texto: texto,
    realizada: false,
    updatedAt: Date.now()
  });

  inputReminderText.value = '';
  inputReminderTime.value = '';
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
  inputReminderText.focus();
  guardarEnNube();
}

function renderizarCalendario() {
  calendarMonthTitle.textContent = `${NOMBRES_MESES[mesActualVista]} ${anioActualVista}`;
  calendarGrid.innerHTML = '';

  const primerDiaSemana = new Date(anioActualVista, mesActualVista, 1).getDay();
  const offsetLunes = (primerDiaSemana + 6) % 7;
  const totalDiasMes = new Date(anioActualVista, mesActualVista + 1, 0).getDate();

  for (let i = 0; i < offsetLunes; i++) {
    const celdaVacia = document.createElement('div');
    celdaVacia.className = 'cal-day empty';
    calendarGrid.appendChild(celdaVacia);
  }

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const fechaISO = `${anioActualVista}-${String(mesActualVista + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const delDia = recordatorios.filter(r => r.fecha === fechaISO);
    const pendientesDia = delDia.filter(r => !r.realizada).length;

    const btnDia = document.createElement('button');
    btnDia.type = 'button';
    btnDia.className = 'cal-day';
    if (fechaISO === HOY_ISO) btnDia.classList.add('is-today');
    if (fechaISO === fechaSeleccionadaISO) btnDia.classList.add('is-selected');

    let badgeHtml = '';
    if (pendientesDia > 0) {
      badgeHtml = `<span class="cal-day-badge">${pendientesDia}</span>`;
    } else if (delDia.length > 0) {
      badgeHtml = `<span class="cal-day-badge" style="background:#22c55e;color:#052e16">✓</span>`;
    }

    btnDia.innerHTML = `
      <span class="cal-day-number">${dia}</span>
      ${badgeHtml}
    `;

    btnDia.addEventListener('click', () => {
      fechaSeleccionadaISO = fechaISO;
      renderizarCalendario();
      renderizarRecordatoriosDelDia();
    });

    calendarGrid.appendChild(btnDia);
  }
}

function renderizarRecordatoriosDelDia() {
  selectedDayTitle.textContent = formatearFechaLegible(fechaSeleccionadaISO);
  selectedDayBadge.textContent = fechaSeleccionadaISO === HOY_ISO ? 'Actividades de HOY' : `Fecha: ${fechaSeleccionadaISO.split('-').reverse().join('/')}`;

  dayRemindersList.innerHTML = '';

  const listaDia = recordatorios
    .filter(r => r.fecha === fechaSeleccionadaISO)
    .sort((a, b) => {
      if (a.realizada !== b.realizada) return a.realizada ? 1 : -1;
      return (a.hora || '99:99').localeCompare(b.hora || '99:99');
    });

  if (listaDia.length === 0) {
    dayRemindersList.innerHTML = `<div class="empty-state">No hay recordatorios guardados para este día.<br>Escribí uno arriba y apretá <b>Enter</b> para guardarlo.</div>`;
    return;
  }

  listaDia.forEach(rec => {
    const fila = document.createElement('div');
    fila.className = `task-item reminder-item ${rec.realizada ? 'realizada' : ''}`;

    const etiquetaHora = rec.hora ? `${rec.hora} hs` : 'Todo el día';

    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill pill-hora">${escaparHTML(etiquetaHora)}</span>
        <span class="task-text">${escaparHTML(rec.texto)}</span>
      </div>
      <div class="task-actions">
        <button class="btn-done ${rec.realizada ? 'is-done' : ''}" data-action="toggle">
          ${rec.realizada ? '↩ Pendiente' : '✓ Realizada'}
        </button>
        <button class="btn-delete" data-action="delete">
          ✕ Eliminar
        </button>
      </div>
    `;

    fila.querySelector('[data-action="toggle"]').addEventListener('click', () => {
      rec.realizada = !rec.realizada;
      rec.updatedAt = Date.now();
      renderizarCalendario();
      renderizarRecordatoriosDelDia();
      guardarEnNube();
    });

    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      borrados.push(rec.id);
      recordatorios = recordatorios.filter(x => x.id !== rec.id);
      renderizarCalendario();
      renderizarRecordatoriosDelDia();
      guardarEnNube();
    });

    dayRemindersList.appendChild(fila);
  });
}

function escaparHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Inicializar app y sincronizar con la nube
mostrarFechaHoy();
actualizarContadoresYAlertas();
renderizarTareas();
renderizarCalendario();
renderizarRecordatoriosDelDia();
sincronizarDesdeNube();

// Volver a sincronizar cuando el usuario vuelve a la ventana o cada 12 segundos
window.addEventListener('focus', sincronizarDesdeNube);
setInterval(sincronizarDesdeNube, 12000);
