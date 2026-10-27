// Claves de almacenamiento local
const STORAGE_KEY_TASKS = 'alejandro_agenda_tareas_v1';
const STORAGE_KEY_REMINDERS = 'alejandro_agenda_recordatorios_v1';

const PESO_PRIORIDAD = { urgente: 1, intermedio: 2, simple: 3 };
const ETIQUETA_PRIORIDAD = { urgente: 'Urgente', intermedio: 'Intermedio', simple: 'Simple' };
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Fecha de hoy en formato YYYY-MM-DD local
function obtenerFechaISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const hoyDate = new Date();
const HOY_ISO = obtenerFechaISO(hoyDate);

let tareas = cargarTareas();
let recordatorios = cargarRecordatorios();

let prioridadSeleccionada = 'simple';
let filtroActual = 'todas';

// Estado del calendario mensual
let mesActualVista = hoyDate.getMonth();
let anioActualVista = hoyDate.getFullYear();
let fechaSeleccionadaISO = HOY_ISO;

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

// Mostrar fecha de hoy en el encabezado
function mostrarFechaHoy() {
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const texto = hoyDate.toLocaleDateString('es-AR', opciones);
  currentDateEl.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Formatear una fecha YYYY-MM-DD a texto legible en español
function formatearFechaLegible(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const texto = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1);
  return isoStr === HOY_ISO ? `Hoy — ${capitalizado}` : capitalizado;
}

// Cargar y guardar Tareas del día a día
function cargarTareas() {
  const guardado = localStorage.getItem(STORAGE_KEY_TASKS);
  if (guardado) {
    try { return JSON.parse(guardado); } catch (e) { return []; }
  }
  return [
    { id: 't-1', texto: 'Revisar cierres del día', prioridad: 'urgente', realizada: false },
    { id: 't-2', texto: 'Confirmar turnos de la semana', prioridad: 'intermedio', realizada: false },
    { id: 't-3', texto: 'Ordenar papeles del escritorio', prioridad: 'simple', realizada: false }
  ];
}

function guardarTareas() {
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tareas));
  actualizarContadoresYAlertas();
}

// Cargar y guardar Recordatorios de la Agenda Mensual
function cargarRecordatorios() {
  const guardado = localStorage.getItem(STORAGE_KEY_REMINDERS);
  if (guardado) {
    try { return JSON.parse(guardado); } catch (e) { return []; }
  }
  // Ejemplo inicial programado para HOY para que se vea cómo avisa al abrir la app
  return [
    { id: 'r-1', fecha: HOY_ISO, hora: '10:30', texto: 'Reunión / control de pendientes del mes', realizada: false }
  ];
}

function guardarRecordatorios() {
  localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(recordatorios));
  actualizarContadoresYAlertas();
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

  // Mostrar aviso superior si hay actividades programadas para hoy en la Agenda Mensual
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

btnAlertGoAgenda.addEventListener('click', () => {
  irAAgenda(HOY_ISO);
});

btnAlertClose.addEventListener('click', () => {
  todayAlertBanner.classList.add('hidden');
});

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
    id: 'tarea-' + Date.now(),
    texto: texto,
    prioridad: prioridadSeleccionada,
    realizada: false
  });

  guardarTareas();
  renderizarTareas();
  inputTaskText.value = '';
  formNewTaskBox.classList.add('hidden');
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
      guardarTareas();
      renderizarTareas();
    });
    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      tareas = tareas.filter(x => x.id !== tarea.id);
      guardarTareas();
      renderizarTareas();
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

// Regla de Alejandro: Enter pasa al siguiente campo o guarda
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
    id: 'rec-' + Date.now(),
    fecha: fechaSeleccionadaISO,
    hora: inputReminderTime.value || '',
    texto: texto,
    realizada: false
  });

  inputReminderText.value = '';
  inputReminderTime.value = '';
  guardarRecordatorios();
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
  inputReminderText.focus();
}

function renderizarCalendario() {
  calendarMonthTitle.textContent = `${NOMBRES_MESES[mesActualVista]} ${anioActualVista}`;
  calendarGrid.innerHTML = '';

  const primerDiaSemana = new Date(anioActualVista, mesActualVista, 1).getDay();
  // Ajustar para que la semana empiece en Lunes (0 = Lunes ... 6 = Domingo)
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
      guardarRecordatorios();
      renderizarCalendario();
      renderizarRecordatoriosDelDia();
    });

    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      recordatorios = recordatorios.filter(x => x.id !== rec.id);
      guardarRecordatorios();
      renderizarCalendario();
      renderizarRecordatoriosDelDia();
    });

    dayRemindersList.appendChild(fila);
  });
}

function escaparHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Inicializar app
mostrarFechaHoy();
actualizarContadoresYAlertas();
renderizarTareas();
renderizarCalendario();
renderizarRecordatoriosDelDia();
