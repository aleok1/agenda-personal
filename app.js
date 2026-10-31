// Configuración de tiempos: 1 hora para sesión sin contraseña y 1 hora para auto-borrar tareas realizadas
const UNA_HORA_MS = 60 * 60 * 1000;
const STORAGE_SESSIONS_KEY = 'agenda_familiar_sesiones_v1';

const IDS_EJEMPLO = new Set(['t-1', 't-2', 't-3', 'r-1']);
const PESO_PRIORIDAD = { urgente: 1, intermedio: 2, simple: 3 };
const ETIQUETA_PRIORIDAD = { urgente: 'Urgente', intermedio: 'Intermedio', simple: 'Simple' };
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const urlParams = new URLSearchParams(window.location.search);
const ES_MODO_EXTERNO = urlParams.get('modo') === 'externo';
const USUARIO_EXTERNO_DESTINO = urlParams.get('para') || 'alejandro';

const API_SYNC_URL = 'https://agenda-personal-aleok.vercel.app/api/sync';
const API_CHAT_URL = 'https://agenda-personal-aleok.vercel.app/api/chat';

function obtenerFechaISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const hoyDate = new Date();
const HOY_ISO = obtenerFechaISO(hoyDate);

// Estado global de usuarios y sesión activa
let listaUsuariosPublica = [
  { id: 'alejandro', nombre: 'Alejandro', esAdmin: true, tienePassword: false }
];
let usuarioActivo = null; // { id, nombre, esAdmin, password }
let usuarioSeleccionadoParaLogin = null;

// Datos privados del usuario que ingresó
let borrados = [];
let tareas = [];
let avisosTareas = [];
let recordatorios = [];
let movimientos = [];
let supermercado = [];
let heladera = [];
let entrenamiento = null;
let superCompartidoCon = [];
let yaConfiguroCasa = false;
let seleccionConvivientesTemp = new Set();

let prioridadSeleccionada = 'simple';
let prioridadExternaSeleccionada = 'simple';
let prioridadPedirUsuario = 'simple';
let filtroActual = 'todas';

let mesActualVista = hoyDate.getMonth();
let anioActualVista = hoyDate.getFullYear();
let fechaSeleccionadaISO = HOY_ISO;

let tipoMovimientoActual = 'gasto';
let medioPagoActual = 'efectivo';
let sincronizando = false;
let navegandoPorHistorial = false;

function registrarPasoHistorial(vistaNombre) {
  if (navegandoPorHistorial || ES_MODO_EXTERNO) return;
  try {
    history.pushState({ vista: vistaNombre }, '');
  } catch (e) {}
}

// Elementos del DOM
const viewUsers = document.getElementById('view-users');
const viewHome = document.getElementById('view-home');
const viewTasks = document.getElementById('view-tasks');
const viewAgenda = document.getElementById('view-agenda');
const viewWallet = document.getElementById('view-wallet');
const viewAssistant = document.getElementById('view-assistant');
const viewExtras = document.getElementById('view-extras');
const viewExternal = document.getElementById('view-external');

const btnSwitchUser = document.getElementById('btn-switch-user');
const btnHome = document.getElementById('btn-home');
const activeUserBadge = document.getElementById('active-user-badge');
const syncStatusEl = document.getElementById('sync-status');
const currentDateEl = document.getElementById('current-date');
const userWelcomeSubtitle = document.getElementById('user-welcome-subtitle');

// Elementos de Usuarios y Login
const usersGrid = document.getElementById('users-grid');
const btnNewUserToggle = document.getElementById('btn-new-user-toggle');
const createUserBox = document.getElementById('create-user-box');
const inputNewUserName = document.getElementById('input-new-user-name');
const inputNewUserPass = document.getElementById('input-new-user-pass');
const btnCancelNewUser = document.getElementById('btn-cancel-new-user');
const btnSaveNewUser = document.getElementById('btn-save-new-user');

const loginPasswordBox = document.getElementById('login-password-box');
const loginBoxTitle = document.getElementById('login-box-title');
const loginBoxSubtitle = document.getElementById('login-box-subtitle');
const labelLoginPassword = document.getElementById('label-login-password');
const inputLoginPassword = document.getElementById('input-login-password');
const btnToggleLoginPass = document.getElementById('btn-toggle-login-pass');
const btnToggleNewPass = document.getElementById('btn-toggle-new-pass');

function configurarBotonOjito(btn, inputEl) {
  if (!btn || !inputEl) return;
  btn.addEventListener('click', () => {
    const oculto = inputEl.type === 'password';
    inputEl.type = oculto ? 'text' : 'password';
    btn.textContent = oculto ? '🙈' : '👁️';
    inputEl.focus();
  });
}

configurarBotonOjito(btnToggleLoginPass, inputLoginPassword);
configurarBotonOjito(btnToggleNewPass, inputNewUserPass);
const loginErrorMsg = document.getElementById('login-error-msg');
const btnCancelLogin = document.getElementById('btn-cancel-login');
const btnConfirmLogin = document.getElementById('btn-confirm-login');

// Elementos de Huella Digital / Biometría
const btnToggleBiometrics = document.getElementById('btn-toggle-biometrics');
const boxFingerprintLogin = document.getElementById('box-fingerprint-login');
const btnLoginFingerprint = document.getElementById('btn-login-fingerprint');
const btnLoginFingerprintTitle = document.getElementById('btn-login-fingerprint-title');
const bannerEnrollBiometrics = document.getElementById('banner-enroll-biometrics');
const btnActivateBioBanner = document.getElementById('btn-activate-bio-banner');
const btnDismissBioBanner = document.getElementById('btn-dismiss-bio-banner');
const biometricsModalBox = document.getElementById('biometrics-modal-box');
const btnCloseBiometricsModal = document.getElementById('btn-close-biometrics-modal');
const biometricsModalStatusText = document.getElementById('biometrics-modal-status-text');
const biometricsModalActions = document.getElementById('biometrics-modal-actions');

// Elementos de Pedir tarea a otro usuario y Admin
const btnAskOtherUser = document.getElementById('btn-ask-other-user');
const askUserTaskBox = document.getElementById('ask-user-task-box');
const btnCloseAskUser = document.getElementById('btn-close-ask-user');
const selectTargetUser = document.getElementById('select-target-user');
const inputAskUserText = document.getElementById('input-ask-user-text');
const askUserPrioritySelector = document.getElementById('ask-user-priority-selector');
const btnSendAskUser = document.getElementById('btn-send-ask-user');
const askUserSuccessMsg = document.getElementById('ask-user-success-msg');

const btnAdminUsers = document.getElementById('btn-admin-users');
const adminUsersBox = document.getElementById('admin-users-box');
const btnCloseAdminUsers = document.getElementById('btn-close-admin-users');
const adminUsersList = document.getElementById('admin-users-list');

// Botones principales de la agenda
const btnOpenTasks = document.getElementById('btn-open-tasks');
const btnOpenAgenda = document.getElementById('btn-open-agenda');
const btnOpenWallet = document.getElementById('btn-open-wallet');
const btnOpenAssistant = document.getElementById('btn-open-assistant');
const btnOpenExtras = document.getElementById('btn-open-extras');
const homeTasksCounter = document.getElementById('home-tasks-counter');
const homeAgendaCounter = document.getElementById('home-agenda-counter');
const homeWalletCounter = document.getElementById('home-wallet-counter');
const homeExtrasCounter = document.getElementById('home-extras-counter');

// Compartir
const btnShareLink = document.getElementById('btn-share-link');
const btnShareFromTasks = document.getElementById('btn-share-from-tasks');
const shareModalBox = document.getElementById('share-modal-box');
const btnCloseShare = document.getElementById('btn-close-share');
const inputShareUrl = document.getElementById('input-share-url');
const btnCopyShareUrl = document.getElementById('btn-copy-share-url');
const btnWhatsappShare = document.getElementById('btn-whatsapp-share');
const shareCopiedMsg = document.getElementById('share-copied-msg');

// Modo externo
const inputExtName = document.getElementById('input-ext-name');
const inputExtTask = document.getElementById('input-ext-task');
const extPrioritySelector = document.getElementById('ext-priority-selector');
const btnSendExtTask = document.getElementById('btn-send-ext-task');
const extSuccessMsg = document.getElementById('ext-success-msg');

// Aviso de actividades de hoy y respuestas de tareas
const todayAlertBanner = document.getElementById('today-alert-banner');
const todayAlertHeading = document.getElementById('today-alert-heading');
const todayAlertList = document.getElementById('today-alert-list');
const btnAlertGoAgenda = document.getElementById('btn-alert-go-agenda');
const btnAlertClose = document.getElementById('btn-alert-close');

const taskResponsesBanner = document.getElementById('task-responses-banner');
const taskResponsesList = document.getElementById('task-responses-list');
const btnClearTaskResponses = document.getElementById('btn-clear-task-responses');

// Tareas
const btnNewTask = document.getElementById('btn-new-task');
const formNewTaskBox = document.getElementById('form-new-task-box');
const inputTaskText = document.getElementById('input-task-text');
const prioritySelector = document.getElementById('priority-selector');
const btnCancelTask = document.getElementById('btn-cancel-task');
const btnSaveTask = document.getElementById('btn-save-task');
const tasksList = document.getElementById('tasks-list');
const filterChips = document.querySelectorAll('.filter-chip');

// Agenda Mensual
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

// Billetera
const balanceEfectivoVal = document.getElementById('balance-efectivo-val');
const balanceVirtualVal = document.getElementById('balance-virtual-val');
const walletActionBtns = document.querySelectorAll('.wallet-action-btn');
const walletFormBox = document.getElementById('wallet-form-box');
const walletFormTitle = document.getElementById('wallet-form-title');
const inputWalletAmount = document.getElementById('input-wallet-amount');
const walletMedioSelector = document.getElementById('wallet-medio-selector');
const walletDescGroup = document.getElementById('wallet-desc-group');
const labelWalletDesc = document.getElementById('label-wallet-desc');
const inputWalletDesc = document.getElementById('input-wallet-desc');
const btnCancelWallet = document.getElementById('btn-cancel-wallet');
const btnSaveWallet = document.getElementById('btn-save-wallet');
const walletMovementsList = document.getElementById('wallet-movements-list');

function formatearPesos(num) {
  const n = Number(num) || 0;
  return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escaparHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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

// =========================================================================
// CONTROL DE SESIÓN DE 1 HORA POR USUARIO (SIN PEDIR CONTRASEÑA SI < 1 HORA)
// =========================================================================
function leerSesionesGuardadas() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SESSIONS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function registrarActividadSesion() {
  if (!usuarioActivo) return;
  const sesiones = leerSesionesGuardadas();
  sesiones[usuarioActivo.id] = {
    password: usuarioActivo.password,
    ultimaActividad: Date.now()
  };
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sesiones));
}

function obtenerTiempoBloqueoUsuario(usuarioId) {
  let min = 60;
  try {
    const guardado = localStorage.getItem('agenda_bloqueo_' + usuarioId);
    if (guardado) {
      min = Number(guardado) || 60;
    } else if (usuarioActivo && usuarioActivo.id === usuarioId && usuarioActivo.tiempoBloqueoMin) {
      min = Number(usuarioActivo.tiempoBloqueoMin) || 60;
    }
  } catch (e) {}
  return min * 60 * 1000;
}

function obtenerPasswordSesionVigente(usuarioId) {
  const sesiones = leerSesionesGuardadas();
  const info = sesiones[usuarioId];
  if (!info || !info.password || !info.ultimaActividad) return null;
  const timeoutMs = obtenerTiempoBloqueoUsuario(usuarioId);
  // Si pasó el tiempo configurado por el usuario sin usarse, caduca y vuelve a pedir contraseña
  if (Date.now() - info.ultimaActividad >= timeoutMs) {
    delete sesiones[usuarioId];
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sesiones));
    return null;
  }
  return info.password;
}

// Actualizar marca de actividad cuando el usuario toca o usa la app
window.addEventListener('click', () => {
  if (usuarioActivo) {
    const passVigente = obtenerPasswordSesionVigente(usuarioActivo.id);
    if (!passVigente) {
      // Pasó más de 1 hora de inactividad: volver a pantalla de usuarios y pedir contraseña
      volverAPantallaUsuarios();
    } else {
      registrarActividadSesion();
    }
  }
});

// =========================================================================
// PANTALLA 0: SELECCIÓN DE USUARIO, LOGIN Y CREACIÓN DE NUEVOS USUARIOS
// =========================================================================
async function cargarListaDeUsuarios() {
  actualizarEstadoSync('☁️ Conectando...', 'amarillo');
  try {
    const res = await fetch(API_SYNC_URL + '?accion=lista_usuarios&t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.usuarios) && data.usuarios.length > 0) {
        listaUsuariosPublica = data.usuarios;
      }
      actualizarEstadoSync('☁️ En línea', 'verde');
    }
  } catch (e) {
    actualizarEstadoSync('☁️ Sin conexión', 'amarillo');
  }
  renderizarGrillaUsuarios();
}

const AVATARES_USUARIOS = ['👤', '🦁', '🐯', '🦊', '🐻', '🐼', '🐨', '🐶', '🐱', '🦄', '🦖', '🦅', '🦋', '🌟', '🔥', '⚡', '🍀', '🌸', '⚽', '🎮', '🎸', '🚀', '💎', '🕶️'];
const btnChangeAvatar = document.getElementById('btn-change-avatar');
const avatarPickerBox = document.getElementById('avatar-picker-box');
const btnCloseAvatarPicker = document.getElementById('btn-close-avatar-picker');
const avatarOptionsGrid = document.getElementById('avatar-options-grid');

function renderizarGrillaUsuarios() {
  if (!usersGrid) return;
  usersGrid.innerHTML = '';

  listaUsuariosPublica.forEach(u => {
    const sesionActiva = obtenerPasswordSesionVigente(u.id);
    const tieneHuella = tieneHuellaGuardada(u.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `big-card ${u.esAdmin ? 'card-primary' : 'card-agenda'}`;

    const icono = u.esAdmin ? '👑' : (u.avatar || '👤');
    const sub = u.esAdmin ? 'Administrador de la aplicación' : 'Agenda personal privada';
    const estadoBadge = !u.tienePassword
      ? 'Configurar contraseña por 1ª vez'
      : (sesionActiva ? '🔓 Sesión activa (< 1h)' : (tieneHuella ? '👆 Huella activada' : '🔒 Requiere contraseña'));

    const huellaBadgeHTML = tieneHuella ? '<div class="badge-huella">👆 Huella lista</div>' : '';

    card.innerHTML = `
      <div class="card-icon">${icono}</div>
      <div class="card-title">${escaparHTML(u.nombre)}</div>
      <div class="card-desc">${sub}</div>
      ${huellaBadgeHTML}
      <div class="card-badge ${u.esAdmin ? '' : 'badge-agenda'}">${estadoBadge}</div>
    `;

    card.addEventListener('click', () => seleccionarUsuarioParaEntrar(u));
    usersGrid.appendChild(card);
  });
}

async function seleccionarUsuarioParaEntrar(u) {
  createUserBox.classList.add('hidden');
  loginErrorMsg.classList.add('hidden');
  usuarioSeleccionadoParaLogin = u;

  // Verificar si tiene sesión vigente de menos de 1 hora
  const passGuardada = obtenerPasswordSesionVigente(u.id);
  if (u.tienePassword && passGuardada) {
    await intentarIngresoConPassword(u, passGuardada, true);
    return;
  }

  // Verificar si tiene huella registrada en este celular
  const tieneHuella = u.tienePassword && tieneHuellaGuardada(u.id);

  // Mostrar cuadro para ingresar o crear contraseña
  loginPasswordBox.classList.remove('hidden');
  inputLoginPassword.value = '';

  if (boxFingerprintLogin) {
    if (tieneHuella) {
      boxFingerprintLogin.classList.remove('hidden');
      if (btnLoginFingerprintTitle) {
        btnLoginFingerprintTitle.textContent = `Desbloquear a ${u.nombre} con huella`;
      }
      // Solicitar automáticamente la lectura biométrica
      solicitarDesbloqueoConHuella(u);
    } else {
      boxFingerprintLogin.classList.add('hidden');
    }
  }

  if (!u.tienePassword) {
    loginBoxTitle.textContent = `🔑 Crear contraseña para ${u.nombre}`;
    loginBoxSubtitle.textContent = 'Como es tu primera vez entrando, elegí tu contraseña privada. La app te recordará durante 1 hora de uso.';
    labelLoginPassword.textContent = 'Elegí tu contraseña';
  } else {
    loginBoxTitle.textContent = `🔒 Ingresar como ${u.nombre}`;
    loginBoxSubtitle.textContent = tieneHuella
      ? 'Tocá el botón para usar tu huella o escribí tu contraseña privada:'
      : 'Ingresá tu contraseña privada para abrir tu agenda.';
    labelLoginPassword.textContent = 'Tu contraseña';
  }

  if (!tieneHuella) {
    inputLoginPassword.focus();
  }
}

btnCancelLogin.addEventListener('click', () => {
  loginPasswordBox.classList.add('hidden');
  usuarioSeleccionadoParaLogin = null;
});

btnConfirmLogin.addEventListener('click', () => {
  if (!usuarioSeleccionadoParaLogin) return;
  const pass = inputLoginPassword.value.trim();
  if (!pass) {
    inputLoginPassword.focus();
    return;
  }
  intentarIngresoConPassword(usuarioSeleccionadoParaLogin, pass, false);
});

inputLoginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnConfirmLogin.click();
  }
});

