// Estado de la aplicación
const STORAGE_KEY = 'alejandro_agenda_tareas_v1';

// Orden de importancia para ordenar: Urgente (Rojo) primero, luego Intermedio (Amarillo), luego Simple (Verde)
const PESO_PRIORIDAD = {
  urgente: 1,
  intermedio: 2,
  simple: 3
};

const ETIQUETA_PRIORIDAD = {
  urgente: 'Urgente',
  intermedio: 'Intermedio',
  simple: 'Simple'
};

let tareas = cargarTareas();
let prioridadSeleccionada = 'simple';
let filtroActual = 'todas';

// Elementos del DOM
const viewHome = document.getElementById('view-home');
const viewTasks = document.getElementById('view-tasks');
const btnHome = document.getElementById('btn-home');
const btnOpenTasks = document.getElementById('btn-open-tasks');
const btnOpenMod2 = document.getElementById('btn-open-mod2');
const btnOpenMod3 = document.getElementById('btn-open-mod3');
const homeTasksCounter = document.getElementById('home-tasks-counter');

const btnNewTask = document.getElementById('btn-new-task');
const formNewTaskBox = document.getElementById('form-new-task-box');
const inputTaskText = document.getElementById('input-task-text');
const prioritySelector = document.getElementById('priority-selector');
const btnCancelTask = document.getElementById('btn-cancel-task');
const btnSaveTask = document.getElementById('btn-save-task');
const tasksList = document.getElementById('tasks-list');
const filterChips = document.querySelectorAll('.filter-chip');
const currentDateEl = document.getElementById('current-date');

// Mostrar fecha de hoy en español
function mostrarFechaHoy() {
  const hoy = new Date();
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const texto = hoy.toLocaleDateString('es-AR', opciones);
  currentDateEl.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Cargar tareas guardadas o poner ejemplos iniciales
function cargarTareas() {
  const guardado = localStorage.getItem(STORAGE_KEY);
  if (guardado) {
    try {
      return JSON.parse(guardado);
    } catch (e) {
      return [];
    }
  }
  return [
    { id: 't-1', texto: 'Revisar cierres del día', prioridad: 'urgente', realizada: false },
    { id: 't-2', texto: 'Confirmar turnos de la semana', prioridad: 'intermedio', realizada: false },
    { id: 't-3', texto: 'Ordenar papeles del escritorio', prioridad: 'simple', realizada: false }
  ];
}

function guardarTareas() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tareas));
  actualizarContadorInicio();
}

function actualizarContadorInicio() {
  const pendientes = tareas.filter(t => !t.realizada).length;
  homeTasksCounter.textContent = pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`;
}

// Navegación entre pantallas
function irAInicio() {
  viewTasks.classList.add('hidden');
  viewHome.classList.remove('hidden');
  btnHome.classList.add('hidden');
  actualizarContadorInicio();
}

function irATareas() {
  viewHome.classList.add('hidden');
  viewTasks.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarTareas();
}

btnHome.addEventListener('click', irAInicio);
btnOpenTasks.addEventListener('click', irATareas);

btnOpenMod2.addEventListener('click', () => {
  alert('Este es el Botón 2. Cuando me digas qué función querés acá, lo armamos.');
});

btnOpenMod3.addEventListener('click', () => {
  alert('Este es el Botón 3. Cuando me digas qué función querés acá, lo armamos.');
});

// Abrir / cerrar el formulario del botón +
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

// Selección de prioridad (Simple verde, Intermedio amarillo, Urgente rojo)
prioritySelector.querySelectorAll('.prio-option').forEach(btn => {
  btn.addEventListener('click', () => {
    prioritySelector.querySelectorAll('.prio-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    prioridadSeleccionada = btn.dataset.priority;
    inputTaskText.focus();
  });
});

// Crear nueva tarea
function crearNuevaTarea() {
  const texto = inputTaskText.value.trim();
  if (!texto) {
    inputTaskText.focus();
    return;
  }

  const nueva = {
    id: 'tarea-' + Date.now(),
    texto: texto,
    prioridad: prioridadSeleccionada,
    realizada: false
  };

  tareas.push(nueva);
  guardarTareas();
  renderizarTareas();

  // Limpiar y preparar para la siguiente
  inputTaskText.value = '';
  formNewTaskBox.classList.add('hidden');
}

btnSaveTask.addEventListener('click', crearNuevaTarea);

// Regla de Alejandro: Enter confirma o avanza
inputTaskText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    crearNuevaTarea();
  }
});

// Filtros
filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filtroActual = chip.dataset.filter;
    renderizarTareas();
  });
});

// Marcar como realizada o pendiente
function alternarRealizada(id) {
  const tarea = tareas.find(t => t.id === id);
  if (tarea) {
    tarea.realizada = !tarea.realizada;
    guardarTareas();
    renderizarTareas();
  }
}

// Eliminar tarea
function eliminarTarea(id) {
  tareas = tareas.filter(t => t.id !== id);
  guardarTareas();
  renderizarTareas();
}

// Dibujar la lista ordenada por prioridad (Urgente -> Intermedio -> Simple) y estado
function renderizarTareas() {
  tasksList.innerHTML = '';

  let listaFiltrada = [...tareas];
  if (filtroActual === 'pendientes') {
    listaFiltrada = listaFiltrada.filter(t => !t.realizada);
  } else if (filtroActual === 'realizadas') {
    listaFiltrada = listaFiltrada.filter(t => t.realizada);
  }

  // Ordenar: primero las pendientes antes que las realizadas, y dentro de eso por prioridad (Rojo -> Amarillo -> Verde)
  listaFiltrada.sort((a, b) => {
    if (a.realizada !== b.realizada) {
      return a.realizada ? 1 : -1;
    }
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
        <button class="btn-done ${tarea.realizada ? 'is-done' : ''}" data-action="toggle" data-id="${tarea.id}">
          ${tarea.realizada ? '↩ Volver a pendiente' : '✓ Realizada'}
        </button>
        <button class="btn-delete" data-action="delete" data-id="${tarea.id}">
          ✕ Eliminar
        </button>
      </div>
    `;

    fila.querySelector('[data-action="toggle"]').addEventListener('click', () => alternarRealizada(tarea.id));
    fila.querySelector('[data-action="delete"]').addEventListener('click', () => eliminarTarea(tarea.id));

    tasksList.appendChild(fila);
  });
}

function escaparHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Inicializar
mostrarFechaHoy();
actualizarContadorInicio();
renderizarTareas();