async function intentarIngresoConPassword(u, pass, eraAutomatico) {
  btnConfirmLogin.disabled = true;
  btnConfirmLogin.textContent = 'Verificando...';
  loginErrorMsg.classList.add('hidden');

  try {
    const accion = !u.tienePassword ? 'configurar_password' : 'ingresar_usuario';
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: accion,
        usuarioId: u.id,
        password: pass
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (eraAutomatico) {
        // Si falló el login automático, pedir la contraseña normalmente
        loginPasswordBox.classList.remove('hidden');
        inputLoginPassword.focus();
      } else {
        loginErrorMsg.textContent = data.error || 'Contraseña incorrecta';
        loginErrorMsg.classList.remove('hidden');
        inputLoginPassword.select();
      }
      return;
    }

    // Login exitoso
    usuarioActivo = {
      id: u.id,
      nombre: u.nombre,
      esAdmin: Boolean(u.esAdmin),
      avatar: u.esAdmin ? '👑' : (data.usuario?.avatar || u.avatar || '👤'),
      password: pass,
      tiempoBloqueoMin: data.tiempoBloqueoMin || Number(localStorage.getItem('agenda_bloqueo_' + u.id)) || 60
    };
    if (data.tiempoBloqueoMin) {
      localStorage.setItem('agenda_bloqueo_' + u.id, data.tiempoBloqueoMin);
    }
    if (Array.isArray(data.usuarios)) {
      listaUsuariosPublica = data.usuarios;
    }

    tareas = Array.isArray(data.tareas) ? data.tareas : [];
    avisosTareas = Array.isArray(data.avisosTareas) ? data.avisosTareas : [];
    recordatorios = Array.isArray(data.recordatorios) ? data.recordatorios : [];
    movimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
    supermercado = Array.isArray(data.supermercado) ? data.supermercado : [];
    heladera = Array.isArray(data.heladera) ? data.heladera : [];
    entrenamiento = data.entrenamiento || null;
    superCompartidoCon = Array.isArray(data.superCompartidoCon) ? data.superCompartidoCon : [];
    yaConfiguroCasa = Boolean(data.yaConfiguroCasa);
    borrados = Array.isArray(data.borrados) ? data.borrados : [];

    registrarActividadSesion();
    loginPasswordBox.classList.add('hidden');
    entrarAMenuDeUsuarioActivo();
  } catch (e) {
    loginErrorMsg.textContent = 'Error de conexión. Intentá nuevamente.';
    loginErrorMsg.classList.remove('hidden');
  } finally {
    btnConfirmLogin.disabled = false;
    btnConfirmLogin.textContent = 'Entrar (Enter)';
  }
}

// Crear un + Nuevo Usuario
btnNewUserToggle.addEventListener('click', () => {
  loginPasswordBox.classList.add('hidden');
  createUserBox.classList.toggle('hidden');
  if (!createUserBox.classList.contains('hidden')) {
    inputNewUserName.value = '';
    inputNewUserPass.value = '';
    inputNewUserName.focus();
  }
});

btnCancelNewUser.addEventListener('click', () => {
  createUserBox.classList.add('hidden');
});

inputNewUserName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    inputNewUserPass.focus();
  }
});

inputNewUserPass.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    crearNuevoUsuarioFamiliar();
  }
});

btnSaveNewUser.addEventListener('click', crearNuevoUsuarioFamiliar);

async function crearNuevoUsuarioFamiliar() {
  const nombre = inputNewUserName.value.trim();
  const pass = inputNewUserPass.value.trim();
  if (!nombre) { inputNewUserName.focus(); return; }
  if (!pass) { inputNewUserPass.focus(); return; }

  btnSaveNewUser.disabled = true;
  btnSaveNewUser.textContent = 'Creando...';

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'crear_usuario',
        nombre: nombre,
        password: pass
      })
    });

    const data = await res.json();
    if (res.ok && data.usuario) {
      listaUsuariosPublica = data.usuarios || listaUsuariosPublica;
      usuarioActivo = {
        id: data.usuario.id,
        nombre: data.usuario.nombre,
        esAdmin: false,
        avatar: data.usuario.avatar || '👤',
        password: pass
      };
      tareas = [];
      avisosTareas = [];
      recordatorios = [];
      movimientos = [];
      supermercado = [];
      heladera = [];
      entrenamiento = null;
      superCompartidoCon = [];
      yaConfiguroCasa = false;
      borrados = [];
      registrarActividadSesion();
      createUserBox.classList.add('hidden');
      entrarAMenuDeUsuarioActivo();
    } else {
      alert(data.error || 'No se pudo crear el usuario');
    }
  } catch (e) {
    alert('Error de conexión al crear el usuario');
  } finally {
    btnSaveNewUser.disabled = false;
    btnSaveNewUser.textContent = 'Crear usuario (Enter)';
  }
}

function renderizarSelectorAvatares() {
  if (!avatarOptionsGrid || !usuarioActivo) return;
  avatarOptionsGrid.innerHTML = '';
  const avatarActual = usuarioActivo.avatar || '👤';

  AVATARES_USUARIOS.forEach(av => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `avatar-option-btn ${av === avatarActual ? 'active' : ''}`;
    btn.textContent = av;
    btn.addEventListener('click', () => {
      if (usuarioActivo.esAdmin) return;
      usuarioActivo.avatar = av;
      activeUserBadge.textContent = `${av} ${usuarioActivo.nombre}`;
      const encontrado = listaUsuariosPublica.find(u => u.id === usuarioActivo.id);
      if (encontrado) encontrado.avatar = av;
      if (avatarPickerBox) avatarPickerBox.classList.add('hidden');
      guardarEnNube();
    });
    avatarOptionsGrid.appendChild(btn);
  });
}

if (btnChangeAvatar) {
  btnChangeAvatar.addEventListener('click', () => {
    if (!usuarioActivo || usuarioActivo.esAdmin) return;
    askUserTaskBox.classList.add('hidden');
    adminUsersBox.classList.add('hidden');
    shareModalBox.classList.add('hidden');
    if (avatarPickerBox) {
      avatarPickerBox.classList.toggle('hidden');
      if (!avatarPickerBox.classList.contains('hidden')) {
        renderizarSelectorAvatares();
      }
    }
  });
}

if (btnCloseAvatarPicker && avatarPickerBox) {
  btnCloseAvatarPicker.addEventListener('click', () => avatarPickerBox.classList.add('hidden'));
}

// =========================================================================
// SISTEMA DE DESBLOQUEO POR HUELLA DIGITAL (WEBAUTHN / BIOMETRÍA AISLADA POR USUARIO)
// =========================================================================
async function esBiometriaSoportada() {
  if (window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      return false;
    }
  }
  return false;
}

function tieneHuellaGuardada(usuarioId) {
  if (!usuarioId) return false;
  try {
    const raw = localStorage.getItem('agenda_bio_' + usuarioId);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Boolean(data && data.credId && data.pass);
  } catch (e) {
    return false;
  }
}

function desvincularHuella(usuarioId) {
  if (!usuarioId) return;
  localStorage.removeItem('agenda_bio_' + usuarioId);
  actualizarEstadoBotonHuella();
  renderizarGrillaUsuarios();
}

async function activarHuellaParaUsuario(u, password) {
  if (!window.PublicKeyCredential) {
    alert('Tu navegador no soporta autenticación biométrica / huella digital.');
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode('agenda_user_' + u.id);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: {
          name: 'Agenda Familiar',
          id: window.location.hostname
        },
        user: {
          id: userIdBytes,
          name: (u.nombre || 'usuario').toLowerCase().replace(/[^a-z0-9]/g, '') || 'usuario',
          displayName: u.nombre || 'Usuario'
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          requireResidentKey: false
        },
        timeout: 60000
      }
    });

    if (credential && credential.rawId) {
      const rawIdArr = new Uint8Array(credential.rawId);
      let binary = '';
      for (let i = 0; i < rawIdArr.byteLength; i++) {
        binary += String.fromCharCode(rawIdArr[i]);
      }
      const credIdBase64 = btoa(binary);

      const infoBio = {
        credId: credIdBase64,
        usuarioId: u.id,
        nombre: u.nombre,
        pass: password,
        activadoEl: new Date().toISOString()
      };

      localStorage.setItem('agenda_bio_' + u.id, JSON.stringify(infoBio));
      actualizarEstadoBotonHuella();
      renderizarGrillaUsuarios();
      alert(`¡Huella digital activada para ${u.nombre}! En los próximos ingresos podrás entrar apoyando tu dedo.`);
      return true;
    }
  } catch (err) {
    console.warn('Error al activar huella:', err);
    if (err.name === 'NotAllowedError') {
      return false;
    }
    alert('No se pudo registrar la huella en este dispositivo: ' + (err.message || err.name));
    return false;
  }
  return false;
}

async function solicitarDesbloqueoConHuella(u) {
  const raw = localStorage.getItem('agenda_bio_' + u.id);
  if (!raw) return false;
  let infoBio;
  try {
    infoBio = JSON.parse(raw);
  } catch (e) {
    return false;
  }

  if (!infoBio.credId || !infoBio.pass) return false;

  try {
    if (btnLoginFingerprint) {
      btnLoginFingerprint.disabled = true;
      btnLoginFingerprint.style.opacity = '0.7';
    }
    if (btnLoginFingerprintTitle) {
      btnLoginFingerprintTitle.textContent = 'Apoyá tu huella en el sensor...';
    }

    const binary = atob(infoBio.credId);
    const credBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      credBytes[i] = binary.charCodeAt(i);
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        rpId: window.location.hostname,
        allowCredentials: [{
          type: 'public-key',
          id: credBytes,
          transports: ['internal']
        }],
        userVerification: 'required',
        timeout: 60000
      }
    });

    if (assertion) {
      // Huella validada exitosamente por el hardware del dispositivo para este usuario
      await intentarIngresoConPassword(u, infoBio.pass, true);
      return true;
    }
  } catch (err) {
    console.warn('Lectura de huella no completada:', err);
    if (err.name !== 'NotAllowedError' && loginErrorMsg) {
      loginErrorMsg.textContent = 'No se reconoció la huella. Podés ingresar tu contraseña.';
      loginErrorMsg.classList.remove('hidden');
    }
    if (inputLoginPassword) inputLoginPassword.focus();
  } finally {
    if (btnLoginFingerprint) {
      btnLoginFingerprint.disabled = false;
      btnLoginFingerprint.style.opacity = '1';
    }
    if (btnLoginFingerprintTitle) {
      btnLoginFingerprintTitle.textContent = `Desbloquear a ${u.nombre} con huella`;
    }
  }
  return false;
}

async function actualizarEstadoBotonHuella() {
  if (!btnToggleBiometrics) return;
  if (!usuarioActivo) {
    btnToggleBiometrics.classList.add('hidden');
    if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
    if (biometricsModalBox) biometricsModalBox.classList.add('hidden');
    return;
  }

  const soporta = await esBiometriaSoportada();
  if (!soporta) {
    btnToggleBiometrics.classList.add('hidden');
    if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
    return;
  }

  btnToggleBiometrics.classList.remove('hidden');
  const tiene = tieneHuellaGuardada(usuarioActivo.id);
  if (tiene) {
    btnToggleBiometrics.textContent = '👆 Huella activada';
    if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
  } else {
    btnToggleBiometrics.textContent = '👆 Activar huella';
    const descartado = localStorage.getItem('agenda_dismiss_bio_' + usuarioActivo.id);
    if (!descartado && bannerEnrollBiometrics) {
      bannerEnrollBiometrics.classList.remove('hidden');
    }
  }
}

if (btnLoginFingerprint) {
  btnLoginFingerprint.addEventListener('click', () => {
    if (usuarioSeleccionadoParaLogin) {
      solicitarDesbloqueoConHuella(usuarioSeleccionadoParaLogin);
    }
  });
}

if (btnActivateBioBanner) {
  btnActivateBioBanner.addEventListener('click', async () => {
    if (!usuarioActivo || !usuarioActivo.password) return;
    const ok = await activarHuellaParaUsuario(usuarioActivo, usuarioActivo.password);
    if (ok) {
      if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
      actualizarEstadoBotonHuella();
    }
  });
}

if (btnDismissBioBanner) {
  btnDismissBioBanner.addEventListener('click', () => {
    if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
    if (usuarioActivo) {
      localStorage.setItem('agenda_dismiss_bio_' + usuarioActivo.id, '1');
    }
  });
}

if (btnToggleBiometrics) {
  btnToggleBiometrics.addEventListener('click', () => {
    if (!usuarioActivo || !biometricsModalBox) return;
    const estaOculto = biometricsModalBox.classList.contains('hidden');
    if (estaOculto) {
      const tiene = tieneHuellaGuardada(usuarioActivo.id);
      if (tiene) {
        biometricsModalStatusText.innerHTML = `✅ La huella digital está <strong>activada</strong> en este celular para <strong>${escaparHTML(usuarioActivo.nombre)}</strong>.<br><span style="color:#d1fae5; font-size:0.88rem;">Solo tu huella puede desbloquear tu agenda aquí.</span>`;
        biometricsModalActions.innerHTML = `
          <button type="button" id="btn-modal-deactivate-bio" class="btn-secondary" style="border-color:#ef4444; color:#fca5a5; font-weight:600;">
            ❌ Desactivar huella en este celular
          </button>
        `;
        const btnDeact = document.getElementById('btn-modal-deactivate-bio');
        if (btnDeact) {
          btnDeact.addEventListener('click', () => {
            if (confirm(`¿Querés desactivar el ingreso con huella para ${usuarioActivo.nombre} en este celular? Deberás ingresar con contraseña.`)) {
              desvincularHuella(usuarioActivo.id);
              biometricsModalBox.classList.add('hidden');
              actualizarEstadoBotonHuella();
            }
          });
        }
      } else {
        biometricsModalStatusText.innerHTML = `Podés activar el desbloqueo con tu <strong>huella digital</strong> en este teléfono para tu usuario <strong>${escaparHTML(usuarioActivo.nombre)}</strong>.<br><span style="color:#d1fae5; font-size:0.88rem;">Así podrás ingresar en 1 segundo tocando el sensor.</span>`;
        biometricsModalActions.innerHTML = `
          <button type="button" id="btn-modal-activate-bio" class="btn-primary" style="background:#10b981; font-weight:700;">
            👆 Activar mi huella en este celular
          </button>
        `;
        const btnActModal = document.getElementById('btn-modal-activate-bio');
        if (btnActModal) {
          btnActModal.addEventListener('click', async () => {
            const ok = await activarHuellaParaUsuario(usuarioActivo, usuarioActivo.password);
            if (ok) {
              biometricsModalBox.classList.add('hidden');
              actualizarEstadoBotonHuella();
            }
          });
        }
      }
      biometricsModalBox.classList.remove('hidden');
    } else {
      biometricsModalBox.classList.add('hidden');
    }
  });
}

if (btnCloseBiometricsModal) {
  btnCloseBiometricsModal.addEventListener('click', () => {
    if (biometricsModalBox) biometricsModalBox.classList.add('hidden');
  });
}

// =========================================================================
// SISTEMA DE NOTIFICACIONES NATIVAS (AGENDA CON ANTICIPACIÓN + TAREAS DE OTROS)
// =========================================================================
const btnEnableNotifications = document.getElementById('btn-enable-notifications');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

function actualizarBotonPermisoNotificaciones() {
  if (!btnEnableNotifications || !usuarioActivo) {
    if (btnEnableNotifications) btnEnableNotifications.classList.add('hidden');
    return;
  }
  if (!('Notification' in window)) {
    btnEnableNotifications.classList.add('hidden');
    return;
  }
  if (Notification.permission === 'granted') {
    btnEnableNotifications.classList.add('hidden');
  } else {
    btnEnableNotifications.classList.remove('hidden');
  }
}

// Clave pública VAPID para suscripción Web Push en segundo plano
const VAPID_PUBLIC_KEY = 'BDbcZ7AA6npaBkQObZuhuTfrRM6ApUPCwKvSHiIebCatF4z0WumEGaLpQLLwjkhXwMCxDmGFQG3uCQ8vGngnDZ8';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function sincronizarSuscripcionWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !usuarioActivo) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    if (sub) {
      await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'suscribir_push',
          usuarioId: usuarioActivo.id,
          subscription: sub.toJSON()
        })
      });
    }
  } catch (e) {}
}

async function solicitarPermisoNotificaciones(mostrarConfirmacion) {
  if (!('Notification' in window)) {
    if (mostrarConfirmacion) alert('Tu navegador actual no soporta notificaciones del sistema.');
    return false;
  }
  if (Notification.permission === 'granted') {
    actualizarBotonPermisoNotificaciones();
    await sincronizarSuscripcionWebPush();
    if (mostrarConfirmacion) {
      alert('✓ Las notificaciones ya están activadas en este dispositivo.');
    }
    return true;
  }
  try {
    const permiso = await Notification.requestPermission();
    actualizarBotonPermisoNotificaciones();
    if (permiso === 'granted') {
      await sincronizarSuscripcionWebPush();
      if (mostrarConfirmacion) {
        enviarNotificacionCelular(
          '🔔 Notificaciones activadas',
          '¡Listo! Te avisaremos al celular con la app cerrada cuando te pidan tareas o se cumplan tus recordatorios.',
          'bienvenida-notif'
        );
      }
    }
    return permiso === 'granted';
  } catch (e) {
    return false;
  }
}

if (btnEnableNotifications) {
  btnEnableNotifications.addEventListener('click', () => solicitarPermisoNotificaciones(true));
}

async function enviarNotificacionCelular(titulo, cuerpo, tagUnico) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(titulo, {
          body: cuerpo,
          icon: 'logo.svg',
          badge: 'logo.svg',
          tag: tagUnico || ('notif-' + Date.now()),
          vibrate: [200, 100, 200]
        });
        return;
      }
    }
    new Notification(titulo, {
      body: cuerpo,
      icon: 'logo.svg',
      tag: tagUnico || ('notif-' + Date.now())
    });
  } catch (e) {}
}

function leerRegistroNotificadosUsuario() {
  if (!usuarioActivo) return { tareasConocidas: [], recordatoriosAvisados: [], avisosTareasConocidos: [], inicializado: false };
  try {
    const raw = localStorage.getItem('agenda_notificados_v1_' + usuarioActivo.id);
    if (!raw) return { tareasConocidas: [], recordatoriosAvisados: [], avisosTareasConocidos: [], inicializado: false };
    const parsed = JSON.parse(raw);
    return {
      tareasConocidas: Array.isArray(parsed.tareasConocidas) ? parsed.tareasConocidas : [],
      recordatoriosAvisados: Array.isArray(parsed.recordatoriosAvisados) ? parsed.recordatoriosAvisados : [],
      avisosTareasConocidos: Array.isArray(parsed.avisosTareasConocidos) ? parsed.avisosTareasConocidos : [],
      inicializado: Boolean(parsed.inicializado)
    };
  } catch (e) {
    return { tareasConocidas: [], recordatoriosAvisados: [], avisosTareasConocidos: [], inicializado: false };
  }
}

function guardarRegistroNotificadosUsuario(regObj) {
  if (!usuarioActivo) return;
  try {
    localStorage.setItem('agenda_notificados_v1_' + usuarioActivo.id, JSON.stringify(regObj));
  } catch (e) {}
}

function formatearTextoAnticipacion(minutos) {
  const m = Number(minutos);
  if (!m || m <= 0) return 'a la hora exacta';
  if (m === 60) return '1 hora antes';
  if (m === 120) return '2 horas antes';
  if (m === 1440) return '1 día antes';
  return `${m} min antes`;
}

function verificarNotificacionesPendientes(esIngresoInicial) {
  if (ES_MODO_EXTERNO || !usuarioActivo) return;
  const reg = leerRegistroNotificadosUsuario();
  const setTareas = new Set(reg.tareasConocidas);
  const setRecs = new Set(reg.recordatoriosAvisados);
  const setAvisos = new Set(reg.avisosTareasConocidos);
  let huboCambiosReg = false;

  // 1. Notificar cuando OTRA PERSONA agrega una tarea nueva (sin resumen del día)
  if (!reg.inicializado || esIngresoInicial) {
    tareas.forEach(t => {
      if (!setTareas.has(t.id)) {
        if (reg.inicializado && t.autor && !t.realizada && (Date.now() - (t.updatedAt || 0) < 30 * 60 * 1000)) {
          enviarNotificacionCelular(
            `📨 Nueva tarea de ${t.autor}`,
            `${t.texto} (Prioridad: ${ETIQUETA_PRIORIDAD[t.prioridad] || 'Simple'})`,
            'tarea-' + t.id
          );
        }
        setTareas.add(t.id);
        huboCambiosReg = true;
      }
    });
    if (!reg.inicializado) {
      reg.inicializado = true;
      huboCambiosReg = true;
    }
  } else {
    tareas.forEach(t => {
      if (!setTareas.has(t.id)) {
        setTareas.add(t.id);
        huboCambiosReg = true;
        if (t.autor && !t.realizada) {
          enviarNotificacionCelular(
            `📨 Nueva tarea de ${t.autor}`,
            `${t.texto} (Prioridad: ${ETIQUETA_PRIORIDAD[t.prioridad] || 'Simple'})`,
            'tarea-' + t.id
          );
        }
      }
    });
  }

  // 2. Notificar al usuario cuando una tarea que él le envió a alguien fue REALIZADA o RECHAZADA
  (avisosTareas || []).forEach(aviso => {
    if (!setAvisos.has(aviso.id)) {
      setAvisos.add(aviso.id);
      huboCambiosReg = true;
      const esRealizada = aviso.estado === 'realizada';
      const tituloNotif = esRealizada
        ? `✅ Tarea realizada por ${aviso.respondidoPor || 'el usuario'}`
        : `❌ Tarea rechazada por ${aviso.respondidoPor || 'el usuario'}`;
      const cuerpoNotif = esRealizada
        ? `Marcó como realizada la tarea que le enviaste: "${aviso.texto}"`
        : `Rechazó la tarea que le enviaste: "${aviso.texto}"`;

      enviarNotificacionCelular(tituloNotif, cuerpoNotif, 'aviso-' + aviso.id);
    }
  });

  // 3. Notificar actividades de la Agenda Mensual que tengan activada la notificación según su tiempo de anticipación
  const ahora = Date.now();
  recordatorios.forEach(rec => {
    if (rec.realizada || !rec.notificar || !rec.fecha || !rec.hora) return;
    if (setRecs.has(rec.id)) return;

    const [anio, mes, dia] = rec.fecha.split('-').map(Number);
    const [hora, min] = rec.hora.split(':').map(Number);
    if (!anio || !mes || !dia || isNaN(hora) || isNaN(min)) return;

    const tsEvento = new Date(anio, mes - 1, dia, hora, min, 0, 0).getTime();
    const minAntes = Number(rec.minutosAntes || 0);
    const tsAviso = tsEvento - (minAntes * 60 * 1000);

    if (ahora >= tsAviso && ahora <= tsEvento + (30 * 60 * 1000)) {
      const prefijoTiempo = minAntes === 0
        ? `⏰ Es la hora (${rec.hora} hs)`
        : `⏰ Aviso (${formatearTextoAnticipacion(minAntes)} — Hoy ${rec.hora} hs)`;

      enviarNotificacionCelular(
        `📅 Agenda: ${rec.texto}`,
        `${prefijoTiempo}`,
        'agenda-' + rec.id
      );
      setRecs.add(rec.id);
      huboCambiosReg = true;
    }
  });

  if (huboCambiosReg) {
    guardarRegistroNotificadosUsuario({
      tareasConocidas: Array.from(setTareas),
      recordatoriosAvisados: Array.from(setRecs),
      avisosTareasConocidos: Array.from(setAvisos),
      inicializado: true
    });
  }
}

function enviarRecordatoriosAlServiceWorker() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_REMINDERS',
      recordatorios: recordatorios
    });
  }
}

function entrarAMenuDeUsuarioActivo() {
  registrarPasoHistorial('home');
  viewUsers.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  viewHome.classList.remove('hidden');

  btnSwitchUser.classList.remove('hidden');
  btnHome.classList.add('hidden');
  const iconoUsuario = usuarioActivo.esAdmin ? '👑' : (usuarioActivo.avatar || '👤');
  activeUserBadge.textContent = `${iconoUsuario} ${usuarioActivo.nombre}`;
  activeUserBadge.classList.remove('hidden');
  btnAskOtherUser.classList.remove('hidden');
  if (btnShareLink) btnShareLink.classList.add('hidden');
  if (btnAdminUsers) btnAdminUsers.classList.add('hidden');
  if (btnEnableNotifications) btnEnableNotifications.classList.add('hidden');
  if (btnToggleBiometrics) btnToggleBiometrics.classList.add('hidden');
  sincronizarSuscripcionWebPush();

  // Avatar selector: solo el admin Alejandro tiene la corona exclusiva 👑 fija
  if (usuarioActivo.esAdmin) {
    if (btnChangeAvatar) btnChangeAvatar.classList.add('hidden');
  } else {
    if (btnChangeAvatar) btnChangeAvatar.classList.remove('hidden');
  }

  userWelcomeSubtitle.textContent = `Hola ${usuarioActivo.nombre}, seleccioná una sección de tu agenda privada`;

  limpiarTareasVencidas();
  actualizarContadoresYAlertas();
  renderizarTareas();
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
  renderizarBilletera();
  renderizarSupermercado();
  renderizarHeladera();
  renderizarEntrenamiento();
  verificarPreguntaUnicaConvivencia();
  verificarNotificacionesPendientes(true);
  enviarRecordatoriosAlServiceWorker();
  iniciarBienvenidaChat();
}

function volverAPantallaUsuarios() {
  registrarPasoHistorial('users');
  usuarioActivo = null;
  viewHome.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  const hp = document.getElementById('housemates-prompt-box');
  if (hp) hp.classList.add('hidden');
  todayAlertBanner.classList.add('hidden');
  askUserTaskBox.classList.add('hidden');
  adminUsersBox.classList.add('hidden');
  shareModalBox.classList.add('hidden');
  if (avatarPickerBox) avatarPickerBox.classList.add('hidden');

  btnSwitchUser.classList.add('hidden');
  btnHome.classList.add('hidden');
  activeUserBadge.classList.add('hidden');
  if (btnChangeAvatar) btnChangeAvatar.classList.add('hidden');
  if (btnEnableNotifications) btnEnableNotifications.classList.add('hidden');
  if (btnToggleBiometrics) btnToggleBiometrics.classList.add('hidden');
  if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
  if (biometricsModalBox) biometricsModalBox.classList.add('hidden');
  if (btnAskOtherUser) btnAskOtherUser.classList.add('hidden');
  if (btnAdminUsers) btnAdminUsers.classList.add('hidden');
  if (btnShareLink) btnShareLink.classList.add('hidden');

  viewUsers.classList.remove('hidden');
  cargarListaDeUsuarios();
}

btnSwitchUser.addEventListener('click', volverAPantallaUsuarios);

// =========================================================================
// PEDIR TAREA A OTRO USUARIO DE LA APP (DISPONIBLE PARA TODOS LOS USUARIOS)
// =========================================================================
btnAskOtherUser.addEventListener('click', () => {
  adminUsersBox.classList.add('hidden');
  shareModalBox.classList.add('hidden');
  askUserSuccessMsg.classList.add('hidden');
  askUserTaskBox.classList.toggle('hidden');

  if (!askUserTaskBox.classList.contains('hidden')) {
    const otros = listaUsuariosPublica.filter(u => !usuarioActivo || u.id !== usuarioActivo.id);
    selectTargetUser.innerHTML = '';
    if (otros.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Todavía no hay otros usuarios creados';
      selectTargetUser.appendChild(opt);
    } else {
      otros.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.nombre;
        selectTargetUser.appendChild(opt);
      });
    }
    inputAskUserText.focus();
  }
});

btnCloseAskUser.addEventListener('click', () => askUserTaskBox.classList.add('hidden'));

askUserPrioritySelector.querySelectorAll('.prio-option').forEach(btn => {
  btn.addEventListener('click', () => {
    askUserPrioritySelector.querySelectorAll('.prio-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    prioridadPedirUsuario = btn.dataset.priority;
    inputAskUserText.focus();
  });
});

inputAskUserText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    enviarTareaAOtroUsuario();
  }
});

btnSendAskUser.addEventListener('click', enviarTareaAOtroUsuario);

async function enviarTareaAOtroUsuario() {
  const destinoId = selectTargetUser.value;
  const texto = inputAskUserText.value.trim();
  if (!destinoId) {
    alert('Primero creá otro usuario con el botón "+ Nuevo usuario" en la pantalla de usuarios.');
    return;
  }
  if (!texto) {
    inputAskUserText.focus();
    return;
  }

  btnSendAskUser.disabled = true;
  btnSendAskUser.textContent = 'Enviando...';
  askUserSuccessMsg.classList.add('hidden');

  const nuevaTarea = {
    id: 'tarea-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    texto: texto,
    prioridad: prioridadPedirUsuario,
    autor: usuarioActivo ? usuarioActivo.nombre : 'Otro usuario',
    autorId: usuarioActivo ? usuarioActivo.id : null,
    realizada: false,
    completedAt: null,
    updatedAt: Date.now()
  };

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'pedir_tarea_usuario',
        destinoUsuarioId: destinoId,
        nuevaTarea: nuevaTarea
      })
    });
    if (res.ok) {
      inputAskUserText.value = '';
      askUserSuccessMsg.classList.remove('hidden');
      inputAskUserText.focus();
    } else {
      alert('No se pudo enviar la tarea.');
    }
  } catch (e) {
    alert('Error de conexión al enviar la tarea.');
  } finally {
    btnSendAskUser.disabled = false;
    btnSendAskUser.textContent = 'Enviar tarea al usuario (Enter)';
  }
}

// =========================================================================
// PANEL EXCLUSIVO DE ALEJANDRO: ELIMINAR USUARIOS
// =========================================================================
if (btnAdminUsers) {
  btnAdminUsers.addEventListener('click', () => {
    if (askUserTaskBox) askUserTaskBox.classList.add('hidden');
    if (shareModalBox) shareModalBox.classList.add('hidden');
    if (adminUsersBox) {
      adminUsersBox.classList.toggle('hidden');
      if (!adminUsersBox.classList.contains('hidden')) {
        renderizarListaAdminUsuarios();
      }
    }
  });
}

if (btnCloseAdminUsers && adminUsersBox) {
  btnCloseAdminUsers.addEventListener('click', () => adminUsersBox.classList.add('hidden'));
}

function renderizarListaAdminUsuarios() {
  if (!adminUsersList) return;
  adminUsersList.innerHTML = '';
  const otrosUsuarios = listaUsuariosPublica.filter(u => !u.esAdmin && u.id !== 'alejandro');

  if (otrosUsuarios.length === 0) {
    adminUsersList.innerHTML = `<div class="empty-state">No hay otros usuarios creados además del tuyo (Alejandro).</div>`;
    return;
  }

  otrosUsuarios.forEach(u => {
    const fila = document.createElement('div');
    fila.className = 'task-item';
    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill pill-hora">👤 Usuario</span>
        <span class="task-text">${escaparHTML(u.nombre)}</span>
      </div>
      <div class="task-actions">
        <button type="button" class="btn-delete" data-del-user="${u.id}">✕ Eliminar usuario</button>
      </div>
    `;

    fila.querySelector('[data-del-user]').addEventListener('click', async () => {
      if (!confirm(`¿Seguro que querés eliminar el usuario "${u.nombre}" y toda su agenda?`)) return;
      try {
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'eliminar_usuario',
            adminPassword: usuarioActivo.password,
            targetUsuarioId: u.id
          })
        });
        const data = await res.json();
        if (res.ok) {
          listaUsuariosPublica = data.usuarios || listaUsuariosPublica.filter(x => x.id !== u.id);
          renderizarListaAdminUsuarios();
          renderizarGrillaUsuarios();
        } else {
          alert(data.error || 'No se pudo eliminar');
        }
      } catch (e) {
        alert('Error de conexión al eliminar usuario.');
      }
    });

    adminUsersList.appendChild(fila);
  });
}

// ================================================================
// BOTÓN COMPARTIR LINK EXTERNO
// ================================================================
function obtenerUrlCompartirActual() {
  const uid = usuarioActivo ? usuarioActivo.id : 'alejandro';
  return `https://agenda-personal-aleok.vercel.app/?modo=externo&para=${encodeURIComponent(uid)}`;
}

function abrirCuadroCompartir() {
  askUserTaskBox.classList.add('hidden');
  adminUsersBox.classList.add('hidden');
  inputShareUrl.value = obtenerUrlCompartirActual();
  shareModalBox.classList.toggle('hidden');
  shareCopiedMsg.classList.add('hidden');
}

if (btnShareLink) btnShareLink.addEventListener('click', abrirCuadroCompartir);
if (btnShareFromTasks) btnShareFromTasks.addEventListener('click', abrirCuadroCompartir);
if (btnCloseShare) btnCloseShare.addEventListener('click', () => shareModalBox.classList.add('hidden'));

if (btnCopyShareUrl) {
  btnCopyShareUrl.addEventListener('click', async () => {
    const url = obtenerUrlCompartirActual();
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      inputShareUrl.select();
      document.execCommand('copy');
    }
    shareCopiedMsg.classList.remove('hidden');
  });
}

if (btnWhatsappShare) {
  btnWhatsappShare.addEventListener('click', () => {
    const url = obtenerUrlCompartirActual();
    const texto = `Hola, entrá a este link para cargarme una tarea en mi agenda: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  });
}

if (extPrioritySelector) {
  extPrioritySelector.querySelectorAll('.prio-option').forEach(btn => {
    btn.addEventListener('click', () => {
      extPrioritySelector.querySelectorAll('.prio-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      prioridadExternaSeleccionada = btn.dataset.priority;
      inputExtTask.focus();
    });
  });
}

if (inputExtName) {
  inputExtName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); inputExtTask.focus(); }
  });
}

if (inputExtTask) {
  inputExtTask.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); enviarTareaExterna(); }
  });
}

if (btnSendExtTask) btnSendExtTask.addEventListener('click', enviarTareaExterna);

async function enviarTareaExterna() {
  const nombre = inputExtName.value.trim();
  const texto = inputExtTask.value.trim();
  if (!nombre) { inputExtName.focus(); return; }
  if (!texto) { inputExtTask.focus(); return; }

  btnSendExtTask.disabled = true;
  btnSendExtTask.textContent = 'Enviando tarea...';
  extSuccessMsg.classList.add('hidden');

  const nuevaTarea = {
    id: 'tarea-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    texto: texto,
    prioridad: prioridadExternaSeleccionada,
    autor: nombre,
    realizada: false,
    completedAt: null,
    updatedAt: Date.now()
  };

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'agregar_externa',
        destinoUsuarioId: USUARIO_EXTERNO_DESTINO,
        nuevaTarea: nuevaTarea
      })
    });

    if (res.ok) {
      inputExtTask.value = '';
      extSuccessMsg.classList.remove('hidden');
      inputExtTask.focus();
    } else {
      alert('No se pudo enviar en este momento.');
    }
  } catch (e) {
    alert('Error de conexión al enviar la tarea.');
  } finally {
    btnSendExtTask.disabled = false;
    btnSendExtTask.textContent = 'Enviar tarea (Enter)';
  }
}

// ================================================================
// LIMPIEZA AUTOMÁTICA: BORRAR TAREAS REALIZADAS HACE MÁS DE 1 HORA
// ================================================================
function limpiarTareasVencidas() {
  if (!usuarioActivo) return false;
  const ahora = Date.now();
  let huboCambios = false;

  tareas = tareas.filter(t => {
    if (t.realizada) {
      if (!t.completedAt) {
        t.completedAt = t.updatedAt || ahora;
        huboCambios = true;
      }
      if (ahora - t.completedAt >= UNA_HORA_MS) {
        borrados.push(t.id);
        huboCambios = true;
        return false;
      }
    }
    return true;
  });

  if (huboCambios) {
    renderizarTareas();
  }
  return huboCambios;
}

function textoTiempoRestante(completedAt) {
  if (!completedAt) return '';
  const restanteMs = UNA_HORA_MS - (Date.now() - completedAt);
  if (restanteMs <= 0) return 'Se oculta ahora';
  const min = Math.ceil(restanteMs / 60000);
  return `Desaparece en ${min} min`;
}

// ====================================================
// SINCRONIZACIÓN EN LA NUBE DEL USUARIO ACTIVO
// ====================================================
async function sincronizarDesdeNube() {
  if (ES_MODO_EXTERNO || !usuarioActivo || sincronizando) return;

  // Verificar que no haya pasado más de 1 hora sin actividad
  if (!obtenerPasswordSesionVigente(usuarioActivo.id)) {
    volverAPantallaUsuarios();
    return;
  }

  sincronizando = true;
  try {
    const url = `${API_SYNC_URL}?accion=datos_usuario&usuarioId=${encodeURIComponent(usuarioActivo.id)}&password=${encodeURIComponent(usuarioActivo.password)}&t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      sincronizando = false;
      return;
    }
    const cloud = await res.json();
    if (Array.isArray(cloud.usuarios)) {
      listaUsuariosPublica = cloud.usuarios;
    }

    const setBorrados = new Set([...(cloud.borrados || []), ...borrados]);
    borrados = Array.from(setBorrados);

    tareas = (cloud.tareas || []).filter(x => !IDS_EJEMPLO.has(x.id) && !setBorrados.has(x.id));
    recordatorios = (cloud.recordatorios || []).filter(x => !IDS_EJEMPLO.has(x.id) && !setBorrados.has(x.id));
    movimientos = (cloud.movimientos || []).filter(x => !setBorrados.has(x.id));
    supermercado = Array.isArray(cloud.supermercado) ? cloud.supermercado : supermercado;
    heladera = Array.isArray(cloud.heladera) ? cloud.heladera : heladera;
    avisosTareas = Array.isArray(cloud.avisosTareas) ? cloud.avisosTareas : avisosTareas;
    if (cloud.entrenamiento !== undefined) entrenamiento = cloud.entrenamiento;
    if (cloud.avatar && !usuarioActivo.esAdmin) {
      usuarioActivo.avatar = cloud.avatar;
      activeUserBadge.textContent = `${usuarioActivo.avatar} ${usuarioActivo.nombre}`;
    }
    superCompartidoCon = Array.isArray(cloud.superCompartidoCon) ? cloud.superCompartidoCon : superCompartidoCon;
    if (typeof cloud.yaConfiguroCasa === 'boolean') yaConfiguroCasa = cloud.yaConfiguroCasa;

    const seLimpiaronVencidas = limpiarTareasVencidas();
    actualizarContadoresYAlertas();
    renderizarTareas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
    renderizarBilletera();
    renderizarSupermercado();
    renderizarHeladera();
    renderizarEntrenamiento();
    verificarPreguntaUnicaConvivencia();
    verificarNotificacionesPendientes(false);

    if (seLimpiaronVencidas) {
      await guardarEnNube();
    } else {
      actualizarEstadoSync('☁️ Sincronizado', 'verde');
    }
  } catch (e) {
    actualizarEstadoSync('☁️ En línea', 'amarillo');
  } finally {
    sincronizando = false;
  }
}

async function guardarEnNube(avisoParaAutor) {
  if (ES_MODO_EXTERNO || !usuarioActivo) return;
  registrarActividadSesion();
  actualizarContadoresYAlertas();
  actualizarEstadoSync('☁️ Guardando...', 'amarillo');
  try {
    const payload = {
      accion: 'sincronizar_usuario',
      usuarioId: usuarioActivo.id,
      password: usuarioActivo.password,
      avatar: usuarioActivo.avatar || '👤',
      tareas: tareas,
      avisosTareas: avisosTareas,
      recordatorios: recordatorios,
      movimientos: movimientos,
      supermercado: supermercado,
      heladera: heladera,
      entrenamiento: entrenamiento,
      tiempoBloqueoMin: usuarioActivo.tiempoBloqueoMin || 60,
      borrados: borrados
    };
    if (avisoParaAutor) {
      payload.avisoParaAutor = avisoParaAutor;
    }
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      actualizarEstadoSync('☁️ Sincronizado', 'verde');
    }
  } catch (e) {
    actualizarEstadoSync('☁️ Pendiente de señal', 'amarillo');
  }
}

function calcularSaldosBilletera() {
  let efectivo = 0;
  let virtual = 0;
  movimientos.forEach(m => {
    const monto = Number(m.monto) || 0;
    const signo = m.tipo === 'gasto' ? -1 : 1;
    if (m.medio === 'virtual') virtual += signo * monto;
    else efectivo += signo * monto;
  });
  return { efectivo, virtual };
}

function actualizarContadoresYAlertas() {
  if (ES_MODO_EXTERNO || !usuarioActivo) return;

  const tareasPendientes = tareas.filter(t => !t.realizada).length;
  homeTasksCounter.textContent = tareasPendientes === 1 ? '1 pendiente' : `${tareasPendientes} pendientes`;

  const recordatoriosDeHoyPendientes = recordatorios
    .filter(r => r.fecha === HOY_ISO && !r.realizada)
    .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));

  const cantHoy = recordatoriosDeHoyPendientes.length;
  homeAgendaCounter.textContent = cantHoy === 1 ? '1 actividad para hoy' : `${cantHoy} actividades para hoy`;

  const saldos = calcularSaldosBilletera();
  if (homeWalletCounter) {
    homeWalletCounter.textContent = `Efectivo ${formatearPesos(saldos.efectivo)} | Virtual ${formatearPesos(saldos.virtual)}`;
  }

  if (homeExtrasCounter) {
    homeExtrasCounter.textContent = '5 herramientas y ajustes';
  }

  if (cantHoy > 0) {
    todayAlertBanner.classList.remove('hidden');
    todayAlertHeading.textContent = cantHoy === 1
      ? `¡Hola ${usuarioActivo.nombre}! Tenés 1 actividad programada para hoy en tu Agenda Mensual:`
      : `¡Hola ${usuarioActivo.nombre}! Tenés ${cantHoy} actividades programadas para hoy en tu Agenda Mensual:`;

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

  // Avisos de tareas que pediste y fueron respondidas (Realizada / Rechazada)
  if (taskResponsesBanner && taskResponsesList) {
    if (Array.isArray(avisosTareas) && avisosTareas.length > 0) {
      taskResponsesBanner.classList.remove('hidden');
      taskResponsesList.innerHTML = '';
      avisosTareas.forEach(av => {
        const li = document.createElement('li');
        const esRealizada = av.estado === 'realizada';
        const icono = esRealizada ? '✅' : '❌';
        const colorBadge = esRealizada ? '#22c55e' : '#ef4444';
        const textoBadge = esRealizada ? 'Realizada' : 'Rechazada';
        li.innerHTML = `
          <span class="alert-time-badge" style="background:${colorBadge}; color:#ffffff; font-weight:700;">${icono} ${textoBadge}</span>
          <span><b>${escaparHTML(av.respondidoPor || 'El usuario')}</b> ${esRealizada ? 'completó' : 'rechazó'}: "${escaparHTML(av.texto)}"</span>
        `;
        taskResponsesList.appendChild(li);
      });
    } else {
      taskResponsesBanner.classList.add('hidden');
    }
  }
}

// Navegación interna del usuario
function irAInicio() {
  if (!usuarioActivo) { volverAPantallaUsuarios(); return; }
  registrarPasoHistorial('home');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  viewHome.classList.remove('hidden');
  btnHome.classList.add('hidden');
  actualizarContadoresYAlertas();
}

function irATareas() {
  registrarPasoHistorial('tasks');
  viewHome.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  viewTasks.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  limpiarTareasVencidas();
  renderizarTareas();
}

function irAAgenda(fechaISO) {
  registrarPasoHistorial('agenda');
  if (fechaISO) {
    fechaSeleccionadaISO = fechaISO;
    const [y, m] = fechaISO.split('-').map(Number);
    anioActualVista = y;
    mesActualVista = m - 1;
  }
  viewHome.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  viewAgenda.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
}

function irABilletera() {
  registrarPasoHistorial('wallet');
  viewHome.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  viewWallet.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarBilletera();
}

function irAAsistente() {
  registrarPasoHistorial('assistant');
  viewHome.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  viewAssistant.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  const inp = document.getElementById('input-chat-msg');
  if (inp) inp.focus();
}

function irAExtras() {
  registrarPasoHistorial('extras');
  viewHome.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  viewExtras.classList.remove('hidden');
  btnHome.classList.remove('hidden');

  // Solo mostrar el menú de opciones (sin abrir Supermercado ni ninguna otra herramienta automáticamente)
  mostrarMenuExtras();
}

// Manejar el botón físico/gesto "Atrás" del celular para que navegue adentro de la app sin salirse
window.addEventListener('popstate', () => {
  if (ES_MODO_EXTERNO) return;
  navegandoPorHistorial = true;
  try {
    // 1. Si hay algún cuadro superior abierto, cerrarlo primero
    if (askUserTaskBox && !askUserTaskBox.classList.contains('hidden')) {
      askUserTaskBox.classList.add('hidden');
      history.pushState({ vista: 'actual' }, '');
      return;
    }
    if (adminUsersBox && !adminUsersBox.classList.contains('hidden')) {
      adminUsersBox.classList.add('hidden');
      history.pushState({ vista: 'actual' }, '');
      return;
    }
    if (shareModalBox && !shareModalBox.classList.contains('hidden')) {
      shareModalBox.classList.add('hidden');
      history.pushState({ vista: 'actual' }, '');
      return;
    }

    // 2. Si está adentro de una herramienta de Extras, volver al menú de opciones de Extras
    if (viewExtras && !viewExtras.classList.contains('hidden') && extrasSubviewNav && !extrasSubviewNav.classList.contains('hidden')) {
      mostrarMenuExtras();
      history.pushState({ vista: 'extras' }, '');
      return;
    }

    // 3. Si está adentro de alguno de los módulos, volver al menú de inicio del usuario
    const enSubModulo =
      !viewTasks.classList.contains('hidden') ||
      !viewAgenda.classList.contains('hidden') ||
      !viewWallet.classList.contains('hidden') ||
      (viewAssistant && !viewAssistant.classList.contains('hidden')) ||
      (viewExtras && !viewExtras.classList.contains('hidden'));

    if (enSubModulo && usuarioActivo) {
      irAInicio();
      history.pushState({ vista: 'home' }, '');
      return;
    }

    // 3. Si está en el menú de los 5 botones del usuario, volver a la pantalla de selección de usuarios
    if (!viewHome.classList.contains('hidden')) {
      volverAPantallaUsuarios();
      history.pushState({ vista: 'users' }, '');
      return;
    }

    // 4. Si está en la pantalla de usuarios con el recuadro de contraseña o nuevo usuario abierto, cerrarlo
    if (!loginPasswordBox.classList.contains('hidden') || !createUserBox.classList.contains('hidden')) {
      loginPasswordBox.classList.add('hidden');
      createUserBox.classList.add('hidden');
      history.pushState({ vista: 'users' }, '');
      return;
    }
  } finally {
    navegandoPorHistorial = false;
  }
});

btnHome.addEventListener('click', irAInicio);
btnOpenTasks.addEventListener('click', irATareas);
btnOpenAgenda.addEventListener('click', () => irAAgenda());
btnOpenWallet.addEventListener('click', irABilletera);
if (btnOpenAssistant) btnOpenAssistant.addEventListener('click', irAAsistente);
if (btnOpenExtras) btnOpenExtras.addEventListener('click', irAExtras);
btnAlertGoAgenda.addEventListener('click', () => irAAgenda(HOY_ISO));
btnAlertClose.addEventListener('click', () => todayAlertBanner.classList.add('hidden'));

if (btnClearTaskResponses) {
  btnClearTaskResponses.addEventListener('click', () => {
    avisosTareas = [];
    if (taskResponsesBanner) taskResponsesBanner.classList.add('hidden');
    guardarEnNube();
  });
}

// ==========================================
// MÓDULO 1: LISTA DE TAREAS
// ==========================================
btnNewTask.addEventListener('click', () => {
  formNewTaskBox.classList.toggle('hidden');
  if (!formNewTaskBox.classList.contains('hidden')) inputTaskText.focus();
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
  if (!texto) { inputTaskText.focus(); return; }

  tareas.push({
    id: 'tarea-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    texto: texto,
    prioridad: prioridadSeleccionada,
    realizada: false,
    completedAt: null,
    updatedAt: Date.now()
  });

  renderizarTareas();
  inputTaskText.value = '';
  formNewTaskBox.classList.add('hidden');
  guardarEnNube();
}

btnSaveTask.addEventListener('click', crearNuevaTarea);
inputTaskText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); crearNuevaTarea(); }
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
  if (filtroActual === 'pendientes') listaFiltrada = listaFiltrada.filter(t => !t.realizada);
  else if (filtroActual === 'realizadas') listaFiltrada = listaFiltrada.filter(t => t.realizada);

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

    const etiquetaAutor = tarea.autor
      ? `<span class="author-badge">👤 Pedida por: ${escaparHTML(tarea.autor)}</span>`
      : '';

    const infoAutoBorrado = tarea.realizada && tarea.completedAt
      ? `<span style="font-size:0.78rem;color:#94a3b8;margin-left:6px;">(${textoTiempoRestante(tarea.completedAt)})</span>`
      : '';

    const botonRechazar = (tarea.autor && !tarea.realizada)
      ? `<button class="btn-delete" data-action="reject" style="background:rgba(239, 68, 68, 0.2); border-color:#ef4444; color:#fca5a5;" title="Rechazar y avisar al autor">✕ Rechazar</button>`
      : `<button class="btn-delete" data-action="delete">✕ Eliminar</button>`;

    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill pill-${tarea.prioridad}">
          ${ETIQUETA_PRIORIDAD[tarea.prioridad]}
        </span>
        <div>
          <span class="task-text">${escaparHTML(tarea.texto)}</span>
          ${etiquetaAutor}
          ${infoAutoBorrado}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-done ${tarea.realizada ? 'is-done' : ''}" data-action="toggle">
          ${tarea.realizada ? '↩ Pendiente' : '✓ Realizada'}
        </button>
        ${botonRechazar}
      </div>
    `;

    fila.querySelector('[data-action="toggle"]').addEventListener('click', () => {
      const eraRealizada = tarea.realizada;
      tarea.realizada = !tarea.realizada;
      tarea.completedAt = tarea.realizada ? Date.now() : null;
      tarea.updatedAt = Date.now();

      let avisoParaAutor = null;
      if (!eraRealizada && tarea.realizada && tarea.autor) {
        avisoParaAutor = {
          autorId: tarea.autorId || null,
          autorNombre: tarea.autor,
          estado: 'realizada',
          texto: tarea.texto
        };
      }

      renderizarTareas();
      guardarEnNube(avisoParaAutor);
    });

    const btnRechazar = fila.querySelector('[data-action="reject"]');
    if (btnRechazar) {
      btnRechazar.addEventListener('click', () => {
        if (!confirm(`¿Querés rechazar la tarea pedida por ${tarea.autor}? Se le notificará que fue rechazada.`)) return;
        const avisoParaAutor = {
          autorId: tarea.autorId || null,
          autorNombre: tarea.autor,
          estado: 'rechazada',
          texto: tarea.texto
        };
        borrados.push(tarea.id);
        tareas = tareas.filter(x => x.id !== tarea.id);
        renderizarTareas();
        guardarEnNube(avisoParaAutor);
      });
    }

    const btnBorrar = fila.querySelector('[data-action="delete"]');
    if (btnBorrar) {
      btnBorrar.addEventListener('click', () => {
        borrados.push(tarea.id);
        tareas = tareas.filter(x => x.id !== tarea.id);
        renderizarTareas();
        guardarEnNube();
      });
    }

    tasksList.appendChild(fila);
  });
}

// ==========================================
// MÓDULO 2: AGENDA MENSUAL
// ==========================================
btnPrevMonth.addEventListener('click', () => {
  mesActualVista--;
  if (mesActualVista < 0) { mesActualVista = 11; anioActualVista--; }
  renderizarCalendario();
});

btnNextMonth.addEventListener('click', () => {
  mesActualVista++;
  if (mesActualVista > 11) { mesActualVista = 0; anioActualVista++; }
  renderizarCalendario();
});

btnJumpToday.addEventListener('click', () => {
  anioActualVista = hoyDate.getFullYear();
  mesActualVista = hoyDate.getMonth();
  fechaSeleccionadaISO = HOY_ISO;
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
});

const checkReminderNotify = document.getElementById('check-reminder-notify');
const labelReminderNotify = document.getElementById('label-reminder-notify');
const reminderAdvanceWrap = document.getElementById('reminder-advance-wrap');
const selectReminderAdvance = document.getElementById('select-reminder-advance');

if (checkReminderNotify && labelReminderNotify) {
  checkReminderNotify.addEventListener('change', () => {
    const activo = checkReminderNotify.checked;
    labelReminderNotify.classList.toggle('unchecked', !activo);
    if (reminderAdvanceWrap) reminderAdvanceWrap.classList.toggle('hidden', !activo);
  });
}

btnNewReminder.addEventListener('click', () => inputReminderText.focus());
inputReminderTime.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); inputReminderText.focus(); }
});
inputReminderText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); guardarNuevoRecordatorio(); }
});
btnSaveReminder.addEventListener('click', guardarNuevoRecordatorio);

async function guardarNuevoRecordatorio() {
  const texto = inputReminderText.value.trim();
  if (!texto) { inputReminderText.focus(); return; }

  const quiereNotificar = checkReminderNotify ? checkReminderNotify.checked : false;
  const horaElegida = inputReminderTime.value || '';

  if (quiereNotificar && !horaElegida) {
    alert('Por favor elegí la hora de la actividad para que la app pueda notificarte con anticipación (o destildá "Notificarme en el celular").');
    inputReminderTime.focus();
    return;
  }

  if (quiereNotificar) {
    await solicitarPermisoNotificaciones(false);
  }

  const minAntes = (quiereNotificar && selectReminderAdvance)
    ? parseInt(selectReminderAdvance.value, 10)
    : 0;

  recordatorios.push({
    id: 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    fecha: fechaSeleccionadaISO,
    hora: horaElegida,
    texto: texto,
    notificar: quiereNotificar,
    minutosAntes: quiereNotificar ? minAntes : null,
    realizada: false,
    updatedAt: Date.now()
  });

  inputReminderText.value = '';
  inputReminderTime.value = '';
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
  verificarNotificacionesPendientes(false);
  enviarRecordatoriosAlServiceWorker();
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

    btnDia.innerHTML = `<span class="cal-day-number">${dia}</span>${badgeHtml}`;
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

    const badgeNotif = rec.notificar
      ? `<span class="priority-pill pill-simple">🔔 Avisa ${escaparHTML(formatearTextoAnticipacion(rec.minutosAntes))}</span>`
      : `<span class="priority-pill pill-hora" style="opacity:0.7;">🔕 Sin notificación</span>`;

    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill pill-hora">${escaparHTML(etiquetaHora)}</span>
        <span class="task-text">${escaparHTML(rec.texto)}</span>
        ${badgeNotif}
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

// ==========================================
// MÓDULO 3: BILLETERA
// ==========================================
function abrirFormularioBilletera(tipo) {
  tipoMovimientoActual = tipo;
  walletActionBtns.forEach(b => b.classList.toggle('active', b.dataset.walletType === tipo));
  walletFormBox.classList.remove('hidden');

  if (tipo === 'sueldo') {
    walletFormTitle.textContent = '💼 Cargar Sueldo (Ingreso Mensual)';
    walletDescGroup.classList.add('hidden');
  } else if (tipo === 'ingreso') {
    walletFormTitle.textContent = '➕ Cargar Ingreso Corriente';
    walletDescGroup.classList.remove('hidden');
    labelWalletDesc.textContent = '¿De qué es este ingreso?';
    inputWalletDesc.placeholder = 'Ej: Venta, cobro pendiente, reintegro...';
  } else {
    walletFormTitle.textContent = '➖ Cargar Gasto Corriente';
    walletDescGroup.classList.remove('hidden');
    labelWalletDesc.textContent = '¿De qué es este gasto?';
    inputWalletDesc.placeholder = 'Ej: Supermercado, nafta, comida, impuestos...';
  }

  inputWalletAmount.value = '';
  inputWalletDesc.value = '';
  inputWalletAmount.focus();
}

walletActionBtns.forEach(btn => {
  btn.addEventListener('click', () => abrirFormularioBilletera(btn.dataset.walletType));
});

walletMedioSelector.querySelectorAll('.prio-option').forEach(btn => {
  btn.addEventListener('click', () => {
    walletMedioSelector.querySelectorAll('.prio-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    medioPagoActual = btn.dataset.medio;
    if (tipoMovimientoActual === 'sueldo') inputWalletAmount.focus();
    else inputWalletDesc.focus();
  });
});

btnCancelWallet.addEventListener('click', () => {
  walletFormBox.classList.add('hidden');
  walletActionBtns.forEach(b => b.classList.remove('active'));
});

inputWalletAmount.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (tipoMovimientoActual === 'sueldo') guardarMovimientoBilletera();
    else inputWalletDesc.focus();
  }
});

inputWalletDesc.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); guardarMovimientoBilletera(); }
});

const selectWalletDate = document.getElementById('select-wallet-date');
let fechaFiltroBilletera = HOY_ISO;

if (selectWalletDate) {
  selectWalletDate.addEventListener('change', () => {
    fechaFiltroBilletera = selectWalletDate.value;
    renderizarBilletera();
  });
}

btnSaveWallet.addEventListener('click', guardarMovimientoBilletera);

function guardarMovimientoBilletera() {
  const monto = parseFloat(inputWalletAmount.value);
  if (!monto || monto <= 0) { inputWalletAmount.focus(); return; }

  let detalle = 'Sueldo mensual';
  if (tipoMovimientoActual !== 'sueldo') {
    detalle = inputWalletDesc.value.trim();
    if (!detalle) { inputWalletDesc.focus(); return; }
  }

  movimientos.push({
    id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    tipo: tipoMovimientoActual,
    medio: medioPagoActual,
    monto: monto,
    detalle: detalle,
    fecha: HOY_ISO,
    updatedAt: Date.now()
  });

  fechaFiltroBilletera = HOY_ISO;
  inputWalletAmount.value = '';
  inputWalletDesc.value = '';
  walletFormBox.classList.add('hidden');
  walletActionBtns.forEach(b => b.classList.remove('active'));

  renderizarBilletera();
  guardarEnNube();
}

function obtenerFechaDeMovimiento(mov) {
  if (mov.fecha) return mov.fecha;
  if (mov.updatedAt) return obtenerFechaISO(new Date(mov.updatedAt));
  return HOY_ISO;
}

function renderizarBilletera() {
  const saldos = calcularSaldosBilletera();
  balanceEfectivoVal.textContent = formatearPesos(saldos.efectivo);
  balanceVirtualVal.textContent = formatearPesos(saldos.virtual);
  actualizarContadoresYAlertas();

  walletMovementsList.innerHTML = '';
  const ordenados = [...movimientos].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // Armar el desplegable de fechas disponibles
  if (selectWalletDate) {
    const conteoPorFecha = new Map();
    ordenados.forEach(m => {
      const f = obtenerFechaDeMovimiento(m);
      conteoPorFecha.set(f, (conteoPorFecha.get(f) || 0) + 1);
    });
    if (conteoPorFecha.size === 0) {
      conteoPorFecha.set(HOY_ISO, 0);
    }

    const fechasOrdenadas = Array.from(conteoPorFecha.keys()).sort((a, b) => b.localeCompare(a));
    if (fechaFiltroBilletera !== 'todas' && !conteoPorFecha.has(fechaFiltroBilletera)) {
      fechaFiltroBilletera = fechasOrdenadas[0] || HOY_ISO;
    }

    selectWalletDate.innerHTML = '';
    fechasOrdenadas.forEach(fIso => {
      const opt = document.createElement('option');
      opt.value = fIso;
      const cant = conteoPorFecha.get(fIso) || 0;
      const fechaCorta = fIso.split('-').reverse().join('/');
      const etiquetaDia = fIso === HOY_ISO ? `Hoy (${fechaCorta})` : `${fechaCorta} — ${formatearFechaLegible(fIso)}`;
      opt.textContent = `${etiquetaDia} (${cant} mov.)`;
      if (fIso === fechaFiltroBilletera) opt.selected = true;
      selectWalletDate.appendChild(opt);
    });

    if (ordenados.length > 0) {
      const optTodas = document.createElement('option');
      optTodas.value = 'todas';
      optTodas.textContent = `📋 Ver todas las fechas (${ordenados.length} mov.)`;
      if (fechaFiltroBilletera === 'todas') optTodas.selected = true;
      selectWalletDate.appendChild(optTodas);
    }
  }

  if (ordenados.length === 0) {
    walletMovementsList.innerHTML = `<div class="empty-state">Todavía no cargaste movimientos. Tocá <b>Sueldo</b>, <b>Ingresos corrientes</b> o <b>Gasto corriente</b> arriba para empezar.</div>`;
    return;
  }

  const filtradosPorFecha = fechaFiltroBilletera === 'todas'
    ? ordenados
    : ordenados.filter(m => obtenerFechaDeMovimiento(m) === fechaFiltroBilletera);

  if (filtradosPorFecha.length === 0) {
    walletMovementsList.innerHTML = `<div class="empty-state">No hay movimientos registrados en la fecha seleccionada.</div>`;
    return;
  }

  filtradosPorFecha.forEach(mov => {
    const esGasto = mov.tipo === 'gasto';
    const fila = document.createElement('div');
    fila.className = `task-item ${esGasto ? 'prio-urgente' : 'prio-simple'}`;

    const etiquetaTipo = mov.tipo === 'sueldo' ? '💼 Sueldo' : (mov.tipo === 'ingreso' ? '➕ Ingreso' : '➖ Gasto');
    const etiquetaMedio = mov.medio === 'virtual' ? '📱 Virtual' : '💵 Efectivo';
    const signo = esGasto ? '-' : '+';

    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill ${esGasto ? 'pill-urgente' : 'pill-simple'}">${etiquetaTipo}</span>
        <span class="priority-pill pill-hora">${etiquetaMedio}</span>
        <span class="task-text">${escaparHTML(mov.detalle)}</span>
      </div>
      <div class="task-actions" style="align-items:center;">
        <span class="${esGasto ? 'amount-negative' : 'amount-positive'}">${signo} ${formatearPesos(mov.monto)}</span>
        <button class="btn-delete" data-action="delete" title="Borrar movimiento">✕</button>
      </div>
    `;

    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      borrados.push(mov.id);
      movimientos = movimientos.filter(x => x.id !== mov.id);
      renderizarBilletera();
      guardarEnNube();
    });

    walletMovementsList.appendChild(fila);
  });
}

// ==========================================
// EXTRAS Y HERRAMIENTAS (1. SUPERMERCADO, 2. GEMINI IA, 3. HELADERA, 4. ENTRENAMIENTO, 5. CONFIGURACIÓN)
// ==========================================
const extrasMenuSection = document.getElementById('extras-menu-section');
const extrasSubviewNav = document.getElementById('extras-subview-nav');
const btnBackToExtrasMenu = document.getElementById('btn-back-to-extras-menu');

const cardExtraSuper = document.getElementById('card-extra-super');
const cardExtraGemini = document.getElementById('card-extra-gemini');
const cardExtraFridge = document.getElementById('card-extra-fridge');
const cardExtraWorkout = document.getElementById('card-extra-workout');
const cardExtraSettings = document.getElementById('card-extra-settings');

const tabExtraSuper = document.getElementById('tab-extra-super');
const tabExtraGemini = document.getElementById('tab-extra-gemini');
const tabExtraFridge = document.getElementById('tab-extra-fridge');
const tabExtraWorkout = document.getElementById('tab-extra-workout');
const tabExtraSettings = document.getElementById('tab-extra-settings');

const subviewSuper = document.getElementById('subview-super');
const subviewGemini = document.getElementById('subview-gemini');
const subviewFridge = document.getElementById('subview-fridge');
const subviewWorkout = document.getElementById('subview-workout');
const subviewSettings = document.getElementById('subview-settings');

function mostrarMenuExtras() {
  if (extrasMenuSection) extrasMenuSection.classList.remove('hidden');
  if (extrasSubviewNav) extrasSubviewNav.classList.add('hidden');
  if (subviewSuper) subviewSuper.classList.add('hidden');
  if (subviewGemini) subviewGemini.classList.add('hidden');
  if (subviewFridge) subviewFridge.classList.add('hidden');
  if (subviewWorkout) subviewWorkout.classList.add('hidden');
  if (subviewSettings) subviewSettings.classList.add('hidden');

  const extraSuperCounter = document.getElementById('extra-super-counter');
  if (extraSuperCounter) {
    const cantSuper = Array.isArray(supermercado) ? supermercado.length : 0;
    extraSuperCounter.textContent = cantSuper === 1 ? '1 producto en lista' : `${cantSuper} productos en lista`;
  }
  const extraFridgeCounter = document.getElementById('extra-fridge-counter');
  if (extraFridgeCounter) {
    const cantF = Array.isArray(heladera) ? heladera.length : 0;
    extraFridgeCounter.textContent = cantF === 1 ? '1 ingrediente' : `${cantF} ingredientes`;
  }
}

function abrirHerramientaExtras(cual) {
  if (extrasMenuSection) extrasMenuSection.classList.add('hidden');
  if (extrasSubviewNav) extrasSubviewNav.classList.remove('hidden');

  if (tabExtraSuper) tabExtraSuper.classList.toggle('active', cual === 'super');
  if (tabExtraGemini) tabExtraGemini.classList.toggle('active', cual === 'gemini');
  if (tabExtraFridge) tabExtraFridge.classList.toggle('active', cual === 'fridge');
  if (tabExtraWorkout) tabExtraWorkout.classList.toggle('active', cual === 'workout');
  if (tabExtraSettings) tabExtraSettings.classList.toggle('active', cual === 'settings');

  if (subviewSuper) subviewSuper.classList.toggle('hidden', cual !== 'super');
  if (subviewGemini) subviewGemini.classList.toggle('hidden', cual !== 'gemini');
  if (subviewFridge) subviewFridge.classList.toggle('hidden', cual !== 'fridge');
  if (subviewWorkout) subviewWorkout.classList.toggle('hidden', cual !== 'workout');
  if (subviewSettings) subviewSettings.classList.toggle('hidden', cual !== 'settings');

  if (cual === 'super') {
    renderizarSupermercado();
    const inp = document.getElementById('input-super-item');
    if (inp) inp.focus();
  } else if (cual === 'gemini') {
    if (inputChatMsg) inputChatMsg.focus();
  } else if (cual === 'fridge') {
    renderizarHeladera();
    const fInput = document.getElementById('input-fridge-name');
    if (fInput) fInput.focus();
  } else if (cual === 'workout') {
    renderizarEntrenamiento();
  } else if (cual === 'settings') {
    renderizarConfiguracion();
  }
}

if (cardExtraSuper) cardExtraSuper.addEventListener('click', () => abrirHerramientaExtras('super'));
if (cardExtraGemini) cardExtraGemini.addEventListener('click', () => abrirHerramientaExtras('gemini'));
if (cardExtraFridge) cardExtraFridge.addEventListener('click', () => abrirHerramientaExtras('fridge'));
if (cardExtraWorkout) cardExtraWorkout.addEventListener('click', () => abrirHerramientaExtras('workout'));
if (cardExtraSettings) cardExtraSettings.addEventListener('click', () => abrirHerramientaExtras('settings'));

if (btnBackToExtrasMenu) btnBackToExtrasMenu.addEventListener('click', mostrarMenuExtras);

if (tabExtraSuper) tabExtraSuper.addEventListener('click', () => abrirHerramientaExtras('super'));
if (tabExtraGemini) tabExtraGemini.addEventListener('click', () => abrirHerramientaExtras('gemini'));
if (tabExtraFridge) tabExtraFridge.addEventListener('click', () => abrirHerramientaExtras('fridge'));
if (tabExtraWorkout) tabExtraWorkout.addEventListener('click', () => abrirHerramientaExtras('workout'));
if (tabExtraSettings) tabExtraSettings.addEventListener('click', () => abrirHerramientaExtras('settings'));

async function renderizarConfiguracion() {
  if (!usuarioActivo) return;

  // 1. TIEMPO DE BLOQUEO POR INACTIVIDAD (1 min, 15 min, 60 min, 4 horas)
  const minActual = Number(usuarioActivo.tiempoBloqueoMin) || Number(localStorage.getItem('agenda_bloqueo_' + usuarioActivo.id)) || 60;
  const timeoutSelectorGroup = document.getElementById('timeout-selector-group');
  if (timeoutSelectorGroup) {
    const pills = timeoutSelectorGroup.querySelectorAll('.btn-setting-pill');
    pills.forEach(pill => {
      const min = Number(pill.getAttribute('data-minutes'));
      pill.classList.toggle('active', min === minActual);
      pill.onclick = async () => {
        usuarioActivo.tiempoBloqueoMin = min;
        localStorage.setItem('agenda_bloqueo_' + usuarioActivo.id, min);
        pills.forEach(p => p.classList.toggle('active', Number(p.getAttribute('data-minutes')) === min));
        const savedMsg = document.getElementById('timeout-saved-msg');
        if (savedMsg) {
          const texto = min === 240 ? '4 horas' : (min + ' minutos');
          savedMsg.textContent = `✓ Sesión configurada para cerrarse tras ${texto} de inactividad`;
          savedMsg.classList.remove('hidden');
          setTimeout(() => savedMsg.classList.add('hidden'), 3000);
        }
        registrarActividadSesion();
        await guardarEnNube();
      };
    });
  }

  // 2. HUELLA DIGITAL / BIOMETRÍA
  const settingsBioStatus = document.getElementById('settings-bio-status');
  const settingsBioActions = document.getElementById('settings-bio-actions');
  if (settingsBioStatus && settingsBioActions) {
    const soportaBio = await esBiometriaSoportada();
    if (!soportaBio) {
      settingsBioStatus.innerHTML = '⚠️ Este celular o navegador no soporta autenticación biométrica WebAuthn.';
      settingsBioActions.innerHTML = '';
    } else {
      const tieneHuella = tieneHuellaGuardada(usuarioActivo.id);
      if (tieneHuella) {
        settingsBioStatus.innerHTML = `✅ La huella digital está <strong>activada</strong> para <strong>${escaparHTML(usuarioActivo.nombre)}</strong> en este celular.<br><span style="color:#a7f3d0; font-size:0.85rem;">Al tocar tu tarjeta de usuario al inicio podrás escanear tu dedo y entrar sin contraseña.</span>`;
        settingsBioActions.innerHTML = `
          <button type="button" id="btn-settings-deactivate-bio" class="btn-secondary" style="border-color:#ef4444; color:#fca5a5; font-weight:600;">
            ❌ Desactivar huella en este celular
          </button>
        `;
        const btnDeact = document.getElementById('btn-settings-deactivate-bio');
        if (btnDeact) {
          btnDeact.onclick = () => {
            if (confirm(`¿Querés desactivar el ingreso con huella para ${usuarioActivo.nombre} en este celular?`)) {
              desvincularHuella(usuarioActivo.id);
              renderizarConfiguracion();
            }
          };
        }
      } else {
        settingsBioStatus.innerHTML = `La huella digital <strong>no está activada</strong> para <strong>${escaparHTML(usuarioActivo.nombre)}</strong> en este celular. Podés activarla para desbloquear tu agenda con tu dedo en 1 segundo.`;
        settingsBioActions.innerHTML = `
          <button type="button" id="btn-settings-activate-bio" class="btn-primary" style="background:#059669; font-weight:700;">
            👆 Activar mi huella en este celular
          </button>
        `;
        const btnAct = document.getElementById('btn-settings-activate-bio');
        if (btnAct) {
          btnAct.onclick = async () => {
            const ok = await activarHuellaParaUsuario(usuarioActivo, usuarioActivo.password);
            if (ok) renderizarConfiguracion();
          };
        }
      }
    }
  }

  // 3. NOTIFICACIONES DEL CELULAR
  const settingsPushStatus = document.getElementById('settings-push-status');
  const btnSettingsEnablePush = document.getElementById('btn-settings-enable-push');
  const btnSettingsTestPush = document.getElementById('btn-settings-test-push');
  if (settingsPushStatus) {
    if (!('Notification' in window)) {
      settingsPushStatus.innerHTML = '⚠️ Este navegador no soporta notificaciones locales o push.';
      if (btnSettingsEnablePush) btnSettingsEnablePush.style.display = 'none';
      if (btnSettingsTestPush) btnSettingsTestPush.style.display = 'none';
    } else if (Notification.permission === 'granted') {
      settingsPushStatus.innerHTML = '✅ Las notificaciones están <strong>activadas y funcionando</strong> en este celular.<br><span style="color:#a7f3d0; font-size:0.85rem;">Recibirás avisos de tareas pedidas por otros usuarios, tareas realizadas y actividades programadas.</span>';
      if (btnSettingsEnablePush) btnSettingsEnablePush.style.display = 'none';
      if (btnSettingsTestPush) btnSettingsTestPush.style.display = 'inline-block';
    } else if (Notification.permission === 'denied') {
      settingsPushStatus.innerHTML = '⚠️ Las notificaciones están <strong>bloqueadas</strong> por el navegador.<br><span style="color:#cbd5e1; font-size:0.85rem;">Para permitirlas, tocá el icono del candado en la barra superior de tu navegador y habilitá el permiso de Notificaciones.</span>';
      if (btnSettingsEnablePush) btnSettingsEnablePush.style.display = 'none';
      if (btnSettingsTestPush) btnSettingsTestPush.style.display = 'none';
    } else {
      settingsPushStatus.innerHTML = 'Las notificaciones no están habilitadas aún. Activalas para recibir avisos de tareas y actividades en tu celular.';
      if (btnSettingsEnablePush) btnSettingsEnablePush.style.display = 'inline-block';
      if (btnSettingsTestPush) btnSettingsTestPush.style.display = 'none';
    }
  }

  if (btnSettingsEnablePush) {
    btnSettingsEnablePush.onclick = async () => {
      await solicitarPermisoNotificaciones(true);
      renderizarConfiguracion();
    };
  }

  if (btnSettingsTestPush) {
    btnSettingsTestPush.onclick = async () => {
      await enviarNotificacionCelular('🔔 Notificación de prueba', '¡Las notificaciones de tu Agenda Familiar están activadas y funcionan genial!', 'test-' + Date.now());
    };
  }

  // 4. COMPARTIR LINK EXTERNO
  const inputSettingsShareUrl = document.getElementById('input-settings-share-url');
  const btnSettingsCopyShare = document.getElementById('btn-settings-copy-share');
  const btnSettingsWhatsappShare = document.getElementById('btn-settings-whatsapp-share');
  const settingsShareCopied = document.getElementById('settings-share-copied');
  const urlCompartir = obtenerUrlCompartirActual();
  if (inputSettingsShareUrl) inputSettingsShareUrl.value = urlCompartir;

  if (btnSettingsCopyShare) {
    btnSettingsCopyShare.onclick = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(urlCompartir).then(() => {
          if (settingsShareCopied) {
            settingsShareCopied.classList.remove('hidden');
            setTimeout(() => settingsShareCopied.classList.add('hidden'), 2500);
          }
        }).catch(() => {
          if (inputSettingsShareUrl) {
            inputSettingsShareUrl.select();
            document.execCommand('copy');
          }
        });
      } else if (inputSettingsShareUrl) {
        inputSettingsShareUrl.select();
        document.execCommand('copy');
        if (settingsShareCopied) {
          settingsShareCopied.classList.remove('hidden');
          setTimeout(() => settingsShareCopied.classList.add('hidden'), 2500);
        }
      }
    };
  }

  if (btnSettingsWhatsappShare) {
    btnSettingsWhatsappShare.onclick = () => {
      const msg = `¡Hola! Podés dejarme tareas pendientes en mi agenda entrando a este link:\n${urlCompartir}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };
  }

  // 5. ADMINISTRACIÓN DE USUARIOS (SOLO ADMINISTRADOR / ALEJANDRO)
  const settingsAdminCard = document.getElementById('settings-admin-card');
  const settingsAdminUsersList = document.getElementById('settings-admin-users-list');
  if (settingsAdminCard && settingsAdminUsersList) {
    if (usuarioActivo.esAdmin) {
      settingsAdminCard.style.display = 'block';
      renderizarListaAdminEnSettings(settingsAdminUsersList);
    } else {
      settingsAdminCard.style.display = 'none';
    }
  }
}

function renderizarListaAdminEnSettings(cont) {
  if (!cont) return;
  cont.innerHTML = '';
  const otros = listaUsuariosPublica.filter(u => !u.esAdmin);
  if (otros.length === 0) {
    cont.innerHTML = '<div style="padding: 10px; color: var(--text-muted);">No hay otros usuarios creados para eliminar.</div>';
    return;
  }
  otros.forEach(u => {
    const fila = document.createElement('div');
    fila.className = 'task-item';
    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill pill-hora">${u.avatar || '👤'} Usuario</span>
        <span class="task-text">${escaparHTML(u.nombre)}</span>
      </div>
      <div class="task-actions">
        <button type="button" class="btn-delete" data-del-user="${u.id}">🗑️ Eliminar usuario</button>
      </div>
    `;
    const btnDel = fila.querySelector('button');
    btnDel.onclick = async () => {
      if (!confirm(`¿Estás SEGURO de eliminar definitivamente al usuario "${u.nombre}" y todos sus datos? Esta acción no se puede deshacer.`)) return;
      try {
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'eliminar_usuario',
            usuarioId: 'alejandro',
            password: usuarioActivo.password,
            eliminarUsuarioId: u.id
          })
        });
        const data = await res.json();
        if (res.ok) {
          listaUsuariosPublica = data.usuarios || listaUsuariosPublica.filter(x => x.id !== u.id);
          renderizarListaAdminEnSettings(cont);
          renderizarGrillaUsuarios();
        } else {
          alert(data.error || 'No se pudo eliminar el usuario');
        }
      } catch (e) {
        alert('Error de conexión al eliminar usuario.');
      }
    };
    cont.appendChild(fila);
  });
}

function agregarBurbujaChat(texto, tipo) {
  if (!chatMessagesEl) return;
  const div = document.createElement('div');
  div.className = `chat-bubble ${tipo}`;
  div.innerHTML = escaparHTML(texto).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  chatMessagesEl.appendChild(div);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function iniciarBienvenidaChat() {
  if (!chatMessagesEl) return;
  const nombre = usuarioActivo ? usuarioActivo.nombre : 'Alejandro';
  historialChatGemini = [];
  chatMessagesEl.innerHTML = '';
  agregarBurbujaChat(
    `¡Hola ${nombre}! Soy **Gemini**. Preguntame lo que quieras sobre cualquier tema, pedime que redacte textos, explique algo, saque cuentas o te dé ideas.`,
    'bot'
  );
}

if (btnClearChat) btnClearChat.addEventListener('click', iniciarBienvenidaChat);

async function enviarMensajeAsistente() {
  const texto = inputChatMsg.value.trim();
  if (!texto) { inputChatMsg.focus(); return; }

  agregarBurbujaChat(texto, 'user');
  inputChatMsg.value = '';
  btnSendChat.disabled = true;
  btnSendChat.textContent = 'Pensando...';

  try {
    const res = await fetch(API_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreUsuario: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
        mensaje: texto,
        historial: historialChatGemini
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rta = data.respuesta || 'Acá estoy para ayudarte.';
      agregarBurbujaChat(rta, 'bot');
      historialChatGemini.push({ rol: 'user', texto: texto });
      historialChatGemini.push({ rol: 'assistant', texto: rta });
    } else {
      agregarBurbujaChat('Hubo un problema al conectar con Gemini. Intentá de nuevo.', 'bot');
    }
  } catch (e) {
    agregarBurbujaChat('No pude conectarme en este instante.', 'bot');
  } finally {
    btnSendChat.disabled = false;
    btnSendChat.textContent = 'Enviar';
    inputChatMsg.focus();
  }
}

if (btnSendChat) btnSendChat.addEventListener('click', enviarMensajeAsistente);
if (inputChatMsg) {
  inputChatMsg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); enviarMensajeAsistente(); }
  });
}

// ==========================================
// MÓDULO 5: EXTRAS -> 1. LISTA DE SUPERMERCADO Y PREGUNTA ÚNICA DE CONVIVENCIA
// ==========================================
const inputSuperItem = document.getElementById('input-super-item');
const inputSuperQty = document.getElementById('input-super-qty');
const checkSuperEdible = document.getElementById('check-super-edible');
const superEdibleLabel = checkSuperEdible ? checkSuperEdible.closest('.super-edible-check-label') : null;
const btnAddSuperItem = document.getElementById('btn-add-super-item');
const btnFinishShopping = document.getElementById('btn-finish-shopping');
const superItemsList = document.getElementById('super-items-list');
const superSubtitleInfo = document.getElementById('super-subtitle-info');

if (checkSuperEdible && superEdibleLabel) {
  checkSuperEdible.addEventListener('change', () => {
    superEdibleLabel.classList.toggle('unchecked', !checkSuperEdible.checked);
  });
}

const housematesPromptBox = document.getElementById('housemates-prompt-box');
const housematesOptionsList = document.getElementById('housemates-options-list');
const btnLiveAlone = document.getElementById('btn-live-alone');
const btnSaveHousemates = document.getElementById('btn-save-housemates');

function verificarPreguntaUnicaConvivencia() {
  if (!housematesPromptBox || !usuarioActivo) return;
  const otrosUsuarios = listaUsuariosPublica.filter(u => u.id !== usuarioActivo.id);

  // Solo pregunta si todavía no respondió nunca y si ya existe al menos otro usuario en la app
  if (!yaConfiguroCasa && otrosUsuarios.length > 0) {
    housematesPromptBox.classList.remove('hidden');
    housematesOptionsList.innerHTML = '';
    otrosUsuarios.forEach(u => {
      const activo = seleccionConvivientesTemp.has(u.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `prio-option prio-verde ${activo ? 'active' : ''}`;
      btn.innerHTML = `<span class="dot ${activo ? 'dot-verde' : ''}" style="${activo ? '' : 'background:#64748b'}"></span> ${activo ? '✓ Vivo con ' : ''}${escaparHTML(u.nombre)}`;
      btn.addEventListener('click', () => {
        if (seleccionConvivientesTemp.has(u.id)) seleccionConvivientesTemp.delete(u.id);
        else seleccionConvivientesTemp.add(u.id);
        verificarPreguntaUnicaConvivencia();
      });
      housematesOptionsList.appendChild(btn);
    });
  } else {
    housematesPromptBox.classList.add('hidden');
  }
}

async function guardarConvivenciaPorUnicaVez(listaIds) {
  if (!usuarioActivo) return;
  yaConfiguroCasa = true;
  housematesPromptBox.classList.add('hidden');
  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'guardar_convivencia',
        usuarioId: usuarioActivo.id,
        password: usuarioActivo.password,
        convivientesIds: listaIds
      })
    });
    if (res.ok) {
      const data = await res.json();
      supermercado = Array.isArray(data.supermercado) ? data.supermercado : supermercado;
      superCompartidoCon = Array.isArray(data.superCompartidoCon) ? data.superCompartidoCon : superCompartidoCon;
      renderizarSupermercado();
    }
  } catch (e) {}
}

if (btnLiveAlone) {
  btnLiveAlone.addEventListener('click', () => {
    seleccionConvivientesTemp.clear();
    guardarConvivenciaPorUnicaVez([]);
  });
}

if (btnSaveHousemates) {
  btnSaveHousemates.addEventListener('click', () => {
    guardarConvivenciaPorUnicaVez(Array.from(seleccionConvivientesTemp));
  });
}

function agregarProductoSuper() {
  if (!usuarioActivo) return;
  const texto = inputSuperItem.value.trim();
  if (!texto) {
    inputSuperItem.focus();
    return;
  }
  const cantidad = inputSuperQty ? (inputSuperQty.value.trim() || '1 u.') : '1 u.';
  const esComestible = checkSuperEdible ? checkSuperEdible.checked : true;

  supermercado.push({
    id: 'sup-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    texto: texto,
    cantidad: cantidad,
    comestible: esComestible,
    tildado: false,
    autor: usuarioActivo.nombre,
    updatedAt: Date.now()
  });

  inputSuperItem.value = '';
  if (inputSuperQty) inputSuperQty.value = '';
  renderizarSupermercado();
  inputSuperItem.focus();
  guardarEnNube();
}

if (btnAddSuperItem) btnAddSuperItem.addEventListener('click', agregarProductoSuper);
if (inputSuperItem) {
  inputSuperItem.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputSuperQty) inputSuperQty.focus();
      else agregarProductoSuper();
    }
  });
}
if (inputSuperQty) {
  inputSuperQty.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarProductoSuper();
    }
  });
}

if (btnFinishShopping) {
  btnFinishShopping.addEventListener('click', () => {
    const tildados = supermercado.filter(x => x.tildado);
    if (tildados.length === 0) {
      alert('Primero tildá con el botón "✓" los productos que fuiste poniendo en el carrito, y después tocá "Comprar" para limpiarlos de la lista.');
      return;
    }

    // Pasar automáticamente los productos comestibles comprados a la Heladera
    const comestiblesComprados = tildados.filter(x => x.comestible !== false);
    comestiblesComprados.forEach(item => {
      const cantItem = item.cantidad || '1 u.';
      const existente = heladera.find(
        h => (h.nombre || '').trim().toLowerCase() === (item.texto || '').trim().toLowerCase()
      );
      if (existente) {
        existente.cantidad = `${existente.cantidad} + ${cantItem}`;
        existente.updatedAt = Date.now();
      } else {
        heladera.push({
          id: 'hel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          nombre: item.texto,
          cantidad: cantItem,
          updatedAt: Date.now()
        });
      }
    });

    supermercado = supermercado.filter(x => !x.tildado);
    renderizarSupermercado();
    renderizarHeladera();
    guardarEnNube();
  });
}

function renderizarSupermercado() {
  if (!superItemsList) return;
  actualizarContadoresYAlertas();

  if (superSubtitleInfo) {
    const nombresCasa = superCompartidoCon
      .map(id => (listaUsuariosPublica.find(u => u.id === id) || {}).nombre)
      .filter(Boolean);
    superSubtitleInfo.textContent = nombresCasa.length > 0
      ? `🏠 Lista de la casa compartida con ${nombresCasa.join(', ')} (los comestibles pasan solos a 🧊 Heladera al comprar)`
      : 'Agregá productos con su cantidad; los marcados como "Comestibles" pasan solos a tu Heladera al comprarlos';
  }

  superItemsList.innerHTML = '';

  const cantTildados = supermercado.filter(x => x.tildado).length;
  if (btnFinishShopping) {
    btnFinishShopping.textContent = cantTildados > 0
      ? `🛒 Comprar (Cerrar ${cantTildados} y sumar comestibles a Heladera)`
      : '🛒 Comprar (Cerrar compra)';
  }

  if (supermercado.length === 0) {
    superItemsList.innerHTML = `<div class="empty-state">La lista de supermercado está vacía. Escribí un producto y su cantidad arriba para añadirlo.</div>`;
    return;
  }

  supermercado.forEach(item => {
    const fila = document.createElement('div');
    fila.className = `task-item prio-simple super-card-sketch ${item.tildado ? 'realizada' : ''}`;

    const esComestible = item.comestible !== false;
    const cantTexto = item.cantidad ? item.cantidad : '1 u.';
    const autorTexto = item.autor || (usuarioActivo ? usuarioActivo.nombre : 'Alejandro');

    const textoComestible = esComestible ? '✓ 🍎 Comestible' : '🧴 No comestible';
    const claseComestible = esComestible ? 'is-edible' : 'not-edible';

    fila.innerHTML = `
      <div class="super-sketch-left">
        <div class="super-sketch-line">
          <span class="super-sketch-label">Producto:</span>
          <span class="super-sketch-val-main task-text">${escaparHTML(item.texto)}</span>
        </div>
        <div class="super-sketch-line">
          <span class="super-sketch-label">Cantidad:</span>
          <strong>${escaparHTML(cantTexto)}</strong>
        </div>
        <div class="super-sketch-line">
          <span class="super-sketch-label">Agregado por:</span>
          <span>${escaparHTML(autorTexto)}</span>
        </div>
        <button type="button" class="super-sketch-edible-btn ${claseComestible}" data-action="toggle-edible" title="Tocá para cambiar entre Comestible y No comestible">
          ${textoComestible}
        </button>
      </div>
      <div class="super-sketch-right">
        <button type="button" class="super-check-btn ${item.tildado ? 'checked' : ''}" data-action="check" title="Tildar producto en el carrito">
          ${item.tildado ? '✓' : ''}
        </button>
        <button type="button" class="super-delete-square" data-action="delete" title="Eliminar de la lista">✕</button>
      </div>
    `;

    fila.querySelector('[data-action="check"]').addEventListener('click', () => {
      item.tildado = !item.tildado;
      item.updatedAt = Date.now();
      renderizarSupermercado();
      guardarEnNube();
    });

    fila.querySelector('[data-action="toggle-edible"]').addEventListener('click', () => {
      item.comestible = !esComestible;
      item.updatedAt = Date.now();
      renderizarSupermercado();
      guardarEnNube();
    });

    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      supermercado = supermercado.filter(x => x.id !== item.id);
      renderizarSupermercado();
      guardarEnNube();
    });

    superItemsList.appendChild(fila);
  });
}

// ==========================================
// EXTRAS -> 3. HELADERA Y GENERADOR DE RECETAS CON IA
// ==========================================
const inputFridgeName = document.getElementById('input-fridge-name');
const inputFridgeQty = document.getElementById('input-fridge-qty');
const btnAddFridgeItem = document.getElementById('btn-add-fridge-item');
const fridgeItemsList = document.getElementById('fridge-items-list');
const btnGenerateRecipe = document.getElementById('btn-generate-recipe');
const btnAnotherRecipe = document.getElementById('btn-another-recipe');
const fridgeRecipeBox = document.getElementById('fridge-recipe-box');
const fridgeRecipeContent = document.getElementById('fridge-recipe-content');

function agregarIngredienteHeladera() {
  if (!usuarioActivo) return;
  const nombre = inputFridgeName.value.trim();
  const cantidad = inputFridgeQty.value.trim() || 'Cantidad necesaria';
  if (!nombre) {
    inputFridgeName.focus();
    return;
  }

  heladera.push({
    id: 'hel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    nombre: nombre,
    cantidad: cantidad,
    updatedAt: Date.now()
  });

  inputFridgeName.value = '';
  inputFridgeQty.value = '';
  renderizarHeladera();
  inputFridgeName.focus();
  guardarEnNube();
}

if (inputFridgeName) {
  inputFridgeName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputFridgeQty.focus();
    }
  });
}

if (inputFridgeQty) {
  inputFridgeQty.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarIngredienteHeladera();
    }
  });
}

if (btnAddFridgeItem) btnAddFridgeItem.addEventListener('click', agregarIngredienteHeladera);

function renderizarHeladera() {
  if (!fridgeItemsList) return;
  fridgeItemsList.innerHTML = '';

  if (heladera.length === 0) {
    fridgeItemsList.innerHTML = `<div class="empty-state">Tu heladera está vacía. Cargá arriba los ingredientes y cantidades que tenés disponibles y después tocá <b>🍳 Generar Receta</b>.</div>`;
    return;
  }

  heladera.forEach(ing => {
    const fila = document.createElement('div');
    fila.className = 'task-item prio-simple';
    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill pill-simple">🥬 ${escaparHTML(ing.cantidad)}</span>
        <span class="task-text">${escaparHTML(ing.nombre)}</span>
      </div>
      <div class="task-actions">
        <button type="button" class="btn-delete" data-action="delete" title="Quitar ingrediente">✕</button>
      </div>
    `;

    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      heladera = heladera.filter(x => x.id !== ing.id);
      renderizarHeladera();
      guardarEnNube();
    });

    fridgeItemsList.appendChild(fila);
  });
}

async function generarRecetaDesdeHeladera(esOtraOpcion) {
  if (heladera.length === 0) {
    alert('Primero agregá al menos un ingrediente en tu heladera para que la IA pueda armarte la receta.');
    if (inputFridgeName) inputFridgeName.focus();
    return;
  }

  const listado = heladera.map(i => `- ${i.nombre} (${i.cantidad})`).join('\n');
  const promptReceta = `Tengo exactamente estos ingredientes disponibles en mi heladera/cocina:\n${listado}\n\n${esOtraOpcion ? 'Dame UNA RECETA DIFERENTE a la anterior' : 'Armame una receta rica y casera'} usando estos ingredientes (más condimentos básicos como sal, aceite o agua). Incluí:\n1. Nombre del plato\n2. Cantidades exactas a usar de cada ingrediente\n3. Paso a paso claro y numerado para cocinarlo.`;

  btnGenerateRecipe.disabled = true;
  btnGenerateRecipe.textContent = '🍳 Cocinando receta...';
  fridgeRecipeBox.classList.remove('hidden');
  fridgeRecipeContent.innerHTML = '⏳ Pensando la mejor receta con tus ingredientes...';

  try {
    const res = await fetch(API_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreUsuario: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
        mensaje: promptReceta,
        historial: []
      })
    });

    if (res.ok) {
      const data = await res.json();
      const texto = data.respuesta || 'No se pudo generar la receta.';
      fridgeRecipeContent.innerHTML = escaparHTML(texto).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    } else {
      fridgeRecipeContent.textContent = 'Hubo un problema al generar la receta. Tocá el botón de nuevo.';
    }
  } catch (e) {
    fridgeRecipeContent.textContent = 'Error de conexión al consultar a la IA.';
  } finally {
    btnGenerateRecipe.disabled = false;
    btnGenerateRecipe.textContent = '🍳 Generar Receta';
  }
}

if (btnGenerateRecipe) btnGenerateRecipe.addEventListener('click', () => generarRecetaDesdeHeladera(false));
if (btnAnotherRecipe) btnAnotherRecipe.addEventListener('click', () => generarRecetaDesdeHeladera(true));

// ==========================================
// EXTRAS -> 4. ENTRENAMIENTO (DIVISIÓN DE A 2 GRUPOS POR DÍA + LISTADO PASO A PASO)
// ==========================================
const workoutZonesSelector = document.getElementById('workout-zones-selector');
const btnSelectAllZones = document.getElementById('btn-select-all-zones');
const workoutSplitPreview = document.getElementById('workout-split-preview');
const inputWorkoutDays = document.getElementById('input-workout-days');
const inputWorkoutTime = document.getElementById('input-workout-time');
const inputWorkoutDuration = document.getElementById('input-workout-duration');
const btnGenerateWorkout = document.getElementById('btn-generate-workout');
const btnAnotherWorkout = document.getElementById('btn-another-workout');
const workoutRoutineBox = document.getElementById('workout-routine-box');
const workoutRoutineContent = document.getElementById('workout-routine-content');
const workoutExpiryBadge = document.getElementById('workout-expiry-badge');

const TODAS_LAS_ZONAS_GYM = ['Pecho', 'Espalda', 'Bíceps', 'Tríceps', 'Hombros', 'Piernas'];
let zonasSeleccionadasEntrenamiento = new Set(['Pecho', 'Espalda', 'Bíceps', 'Tríceps', 'Hombros', 'Piernas']);
let indiceVarianteRutina = 0;

// Catálogo completo de ejercicios para Mancuernas y Máquina Multigym con poleas con Paso a Paso
const CATALOGO_EJERCICIOS_GYM = {
  'Pecho': [
    {
      nombre: 'Press de pecho en máquina Multigym (agarre frontal)',
      equipo: '⚙️ Multigym con poleas',
      series: '4 series × 10 a 12 repeticiones',
      descanso: '75 seg',
      pasos: [
        'Regulá la altura del asiento del Multigym para que los agarres queden a la altura media de tu pecho.',
        'Apoyá bien toda la espalda y la cabeza contra el respaldo, llevando los hombros hacia atrás.',
        'Empujá los brazos hacia adelante de forma controlada exhalando el aire, sin trabar los codos al final.',
        'Volvé despacio en 2 segundos sintiendo el estiramiento del pectoral antes de la siguiente repetición.'
      ]
    },
    {
      nombre: 'Press plano con mancuernas',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 10 a 12 repeticiones',
      descanso: '75 seg',
      pasos: [
        'Acostate boca arriba sobre el banco (o colchoneta firme) con una mancuerna en cada mano a los lados del pecho.',
        'Mantené los codos a unos 45° del torso (no totalmente abiertos a 90° para cuidar el hombro).',
        'Subí ambas mancuernas hacia el techo hasta que se acerquen arriba sin chocarlas entre sí.',
        'Bajá lentamente controlando el peso hasta la línea del pecho y repetí.'
      ]
    },
    {
      nombre: 'Aperturas en Peck Deck / Mariposa del Multigym',
      equipo: '⚙️ Multigym con poleas',
      series: '3 series × 12 a 15 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Sentate en el Multigym con la espalda recta y apoyá los antebrazos o tomá los agarres laterales del contractor.',
        'Juntá ambos brazos hacia el centro frente a tu pecho como si dieras un abrazo amplio.',
        'Apretá fuerte el pecho durante 1 segundo cuando los brazos se juntan en el centro.',
        'Abrí los brazos de forma lenta y controlada hasta sentir que el pecho se estira.'
      ]
    },
    {
      nombre: 'Press inclinado con mancuernas (enfoque pectoral superior)',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 10 a 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Incliná el respaldo a unos 30°-45° y apoyá los pies firmes en el piso.',
        'Sostené las mancuernas a la altura de la parte alta del pecho con las palmas mirando al frente.',
        'Empujá verticalmente hacia arriba apretando la parte superior del pecho.',
        'Descendé en forma pausada manteniendo el control en todo el recorrido.'
      ]
    },
    {
      nombre: 'Aperturas con mancuernas',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Acostate con las mancuernas arriba del pecho, palmas enfrentadas y codos apenas flexionados.',
        'Abrí los brazos hacia los costados dibujando un arco amplio sin cambiar el ángulo del codo.',
        'Bajá hasta que los codos queden a la altura del torso sintiendo el estiramiento pectoral.',
        'Subí cerrando el arco con la fuerza del pecho hasta volver al punto inicial.'
      ]
    },
    {
      nombre: 'Pullover con una mancuerna',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Sostené una sola mancuerna con ambas manos formando un triángulo sobre tu pecho.',
        'Con los brazos semirrígidos, llevá la mancuerna hacia atrás de tu cabeza tomando aire.',
        'Bajá hasta que los brazos queden alineados con tu torso.',
        'Subí la mancuerna de regreso sobre el pecho apretando pectorales y exhalando.'
      ]
    }
  ],
  'Espalda': [
    {
      nombre: 'Jalón al pecho en polea alta (agarre ancho)',
      equipo: '⚙️ Multigym con poleas',
      series: '4 series × 10 a 12 repeticiones',
      descanso: '75 seg',
      pasos: [
        'Sentate en el Multigym, trabá los muslos bajo los rodillos y tomá la barra larga más ancho que tus hombros.',
        'Incliná apenas el torso hacia atrás (unos 15°) sacando pecho.',
        'Tirá de la barra hacia la parte alta de tu pecho llevando los codos hacia abajo y atrás.',
        'Subí la barra despacio controlando el retorno de la polea sin dar tirones.'
      ]
    },
    {
      nombre: 'Remo a un brazo con mancuerna (serrucho)',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 10 a 12 repeticiones por lado',
      descanso: '60 seg',
      pasos: [
        'Apoyá una rodilla y la mano del mismo lado sobre un banco, manteniendo la espalda totalmente recta y paralela al piso.',
        'Tomá la mancuerna con la mano libre dejándola colgar con el brazo extendido.',
        'Llevá la mancuerna hacia tu cadera (no hacia el hombro), pegando el codo al cuerpo.',
        'Apretá el dorsal arriba 1 segundo y bajá lento antes de cambiar de brazo.'
      ]
    },
    {
      nombre: 'Remo sentado en polea baja del Multigym',
      equipo: '⚙️ Multigym con poleas',
      series: '4 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Sentate frente a la polea baja, apoyá los pies con rodillas semiflexionadas y mantené el torso erguido.',
        'Tomá el agarre de la polea baja y llevá los hombros hacia atrás sin encorvar la cintura.',
        'Traccioná el agarre hacia tu abdomen juntando las escápulas (omóplatos) atrás.',
        'Extendé los brazos lentamente hacia adelante manteniendo la espalda derecha.'
      ]
    },
    {
      nombre: 'Jalón cerrado al pecho en polea alta (agarre supino o estrecho)',
      equipo: '⚙️ Multigym con poleas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Tomá la barra de la polea alta con las palmas mirando hacia vos y separadas al ancho de tus hombros.',
        'Sacá pecho y bajá la barra hasta la altura de las clavículas llevando los codos bien pegados al costado.',
        'Concentrá la fuerza en el centro y parte baja de los dorsales.',
        'Regresá arriba estirando bien la espalda.'
      ]
    },
    {
      nombre: 'Pull-over en polea alta con brazos rectos',
      equipo: '⚙️ Multigym con poleas',
      series: '3 series × 12 a 15 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Parate frente a la polea alta del Multigym dando un paso atrás e inclinando levemente el torso.',
        'Tomá la barra con brazos casi extendidos a la altura de los ojos.',
        'Bajá la barra en forma de arco hasta tocar tus muslos sin flexionar los codos.',
        'Volvé despacio sintiendo cómo trabaja todo el dorsal ancho.'
      ]
    },
    {
      nombre: 'Remo inclinado con dos mancuernas',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Parate con pies al ancho de hombros, flexioná levemente las rodillas e incliná el torso a 45° con espalda recta.',
        'Sostené ambas mancuernas colgando frente a tus espinillas.',
        'Subí las dos mancuernas hacia tu cintura apretando fuerte la espalda alta.',
        'Bajá en 2 segundos sin balancear el cuerpo.'
      ]
    }
  ],
  'Bíceps': [
    {
      nombre: 'Curl de bíceps alternado con mancuernas (con giro supinador)',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 10 a 12 repeticiones por brazo',
      descanso: '60 seg',
      pasos: [
        'Parate o sentate derecho con una mancuerna en cada mano y las palmas mirando hacia tus muslos.',
        'Sin mover el codo de tu costado, subí una mancuerna girando la muñeca para que la palma termine mirando tu hombro.',
        'Apretá el bíceps 1 segundo en el punto más alto sin balancear la espalda.',
        'Bajá lento y repetí el movimiento con el otro brazo.'
      ]
    },
    {
      nombre: 'Curl de bíceps en polea baja del Multigym',
      equipo: '⚙️ Multigym con poleas',
      series: '4 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Conectá la barra corta a la polea inferior del Multigym y parate derecho frente a la máquina.',
        'Pegá los codos a las costillas con las palmas mirando hacia arriba.',
        'Subí la barra hacia tus hombros manteniendo la tensión continua que da el cable de la polea.',
        'Bajá despacio en 2 a 3 segundos hasta extender casi por completo los brazos.'
      ]
    },
    {
      nombre: 'Curl Martillo con mancuernas (bíceps y antebrazo)',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Sostené las mancuernas a los costados con agarre neutro (las palmas enfrentadas entre sí todo el tiempo).',
        'Subí ambas mancuernas (o de a una) manteniendo los pulgares apuntando hacia arriba.',
        'Frená un instante arriba apretando fuerte el brazo.',
        'Descendé de forma controlada sin impulsar con la cadera.'
      ]
    },
    {
      nombre: 'Curl concentrado con mancuerna sentado',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 10 a 12 repeticiones por brazo',
      descanso: '60 seg',
      pasos: [
        'Sentate, abrí las piernas y apoyá la parte trasera del codo contra la cara interna de tu muslo.',
        'Dejá el brazo extendido hacia abajo sosteniendo la mancuerna.',
        'Subí la mancuerna hacia tu cara moviendo únicamente el antebrazo.',
        'Bajá lento sintiendo el trabajo aislado del pico del bíceps.'
      ]
    }
  ],
  'Tríceps': [
    {
      nombre: 'Extensión de tríceps en polea alta (Pushdown)',
      equipo: '⚙️ Multigym con poleas',
      series: '4 series × 12 a 15 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Parate frente a la polea alta del Multigym tomando la barra corta o soga con las manos al ancho de hombros.',
        'Pegá los codos firmes a los costados de tu cuerpo (los codos funcionan como bisagra y no deben irse hacia adelante).',
        'Empujá la barra hacia abajo hasta extender por completo los brazos apretando el tríceps.',
        'Subí lento hasta que los antebrazos formen un ángulo de 90° y repetí.'
      ]
    },
    {
      nombre: 'Press francés / Copa a dos manos con mancuerna sobre la cabeza',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 10 a 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Sentate con la espalda recta y sujetá un extremo de una mancuerna con ambas manos por encima de tu cabeza.',
        'Mantené los codos apuntando hacia adelante y cerca de tus orejas (evitá que se abran).',
        'Flexioná los codos bajando la mancuerna por detrás de tu nuca de manera controlada.',
        'Extendé los brazos hacia el techo empujando con la fuerza de los tríceps.'
      ]
    },
    {
      nombre: 'Patada de tríceps con mancuerna a un brazo',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 12 repeticiones por brazo',
      descanso: '60 seg',
      pasos: [
        'Incliná el torso hacia adelante apoyando la mano libre en un banco o en tu rodilla.',
        'Subí el codo del brazo que tiene la mancuerna hasta que quede pegado y paralelo a tu torso.',
        'Sin bajar el codo, extendé el antebrazo hacia atrás hasta que el brazo quede totalmente recto.',
        'Sostené 1 segundo atrás apretando el tríceps y volvé a 90°.'
      ]
    },
    {
      nombre: 'Extensión de tríceps en polea alta con agarre inverso (supino)',
      equipo: '⚙️ Multigym con poleas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Tomá la barra de la polea alta desde abajo (palmas mirando hacia vos).',
        'Con los codos fijos a las costillas, extendé los brazos hacia abajo.',
        'Apretá la cabeza interna del tríceps al final del recorrido.',
        'Regresá despacio controlando el peso.'
      ]
    }
  ],
  'Hombros': [
    {
      nombre: 'Press militar sentado con mancuernas',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 10 a 12 repeticiones',
      descanso: '75 seg',
      pasos: [
        'Sentate con la espalda bien apoyada y subí las mancuernas a la altura de tus orejas con palmas al frente.',
        'Empujá las mancuernas hacia arriba hasta estirar los brazos sobre tu cabeza.',
        'Evitá arquear la cintura manteniendo el abdomen firme.',
        'Bajá de forma controlada hasta que los codos vuelvan a 90°.'
      ]
    },
    {
      nombre: 'Vuelos laterales con mancuernas',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 12 a 15 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Parate derecho con una mancuerna en cada mano a los lados de los muslos y codos apenas flexionados.',
        'Levantá ambos brazos hacia los costados hasta que lleguen a la altura de tus hombros (formando una T).',
        'Subí guiando el movimiento con los codos y no con las muñecas, sin dar envión con el cuerpo.',
        'Bajá despacio en 2 segundos resistiendo la caída del peso.'
      ]
    },
    {
      nombre: 'Elevaciones frontales en polea baja o con mancuernas',
      equipo: '⚙️ Multigym con poleas / 🏋️ Mancuernas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Parate derecho sosteniendo las mancuernas (o la barra de la polea baja) frente a tus muslos.',
        'Con los brazos casi rectos, subí el peso hacia adelante hasta la línea de tus ojos.',
        'Mantené 1 segundo arriba sintiendo el trabajo en la cara frontal del hombro.',
        'Bajá lento sin balancear el torso.'
      ]
    },
    {
      nombre: 'Remo al mentón en polea baja del Multigym',
      equipo: '⚙️ Multigym con poleas',
      series: '3 series × 12 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Tomá la barra corta conectada a la polea baja con las manos separadas a unos 15-20 cm.',
        'Subí la barra pegada al cuerpo llevando los codos bien altos hacia afuera hasta la altura del pecho alto.',
        'Mantené los hombros controlados arriba durante 1 segundo.',
        'Bajá lentamente hasta estirar los brazos.'
      ]
    },
    {
      nombre: 'Vuelos posteriores (pájaros) inclinado con mancuernas',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 12 a 15 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Incliná el torso hacia adelante a 45° (o sentate inclinando el pecho hacia las rodillas) con espalda recta.',
        'Dejá colgar las mancuernas debajo del pecho con las palmas enfrentadas.',
        'Abrí ambos brazos hacia atrás y arriba enfocándote en la parte posterior del hombro.',
        'Bajá de forma pausada y controlada.'
      ]
    }
  ],
  'Piernas': [
    {
      nombre: 'Extensión de cuádriceps sentado en Multigym',
      equipo: '⚙️ Multigym con poleas',
      series: '4 series × 12 a 15 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Sentate en el Multigym, apoyá bien la cadera y colocá los empeines detrás de los rodillos acolchados inferiores.',
        'Tomate de los agarres laterales para mantener firme el torso.',
        'Extendé ambas piernas hacia arriba hasta que queden rectas, apretando fuerte los cuádriceps 1 segundo arriba.',
        'Bajá despacio controlando las placas de peso sin dejar que golpeen.'
      ]
    },
    {
      nombre: 'Sentadilla Goblet / Sumo con mancuernas',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 10 a 12 repeticiones',
      descanso: '75 seg',
      pasos: [
        'Parate con los pies un poco más anchos que tus hombros y las puntas levemente hacia afuera, sosteniendo una mancuerna pesada pegada al pecho (o dos a los lados).',
        'Bajá la cadera hacia atrás y abajo como si te sentaras en una silla, manteniendo el pecho alto y la espalda derecha.',
        'Descendé hasta que los muslos queden paralelos al piso sin que las rodillas se metan hacia adentro.',
        'Empujá el suelo con los talones para volver a subir apretando glúteos y piernas.'
      ]
    },
    {
      nombre: 'Peso muerto rumano con mancuernas (isquiotibiales y glúteos)',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 10 a 12 repeticiones',
      descanso: '75 seg',
      pasos: [
        'Parate derecho con los pies al ancho de caderas sosteniendo las mancuernas pegadas a la parte frontal de tus muslos.',
        'Con las rodillas apenas destrabadas y la espalda totalmente recta, llevá la cadera bien hacia atrás.',
        'Deslizá las mancuernas rozando tus piernas hasta la mitad de las tibias sintiendo cómo tiran los femorales.',
        'Subí empujando la cadera hacia adelante y apretando los glúteos.'
      ]
    },
    {
      nombre: 'Estocadas (Zancadas) con mancuernas en mano',
      equipo: '🏋️ Mancuernas',
      series: '3 series × 10 repeticiones por pierna',
      descanso: '75 seg',
      pasos: [
        'Sostené una mancuerna en cada mano a los costados del cuerpo con el torso erguido.',
        'Dá un paso largo hacia adelante y flexioná ambas rodillas hasta que formen un ángulo de 90°.',
        'Cuidá que la rodilla de adelante quede alineada con tu pie y la de atrás casi roce el piso.',
        'Empujá con el talón delantero para regresar a la posición inicial y alterná de pierna.'
      ]
    },
    {
      nombre: 'Curl femoral de pie o acostado en Multigym',
      equipo: '⚙️ Multigym con poleas',
      series: '3 series × 12 a 15 repeticiones',
      descanso: '60 seg',
      pasos: [
        'Colocá la parte posterior del tobillo detrás del rodillo inferior del Multigym (o acostado según el modelo de tu banco).',
        'Mantené el muslo apoyado y firme sin mover la cadera.',
        'Flexioná la rodilla llevando el talón hacia el glúteo apretando la parte trasera del muslo.',
        'Bajá lentamente estirando por completo la pierna.'
      ]
    },
    {
      nombre: 'Elevación de talones de pie con mancuernas (Gemelos)',
      equipo: '🏋️ Mancuernas',
      series: '4 series × 15 a 20 repeticiones',
      descanso: '45 seg',
      pasos: [
        'Parate derecho sosteniendo dos mancuernas a los lados con los pies separados al ancho de caderas.',
        'Despegá los talones del piso subiendo lo más alto posible sobre las puntas de los pies.',
        'Mantené la contracción arriba durante 1 segundo sintiendo el trabajo en los gemelos.',
        'Bajá despacio apoyando los talones y repetí.'
      ]
    }
  ]
};

// Orden ideal de emparejamiento de a 2 grupos musculares por día
function armarParesDeGruposPorDia(zonasArray, cantDiasSemana) {
  const ordenPreferido = ['Pecho', 'Tríceps', 'Espalda', 'Bíceps', 'Piernas', 'Hombros'];
  const ordenadas = ordenPreferido.filter(z => zonasArray.includes(z));
  zonasArray.forEach(z => {
    if (!ordenadas.includes(z)) ordenadas.push(z);
  });

  if (ordenadas.length === 0) return [];

  // Si eligió 1 solo grupo muscular
  if (ordenadas.length === 1) {
    const dias = [];
    for (let d = 1; d <= cantDiasSemana; d++) {
      dias.push({ numeroDia: d, grupos: [ordenadas[0]], vuelta: d - 1 });
    }
    return dias;
  }

  // Dividir SIEMPRE de a 2 grupos musculares por bloque
  const bloquesDeDos = [];
  for (let i = 0; i < ordenadas.length; i += 2) {
    if (i + 1 < ordenadas.length) {
      bloquesDeDos.push([ordenadas[i], ordenadas[i + 1]]);
    } else {
      // Si quedó un número impar de grupos (ej: 3 o 5), lo acompaña con el primero para que el día tenga 2 grupos
      bloquesDeDos.push([ordenadas[i], ordenadas[0]]);
    }
  }

  const diasPlan = [];
  for (let d = 0; d < cantDiasSemana; d++) {
    const indiceBloque = d % bloquesDeDos.length;
    const vuelta = Math.floor(d / bloquesDeDos.length);
    diasPlan.push({
      numeroDia: d + 1,
      grupos: bloquesDeDos[indiceBloque],
      vuelta: vuelta
    });
  }
  return diasPlan;
}

function actualizarVistaPreviaDivision() {
  if (!workoutSplitPreview) return;
  const zonas = Array.from(zonasSeleccionadasEntrenamiento);
  const cantDias = parseInt((inputWorkoutDays && inputWorkoutDays.value) || '3', 10) || 3;

  if (zonas.length === 0) {
    workoutSplitPreview.innerHTML = '⚠️ Seleccioná al menos un grupo muscular arriba.';
    return;
  }

  const diasPlan = armarParesDeGruposPorDia(zonas, cantDias);
  const resumenDias = diasPlan
    .map(d => `<b>Día ${d.numeroDia}:</b> ${d.grupos.join(' + ')}`)
    .join(' &nbsp;•&nbsp; ');

  workoutSplitPreview.innerHTML = `📌 <b>División automática (de a 2 grupos por día en tus ${cantDias} día${cantDias === 1 ? '' : 's'} por semana):</b><br>${resumenDias}`;
}

function actualizarBotonesZonasEntrenamiento() {
  if (!workoutZonesSelector) return;
  workoutZonesSelector.querySelectorAll('.prio-option').forEach(btn => {
    const zona = btn.dataset.zone;
    const activa = zonasSeleccionadasEntrenamiento.has(zona);
    btn.classList.toggle('active', activa);
    const box = btn.querySelector('.super-edible-box');
    if (box) {
      box.textContent = activa ? '✓' : '';
      box.style.background = activa ? '#22c55e' : 'transparent';
      box.style.color = activa ? '#052e16' : 'transparent';
      box.style.borderColor = activa ? '#22c55e' : '#64748b';
    }
  });
  actualizarVistaPreviaDivision();
}

if (workoutZonesSelector) {
  workoutZonesSelector.querySelectorAll('.prio-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const zona = btn.dataset.zone;
      if (zonasSeleccionadasEntrenamiento.has(zona)) {
        zonasSeleccionadasEntrenamiento.delete(zona);
      } else {
        zonasSeleccionadasEntrenamiento.add(zona);
      }
      actualizarBotonesZonasEntrenamiento();
    });
  });
}

if (btnSelectAllZones) {
  btnSelectAllZones.addEventListener('click', () => {
    TODAS_LAS_ZONAS_GYM.forEach(z => zonasSeleccionadasEntrenamiento.add(z));
    if (inputWorkoutDays && parseInt(inputWorkoutDays.value, 10) < 3) {
      inputWorkoutDays.value = '3';
    }
    actualizarBotonesZonasEntrenamiento();
  });
}

if (inputWorkoutDays) {
  inputWorkoutDays.addEventListener('change', actualizarVistaPreviaDivision);
}

function calcularDiasDuracionRutina(textoDuracion) {
  const txt = String(textoDuracion || '').toLowerCase();
  const numMatch = txt.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 1;
  if (txt.includes('semana')) return num * 7;
  if (txt.includes('dia') || txt.includes('día')) return num;
  if (txt.includes('año') || txt.includes('ano')) return num * 365;
  return num * 30;
}

function cantidadEjerciciosPorGrupoSegunTiempo(textoTiempo, cantGruposEnElDia) {
  const txt = String(textoTiempo || '45').toLowerCase();
  if (txt.includes('30')) return cantGruposEnElDia === 1 ? 4 : 2;
  if (txt.includes('90')) return cantGruposEnElDia === 1 ? 6 : 4;
  if (txt.includes('60')) return cantGruposEnElDia === 1 ? 5 : 4;
  return cantGruposEnElDia === 1 ? 5 : 3; // 45 minutos -> 3 ejercicios por cada uno de los 2 grupos (6 ejercicios totales en el día)
}

function construirPlanEstructuradoEjercicios(zonas, cantDias, tiempoTexto, offsetVariante) {
  const diasDivididos = armarParesDeGruposPorDia(zonas, cantDias);

  return diasDivididos.map(diaObj => {
    const cantPorGrupo = cantidadEjerciciosPorGrupoSegunTiempo(tiempoTexto, diaObj.grupos.length);
    const ejerciciosDelDia = [];

    diaObj.grupos.forEach(grupo => {
      const listaCatalogo = CATALOGO_EJERCICIOS_GYM[grupo] || [];
      const inicio = ((diaObj.vuelta * 2) + offsetVariante) % Math.max(1, listaCatalogo.length);
      for (let i = 0; i < Math.min(cantPorGrupo, listaCatalogo.length); i++) {
        const ej = listaCatalogo[(inicio + i) % listaCatalogo.length];
        ejerciciosDelDia.push({
          grupo: grupo,
          nombre: ej.nombre,
          equipo: ej.equipo,
          series: ej.series,
          descanso: ej.descanso,
          pasos: ej.pasos
        });
      }
    });

    return {
      numeroDia: diaObj.numeroDia,
      tituloGrupos: diaObj.grupos.join(' + '),
      ejercicios: ejerciciosDelDia
    };
  });
}

function renderizarTarjetasDePlan(diasPlan, tiempoTexto) {
  if (!workoutRoutineContent) return;
  workoutRoutineContent.innerHTML = '';

  diasPlan.forEach(dia => {
    const cardDia = document.createElement('div');
    cardDia.className = 'workout-day-card';

    let htmlEjercicios = '';
    dia.ejercicios.forEach((ej, idx) => {
      const pasosLi = (ej.pasos || [])
        .map((p, i) => `<li><strong>Paso ${i + 1}:</strong> ${escaparHTML(p)}</li>`)
        .join('');

      htmlEjercicios += `
        <div class="workout-exercise-card">
          <div class="workout-exercise-top">
            <div class="workout-exercise-title">${idx + 1}. ${escaparHTML(ej.nombre)}</div>
            <div class="workout-exercise-badges">
              <span class="priority-pill pill-simple">🎯 ${escaparHTML(ej.grupo)}</span>
              <span class="priority-pill pill-hora">${escaparHTML(ej.equipo)}</span>
              <span class="priority-pill pill-intermedio">🔁 ${escaparHTML(ej.series)}</span>
              <span class="priority-pill pill-hora">⏱️ Descanso: ${escaparHTML(ej.descanso)}</span>
            </div>
          </div>
          <ol class="workout-steps-list">
            ${pasosLi}
          </ol>
        </div>
      `;
    });

    cardDia.innerHTML = `
      <div class="workout-day-header">
        <div class="workout-day-title">📅 Día ${dia.numeroDia}: ${escaparHTML(dia.tituloGrupos)}</div>
        <span class="priority-pill pill-simple">⏱️ Sesión de ${escaparHTML(tiempoTexto || '45 minutos')} (${dia.ejercicios.length} ejercicios)</span>
      </div>
      <div class="workout-exercises-list">
        ${htmlEjercicios}
      </div>
    `;

    workoutRoutineContent.appendChild(cardDia);
  });
}

function renderizarEntrenamiento() {
  actualizarBotonesZonasEntrenamiento();
  if (!workoutRoutineBox || !workoutRoutineContent) return;

  if (entrenamiento && (Array.isArray(entrenamiento.diasPlan) || entrenamiento.rutinaTexto)) {
    if (Array.isArray(entrenamiento.zonas) && entrenamiento.zonas.length > 0) {
      zonasSeleccionadasEntrenamiento = new Set(entrenamiento.zonas);
    }
    if (inputWorkoutDays && entrenamiento.diasNumero) {
      inputWorkoutDays.value = String(entrenamiento.diasNumero);
    }
    if (inputWorkoutTime && entrenamiento.tiempo) {
      inputWorkoutTime.value = entrenamiento.tiempo;
    }
    if (inputWorkoutDuration && entrenamiento.duracion) {
      inputWorkoutDuration.value = entrenamiento.duracion;
    }
    actualizarBotonesZonasEntrenamiento();

    workoutRoutineBox.classList.remove('hidden');

    const cantDiasGuardados = entrenamiento.diasNumero || 3;
    const planAMostrar = Array.isArray(entrenamiento.diasPlan) && entrenamiento.diasPlan.length > 0
      ? entrenamiento.diasPlan
      : construirPlanEstructuradoEjercicios(Array.from(zonasSeleccionadasEntrenamiento), cantDiasGuardados, entrenamiento.tiempo || '45 minutos', 0);

    renderizarTarjetasDePlan(planAMostrar, entrenamiento.tiempo || '45 minutos');

    if (workoutExpiryBadge && entrenamiento.venceEl) {
      const ahora = Date.now();
      const diffDias = Math.ceil((entrenamiento.venceEl - ahora) / (1000 * 60 * 60 * 24));
      const fechaVence = new Date(entrenamiento.venceEl).toLocaleDateString('es-AR');
      if (diffDias <= 0) {
        workoutExpiryBadge.className = 'priority-pill pill-urgente';
        workoutExpiryBadge.textContent = `⚠️ Rutina vencida (${fechaVence}) — ¡Generá una nueva!`;
      } else {
        workoutExpiryBadge.className = 'priority-pill pill-simple';
        workoutExpiryBadge.textContent = `📅 Vigente hasta el ${fechaVence} (faltan ${diffDias} día${diffDias === 1 ? '' : 's'})`;
      }
    }
  } else {
    workoutRoutineBox.classList.add('hidden');
  }
}

function generarRutinaEntrenamiento(esOtraVariante) {
  const zonas = Array.from(zonasSeleccionadasEntrenamiento);
  if (zonas.length === 0) {
    alert('Por favor seleccioná al menos un grupo muscular (Pecho, Espalda, Bíceps, Tríceps, Hombros o Piernas).');
    return;
  }

  if (esOtraVariante) {
    indiceVarianteRutina = (indiceVarianteRutina + 1) % 6;
  } else {
    indiceVarianteRutina = 0;
  }

  const cantDias = parseInt((inputWorkoutDays && inputWorkoutDays.value) || '3', 10) || 3;
  const tiempo = (inputWorkoutTime && inputWorkoutTime.value) || '45 minutos';
  const duracion = (inputWorkoutDuration && inputWorkoutDuration.value) || '1 mes';

  const diasPlan = construirPlanEstructuradoEjercicios(zonas, cantDias, tiempo, indiceVarianteRutina);
  const diasVigencia = calcularDiasDuracionRutina(duracion);
  const ahora = Date.now();
  const venceEl = ahora + diasVigencia * 24 * 60 * 60 * 1000;

  entrenamiento = {
    zonas: zonas,
    diasNumero: cantDias,
    dias: `${cantDias} día${cantDias === 1 ? '' : 's'} por semana`,
    tiempo: tiempo,
    duracion: duracion,
    creadoEl: ahora,
    venceEl: venceEl,
    diasPlan: diasPlan,
    updatedAt: ahora
  };

  renderizarEntrenamiento();
  guardarEnNube();
}

if (btnGenerateWorkout) btnGenerateWorkout.addEventListener('click', () => generarRutinaEntrenamiento(false));
if (btnAnotherWorkout) btnAnotherWorkout.addEventListener('click', () => generarRutinaEntrenamiento(true));

// ==========================================
// INICIALIZACIÓN
// ==========================================
mostrarFechaHoy();

if (ES_MODO_EXTERNO) {
  viewUsers.classList.add('hidden');
  viewHome.classList.add('hidden');
  if (syncStatusEl) syncStatusEl.classList.add('hidden');
  viewExternal.classList.remove('hidden');
  if (inputExtName) inputExtName.focus();
} else {
  try {
    history.replaceState({ vista: 'users' }, '');
    history.pushState({ vista: 'users' }, '');
  } catch (e) {}
  cargarListaDeUsuarios();

  setInterval(() => {
    if (usuarioActivo) {
      if (!obtenerPasswordSesionVigente(usuarioActivo.id)) {
        volverAPantallaUsuarios();
      } else if (limpiarTareasVencidas()) {
        guardarEnNube();
      } else {
        renderizarTareas();
      }
    }
  }, 30000);

  setInterval(() => {
    if (usuarioActivo) {
      verificarNotificacionesPendientes(false);
      sincronizarDesdeNube();
    }
  }, 15000);
}
