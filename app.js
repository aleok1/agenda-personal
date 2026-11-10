// Global error handler para visibilidad inmediata en pantalla si algo falla
window.onerror = function(msg, url, lineNo, colNo, error) {
  console.error('ERROR GLOBAL:', msg, lineNo, error);
  const syncEl = document.getElementById('sync-status');
  if (syncEl) {
    syncEl.textContent = '⚠️ Error L' + lineNo;
    syncEl.title = String(msg || '');
    syncEl.style.background = 'rgba(239, 68, 68, 0.2)';
    syncEl.style.color = '#f87171';
  }
};

// Configuración de tiempos: 1 hora para sesión sin contraseña, 1 hora para desaparecer tareas completadas, y 1 año para historial de calendario
const UNA_HORA_MS = 60 * 60 * 1000;
const UN_ANIO_MS = 365 * 24 * 60 * 60 * 1000; // 365 días para historial del calendario
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

const API_SYNC_URL = window.location.origin.includes('localhost') ? 'https://agenda-personal-aleok.vercel.app/api/sync' : '/api/sync';
const API_CHAT_URL = window.location.origin.includes('localhost') ? 'https://agenda-personal-aleok.vercel.app/api/chat' : '/api/chat';

function obtenerFechaISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const hoyDate = new Date();
const HOY_ISO = obtenerFechaISO(hoyDate);

// Estado global de usuarios y sesión activa con respaldo inmediato
let listaUsuariosPublica = [
  { id: 'alejandro', nombre: 'Alejandro', esAdmin: true, avatar: '👑', tienePassword: true },
  { id: 'nico-7999', nombre: 'Nico', esAdmin: false, avatar: '🦁', tienePassword: true },
  { id: 'romi-7301', nombre: 'ROMI', esAdmin: false, avatar: '🌸', tienePassword: true },
  { id: 'ariel-0414', nombre: 'Ariel', esAdmin: false, avatar: '⚡', tienePassword: true }
];

try {
  const guardados = localStorage.getItem('agenda_usuarios_cache');
  if (guardados) {
    const arr = JSON.parse(guardados);
    if (Array.isArray(arr) && arr.length > 0) {
      listaUsuariosPublica = arr;
    }
  }
} catch (e) {}

let usuarioActivo = null; // { id, nombre, esAdmin, password }
let usuarioSeleccionadoParaLogin = null;

// Datos privados del usuario que ingresó
let borrados = [];
let borradosListas = [];
let tareas = [];
let avisosTareas = [];
let recordatorios = [];
let movimientos = [];
let supermercado = [];
let heladera = [];
let entrenamiento = null;
let listasPresupuestos = [];
let idListaPresupuestoActiva = null;
let deudores = [];
let idDeudorActivo = null;
let yoDebo = [];
let tareasCompartidas = [];
let prioridadTareaCompartida = 'simple';
let subtabEconomiaActiva = 'wallet';
let subtabDeudaActiva = 'me-deben';
let idConceptoParaPagar = null;
let recordatorioYoDeboActivo = '1d';
let modoNuevaLista = 'solo';
let usuariosSeleccionadosNuevaLista = new Set();
let usuariosSeleccionadosEdicionLista = new Set();
let superCompartidoCon = [];
let yaConfiguroCasa = false;
let seleccionConvivientesTemp = new Set();
let solicitudesVinculoRecibidas = [];
let solicitudesVinculoEnviadas = [];

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
let bloqueandoGuardadoNav = false;

const STORAGE_NAV_STATE_PREFIX = 'agenda_nav_state_v1_';
const STORAGE_USER_DATA_CACHE_PREFIX = 'agenda_datos_cache_v1_';

function registrarPasoHistorial(vistaNombre) {
  if (navegandoPorHistorial || ES_MODO_EXTERNO) return;
  try {
    history.pushState({ vista: vistaNombre }, '');
  } catch (e) {}
  if (!bloqueandoGuardadoNav) {
    setTimeout(guardarEstadoNavegacionActual, 0);
  }
}

// Elementos del DOM
const viewUsers = document.getElementById('view-users');
const viewHome = document.getElementById('view-home');
const viewTasks = document.getElementById('view-tasks');
const viewAgenda = document.getElementById('view-agenda');
const viewWallet = document.getElementById('view-wallet');
const viewAssistant = document.getElementById('view-assistant');
const viewExtras = document.getElementById('view-extras');
const viewSettings = document.getElementById('view-settings');
const btnOpenSettings = document.getElementById('btn-open-settings');
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
const btnOpenCreateUser = document.getElementById('btn-open-create-user');
const createUserBox = document.getElementById('create-user-box');
const inputNewUserName = document.getElementById('input-new-user-name');
const inputNewUserDni = document.getElementById('input-new-user-dni');
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
const btnOpenTasksAgendaMenu = document.getElementById('btn-open-tasks-agenda-menu');
const viewTasksAgendaMenu = document.getElementById('view-tasks-agenda-menu');
const btnBackFromTasksAgendaMenu = document.getElementById('btn-back-from-tasks-agenda-menu');
const btnSubTasks = document.getElementById('btn-sub-tasks');
const btnSubAgenda = document.getElementById('btn-sub-agenda');
const btnSubSharedTasks = document.getElementById('btn-sub-shared-tasks');
const btnBackToTasksMenu = document.getElementById('btn-back-to-tasks-menu');
const btnBackToAgendaMenu = document.getElementById('btn-back-to-agenda-menu');
const homeTasksAgendaCounter = document.getElementById('home-tasks-agenda-counter');
const menuTasksCounter = document.getElementById('menu-tasks-counter');
const menuAgendaCounter = document.getElementById('menu-agenda-counter');
const menuSharedTasksCounter = document.getElementById('menu-shared-tasks-counter');

// Menú unificado de Economía Personal y vistas separadas
const viewEconomyMenu = document.getElementById('view-economy-menu');
const btnBackFromEconomyMenu = document.getElementById('btn-back-from-economy-menu');
const btnSubWallet = document.getElementById('btn-sub-wallet');
const btnSubDebts = document.getElementById('btn-sub-debts');
const viewDebts = document.getElementById('view-debts');
const btnBackToEconomyFromWallet = document.getElementById('btn-back-to-economy-from-wallet');
const btnBackToEconomyFromDebts = document.getElementById('btn-back-to-economy-from-debts');
const menuWalletCounter = document.getElementById('menu-wallet-counter');
const menuDebtsCounter = document.getElementById('menu-debts-counter');

// Tareas Compartidas
const viewSharedTasks = document.getElementById('view-shared-tasks');
const btnBackSharedToMenu = document.getElementById('btn-back-shared-to-menu');
const btnNewSharedTask = document.getElementById('btn-new-shared-task');
const sharedTasksInvitationsBox = document.getElementById('shared-tasks-invitations-box');
const sharedInvitationsList = document.getElementById('shared-invitations-list');
const formNewSharedTaskBox = document.getElementById('form-new-shared-task-box');
const selectSharedPartner = document.getElementById('select-shared-partner');
const inputSharedTaskText = document.getElementById('input-shared-task-text');
const sharedTaskPrioritySelector = document.getElementById('shared-task-priority-selector');
const btnCancelSharedTask = document.getElementById('btn-cancel-shared-task');
const btnSaveSharedTask = document.getElementById('btn-save-shared-task');
const sharedTasksList = document.getElementById('shared-tasks-list');

// Ingreso con DNI, Huella y Registro
const dniLoginBox = document.getElementById('dni-login-box');
const dniFingerprintBox = document.getElementById('dni-fingerprint-box');
const btnDniFingerprint = document.getElementById('btn-dni-fingerprint');
const btnDniFingerprintTitle = document.getElementById('btn-dni-fingerprint-title');
const inputLoginDni = document.getElementById('input-login-dni');
const inputLoginDniPass = document.getElementById('input-login-dni-pass');
const btnToggleDniPass = document.getElementById('btn-toggle-dni-pass');
const dniLoginError = document.getElementById('dni-login-error');
const btnSubmitDniLogin = document.getElementById('btn-submit-dni-login');
const modalRegisterDni = document.getElementById('modal-register-dni');
const inputUserDni = document.getElementById('input-user-dni');
const registerDniError = document.getElementById('register-dni-error');
const btnSaveUserDni = document.getElementById('btn-save-user-dni');
const btnLogoutDevice = document.getElementById('btn-logout-device');

// Pestañas Configuración Normal vs Desarrollador
const settingsTabsHeader = document.getElementById('settings-tabs-header');
const tabBtnSettingsNormal = document.getElementById('tab-btn-settings-normal');
const tabBtnSettingsDev = document.getElementById('tab-btn-settings-dev');
const boxSettingsNormal = document.getElementById('box-settings-normal');
const boxSettingsDev = document.getElementById('box-settings-dev');
const inputDevTnaMp = document.getElementById('input-dev-tna-mp');
const inputDevTnaUala = document.getElementById('input-dev-tna-uala');
const btnDevSaveTna = document.getElementById('btn-dev-save-tna');
const devTnaSavedMsg = document.getElementById('dev-tna-saved-msg');

// Elementos de Registro directo con DNI
const btnToggleDniRegister = document.getElementById('btn-toggle-dni-register');
const boxDniRegisterNew = document.getElementById('box-dni-register-new');
const inputRegName = document.getElementById('input-reg-name');
const inputRegDni = document.getElementById('input-reg-dni');
const inputRegPass = document.getElementById('input-reg-pass');
const dniRegisterError = document.getElementById('dni-register-error');
const btnCancelDniRegister = document.getElementById('btn-cancel-dni-register');
const btnSubmitDniRegister = document.getElementById('btn-submit-dni-register');

configurarBotonOjito(btnToggleDniPass, inputLoginDniPass);

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
  syncStatusEl.style.cursor = 'pointer';
  syncStatusEl.title = 'Tocá para ver el estado técnico o copiar código de diagnóstico';
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

if (syncStatusEl) {
  syncStatusEl.addEventListener('click', () => {
    if (typeof window.mostrarDiagnosticoError === 'function') {
      const txt = syncStatusEl.textContent || '';
      const estaBien = txt.includes('En línea') || txt.includes('Sincronizado') || txt.includes('Guardando');
      window.mostrarDiagnosticoError({
        tipo: estaBien ? 'INFO_ESTADO' : 'ESTADO_SYNC',
        mensaje: estaBien 
          ? `Aplicación sincronizada correctamente. Usuario activo: ${usuarioActivo ? usuarioActivo.nombre : 'Ninguno seleccionado'}.`
          : `Estado de sincronización: ${txt.trim()}. Detalle técnico: ${window.__LAST_SYNC_ERROR || 'Sin respuesta del servidor o sin conexión a internet'}.`,
        archivo: 'api/sync'
      });
    }
  });
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
['click', 'touchstart', 'keydown', 'scroll'].forEach(evt => {
  window.addEventListener(evt, () => {
    if (usuarioActivo) {
      const passVigente = obtenerPasswordSesionVigente(usuarioActivo.id);
      if (!passVigente) {
        // Pasó el tiempo de inactividad: volver a pantalla de usuarios y pedir contraseña
        volverAPantallaUsuarios();
      } else {
        registrarActividadSesion();
      }
    }
  }, { passive: true });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (usuarioActivo) {
      const passVigente = obtenerPasswordSesionVigente(usuarioActivo.id);
      if (!passVigente) {
        volverAPantallaUsuarios();
      } else {
        registrarActividadSesion();
      }
    } else if (typeof actualizarVisibilidadHuellaDni === 'function') {
      actualizarVisibilidadHuellaDni(false);
    }
  }
});

// =========================================================================
// PANTALLA 0: SELECCIÓN DE USUARIO, LOGIN Y CREACIÓN DE NUEVOS USUARIOS
// =========================================================================
async function cargarListaDeUsuarios() {
  const recordadoId = localStorage.getItem('agenda_usuario_recordado');

  // Si el usuario ya tenía una sesión activa de menos de 1 hora (o su tiempo configurado), entrar directamente
  if (recordadoId) {
    const passSesion = obtenerPasswordSesionVigente(recordadoId);
    if (passSesion) {
      let u = listaUsuariosPublica.find(x => x.id === recordadoId);
      if (!u) {
        try {
          const cache = JSON.parse(localStorage.getItem('agenda_usuarios_cache') || '[]');
          u = cache.find(x => x.id === recordadoId);
        } catch (e) {}
      }
      if (!u) u = { id: recordadoId, nombre: 'Alejandro', tienePassword: true };
      // Restaurar instantáneamente desde caché local en 0ms para volver a la página donde estaba sin parpadeo
      restaurarDesdeCacheLocalAlRecargar(u, passSesion);
      intentarIngresoConPassword(u, passSesion, true);
      return;
    }
  }

  if (usersGrid) usersGrid.classList.add('hidden');
  if (loginPasswordBox) loginPasswordBox.classList.add('hidden');
  if (createUserBox) createUserBox.classList.add('hidden');

  // dniLoginBox SIEMPRE está visible en la pantalla inicial para cualquier computadora o celular
  if (dniLoginBox) {
    dniLoginBox.classList.remove('hidden');
    let u = null;
    if (recordadoId) {
      u = listaUsuariosPublica.find(x => x.id === recordadoId);
      if (!u) {
        try {
          const cache = JSON.parse(localStorage.getItem('agenda_usuarios_cache') || '[]');
          u = cache.find(x => x.id === recordadoId);
        } catch (e) {}
      }
      if (u && inputLoginDni && !inputLoginDni.value) {
        inputLoginDni.value = u.dni || u.nombre;
      }
    }

    // Verificar si tiene huella configurada en este celular y lanzar sensor
    actualizarVisibilidadHuellaDni(true);
    if (!obtenerUsuarioParaHuella()) {
      if (inputLoginDniPass && inputLoginDni && inputLoginDni.value) {
        inputLoginDniPass.focus();
      } else if (inputLoginDni) {
        inputLoginDni.focus();
      }
    }
  }

  actualizarEstadoSync('☁️ Conectando...', 'amarillo');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(API_SYNC_URL + '?accion=lista_usuarios&t=' + Date.now(), {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.usuarios) && data.usuarios.length > 0) {
        listaUsuariosPublica = data.usuarios;
        try {
          localStorage.setItem('agenda_usuarios_cache', JSON.stringify(data.usuarios));
        } catch (e) {}

        const recId = localStorage.getItem('agenda_usuario_recordado');
        if (recId && inputLoginDni && !inputLoginDni.value) {
          const uRec = listaUsuariosPublica.find(x => x.id === recId);
          if (uRec) {
            inputLoginDni.value = uRec.dni || uRec.nombre;
          }
        }
        actualizarVisibilidadHuellaDni(false);
      }

      if (data.configTna) {
        if (data.configTna.mercadopago) TNA_BILLETERAS_INFO.mercadopago.tnaDefault = Number(data.configTna.mercadopago);
        if (data.configTna.uala) TNA_BILLETERAS_INFO.uala.tnaDefault = Number(data.configTna.uala);
      }

      window.__LAST_SYNC_ERROR = null;
      actualizarEstadoSync('☁️ En línea', 'verde');
    } else {
      window.__LAST_SYNC_ERROR = `HTTP ${res.status}: ${res.statusText || 'Error de servidor'}`;
      actualizarEstadoSync('☁️ Sin conexión', 'amarillo');
    }
  } catch (e) {
    clearTimeout(timer);
    window.__LAST_SYNC_ERROR = (e && e.message) || String(e);
    actualizarEstadoSync('☁️ Sin conexión', 'amarillo');
  }
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

    const defaultAvatars = {
      'alejandro': '👑',
      'nico-7999': '🦁',
      'romi-7301': '🌸',
      'ariel-0414': '⚡'
    };
    const icono = u.avatar || defaultAvatars[u.id] || (u.esAdmin ? '👑' : '👤');
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

// Renderizado inmediato al evaluar el script
try { renderizarGrillaUsuarios(); } catch (e) {}

async function seleccionarUsuarioParaEntrar(u) {
  if (dniLoginBox) dniLoginBox.classList.add('hidden');
  if (usersGrid) usersGrid.classList.add('hidden');
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
    loginBoxTitle.textContent = `🔒 Desbloquear agenda de ${u.nombre}`;
    loginBoxSubtitle.textContent = tieneHuella
      ? 'Tocá el botón para usar tu huella o ingresá tu contraseña privada:'
      : 'Ingresá tu contraseña privada para abrir tu agenda personal.';
    labelLoginPassword.textContent = 'Tu contraseña';
  }

  if (!tieneHuella) {
    inputLoginPassword.focus();
  }
}

btnCancelLogin.addEventListener('click', () => {
  loginPasswordBox.classList.add('hidden');
  usuarioSeleccionadoParaLogin = null;
  localStorage.removeItem('agenda_usuario_recordado');
  if (dniLoginBox) {
    dniLoginBox.classList.remove('hidden');
    if (inputLoginDni) {
      inputLoginDni.value = '';
      inputLoginDni.focus();
    }
  }
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
    const yaEstabaEnPantallaRestaurada = Boolean(eraAutomatico && usuarioActivo && usuarioActivo.id === u.id && viewUsers.classList.contains('hidden'));
    const deudorPrevioId = idDeudorActivo;
    localStorage.setItem('agenda_usuario_recordado', u.id);
    const esDev = Boolean(u.id === 'alejandro' || (u.dni && String(u.dni).replace(/\D/g, '') === '40218898') || (data.dni && String(data.dni).replace(/\D/g, '') === '40218898'));
    usuarioActivo = {
      id: u.id,
      nombre: u.nombre,
      dni: data.dni || data.usuario?.dni || u.dni || null,
      esAdmin: esDev,
      avatar: esDev ? '👑' : (data.usuario?.avatar || u.avatar || '👤'),
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
    tareasCompartidas = Array.isArray(data.tareasCompartidas) ? data.tareasCompartidas : [];
    avisosTareas = Array.isArray(data.avisosTareas) ? data.avisosTareas : [];
    recordatorios = Array.isArray(data.recordatorios) ? data.recordatorios : [];
    movimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
    supermercado = Array.isArray(data.supermercado) ? data.supermercado : [];
    heladera = Array.isArray(data.heladera) ? data.heladera : [];
    entrenamiento = data.entrenamiento || null;
    listasPresupuestos = Array.isArray(data.listasPresupuestos) ? data.listasPresupuestos : [];
    deudores = Array.isArray(data.deudores) ? data.deudores : [];
    yoDebo = Array.isArray(data.yoDebo) ? data.yoDebo : [];
    idDeudorActivo = yaEstabaEnPantallaRestaurada ? deudorPrevioId : null;
    superCompartidoCon = Array.isArray(data.superCompartidoCon) ? data.superCompartidoCon : [];
    yaConfiguroCasa = Boolean(data.yaConfiguroCasa);
    borrados = Array.isArray(data.borrados) ? data.borrados : [];
    borradosListas = Array.isArray(data.borradosListas) ? data.borradosListas : [];
    if (data.tnaConfig) usuarioActivo.tnaConfig = data.tnaConfig;
    usuarioActivo.vinculos = Array.isArray(data.vinculos) ? data.vinculos : [];
    solicitudesVinculoRecibidas = Array.isArray(data.solicitudesVinculoRecibidas) ? data.solicitudesVinculoRecibidas : [];
    solicitudesVinculoEnviadas = Array.isArray(data.solicitudesVinculoEnviadas) ? data.solicitudesVinculoEnviadas : [];

    guardarCacheDatosUsuarioLocal();
    registrarActividadSesion();
    loginPasswordBox.classList.add('hidden');
    if (dniLoginBox) dniLoginBox.classList.add('hidden');

    if (yaEstabaEnPantallaRestaurada) {
      // Ya estaba en la pantalla restaurada tras recargar: actualizar componentes sin sacarlo de su pantalla
      limpiarTareasVencidas();
      actualizarContadoresYAlertas();
      actualizarContadoresTareasAgendaMenu();
      actualizarContadoresEconomiaMenu();
      renderizarTareas();
      renderizarTareasCompartidas();
      renderizarCalendario();
      renderizarRecordatoriosDelDia();
      renderizarBilletera();
      renderizarSupermercado();
      renderizarHeladera();
      renderizarEntrenamiento();
      renderizarListasPresupuestos();
      if (subtabDeudaActiva === 'yo-debo') {
        renderizarYoDebo();
      } else {
        renderizarDeudores(true);
      }
      actualizarEstadoSync('☁️ Sincronizado', 'verde');
    } else {
      entrarAMenuDeUsuarioActivo(true);
    }
  } catch (e) {
    loginErrorMsg.textContent = 'Error de conexión. Intentá nuevamente.';
    loginErrorMsg.classList.remove('hidden');
  } finally {
    btnConfirmLogin.disabled = false;
    btnConfirmLogin.textContent = 'Entrar (Enter)';
  }
}

// Crear un + Nuevo Usuario
function abrirFormularioNuevoUsuario() {
  if (loginPasswordBox) loginPasswordBox.classList.add('hidden');
  if (!createUserBox) return;
  createUserBox.classList.toggle('hidden');
  if (!createUserBox.classList.contains('hidden')) {
    if (inputNewUserName) {
      inputNewUserName.value = '';
      inputNewUserName.focus();
    }
    if (inputNewUserDni) inputNewUserDni.value = '';
    if (inputNewUserPass) inputNewUserPass.value = '';
    try { createUserBox.scrollIntoView({ behavior: 'smooth' }); } catch (e) {}
  }
}

if (btnNewUserToggle) btnNewUserToggle.addEventListener('click', abrirFormularioNuevoUsuario);
if (btnOpenCreateUser) btnOpenCreateUser.addEventListener('click', abrirFormularioNuevoUsuario);

if (btnCancelNewUser) {
  btnCancelNewUser.addEventListener('click', () => {
    if (createUserBox) createUserBox.classList.add('hidden');
  });
}

if (inputNewUserName) {
  inputNewUserName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputNewUserDni) inputNewUserDni.focus();
      else if (inputNewUserPass) inputNewUserPass.focus();
    }
  });
}

if (inputNewUserDni) {
  inputNewUserDni.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputNewUserPass) inputNewUserPass.focus();
    }
  });
}

if (inputNewUserPass) {
  inputNewUserPass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      crearNuevoUsuarioFamiliar();
    }
  });
}

if (btnSaveNewUser) btnSaveNewUser.addEventListener('click', crearNuevoUsuarioFamiliar);

async function crearNuevoUsuarioFamiliar() {
  const nombre = inputNewUserName ? inputNewUserName.value.trim() : '';
  const dniLimpio = inputNewUserDni ? inputNewUserDni.value.trim().replace(/\D/g, '') : '';
  const pass = inputNewUserPass ? inputNewUserPass.value.trim() : '';

  if (!nombre) {
    if (inputNewUserName) inputNewUserName.focus();
    return;
  }
  if (dniLimpio && dniLimpio.length < 5) {
    alert('El DNI debe tener al menos 5 números');
    if (inputNewUserDni) inputNewUserDni.focus();
    return;
  }
  if (!pass) {
    if (inputNewUserPass) inputNewUserPass.focus();
    return;
  }

  btnSaveNewUser.disabled = true;
  btnSaveNewUser.textContent = 'Creando...';

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'crear_usuario',
        nombre: nombre,
        dni: dniLimpio,
        password: pass
      })
    });

    const data = await res.json();
    if (res.ok && data.usuario) {
      listaUsuariosPublica = data.usuarios || listaUsuariosPublica;
      usuarioActivo = {
        id: data.usuario.id,
        nombre: data.usuario.nombre,
        dni: data.usuario.dni || dniLimpio || null,
        esAdmin: false,
        avatar: data.usuario.avatar || '👤',
        password: pass
      };
      localStorage.setItem('agenda_usuario_recordado', usuarioActivo.id);
      localStorage.setItem('agenda_dni_configurado', 'true');
      tareas = [];
      avisosTareas = [];
      recordatorios = [];
      movimientos = [];
      supermercado = [];
      heladera = [];
      entrenamiento = null;
      listasPresupuestos = [];
      idListaPresupuestoActiva = null;
      deudores = [];
      yoDebo = [];
      idDeudorActivo = null;
      superCompartidoCon = [];
      yaConfiguroCasa = false;
      borrados = [];
      borradosListas = [];
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
  if (window.PublicKeyCredential) {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return Boolean(available);
      } catch (e) {
        return true;
      }
    }
    return true;
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
          userVerification: 'preferred',
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
      localStorage.setItem('agenda_usuario_recordado', u.id);
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

function obtenerUsuarioParaHuella() {
  const val = (inputLoginDni ? inputLoginDni.value.trim() : '');
  if (val && Array.isArray(listaUsuariosPublica)) {
    const uMatch = listaUsuariosPublica.find(x => 
      (x.dni && String(x.dni).trim() === val) || 
      (x.nombre && x.nombre.toLowerCase().trim() === val.toLowerCase()) ||
      (x.id && x.id.toLowerCase() === val.toLowerCase())
    );
    if (uMatch && tieneHuellaGuardada(uMatch.id)) {
      return uMatch;
    }
  }
  const recId = localStorage.getItem('agenda_usuario_recordado');
  if (recId && tieneHuellaGuardada(recId)) {
    const uRec = (Array.isArray(listaUsuariosPublica) && listaUsuariosPublica.find(x => x.id === recId)) || { id: recId, nombre: (recId === 'alejandro' ? 'Alejandro' : 'Usuario') };
    return uRec;
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('agenda_bio_')) {
        const uId = key.replace('agenda_bio_', '');
        if (tieneHuellaGuardada(uId)) {
          const uFound = (Array.isArray(listaUsuariosPublica) && listaUsuariosPublica.find(x => x.id === uId)) || { id: uId, nombre: (uId === 'alejandro' ? 'Alejandro' : 'Usuario') };
          return uFound;
        }
      }
    }
  } catch (e) {}
  return null;
}

async function actualizarVisibilidadHuellaDni(autoLanzar = false) {
  if (!dniFingerprintBox) return;
  const soporta = await esBiometriaSoportada();
  if (!soporta) {
    dniFingerprintBox.classList.add('hidden');
    return;
  }

  dniFingerprintBox.classList.remove('hidden');
  const uBio = obtenerUsuarioParaHuella();
  const btnSub = document.getElementById('btn-dni-fingerprint-sub');

  if (uBio && tieneHuellaGuardada(uBio.id)) {
    if (btnDniFingerprintTitle) {
      btnDniFingerprintTitle.textContent = `Desbloquear a ${uBio.nombre || 'mi usuario'} con huella`;
    }
    if (btnSub) {
      btnSub.textContent = 'Tocá acá para apoyar tu dedo en el sensor';
    }
    if (inputLoginDni && !inputLoginDni.value) {
      inputLoginDni.value = uBio.dni || uBio.nombre || '';
    }
    if (autoLanzar) {
      setTimeout(() => {
        solicitarDesbloqueoConHuella(uBio);
      }, 350);
    }
  } else {
    const recId = localStorage.getItem('agenda_usuario_recordado') || 'alejandro';
    const uRec = (Array.isArray(listaUsuariosPublica) && listaUsuariosPublica.find(x => x.id === recId)) || { id: recId, nombre: 'Alejandro' };
    if (btnDniFingerprintTitle) {
      btnDniFingerprintTitle.textContent = '👆 Ingresar con huella digital';
    }
    if (btnSub) {
      btnSub.textContent = 'Tocá acá para activar o ingresar con tu huella';
    }
    if (inputLoginDni && !inputLoginDni.value) {
      inputLoginDni.value = uRec.dni || uRec.nombre || 'Alejandro';
    }
  }
}

async function solicitarDesbloqueoConHuella(u) {
  if (!u || !u.id) return false;
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
    if (btnDniFingerprint) {
      btnDniFingerprint.disabled = true;
      btnDniFingerprint.style.opacity = '0.7';
    }
    if (btnDniFingerprintTitle) {
      btnDniFingerprintTitle.textContent = 'Apoyá tu huella en el sensor...';
    }
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
          id: credBytes
        }],
        userVerification: 'preferred',
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
    if (err.name !== 'NotAllowedError') {
      if (dniLoginError) {
        dniLoginError.textContent = 'No se reconoció la huella. Podés ingresar tu contraseña.';
        dniLoginError.classList.remove('hidden');
      } else if (loginErrorMsg) {
        loginErrorMsg.textContent = 'No se reconoció la huella. Podés ingresar tu contraseña.';
        loginErrorMsg.classList.remove('hidden');
      }
    }
    if (inputLoginDniPass) inputLoginDniPass.focus();
    else if (inputLoginPassword) inputLoginPassword.focus();
  } finally {
    if (btnDniFingerprint) {
      btnDniFingerprint.disabled = false;
      btnDniFingerprint.style.opacity = '1';
    }
    if (btnDniFingerprintTitle) {
      btnDniFingerprintTitle.textContent = `Desbloquear a ${u.nombre || 'mi usuario'} con huella`;
    }
    if (btnLoginFingerprint) {
      btnLoginFingerprint.disabled = false;
      btnLoginFingerprint.style.opacity = '1';
    }
    if (btnLoginFingerprintTitle) {
      btnLoginFingerprintTitle.textContent = `Desbloquear a ${u.nombre || 'mi usuario'} con huella`;
    }
  }
  return false;
}

if (btnDniFingerprint) {
  btnDniFingerprint.addEventListener('click', async () => {
    const u = obtenerUsuarioParaHuella();
    if (u && tieneHuellaGuardada(u.id)) {
      await solicitarDesbloqueoConHuella(u);
    } else {
      const pass = inputLoginDniPass ? inputLoginDniPass.value.trim() : '';
      if (pass) {
        await iniciarSesionConDni(true);
      } else {
        if (dniLoginError) {
          dniLoginError.textContent = 'Ingresá tu contraseña privada una vez abajo para activar tu huella en este celular.';
          dniLoginError.classList.remove('hidden');
        }
        if (inputLoginDniPass) inputLoginDniPass.focus();
      }
    }
  });
}

if (inputLoginDni) {
  inputLoginDni.addEventListener('input', () => {
    actualizarVisibilidadHuellaDni(false);
  });
  inputLoginDni.addEventListener('blur', () => {
    actualizarVisibilidadHuellaDni(false);
  });
}

async function actualizarEstadoBotonHuella() {
  if (!usuarioActivo) {
    if (btnToggleBiometrics) btnToggleBiometrics.classList.add('hidden');
    if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
    if (biometricsModalBox) biometricsModalBox.classList.add('hidden');
    return;
  }

  const soporta = await esBiometriaSoportada();
  if (!soporta) {
    if (btnToggleBiometrics) btnToggleBiometrics.classList.add('hidden');
    if (bannerEnrollBiometrics) bannerEnrollBiometrics.classList.add('hidden');
    return;
  }

  const tiene = tieneHuellaGuardada(usuarioActivo.id);
  if (btnToggleBiometrics) {
    btnToggleBiometrics.classList.remove('hidden');
    btnToggleBiometrics.textContent = tiene ? '👆 Huella activada' : '👆 Activar huella';
  }

  if (bannerEnrollBiometrics) {
    if (tiene) {
      bannerEnrollBiometrics.classList.add('hidden');
    } else {
      const descartado = localStorage.getItem('agenda_dismiss_bio_' + usuarioActivo.id);
      if (!descartado) {
        bannerEnrollBiometrics.classList.remove('hidden');
      } else {
        bannerEnrollBiometrics.classList.add('hidden');
      }
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

function guardarCacheDatosUsuarioLocal() {
  if (ES_MODO_EXTERNO || !usuarioActivo || !usuarioActivo.id) return;
  try {
    const cacheObj = {
      savedAt: Date.now(),
      usuario: {
        id: usuarioActivo.id,
        nombre: usuarioActivo.nombre,
        dni: usuarioActivo.dni || null,
        esAdmin: Boolean(usuarioActivo.esAdmin),
        avatar: usuarioActivo.avatar || '👤',
        tiempoBloqueoMin: usuarioActivo.tiempoBloqueoMin || 60,
        tnaConfig: usuarioActivo.tnaConfig || null,
        vinculos: Array.isArray(usuarioActivo.vinculos) ? usuarioActivo.vinculos : []
      },
      tareas: Array.isArray(tareas) ? tareas : [],
      avisosTareas: Array.isArray(avisosTareas) ? avisosTareas : [],
      recordatorios: Array.isArray(recordatorios) ? recordatorios : [],
      movimientos: Array.isArray(movimientos) ? movimientos : [],
      supermercado: Array.isArray(supermercado) ? supermercado : [],
      heladera: Array.isArray(heladera) ? heladera : [],
      entrenamiento: entrenamiento || null,
      listasPresupuestos: Array.isArray(listasPresupuestos) ? listasPresupuestos : [],
      deudores: Array.isArray(deudores) ? deudores : [],
      yoDebo: Array.isArray(yoDebo) ? yoDebo : [],
      superCompartidoCon: Array.isArray(superCompartidoCon) ? superCompartidoCon : [],
      yaConfiguroCasa: Boolean(yaConfiguroCasa),
      tareasCompartidas: Array.isArray(tareasCompartidas) ? tareasCompartidas : [],
      solicitudesVinculoRecibidas: Array.isArray(solicitudesVinculoRecibidas) ? solicitudesVinculoRecibidas : [],
      solicitudesVinculoEnviadas: Array.isArray(solicitudesVinculoEnviadas) ? solicitudesVinculoEnviadas : [],
      borrados: Array.isArray(borrados) ? borrados : [],
      borradosListas: Array.isArray(borradosListas) ? borradosListas : []
    };
    localStorage.setItem(STORAGE_USER_DATA_CACHE_PREFIX + usuarioActivo.id, JSON.stringify(cacheObj));
  } catch (e) {}
}

function restaurarDesdeCacheLocalAlRecargar(u, pass) {
  if (!u || !u.id) return false;
  try {
    const raw = localStorage.getItem(STORAGE_USER_DATA_CACHE_PREFIX + u.id);
    if (!raw) return false;
    const cache = JSON.parse(raw);
    if (!cache || !cache.usuario) return false;

    const esDev = Boolean(u.id === 'alejandro' || (u.dni && String(u.dni).replace(/\D/g, '') === '40218898') || (cache.usuario.dni && String(cache.usuario.dni).replace(/\D/g, '') === '40218898'));
    usuarioActivo = {
      id: u.id,
      nombre: cache.usuario.nombre || u.nombre,
      dni: cache.usuario.dni || u.dni || null,
      esAdmin: esDev,
      avatar: esDev ? '👑' : (cache.usuario.avatar || u.avatar || '👤'),
      password: pass,
      tiempoBloqueoMin: cache.usuario.tiempoBloqueoMin || Number(localStorage.getItem('agenda_bloqueo_' + u.id)) || 60,
      tnaConfig: cache.usuario.tnaConfig || null,
      vinculos: Array.isArray(cache.usuario.vinculos) ? cache.usuario.vinculos : []
    };

    tareas = Array.isArray(cache.tareas) ? cache.tareas : [];
    avisosTareas = Array.isArray(cache.avisosTareas) ? cache.avisosTareas : [];
    recordatorios = Array.isArray(cache.recordatorios) ? cache.recordatorios : [];
    movimientos = Array.isArray(cache.movimientos) ? cache.movimientos : [];
    supermercado = Array.isArray(cache.supermercado) ? cache.supermercado : [];
    heladera = Array.isArray(cache.heladera) ? cache.heladera : [];
    entrenamiento = cache.entrenamiento || null;
    if (typeof normalizarEstructuraEntrenamientoLocal === 'function') {
      normalizarEstructuraEntrenamientoLocal();
    }
    listasPresupuestos = Array.isArray(cache.listasPresupuestos) ? cache.listasPresupuestos : [];
    deudores = Array.isArray(cache.deudores) ? cache.deudores : [];
    yoDebo = Array.isArray(cache.yoDebo) ? cache.yoDebo : [];
    superCompartidoCon = Array.isArray(cache.superCompartidoCon) ? cache.superCompartidoCon : [];
    yaConfiguroCasa = Boolean(cache.yaConfiguroCasa);
    tareasCompartidas = Array.isArray(cache.tareasCompartidas) ? cache.tareasCompartidas : [];
    solicitudesVinculoRecibidas = Array.isArray(cache.solicitudesVinculoRecibidas) ? cache.solicitudesVinculoRecibidas : [];
    solicitudesVinculoEnviadas = Array.isArray(cache.solicitudesVinculoEnviadas) ? cache.solicitudesVinculoEnviadas : [];
    borrados = Array.isArray(cache.borrados) ? cache.borrados : [];
    borradosListas = Array.isArray(cache.borradosListas) ? cache.borradosListas : [];

    entrarAMenuDeUsuarioActivo(true);
    return true;
  } catch (e) {
    return false;
  }
}

function capturarEstadoNavegacionActual() {
  if (!usuarioActivo || !usuarioActivo.id) return null;
  if (!viewUsers.classList.contains('hidden')) return null;

  let route = 'home';
  if (viewTasksAgendaMenu && !viewTasksAgendaMenu.classList.contains('hidden')) {
    route = 'tasks-agenda-menu';
  } else if (viewTasks && !viewTasks.classList.contains('hidden')) {
    route = 'tasks';
  } else if (viewAgenda && !viewAgenda.classList.contains('hidden')) {
    route = 'agenda';
  } else if (viewSharedTasks && !viewSharedTasks.classList.contains('hidden')) {
    route = 'shared-tasks';
  } else if (viewEconomyMenu && !viewEconomyMenu.classList.contains('hidden')) {
    route = 'economy-menu';
  } else if (viewWallet && !viewWallet.classList.contains('hidden')) {
    route = 'wallet';
  } else if (viewDebts && !viewDebts.classList.contains('hidden')) {
    route = 'debts';
  } else if (viewAssistant && !viewAssistant.classList.contains('hidden')) {
    route = 'assistant';
  } else if (viewSettings && !viewSettings.classList.contains('hidden')) {
    route = 'settings';
  } else if (viewExtras && !viewExtras.classList.contains('hidden')) {
    if (typeof subviewSuper !== 'undefined' && subviewSuper && !subviewSuper.classList.contains('hidden')) {
      if (typeof vistaSuperActual !== 'undefined' && vistaSuperActual === 'confeccion') {
        route = 'extras-super-confeccionar';
      } else if (typeof vistaSuperActual !== 'undefined' && vistaSuperActual === 'pendientes') {
        if (typeof listaPendienteAbiertaId !== 'undefined' && listaPendienteAbiertaId) {
          route = 'extras-super-pendientes-activa';
        } else {
          route = 'extras-super-pendientes';
        }
      } else {
        route = 'extras-super';
      }
    } else if (typeof subviewLists !== 'undefined' && subviewLists && !subviewLists.classList.contains('hidden')) {
      route = 'extras-lists';
    } else if (typeof subviewFridge !== 'undefined' && subviewFridge && !subviewFridge.classList.contains('hidden')) {
      route = 'extras-fridge';
    } else if (typeof subviewWorkout !== 'undefined' && subviewWorkout && !subviewWorkout.classList.contains('hidden')) {
      route = 'extras-workout';
    } else if (typeof subviewGemini !== 'undefined' && subviewGemini && !subviewGemini.classList.contains('hidden')) {
      route = 'extras-gemini';
    } else if (typeof dailyCasaSection !== 'undefined' && dailyCasaSection && !dailyCasaSection.classList.contains('hidden')) {
      route = 'extras-casa';
    } else if (typeof dailyUsoSection !== 'undefined' && dailyUsoSection && !dailyUsoSection.classList.contains('hidden')) {
      route = 'extras-uso';
    } else {
      route = 'extras';
    }
  }

  return {
    route: route,
    timestamp: Date.now(),
    filtroActual: typeof filtroActual !== 'undefined' ? filtroActual : 'todas',
    fechaSeleccionadaISO: typeof fechaSeleccionadaISO !== 'undefined' ? fechaSeleccionadaISO : null,
    mesActualVista: typeof mesActualVista !== 'undefined' ? mesActualVista : null,
    anioActualVista: typeof anioActualVista !== 'undefined' ? anioActualVista : null,
    subtabDeudaActiva: typeof subtabDeudaActiva !== 'undefined' ? subtabDeudaActiva : 'me-deben',
    idDeudorActivo: typeof idDeudorActivo !== 'undefined' ? idDeudorActivo : null,
    idListaPresupuestoActiva: typeof idListaPresupuestoActiva !== 'undefined' ? idListaPresupuestoActiva : null,
    vistaSuperActual: typeof vistaSuperActual !== 'undefined' ? vistaSuperActual : 'home',
    listaPendienteAbiertaId: typeof listaPendienteAbiertaId !== 'undefined' ? listaPendienteAbiertaId : null,
    modoModificarListaPendiente: typeof modoModificarListaPendiente !== 'undefined' ? Boolean(modoModificarListaPendiente) : false,
    idRutinaGymActiva: typeof idRutinaGymActiva !== 'undefined' ? idRutinaGymActiva : null,
    pestanaGymActiva: typeof pestanaGymActiva !== 'undefined' ? pestanaGymActiva : 'routines'
  };
}

function guardarEstadoNavegacionActual() {
  if (ES_MODO_EXTERNO || bloqueandoGuardadoNav || !usuarioActivo || !usuarioActivo.id) return;
  try {
    const estado = capturarEstadoNavegacionActual();
    if (!estado) return;
    localStorage.setItem(STORAGE_NAV_STATE_PREFIX + usuarioActivo.id, JSON.stringify(estado));
  } catch (e) {}
}

window.addEventListener('beforeunload', () => {
  guardarEstadoNavegacionActual();
});
window.addEventListener('pagehide', () => {
  guardarEstadoNavegacionActual();
});
document.addEventListener('click', () => {
  if (!usuarioActivo || bloqueandoGuardadoNav) return;
  setTimeout(guardarEstadoNavegacionActual, 40);
});

function restaurarEstadoNavegacionGuardado() {
  if (ES_MODO_EXTERNO || !usuarioActivo || !usuarioActivo.id) return false;
  try {
    const raw = localStorage.getItem(STORAGE_NAV_STATE_PREFIX + usuarioActivo.id);
    if (!raw) return false;
    const st = JSON.parse(raw);
    if (!st || !st.route || st.route === 'home') return false;

    // Restaurar variables de contexto antes de abrir la pantalla
    if (st.filtroActual) {
      filtroActual = st.filtroActual;
      document.querySelectorAll('.filter-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === filtroActual);
      });
    }
    if (st.fechaSeleccionadaISO) fechaSeleccionadaISO = st.fechaSeleccionadaISO;
    if (typeof st.mesActualVista === 'number') mesActualVista = st.mesActualVista;
    if (typeof st.anioActualVista === 'number') anioActualVista = st.anioActualVista;
    if (st.subtabDeudaActiva) subtabDeudaActiva = st.subtabDeudaActiva;
    if (st.idDeudorActivo) idDeudorActivo = st.idDeudorActivo;
    if (st.idListaPresupuestoActiva) idListaPresupuestoActiva = st.idListaPresupuestoActiva;
    if (st.idRutinaGymActiva) idRutinaGymActiva = st.idRutinaGymActiva;
    if (st.pestanaGymActiva && typeof pestanaGymActiva !== 'undefined') pestanaGymActiva = st.pestanaGymActiva;

    switch (st.route) {
      case 'tasks-agenda-menu':
        irAMenuTareasAgenda();
        break;
      case 'tasks':
        irATareas();
        break;
      case 'agenda':
        irAAgenda(st.fechaSeleccionadaISO || HOY_ISO);
        break;
      case 'shared-tasks':
        irATareasCompartidas();
        break;
      case 'economy-menu':
        irAMenuEconomia();
        break;
      case 'wallet':
        irABilletera();
        break;
      case 'debts':
        irADeudas(st.subtabDeudaActiva || 'me-deben');
        if (st.idDeudorActivo && deudores.some(d => d.id === st.idDeudorActivo) && typeof abrirDetalleDeudor === 'function') {
          abrirDetalleDeudor(st.idDeudorActivo);
        }
        break;
      case 'assistant':
        irAAsistente();
        break;
      case 'settings':
        irAConfiguracion();
        break;
      case 'extras':
        irAExtras();
        break;
      case 'extras-casa':
        irAExtras();
        mostrarCasa();
        break;
      case 'extras-uso':
        irAExtras();
        mostrarUsoDiario();
        break;
      case 'extras-super':
        irAExtras();
        abrirHerramientaExtras('super');
        break;
      case 'extras-super-confeccionar':
        irAExtras();
        abrirHerramientaExtras('super');
        if (typeof mostrarPantallaSuper === 'function') mostrarPantallaSuper('confeccion');
        break;
      case 'extras-super-pendientes':
        irAExtras();
        abrirHerramientaExtras('super');
        if (typeof mostrarPantallaSuper === 'function') mostrarPantallaSuper('pendientes');
        break;
      case 'extras-super-pendientes-activa':
        irAExtras();
        abrirHerramientaExtras('super');
        if (typeof mostrarPantallaSuper === 'function') mostrarPantallaSuper('pendientes');
        if (st.listaPendienteAbiertaId) {
          listaPendienteAbiertaId = st.listaPendienteAbiertaId;
          modoModificarListaPendiente = Boolean(st.modoModificarListaPendiente);
          renderizarSupermercado();
        }
        break;
      case 'extras-lists':
      case 'extras-presupuestos':
      case 'extras-presupuestos-detalle':
        irAExtras();
        abrirHerramientaExtras('lists');
        break;
      case 'extras-fridge':
      case 'extras-heladera':
        irAExtras();
        abrirHerramientaExtras('fridge');
        break;
      case 'extras-workout':
      case 'extras-gimnasio':
        irAExtras();
        abrirHerramientaExtras('workout');
        if (typeof cambiarPestanaGym === 'function') {
          cambiarPestanaGym(st.pestanaGymActiva || 'routines');
        }
        break;
      case 'extras-gemini':
        irAExtras();
        abrirHerramientaExtras('gemini');
        break;
      default:
        return false;
    }

    guardarEstadoNavegacionActual();
    return true;
  } catch (e) {
    return false;
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

function entrarAMenuDeUsuarioActivo(restaurarVistaGuardada = false) {
  if (restaurarVistaGuardada) {
    bloqueandoGuardadoNav = true;
  }
  registrarPasoHistorial('home');
  viewUsers.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  viewHome.classList.remove('hidden');

  btnSwitchUser.textContent = '🔒 Bloquear';
  btnSwitchUser.title = 'Bloquear mi agenda (requiere huella o contraseña para volver)';
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
  actualizarEstadoBotonHuella();

  // Avatar selector: solo el admin Alejandro tiene la corona exclusiva 👑 fija
  if (usuarioActivo.esAdmin) {
    if (btnChangeAvatar) btnChangeAvatar.classList.add('hidden');
  } else {
    if (btnChangeAvatar) btnChangeAvatar.classList.remove('hidden');
  }

  userWelcomeSubtitle.textContent = `Hola ${usuarioActivo.nombre}, seleccioná una sección de tu agenda privada`;

  limpiarTareasVencidas();
  actualizarContadoresYAlertas();
  actualizarContadoresTareasAgendaMenu();
  actualizarContadoresEconomiaMenu();
  renderizarTareas();
  renderizarTareasCompartidas();
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

  // Notificación emergente por única vez: pedir DNI si aún no lo tiene registrado
  if (modalRegisterDni) {
    if (!usuarioActivo.dni) {
      modalRegisterDni.classList.remove('hidden');
      if (inputUserDni) {
        inputUserDni.value = '';
        inputUserDni.focus();
      }
      if (registerDniError) registerDniError.classList.add('hidden');
    } else {
      modalRegisterDni.classList.add('hidden');
    }
  }

  if (restaurarVistaGuardada) {
    bloqueandoGuardadoNav = false;
    const seRestauro = restaurarEstadoNavegacionGuardado();
    if (!seRestauro) {
      guardarEstadoNavegacionActual();
    }
  }
}

function volverAPantallaUsuarios(forzarDni) {
  registrarPasoHistorial('users');
  usuarioActivo = null;
  viewHome.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  const hp = document.getElementById('housemates-prompt-box');
  if (hp) hp.classList.add('hidden');
  if (modalRegisterDni) modalRegisterDni.classList.add('hidden');
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

  if (forzarDni) {
    localStorage.removeItem('agenda_usuario_recordado');
    if (inputLoginDni) inputLoginDni.value = '';
    if (inputLoginDniPass) inputLoginDniPass.value = '';
  }

  if (dniLoginBox) {
    dniLoginBox.classList.remove('hidden');
  }

  cargarListaDeUsuarios();
}

btnSwitchUser.addEventListener('click', () => volverAPantallaUsuarios(false));

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

function obtenerPasswordAdminParaAcciones() {
  if (usuarioActivo && usuarioActivo.password) return String(usuarioActivo.password);
  const sesionPass = obtenerPasswordSesionVigente('alejandro') || (usuarioActivo && obtenerPasswordSesionVigente(usuarioActivo.id));
  if (sesionPass) return String(sesionPass);
  try {
    const raw = localStorage.getItem('agenda_bio_alejandro');
    if (raw) {
      const b = JSON.parse(raw);
      if (b && b.pass) return String(b.pass);
    }
  } catch(e) {}
  return '';
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
    fila.style.flexWrap = 'wrap';
    fila.style.gap = '8px';
    fila.innerHTML = `
      <div class="task-info" style="flex:1; min-width:180px;">
        <span class="priority-pill pill-hora">👤 Usuario</span>
        <strong class="task-text">${escaparHTML(u.nombre)}</strong>
        ${u.passwordBlanqueada ? '<span class="priority-pill pill-urgente" style="font-size:0.75rem; margin-left:6px;">🔑 Clave blanqueada</span>' : ''}
        ${!u.tienePreguntaSeguridad ? '<small style="color:#fca5a5; font-size:0.75rem; margin-left:4px;">(Sin pregunta clave)</small>' : '<small style="color:#86efac; font-size:0.75rem; margin-left:4px;">(Con pregunta clave)</small>'}
      </div>
      <div class="task-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="btn-secondary btn-blank-user" style="border-color:#f59e0b; color:#fbbf24; padding:6px 10px; font-size:0.82rem; font-weight:600;">
          🔑 Blanquear contraseña
        </button>
        <button type="button" class="btn-delete btn-del-user" style="padding:6px 10px; font-size:0.82rem;">
          🗑️ Eliminar usuario
        </button>
      </div>
    `;

    const btnBlank = fila.querySelector('.btn-blank-user');
    btnBlank.onclick = async () => {
      if (!confirm(`¿Estás seguro de blanquear la contraseña de "${u.nombre}"?\n\nAl blanquearla, el usuario podrá restablecer su contraseña desde la pantalla de inicio ingresando su número de DNI y su pregunta clave.`)) return;
      let passAdmin = obtenerPasswordAdminParaAcciones();
      if (!passAdmin) {
        passAdmin = prompt('Ingresá tu contraseña de administrador Alejandro para confirmar:') || '';
        if (!passAdmin) return;
      }
      try {
        btnBlank.disabled = true;
        btnBlank.textContent = 'Blanqueando...';
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'blanquear_password',
            usuarioId: 'alejandro',
            adminPassword: passAdmin,
            password: passAdmin,
            targetUsuarioId: u.id,
            eliminarUsuarioId: u.id
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert(`¡Contraseña de ${u.nombre} blanqueada con éxito!\n\nAhora ${u.nombre} podrá ingresar su DNI y responder su pregunta clave para crear una nueva contraseña.`);
          listaUsuariosPublica = data.usuarios || listaUsuariosPublica;
          renderizarListaAdminUsuarios();
          if (typeof renderizarListaAdminEnSettings === 'function' && settingsAdminUsersList) {
            renderizarListaAdminEnSettings(settingsAdminUsersList);
          }
        } else {
          alert(data.error || 'No se pudo blanquear la contraseña');
          btnBlank.disabled = false;
          btnBlank.textContent = '🔑 Blanquear contraseña';
        }
      } catch (e) {
        alert('Error de conexión al blanquear contraseña.');
        btnBlank.disabled = false;
        btnBlank.textContent = '🔑 Blanquear contraseña';
      }
    };

    const btnDel = fila.querySelector('.btn-del-user');
    btnDel.onclick = async () => {
      if (!confirm(`¿Estás SEGURO de eliminar definitivamente al usuario "${u.nombre}" y todos sus datos? Esta acción no se puede deshacer.`)) return;
      let passAdmin = obtenerPasswordAdminParaAcciones();
      if (!passAdmin) {
        passAdmin = prompt('Ingresá tu contraseña de administrador Alejandro para confirmar la eliminación:') || '';
        if (!passAdmin) return;
      }
      try {
        btnDel.disabled = true;
        btnDel.textContent = 'Eliminando...';
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'eliminar_usuario',
            usuarioId: 'alejandro',
            adminPassword: passAdmin,
            password: passAdmin,
            targetUsuarioId: u.id,
            eliminarUsuarioId: u.id
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert(`Usuario "${u.nombre}" eliminado correctamente.`);
          listaUsuariosPublica = data.usuarios || listaUsuariosPublica.filter(x => x.id !== u.id);
          renderizarListaAdminUsuarios();
          if (typeof renderizarListaAdminEnSettings === 'function' && settingsAdminUsersList) {
            renderizarListaAdminEnSettings(settingsAdminUsersList);
          }
          renderizarGrillaUsuarios();
        } else {
          alert(data.error || 'No se pudo eliminar el usuario');
          btnDel.disabled = false;
          btnDel.textContent = '🗑️ Eliminar usuario';
        }
      } catch (e) {
        alert('Error de conexión al eliminar usuario.');
        btnDel.disabled = false;
        btnDel.textContent = '🗑️ Eliminar usuario';
      }
    };

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
// LIMPIEZA AUTOMÁTICA: TAREAS (60 MINUTOS) Y CALENDARIO (1 AÑO)
// ================================================================
function limpiarTareasVencidas() {
  if (!usuarioActivo) return false;
  const ahora = Date.now();
  let huboCambios = false;

  // 1. Tareas individuales realizadas: desaparecen tras 60 minutos
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

  // 2. Calendario / Recordatorios: guardan historial durante 1 año entero (365 días).
  // Solo se eliminan si están marcados como realizados y han pasado más de 365 días.
  // Las pendientes nunca se autoeliminan, y las realizadas del último año se conservan siempre.
  if (Array.isArray(recordatorios)) {
    recordatorios = recordatorios.filter(r => {
      if (r.realizada) {
        let fechaCompletada = r.completedAt || r.updatedAt;
        if (!fechaCompletada && r.fecha) {
          fechaCompletada = new Date(r.fecha + 'T23:59:59').getTime();
        }
        if (fechaCompletada && (ahora - fechaCompletada >= UN_ANIO_MS)) {
          borrados.push(r.id);
          huboCambios = true;
          return false;
        }
      }
      return true;
    });
  }

  // 3. Tareas Compartidas:
  // - Si fueron completadas por todos y NO son programadas, se depuran a los 60 min.
  // - Si SON programadas en la agenda (esProgramada), NO se eliminan a los 60 min:
  //   permanecen en el calendario durante 1 año entero para consulta histórica.
  if (Array.isArray(tareasCompartidas)) {
    tareasCompartidas = tareasCompartidas.filter(tc => {
      const participantesAceptados = Array.isArray(tc.participantes)
        ? tc.participantes.filter(p => p.estadoInvitacion === 'aceptada')
        : [];
      const todosCompletaron = tc.estado === 'completada' ||
        (participantesAceptados.length > 0 && participantesAceptados.every(p => p.realizada));

      if (todosCompletaron) {
        const tiempoFin = tc.completadaEl || tc.actualizadoEl || ahora;
        if (!tc.esProgramada && (ahora - tiempoFin >= UNA_HORA_MS)) {
          huboCambios = true;
          return false;
        }
        if (tc.esProgramada && (ahora - tiempoFin >= UN_ANIO_MS)) {
          huboCambios = true;
          return false;
        }
      }
      return true;
    });
  }

  if (huboCambios) {
    renderizarTareas();
    renderizarTareasCompartidas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
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

    const setBorradosListas = new Set([...(cloud.borradosListas || []), ...borradosListas]);
    borradosListas = Array.from(setBorradosListas);

    tareas = (cloud.tareas || []).filter(x => !IDS_EJEMPLO.has(x.id) && !setBorrados.has(x.id));
    recordatorios = (cloud.recordatorios || []).filter(x => !IDS_EJEMPLO.has(x.id) && !setBorrados.has(x.id));
    movimientos = (cloud.movimientos || []).filter(x => !setBorrados.has(x.id));
    supermercado = Array.isArray(cloud.supermercado) ? cloud.supermercado : supermercado;
    heladera = Array.isArray(cloud.heladera) ? cloud.heladera : heladera;
    avisosTareas = Array.isArray(cloud.avisosTareas) ? cloud.avisosTareas : avisosTareas;
    if (cloud.entrenamiento !== undefined) entrenamiento = cloud.entrenamiento;
    if (Array.isArray(cloud.listasPresupuestos)) {
      listasPresupuestos = cloud.listasPresupuestos.filter(l => !setBorradosListas.has(l.id));
    }
    if (Array.isArray(cloud.deudores)) deudores = cloud.deudores;
    if (Array.isArray(cloud.yoDebo)) yoDebo = cloud.yoDebo;
    if (cloud.avatar && !usuarioActivo.esAdmin) {
      usuarioActivo.avatar = cloud.avatar;
      activeUserBadge.textContent = `${usuarioActivo.avatar} ${usuarioActivo.nombre}`;
    }
    superCompartidoCon = Array.isArray(cloud.superCompartidoCon) ? cloud.superCompartidoCon : superCompartidoCon;
    if (typeof cloud.yaConfiguroCasa === 'boolean') yaConfiguroCasa = cloud.yaConfiguroCasa;
    if (Array.isArray(cloud.tareasCompartidas)) tareasCompartidas = cloud.tareasCompartidas;
    if (cloud.dni) usuarioActivo.dni = cloud.dni;
    if (cloud.tnaConfig) usuarioActivo.tnaConfig = cloud.tnaConfig;
    if (Array.isArray(cloud.vinculos)) usuarioActivo.vinculos = cloud.vinculos;
    if (Array.isArray(cloud.solicitudesVinculoRecibidas)) solicitudesVinculoRecibidas = cloud.solicitudesVinculoRecibidas;
    if (Array.isArray(cloud.solicitudesVinculoEnviadas)) solicitudesVinculoEnviadas = cloud.solicitudesVinculoEnviadas;

    const seLimpiaronVencidas = limpiarTareasVencidas();
    actualizarContadoresYAlertas();
    actualizarContadoresTareasAgendaMenu();
  actualizarContadoresEconomiaMenu();
    renderizarTareas();
    renderizarTareasCompartidas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
    renderizarBilletera();
    renderizarSupermercado();
    renderizarHeladera();
    renderizarEntrenamiento();
    renderizarListasPresupuestos();
    if (subtabDeudaActiva === 'yo-debo') {
      renderizarYoDebo();
    } else {
      renderizarDeudores(true);
    }
    verificarPreguntaUnicaConvivencia();
    verificarNotificacionesPendientes(false);
    guardarCacheDatosUsuarioLocal();

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
  guardarCacheDatosUsuarioLocal();
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
      listasPresupuestos: listasPresupuestos,
      deudores: deudores,
      yoDebo: yoDebo,
      borradosListas: borradosListas,
      tiempoBloqueoMin: usuarioActivo.tiempoBloqueoMin || 60,
      tnaConfig: usuarioActivo.tnaConfig || null,
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
  if (homeTasksCounter) {
    homeTasksCounter.textContent = tareasPendientes === 1 ? '1 pendiente' : `${tareasPendientes} pendientes`;
  }

  const recordatoriosDeHoyPendientes = recordatorios
    .filter(r => r.fecha === HOY_ISO && !r.realizada)
    .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));

  const cantHoy = recordatoriosDeHoyPendientes.length;
  if (homeAgendaCounter) {
    homeAgendaCounter.textContent = cantHoy === 1 ? '1 actividad para hoy' : `${cantHoy} actividades para hoy`;
  }

  if (homeTasksAgendaCounter) {
    const compActivas = tareasCompartidas.filter(t => t.estado === 'activa' || (t.creadorId === usuarioActivo.id && t.estado === 'pendiente_invitacion')).length;
    homeTasksAgendaCounter.textContent = `${tareasPendientes} tareas · ${compActivas} en equipo`;
  }

  actualizarContadoresTareasAgendaMenu();
  actualizarContadoresEconomiaMenu();

  const saldos = calcularSaldosBilletera();
  if (homeWalletCounter) {
    const totalDeudasMeDeben = (deudores || []).reduce((acc, d) => acc + (calcularResumenDeudor(d).saldoPendiente || 0), 0);
    homeWalletCounter.textContent = `Billetera: ${formatearPesos(saldos.efectivo + saldos.virtual)} | Me deben: ${formatearPesos(totalDeudasMeDeben)}`;
  }

  if (homeExtrasCounter) {
    const cantRec = (solicitudesVinculoRecibidas || []).length;
    if (cantRec > 0) {
      homeExtrasCounter.textContent = `🔔 ${cantRec} solicitud(es) de vínculo`;
      homeExtrasCounter.style.borderColor = '#f59e0b';
      homeExtrasCounter.style.color = '#fbbf24';
    } else {
      homeExtrasCounter.textContent = '7 herramientas y ajustes';
      homeExtrasCounter.style.borderColor = '';
      homeExtrasCounter.style.color = '';
    }
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

function actualizarContadoresTareasAgendaMenu() {
  if (!usuarioActivo) return;
  const pendientes = (tareas || []).filter(t => !t.realizada).length;
  const recordatoriosHoy = (recordatorios || []).filter(r => r.fecha === HOY_ISO && !r.realizada).length;
  const compActivas = (tareasCompartidas || []).filter(t => t.estado === 'activa').length;
  const invitacionesPendientes = (tareasCompartidas || []).filter(t => t.socioId === usuarioActivo.id && t.estado === 'pendiente_invitacion').length;

  if (menuTasksCounter) {
    menuTasksCounter.textContent = pendientes === 1 ? '1 tarea pendiente' : `${pendientes} tareas pendientes`;
  }
  if (menuAgendaCounter) {
    menuAgendaCounter.textContent = recordatoriosHoy === 1 ? '1 actividad para hoy' : `${recordatoriosHoy} actividades para hoy`;
  }
  if (menuSharedTasksCounter) {
    if (invitacionesPendientes > 0) {
      menuSharedTasksCounter.textContent = `📨 ${invitacionesPendientes} invitación${invitacionesPendientes > 1 ? 'es' : ''} · ${compActivas} activa${compActivas !== 1 ? 's' : ''}`;
      menuSharedTasksCounter.style.color = '#60a5fa';
    } else {
      menuSharedTasksCounter.textContent = compActivas === 1 ? '1 tarea en equipo' : `${compActivas} tareas en equipo`;
      menuSharedTasksCounter.style.color = '';
    }
  }
  if (homeTasksAgendaCounter) {
    const totalEq = compActivas + invitacionesPendientes;
    homeTasksAgendaCounter.textContent = `${pendientes} tareas · ${totalEq} en equipo`;
  }
}

// Navegación interna del usuario
function irAInicio() {
  if (!usuarioActivo) { volverAPantallaUsuarios(); return; }
  registrarPasoHistorial('home');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  viewHome.classList.remove('hidden');
  btnHome.classList.add('hidden');
  actualizarContadoresYAlertas();
}

function irAMenuTareasAgenda() {
  if (!usuarioActivo) { volverAPantallaUsuarios(); return; }
  registrarPasoHistorial('tasks-agenda-menu');
  viewHome.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  actualizarContadoresTareasAgendaMenu();
  actualizarContadoresEconomiaMenu();
}

function irATareas() {
  registrarPasoHistorial('tasks');
  viewHome.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
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
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  viewAgenda.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarCalendario();
  renderizarRecordatoriosDelDia();
}

function irATareasCompartidas() {
  registrarPasoHistorial('shared-tasks');
  viewHome.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarTareasCompartidas();
}

function irAMenuEconomia() {
  if (!usuarioActivo) { volverAPantallaUsuarios(); return; }
  registrarPasoHistorial('economy-menu');
  viewHome.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  actualizarContadoresEconomiaMenu();
}

function irABilletera() {
  registrarPasoHistorial('wallet');
  viewHome.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  viewWallet.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  renderizarBilletera();
}

function irADeudas(subtabDeseada) {
  registrarPasoHistorial('debts');
  viewHome.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  if (viewDebts) viewDebts.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  cambiarSubtabDeudas(subtabDeseada || subtabDeudaActiva || 'me-deben');
}

function irAAsistente() {
  registrarPasoHistorial('assistant');
  viewHome.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.remove('hidden');
  btnHome.classList.remove('hidden');
  const inp = document.getElementById('input-chat-msg');
  if (inp) inp.focus();
}

function irAExtras() {
  registrarPasoHistorial('extras');
  viewHome.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewSettings) viewSettings.classList.add('hidden');
  viewExtras.classList.remove('hidden');
  btnHome.classList.remove('hidden');

  // Solo mostrar el menú de opciones (sin abrir Supermercado ni ninguna otra herramienta automáticamente)
  mostrarMenuExtras();
}

function irAConfiguracion() {
  registrarPasoHistorial('settings');
  viewHome.classList.add('hidden');
  if (viewEconomyMenu) viewEconomyMenu.classList.add('hidden');
  if (viewTasksAgendaMenu) viewTasksAgendaMenu.classList.add('hidden');
  viewTasks.classList.add('hidden');
  viewAgenda.classList.add('hidden');
  if (viewSharedTasks) viewSharedTasks.classList.add('hidden');
  viewWallet.classList.add('hidden');
  if (viewDebts) viewDebts.classList.add('hidden');
  if (viewAssistant) viewAssistant.classList.add('hidden');
  if (viewExtras) viewExtras.classList.add('hidden');
  if (viewSettings) viewSettings.classList.remove('hidden');
  btnHome.classList.remove('hidden');

  mostrarMenuConfiguracion();
}

// Manejar el botón físico/gesto "Atrás" del celular para que navegue adentro de la app sin salirse
window.addEventListener('popstate', () => {
  if (ES_MODO_EXTERNO) return;
  navegandoPorHistorial = true;
  try {
    // 1. Si hay algún modal o cuadro superior abierto, cerrarlo primero
    if (typeof superPriceQtyModal !== 'undefined' && superPriceQtyModal && !superPriceQtyModal.classList.contains('hidden')) {
      if (typeof cerrarModalPrecioProductoSuper === 'function') cerrarModalPrecioProductoSuper();
      else superPriceQtyModal.classList.add('hidden');
      history.pushState({ vista: 'super-modal-closed' }, '');
      return;
    }
    if (typeof superPayCheckoutModal !== 'undefined' && superPayCheckoutModal && !superPayCheckoutModal.classList.contains('hidden')) {
      superPayCheckoutModal.classList.add('hidden');
      history.pushState({ vista: 'super-pay-closed' }, '');
      return;
    }
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
    if (typeof editShareModalBox !== 'undefined' && editShareModalBox && !editShareModalBox.classList.contains('hidden')) {
      editShareModalBox.classList.add('hidden');
      history.pushState({ vista: 'actual' }, '');
      return;
    }

    // 2. Si está en el detalle de un deudor específico, volver a la lista de deudores
    if (idDeudorActivo && debtorDetailView && !debtorDetailView.classList.contains('hidden')) {
      volverAListaDeudores();
      history.pushState({ vista: 'debts' }, '');
      return;
    }

    // 3. Si está adentro de Elementos Diarios, volver exactamente un paso atrás en la jerarquía
    if (viewExtras && !viewExtras.classList.contains('hidden')) {
      if (subviewSuper && !subviewSuper.classList.contains('hidden')) {
        // Si está adentro de una lista pendiente específica
        if (typeof listaPendienteAbiertaId !== 'undefined' && listaPendienteAbiertaId !== null) {
          if (typeof modoModificarListaPendiente !== 'undefined' && modoModificarListaPendiente) {
            modoModificarListaPendiente = false;
            renderizarSupermercado();
            history.pushState({ vista: 'super-pending-detail' }, '');
            return;
          }
          listaPendienteAbiertaId = null;
          renderizarSupermercado();
          history.pushState({ vista: 'super-pendientes' }, '');
          return;
        }
        // Si está en Confeccionar Lista o en la vista general de Pendientes de Compra, volver al menú de 2 pantallas de Supermercado
        if (typeof vistaSuperActual !== 'undefined' && (vistaSuperActual === 'confeccion' || vistaSuperActual === 'pendientes')) {
          mostrarPantallaSuper('home');
          history.pushState({ vista: 'super-home' }, '');
          return;
        }
        // Si está en el menú principal de Supermercado, volver a Casa
        mostrarCasa();
        history.pushState({ vista: 'casa' }, '');
        return;
      }

      if (subviewFridge && !subviewFridge.classList.contains('hidden')) {
        if (typeof modoSeleccionHeladera !== 'undefined' && (modoSeleccionHeladera || (typeof ingredientesSeleccionadosIds !== 'undefined' && ingredientesSeleccionadosIds.size > 0))) {
          modoSeleccionHeladera = false;
          if (typeof ingredientesSeleccionadosIds !== 'undefined') ingredientesSeleccionadosIds.clear();
          renderizarHeladera();
          history.pushState({ vista: 'fridge' }, '');
          return;
        }
        mostrarCasa();
        history.pushState({ vista: 'casa' }, '');
        return;
      }

      if (subviewWorkout && !subviewWorkout.classList.contains('hidden')) {
        if (typeof workoutShareModalBox !== 'undefined' && workoutShareModalBox && !workoutShareModalBox.classList.contains('hidden')) {
          workoutShareModalBox.classList.add('hidden');
          history.pushState({ vista: 'workout' }, '');
          return;
        }
        const ruts = typeof obtenerListaRutinasGym === 'function' ? obtenerListaRutinasGym() : [];
        if (typeof mostrandoCreadorRutina !== 'undefined' && mostrandoCreadorRutina && ruts.length > 0) {
          mostrandoCreadorRutina = false;
          renderizarEntrenamiento();
          history.pushState({ vista: 'workout' }, '');
          return;
        }
        mostrarUsoDiario();
        history.pushState({ vista: 'uso-diario' }, '');
        return;
      }

      if ((subviewGemini && !subviewGemini.classList.contains('hidden')) ||
          (subviewLists && !subviewLists.classList.contains('hidden'))) {
        mostrarUsoDiario();
        history.pushState({ vista: 'uso-diario' }, '');
        return;
      }

      if ((dailyCasaSection && !dailyCasaSection.classList.contains('hidden')) ||
          (dailyUsoSection && !dailyUsoSection.classList.contains('hidden'))) {
        mostrarMenuExtras();
        history.pushState({ vista: 'extras' }, '');
        return;
      }
    }

    // 4. Si está adentro de un panel de Configuración, volver al menú principal de Configuración
    if (viewSettings && !viewSettings.classList.contains('hidden')) {
      const enSubpanelSettings =
        (settingsMenuList && (settingsMenuList.classList.contains('hidden') || settingsMenuList.style.display === 'none')) ||
        (panelCfgPasswords && !panelCfgPasswords.classList.contains('hidden')) ||
        (panelCfgNotifications && !panelCfgNotifications.classList.contains('hidden')) ||
        (panelCfgBiometrics && !panelCfgBiometrics.classList.contains('hidden')) ||
        (panelCfgTimeout && !panelCfgTimeout.classList.contains('hidden')) ||
        (panelCfgVincular && !panelCfgVincular.classList.contains('hidden')) ||
        (panelCfgProfile && !panelCfgProfile.classList.contains('hidden')) ||
        (panelCfgDev && !panelCfgDev.classList.contains('hidden'));

      if (enSubpanelSettings) {
        mostrarMenuConfiguracion();
        history.pushState({ vista: 'settings' }, '');
        return;
      }
    }

    // 5. Si está adentro de Tareas, Agenda o Tareas Compartidas, volver al menú de Tareas y Agenda
    const enSubModuloTareas =
      (viewTasks && !viewTasks.classList.contains('hidden')) ||
      (viewAgenda && !viewAgenda.classList.contains('hidden')) ||
      (viewSharedTasks && !viewSharedTasks.classList.contains('hidden'));

    if (enSubModuloTareas && usuarioActivo) {
      irAMenuTareasAgenda();
      history.pushState({ vista: 'tasks-agenda-menu' }, '');
      return;
    }

    // 6. Si está adentro de Billetera o Deudas, volver al menú de Economía
    const enSubModuloEconomia =
      (viewWallet && !viewWallet.classList.contains('hidden')) ||
      (viewDebts && !viewDebts.classList.contains('hidden'));

    if (enSubModuloEconomia && usuarioActivo) {
      irAMenuEconomia();
      history.pushState({ vista: 'economy-menu' }, '');
      return;
    }

    // 7. Si está adentro de alguno de los módulos o menús de primer nivel, volver al menú de inicio del usuario
    const enSubModulo =
      (viewTasksAgendaMenu && !viewTasksAgendaMenu.classList.contains('hidden')) ||
      (viewEconomyMenu && !viewEconomyMenu.classList.contains('hidden')) ||
      (viewAssistant && !viewAssistant.classList.contains('hidden')) ||
      (viewExtras && !viewExtras.classList.contains('hidden')) ||
      (viewSettings && !viewSettings.classList.contains('hidden'));

    if (enSubModulo && usuarioActivo) {
      irAInicio();
      history.pushState({ vista: 'home' }, '');
      return;
    }

    // 8. Si está en el menú de inicio del usuario, permanecer en inicio
    if (!viewHome.classList.contains('hidden')) {
      history.pushState({ vista: 'home' }, '');
      return;
    }

    // 9. Si está en la pantalla de usuarios con el recuadro de contraseña o nuevo usuario abierto, cerrarlo
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
if (btnOpenTasksAgendaMenu) btnOpenTasksAgendaMenu.addEventListener('click', irAMenuTareasAgenda);
if (btnBackFromTasksAgendaMenu) btnBackFromTasksAgendaMenu.addEventListener('click', irAInicio);
if (btnSubTasks) btnSubTasks.addEventListener('click', irATareas);
if (btnSubAgenda) btnSubAgenda.addEventListener('click', () => irAAgenda());
if (btnSubSharedTasks) btnSubSharedTasks.addEventListener('click', irATareasCompartidas);
if (btnBackToTasksMenu) btnBackToTasksMenu.addEventListener('click', irAMenuTareasAgenda);
if (btnBackToAgendaMenu) btnBackToAgendaMenu.addEventListener('click', irAMenuTareasAgenda);
if (btnBackSharedToMenu) btnBackSharedToMenu.addEventListener('click', irAMenuTareasAgenda);

// Botones de Economía Personal
if (btnOpenWallet) btnOpenWallet.addEventListener('click', irAMenuEconomia);
if (btnBackFromEconomyMenu) btnBackFromEconomyMenu.addEventListener('click', irAInicio);
if (btnSubWallet) btnSubWallet.addEventListener('click', irABilletera);
if (btnSubDebts) btnSubDebts.addEventListener('click', () => irADeudas('me-deben'));
if (btnBackToEconomyFromWallet) btnBackToEconomyFromWallet.addEventListener('click', irAMenuEconomia);
if (btnBackToEconomyFromDebts) btnBackToEconomyFromDebts.addEventListener('click', irAMenuEconomia);

if (btnOpenTasks) btnOpenTasks.addEventListener('click', irATareas);
if (btnOpenAgenda) btnOpenAgenda.addEventListener('click', () => irAAgenda());
if (btnOpenAssistant) btnOpenAssistant.addEventListener('click', irAAsistente);
if (btnOpenSettings) btnOpenSettings.addEventListener('click', irAConfiguracion);
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

let idTareaEditandoPrioridad = null;

document.addEventListener('click', (e) => {
  if (idTareaEditandoPrioridad !== null && !e.target.closest('[data-priority-wrap]')) {
    idTareaEditandoPrioridad = null;
    renderizarTareas();
  }
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

    const estaEditandoPrio = (idTareaEditandoPrioridad === tarea.id);
    const bloquePrioridadHtml = estaEditandoPrio
      ? `<div data-priority-wrap="1" style="display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap;">
          ${['simple', 'intermedio', 'urgente'].map(p => `
            <span class="priority-pill pill-${p}" data-action="set-priority" data-prio="${p}" style="cursor:pointer; user-select:none; ${tarea.prioridad === p ? 'outline:2px solid #ffffff; transform:scale(1.05);' : 'opacity:0.85;'}">
              ${ETIQUETA_PRIORIDAD[p]}
            </span>
          `).join('')}
        </div>`
      : `<span class="priority-pill pill-${tarea.prioridad}" data-priority-wrap="1" data-action="open-priority" style="cursor:pointer; user-select:none;" title="Tocá para cambiar la prioridad">
          ${ETIQUETA_PRIORIDAD[tarea.prioridad]}
        </span>`;

    fila.innerHTML = `
      <div class="task-info">
        ${bloquePrioridadHtml}
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

    const btnOpenPrio = fila.querySelector('[data-action="open-priority"]');
    if (btnOpenPrio) {
      btnOpenPrio.addEventListener('click', (e) => {
        e.stopPropagation();
        idTareaEditandoPrioridad = tarea.id;
        renderizarTareas();
      });
    }

    fila.querySelectorAll('[data-action="set-priority"]').forEach(pillBtn => {
      pillBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nuevaPrio = pillBtn.dataset.prio;
        idTareaEditandoPrioridad = null;
        if (nuevaPrio && nuevaPrio !== tarea.prioridad) {
          tarea.prioridad = nuevaPrio;
          tarea.updatedAt = Date.now();
          renderizarTareas();
          guardarEnNube();
        } else {
          renderizarTareas();
        }
      });
    });

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

    const grupalesDia = (tareasCompartidas || []).filter(t =>
      t.esProgramada && t.fechaProgramada === fechaISO &&
      (t.creadorId === usuarioActivo?.id || (t.participantes && t.participantes.some(p => p.id === usuarioActivo?.id && p.estadoInvitacion === 'aceptada')) || (t.socioId === usuarioActivo?.id))
    );
    const pendientesGrupales = grupalesDia.filter(t => {
      const miP = t.participantes ? t.participantes.find(p => p.id === usuarioActivo?.id) : null;
      return miP ? !miP.realizada : (t.creadorId === usuarioActivo?.id ? !t.realizadaPorCreador : !t.realizadaPorSocio);
    }).length;

    const totalPendientes = pendientesDia + pendientesGrupales;
    const totalTareas = delDia.length + grupalesDia.length;

    const btnDia = document.createElement('button');
    btnDia.type = 'button';
    btnDia.className = 'cal-day';
    if (fechaISO === HOY_ISO) btnDia.classList.add('is-today');
    if (fechaISO === fechaSeleccionadaISO) btnDia.classList.add('is-selected');

    let badgeHtml = '';
    if (totalPendientes > 0) {
      badgeHtml = `<span class="cal-day-badge">${totalPendientes}</span>`;
    } else if (totalTareas > 0) {
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

  const grupalesDia = (tareasCompartidas || []).filter(t =>
    t.esProgramada && t.fechaProgramada === fechaSeleccionadaISO &&
    (t.creadorId === usuarioActivo?.id || (t.participantes && t.participantes.some(p => p.id === usuarioActivo?.id && p.estadoInvitacion === 'aceptada')) || (t.socioId === usuarioActivo?.id))
  );

  if (listaDia.length === 0 && grupalesDia.length === 0) {
    dayRemindersList.innerHTML = `<div class="empty-state">No hay recordatorios ni tareas guardadas para este día.<br>Escribí uno arriba y apretá <b>Enter</b> para guardarlo.</div>`;
    return;
  }

  // Primero renderizar tareas grupales programadas para este día
  grupalesDia.forEach(gt => {
    const miP = gt.participantes ? gt.participantes.find(p => p.id === usuarioActivo?.id) : null;
    const realizada = miP ? Boolean(miP.realizada) : (gt.creadorId === usuarioActivo?.id ? Boolean(gt.realizadaPorCreador) : Boolean(gt.realizadaPorSocio));
    const fila = document.createElement('div');
    fila.className = `task-item reminder-item ${realizada ? 'realizada' : ''}`;
    fila.style.borderColor = '#0284c7';
    fila.style.background = 'rgba(2, 132, 199, 0.14)';

    const creadorLabel = gt.creadorId === usuarioActivo?.id ? 'Organizada por vos' : `Organizada por ${escaparHTML(gt.creadorNombre)}`;

    fila.innerHTML = `
      <div class="task-info">
        <span class="priority-pill" style="background:#0284c7; color:#e0f2fe; font-size:0.75rem;">👥 Tarea grupal</span>
        <span class="task-text">${escaparHTML(gt.texto)} <small style="color:#7dd3fc; font-weight:normal;">(${creadorLabel})</small></span>
      </div>
      <div class="task-actions">
        <button class="btn-done ${realizada ? 'is-done' : ''}" type="button">
          ${realizada ? '↩ Pendiente' : '✓ Realizada'}
        </button>
      </div>
    `;

    const btnDone = fila.querySelector('.btn-done');
    btnDone.onclick = () => {
      marcarTareaCompartida(gt.id, !realizada);
      setTimeout(() => {
        renderizarRecordatoriosDelDia();
        renderizarCalendario();
      }, 300);
    };

    dayRemindersList.appendChild(fila);
  });

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
      if (rec.realizada) {
        rec.completedAt = rec.completedAt || Date.now();
      } else {
        rec.completedAt = null;
      }
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

// ==========================================
// RENDIMIENTO DIARIO ESTIMADO (TNA BILLETERAS VIRTUALES)
// ==========================================
const TNA_BILLETERAS_INFO = {
  mercadopago: {
    nombre: 'Mercado Pago',
    tnaDefault: 31.5,
    icono: '💙',
    tipo: 'Fondo Money Market'
  },
  uala: {
    nombre: 'Ualá',
    tnaDefault: 19.0,
    icono: '💳',
    tipo: 'Cuenta Remunerada'
  }
};

function obtenerTNAConfigUsuario() {
  if (!usuarioActivo) return { habilitada: false, billetera: 'mercadopago', tna: 31.5, ultimaFecha: null };
  if (!usuarioActivo.tnaConfig) {
    usuarioActivo.tnaConfig = {
      habilitada: false,
      billetera: 'mercadopago',
      tna: 31.5,
      ultimaFecha: null
    };
  }
  return usuarioActivo.tnaConfig;
}

function renderizarTNAConfig() {
  const cfg = obtenerTNAConfigUsuario();
  const info = TNA_BILLETERAS_INFO[cfg.billetera] || TNA_BILLETERAS_INFO.mercadopago;

  const chk = document.getElementById('chk-tna-active');
  const pill = document.getElementById('wallet-tna-status-pill');
  const subtitle = document.getElementById('wallet-tna-subtitle');
  const inputRate = document.getElementById('input-wallet-tna-rate');

  if (chk) chk.checked = Boolean(cfg.habilitada);

  const tnaNum = cfg.tna !== undefined ? cfg.tna : info.tnaDefault;

  if (pill) {
    if (cfg.habilitada) {
      pill.textContent = `Activo (${tnaNum}% TNA)`;
      pill.style.background = 'rgba(34, 197, 94, 0.2)';
      pill.style.color = '#4ade80';
    } else {
      pill.textContent = 'Inactivo';
      pill.style.background = 'rgba(148, 163, 184, 0.15)';
      pill.style.color = '#94a3b8';
    }
  }

  if (subtitle) {
    if (cfg.habilitada) {
      subtitle.textContent = `Rindiendo con ${info.nombre} al ${tnaNum}% TNA diario · (Tocá para modificar)`;
    } else {
      subtitle.textContent = `(Aclaración y modificación solo si toco en ella)`;
    }
  }

  if (inputRate && document.activeElement !== inputRate) {
    inputRate.value = tnaNum;
  }

  const chips = document.querySelectorAll('#wallet-tna-chips-grid .tna-chip');
  chips.forEach(c => {
    c.classList.toggle('active', c.dataset.wallet === cfg.billetera);
  });
}

let procesandoRendimientos = false;
function procesarRendimientosAutomaticos() {
  if (ES_MODO_EXTERNO || !usuarioActivo || procesandoRendimientos) return;
  const cfg = obtenerTNAConfigUsuario();
  if (!cfg.habilitada) return;

  const tna = parseFloat(cfg.tna);
  if (!tna || tna <= 0) return;

  const saldos = calcularSaldosBilletera();
  const saldoVirtual = saldos.virtual;
  if (saldoVirtual <= 0) return;

  const hoy = HOY_ISO;
  if (!cfg.ultimaFecha) {
    cfg.ultimaFecha = hoy;
    guardarEnNube();
    return;
  }

  if (cfg.ultimaFecha === hoy) {
    return;
  }

  procesandoRendimientos = true;
  try {
    const fechaUltima = new Date(cfg.ultimaFecha + 'T12:00:00');
    const fechaHoy = new Date(hoy + 'T12:00:00');
    const diffMs = fechaHoy.getTime() - fechaUltima.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias > 0) {
      const diasAProcesar = Math.min(diffDias, 30);
      const info = TNA_BILLETERAS_INFO[cfg.billetera] || TNA_BILLETERAS_INFO.mercadopago;
      const tasaDiaria = tna / (100 * 365);
      let huboAcreditaciones = false;

      for (let i = 1; i <= diasAProcesar; i++) {
        const d = new Date(fechaUltima);
        d.setDate(d.getDate() + i);
        const diaStr = obtenerFechaISO(d);

        const yaAcreditado = movimientos.some(m =>
          m.fecha === diaStr &&
          m.tipo === 'ingreso' &&
          m.medio === 'virtual' &&
          String(m.detalle).includes('Rendimiento estimado app')
        );

        if (!yaAcreditado) {
          const montoRend = Math.round((saldoVirtual * tasaDiaria) * 100) / 100;
          if (montoRend >= 0.01) {
            movimientos.push({
              id: 'mov-rend-' + diaStr + '-' + Math.random().toString(36).slice(2, 6),
              tipo: 'ingreso',
              medio: 'virtual',
              monto: montoRend,
              detalle: `📈 Rendimiento estimado app (${info.nombre})`,
              fecha: diaStr,
              updatedAt: Date.now()
            });
            huboAcreditaciones = true;
          }
        }
      }

      cfg.ultimaFecha = hoy;

      if (huboAcreditaciones) {
        fechaFiltroBilletera = hoy;
        guardarEnNube();
      }
    }
  } catch (err) {
    console.warn('Error al procesar rendimientos:', err);
  } finally {
    procesandoRendimientos = false;
  }
}

function inicializarEventosTNA() {
  const headerToggle = document.getElementById('wallet-tna-header-toggle');
  const settingsBox = document.getElementById('wallet-tna-settings-box');
  const chkActive = document.getElementById('chk-tna-active');
  const chips = document.querySelectorAll('#wallet-tna-chips-grid .tna-chip');
  const inputRate = document.getElementById('input-wallet-tna-rate');
  const btnSave = document.getElementById('btn-save-tna-config');

  if (headerToggle && settingsBox) {
    headerToggle.addEventListener('click', (e) => {
      if (e.target.closest('.switch-toggle')) return;
      settingsBox.classList.toggle('hidden');
    });
  }

  if (chkActive) {
    chkActive.addEventListener('change', () => {
      const cfg = obtenerTNAConfigUsuario();
      cfg.habilitada = chkActive.checked;
      if (cfg.habilitada && !cfg.ultimaFecha) {
        cfg.ultimaFecha = HOY_ISO;
      }
      renderizarTNAConfig();
      if (cfg.habilitada) {
        procesarRendimientosAutomaticos();
      }
      guardarEnNube();
    });
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const walletKey = chip.dataset.wallet;
      const defaultTna = parseFloat(chip.dataset.defaultTna) || 37.0;
      const cfg = obtenerTNAConfigUsuario();
      cfg.billetera = walletKey;
      cfg.tna = defaultTna;
      if (inputRate) inputRate.value = defaultTna;
      renderizarTNAConfig();
    });
  });

  if (inputRate) {
    inputRate.addEventListener('input', () => {
      const val = parseFloat(inputRate.value);
      if (!isNaN(val) && val >= 0) {
        const cfg = obtenerTNAConfigUsuario();
        cfg.tna = val;
        renderizarTNAConfig();
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const cfg = obtenerTNAConfigUsuario();
      if (inputRate) {
        const val = parseFloat(inputRate.value);
        if (!isNaN(val) && val >= 0) {
          cfg.tna = val;
        }
      }
      renderizarTNAConfig();
      if (settingsBox) settingsBox.classList.add('hidden');
      if (cfg.habilitada) {
        procesarRendimientosAutomaticos();
      }
      renderizarBilletera();
      guardarEnNube();
    });
  }
}
inicializarEventosTNA();

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
  renderizarTNAConfig();
  procesarRendimientosAutomaticos();
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
// ==========================================
// MÃ“DULO 4: ELEMENTOS DIARIOS (CASA VS USO DIARIO)
// ==========================================
// MÓDULO 4: ELEMENTOS DIARIOS (CASA VS USO DIARIO)
// ==========================================
const dailyMenuSection = document.getElementById('daily-menu-section');
const dailyCasaSection = document.getElementById('daily-casa-section');
const dailyUsoSection = document.getElementById('daily-uso-section');
const btnBackCasaToDaily = document.getElementById('btn-back-casa-to-daily');
const btnBackUsoToDaily = document.getElementById('btn-back-uso-to-daily');
const btnBackSuperToCasa = document.getElementById('btn-back-super-to-casa');
const btnBackFridgeToCasa = document.getElementById('btn-back-fridge-to-casa');
const btnBackGeminiToUso = document.getElementById('btn-back-gemini-to-uso');
const btnBackWorkoutToUso = document.getElementById('btn-back-workout-to-uso');
const btnBackListsToUso = document.getElementById('btn-back-lists-to-uso');

const cardDailyCasa = document.getElementById('card-daily-casa');
const cardDailyUso = document.getElementById('card-daily-uso');
const cardExtraSuper = document.getElementById('card-extra-super');
const cardExtraFridge = document.getElementById('card-extra-fridge');
const cardExtraGemini = document.getElementById('card-extra-gemini');
const cardExtraWorkout = document.getElementById('card-extra-workout');
const cardExtraLists = document.getElementById('card-extra-lists');

const subviewSuper = document.getElementById('subview-super');
const subviewFridge = document.getElementById('subview-fridge');
const subviewGemini = document.getElementById('subview-gemini');
const subviewWorkout = document.getElementById('subview-workout');
const subviewLists = document.getElementById('subview-lists');

function ocultarTodasLasSubvistasDiarias() {
  if (subviewSuper) subviewSuper.classList.add('hidden');
  if (subviewFridge) subviewFridge.classList.add('hidden');
  if (subviewGemini) subviewGemini.classList.add('hidden');
  if (subviewWorkout) subviewWorkout.classList.add('hidden');
  if (subviewLists) subviewLists.classList.add('hidden');
}

function mostrarMenuExtras() {
  if (dailyMenuSection) dailyMenuSection.classList.remove('hidden');
  if (dailyCasaSection) dailyCasaSection.classList.add('hidden');
  if (dailyUsoSection) dailyUsoSection.classList.add('hidden');
  ocultarTodasLasSubvistasDiarias();

  // Actualizar contadores del nivel 1
  const dailyCasaCounter = document.getElementById('daily-casa-counter');
  if (dailyCasaCounter) {
    const infoSup = typeof obtenerContadoresSupermercado === 'function'
      ? obtenerContadoresSupermercado()
      : { listasPendientes: 0, totalProductos: Array.isArray(supermercado) ? supermercado.length : 0 };
    const cantF = Array.isArray(heladera) ? heladera.length : 0;
    dailyCasaCounter.textContent = `${infoSup.listasPendientes} lista(s) · ${cantF} en heladera`;
  }
  const dailyUsoCounter = document.getElementById('daily-uso-counter');
  if (dailyUsoCounter) {
    const cantL = Array.isArray(listasPresupuestos) ? listasPresupuestos.length : 0;
    dailyUsoCounter.textContent = `${cantL} listas · Asistente IA · Rutinas`;
  }
}

function mostrarCasa() {
  registrarPasoHistorial('casa');
  if (dailyMenuSection) dailyMenuSection.classList.add('hidden');
  if (dailyCasaSection) dailyCasaSection.classList.remove('hidden');
  if (dailyUsoSection) dailyUsoSection.classList.add('hidden');
  ocultarTodasLasSubvistasDiarias();

  const extraSuperCounter = document.getElementById('extra-super-counter');
  if (extraSuperCounter) {
    const infoSup = typeof obtenerContadoresSupermercado === 'function'
      ? obtenerContadoresSupermercado()
      : { listasPendientes: 0, totalProductos: Array.isArray(supermercado) ? supermercado.length : 0 };
    extraSuperCounter.textContent = infoSup.listasPendientes === 1
      ? '1 lista pendiente de compra'
      : `${infoSup.listasPendientes} listas pendientes`;
  }
  const extraFridgeCounter = document.getElementById('extra-fridge-counter');
  if (extraFridgeCounter) {
    const cantF = Array.isArray(heladera) ? heladera.length : 0;
    extraFridgeCounter.textContent = cantF === 1 ? '1 ingrediente' : `${cantF} ingredientes`;
  }
}

function mostrarUsoDiario() {
  registrarPasoHistorial('uso-diario');
  if (dailyMenuSection) dailyMenuSection.classList.add('hidden');
  if (dailyCasaSection) dailyCasaSection.classList.add('hidden');
  if (dailyUsoSection) dailyUsoSection.classList.remove('hidden');
  ocultarTodasLasSubvistasDiarias();

  const extraWorkoutCounter = document.getElementById('extra-workout-counter');
  if (extraWorkoutCounter) {
    const ruts = typeof obtenerListaRutinasGym === 'function' ? obtenerListaRutinasGym() : [];
    extraWorkoutCounter.textContent = ruts.length === 0
      ? 'Crear rutina'
      : (ruts.length === 1 ? '1 rutina activa' : `${ruts.length} rutinas activas`);
  }

  const extraListsCounter = document.getElementById('extra-lists-counter');
  if (extraListsCounter) {
    const cantL = Array.isArray(listasPresupuestos) ? listasPresupuestos.length : 0;
    extraListsCounter.textContent = cantL === 1 ? '1 lista creada' : `${cantL} listas creadas`;
  }
}

function abrirHerramientaExtras(cual) {
  registrarPasoHistorial('extra-' + cual);
  if (dailyMenuSection) dailyMenuSection.classList.add('hidden');
  if (dailyCasaSection) dailyCasaSection.classList.add('hidden');
  if (dailyUsoSection) dailyUsoSection.classList.add('hidden');
  ocultarTodasLasSubvistasDiarias();

  if (cual === 'super') {
    if (subviewSuper) subviewSuper.classList.remove('hidden');
    if (typeof mostrarPantallaSuper === 'function') {
      mostrarPantallaSuper('home');
    } else {
      renderizarSupermercado();
    }
  } else if (cual === 'fridge') {
    if (subviewFridge) subviewFridge.classList.remove('hidden');
    renderizarHeladera();
    const fInput = document.getElementById('input-fridge-name');
    if (fInput) fInput.focus();
  } else if (cual === 'gemini') {
    if (subviewGemini) subviewGemini.classList.remove('hidden');
    if (inputChatMsg) inputChatMsg.focus();
  } else if (cual === 'workout') {
    if (subviewWorkout) subviewWorkout.classList.remove('hidden');
    renderizarEntrenamiento();
  } else if (cual === 'lists') {
    if (subviewLists) subviewLists.classList.remove('hidden');
    renderizarListasPresupuestos();
    const mInput = document.getElementById('input-item-material');
    if (mInput) mInput.focus();
  }
}

if (cardDailyCasa) cardDailyCasa.addEventListener('click', mostrarCasa);
if (cardDailyUso) cardDailyUso.addEventListener('click', mostrarUsoDiario);
if (btnBackCasaToDaily) btnBackCasaToDaily.addEventListener('click', mostrarMenuExtras);
if (btnBackUsoToDaily) btnBackUsoToDaily.addEventListener('click', mostrarMenuExtras);

if (cardExtraSuper) cardExtraSuper.addEventListener('click', () => abrirHerramientaExtras('super'));
if (cardExtraFridge) cardExtraFridge.addEventListener('click', () => abrirHerramientaExtras('fridge'));
if (cardExtraGemini) cardExtraGemini.addEventListener('click', () => abrirHerramientaExtras('gemini'));
if (cardExtraWorkout) cardExtraWorkout.addEventListener('click', () => abrirHerramientaExtras('workout'));
if (cardExtraLists) cardExtraLists.addEventListener('click', () => abrirHerramientaExtras('lists'));

if (btnBackSuperToCasa) btnBackSuperToCasa.addEventListener('click', mostrarCasa);
if (btnBackFridgeToCasa) btnBackFridgeToCasa.addEventListener('click', mostrarCasa);
if (btnBackGeminiToUso) btnBackGeminiToUso.addEventListener('click', mostrarUsoDiario);
if (btnBackWorkoutToUso) btnBackWorkoutToUso.addEventListener('click', mostrarUsoDiario);
if (btnBackListsToUso) btnBackListsToUso.addEventListener('click', mostrarUsoDiario);

// ==========================================
// MÓDULO 5: CONFIGURACIÓN Y SEGURIDAD
// ==========================================
const settingsMenuList = document.getElementById('settings-menu-list');
const btnBackSettingsToHome = document.getElementById('btn-back-settings-to-home');

const cardCfgPasswords = document.getElementById('card-cfg-passwords');
const cardCfgNotifications = document.getElementById('card-cfg-notifications');
const cardCfgBiometrics = document.getElementById('card-cfg-biometrics');
const cardCfgTimeout = document.getElementById('card-cfg-timeout');
const cardCfgVincular = document.getElementById('card-cfg-vincular');
const cardCfgProfile = document.getElementById('card-cfg-profile');
const cardCfgDev = document.getElementById('card-cfg-dev');

const panelCfgPasswords = document.getElementById('panel-cfg-passwords');
const panelCfgNotifications = document.getElementById('panel-cfg-notifications');
const panelCfgBiometrics = document.getElementById('panel-cfg-biometrics');
const panelCfgTimeout = document.getElementById('panel-cfg-timeout');
const panelCfgVincular = document.getElementById('panel-cfg-vincular');
const panelCfgProfile = document.getElementById('panel-cfg-profile');
const panelCfgDev = document.getElementById('panel-cfg-dev');

// Elementos de Vincular (dentro de Configuración)
const inputVincularDni = document.getElementById('input-vincular-dni');
const btnSubmitVincular = document.getElementById('btn-submit-vincular');
const vincularErrorMsg = document.getElementById('vincular-error-msg');
const vincularSuccessMsg = document.getElementById('vincular-success-msg');
const boxVincularRecibidas = document.getElementById('box-vincular-recibidas');
const vincularListaRecibidas = document.getElementById('vincular-lista-recibidas');
const vincularListaActivos = document.getElementById('vincular-lista-activos');
const boxVincularEnviadas = document.getElementById('box-vincular-enviadas');
const vincularListaEnviadas = document.getElementById('vincular-lista-enviadas');

// Elementos de Edición de Perfil (DNI, Nombre, Avatar)
const inputProfileDni = document.getElementById('input-profile-dni');
const inputProfileName = document.getElementById('input-profile-name');
const profileCurrentAvatar = document.getElementById('profile-current-avatar');
const profilePreviewName = document.getElementById('profile-preview-name');
const profilePreviewDni = document.getElementById('profile-preview-dni');
const profileAvatarGrid = document.getElementById('profile-avatar-grid');
const profileErrorMsg = document.getElementById('profile-error-msg');
const profileSuccessMsg = document.getElementById('profile-success-msg');
const btnSaveProfile = document.getElementById('btn-save-profile');
let avatarSeleccionadoPerfil = '';

function ocultarTodosLosPanelesConfiguracion() {
  if (panelCfgPasswords) panelCfgPasswords.classList.add('hidden');
  if (panelCfgNotifications) panelCfgNotifications.classList.add('hidden');
  if (panelCfgBiometrics) panelCfgBiometrics.classList.add('hidden');
  if (panelCfgTimeout) panelCfgTimeout.classList.add('hidden');
  if (panelCfgVincular) panelCfgVincular.classList.add('hidden');
  if (panelCfgProfile) panelCfgProfile.classList.add('hidden');
  if (panelCfgDev) panelCfgDev.classList.add('hidden');
}

function mostrarMenuConfiguracion() {
  if (settingsMenuList) settingsMenuList.classList.remove('hidden');
  ocultarTodosLosPanelesConfiguracion();

  // Control estricto del Panel Desarrollador: solo Alejandro (DNI 40218898)
  const esAlejandroDev = Boolean(
    usuarioActivo &&
    (String(usuarioActivo.dni || '').replace(/\D/g, '') === '40218898' || usuarioActivo.id === 'alejandro')
  );
  if (cardCfgDev) {
    cardCfgDev.classList.toggle('hidden', !esAlejandroDev);
    cardCfgDev.style.display = esAlejandroDev ? 'flex' : 'none';
  }

  // Actualizar badges
  const cfgBadgeBio = document.getElementById('cfg-badge-bio');
  if (cfgBadgeBio && usuarioActivo) {
    const tieneBio = tieneHuellaGuardada(usuarioActivo.id);
    cfgBadgeBio.textContent = tieneBio ? '👆 Huella activa' : 'Sin huella';
  }
  const cfgBadgeTimeout = document.getElementById('cfg-badge-timeout');
  if (cfgBadgeTimeout && usuarioActivo) {
    const t = Number(usuarioActivo.tiempoBloqueoMin) || Number(localStorage.getItem('agenda_bloqueo_' + usuarioActivo.id)) || 15;
    cfgBadgeTimeout.textContent = `${t} min`;
  }
  const cfgBadgeVincular = document.getElementById('cfg-badge-vincular');
  if (cfgBadgeVincular && usuarioActivo) {
    const cantRec = (solicitudesVinculoRecibidas || []).length;
    const cantVinc = (usuarioActivo.vinculos || []).length;
    if (cantRec > 0) {
      cfgBadgeVincular.textContent = `🔔 ${cantRec} nueva(s)`;
      cfgBadgeVincular.style.borderColor = '#f59e0b';
      cfgBadgeVincular.style.color = '#fbbf24';
    } else {
      cfgBadgeVincular.textContent = cantVinc === 1 ? '1 contacto' : `${cantVinc} contactos`;
      cfgBadgeVincular.style.borderColor = '#3b82f6';
      cfgBadgeVincular.style.color = '#93c5fd';
    }
  }
}

function guardarUsuarioRecordado(u) {
  if (!u || !u.id) return;
  localStorage.setItem('agenda_usuario_recordado', u.id);
  try {
    localStorage.setItem('agenda_usuarios_cache', JSON.stringify(listaUsuariosPublica));
  } catch (e) {}
}

function actualizarBadgePreguntaSeguridad() {
  renderizarConfiguracion();
}

function actualizarEstadoPushUI() {
  renderizarConfiguracion();
}

function abrirPanelConfiguracion(cual) {
  registrarPasoHistorial('cfg-' + cual);
  if (settingsMenuList) settingsMenuList.classList.add('hidden');
  ocultarTodosLosPanelesConfiguracion();

  // Renderizar la configuración activa
  renderizarConfiguracion();

  if (cual === 'passwords') {
    if (panelCfgPasswords) panelCfgPasswords.classList.remove('hidden');
    actualizarBadgePreguntaSeguridad();
  } else if (cual === 'notifications') {
    if (panelCfgNotifications) panelCfgNotifications.classList.remove('hidden');
    actualizarEstadoPushUI();
    const urlInput = document.getElementById('input-settings-share-url');
    if (urlInput && usuarioActivo) {
      urlInput.value = `${window.location.origin}${window.location.pathname}?para=${encodeURIComponent(usuarioActivo.id)}&modo=externo`;
    }
  } else if (cual === 'biometrics') {
    if (panelCfgBiometrics) panelCfgBiometrics.classList.remove('hidden');
  } else if (cual === 'timeout') {
    if (panelCfgTimeout) panelCfgTimeout.classList.remove('hidden');
  } else if (cual === 'vincular') {
    if (panelCfgVincular) panelCfgVincular.classList.remove('hidden');
    const sv = document.getElementById('subview-vincular');
    if (sv) sv.classList.remove('hidden');
    renderizarVincular();
    if (inputVincularDni) inputVincularDni.focus();
  } else if (cual === 'profile') {
    if (panelCfgProfile) panelCfgProfile.classList.remove('hidden');
    renderizarEditorPerfil();
  } else if (cual === 'dev') {
    const esAlejandroDev = Boolean(
      usuarioActivo &&
      (String(usuarioActivo.dni || '').replace(/\D/g, '') === '40218898' || usuarioActivo.id === 'alejandro')
    );
    if (esAlejandroDev) {
      if (panelCfgDev) panelCfgDev.classList.remove('hidden');
      if (boxSettingsDev) {
        boxSettingsDev.classList.remove('hidden');
        boxSettingsDev.style.display = 'block';
      }
      if (inputDevTnaMp && TNA_BILLETERAS_INFO && TNA_BILLETERAS_INFO.mercadopago) {
        inputDevTnaMp.value = TNA_BILLETERAS_INFO.mercadopago.tnaDefault;
      }
      if (inputDevTnaUala && TNA_BILLETERAS_INFO && TNA_BILLETERAS_INFO.uala) {
        inputDevTnaUala.value = TNA_BILLETERAS_INFO.uala.tnaDefault;
      }
      const adminUsersBox = document.getElementById('settings-admin-users-list');
      if (adminUsersBox && typeof renderizarListaAdminEnSettings === 'function') {
        renderizarListaAdminEnSettings(adminUsersBox);
      }
    } else {
      mostrarMenuConfiguracion();
    }
  }
}

// Botones volver de los paneles al menú de Configuración
document.querySelectorAll('.btn-back-to-settings-menu').forEach(b => {
  b.addEventListener('click', mostrarMenuConfiguracion);
});

if (cardCfgPasswords) cardCfgPasswords.addEventListener('click', () => abrirPanelConfiguracion('passwords'));
if (cardCfgNotifications) cardCfgNotifications.addEventListener('click', () => abrirPanelConfiguracion('notifications'));
if (cardCfgBiometrics) cardCfgBiometrics.addEventListener('click', () => abrirPanelConfiguracion('biometrics'));
if (cardCfgTimeout) cardCfgTimeout.addEventListener('click', () => abrirPanelConfiguracion('timeout'));
if (cardCfgVincular) cardCfgVincular.addEventListener('click', () => abrirPanelConfiguracion('vincular'));
if (cardCfgProfile) cardCfgProfile.addEventListener('click', () => abrirPanelConfiguracion('profile'));
if (cardCfgDev) cardCfgDev.addEventListener('click', () => abrirPanelConfiguracion('dev'));

if (btnBackSettingsToHome) btnBackSettingsToHome.addEventListener('click', irAInicio);
const btnLogoutSettings = document.getElementById('btn-logout-settings');
if (btnLogoutSettings) {
  btnLogoutSettings.addEventListener('click', () => {
    if (confirm('¿Cerrar tu sesión por completo en este dispositivo? Para volver a ingresar tendrás que poner tu DNI y tu contraseña.')) {
      volverAPantallaUsuarios(true);
    }
  });
}

function renderizarEditorPerfil() {
  if (!usuarioActivo) return;
  avatarSeleccionadoPerfil = usuarioActivo.avatar || (usuarioActivo.esAdmin ? '👑' : '👤');
  if (inputProfileDni) inputProfileDni.value = usuarioActivo.dni || '';
  if (inputProfileName) inputProfileName.value = usuarioActivo.nombre || '';
  if (profilePreviewName) profilePreviewName.textContent = usuarioActivo.nombre || 'Usuario';
  if (profilePreviewDni) profilePreviewDni.textContent = 'DNI: ' + (usuarioActivo.dni || 'Sin DNI');
  if (profileCurrentAvatar) profileCurrentAvatar.textContent = avatarSeleccionadoPerfil;
  if (profileErrorMsg) profileErrorMsg.classList.add('hidden');
  if (profileSuccessMsg) profileSuccessMsg.classList.add('hidden');

  if (profileAvatarGrid) {
    profileAvatarGrid.innerHTML = '';
    AVATARES_USUARIOS.forEach(av => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = av;
      btn.style.fontSize = '24px';
      btn.style.padding = '8px';
      btn.style.borderRadius = '8px';
      btn.style.border = av === avatarSeleccionadoPerfil ? '2px solid #a855f7' : '1px solid #334155';
      btn.style.background = av === avatarSeleccionadoPerfil ? 'rgba(168, 85, 247, 0.3)' : 'rgba(30, 41, 59, 0.6)';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => {
        avatarSeleccionadoPerfil = av;
        if (profileCurrentAvatar) profileCurrentAvatar.textContent = av;
        Array.from(profileAvatarGrid.children).forEach(c => {
          c.style.border = '1px solid #334155';
          c.style.background = 'rgba(30, 41, 59, 0.6)';
        });
        btn.style.border = '2px solid #a855f7';
        btn.style.background = 'rgba(168, 85, 247, 0.3)';
      });
      profileAvatarGrid.appendChild(btn);
    });
  }
}

if (btnSaveProfile) {
  btnSaveProfile.addEventListener('click', async () => {
    if (!usuarioActivo) return;
    const nuevoNombre = (inputProfileName ? inputProfileName.value : '').trim();
    const nuevoDni = (inputProfileDni ? inputProfileDni.value : '').replace(/\D/g, '').trim();

    if (!nuevoNombre || nuevoNombre.length < 2) {
      if (profileErrorMsg) {
        profileErrorMsg.textContent = 'El nombre de usuario debe tener al menos 2 letras';
        profileErrorMsg.classList.remove('hidden');
      }
      return;
    }
    if (!nuevoDni || nuevoDni.length < 5) {
      if (profileErrorMsg) {
        profileErrorMsg.textContent = 'El DNI debe tener al menos 5 números';
        profileErrorMsg.classList.remove('hidden');
      }
      return;
    }

    if (profileErrorMsg) profileErrorMsg.classList.add('hidden');
    if (profileSuccessMsg) profileSuccessMsg.classList.add('hidden');
    btnSaveProfile.disabled = true;
    btnSaveProfile.textContent = 'Guardando cambios...';

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'actualizar_perfil',
          usuarioId: usuarioActivo.id,
          password: usuarioActivo.password || '',
          nombre: nuevoNombre,
          dni: nuevoDni,
          avatar: avatarSeleccionadoPerfil
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo actualizar el perfil');
      }

      usuarioActivo.nombre = nuevoNombre;
      usuarioActivo.dni = nuevoDni;
      usuarioActivo.avatar = avatarSeleccionadoPerfil;

      const uEnLista = listaUsuariosPublica.find(u => u.id === usuarioActivo.id);
      if (uEnLista) {
        uEnLista.nombre = nuevoNombre;
        uEnLista.dni = nuevoDni;
        uEnLista.avatar = avatarSeleccionadoPerfil;
      }

      guardarUsuarioRecordado(usuarioActivo);
      
      if (activeUserBadge) activeUserBadge.textContent = `${usuarioActivo.avatar} ${usuarioActivo.nombre}`;
      if (profilePreviewName) profilePreviewName.textContent = nuevoNombre;
      if (profilePreviewDni) profilePreviewDni.textContent = 'DNI: ' + nuevoDni;

      if (profileSuccessMsg) {
        profileSuccessMsg.textContent = '✓ ¡Perfil actualizado y sincronizado con éxito!';
        profileSuccessMsg.classList.remove('hidden');
      }
    } catch (err) {
      if (profileErrorMsg) {
        profileErrorMsg.textContent = 'Error: ' + err.message;
        profileErrorMsg.classList.remove('hidden');
      }
    } finally {
      btnSaveProfile.disabled = false;
      btnSaveProfile.textContent = '💾 Guardar cambios de perfil';
    }
  });
}

function renderizarVincular() {
  if (!usuarioActivo) return;

  // 1. Solicitudes Recibidas
  if (boxVincularRecibidas && vincularListaRecibidas) {
    vincularListaRecibidas.innerHTML = '';
    const recibidas = solicitudesVinculoRecibidas || [];
    if (recibidas.length > 0) {
      boxVincularRecibidas.classList.remove('hidden');
      recibidas.forEach(sol => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.style.flexWrap = 'wrap';
        item.style.gap = '8px';
        item.style.alignItems = 'center';
        item.style.background = 'rgba(15, 23, 42, 0.7)';
        item.style.padding = '12px';
        item.style.borderRadius = '10px';
        item.style.border = '1px solid #f59e0b';

        const tipoTexto = sol.tipo === 'convivientes' ? '🏠 Convivientes (Misma casa)' : '👥 Amigos';
        const tipoDetalle = sol.tipo === 'convivientes'
          ? 'Para compartir tareas, eventos, Supermercado y Heladera.'
          : 'Para hacer tareas en equipo y coordinar eventos en la agenda.';

        item.innerHTML = `
          <div style="flex: 1; min-width: 200px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span class="priority-pill ${sol.tipo === 'convivientes' ? 'pill-verde' : 'pill-hora'}">${tipoTexto}</span>
              <strong style="color: #fff; font-size: 1rem;">${escaparHTML(sol.deNombre)}</strong>
            </div>
            <div style="font-size: 0.82rem; color: #cbd5e1;">DNI: <strong>${escaparHTML(sol.deDni || 'Registrado')}</strong></div>
            <div style="font-size: 0.78rem; color: #94a3b8; margin-top:2px;">${tipoDetalle}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-primary btn-accept-sol" style="background:#10b981; border-color:#059669; padding:6px 14px; font-weight:700; font-size:0.88rem;">
              ✓ Aceptar
            </button>
            <button type="button" class="btn-secondary btn-reject-sol" style="border-color:#ef4444; color:#fca5a5; padding:6px 12px; font-size:0.88rem;">
              ✕ Rechazar
            </button>
          </div>
        `;

        item.querySelector('.btn-accept-sol').onclick = () => responderSolicitudVinculo(sol.id, true);
        item.querySelector('.btn-reject-sol').onclick = () => responderSolicitudVinculo(sol.id, false);
        vincularListaRecibidas.appendChild(item);
      });
    } else {
      boxVincularRecibidas.classList.add('hidden');
    }
  }

  // 2. Vínculos Activos
  if (vincularListaActivos) {
    vincularListaActivos.innerHTML = '';
    const vinculos = usuarioActivo.vinculos || [];
    if (vinculos.length === 0) {
      vincularListaActivos.innerHTML = `
        <div style="text-align: center; padding: 25px 15px; color: var(--text-muted); font-size: 0.92rem; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1);">
          <div style="font-size: 2rem; margin-bottom: 6px;">👥</div>
          No tenés amigos ni convivientes vinculados todavía.<br>
          <span style="font-size: 0.82rem;">Escribí el DNI de la persona arriba para invitarla y empezar a compartir tareas o la casa.</span>
        </div>`;
    } else {
      vinculos.forEach(v => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.style.flexWrap = 'wrap';
        item.style.gap = '8px';
        item.style.alignItems = 'center';
        item.style.padding = '12px';
        item.style.borderRadius = '10px';
        item.style.border = v.tipo === 'convivientes' ? '1px solid #10b981' : '1px solid #334155';
        item.style.background = v.tipo === 'convivientes' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(30, 41, 59, 0.5)';

        const badge = v.tipo === 'convivientes'
          ? '<span class="priority-pill pill-verde" style="font-weight:700;">🏠 Conviviente (Misma casa)</span>'
          : '<span class="priority-pill pill-hora" style="font-weight:700;">👥 Amigo</span>';

        item.innerHTML = `
          <div style="flex: 1; min-width: 180px;">
            <div style="display:flex; align-items:center; gap:8px;">
              ${badge}
              <strong style="font-size: 1rem; color: #fff;">${escaparHTML(v.nombre)}</strong>
            </div>
            ${v.dni ? `<div style="font-size:0.8rem; color:#94a3b8; margin-top:3px;">DNI: ${escaparHTML(v.dni)}</div>` : ''}
            <div style="font-size:0.75rem; color:#cbd5e1; margin-top:2px;">
              ${v.tipo === 'convivientes' ? '✓ Tareas, eventos, Supermercado y Heladera compartidos' : '✓ Tareas y eventos de agenda compartidos'}
            </div>
          </div>
          <button type="button" class="btn-delete btn-del-vinculo" style="padding: 6px 12px; font-size: 0.82rem;">
            ✕ Desvincular
          </button>
        `;

        item.querySelector('.btn-del-vinculo').onclick = () => eliminarVinculoContacto(v.usuarioId, v.nombre);
        vincularListaActivos.appendChild(item);
      });
    }
  }

  // 3. Solicitudes Enviadas Pendientes
  if (boxVincularEnviadas && vincularListaEnviadas) {
    vincularListaEnviadas.innerHTML = '';
    const enviadas = solicitudesVinculoEnviadas || [];
    if (enviadas.length > 0) {
      boxVincularEnviadas.classList.remove('hidden');
      enviadas.forEach(sol => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.style.flexWrap = 'wrap';
        item.style.gap = '8px';
        item.style.alignItems = 'center';
        item.style.padding = '10px';
        item.style.borderRadius = '8px';
        item.style.background = 'rgba(255, 255, 255, 0.03)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.1)';

        const tipoTexto = sol.tipo === 'convivientes' ? '🏠 Convivientes' : '👥 Amigos';

        item.innerHTML = `
          <div style="flex: 1; min-width: 180px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="priority-pill pill-simple">${tipoTexto}</span>
              <strong>${escaparHTML(sol.paraNombre || 'Usuario')}</strong>
              <small style="color:#94a3b8;">(DNI ${escaparHTML(sol.paraDni)})</small>
            </div>
            <div style="font-size: 0.78rem; color: #fbbf24; margin-top: 2px;">⏳ Esperando que acepte la invitación...</div>
          </div>
          <button type="button" class="btn-secondary btn-cancel-sol" style="padding: 4px 10px; font-size: 0.78rem; border-color:#64748b; color:#cbd5e1;">
            ✕ Cancelar solicitud
          </button>
        `;

        item.querySelector('.btn-cancel-sol').onclick = () => cancelarSolicitudVinculo(sol.id);
        vincularListaEnviadas.appendChild(item);
      });
    } else {
      boxVincularEnviadas.classList.add('hidden');
    }
  }

  const extraVincularCounter = document.getElementById('extra-vincular-counter');
  if (extraVincularCounter) {
    const cantRec = (solicitudesVinculoRecibidas || []).length;
    const cantVinc = (usuarioActivo?.vinculos || []).length;
    if (cantRec > 0) {
      extraVincularCounter.textContent = `🔔 ${cantRec} nueva(s)`;
      extraVincularCounter.style.borderColor = '#f59e0b';
      extraVincularCounter.style.color = '#fbbf24';
    } else {
      extraVincularCounter.textContent = cantVinc === 1 ? '1 contacto' : `${cantVinc} contactos`;
      extraVincularCounter.style.borderColor = '#3b82f6';
      extraVincularCounter.style.color = '#93c5fd';
    }
  }
}

async function enviarSolicitudVinculo() {
  if (!usuarioActivo) return;
  const dni = inputVincularDni ? inputVincularDni.value.trim().replace(/\D/g, '') : '';
  if (vincularErrorMsg) vincularErrorMsg.classList.add('hidden');
  if (vincularSuccessMsg) vincularSuccessMsg.classList.add('hidden');

  if (!dni || dni.length < 5) {
    if (vincularErrorMsg) {
      vincularErrorMsg.textContent = 'Por favor ingresá un número de DNI válido (mínimo 5 dígitos)';
      vincularErrorMsg.classList.remove('hidden');
    }
    if (inputVincularDni) inputVincularDni.focus();
    return;
  }

  const radioSel = document.querySelector('input[name="radio-tipo-vinculo"]:checked');
  const tipo = radioSel ? radioSel.value : 'amigos';

  if (btnSubmitVincular) {
    btnSubmitVincular.disabled = true;
    btnSubmitVincular.textContent = 'Enviando...';
  }

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'enviar_solicitud_vinculo',
        usuarioId: usuarioActivo.id,
        password: usuarioActivo.password || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        targetDni: dni,
        tipo: tipo
      })
    });
    const data = await res.json();
    if (!res.ok) {
      if (vincularErrorMsg) {
        vincularErrorMsg.textContent = data.error || 'No se pudo enviar la solicitud';
        vincularErrorMsg.classList.remove('hidden');
      }
      return;
    }

    if (vincularSuccessMsg) {
      vincularSuccessMsg.textContent = `✓ ${data.mensaje || '¡Solicitud enviada con éxito!'}`;
      vincularSuccessMsg.classList.remove('hidden');
      setTimeout(() => vincularSuccessMsg.classList.add('hidden'), 4000);
    }
    if (inputVincularDni) inputVincularDni.value = '';
    solicitudesVinculoEnviadas = data.solicitudesVinculoEnviadas || solicitudesVinculoEnviadas;
    renderizarVincular();
  } catch (e) {
    if (vincularErrorMsg) {
      vincularErrorMsg.textContent = 'Error de conexión. Intentá nuevamente.';
      vincularErrorMsg.classList.remove('hidden');
    }
  } finally {
    if (btnSubmitVincular) {
      btnSubmitVincular.disabled = false;
      btnSubmitVincular.textContent = '📨 Enviar solicitud de vinculación';
    }
  }
}

async function responderSolicitudVinculo(solicitudId, aceptar) {
  if (!usuarioActivo) return;
  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'responder_solicitud_vinculo',
        usuarioId: usuarioActivo.id,
        password: usuarioActivo.password || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        solicitudId: solicitudId,
        aceptar: Boolean(aceptar)
      })
    });
    const data = await res.json();
    if (res.ok) {
      usuarioActivo.vinculos = data.vinculos || usuarioActivo.vinculos;
      solicitudesVinculoRecibidas = data.solicitudesVinculoRecibidas || [];
      if (data.supermercado) supermercado = data.supermercado;
      if (data.heladera) heladera = data.heladera;
      if (data.superCompartidoCon) superCompartidoCon = data.superCompartidoCon;
      renderizarVincular();
      renderizarSupermercado();
      renderizarHeladera();
      renderizarTareasCompartidas();
      alert(aceptar ? '¡Vínculo aceptado con éxito! Ahora están conectados en la app.' : 'Solicitud rechazada.');
    } else {
      alert(data.error || 'No se pudo responder la solicitud.');
    }
  } catch (e) {
    alert('Error de conexión.');
  }
}

async function eliminarVinculoContacto(targetUsuarioId, nombre) {
  if (!usuarioActivo) return;
  if (!confirm(`¿Estás seguro de desvincular a "${nombre}"?\n\nYa no podrán compartir tareas ni eventos en conjunto, y si convivían se separarán las listas de Supermercado y Heladera.`)) return;

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'eliminar_vinculo',
        usuarioId: usuarioActivo.id,
        password: usuarioActivo.password || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        targetUsuarioId: targetUsuarioId
      })
    });
    const data = await res.json();
    if (res.ok) {
      usuarioActivo.vinculos = data.vinculos || [];
      if (data.superCompartidoCon) superCompartidoCon = data.superCompartidoCon;
      renderizarVincular();
      renderizarTareasCompartidas();
      renderizarSupermercado();
      renderizarHeladera();
      alert(`Vínculo con "${nombre}" eliminado.`);
    } else {
      alert(data.error || 'No se pudo eliminar el vínculo.');
    }
  } catch (e) {
    alert('Error de conexión.');
  }
}

async function cancelarSolicitudVinculo(solicitudId) {
  if (!usuarioActivo) return;
  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'cancelar_solicitud_vinculo',
        usuarioId: usuarioActivo.id,
        password: usuarioActivo.password || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        solicitudId: solicitudId
      })
    });
    const data = await res.json();
    if (res.ok) {
      solicitudesVinculoEnviadas = data.solicitudesVinculoEnviadas || [];
      renderizarVincular();
    } else {
      alert(data.error || 'No se pudo cancelar la solicitud.');
    }
  } catch (e) {
    alert('Error de conexión.');
  }
}

if (btnSubmitVincular) btnSubmitVincular.addEventListener('click', enviarSolicitudVinculo);
if (inputVincularDni) {
  inputVincularDni.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enviarSolicitudVinculo();
    }
  });
}

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

  // 2.1. CONTRASEÑA Y PREGUNTA CLAVE DE SEGURIDAD
  const settingsSecQBadge = document.getElementById('settings-sec-q-badge');
  if (settingsSecQBadge && usuarioActivo) {
    if (usuarioActivo.tienePreguntaSeguridad) {
      settingsSecQBadge.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 8px; padding: 8px 12px; color: #a7f3d0; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
          <span>✅</span>
          <div>
            <strong>Pregunta clave de seguridad configurada</strong>
            ${usuarioActivo.preguntaSeguridad ? `<br><small style="color:#d1fae5;">"${escaparHTML(usuarioActivo.preguntaSeguridad)}"</small>` : ''}
          </div>
        </div>
      `;
    } else {
      settingsSecQBadge.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 8px; padding: 8px 12px; color: #fde68a; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
          <span>⚠️</span>
          <div>
            <strong>Aún no registraste tu pregunta clave</strong>
            <br><small style="color:#fef3c7;">Tocá "❓ Pregunta clave de recuperación" para registrarla y poder recuperar tu clave si la olvidás.</small>
          </div>
        </div>
      `;
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

  // 5. GUARDAR TASAS TNA (PANEL DESARROLLADOR)
  const settingsAdminUsersList = document.getElementById('settings-admin-users-list');
  if (settingsAdminUsersList && typeof renderizarListaAdminEnSettings === 'function') {
    renderizarListaAdminEnSettings(settingsAdminUsersList);
  }
  if (inputDevTnaMp && TNA_BILLETERAS_INFO && TNA_BILLETERAS_INFO.mercadopago) {
    inputDevTnaMp.value = TNA_BILLETERAS_INFO.mercadopago.tnaDefault;
  }
  if (inputDevTnaUala && TNA_BILLETERAS_INFO && TNA_BILLETERAS_INFO.uala) {
    inputDevTnaUala.value = TNA_BILLETERAS_INFO.uala.tnaDefault;
  }

  if (btnDevSaveTna) {
    btnDevSaveTna.onclick = async () => {
      const valMp = inputDevTnaMp ? parseFloat(inputDevTnaMp.value) : 31.5;
      const valUala = inputDevTnaUala ? parseFloat(inputDevTnaUala.value) : 19.0;
      if (isNaN(valMp) || valMp <= 0 || isNaN(valUala) || valUala <= 0) {
        alert('Por favor ingresá porcentajes válidos mayores a cero.');
        return;
      }
      let passAdmin = obtenerPasswordAdminParaAcciones();
      if (!passAdmin) {
        passAdmin = prompt('Ingresá tu contraseña de administrador Alejandro para guardar:') || '';
        if (!passAdmin) return;
      }
      try {
        btnDevSaveTna.disabled = true;
        btnDevSaveTna.textContent = 'Guardando...';
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'guardar_tasas_globales',
            usuarioId: 'alejandro',
            adminPassword: passAdmin,
            configTna: {
              mercadopago: valMp,
              uala: valUala
            }
          })
        });
        const data = await res.json();
        if (res.ok) {
          TNA_BILLETERAS_INFO.mercadopago.tnaDefault = valMp;
          TNA_BILLETERAS_INFO.uala.tnaDefault = valUala;
          if (devTnaSavedMsg) {
            devTnaSavedMsg.textContent = '✓ ¡Tasas globales actualizadas con éxito!';
            devTnaSavedMsg.classList.remove('hidden');
            setTimeout(() => devTnaSavedMsg.classList.add('hidden'), 3500);
          }
        } else {
          alert(data.error || 'No se pudieron guardar las tasas');
        }
      } catch (err) {
        alert('Error de conexión al guardar tasas.');
      } finally {
        btnDevSaveTna.disabled = false;
        btnDevSaveTna.textContent = '✓ Guardar tasas para todos';
      }
    };
  }
}

function renderizarListaAdminEnSettings(cont) {
  if (!cont) return;
  cont.innerHTML = '';
  const otros = listaUsuariosPublica.filter(u => !u.esAdmin && u.id !== 'alejandro');
  if (otros.length === 0) {
    cont.innerHTML = '<div style="padding: 10px; color: var(--text-muted);">No hay otros usuarios creados para administrar.</div>';
    return;
  }
  otros.forEach(u => {
    const fila = document.createElement('div');
    fila.className = 'task-item';
    fila.style.flexWrap = 'wrap';
    fila.style.gap = '8px';
    fila.innerHTML = `
      <div class="task-info" style="flex:1; min-width:180px;">
        <span class="priority-pill pill-hora">${u.avatar || '👤'} Usuario</span>
        <strong class="task-text">${escaparHTML(u.nombre)}</strong>
        ${u.passwordBlanqueada ? '<span class="priority-pill pill-urgente" style="font-size:0.75rem; margin-left:6px;">🔑 Clave blanqueada</span>' : ''}
        ${!u.tienePreguntaSeguridad ? '<small style="color:#fca5a5; font-size:0.75rem; margin-left:4px;">(Sin pregunta clave)</small>' : '<small style="color:#86efac; font-size:0.75rem; margin-left:4px;">(Con pregunta clave)</small>'}
      </div>
      <div class="task-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="btn-secondary btn-blank-user" style="border-color:#f59e0b; color:#fbbf24; padding:6px 10px; font-size:0.82rem; font-weight:600;">
          🔑 Blanquear contraseña
        </button>
        <button type="button" class="btn-delete btn-del-user" style="padding:6px 10px; font-size:0.82rem;">
          🗑️ Eliminar usuario
        </button>
      </div>
    `;

    const btnBlank = fila.querySelector('.btn-blank-user');
    btnBlank.onclick = async () => {
      if (!confirm(`¿Estás seguro de blanquear la contraseña de "${u.nombre}"?\n\nAl blanquearla, el usuario podrá restablecer su contraseña desde la pantalla de inicio ingresando su número de DNI y su pregunta clave.`)) return;
      let passAdmin = obtenerPasswordAdminParaAcciones();
      if (!passAdmin) {
        passAdmin = prompt('Ingresá tu contraseña de administrador Alejandro para confirmar:') || '';
        if (!passAdmin) return;
      }
      try {
        btnBlank.disabled = true;
        btnBlank.textContent = 'Blanqueando...';
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'blanquear_password',
            usuarioId: 'alejandro',
            adminPassword: passAdmin,
            password: passAdmin,
            targetUsuarioId: u.id,
            eliminarUsuarioId: u.id
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert(`¡Contraseña de ${u.nombre} blanqueada con éxito!\n\nAhora ${u.nombre} podrá ingresar su DNI y responder su pregunta clave para crear una nueva contraseña.`);
          listaUsuariosPublica = data.usuarios || listaUsuariosPublica;
          renderizarListaAdminEnSettings(cont);
          if (typeof renderizarListaAdminUsuarios === 'function' && adminUsersList) {
            renderizarListaAdminUsuarios();
          }
        } else {
          alert(data.error || 'No se pudo blanquear la contraseña');
          btnBlank.disabled = false;
          btnBlank.textContent = '🔑 Blanquear contraseña';
        }
      } catch (e) {
        alert('Error de conexión al blanquear contraseña.');
        btnBlank.disabled = false;
        btnBlank.textContent = '🔑 Blanquear contraseña';
      }
    };

    const btnDel = fila.querySelector('.btn-del-user');
    btnDel.onclick = async () => {
      if (!confirm(`¿Estás SEGURO de eliminar definitivamente al usuario "${u.nombre}" y todos sus datos? Esta acción no se puede deshacer.`)) return;
      let passAdmin = obtenerPasswordAdminParaAcciones();
      if (!passAdmin) {
        passAdmin = prompt('Ingresá tu contraseña de administrador Alejandro para confirmar la eliminación:') || '';
        if (!passAdmin) return;
      }
      try {
        btnDel.disabled = true;
        btnDel.textContent = 'Eliminando...';
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'eliminar_usuario',
            usuarioId: 'alejandro',
            adminPassword: passAdmin,
            password: passAdmin,
            targetUsuarioId: u.id,
            eliminarUsuarioId: u.id
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert(`Usuario "${u.nombre}" eliminado correctamente.`);
          listaUsuariosPublica = data.usuarios || listaUsuariosPublica.filter(x => x.id !== u.id);
          renderizarListaAdminEnSettings(cont);
          if (typeof renderizarListaAdminUsuarios === 'function' && adminUsersList) {
            renderizarListaAdminUsuarios();
          }
          renderizarGrillaUsuarios();
        } else {
          alert(data.error || 'No se pudo eliminar el usuario');
          btnDel.disabled = false;
          btnDel.textContent = '🗑️ Eliminar usuario';
        }
      } catch (e) {
        alert('Error de conexión al eliminar usuario.');
        btnDel.disabled = false;
        btnDel.textContent = '🗑️ Eliminar usuario';
      }
    };

    cont.appendChild(fila);
  });
}

// ==========================================
// MÓDULO: LISTAS DE COMPRAS Y PRESUPUESTOS (DENTRO DE EXTRAS)
// ==========================================
const btnCreateListToggle = document.getElementById('btn-create-list-toggle');
const createListBox = document.getElementById('create-list-box');
const inputNewListName = document.getElementById('input-new-list-name');
const btnModeSolo = document.getElementById('btn-mode-solo');
const btnModeShared = document.getElementById('btn-mode-shared');
const newListShareUsersBox = document.getElementById('new-list-share-users-box');
const newListShareCheckboxes = document.getElementById('new-list-share-checkboxes');
const btnCancelCreateList = document.getElementById('btn-cancel-create-list');
const btnSaveNewList = document.getElementById('btn-save-new-list');

const editShareModalBox = document.getElementById('edit-share-modal-box');
const editShareModalSubtitle = document.getElementById('edit-share-modal-subtitle');
const editShareCheckboxes = document.getElementById('edit-share-checkboxes');
const btnCloseEditShare = document.getElementById('btn-close-edit-share');
const btnSaveEditShare = document.getElementById('btn-save-edit-share');

const listsPillsContainer = document.getElementById('lists-pills-container');
const activeListContent = document.getElementById('active-list-content');
const activeListTotalDisplay = document.getElementById('active-list-total-display');
const activeListShareBadge = document.getElementById('active-list-share-badge');
const activeListItemsCount = document.getElementById('active-list-items-count');
const btnToggleShareActiveList = document.getElementById('btn-toggle-share-active-list');
const btnDeleteActiveList = document.getElementById('btn-delete-active-list');

const inputItemCant = document.getElementById('input-item-cant');
const inputItemMaterial = document.getElementById('input-item-material');
const inputItemVunit = document.getElementById('input-item-vunit');
const itemSubtotalPreview = document.getElementById('item-subtotal-preview');
const btnAddItemToList = document.getElementById('btn-add-item-to-list');
const budgetTableRows = document.getElementById('budget-table-rows');
const noListsPlaceholder = document.getElementById('no-lists-placeholder');

function actualizarPreviewSubtotalItem() {
  if (!itemSubtotalPreview) return;
  const cant = parseFloat(inputItemCant && inputItemCant.value ? inputItemCant.value : '1') || 0;
  const vunit = parseFloat(inputItemVunit && inputItemVunit.value ? inputItemVunit.value : '0') || 0;
  const subtotal = Math.round(cant * vunit * 100) / 100;
  itemSubtotalPreview.textContent = formatearPesos(subtotal);
}

function renderizarCheckboxesCompartirNuevaLista() {
  if (!newListShareCheckboxes) return;
  newListShareCheckboxes.innerHTML = '';
  const vinculosIds = (usuarioActivo?.vinculos || []).map(v => v.usuarioId);
  const otrosUsuarios = (listaUsuariosPublica || []).filter(u => usuarioActivo && u.id !== usuarioActivo.id && vinculosIds.includes(u.id));
  if (otrosUsuarios.length === 0) {
    newListShareCheckboxes.innerHTML = '<div style="color: #94a3b8; font-size: 0.88rem; font-style: italic; padding: 6px;">Para compartir presupuestos, primero vinculá amigos o convivientes en Extras &gt; Vincular Contactos.</div>';
    return;
  }
  otrosUsuarios.forEach(u => {
    const item = document.createElement('label');
    item.className = 'share-user-check-item';
    const checked = usuariosSeleccionadosNuevaLista.has(u.id);
    item.innerHTML = `
      <input type="checkbox" data-user-id="${u.id}" ${checked ? 'checked' : ''}>
      <span class="user-avatar">${u.avatar || '👤'}</span>
      <span class="user-name">${escaparHTML(u.nombre)}</span>
    `;
    const chk = item.querySelector('input');
    chk.addEventListener('change', () => {
      if (chk.checked) {
        usuariosSeleccionadosNuevaLista.add(u.id);
      } else {
        usuariosSeleccionadosNuevaLista.delete(u.id);
      }
    });
    newListShareCheckboxes.appendChild(item);
  });
}

function renderizarCheckboxesEdicionCompartir() {
  if (!editShareCheckboxes) return;
  editShareCheckboxes.innerHTML = '';
  const vinculosIds = (usuarioActivo?.vinculos || []).map(v => v.usuarioId);
  const otrosUsuarios = (listaUsuariosPublica || []).filter(u => usuarioActivo && u.id !== usuarioActivo.id && vinculosIds.includes(u.id));
  if (otrosUsuarios.length === 0) {
    editShareCheckboxes.innerHTML = '<div style="color: #94a3b8; font-size: 0.88rem; font-style: italic; padding: 6px;">Para compartir presupuestos, primero vinculá amigos o convivientes en Extras &gt; Vincular Contactos.</div>';
    return;
  }
  otrosUsuarios.forEach(u => {
    const item = document.createElement('label');
    item.className = 'share-user-check-item';
    const checked = usuariosSeleccionadosEdicionLista.has(u.id);
    item.innerHTML = `
      <input type="checkbox" data-user-id="${u.id}" ${checked ? 'checked' : ''}>
      <span class="user-avatar">${u.avatar || '👤'}</span>
      <span class="user-name">${escaparHTML(u.nombre)}</span>
    `;
    const chk = item.querySelector('input');
    chk.addEventListener('change', () => {
      if (chk.checked) {
        usuariosSeleccionadosEdicionLista.add(u.id);
      } else {
        usuariosSeleccionadosEdicionLista.delete(u.id);
      }
    });
    editShareCheckboxes.appendChild(item);
  });
}

function abrirModalCompartirListaActiva() {
  if (!idListaPresupuestoActiva) return;
  const listaActiva = listasPresupuestos.find(l => l.id === idListaPresupuestoActiva);
  if (!listaActiva) return;

  if (editShareModalSubtitle) {
    editShareModalSubtitle.textContent = `Seleccioná qué usuarios tienen acceso a "${listaActiva.nombre}":`;
  }
  usuariosSeleccionadosEdicionLista = new Set(Array.isArray(listaActiva.compartidaCon) ? listaActiva.compartidaCon : []);
  renderizarCheckboxesEdicionCompartir();
  if (editShareModalBox) editShareModalBox.classList.remove('hidden');
}

function renderizarListasPresupuestos() {
  if (!Array.isArray(listasPresupuestos)) listasPresupuestos = [];

  // Contador en el menú
  const extraListsCounter = document.getElementById('extra-lists-counter');
  if (extraListsCounter) {
    const cantL = listasPresupuestos.length;
    extraListsCounter.textContent = cantL === 1 ? '1 lista creada' : `${cantL} listas creadas`;
  }

  // Si no hay listas creadas
  if (listasPresupuestos.length === 0) {
    if (noListsPlaceholder) noListsPlaceholder.classList.remove('hidden');
    if (activeListContent) activeListContent.classList.add('hidden');
    if (listsPillsContainer) listsPillsContainer.innerHTML = '';
    return;
  }

  if (noListsPlaceholder) noListsPlaceholder.classList.add('hidden');
  if (activeListContent) activeListContent.classList.remove('hidden');

  // Asegurar que haya una lista activa seleccionada válida
  if (!idListaPresupuestoActiva || !listasPresupuestos.find(l => l.id === idListaPresupuestoActiva)) {
    idListaPresupuestoActiva = listasPresupuestos[0].id;
  }

  // Renderizar píldoras selectoras de listas
  if (listsPillsContainer) {
    listsPillsContainer.innerHTML = '';
    listasPresupuestos.forEach(l => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const esActiva = l.id === idListaPresupuestoActiva;
      btn.className = `btn-list-pill ${esActiva ? 'active' : ''}`;
      const cantItems = Array.isArray(l.items) ? l.items.length : 0;
      const esCompartida = Array.isArray(l.compartidaCon) && l.compartidaCon.length > 0;
      btn.textContent = `${esCompartida ? '👥' : '📋'} ${l.nombre} (${cantItems})`;
      btn.onclick = () => {
        idListaPresupuestoActiva = l.id;
        if (editShareModalBox) editShareModalBox.classList.add('hidden');
        renderizarListasPresupuestos();
      };
      listsPillsContainer.appendChild(btn);
    });
  }

  const listaActiva = listasPresupuestos.find(l => l.id === idListaPresupuestoActiva);
  if (!listaActiva) return;
  if (!Array.isArray(listaActiva.items)) listaActiva.items = [];

  // Badge de estado de compartir
  if (activeListShareBadge) {
    const esCompartida = Array.isArray(listaActiva.compartidaCon) && listaActiva.compartidaCon.length > 0;
    if (esCompartida) {
      activeListShareBadge.className = 'list-share-status-tag shared';
      if (listaActiva.creadorId && usuarioActivo && listaActiva.creadorId !== usuarioActivo.id) {
        activeListShareBadge.textContent = `👥 Compartida por ${listaActiva.creadorNombre || 'otro usuario'}`;
      } else {
        const nombres = listaActiva.compartidaCon.map(uid => {
          const u = (listaUsuariosPublica || []).find(x => x.id === uid);
          return u ? u.nombre : uid;
        }).join(', ');
        activeListShareBadge.textContent = `👥 Compartida con ${nombres}`;
      }
    } else {
      activeListShareBadge.className = 'list-share-status-tag';
      activeListShareBadge.textContent = '👤 En solitario (solo para mí)';
    }
  }

  // Calcular total general de la lista: suma de todos los totales de los elementos
  const totalGeneral = listaActiva.items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  if (activeListTotalDisplay) {
    activeListTotalDisplay.textContent = formatearPesos(totalGeneral);
  }

  const comprados = listaActiva.items.filter(it => it.comprado).length;
  if (activeListItemsCount) {
    const totalCount = listaActiva.items.length;
    activeListItemsCount.textContent = totalCount === 1
      ? `1 material ${comprados > 0 ? '(comprado)' : ''}`
      : `${totalCount} materiales ${comprados > 0 ? `(${comprados} comprados)` : ''}`;
  }

  // Renderizar filas de la tabla de materiales
  if (budgetTableRows) {
    budgetTableRows.innerHTML = '';
    if (listaActiva.items.length === 0) {
      budgetTableRows.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 0.95rem;">
          Esta lista aún no tiene materiales. Usá el formulario arriba para agregar el primero.
        </div>
      `;
    } else {
      listaActiva.items.forEach(it => {
        const fila = document.createElement('div');
        fila.className = `budget-table-row ${it.comprado ? 'is-bought' : ''}`;
        fila.innerHTML = `
          <div class="col-cant">
            <input type="checkbox" class="check-item-bought" ${it.comprado ? 'checked' : ''} title="Marcar como comprado">
            <span>${it.cant}</span>
          </div>
          <div class="col-material">${escaparHTML(it.material)}</div>
          <div class="col-vunit">${formatearPesos(it.vUnitario)}</div>
          <div class="col-total">${formatearPesos(it.total)}</div>
          <div class="col-actions">
            <button type="button" class="btn-del-item-icon" title="Eliminar material">🗑️</button>
          </div>
        `;

        const check = fila.querySelector('.check-item-bought');
        if (check) {
          check.onchange = async () => {
            it.comprado = check.checked;
            listaActiva.updatedAt = Date.now();
            renderizarListasPresupuestos();
            await guardarEnNube();
          };
        }

        const btnDel = fila.querySelector('.btn-del-item-icon');
        if (btnDel) {
          btnDel.onclick = async () => {
            listaActiva.items = listaActiva.items.filter(x => x.id !== it.id);
            listaActiva.updatedAt = Date.now();
            renderizarListasPresupuestos();
            await guardarEnNube();
          };
        }

        budgetTableRows.appendChild(fila);
      });
    }
  }

  actualizarPreviewSubtotalItem();
}

async function agregarMaterialAListaActiva() {
  if (!idListaPresupuestoActiva) {
    alert('Primero creá o seleccioná una lista.');
    return;
  }
  const listaActiva = listasPresupuestos.find(l => l.id === idListaPresupuestoActiva);
  if (!listaActiva) return;

  const matText = inputItemMaterial ? inputItemMaterial.value.trim() : '';
  if (!matText) {
    if (inputItemMaterial) inputItemMaterial.focus();
    return;
  }

  const cantVal = parseFloat(inputItemCant && inputItemCant.value ? inputItemCant.value : '1') || 1;
  const vunitVal = parseFloat(inputItemVunit && inputItemVunit.value ? inputItemVunit.value : '0') || 0;
  const totalVal = Math.round(cantVal * vunitVal * 100) / 100;

  if (!Array.isArray(listaActiva.items)) listaActiva.items = [];
  listaActiva.items.push({
    id: 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    cant: cantVal,
    material: matText,
    vUnitario: vunitVal,
    total: totalVal,
    comprado: false,
    creadoEl: Date.now()
  });

  listaActiva.updatedAt = Date.now();

  if (inputItemMaterial) inputItemMaterial.value = '';
  if (inputItemVunit) inputItemVunit.value = '';
  if (inputItemCant) inputItemCant.value = '1';
  actualizarPreviewSubtotalItem();
  if (inputItemMaterial) inputItemMaterial.focus();

  renderizarListasPresupuestos();
  await guardarEnNube();
}

async function crearNuevaListaPresupuesto() {
  const nombre = inputNewListName ? inputNewListName.value.trim() : '';
  if (!nombre) {
    if (inputNewListName) inputNewListName.focus();
    return;
  }
  const compartidaCon = (modoNuevaLista === 'shared') ? Array.from(usuariosSeleccionadosNuevaLista) : [];
  const ahora = Date.now();
  const nueva = {
    id: 'lista-' + ahora + '-' + Math.random().toString(36).slice(2, 6),
    nombre: nombre,
    items: [],
    creadoEl: ahora,
    updatedAt: ahora,
    creadorId: usuarioActivo ? usuarioActivo.id : null,
    creadorNombre: usuarioActivo ? usuarioActivo.nombre : 'Usuario',
    compartidaCon: compartidaCon
  };
  listasPresupuestos.push(nueva);
  idListaPresupuestoActiva = nueva.id;
  if (inputNewListName) inputNewListName.value = '';
  modoNuevaLista = 'solo';
  usuariosSeleccionadosNuevaLista.clear();
  if (createListBox) createListBox.classList.add('hidden');
  renderizarListasPresupuestos();
  await guardarEnNube();
}

async function eliminarListaPresupuestoActiva() {
  const listaActiva = listasPresupuestos.find(l => l.id === idListaPresupuestoActiva);
  if (!listaActiva) return;
  if (confirm(`¿Querés eliminar la lista "${listaActiva.nombre}" y todos sus materiales?`)) {
    borradosListas.push(listaActiva.id);
    listasPresupuestos = listasPresupuestos.filter(l => l.id !== idListaPresupuestoActiva);
    idListaPresupuestoActiva = listasPresupuestos.length > 0 ? listasPresupuestos[0].id : null;
    if (editShareModalBox) editShareModalBox.classList.add('hidden');
    renderizarListasPresupuestos();
    await guardarEnNube();
  }
}

// Botones de modo En solitario vs Compartida
if (btnModeSolo) {
  btnModeSolo.addEventListener('click', () => {
    modoNuevaLista = 'solo';
    btnModeSolo.classList.add('active');
    if (btnModeShared) btnModeShared.classList.remove('active');
    if (newListShareUsersBox) newListShareUsersBox.classList.add('hidden');
  });
}

if (btnModeShared) {
  btnModeShared.addEventListener('click', () => {
    modoNuevaLista = 'shared';
    btnModeShared.classList.add('active');
    if (btnModeSolo) btnModeSolo.classList.remove('active');
    if (newListShareUsersBox) newListShareUsersBox.classList.remove('hidden');
    renderizarCheckboxesCompartirNuevaLista();
  });
}

if (btnCreateListToggle) {
  btnCreateListToggle.addEventListener('click', () => {
    if (createListBox) {
      const estaOculto = createListBox.classList.contains('hidden');
      if (estaOculto) {
        modoNuevaLista = 'solo';
        usuariosSeleccionadosNuevaLista.clear();
        if (btnModeSolo) btnModeSolo.classList.add('active');
        if (btnModeShared) btnModeShared.classList.remove('active');
        if (newListShareUsersBox) newListShareUsersBox.classList.add('hidden');
        createListBox.classList.remove('hidden');
        if (inputNewListName) inputNewListName.focus();
      } else {
        createListBox.classList.add('hidden');
      }
    }
  });
}

if (btnCancelCreateList) {
  btnCancelCreateList.addEventListener('click', () => {
    if (createListBox) createListBox.classList.add('hidden');
  });
}

if (btnSaveNewList) {
  btnSaveNewList.addEventListener('click', crearNuevaListaPresupuesto);
}

if (inputNewListName) {
  inputNewListName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      crearNuevaListaPresupuesto();
    }
  });
}

// Modal para editar compartir de la lista activa
if (btnToggleShareActiveList) {
  btnToggleShareActiveList.addEventListener('click', abrirModalCompartirListaActiva);
}

if (btnCloseEditShare) {
  btnCloseEditShare.addEventListener('click', () => {
    if (editShareModalBox) editShareModalBox.classList.add('hidden');
  });
}

if (btnSaveEditShare) {
  btnSaveEditShare.addEventListener('click', async () => {
    const listaActiva = listasPresupuestos.find(l => l.id === idListaPresupuestoActiva);
    if (!listaActiva) return;
    listaActiva.compartidaCon = Array.from(usuariosSeleccionadosEdicionLista);
    listaActiva.updatedAt = Date.now();
    if (editShareModalBox) editShareModalBox.classList.add('hidden');
    renderizarListasPresupuestos();
    await guardarEnNube();
  });
}

if (btnAddItemToList) {
  btnAddItemToList.addEventListener('click', agregarMaterialAListaActiva);
}

if (inputItemMaterial) {
  inputItemMaterial.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarMaterialAListaActiva();
    }
  });
}

if (inputItemVunit) {
  inputItemVunit.addEventListener('input', actualizarPreviewSubtotalItem);
  inputItemVunit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarMaterialAListaActiva();
    }
  });
}

if (inputItemCant) {
  inputItemCant.addEventListener('input', actualizarPreviewSubtotalItem);
  inputItemCant.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarMaterialAListaActiva();
    }
  });
}

if (btnDeleteActiveList) {
  btnDeleteActiveList.addEventListener('click', eliminarListaPresupuestoActiva);
}

// ==========================================
// MÓDULO 2: ECONOMÍA PERSONAL (BILLETERA + DEUDAS)
// ==========================================
const subtabDebtsOwedToMe = document.getElementById('subtab-debts-owed-to-me');
const subtabDebtsIOwe = document.getElementById('subtab-debts-i-owe');
const debtsOwedToMeSection = document.getElementById('debts-owed-to-me-section');
const debtsIOweSection = document.getElementById('debts-i-owe-section');

function actualizarContadoresEconomiaMenu() {
  if (menuWalletCounter) {
    let totE = 0;
    let totV = 0;
    (movimientos || []).forEach(m => {
      const val = Number(m.monto) || 0;
      if (m.tipo === 'ingreso' || m.tipo === 'sueldo') {
        if (m.medio === 'virtual') totV += val;
        else totE += val;
      } else if (m.tipo === 'gasto') {
        if (m.medio === 'virtual') totV -= val;
        else totE -= val;
      }
    });
    const totalDisp = totE + totV;
    menuWalletCounter.textContent = `${formatearPesos(totalDisp)} disponible`;
  }
  if (menuDebtsCounter) {
    let sumaDeudas = 0;
    (deudores || []).forEach(d => {
      const res = calcularResumenDeudor(d);
      sumaDeudas += res.saldoPendiente;
    });
    let sumaYoDebo = 0;
    (yoDebo || []).forEach(d => {
      sumaYoDebo += Math.max(0, (Number(d.montoTotal) || 0) - (Number(d.montoPagado) || 0));
    });
    menuDebtsCounter.textContent = `Me deben: ${formatearPesos(sumaDeudas)} · Debo: ${formatearPesos(sumaYoDebo)}`;
  }
  if (homeWalletCounter) {
    homeWalletCounter.textContent = '2 opciones';
  }
}

function cambiarSubtabDeudas(sub) {
  subtabDeudaActiva = sub;
  if (subtabDebtsOwedToMe) subtabDebtsOwedToMe.classList.toggle('active', sub === 'me-deben');
  if (subtabDebtsIOwe) subtabDebtsIOwe.classList.toggle('active', sub === 'yo-debo');
  if (debtsOwedToMeSection) debtsOwedToMeSection.classList.toggle('hidden', sub !== 'me-deben');
  if (debtsIOweSection) debtsIOweSection.classList.toggle('hidden', sub !== 'yo-debo');

  if (sub === 'me-deben') {
    renderizarDeudores();
  } else {
    renderizarYoDebo();
  }
}

if (subtabDebtsOwedToMe) subtabDebtsOwedToMe.addEventListener('click', () => cambiarSubtabDeudas('me-deben'));
if (subtabDebtsIOwe) subtabDebtsIOwe.addEventListener('click', () => cambiarSubtabDeudas('yo-debo'));

// ------------------------------------------
// DEUDAS: "ME DEBEN" (Acreedor / Deudores)
// ------------------------------------------
const debtsMainView = document.getElementById('debts-main-view');
const debtorDetailView = document.getElementById('debtor-detail-view');
const btnCreateDebtorToggle = document.getElementById('btn-create-debtor-toggle');
const createDebtorBox = document.getElementById('create-debtor-box');
const inputNewDebtorName = document.getElementById('input-new-debtor-name');
const inputNewDebtorDni = document.getElementById('input-new-debtor-dni');
const btnCancelCreateDebtor = document.getElementById('btn-cancel-create-debtor');
const btnSaveNewDebtor = document.getElementById('btn-save-new-debtor');

const globalDebtBanner = document.getElementById('global-debt-banner');
const globalDebtAmount = document.getElementById('global-debt-amount');
const globalDebtSub = document.getElementById('global-debt-sub');
const debtorsCardsGrid = document.getElementById('debtors-cards-grid');
const noDebtorsPlaceholder = document.getElementById('no-debtors-placeholder');

const btnBackToDebtorsList = document.getElementById('btn-back-to-debtors-list');
const btnDeleteActiveDebtor = document.getElementById('btn-delete-active-debtor');
const btnDebtorShareLink = document.getElementById('btn-debtor-share-link');
const debtorShareModal = document.getElementById('debtor-share-modal');
const inputDebtorShareUrl = document.getElementById('input-debtor-share-url');
const btnCopyDebtorShare = document.getElementById('btn-copy-debtor-share');
const btnWhatsappDebtorShare = document.getElementById('btn-whatsapp-debtor-share');
const debtorShareCopiedMsg = document.getElementById('debtor-share-copied-msg');

const activeDebtorNameLabel = document.getElementById('active-debtor-name-label');
const activeDebtorTotalDisplay = document.getElementById('active-debtor-total-display');
const activeDebtorBreakdown = document.getElementById('active-debtor-breakdown');
const activeDebtorItemsCount = document.getElementById('active-debtor-items-count');

const btnShowAddDebt = document.getElementById('btn-show-add-debt');
const debtMovementFormBox = document.getElementById('debt-movement-form-box');
const debtMovementFormTitle = document.getElementById('debt-movement-form-title');
const debtMovementFormSub = document.getElementById('debt-movement-form-sub');
const inputDebtConcept = document.getElementById('input-debt-concept');
const inputDebtAmount = document.getElementById('input-debt-amount');
const inputDebtInstallments = document.getElementById('input-debt-installments');
const btnCancelDebtMovement = document.getElementById('btn-cancel-debt-movement');
const btnSaveDebtMovement = document.getElementById('btn-save-debt-movement');

const debtorPendingPaymentsBox = document.getElementById('debtor-pending-payments-box');
const pendingPaymentsCountBadge = document.getElementById('pending-payments-count-badge');
const debtorPendingPaymentsList = document.getElementById('debtor-pending-payments-list');

const conceptPaymentModalBox = document.getElementById('concept-payment-modal-box');
const conceptPaymentModalSub = document.getElementById('concept-payment-modal-sub');
const inputConceptPaymentName = document.getElementById('input-concept-payment-name');
const inputConceptPaymentAmount = document.getElementById('input-concept-payment-amount');
const inputConceptPaymentNote = document.getElementById('input-concept-payment-note');
const btnCancelConceptPayment = document.getElementById('btn-cancel-concept-payment');
const btnSaveConceptPayment = document.getElementById('btn-save-concept-payment');
const debtorConceptsList = document.getElementById('debtor-concepts-list');

function calcularResumenDeudor(deudor) {
  if (!deudor || !Array.isArray(deudor.conceptos)) {
    return { totalDeudas: 0, totalPagos: 0, saldoPendiente: 0, cantidad: 0, cantPagosPendientes: 0 };
  }
  let totalDeudas = 0;
  let totalPagos = 0;

  deudor.conceptos.forEach(c => {
    if (!c.tipo || c.tipo === 'deuda') {
      const monto = Number(c.monto) || 0;
      totalDeudas += monto;
      const pagos = Array.isArray(c.pagos) ? c.pagos : [];
      const sumPagos = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
      totalPagos += sumPagos;
      if (c.pagado && sumPagos === 0) totalPagos += monto;
    } else if (c.tipo === 'pago') {
      totalPagos += (Number(c.monto) || 0);
    }
  });

  const saldoPendiente = Math.max(0, totalDeudas - totalPagos);
  const cantPagosPendientes = (deudor.pagosPendientes || []).filter(p => p.estado === 'pendiente').length;

  return {
    totalDeudas,
    totalPagos,
    saldoPendiente,
    cantidad: deudor.conceptos.length,
    cantPagosPendientes
  };
}

function renderizarDeudores() {
  if (!Array.isArray(deudores)) deudores = [];

  let sumaGeneralDeudas = 0;
  let cantConDeuda = 0;

  deudores.forEach(d => {
    const res = calcularResumenDeudor(d);
    sumaGeneralDeudas += res.saldoPendiente;
    if (res.saldoPendiente > 0) cantConDeuda++;
  });

  if (globalDebtAmount) globalDebtAmount.textContent = formatearPesos(sumaGeneralDeudas);
  if (globalDebtSub) {
    globalDebtSub.textContent = cantConDeuda === 1
      ? '1 deudor con saldo pendiente'
      : `${cantConDeuda} deudores con saldo pendiente`;
  }

  if (idDeudorActivo && deudores.find(d => d.id === idDeudorActivo)) {
    mostrarDetalleDeudor(idDeudorActivo, false);
    return;
  }

  if (debtsMainView) debtsMainView.classList.remove('hidden');
  if (debtorDetailView) debtorDetailView.classList.add('hidden');

  if (deudores.length === 0) {
    if (noDebtorsPlaceholder) noDebtorsPlaceholder.classList.remove('hidden');
    if (debtorsCardsGrid) debtorsCardsGrid.innerHTML = '';
    return;
  }

  if (noDebtorsPlaceholder) noDebtorsPlaceholder.classList.add('hidden');

  if (debtorsCardsGrid) {
    debtorsCardsGrid.innerHTML = '';
    deudores.forEach(d => {
      const res = calcularResumenDeudor(d);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'debtor-card-btn';

      const badgeHtml = res.saldoPendiente > 0
        ? `<span class="debtor-card-badge owing">Debe: ${formatearPesos(res.saldoPendiente)}</span>`
        : `<span class="debtor-card-badge settled">✓ Al día: $ 0</span>`;

      const alertPendiente = res.cantPagosPendientes > 0
        ? `<span class="priority-pill pill-intermedio" style="font-size:0.75rem; margin-top:4px;">🔔 ${res.cantPagosPendientes} pago(s) a revisar</span>`
        : '';

      card.innerHTML = `
        <div class="debtor-card-btn-left">
          <div class="debtor-card-avatar">👤</div>
          <div>
            <div class="debtor-card-name">${escaparHTML(d.nombre)}</div>
            <div class="debtor-card-info">${res.cantidad} deuda${res.cantidad === 1 ? '' : 's'} registradas ${alertPendiente}</div>
          </div>
        </div>
        <div class="debtor-card-btn-right">
          ${badgeHtml}
          <span class="debtor-card-arrow">→</span>
        </div>
      `;

      card.onclick = () => {
        idDeudorActivo = d.id;
        mostrarDetalleDeudor(d.id, true);
      };

      debtorsCardsGrid.appendChild(card);
    });
  }
}

function mostrarDetalleDeudor(debtorId, limpiarFormularios = false) {
  const deudor = deudores.find(d => d.id === debtorId);
  if (!deudor) {
    volverAListaDeudores();
    return;
  }
  idDeudorActivo = deudor.id;
  if (!Array.isArray(deudor.conceptos)) deudor.conceptos = [];
  if (!Array.isArray(deudor.pagosPendientes)) deudor.pagosPendientes = [];

  if (debtsMainView) debtsMainView.classList.add('hidden');
  if (debtorDetailView) debtorDetailView.classList.remove('hidden');
  if (limpiarFormularios) {
    if (debtMovementFormBox) debtMovementFormBox.classList.add('hidden');
    if (conceptPaymentModalBox) conceptPaymentModalBox.classList.add('hidden');
    if (debtorShareModal) debtorShareModal.classList.add('hidden');
  }

  const res = calcularResumenDeudor(deudor);

  if (activeDebtorNameLabel) activeDebtorNameLabel.textContent = `👤 Deudor: ${deudor.nombre}`;
  if (activeDebtorTotalDisplay) activeDebtorTotalDisplay.textContent = formatearPesos(res.saldoPendiente);
  if (activeDebtorBreakdown) {
    activeDebtorBreakdown.textContent = `Total cargado: ${formatearPesos(res.totalDeudas)} • Total pagado: ${formatearPesos(res.totalPagos)}`;
  }
  if (activeDebtorItemsCount) {
    activeDebtorItemsCount.textContent = res.cantidad === 1 ? '1 deuda' : `${res.cantidad} deudas`;
  }

  // Configurar link de compartir
  if (inputDebtorShareUrl && usuarioActivo) {
    const origin = window.location.origin;
    inputDebtorShareUrl.value = `${origin}/?estado_cuenta=${deudor.id}&owner=${usuarioActivo.id}`;
  }

  // 1. Renderizar pagos pendientes de aprobación informados por el deudor
  renderizarPagosPendientesDeudor(deudor);

  // 2. Renderizar lista de deudas individuales
  renderizarDeudasIndividualesDeudor(deudor);
}

function renderizarPagosPendientesDeudor(deudor) {
  if (!debtorPendingPaymentsBox || !debtorPendingPaymentsList) return;
  const pendientes = (deudor.pagosPendientes || []).filter(p => p.estado === 'pendiente');

  if (pendientes.length === 0) {
    debtorPendingPaymentsBox.classList.add('hidden');
    return;
  }

  debtorPendingPaymentsBox.classList.remove('hidden');
  if (pendingPaymentsCountBadge) pendingPaymentsCountBadge.textContent = pendientes.length;
  debtorPendingPaymentsList.innerHTML = '';

  pendientes.forEach(p => {
    const item = document.createElement('div');
    item.className = 'pending-payment-card';

    const fechaStr = p.fechaHora ? new Date(p.fechaHora).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const notaHtml = p.nota ? `<div style="font-size:0.85rem; color:#cbd5e1; margin-top:2px;">Nota: "${escaparHTML(p.nota)}"</div>` : '';

    item.innerHTML = `
      <div>
        <div style="font-weight: 700; color: #93c5fd; font-size: 1.05rem;">
          💵 ${formatearPesos(p.monto)} 
          <span style="font-weight: 400; font-size: 0.9rem; color: #cbd5e1;">para: <strong>${escaparHTML(p.conceptoNombre || 'Abono general')}</strong></span>
        </div>
        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">Informado: ${fechaStr}</div>
        ${notaHtml}
      </div>
      <div style="display: flex; gap: 8px;">
        <button type="button" class="btn-approve-payment" data-id="${p.id}">✓ Aceptar</button>
        <button type="button" class="btn-reject-payment" data-id="${p.id}">✕ Rechazar</button>
      </div>
    `;

    const btnApprove = item.querySelector('.btn-approve-payment');
    if (btnApprove) {
      btnApprove.onclick = async () => {
        await aprobarPagoInformado(deudor, p);
      };
    }

    const btnReject = item.querySelector('.btn-reject-payment');
    if (btnReject) {
      btnReject.onclick = async () => {
        await rechazarPagoInformado(deudor, p);
      };
    }

    debtorPendingPaymentsList.appendChild(item);
  });
}

async function aprobarPagoInformado(deudor, pago) {
  if (usuarioActivo) {
    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'aprobar_pago_deudor',
          usuarioId: usuarioActivo.id,
          password: usuarioActivo.password,
          deudorId: deudor.id,
          pagoId: pago.id,
          aceptar: true
        })
      });
      const data = await res.json();
      if (res.ok && data.deudor) {
        const idx = deudores.findIndex(d => d.id === deudor.id);
        if (idx !== -1) deudores[idx] = data.deudor;
        mostrarDetalleDeudor(deudor.id);
        alert(`✓ ¡Pago de ${formatearPesos(pago.monto)} aceptado y descontado exitosamente!`);
        return;
      }
    } catch (err) {
      console.error('Error aprobando pago en API:', err);
    }
  }

  pago.estado = 'aceptado';
  pago.fechaAprobado = Date.now();

  // Buscar deuda/concepto específico al que imputar
  let conc = null;
  if (pago.conceptoId) {
    conc = deudor.conceptos.find(c => c.id === pago.conceptoId);
  }
  if (!conc) {
    // Si no tiene concepto específico o ya no existe, imputar a la primera deuda con saldo
    conc = deudor.conceptos.find(c => {
      const sum = (c.pagos || []).reduce((a, x) => a + (Number(x.monto) || 0), 0);
      return (Number(c.monto) || 0) > sum;
    });
  }

  const nuevoAbono = {
    id: 'pago_' + Date.now(),
    monto: pago.monto,
    nota: pago.nota ? `Pago informado por ${deudor.nombre}: ${pago.nota}` : `Pago informado por ${deudor.nombre}`,
    fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    creadoEl: Date.now()
  };

  if (conc) {
    if (!Array.isArray(conc.pagos)) conc.pagos = [];
    conc.pagos.push(nuevoAbono);
    const sumP = conc.pagos.reduce((a, x) => a + (Number(x.monto) || 0), 0);
    if (sumP >= (Number(conc.monto) || 0)) conc.pagado = true;
  } else {
    // Si no había deudas, agregar como pago general
    deudor.conceptos.push({
      id: 'mov_pago_' + Date.now(),
      tipo: 'pago',
      concepto: 'Pago informado por ' + deudor.nombre,
      monto: pago.monto,
      fecha: nuevoAbono.fecha,
      creadoEl: Date.now()
    });
  }

  deudor.updatedAt = Date.now();
  mostrarDetalleDeudor(deudor.id);
  await guardarEnNube();
  alert(`✓ ¡Pago de ${formatearPesos(pago.monto)} aceptado y descontado exitosamente!`);
}

async function rechazarPagoInformado(deudor, pago) {
  if (!confirm(`¿Querés rechazar el pago informado de ${formatearPesos(pago.monto)}? No se descontará ningún saldo.`)) return;

  if (usuarioActivo) {
    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'aprobar_pago_deudor',
          usuarioId: usuarioActivo.id,
          password: usuarioActivo.password,
          deudorId: deudor.id,
          pagoId: pago.id,
          aceptar: false
        })
      });
      const data = await res.json();
      if (res.ok && data.deudor) {
        const idx = deudores.findIndex(d => d.id === deudor.id);
        if (idx !== -1) deudores[idx] = data.deudor;
        mostrarDetalleDeudor(deudor.id);
        return;
      }
    } catch (err) {
      console.error('Error rechazando pago en API:', err);
    }
  }

  pago.estado = 'rechazado';
  pago.fechaRechazado = Date.now();
  deudor.updatedAt = Date.now();
  mostrarDetalleDeudor(deudor.id);
  await guardarEnNube();
}

function renderizarDeudasIndividualesDeudor(deudor) {
  if (!debtorConceptsList) return;
  debtorConceptsList.innerHTML = '';

  if (deudor.conceptos.length === 0) {
    debtorConceptsList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #94a3b8; background: var(--surface); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        No hay deudas registradas para ${escaparHTML(deudor.nombre)}.<br>
        Tocá <strong>+ Cargar nueva deuda</strong> arriba para abrirle su primer concepto.
      </div>
    `;
    return;
  }

  deudor.conceptos.forEach((c, idx) => {
    // Si es legacy pago
    if (c.tipo === 'pago') {
      const cardP = document.createElement('div');
      cardP.className = 'debt-concept-card paid';
      cardP.innerHTML = `
        <div class="debt-concept-header">
          <div>
            <span class="debt-status-tag paid">🟢 Pago / Entrega</span>
            <span class="debt-concept-title" style="margin-left: 8px;">${escaparHTML(c.concepto)}</span>
          </div>
          <div style="font-weight: 700; color: #86efac;">-${formatearPesos(c.monto)}</div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:#94a3b8;">
          <span>Fecha: ${escaparHTML(c.fecha || '')}</span>
          <button type="button" class="btn-del-item-icon" title="Eliminar este movimiento">🗑️</button>
        </div>
      `;
      const btnDelP = cardP.querySelector('.btn-del-item-icon');
      if (btnDelP) {
        btnDelP.onclick = async () => {
          if (confirm(`¿Eliminar este pago de ${formatearPesos(c.monto)}?`)) {
            deudor.conceptos = deudor.conceptos.filter(x => x.id !== c.id);
            deudor.updatedAt = Date.now();
            mostrarDetalleDeudor(deudor.id);
            await guardarEnNube();
          }
        };
      }
      debtorConceptsList.appendChild(cardP);
      return;
    }

    // Deuda formal
    const montoTotal = Number(c.monto) || 0;
    const pagos = Array.isArray(c.pagos) ? c.pagos : [];
    const sumPagos = pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);
    const saldoRestante = Math.max(0, montoTotal - sumPagos);
    const estaAlDia = c.pagado || (saldoRestante === 0 && montoTotal > 0);

    const card = document.createElement('div');
    card.className = `debt-concept-card ${estaAlDia ? 'paid' : ''}`;

    const tagStatus = estaAlDia
      ? `<span class="debt-status-tag paid">✓ Pagada al 100%</span>`
      : `<span class="debt-status-tag pending">🔴 Saldo pendiente: ${formatearPesos(saldoRestante)}</span>`;

    // Historial de pagos si existen
    let historialPagosHtml = '';
    if (pagos.length > 0) {
      historialPagosHtml = `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08); font-size: 0.85rem;">
          <div style="color: #94a3b8; font-weight: 600; margin-bottom: 4px;">Historial de pagos (${pagos.length}):</div>
          ${pagos.map(p => `
            <div style="display: flex; justify-content: space-between; color: #86efac; padding: 2px 0;">
              <span>• ${escaparHTML(p.nota || 'Abono / Cuota')} (${escaparHTML(p.fecha || '')})</span>
              <strong>-${formatearPesos(p.monto)}</strong>
            </div>
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="debt-concept-header">
        <div>
          <div class="debt-concept-title">${escaparHTML(c.concepto)}</div>
          <div style="margin-top: 4px;">${tagStatus}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.85rem; color: #94a3b8;">Total original:</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #fbbf24;">${formatearPesos(montoTotal)}</div>
        </div>
      </div>

      <div class="debt-concept-stats">
        <span>Abonado: <strong>${formatearPesos(sumPagos)}</strong></span>
        <span>Resta pagar: <strong style="color: ${estaAlDia ? '#86efac' : '#f87171'};">${formatearPesos(saldoRestante)}</strong></span>
        <span>Fecha: <strong>${escaparHTML(c.fecha || '')}</strong></span>
      </div>

      ${historialPagosHtml}

      <div class="debt-concept-actions">
        <div>
          ${!estaAlDia ? `
            <button type="button" class="btn-pay-concept" data-concept-id="${c.id}">
              💵 Cargar pago / cuota
            </button>
          ` : `
            <span style="color: #86efac; font-weight: 700; font-size: 0.88rem;">🎉 Deuda cancelada</span>
          `}
        </div>
        <button type="button" class="btn-del-item-icon btn-del-concept" data-concept-id="${c.id}" title="Eliminar esta deuda">
          🗑️
        </button>
      </div>
    `;

    // Handler botón "💵 Cargar pago / cuota" en esta deuda específica
    const btnPay = card.querySelector('.btn-pay-concept');
    if (btnPay) {
      btnPay.onclick = () => {
        abrirModalPagoConcepto(deudor, c, saldoRestante);
      };
    }

    // Handler botón eliminar deuda
    const btnDel = card.querySelector('.btn-del-concept');
    if (btnDel) {
      btnDel.onclick = async () => {
        if (confirm(`¿Querés eliminar la deuda "${c.concepto}" (${formatearPesos(montoTotal)}) de ${deudor.nombre}?`)) {
          deudor.conceptos = deudor.conceptos.filter(x => x.id !== c.id);
          deudor.updatedAt = Date.now();
          mostrarDetalleDeudor(deudor.id);
          await guardarEnNube();
        }
      };
    }

    debtorConceptsList.appendChild(card);
  });
}

function abrirModalPagoConcepto(deudor, concepto, saldoRestante) {
  idConceptoParaPagar = concepto.id;
  if (!conceptPaymentModalBox) return;

  conceptPaymentModalBox.classList.remove('hidden');
  if (debtMovementFormBox) debtMovementFormBox.classList.add('hidden');

  if (conceptPaymentModalSub) {
    conceptPaymentModalSub.textContent = `Abonar a la deuda de ${deudor.nombre} (Saldo restante: ${formatearPesos(saldoRestante)}):`;
  }
  if (inputConceptPaymentName) {
    inputConceptPaymentName.value = `${concepto.concepto} (Resta ${formatearPesos(saldoRestante)})`;
  }
  if (inputConceptPaymentAmount) {
    inputConceptPaymentAmount.value = saldoRestante > 0 ? saldoRestante : '';
    inputConceptPaymentAmount.focus();
  }
  if (inputConceptPaymentNote) {
    inputConceptPaymentNote.value = '';
  }
}

async function guardarPagoConcepto() {
  if (!idDeudorActivo || !idConceptoParaPagar) return;
  const deudor = deudores.find(d => d.id === idDeudorActivo);
  if (!deudor) return;
  const concepto = (deudor.conceptos || []).find(c => c.id === idConceptoParaPagar);
  if (!concepto) return;

  const monto = parseFloat(inputConceptPaymentAmount && inputConceptPaymentAmount.value ? inputConceptPaymentAmount.value : '0') || 0;
  if (monto <= 0) {
    if (inputConceptPaymentAmount) inputConceptPaymentAmount.focus();
    return;
  }

  const nota = inputConceptPaymentNote ? inputConceptPaymentNote.value.trim() : '';

  if (!Array.isArray(concepto.pagos)) concepto.pagos = [];
  concepto.pagos.push({
    id: 'pago_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    monto: monto,
    nota: nota || 'Pago / cuota',
    fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    creadoEl: Date.now()
  });

  const sumP = concepto.pagos.reduce((a, x) => a + (Number(x.monto) || 0), 0);
  if (sumP >= (Number(concepto.monto) || 0)) {
    concepto.pagado = true;
  }

  deudor.updatedAt = Date.now();
  if (conceptPaymentModalBox) conceptPaymentModalBox.classList.add('hidden');
  mostrarDetalleDeudor(deudor.id);
  await guardarEnNube();
}

if (btnCancelConceptPayment) {
  btnCancelConceptPayment.addEventListener('click', () => {
    if (conceptPaymentModalBox) conceptPaymentModalBox.classList.add('hidden');
  });
}
if (btnSaveConceptPayment) {
  btnSaveConceptPayment.addEventListener('click', guardarPagoConcepto);
}

function volverAListaDeudores() {
  idDeudorActivo = null;
  idConceptoParaPagar = null;
  if (debtMovementFormBox) debtMovementFormBox.classList.add('hidden');
  if (conceptPaymentModalBox) conceptPaymentModalBox.classList.add('hidden');
  if (debtorShareModal) debtorShareModal.classList.add('hidden');
  renderizarDeudores();
}

function abrirFormularioNuevaDeuda() {
  if (!debtMovementFormBox) return;
  debtMovementFormBox.classList.remove('hidden');
  if (conceptPaymentModalBox) conceptPaymentModalBox.classList.add('hidden');
  if (inputDebtConcept) {
    inputDebtConcept.value = '';
    inputDebtConcept.focus();
  }
  if (inputDebtAmount) inputDebtAmount.value = '';
}

async function guardarNuevaDeuda() {
  if (!idDeudorActivo) return;
  const deudor = deudores.find(d => d.id === idDeudorActivo);
  if (!deudor) return;

  const concepto = inputDebtConcept ? inputDebtConcept.value.trim() : '';
  if (!concepto) {
    alert('Ingresá el concepto o motivo de la deuda');
    if (inputDebtConcept) inputDebtConcept.focus();
    return;
  }

  const montoVal = parseFloat(inputDebtAmount && inputDebtAmount.value ? inputDebtAmount.value : '0') || 0;
  if (montoVal <= 0) {
    alert('Ingresá un monto válido mayor a 0');
    if (inputDebtAmount) inputDebtAmount.focus();
    return;
  }

  const cuotasVal = parseInt(inputDebtInstallments && inputDebtInstallments.value ? inputDebtInstallments.value : '1') || 1;

  if (btnSaveDebtMovement) {
    btnSaveDebtMovement.disabled = true;
    btnSaveDebtMovement.textContent = 'Guardando...';
  }

  if (usuarioActivo) {
    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'agregar_concepto_deudor',
          usuarioId: usuarioActivo.id,
          password: usuarioActivo.password,
          deudorId: deudor.id,
          concepto: concepto,
          monto: montoVal,
          cuotasTotal: cuotasVal
        })
      });
      const data = await res.json();
      if (res.ok && data.deudor) {
        const idx = deudores.findIndex(d => d.id === deudor.id);
        if (idx !== -1) deudores[idx] = data.deudor;
        if (debtMovementFormBox) debtMovementFormBox.classList.add('hidden');
        if (inputDebtConcept) inputDebtConcept.value = '';
        if (inputDebtAmount) inputDebtAmount.value = '';
        if (inputDebtInstallments) inputDebtInstallments.value = '1';
        mostrarDetalleDeudor(deudor.id, false);
        if (data.vinculadoAUsuario || deudor.usuarioId) {
          alert(`✓ ¡Deuda agregada y sincronizada directamente en la sección "Yo debo" del usuario registrado (${cuotasVal} cuotas)!`);
        } else {
          alert(`✓ ¡Deuda agregada exitosamente!`);
        }
        return;
      }
    } catch (err) {
      console.error('Error al agregar concepto deudor:', err);
    } finally {
      if (btnSaveDebtMovement) {
        btnSaveDebtMovement.disabled = false;
        btnSaveDebtMovement.textContent = 'Guardar';
      }
    }
  }

  // Fallback local
  if (!Array.isArray(deudor.conceptos)) deudor.conceptos = [];
  deudor.conceptos.push({
    id: 'deuda_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    tipo: 'deuda',
    concepto: concepto,
    monto: montoVal,
    cuotasTotal: cuotasVal,
    valorCuota: Math.round((montoVal / cuotasVal) * 100) / 100,
    pagado: false,
    pagos: [],
    fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    creadoEl: Date.now()
  });

  deudor.updatedAt = Date.now();
  if (debtMovementFormBox) debtMovementFormBox.classList.add('hidden');
  if (inputDebtConcept) inputDebtConcept.value = '';
  if (inputDebtAmount) inputDebtAmount.value = '';
  if (inputDebtInstallments) inputDebtInstallments.value = '1';
  mostrarDetalleDeudor(deudor.id);
  await guardarEnNube();
}

async function crearNuevoDeudor() {
  const nombre = inputNewDebtorName ? inputNewDebtorName.value.trim() : '';
  const rawDni = inputNewDebtorDni ? inputNewDebtorDni.value.trim() : '';
  let dniLimpio = rawDni.replace(/\D/g, '');

  if (!nombre) {
    alert('Ingresá el nombre o DNI de la persona que te debe');
    if (inputNewDebtorName) inputNewDebtorName.focus();
    return;
  }

  // Si no puso DNI en el campo DNI, verificar si el nombre es un DNI o contiene un DNI
  if (!dniLimpio) {
    const digitosNombre = nombre.replace(/\D/g, '');
    if (digitosNombre.length >= 7 && digitosNombre.length <= 9) {
      dniLimpio = digitosNombre;
    }
  }

  // Buscar en listaUsuariosPublica si coincide con algún usuario registrado
  const usuarioVinculadoLocal = (listaUsuariosPublica || []).find(u => {
    if (!u) return false;
    const uDni = String(u.dni || '').replace(/\D/g, '');
    if (dniLimpio && uDni && uDni === dniLimpio) return true;
    if (dniLimpio && u.id.startsWith(dniLimpio)) return true;
    if (String(u.nombre || '').trim().toLowerCase() === nombre.toLowerCase()) return true;
    return false;
  });

  if (usuarioVinculadoLocal && !dniLimpio && usuarioVinculadoLocal.dni) {
    dniLimpio = String(usuarioVinculadoLocal.dni).replace(/\D/g, '');
  }

  if (btnSaveNewDebtor) {
    btnSaveNewDebtor.disabled = true;
    btnSaveNewDebtor.textContent = 'Guardando...';
  }

  if (usuarioActivo) {
    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'crear_deudor_con_dni',
          usuarioId: usuarioActivo.id,
          password: usuarioActivo.password,
          nombre: nombre,
          dni: dniLimpio
        })
      });
      const data = await res.json();
      if (res.ok && data.deudor) {
        deudores.push(data.deudor);
        idDeudorActivo = data.deudor.id;
        if (inputNewDebtorName) inputNewDebtorName.value = '';
        if (inputNewDebtorDni) inputNewDebtorDni.value = '';
        if (createDebtorBox) createDebtorBox.classList.add('hidden');
        mostrarDetalleDeudor(data.deudor.id, true);
        if (data.usuarioVinculado || usuarioVinculadoLocal) {
          const uv = data.usuarioVinculado || usuarioVinculadoLocal;
          alert(`✓ ¡Deudor "${nombre}" creado y vinculado con el usuario registrado (${uv.nombre}, DNI ${dniLimpio})! Las deudas que le cargues se sincronizarán directamente en su sección "Yo debo".`);
        }
        return;
      }
    } catch (err) {
      console.error('Error al crear deudor con DNI:', err);
    } finally {
      if (btnSaveNewDebtor) {
        btnSaveNewDebtor.disabled = false;
        btnSaveNewDebtor.textContent = 'Guardar';
      }
    }
  }

  const nuevo = {
    id: 'deudor-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    nombre: nombre,
    dni: dniLimpio || null,
    usuarioId: usuarioVinculadoLocal ? usuarioVinculadoLocal.id : null,
    conceptos: [],
    pagosPendientes: [],
    creadoEl: Date.now(),
    updatedAt: Date.now()
  };
  deudores.push(nuevo);
  idDeudorActivo = nuevo.id;
  if (inputNewDebtorName) inputNewDebtorName.value = '';
  if (inputNewDebtorDni) inputNewDebtorDni.value = '';
  if (createDebtorBox) createDebtorBox.classList.add('hidden');

  mostrarDetalleDeudor(nuevo.id, true);
  await guardarEnNube();
}

async function eliminarDeudorActivo() {
  const deudorActivo = deudores.find(d => d.id === idDeudorActivo);
  if (!deudorActivo) return;
  if (confirm(`¿Querés eliminar al deudor "${deudorActivo.nombre}" y todo su historial de deudas?`)) {
    deudores = deudores.filter(d => d.id !== idDeudorActivo);
    idDeudorActivo = null;
    volverAListaDeudores();
    await guardarEnNube();
  }
}

if (btnBackToDebtorsList) btnBackToDebtorsList.addEventListener('click', volverAListaDeudores);
if (btnShowAddDebt) btnShowAddDebt.addEventListener('click', abrirFormularioNuevaDeuda);
if (btnCancelDebtMovement) btnCancelDebtMovement.addEventListener('click', () => {
  if (debtMovementFormBox) debtMovementFormBox.classList.add('hidden');
});
if (btnSaveDebtMovement) btnSaveDebtMovement.addEventListener('click', guardarNuevaDeuda);

if (btnCreateDebtorToggle) {
  btnCreateDebtorToggle.addEventListener('click', () => {
    if (createDebtorBox) {
      createDebtorBox.classList.toggle('hidden');
      if (!createDebtorBox.classList.contains('hidden') && inputNewDebtorName) inputNewDebtorName.focus();
    }
  });
}
if (btnCancelCreateDebtor) {
  btnCancelCreateDebtor.addEventListener('click', () => {
    if (createDebtorBox) createDebtorBox.classList.add('hidden');
  });
}
if (btnSaveNewDebtor) btnSaveNewDebtor.addEventListener('click', crearNuevoDeudor);

if (inputNewDebtorName) {
  inputNewDebtorName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputNewDebtorDni) inputNewDebtorDni.focus();
      else crearNuevoDeudor();
    }
  });
}
if (inputNewDebtorDni) {
  inputNewDebtorDni.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      crearNuevoDeudor();
    }
  });
}
if (inputDebtConcept) {
  inputDebtConcept.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputDebtAmount) inputDebtAmount.focus();
    }
  });
}
if (inputDebtAmount) {
  inputDebtAmount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      guardarNuevaDeuda();
    }
  });
}
if (btnDeleteActiveDebtor) btnDeleteActiveDebtor.addEventListener('click', eliminarDeudorActivo);

// Compartir Estado de Cuenta
if (btnDebtorShareLink) {
  btnDebtorShareLink.addEventListener('click', () => {
    if (debtorShareModal) debtorShareModal.classList.toggle('hidden');
  });
}
if (btnCopyDebtorShare) {
  btnCopyDebtorShare.addEventListener('click', () => {
    if (!inputDebtorShareUrl) return;
    inputDebtorShareUrl.select();
    navigator.clipboard.writeText(inputDebtorShareUrl.value).then(() => {
      if (debtorShareCopiedMsg) {
        debtorShareCopiedMsg.classList.remove('hidden');
        setTimeout(() => debtorShareCopiedMsg.classList.add('hidden'), 3000);
      }
    });
  });
}
if (btnWhatsappDebtorShare) {
  btnWhatsappDebtorShare.addEventListener('click', () => {
    if (!inputDebtorShareUrl || !idDeudorActivo) return;
    const deudor = deudores.find(d => d.id === idDeudorActivo);
    const nombre = deudor ? deudor.nombre : 'amigo/a';
    const msg = `Hola ${nombre}, te comparto tu estado de cuenta actualizado para que puedas revisar tus saldos e informarme tus pagos:\n${inputDebtorShareUrl.value}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

// ------------------------------------------
// DEUDAS: "YO DEBO" (Deudas Propias con Cuotas y Recordatorio a las 09:00 hs)
// ------------------------------------------
const btnOpenAddMyDebt = document.getElementById('btn-open-add-my-debt');
const boxAddMyDebt = document.getElementById('box-add-my-debt');
const inputMyDebtConcept = document.getElementById('input-my-debt-concept');
const inputMyDebtCreditor = document.getElementById('input-my-debt-creditor');
const inputMyDebtTotal = document.getElementById('input-my-debt-total');
const inputMyDebtInstallments = document.getElementById('input-my-debt-installments');
const myDebtInstallmentPreview = document.getElementById('my-debt-installment-preview');
const inputMyDebtDueDate = document.getElementById('input-my-debt-due-date');
const myDebtReminderSelector = document.getElementById('my-debt-reminder-selector');
const btnCancelAddMyDebt = document.getElementById('btn-cancel-add-my-debt');
const btnSaveMyDebt = document.getElementById('btn-save-my-debt');

const myDebtsTotalAmount = document.getElementById('my-debts-total-amount');
const myDebtsCountSub = document.getElementById('my-debts-count-sub');
const myDebtsListContainer = document.getElementById('my-debts-list-container');
const noMyDebtsPlaceholder = document.getElementById('no-my-debts-placeholder');

const modalPayMyDebt = document.getElementById('modal-pay-my-debt');
const payMyDebtSub = document.getElementById('pay-my-debt-sub');
const inputPayMyDebtName = document.getElementById('input-pay-my-debt-name');
const inputPayMyDebtCreditor = document.getElementById('input-pay-my-debt-creditor');
const payMyDebtModeSelector = document.getElementById('pay-my-debt-mode-selector');
const btnPayModeCuota = document.getElementById('btn-pay-mode-cuota');
const btnPayModeParcial = document.getElementById('btn-pay-mode-parcial');
const inputPayMyDebtAmount = document.getElementById('input-pay-my-debt-amount');
const inputPayMyDebtNote = document.getElementById('input-pay-my-debt-note');
const payMyDebtAlertMsg = document.getElementById('pay-my-debt-alert-msg');
const btnCancelPayMyDebt = document.getElementById('btn-cancel-pay-my-debt');
const btnSubmitPayMyDebt = document.getElementById('btn-submit-pay-my-debt');
let miDeudaParaPagar = null;
let modoPagoMiDeuda = 'cuota';

function actualizarPreviewCuotaYoDebo() {
  const total = parseFloat(inputMyDebtTotal && inputMyDebtTotal.value ? inputMyDebtTotal.value : '0') || 0;
  const cuotas = parseInt(inputMyDebtInstallments && inputMyDebtInstallments.value ? inputMyDebtInstallments.value : '1') || 1;
  const valorCuota = total > 0 ? (total / cuotas) : 0;
  if (myDebtInstallmentPreview) {
    myDebtInstallmentPreview.textContent = cuotas > 1 ? `${cuotas} de ${formatearPesos(valorCuota)}` : formatearPesos(total);
  }
}

if (inputMyDebtTotal) inputMyDebtTotal.addEventListener('input', actualizarPreviewCuotaYoDebo);
if (inputMyDebtInstallments) inputMyDebtInstallments.addEventListener('change', actualizarPreviewCuotaYoDebo);

if (myDebtReminderSelector) {
  myDebtReminderSelector.querySelectorAll('.prio-option').forEach(btn => {
    btn.addEventListener('click', () => {
      myDebtReminderSelector.querySelectorAll('.prio-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      recordatorioYoDeboActivo = btn.getAttribute('data-reminder') || '1d';
    });
  });
}

if (btnOpenAddMyDebt) {
  btnOpenAddMyDebt.addEventListener('click', () => {
    if (boxAddMyDebt) {
      boxAddMyDebt.classList.toggle('hidden');
      if (!boxAddMyDebt.classList.contains('hidden')) {
        if (inputMyDebtConcept) inputMyDebtConcept.focus();
        if (inputMyDebtDueDate && !inputMyDebtDueDate.value) {
          const hoy = new Date();
          hoy.setDate(hoy.getDate() + 30);
          inputMyDebtDueDate.value = hoy.toISOString().split('T')[0];
        }
        actualizarPreviewCuotaYoDebo();
      }
    }
  });
}

if (btnCancelAddMyDebt) {
  btnCancelAddMyDebt.addEventListener('click', () => {
    if (boxAddMyDebt) boxAddMyDebt.classList.add('hidden');
  });
}

async function guardarDeudaPropia() {
  const concepto = inputMyDebtConcept ? inputMyDebtConcept.value.trim() : '';
  const acreedor = inputMyDebtCreditor ? inputMyDebtCreditor.value.trim() : '';
  const total = parseFloat(inputMyDebtTotal && inputMyDebtTotal.value ? inputMyDebtTotal.value : '0') || 0;
  const cuotas = parseInt(inputMyDebtInstallments && inputMyDebtInstallments.value ? inputMyDebtInstallments.value : '1') || 1;
  const fechaVenc = inputMyDebtDueDate ? inputMyDebtDueDate.value : '';

  if (!concepto) {
    if (inputMyDebtConcept) inputMyDebtConcept.focus();
    return;
  }
  if (!acreedor) {
    if (inputMyDebtCreditor) inputMyDebtCreditor.focus();
    return;
  }
  if (total <= 0) {
    if (inputMyDebtTotal) inputMyDebtTotal.focus();
    return;
  }

  const nueva = {
    id: 'yodebo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    concepto: concepto,
    acreedor: acreedor,
    montoTotal: total,
    cuotasTotal: cuotas,
    cuotasPagadas: 0,
    montoPagado: 0,
    fechaVencimiento: fechaVenc,
    hora: '09:00',
    recordatorio: recordatorioYoDeboActivo || '1d',
    pagos: [],
    pagado: false,
    creadoEl: Date.now()
  };

  if (!Array.isArray(yoDebo)) yoDebo = [];
  yoDebo.unshift(nueva);

  // Programar alarma recordatorio con base a las 09:00 hs
  programarRecordatorioYoDebo(nueva);

  if (boxAddMyDebt) boxAddMyDebt.classList.add('hidden');
  if (inputMyDebtConcept) inputMyDebtConcept.value = '';
  if (inputMyDebtCreditor) inputMyDebtCreditor.value = '';
  if (inputMyDebtTotal) inputMyDebtTotal.value = '';

  renderizarYoDebo();
  await guardarEnNube();
}

if (btnSaveMyDebt) btnSaveMyDebt.addEventListener('click', guardarDeudaPropia);

function programarRecordatorioYoDebo(deuda) {
  if (!deuda.fechaVencimiento || deuda.recordatorio === 'none') return;
  try {
    const [y, m, d] = deuda.fechaVencimiento.split('-').map(Number);
    if (!y || !m || !d) return;
    const baseMs = new Date(y, m - 1, d, 9, 0, 0, 0).getTime();
    let restaMs = 24 * 3600 * 1000;
    if (deuda.recordatorio === '2d') restaMs = 2 * 24 * 3600 * 1000;
    if (deuda.recordatorio === '12h') restaMs = 12 * 3600 * 1000;
    if (deuda.recordatorio === '6h') restaMs = 6 * 3600 * 1000;
    if (deuda.recordatorio === '3h') restaMs = 3 * 3600 * 1000;

    const horaDisparo = baseMs - restaMs;
    if (horaDisparo > Date.now()) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          tipo: 'PROGRAMAR_ALARMA',
          tiempoMs: horaDisparo,
          titulo: `⏰ Recordatorio de pago: ${deuda.concepto}`,
          cuerpo: `Vence el ${d}/${m} a las 09:00 hs. Tenés que pagarle a ${deuda.acreedor} (${formatearPesos(deuda.montoTotal - deuda.montoPagado)})`
        });
      }
    }
  } catch (err) {}
}

function renderizarYoDebo() {
  if (!Array.isArray(yoDebo)) yoDebo = [];

  let sumaTotalDebo = 0;
  let cantPendientes = 0;

  yoDebo.forEach(d => {
    const pendiente = Math.max(0, (Number(d.montoTotal) || 0) - (Number(d.montoPagado) || 0));
    sumaTotalDebo += pendiente;
    if (pendiente > 0) cantPendientes++;
  });

  if (myDebtsTotalAmount) myDebtsTotalAmount.textContent = formatearPesos(sumaTotalDebo);
  if (myDebtsCountSub) {
    myDebtsCountSub.textContent = cantPendientes === 1
      ? '1 deuda pendiente a pagar'
      : `${cantPendientes} deudas pendientes a pagar`;
  }

  if (yoDebo.length === 0) {
    if (noMyDebtsPlaceholder) noMyDebtsPlaceholder.classList.remove('hidden');
    if (myDebtsListContainer) myDebtsListContainer.innerHTML = '';
    return;
  }

  if (noMyDebtsPlaceholder) noMyDebtsPlaceholder.classList.add('hidden');

  if (myDebtsListContainer) {
    myDebtsListContainer.innerHTML = '';
    yoDebo.forEach(d => {
      const total = Number(d.montoTotal) || 0;
      const pagado = Number(d.montoPagado) || 0;
      const pendiente = Math.max(0, total - pagado);
      const estaAlDia = d.pagado || (pendiente === 0 && total > 0);
      const tienePendiente = Array.isArray(d.pagosPendientes) && d.pagosPendientes.some(p => p.estado === 'pendiente');

      const card = document.createElement('div');
      card.className = `my-debt-card ${estaAlDia ? 'paid' : ''} ${tienePendiente ? 'has-pending-payment' : ''}`;
      card.style.cursor = estaAlDia ? 'default' : 'pointer';

      const cuotasTotal = Number(d.cuotasTotal) || 1;
      const cuotasPagadas = Number(d.cuotasPagadas) || 0;
      const valorCuota = d.valorCuota || (total / cuotasTotal);

      let cuotasInfo = cuotasTotal > 1
        ? `Cuotas: <strong>${cuotasPagadas} de ${cuotasTotal}</strong> pagadas (${formatearPesos(valorCuota)}/cuota)`
        : `Pago único total`;

      let fechaHtml = '';
      if (d.fechaVencimiento) {
        const [y, m, dia] = d.fechaVencimiento.split('-');
        fechaHtml = `<span>Vencimiento: <strong>${dia}/${m}/${y} a las 09:00 hs</strong></span>`;
      }

      let reminderLabel = 'Sin recordatorio';
      if (d.recordatorio === '2d') reminderLabel = '2 días antes';
      if (d.recordatorio === '1d') reminderLabel = '1 día antes';
      if (d.recordatorio === '12h') reminderLabel = '12 hs antes';
      if (d.recordatorio === '6h') reminderLabel = '6 hs antes';
      if (d.recordatorio === '3h') reminderLabel = '3 hs antes';

      const badgeAlarm = d.recordatorio && d.recordatorio !== 'none'
        ? `<span class="my-debt-badge-alarm">⏰ Alarma: ${reminderLabel} a las 09:00</span>`
        : '';

      const alertaPendienteHtml = tienePendiente
        ? `<div class="pending-payment-alert-badge">⏳ Tenés un pago informado pendiente de revisión del acreedor</div>`
        : '';

      card.innerHTML = `
        <div class="my-debt-header">
          <div>
            <div class="my-debt-title">${escaparHTML(d.concepto)}</div>
            <div class="my-debt-creditor">Acreedor: <strong>${escaparHTML(d.acreedor)}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: #fca5a5;">Total deuda:</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #fecaca;">${formatearPesos(total)}</div>
          </div>
        </div>

        <div style="display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.9rem; color: #cbd5e1;">
          <div>${cuotasInfo}</div>
          <div>Pagado: <strong>${formatearPesos(pagado)}</strong></div>
          <div>Resta: <strong style="color: ${estaAlDia ? '#86efac' : '#f87171'}; font-weight: 800;">${formatearPesos(pendiente)}</strong></div>
        </div>

        ${alertaPendienteHtml}

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.85rem; color: #94a3b8;">
          ${fechaHtml}
          ${badgeAlarm}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 4px;">
          <div>
            ${!estaAlDia ? `
              <button type="button" class="btn-pay-concept btn-pay-my-debt" data-id="${d.id}">
                💵 Pagar cuota / abono (${formatearPesos(cuotasTotal > 1 ? valorCuota : pendiente)})
              </button>
            ` : `
              <span style="color: #86efac; font-weight: 700; font-size: 0.88rem;">🎉 Pagado al 100%</span>
            `}
          </div>
          <button type="button" class="btn-del-item-icon btn-del-my-debt" data-id="${d.id}" title="Eliminar esta deuda">
            🗑️
          </button>
        </div>
      `;

      card.onclick = (e) => {
        if (e.target.closest('.btn-del-my-debt')) return;
        if (!estaAlDia) {
          abrirModalPagoMiDeuda(d);
        }
      };

      const btnPay = card.querySelector('.btn-pay-my-debt');
      if (btnPay) {
        btnPay.onclick = (e) => {
          e.stopPropagation();
          abrirModalPagoMiDeuda(d);
        };
      }

      const btnDel = card.querySelector('.btn-del-my-debt');
      if (btnDel) {
        btnDel.onclick = async (e) => {
          e.stopPropagation();
          if (confirm(`¿Querés eliminar la deuda "${d.concepto}" de ${formatearPesos(total)}?`)) {
            yoDebo = yoDebo.filter(x => x.id !== d.id);
            renderizarYoDebo();
            await guardarEnNube();
          }
        };
      }

      myDebtsListContainer.appendChild(card);
    });
  }
}

function abrirModalPagoMiDeuda(deuda) {
  miDeudaParaPagar = deuda;
  if (!modalPayMyDebt) return;
  modalPayMyDebt.classList.remove('hidden');

  const total = Number(deuda.montoTotal) || 0;
  const pagado = Number(deuda.montoPagado) || 0;
  const pendiente = Math.max(0, total - pagado);
  const cuotasTotal = Number(deuda.cuotasTotal) || 1;
  const valorCuota = deuda.valorCuota || (cuotasTotal > 1 ? (total / cuotasTotal) : total);

  if (inputPayMyDebtName) inputPayMyDebtName.value = deuda.concepto;
  if (inputPayMyDebtCreditor) inputPayMyDebtCreditor.value = deuda.acreedor;

  modoPagoMiDeuda = 'cuota';
  if (btnPayModeCuota) btnPayModeCuota.classList.add('active');
  if (btnPayModeParcial) btnPayModeParcial.classList.remove('active');

  const montoCuotaSugerido = Math.min(pendiente, valorCuota > 0 ? valorCuota : pendiente);
  if (inputPayMyDebtAmount) {
    inputPayMyDebtAmount.value = montoCuotaSugerido;
  }
  if (inputPayMyDebtNote) inputPayMyDebtNote.value = '';

  const tienePendiente = Array.isArray(deuda.pagosPendientes) && deuda.pagosPendientes.some(p => p.estado === 'pendiente');
  if (payMyDebtAlertMsg) {
    if (tienePendiente) {
      payMyDebtAlertMsg.textContent = '⏳ Ya informaste un pago sobre esta deuda que está pendiente de aprobación por el acreedor.';
      payMyDebtAlertMsg.classList.remove('hidden');
    } else if (deuda.vinculadoAcreedorId) {
      payMyDebtAlertMsg.textContent = `🔔 Al enviar este pago, le llegará una notificación a ${deuda.acreedor} en su app para aceptarlo. Una vez que lo acepte, se descontará automáticamente de tu saldo.`;
      payMyDebtAlertMsg.classList.remove('hidden');
    } else {
      payMyDebtAlertMsg.textContent = `Este pago se registrará de inmediato sobre tu deuda en tu agenda personal.`;
      payMyDebtAlertMsg.classList.remove('hidden');
    }
  }

  modalPayMyDebt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

if (btnPayModeCuota) {
  btnPayModeCuota.addEventListener('click', () => {
    modoPagoMiDeuda = 'cuota';
    btnPayModeCuota.classList.add('active');
    if (btnPayModeParcial) btnPayModeParcial.classList.remove('active');
    if (miDeudaParaPagar && inputPayMyDebtAmount) {
      const total = Number(miDeudaParaPagar.montoTotal) || 0;
      const pagado = Number(miDeudaParaPagar.montoPagado) || 0;
      const pendiente = Math.max(0, total - pagado);
      const cuotasTotal = Number(miDeudaParaPagar.cuotasTotal) || 1;
      const valorCuota = miDeudaParaPagar.valorCuota || (cuotasTotal > 1 ? (total / cuotasTotal) : total);
      inputPayMyDebtAmount.value = Math.min(pendiente, valorCuota > 0 ? valorCuota : pendiente);
    }
  });
}

if (btnPayModeParcial) {
  btnPayModeParcial.addEventListener('click', () => {
    modoPagoMiDeuda = 'parcial';
    btnPayModeParcial.classList.add('active');
    if (btnPayModeCuota) btnPayModeCuota.classList.remove('active');
    if (inputPayMyDebtAmount) {
      inputPayMyDebtAmount.focus();
    }
  });
}

if (btnCancelPayMyDebt) {
  btnCancelPayMyDebt.addEventListener('click', () => {
    if (modalPayMyDebt) modalPayMyDebt.classList.add('hidden');
    miDeudaParaPagar = null;
  });
}

if (btnSubmitPayMyDebt) {
  btnSubmitPayMyDebt.addEventListener('click', async () => {
    if (!miDeudaParaPagar) return;
    const monto = parseFloat(inputPayMyDebtAmount && inputPayMyDebtAmount.value ? inputPayMyDebtAmount.value : '0') || 0;
    if (monto <= 0) {
      if (inputPayMyDebtAmount) inputPayMyDebtAmount.focus();
      return;
    }

    const nota = inputPayMyDebtNote ? inputPayMyDebtNote.value.trim() : '';

    btnSubmitPayMyDebt.disabled = true;
    btnSubmitPayMyDebt.textContent = 'Enviando...';

    try {
      if (miDeudaParaPagar.vinculadoAcreedorId && usuarioActivo) {
        const res = await fetch(API_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'informar_pago_deudor_app',
            usuarioId: usuarioActivo.id,
            password: usuarioActivo.password,
            yoDeboId: miDeudaParaPagar.id,
            monto: monto,
            tipoPago: modoPagoMiDeuda,
            nota: nota
          })
        });
        const data = await res.json();
        if (res.ok && data.yoDebo) {
          yoDebo = data.yoDebo;
          if (modalPayMyDebt) modalPayMyDebt.classList.add('hidden');
          miDeudaParaPagar = null;
          renderizarYoDebo();
          alert(`✓ ¡Pago de ${formatearPesos(monto)} enviado! Se le notificó a ${data.acreedor || 'tu acreedor'} para su aceptación. Te saldrá como "Pendiente" hasta que sea aprobado.`);
          return;
        }
      }

      // Pago local directo si no está vinculado a usuario de la app
      miDeudaParaPagar.montoPagado = (Number(miDeudaParaPagar.montoPagado) || 0) + monto;
      const cuotasTotal = Number(miDeudaParaPagar.cuotasTotal) || 1;
      if (cuotasTotal > 1 && miDeudaParaPagar.cuotasPagadas < cuotasTotal) {
        miDeudaParaPagar.cuotasPagadas = (Number(miDeudaParaPagar.cuotasPagadas) || 0) + 1;
      }
      if (miDeudaParaPagar.montoPagado >= (Number(miDeudaParaPagar.montoTotal) || 0)) {
        miDeudaParaPagar.pagado = true;
      }
      if (modalPayMyDebt) modalPayMyDebt.classList.add('hidden');
      miDeudaParaPagar = null;
      renderizarYoDebo();
      await guardarEnNube();
      alert(`✓ ¡Pago de ${formatearPesos(monto)} registrado exitosamente!`);
    } catch (err) {
      console.error(err);
      alert('Error de conexión al enviar el pago.');
    } finally {
      if (btnSubmitPayMyDebt) {
        btnSubmitPayMyDebt.disabled = false;
        btnSubmitPayMyDebt.textContent = 'Enviar pago';
      }
    }
  });
}

// ------------------------------------------
// ESTADO DE CUENTA PÚBLICO (PARA EL DEUDOR)
// ------------------------------------------
const viewPublicStatement = document.getElementById('view-public-statement');
const statementCreditorSub = document.getElementById('statement-creditor-sub');
const statementDebtorName = document.getElementById('statement-debtor-name');
const statementTotalAmount = document.getElementById('statement-total-amount');
const statementDateBadge = document.getElementById('statement-date-badge');
const btnStatementOpenPay = document.getElementById('btn-statement-open-pay');
const statementPayFormBox = document.getElementById('statement-pay-form-box');
const selectStatementConcept = document.getElementById('select-statement-concept');
const inputStatementAmount = document.getElementById('input-statement-amount');
const inputStatementNote = document.getElementById('input-statement-note');
const btnCancelStatementPay = document.getElementById('btn-cancel-statement-pay');
const btnSendStatementPay = document.getElementById('btn-send-statement-pay');
const statementPaySuccessMsg = document.getElementById('statement-pay-success-msg');
const statementConceptsList = document.getElementById('statement-concepts-list');
const statementPendingListWrap = document.getElementById('statement-pending-list-wrap');
const statementPendingList = document.getElementById('statement-pending-list');
const statementLinkAgendaBanner = document.getElementById('statement-link-agenda-banner');
const btnStatementLinkToMyDebts = document.getElementById('btn-statement-link-to-my-debts');
const statementLinkedSuccessMsg = document.getElementById('statement-linked-success-msg');

const statementJoinAppBanner = document.getElementById('statement-join-app-banner');
const btnStatementOpenJoin = document.getElementById('btn-statement-open-join');
const statementJoinFormBox = document.getElementById('statement-join-form-box');
const inputStatementRegName = document.getElementById('input-statement-reg-name');
const inputStatementRegDni = document.getElementById('input-statement-reg-dni');
const inputStatementRegPass = document.getElementById('input-statement-reg-pass');
const statementJoinError = document.getElementById('statement-join-error');
const btnStatementSubmitJoin = document.getElementById('btn-statement-submit-join');

let estadoCuentaDataActiva = null;

async function inicializarEstadoCuentaPublico() {
  const urlParams = new URLSearchParams(window.location.search);
  const estadoCuentaId = urlParams.get('estado_cuenta');
  const ownerId = urlParams.get('owner') || 'alejandro';

  if (!estadoCuentaId) return false;

  // Ocultar todas las demás vistas principales
  [viewHome, viewTasks, viewAgenda, viewWallet, viewExtras, viewExternal].forEach(v => {
    if (v) v.classList.add('hidden');
  });
  if (viewPublicStatement) viewPublicStatement.classList.remove('hidden');
  if (btnHome) btnHome.classList.add('hidden');

  if (statementDateBadge) {
    statementDateBadge.textContent = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'obtener_estado_cuenta',
        propietarioId: ownerId,
        deudorId: estadoCuentaId
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      alert(data.error || 'No se encontró el estado de cuenta.');
      return true;
    }

    estadoCuentaDataActiva = data;
    renderizarVistaPublicaEstadoCuenta(data, ownerId);
  } catch (err) {
    console.error(err);
  }

  return true;
}

function renderizarVistaPublicaEstadoCuenta(data, ownerId) {
  const { deudor, acreedorNombre } = data;
  if (statementCreditorSub) statementCreditorSub.textContent = `Detalle de tu saldo y conceptos con ${acreedorNombre || 'Alejandro'}`;
  if (statementDebtorName) statementDebtorName.textContent = `👤 Deudor: ${deudor.nombre}`;

  // Calcular saldo total
  let totalDeuda = 0;
  let totalPagado = 0;
  (deudor.conceptos || []).forEach(c => {
    const monto = Number(c.monto) || 0;
    if (!c.tipo || c.tipo === 'deuda') {
      totalDeuda += monto;
      const sumP = (c.pagos || []).reduce((a, x) => a + (Number(x.monto) || 0), 0);
      totalPagado += sumP;
      if (c.pagado && sumP === 0) totalPagado += monto;
    } else if (c.tipo === 'pago') {
      totalPagado += monto;
    }
  });

  const saldoPendiente = Math.max(0, totalDeuda - totalPagado);
  if (statementTotalAmount) statementTotalAmount.textContent = formatearPesos(saldoPendiente);

  // Selector de conceptos para imputar el pago
  if (selectStatementConcept) {
    selectStatementConcept.innerHTML = '';
    const optGeneral = document.createElement('option');
    optGeneral.value = '';
    optGeneral.textContent = `Abono general / a distribuir (${formatearPesos(saldoPendiente)} pendiente)`;
    selectStatementConcept.appendChild(optGeneral);

    (deudor.conceptos || []).filter(c => !c.tipo || c.tipo === 'deuda').forEach(c => {
      const sumP = (c.pagos || []).reduce((a, x) => a + (Number(x.monto) || 0), 0);
      const rest = Math.max(0, (Number(c.monto) || 0) - sumP);
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.concepto} - Resta pagar: ${formatearPesos(rest)}`;
      selectStatementConcept.appendChild(opt);
    });
  }

  // Si el visitante tiene usuario activo en la app, ofrecer vincular a "Yo debo"
  if (statementLinkAgendaBanner) {
    if (usuarioActivo && usuarioActivo.id !== ownerId) {
      statementLinkAgendaBanner.classList.remove('hidden');
      if (btnStatementLinkToMyDebts) {
        btnStatementLinkToMyDebts.onclick = async () => {
          const yaExiste = (yoDebo || []).some(x => x.concepto.includes(deudor.nombre) || x.acreedor.includes(acreedorNombre));
          if (yaExiste && !confirm('Ya tenés una deuda registrada con este acreedor. ¿Deseás agregarla igualmente?')) return;

          const nuevaPropia = {
            id: 'yodebo_' + Date.now(),
            concepto: `Deuda con ${acreedorNombre}`,
            acreedor: acreedorNombre,
            montoTotal: saldoPendiente,
            cuotasTotal: 1,
            cuotasPagadas: 0,
            montoPagado: 0,
            fechaVencimiento: new Date().toISOString().split('T')[0],
            hora: '09:00',
            recordatorio: '1d',
            pagos: [],
            creadoEl: Date.now()
          };

          if (!Array.isArray(yoDebo)) yoDebo = [];
          yoDebo.unshift(nuevaPropia);
          programarRecordatorioYoDebo(nuevaPropia);
          await guardarEnNube();

          if (statementLinkedSuccessMsg) statementLinkedSuccessMsg.classList.remove('hidden');
        };
      }
    } else {
      statementLinkAgendaBanner.classList.add('hidden');
    }
  }

  // Lista de deudas individuales
  if (statementConceptsList) {
    statementConceptsList.innerHTML = '';
    (deudor.conceptos || []).forEach(c => {
      if (c.tipo === 'pago') return;
      const total = Number(c.monto) || 0;
      const sumP = (c.pagos || []).reduce((a, x) => a + (Number(x.monto) || 0), 0);
      const rest = Math.max(0, total - sumP);
      const pagada = c.pagado || (rest === 0 && total > 0);

      const div = document.createElement('div');
      div.className = `debt-concept-card ${pagada ? 'paid' : ''}`;
      div.innerHTML = `
        <div class="debt-concept-header">
          <div>
            <div class="debt-concept-title">${escaparHTML(c.concepto)}</div>
            <div style="margin-top:4px;">
              ${pagada ? `<span class="debt-status-tag paid">✓ Pagada al 100%</span>` : `<span class="debt-status-tag pending">🔴 Saldo: ${formatearPesos(rest)}</span>`}
            </div>
          </div>
          <div style="font-weight: 800; color: #fbbf24; font-size: 1.1rem;">${formatearPesos(total)}</div>
        </div>
        <div style="font-size: 0.85rem; color: #94a3b8; display:flex; gap:12px;">
          <span>Abonado: <strong>${formatearPesos(sumP)}</strong></span>
          <span>Resta: <strong style="color: ${pagada ? '#86efac' : '#f87171'};">${formatearPesos(rest)}</strong></span>
        </div>
      `;
      statementConceptsList.appendChild(div);
    });
  }

  // Pagos pendientes de aprobación
  if (statementPendingListWrap && statementPendingList) {
    const pends = (deudor.pagosPendientes || []).filter(p => p.estado === 'pendiente');
    if (pends.length > 0) {
      statementPendingListWrap.classList.remove('hidden');
      statementPendingList.innerHTML = pends.map(p => `
        <div style="background: rgba(37,99,235,0.15); border: 1px solid #3b82f6; border-radius: 10px; padding: 10px 14px; font-size: 0.9rem;">
          <div style="color: #93c5fd; font-weight: 700;">💵 ${formatearPesos(p.monto)} — ${escaparHTML(p.conceptoNombre || 'Abono')}</div>
          <div style="color: #cbd5e1; font-size: 0.8rem;">Enviado para revisión del acreedor • ${p.nota ? `"${escaparHTML(p.nota)}"` : ''}</div>
        </div>
      `).join('');
    } else {
      statementPendingListWrap.classList.add('hidden');
    }
  }
}

if (btnStatementOpenPay) {
  btnStatementOpenPay.addEventListener('click', () => {
    if (statementPayFormBox) {
      statementPayFormBox.classList.toggle('hidden');
      if (!statementPayFormBox.classList.contains('hidden') && inputStatementAmount) inputStatementAmount.focus();
    }
  });
}

if (btnCancelStatementPay) {
  btnCancelStatementPay.addEventListener('click', () => {
    if (statementPayFormBox) statementPayFormBox.classList.add('hidden');
  });
}

if (btnSendStatementPay) {
  btnSendStatementPay.addEventListener('click', async () => {
    if (!estadoCuentaDataActiva) return;
    const monto = parseFloat(inputStatementAmount && inputStatementAmount.value ? inputStatementAmount.value : '0') || 0;
    if (monto <= 0) {
      if (inputStatementAmount) inputStatementAmount.focus();
      return;
    }
    const conceptoId = selectStatementConcept ? selectStatementConcept.value : '';
    const nota = inputStatementNote ? inputStatementNote.value.trim() : '';

    btnSendStatementPay.disabled = true;
    btnSendStatementPay.textContent = 'Enviando...';

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'informar_pago_deudor',
          propietarioId: urlParams.get('owner') || 'alejandro',
          deudorId: estadoCuentaDataActiva.deudor.id,
          conceptoId: conceptoId || null,
          monto: monto,
          nota: nota
        })
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        alert(resData.error || 'No se pudo registrar el pago informado.');
        return;
      }

      if (statementPaySuccessMsg) statementPaySuccessMsg.classList.remove('hidden');
      if (inputStatementAmount) inputStatementAmount.value = '';
      if (inputStatementNote) inputStatementNote.value = '';
      setTimeout(() => {
        if (statementPayFormBox) statementPayFormBox.classList.add('hidden');
        if (statementPaySuccessMsg) statementPaySuccessMsg.classList.add('hidden');
      }, 3000);

      // Recargar datos
      await inicializarEstadoCuentaPublico();
    } catch (e) {
      alert('Error de conexión al enviar el pago.');
    } finally {
      btnSendStatementPay.disabled = false;
      btnSendStatementPay.textContent = 'Enviar pago para aprobación';
    }
  });
}

if (btnStatementOpenJoin) {
  btnStatementOpenJoin.addEventListener('click', () => {
    if (statementJoinFormBox) {
      statementJoinFormBox.classList.toggle('hidden');
      if (!statementJoinFormBox.classList.contains('hidden') && inputStatementRegName) {
        inputStatementRegName.focus();
      }
    }
  });
}

if (btnStatementSubmitJoin) {
  btnStatementSubmitJoin.addEventListener('click', async () => {
    if (!estadoCuentaDataActiva) return;
    const { deudor } = estadoCuentaDataActiva;
    const urlParams = new URLSearchParams(window.location.search);
    const ownerId = urlParams.get('owner') || 'alejandro';

    const nombre = inputStatementRegName ? inputStatementRegName.value.trim() : '';
    const rawDni = inputStatementRegDni ? inputStatementRegDni.value.trim() : '';
    const dniLimpio = rawDni.replace(/\D/g, '');
    const pass = inputStatementRegPass ? inputStatementRegPass.value.trim() : '';

    if (statementJoinError) statementJoinError.classList.add('hidden');

    if (!nombre) {
      if (statementJoinError) {
        statementJoinError.textContent = 'Ingresá tu nombre completo';
        statementJoinError.classList.remove('hidden');
      }
      if (inputStatementRegName) inputStatementRegName.focus();
      return;
    }
    if (!dniLimpio || dniLimpio.length < 5) {
      if (statementJoinError) {
        statementJoinError.textContent = 'Ingresá tu DNI (mínimo 5 números)';
        statementJoinError.classList.remove('hidden');
      }
      if (inputStatementRegDni) inputStatementRegDni.focus();
      return;
    }
    if (!pass || pass.length < 3) {
      if (statementJoinError) {
        statementJoinError.textContent = 'Creá una contraseña de al menos 3 caracteres';
        statementJoinError.classList.remove('hidden');
      }
      if (inputStatementRegPass) inputStatementRegPass.focus();
      return;
    }

    btnStatementSubmitJoin.disabled = true;
    btnStatementSubmitJoin.textContent = 'Creando tu cuenta...';

    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'crear_usuario',
          nombre: nombre,
          dni: dniLimpio,
          password: pass,
          vincularEstadoCuenta: {
            propietarioId: ownerId,
            deudorId: deudor.id
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.usuario) {
        if (statementJoinError) {
          statementJoinError.textContent = data.error || 'No se pudo crear la cuenta';
          statementJoinError.classList.remove('hidden');
        }
        return;
      }

      // Cuenta creada y deudas vinculadas con éxito
      localStorage.setItem('agenda_dni_configurado', 'true');
      localStorage.setItem('agenda_usuario_recordado', data.usuario.id);

      alert(`🎉 ¡Bienvenido/a ${nombre}! Tu cuenta fue creada exitosamente con tu DNI y tus deudas ya están vinculadas en tu sección "Yo debo".`);
      window.location.href = window.location.origin;
    } catch (e) {
      if (statementJoinError) {
        statementJoinError.textContent = 'Error de conexión. Intentá nuevamente.';
        statementJoinError.classList.remove('hidden');
      }
    } finally {
      if (btnStatementSubmitJoin) {
        btnStatementSubmitJoin.disabled = false;
        btnStatementSubmitJoin.textContent = '🚀 Crear mi cuenta y vincular mis deudas';
      }
    }
  });
}

// ==========================================
// MÓDULO: ASISTENTE GEMINI (DENTRO DE EXTRAS)
// ==========================================
const chatMessagesEl = document.getElementById('chat-messages');
const btnClearChat = document.getElementById('btn-clear-chat');
const inputChatMsg = document.getElementById('input-chat-msg');
const btnSendChat = document.getElementById('btn-send-chat');
let historialChatGemini = [];

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
// MÓDULO 5: EXTRAS -> 1. LISTA DE SUPERMERCADO (2 PANTALLAS: CONFECCIONAR Y PENDIENTE DE COMPRA)
// ==========================================
const inputSuperListName = document.getElementById('input-super-list-name');
const inputSuperItem = document.getElementById('input-super-item');
const inputSuperQty = document.getElementById('input-super-qty');
const superPriceMemoryHint = document.getElementById('super-price-memory-hint');
const checkSuperEdible = document.getElementById('check-super-edible');
const superEdibleLabel = checkSuperEdible ? checkSuperEdible.closest('.super-edible-check-label') : null;
const btnAddSuperItem = document.getElementById('btn-add-super-item');
const btnSaveSuperListToPending = document.getElementById('btn-save-super-list-to-pending');
const btnFinishShopping = document.getElementById('btn-finish-shopping');
const superItemsList = document.getElementById('super-items-list');
const superSubtitleInfo = document.getElementById('super-subtitle-info');

const superHomeScreens = document.getElementById('super-home-screens');
const cardSuperConfeccionar = document.getElementById('card-super-confeccionar');
const cardSuperPendientes = document.getElementById('card-super-pendientes');
const badgeSuperDraftCount = document.getElementById('badge-super-draft-count');
const badgeSuperPendingCount = document.getElementById('badge-super-pending-count');

const superScreenConfeccion = document.getElementById('super-screen-confeccion');
const superScreenPendientes = document.getElementById('super-screen-pendientes');
const btnBackFromConfeccion = document.getElementById('btn-back-from-confeccion');
const btnGoToPendientesFromConf = document.getElementById('btn-go-to-pendientes-from-conf');
const btnBackFromPendientes = document.getElementById('btn-back-from-pendientes');
const btnNewListFromPendientes = document.getElementById('btn-new-list-from-pendientes');

const superPendingListsOverview = document.getElementById('super-pending-lists-overview');
const superPendingListsContainer = document.getElementById('super-pending-lists-container');
const superActivePendingDetail = document.getElementById('super-active-pending-detail');
const btnBackToPendingLists = document.getElementById('btn-back-to-pending-lists');
const btnToggleModifyActiveList = document.getElementById('btn-toggle-modify-active-list');
const btnRenameActiveList = document.getElementById('btn-rename-active-list');
const activePendingListTitle = document.getElementById('active-pending-list-title');
const activePendingListStatus = document.getElementById('active-pending-list-status');
const activePendingTotalBadge = document.getElementById('active-pending-total-badge');
const superStartShoppingBox = document.getElementById('super-start-shopping-box');
const btnConfirmStartShopping = document.getElementById('btn-confirm-start-shopping');
const btnModifyPendingList = document.getElementById('btn-modify-pending-list');
const superModifyListBox = document.getElementById('super-modify-list-box');
const btnFinishModifyingList = document.getElementById('btn-finish-modifying-list');
const inputModifyPendingListName = document.getElementById('input-modify-pending-list-name');
const inputPendingExtraItem = document.getElementById('input-pending-extra-item');
const inputPendingExtraQty = document.getElementById('input-pending-extra-qty');
const checkPendingExtraEdible = document.getElementById('check-pending-extra-edible');
const btnAddPendingExtraItem = document.getElementById('btn-add-pending-extra-item');
const superActivePendingItems = document.getElementById('super-active-pending-items');
const superCheckoutSummaryLine = document.getElementById('super-checkout-summary-line');

const superPriceQtyModal = document.getElementById('super-price-qty-modal');
const modalSuperItemTitle = document.getElementById('modal-super-item-title');
const modalSuperPriceMemoryBadge = document.getElementById('modal-super-price-memory-badge');
const modalInputSuperQty = document.getElementById('modal-input-super-qty');
const modalInputSuperUnits = document.getElementById('modal-input-super-units');
const modalInputSuperPrice = document.getElementById('modal-input-super-price');
const modalSuperItemSubtotal = document.getElementById('modal-super-item-subtotal');
const btnModalSuperUncheck = document.getElementById('btn-modal-super-uncheck');
const btnModalSuperCancel = document.getElementById('btn-modal-super-cancel');
const btnModalSuperConfirm = document.getElementById('btn-modal-super-confirm');

const superPayCheckoutModal = document.getElementById('super-pay-checkout-modal');
const checkoutModalListInfo = document.getElementById('checkout-modal-list-info');
const checkoutModalTotalAmount = document.getElementById('checkout-modal-total-amount');
const checkoutModalFridgeNote = document.getElementById('checkout-modal-fridge-note');
const btnPaySuperEfectivo = document.getElementById('btn-pay-super-efectivo');
const btnPaySuperVirtual = document.getElementById('btn-pay-super-virtual');
const btnPaySuperNoWallet = document.getElementById('btn-pay-super-no-wallet');
const btnPaySuperCancel = document.getElementById('btn-pay-super-cancel');

const STORAGE_SUPER_PRICES_KEY = 'agenda_familiar_precios_super_v1';
let vistaSuperActual = 'home'; // 'home' | 'confeccion' | 'pendientes'
let listaPendienteAbiertaId = null;
let modoModificarListaPendiente = false;
let itemEnEdicionModalRef = null; // { listaId, itemId }

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
  if (housematesPromptBox) housematesPromptBox.classList.add('hidden');
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

function normalizarClaveIngrediente(nombre) {
  return String(nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(palabra => {
      if (palabra.length > 4 && palabra.endsWith('es') && !palabra.endsWith('tes') && !palabra.endsWith('ches')) {
        return palabra.slice(0, -2);
      }
      if (palabra.length > 3 && palabra.endsWith('s')) {
        return palabra.slice(0, -1);
      }
      return palabra;
    })
    .join(' ');
}

function buscarIngredienteEnHeladera(nombreBuscado) {
  const clave = normalizarClaveIngrediente(nombreBuscado);
  if (!clave) return null;
  return heladera.find(h => normalizarClaveIngrediente(h.nombre) === clave) || null;
}

function parsearSegmentoCantidad(segRaw) {
  let s = String(segRaw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '.');

  if (!s || s === 'cantidad necesaria' || s === 'un poco' || s === 'a gusto') {
    return null;
  }

  let extraMedio = 0;
  if (/\by\s+medi[oa]s?\b/.test(s)) {
    extraMedio = 0.5;
    s = s.replace(/\by\s+medi[oa]s?\b/g, ' ').trim();
  }

  const mapaPalabrasNum = {
    'un': 1, 'uno': 1, 'una': 1,
    'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
    'doce': 12
  };

  let num = null;
  let resto = s;

  if (/^medi[oa]s?\b/.test(s)) {
    num = 0.5;
    resto = s.replace(/^medi[oa]s?\b/, '').trim();
  } else {
    const matchNum = s.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (matchNum) {
      num = parseFloat(matchNum[1]);
      resto = (matchNum[2] || '').trim();
    } else {
      const partes = s.split(/\s+/);
      const primera = partes[0];
      if (mapaPalabrasNum[primera] !== undefined) {
        num = mapaPalabrasNum[primera];
        resto = partes.slice(1).join(' ').trim();
      }
    }
  }

  if (num === null || isNaN(num)) return null;
  const valorTotal = num + extraMedio;

  resto = resto.replace(/^de\s+/, '').replace(/\.$/, '').trim();

  // Clasificar unidad
  if (/^(kg|kilo|kilos|kilogramo|kilogramos)$/.test(resto)) {
    return { familia: 'peso', valorGramos: valorTotal * 1000, usaPalabraKilo: /kilo/.test(resto), tuvoMedio: extraMedio > 0 || num === 0.5 };
  }
  if (/^(g|gr|grs|gramo|gramos)$/.test(resto)) {
    return { familia: 'peso', valorGramos: valorTotal, usaPalabraKilo: false, tuvoMedio: false };
  }
  if (/^(l|lt|lts|litro|litros)$/.test(resto)) {
    return { familia: 'volumen', valorMl: valorTotal * 1000, usaPalabraLitro: /litro/.test(resto) || extraMedio > 0, tuvoMedio: extraMedio > 0 || num === 0.5 };
  }
  if (/^(ml|cc|mililitro|mililitros)$/.test(resto)) {
    return { familia: 'volumen', valorMl: valorTotal, usaPalabraLitro: false, tuvoMedio: false };
  }
  if (/^(docena|docenas)$/.test(resto)) {
    return { familia: 'unidad', valor: valorTotal * 12, unidadSingular: 'u.', unidadPlural: 'u.', genero: 'f', especifica: false };
  }

  const esGenerica = !resto || /^(u|un|unid|unidad|unidades)$/.test(resto);
  if (esGenerica) {
    return {
      familia: 'unidad',
      valor: valorTotal,
      unidadSingular: resto === 'unidad' || resto === 'unidades' ? 'unidad' : 'u.',
      unidadPlural: resto === 'unidad' || resto === 'unidades' ? 'unidades' : 'u.',
      genero: 'f',
      especifica: false
    };
  }

  // Unidad contable específica (ej: paquete, paquetes, lata, botella, pechuga, horma, etc.)
  let sing = resto;
  let plur = resto;
  if (resto.endsWith('es') && resto.length > 4 && !resto.endsWith('tes') && !resto.endsWith('ques')) {
    sing = resto.slice(0, -2);
    plur = resto;
  } else if (resto.endsWith('s') && resto.length > 2) {
    sing = resto.slice(0, -1);
    plur = resto;
  } else {
    sing = resto;
    plur = (/[aeiou]$/.test(resto)) ? resto + 's' : resto + 'es';
  }

  const esFemenino = /(a|cion|sion)$/.test(sing);
  return {
    familia: 'unidad',
    valor: valorTotal,
    unidadSingular: sing,
    unidadPlural: plur,
    genero: esFemenino ? 'f' : 'm',
    especifica: true
  };
}

function formatearConYMedio(valor, sing, plur, genero) {
  const redondeado = Math.round(valor * 2) / 2;
  const esMedioExacto = Math.abs((valor - Math.floor(valor)) - 0.5) < 0.08 && Math.abs(valor - redondeado) < 0.08;
  const palabraMedio = genero === 'f' ? 'media' : 'medio';

  if (esMedioExacto) {
    const entero = Math.floor(redondeado);
    if (entero === 0) return `${palabraMedio} ${sing}`;
    if (entero === 1) return `1 ${sing} y ${palabraMedio}`;
    return `${entero} ${plur} y ${palabraMedio}`;
  }

  const numLim = Number(valor.toFixed(2));
  if (numLim === 1) return `1 ${sing}`;
  return `${numLim} ${plur}`;
}

function sumarCantidadesInteligente(cantExistente, cantNueva) {
  const textoCombinado = `${cantExistente || ''} + ${cantNueva || ''}`;
  const partes = textoCombinado.split('+').map(p => p.trim()).filter(Boolean);
  if (partes.length === 0) return { texto: cantNueva || '1 u.', necesitaIA: false };

  const parseados = partes.map(parsearSegmentoCantidad);
  if (parseados.some(p => p === null)) {
    return { texto: partes.join(' + '), necesitaIA: true };
  }

  const fam = parseados[0].familia;
  if (!parseados.every(p => p.familia === fam)) {
    return { texto: partes.join(' + '), necesitaIA: true };
  }

  if (fam === 'peso') {
    const totalGramos = parseados.reduce((acc, p) => acc + p.valorGramos, 0);
    const prefiereKiloPalabra = parseados.some(p => p.usaPalabraKilo || p.tuvoMedio);
    if (totalGramos >= 1000) {
      const kilos = totalGramos / 1000;
      if (prefiereKiloPalabra) {
        return { texto: formatearConYMedio(kilos, 'kilo', 'kilos', 'm'), necesitaIA: false };
      }
      return { texto: `${Number(kilos.toFixed(2))} kg`, necesitaIA: false };
    }
    return { texto: `${Math.round(totalGramos)}g`, necesitaIA: false };
  }

  if (fam === 'volumen') {
    const totalMl = parseados.reduce((acc, p) => acc + p.valorMl, 0);
    if (totalMl >= 1000) {
      const litros = totalMl / 1000;
      return { texto: formatearConYMedio(litros, 'litro', 'litros', 'm'), necesitaIA: false };
    }
    return { texto: `${Math.round(totalMl)}ml`, necesitaIA: false };
  }

  // Familia 'unidad'
  const especificas = parseados.filter(p => p.especifica);
  let unidadRef = especificas[0] || parseados[0];

  // Si hay dos unidades específicas distintas (ej: "1 paquete" y "2 latas"), delegar a IA
  if (especificas.length > 1) {
    const baseSing = especificas[0].unidadSingular;
    if (!especificas.every(e => e.unidadSingular === baseSing)) {
      return { texto: partes.join(' + '), necesitaIA: true };
    }
  }

  const totalUnidades = parseados.reduce((acc, p) => acc + p.valor, 0);
  if (unidadRef.unidadSingular === 'u.') {
    const numLim = Number(totalUnidades.toFixed(2));
    return { texto: `${numLim} u.`, necesitaIA: false };
  }

  return {
    texto: formatearConYMedio(totalUnidades, unidadRef.unidadSingular, unidadRef.unidadPlural, unidadRef.genero),
    necesitaIA: false
  };
}

async function unificarCantidadesHeladeraConIA(idsParaUnificar) {
  if (!Array.isArray(idsParaUnificar) || idsParaUnificar.length === 0) return;
  const itemsTarget = heladera.filter(h => idsParaUnificar.includes(h.id));
  if (itemsTarget.length === 0) return;

  const promptUnificar = `Unificá y sumá matemáticamente las cantidades de estos ingredientes de la heladera para que cada uno tenga una única cantidad total expresada en español natural (por ejemplo, si dice "1 paquete y medio + 2" o "1 paquete y medio + 2 paquetes", debe quedar "3 paquetes y medio"; si dice "500g + 1 kg", debe quedar "1.5 kg").

INGREDIENTES A UNIFICAR (JSON):
${JSON.stringify(itemsTarget.map(x => ({ id: x.id, nombre: x.nombre, cantidad: x.cantidad })), null, 2)}

Respondé ÚNICAMENTE con un objeto JSON válido con este formato exacto:
{
  "items": [
    { "id": "id_del_ingrediente", "cantidadUnificada": "cantidad total sumada" }
  ]
}`;

  try {
    const res = await fetch(API_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreUsuario: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
        mensaje: promptUnificar,
        historial: []
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const matchJson = String(data.respuesta || '').match(/\{[\s\S]*\}/);
    if (!matchJson) return;
    const parsed = JSON.parse(matchJson[0]);
    if (parsed && Array.isArray(parsed.items)) {
      let huboCambio = false;
      parsed.items.forEach(u => {
        const target = heladera.find(h => h.id === u.id);
        if (target && u.cantidadUnificada && String(u.cantidadUnificada).trim()) {
          target.cantidad = String(u.cantidadUnificada).trim();
          target.updatedAt = Date.now();
          huboCambio = true;
        }
      });
      if (huboCambio) {
        renderizarHeladera();
        guardarEnNube();
      }
    }
  } catch (e) {}
}

function sumarOAgregarIngredienteEnHeladera(nombreProd, cantidadProd) {
  const cantLimpia = (cantidadProd || '').trim() || '1 u.';
  const existente = buscarIngredienteEnHeladera(nombreProd);

  if (existente) {
    const resultadoSuma = sumarCantidadesInteligente(existente.cantidad, cantLimpia);
    existente.cantidad = resultadoSuma.texto;
    existente.updatedAt = Date.now();
    return { id: existente.id, necesitaIA: resultadoSuma.necesitaIA };
  } else {
    // Incluso si es nuevo, si el usuario escribió algo con "+", lo normalizamos
    const resultadoInicial = cantLimpia.includes('+')
      ? sumarCantidadesInteligente('', cantLimpia)
      : { texto: cantLimpia, necesitaIA: false };
    const nuevoId = 'hel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    heladera.push({
      id: nuevoId,
      nombre: nombreProd.trim(),
      cantidad: resultadoInicial.texto,
      updatedAt: Date.now()
    });
    return { id: nuevoId, necesitaIA: resultadoInicial.necesitaIA };
  }
}

function formatearMonedaSuper(num) {
  const n = Number(num) || 0;
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

function normalizarEstructuraSupermercado() {
  if (!Array.isArray(supermercado)) supermercado = [];

  const itemsSueltosLegacy = [];
  const estructuraLimpia = [];

  supermercado.forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    if (entry.esListaSuper) {
      if (!Array.isArray(entry.items)) entry.items = [];
      estructuraLimpia.push(entry);
    } else if (entry.esMemoriaPrecio) {
      estructuraLimpia.push(entry);
    } else if (entry.texto) {
      itemsSueltosLegacy.push(entry);
    }
  });

  if (itemsSueltosLegacy.length > 0) {
    let listaLegacy = estructuraLimpia.find(x => x.esListaSuper && x.estado === 'pendiente');
    if (listaLegacy) {
      const idsExist = new Set(listaLegacy.items.map(i => i.id));
      itemsSueltosLegacy.forEach(it => {
        if (!idsExist.has(it.id)) listaLegacy.items.push(it);
      });
    } else {
      estructuraLimpia.push({
        esListaSuper: true,
        id: 'list-sup-migrated-' + Date.now(),
        nombre: 'Lista de Supermercado',
        estado: 'pendiente',
        compraIniciada: false,
        autor: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: itemsSueltosLegacy
      });
    }
  }

  let borrador = estructuraLimpia.find(x => x.esListaSuper && x.estado === 'confeccion');
  if (!borrador) {
    borrador = {
      esListaSuper: true,
      id: 'list-draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      nombre: '',
      estado: 'confeccion',
      compraIniciada: false,
      autor: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: []
    };
    estructuraLimpia.push(borrador);
  }

  supermercado = estructuraLimpia;
  return borrador;
}

function obtenerListaBorradorSuper() {
  return normalizarEstructuraSupermercado();
}

function obtenerListasPendientesSuper() {
  normalizarEstructuraSupermercado();
  return supermercado.filter(x => x.esListaSuper && x.estado === 'pendiente');
}

function obtenerContadoresSupermercado() {
  const borrador = obtenerListaBorradorSuper();
  const pendientes = obtenerListasPendientesSuper();
  const cantBorrador = borrador && Array.isArray(borrador.items) ? borrador.items.length : 0;
  const totalEnPendientes = pendientes.reduce((acc, l) => acc + (Array.isArray(l.items) ? l.items.length : 0), 0);
  return {
    listasPendientes: pendientes.length,
    productosEnBorrador: cantBorrador,
    totalProductos: cantBorrador + totalEnPendientes
  };
}

function obtenerMapaPreciosLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_SUPER_PRICES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function obtenerPrecioRecordadoSuper(nombreProd) {
  const clave = normalizarClaveIngrediente(nombreProd);
  if (!clave) return null;
  normalizarEstructuraSupermercado();
  const regNube = supermercado.find(x => x.esMemoriaPrecio && x.clave === clave);
  if (regNube && Number(regNube.precio) > 0) {
    return Number(regNube.precio);
  }
  const localMap = obtenerMapaPreciosLocal();
  if (localMap[clave] && Number(localMap[clave]) > 0) {
    return Number(localMap[clave]);
  }
  return null;
}

function guardarPrecioRecordadoSuper(nombreProd, precioNum) {
  const clave = normalizarClaveIngrediente(nombreProd);
  const p = Number(precioNum);
  if (!clave || isNaN(p) || p <= 0) return;

  normalizarEstructuraSupermercado();
  let regNube = supermercado.find(x => x.esMemoriaPrecio && x.clave === clave);
  if (regNube) {
    regNube.precio = p;
    regNube.nombre = nombreProd.trim();
    regNube.updatedAt = Date.now();
  } else {
    supermercado.push({
      esMemoriaPrecio: true,
      id: 'mem-precio-' + clave.replace(/\s+/g, '-'),
      clave: clave,
      nombre: nombreProd.trim(),
      precio: p,
      updatedAt: Date.now()
    });
  }

  try {
    const localMap = obtenerMapaPreciosLocal();
    localMap[clave] = p;
    localStorage.setItem(STORAGE_SUPER_PRICES_KEY, JSON.stringify(localMap));
  } catch (e) {}
}

function estimarUnidadesMultiplicador(cantTexto) {
  const parsed = parsearSegmentoCantidad(cantTexto);
  if (!parsed) return 1;
  if (parsed.familia === 'unidad' && parsed.valor > 0) {
    return Number(parsed.valor.toFixed(2));
  }
  if (parsed.familia === 'peso' && parsed.valorGramos >= 1000) {
    return Number((parsed.valorGramos / 1000).toFixed(2));
  }
  if (parsed.familia === 'volumen' && parsed.valorMl >= 1000) {
    return Number((parsed.valorMl / 1000).toFixed(2));
  }
  return 1;
}

function mostrarPantallaSuper(cual) {
  registrarPasoHistorial('super-' + (cual || 'home'));
  vistaSuperActual = cual || 'home';
  if (cual !== 'pendientes') {
    listaPendienteAbiertaId = null;
    modoModificarListaPendiente = false;
  }
  renderizarSupermercado();
  if (cual === 'confeccion' && inputSuperItem) {
    inputSuperItem.focus();
  }
}

if (cardSuperConfeccionar) {
  cardSuperConfeccionar.addEventListener('click', () => mostrarPantallaSuper('confeccion'));
}
if (cardSuperPendientes) {
  cardSuperPendientes.addEventListener('click', () => {
    listaPendienteAbiertaId = null;
    modoModificarListaPendiente = false;
    mostrarPantallaSuper('pendientes');
  });
}
if (btnBackFromConfeccion) {
  btnBackFromConfeccion.addEventListener('click', () => mostrarPantallaSuper('home'));
}
if (btnGoToPendientesFromConf) {
  btnGoToPendientesFromConf.addEventListener('click', () => {
    listaPendienteAbiertaId = null;
    modoModificarListaPendiente = false;
    mostrarPantallaSuper('pendientes');
  });
}
if (btnBackFromPendientes) {
  btnBackFromPendientes.addEventListener('click', () => mostrarPantallaSuper('home'));
}
if (btnNewListFromPendientes) {
  btnNewListFromPendientes.addEventListener('click', () => mostrarPantallaSuper('confeccion'));
}
if (btnBackToPendingLists) {
  btnBackToPendingLists.addEventListener('click', () => {
    listaPendienteAbiertaId = null;
    modoModificarListaPendiente = false;
    renderizarSupermercado();
  });
}

if (inputSuperListName) {
  inputSuperListName.addEventListener('input', () => {
    const borrador = obtenerListaBorradorSuper();
    borrador.nombre = inputSuperListName.value;
    borrador.updatedAt = Date.now();
  });
  inputSuperListName.addEventListener('change', () => {
    guardarEnNube();
  });
}

if (inputSuperItem) {
  inputSuperItem.addEventListener('input', () => {
    if (!superPriceMemoryHint) return;
    const val = inputSuperItem.value.trim();
    if (!val) {
      superPriceMemoryHint.textContent = '';
      return;
    }
    const precioRec = obtenerPrecioRecordadoSuper(val);
    if (precioRec !== null) {
      superPriceMemoryHint.textContent = `💡 Precio recordado de compra anterior: ${formatearMonedaSuper(precioRec)} (podrás usarlo o cambiarlo al comprar)`;
    } else {
      superPriceMemoryHint.textContent = '';
    }
  });

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

function agregarProductoSuper() {
  if (!usuarioActivo) return;
  const texto = inputSuperItem ? inputSuperItem.value.trim() : '';
  if (!texto) {
    if (inputSuperItem) inputSuperItem.focus();
    return;
  }
  const cantidad = inputSuperQty ? (inputSuperQty.value.trim() || '1 u.') : '1 u.';
  const esComestible = checkSuperEdible ? checkSuperEdible.checked : true;
  const borrador = obtenerListaBorradorSuper();

  if (inputSuperListName && inputSuperListName.value.trim()) {
    borrador.nombre = inputSuperListName.value.trim();
  }

  const precioMem = obtenerPrecioRecordadoSuper(texto);

  borrador.items.push({
    id: 'sup-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    texto: texto,
    cantidad: cantidad,
    unidadesCalculo: estimarUnidadesMultiplicador(cantidad),
    precioUnitario: precioMem || 0,
    subtotal: 0,
    comestible: esComestible,
    tildado: false,
    autor: usuarioActivo.nombre,
    updatedAt: Date.now()
  });
  borrador.updatedAt = Date.now();

  inputSuperItem.value = '';
  if (inputSuperQty) inputSuperQty.value = '';
  if (superPriceMemoryHint) superPriceMemoryHint.textContent = '';
  renderizarSupermercado();
  inputSuperItem.focus();
  guardarEnNube();
}

if (btnAddSuperItem) btnAddSuperItem.addEventListener('click', agregarProductoSuper);

if (btnSaveSuperListToPending) {
  btnSaveSuperListToPending.addEventListener('click', () => {
    const borrador = obtenerListaBorradorSuper();
    if (!borrador.items || borrador.items.length === 0) {
      alert('Primero añadí al menos un producto a la lista antes de guardarla en "Pendiente de Compra".');
      if (inputSuperItem) inputSuperItem.focus();
      return;
    }

    const pendientesActuales = obtenerListasPendientesSuper();
    const nombreElegido = (inputSuperListName && inputSuperListName.value.trim())
      || (borrador.nombre && borrador.nombre.trim())
      || `Lista de compras #${pendientesActuales.length + 1}`;

    borrador.nombre = nombreElegido;
    borrador.estado = 'pendiente';
    borrador.compraIniciada = false;
    borrador.updatedAt = Date.now();

    if (inputSuperListName) inputSuperListName.value = '';
    normalizarEstructuraSupermercado();

    listaPendienteAbiertaId = null;
    modoModificarListaPendiente = false;
    mostrarPantallaSuper('pendientes');
    guardarEnNube();
  });
}

function cambiarNombreListaSuper(listaObj) {
  if (!listaObj) return;
  const nuevoNombre = prompt('Escribí el nombre para esta lista de compras:', listaObj.nombre || 'Lista de compras');
  if (nuevoNombre === null) return;
  const limpio = nuevoNombre.trim();
  if (!limpio) return;
  listaObj.nombre = limpio;
  listaObj.updatedAt = Date.now();
  renderizarSupermercado();
  guardarEnNube();
}

function activarModoModificarListaPendiente(activar) {
  modoModificarListaPendiente = Boolean(activar);
  if (modoModificarListaPendiente) {
    registrarPasoHistorial('super-modificar-lista');
  }
  renderizarSupermercado();
  if (modoModificarListaPendiente && inputPendingExtraItem) {
    inputPendingExtraItem.focus();
  }
}

if (btnToggleModifyActiveList) {
  btnToggleModifyActiveList.addEventListener('click', () => {
    activarModoModificarListaPendiente(!modoModificarListaPendiente);
  });
}

if (btnModifyPendingList) {
  btnModifyPendingList.addEventListener('click', () => {
    activarModoModificarListaPendiente(true);
  });
}

if (btnFinishModifyingList) {
  btnFinishModifyingList.addEventListener('click', () => {
    modoModificarListaPendiente = false;
    renderizarSupermercado();
    guardarEnNube();
  });
}

if (inputModifyPendingListName) {
  inputModifyPendingListName.addEventListener('input', () => {
    const pendientes = obtenerListasPendientesSuper();
    const activa = pendientes.find(l => l.id === listaPendienteAbiertaId);
    if (!activa) return;
    activa.nombre = inputModifyPendingListName.value;
    activa.updatedAt = Date.now();
    if (activePendingListTitle) {
      activePendingListTitle.textContent = `📋 ${activa.nombre || 'Lista de Supermercado'}`;
    }
  });
  inputModifyPendingListName.addEventListener('change', () => {
    guardarEnNube();
  });
}

if (btnRenameActiveList) {
  btnRenameActiveList.addEventListener('click', () => {
    const pendientes = obtenerListasPendientesSuper();
    const activa = pendientes.find(l => l.id === listaPendienteAbiertaId);
    if (activa) cambiarNombreListaSuper(activa);
  });
}

if (btnConfirmStartShopping) {
  btnConfirmStartShopping.addEventListener('click', () => {
    const pendientes = obtenerListasPendientesSuper();
    const activa = pendientes.find(l => l.id === listaPendienteAbiertaId);
    if (!activa) return;
    activa.compraIniciada = true;
    modoModificarListaPendiente = false;
    activa.updatedAt = Date.now();
    renderizarSupermercado();
    guardarEnNube();
  });
}

function agregarProductoExtraAListaPendiente() {
  const pendientes = obtenerListasPendientesSuper();
  const activa = pendientes.find(l => l.id === listaPendienteAbiertaId);
  if (!activa || !inputPendingExtraItem) return;
  const texto = inputPendingExtraItem.value.trim();
  if (!texto) {
    inputPendingExtraItem.focus();
    return;
  }
  const cant = inputPendingExtraQty ? (inputPendingExtraQty.value.trim() || '1 u.') : '1 u.';
  const esCom = checkPendingExtraEdible ? checkPendingExtraEdible.checked : true;
  const precioMem = obtenerPrecioRecordadoSuper(texto);

  activa.items.push({
    id: 'sup-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    texto: texto,
    cantidad: cant,
    unidadesCalculo: estimarUnidadesMultiplicador(cant),
    precioUnitario: precioMem || 0,
    subtotal: 0,
    comestible: esCom,
    tildado: false,
    autor: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
    updatedAt: Date.now()
  });
  activa.updatedAt = Date.now();
  inputPendingExtraItem.value = '';
  if (inputPendingExtraQty) inputPendingExtraQty.value = '';
  renderizarSupermercado();
  if (inputPendingExtraItem) inputPendingExtraItem.focus();
  guardarEnNube();
}

if (btnAddPendingExtraItem) {
  btnAddPendingExtraItem.addEventListener('click', agregarProductoExtraAListaPendiente);
}
if (inputPendingExtraItem) {
  inputPendingExtraItem.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputPendingExtraQty) inputPendingExtraQty.focus();
      else agregarProductoExtraAListaPendiente();
    }
  });
}
if (inputPendingExtraQty) {
  inputPendingExtraQty.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarProductoExtraAListaPendiente();
    }
  });
}

function actualizarSubtotalModalSuper() {
  if (!modalSuperItemSubtotal) return;
  const u = Math.max(0.01, parseFloat(modalInputSuperUnits ? modalInputSuperUnits.value : '1') || 1);
  const p = Math.max(0, parseFloat(modalInputSuperPrice ? modalInputSuperPrice.value : '0') || 0);
  const sub = Math.round(u * p * 100) / 100;
  modalSuperItemSubtotal.textContent = formatearMonedaSuper(sub);
}

if (modalInputSuperQty) {
  modalInputSuperQty.addEventListener('input', () => {
    const est = estimarUnidadesMultiplicador(modalInputSuperQty.value);
    if (modalInputSuperUnits && est > 0) {
      modalInputSuperUnits.value = String(est);
      actualizarSubtotalModalSuper();
    }
  });
}
if (modalInputSuperUnits) {
  modalInputSuperUnits.addEventListener('input', actualizarSubtotalModalSuper);
}
if (modalInputSuperPrice) {
  modalInputSuperPrice.addEventListener('input', actualizarSubtotalModalSuper);
  modalInputSuperPrice.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmarModalPrecioProductoSuper();
    }
  });
}

function abrirModalPrecioProductoSuper(listaObj, itemObj) {
  if (!superPriceQtyModal || !listaObj || !itemObj) return;
  itemEnEdicionModalRef = { listaId: listaObj.id, itemId: itemObj.id };

  if (modalSuperItemTitle) {
    modalSuperItemTitle.textContent = `🛒 ${itemObj.texto}`;
  }

  const cantActual = itemObj.cantidad || '1 u.';
  if (modalInputSuperQty) modalInputSuperQty.value = cantActual;

  const unidadesDefault = (itemObj.tildado && Number(itemObj.unidadesCalculo) > 0)
    ? Number(itemObj.unidadesCalculo)
    : estimarUnidadesMultiplicador(cantActual);
  if (modalInputSuperUnits) modalInputSuperUnits.value = String(unidadesDefault);

  const precioRecordado = obtenerPrecioRecordadoSuper(itemObj.texto);
  const precioParaMostrar = (Number(itemObj.precioUnitario) > 0)
    ? Number(itemObj.precioUnitario)
    : (precioRecordado !== null ? precioRecordado : '');

  if (modalInputSuperPrice) {
    modalInputSuperPrice.value = precioParaMostrar !== '' ? String(precioParaMostrar) : '';
  }

  if (modalSuperPriceMemoryBadge) {
    if (precioRecordado !== null) {
      modalSuperPriceMemoryBadge.textContent = `🧠 Precio recordado de compra anterior: ${formatearMonedaSuper(precioRecordado)} (podés confirmarlo o cambiarlo)`;
    } else {
      modalSuperPriceMemoryBadge.textContent = 'Ingresá el precio y la cantidad de este producto (la app recordará el precio para tu próxima compra):';
    }
  }

  if (btnModalSuperUncheck) {
    if (itemObj.tildado) btnModalSuperUncheck.classList.remove('hidden');
    else btnModalSuperUncheck.classList.add('hidden');
  }

  actualizarSubtotalModalSuper();
  superPriceQtyModal.classList.remove('hidden');
  setTimeout(() => {
    if (modalInputSuperPrice) {
      modalInputSuperPrice.focus();
      modalInputSuperPrice.select();
    }
  }, 40);
}

function cerrarModalPrecioProductoSuper() {
  itemEnEdicionModalRef = null;
  if (superPriceQtyModal) superPriceQtyModal.classList.add('hidden');
}

function confirmarModalPrecioProductoSuper() {
  if (!itemEnEdicionModalRef) return;
  const pendientes = obtenerListasPendientesSuper();
  const lista = pendientes.find(l => l.id === itemEnEdicionModalRef.listaId);
  if (!lista) {
    cerrarModalPrecioProductoSuper();
    return;
  }
  const item = lista.items.find(i => i.id === itemEnEdicionModalRef.itemId);
  if (!item) {
    cerrarModalPrecioProductoSuper();
    return;
  }

  const cantNueva = modalInputSuperQty ? (modalInputSuperQty.value.trim() || '1 u.') : (item.cantidad || '1 u.');
  const unidades = Math.max(0.01, parseFloat(modalInputSuperUnits ? modalInputSuperUnits.value : '1') || 1);
  const precio = Math.max(0, parseFloat(modalInputSuperPrice ? modalInputSuperPrice.value : '0') || 0);

  item.cantidad = cantNueva;
  item.unidadesCalculo = unidades;
  item.precioUnitario = precio;
  item.subtotal = Math.round(unidades * precio * 100) / 100;
  item.tildado = true;
  item.updatedAt = Date.now();
  lista.updatedAt = Date.now();

  if (precio > 0) {
    guardarPrecioRecordadoSuper(item.texto, precio);
  }

  cerrarModalPrecioProductoSuper();
  renderizarSupermercado();
  guardarEnNube();
}

if (btnModalSuperCancel) btnModalSuperCancel.addEventListener('click', cerrarModalPrecioProductoSuper);
if (btnModalSuperConfirm) btnModalSuperConfirm.addEventListener('click', confirmarModalPrecioProductoSuper);
if (btnModalSuperUncheck) {
  btnModalSuperUncheck.addEventListener('click', () => {
    if (!itemEnEdicionModalRef) return;
    const pendientes = obtenerListasPendientesSuper();
    const lista = pendientes.find(l => l.id === itemEnEdicionModalRef.listaId);
    const item = lista ? lista.items.find(i => i.id === itemEnEdicionModalRef.itemId) : null;
    if (item) {
      item.tildado = false;
      item.subtotal = 0;
      item.updatedAt = Date.now();
      lista.updatedAt = Date.now();
    }
    cerrarModalPrecioProductoSuper();
    renderizarSupermercado();
    guardarEnNube();
  });
}

function calcularTotalListaPendiente(listaObj) {
  if (!listaObj || !Array.isArray(listaObj.items)) return 0;
  return listaObj.items
    .filter(x => x.tildado)
    .reduce((acc, x) => {
      const u = Number(x.unidadesCalculo) > 0 ? Number(x.unidadesCalculo) : 1;
      const p = Number(x.precioUnitario) || 0;
      const sub = Number(x.subtotal) >= 0 ? Number(x.subtotal) : (u * p);
      return Math.round((acc + sub) * 100) / 100;
    }, 0);
}

if (btnFinishShopping) {
  btnFinishShopping.addEventListener('click', () => {
    const pendientes = obtenerListasPendientesSuper();
    const activa = pendientes.find(l => l.id === listaPendienteAbiertaId);
    if (!activa) return;

    const tildados = (activa.items || []).filter(x => x.tildado);
    if (tildados.length === 0) {
      alert('Primero tildá con el botón "✓" los productos que fuiste poniendo en el carrito (cargando su precio y cantidad), y después tocá "¿Cerrar y pagar?".');
      return;
    }

    const totalCompra = calcularTotalListaPendiente(activa);
    const cantComestibles = tildados.filter(x => x.comestible !== false).length;

    if (checkoutModalListInfo) {
      checkoutModalListInfo.innerHTML = `Lista: <strong>${escaparHTML(activa.nombre || 'Compra de Supermercado')}</strong> (${tildados.length} producto${tildados.length === 1 ? '' : 's'} en el carrito)`;
    }
    if (checkoutModalTotalAmount) {
      checkoutModalTotalAmount.textContent = formatearMonedaSuper(totalCompra);
    }
    if (checkoutModalFridgeNote) {
      checkoutModalFridgeNote.textContent = cantComestibles > 0
        ? `🍎 ${cantComestibles} producto(s) comestible(s) se sumarán automáticamente a tu Heladera.`
        : '🧴 No hay productos comestibles marcados para pasar a la Heladera.';
    }

    if (superPayCheckoutModal) {
      superPayCheckoutModal.classList.remove('hidden');
    }
  });
}

if (btnPaySuperCancel) {
  btnPaySuperCancel.addEventListener('click', () => {
    if (superPayCheckoutModal) superPayCheckoutModal.classList.add('hidden');
  });
}

function finalizarYPagarCompraSuper(metodoBilletera) {
  const pendientes = obtenerListasPendientesSuper();
  const activa = pendientes.find(l => l.id === listaPendienteAbiertaId);
  if (!activa) {
    if (superPayCheckoutModal) superPayCheckoutModal.classList.add('hidden');
    return;
  }

  const tildados = (activa.items || []).filter(x => x.tildado);
  const totalCompra = calcularTotalListaPendiente(activa);

  // 1. Pasar comestibles comprados a la Heladera sumando sus cantidades reales
  const comestiblesComprados = tildados.filter(x => x.comestible !== false);
  const idsParaIA = [];

  comestiblesComprados.forEach(item => {
    const cantItem = item.cantidad || '1 u.';
    const resSuma = sumarOAgregarIngredienteEnHeladera(item.texto, cantItem);
    if (resSuma.necesitaIA) {
      idsParaIA.push(resSuma.id);
    }
    if (Number(item.precioUnitario) > 0) {
      guardarPrecioRecordadoSuper(item.texto, Number(item.precioUnitario));
    }
  });

  // 2. Si eligió descontar de la Billetera (efectivo o virtual), registrar el gasto
  if ((metodoBilletera === 'efectivo' || metodoBilletera === 'virtual') && totalCompra > 0) {
    movimientos.push({
      id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      tipo: 'gasto',
      medio: metodoBilletera,
      monto: totalCompra,
      detalle: `🛒 Supermercado — ${activa.nombre || 'Lista de compras'}`,
      fecha: HOY_ISO,
      updatedAt: Date.now()
    });
    if (typeof renderizarBilletera === 'function') {
      renderizarBilletera();
    }
  }

  // 3. Quitar los productos comprados de la lista; si la lista quedó vacía, eliminarla de Pendientes
  const restantes = (activa.items || []).filter(x => !x.tildado);
  if (restantes.length === 0) {
    supermercado = supermercado.filter(x => x.id !== activa.id);
    listaPendienteAbiertaId = null;
  } else {
    activa.items = restantes;
    activa.compraIniciada = false;
    activa.updatedAt = Date.now();
    listaPendienteAbiertaId = null;
  }

  if (superPayCheckoutModal) superPayCheckoutModal.classList.add('hidden');
  renderizarSupermercado();
  renderizarHeladera();
  guardarEnNube();

  if (idsParaIA.length > 0) {
    unificarCantidadesHeladeraConIA(idsParaIA);
  }
}

if (btnPaySuperEfectivo) {
  btnPaySuperEfectivo.addEventListener('click', () => finalizarYPagarCompraSuper('efectivo'));
}
if (btnPaySuperVirtual) {
  btnPaySuperVirtual.addEventListener('click', () => finalizarYPagarCompraSuper('virtual'));
}
if (btnPaySuperNoWallet) {
  btnPaySuperNoWallet.addEventListener('click', () => finalizarYPagarCompraSuper('ninguno'));
}

function renderizarSupermercado() {
  const borrador = obtenerListaBorradorSuper();
  const pendientes = obtenerListasPendientesSuper();
  actualizarContadoresYAlertas();

  if (superSubtitleInfo) {
    const nombresCasa = superCompartidoCon
      .map(id => (listaUsuariosPublica.find(u => u.id === id) || {}).nombre)
      .filter(Boolean);
    superSubtitleInfo.textContent = nombresCasa.length > 0
      ? `🏠 Supermercado compartido con ${nombresCasa.join(', ')}: confeccioná listas y gestioná compras pendientes`
      : 'Confeccioná tus listas de compras y gestioná tus compras pendientes con memoria inteligente de precios';
  }

  // Actualizar badges del menú de 2 pantallas
  const cantBorrador = (borrador.items || []).length;
  if (badgeSuperDraftCount) {
    badgeSuperDraftCount.textContent = cantBorrador > 0
      ? `${cantBorrador} producto${cantBorrador === 1 ? '' : 's'} en confección`
      : 'Armar nueva lista';
  }
  if (badgeSuperPendingCount) {
    badgeSuperPendingCount.textContent = pendientes.length === 1
      ? '1 lista en espera'
      : `${pendientes.length} listas en espera`;
  }
  if (btnGoToPendientesFromConf) {
    btnGoToPendientesFromConf.textContent = `🛍️ Ver Pendientes de Compra (${pendientes.length})`;
  }

  // Controlar visibilidad de las 2 pantallas
  if (superHomeScreens) superHomeScreens.classList.toggle('hidden', vistaSuperActual !== 'home');
  if (superScreenConfeccion) superScreenConfeccion.classList.toggle('hidden', vistaSuperActual !== 'confeccion');
  if (superScreenPendientes) superScreenPendientes.classList.toggle('hidden', vistaSuperActual !== 'pendientes');

  // --- RENDER PANTALLA 1: CONFECCIONAR LISTA ---
  if (inputSuperListName && document.activeElement !== inputSuperListName) {
    inputSuperListName.value = borrador.nombre || '';
  }

  if (superItemsList) {
    superItemsList.innerHTML = '';
    if (!borrador.items || borrador.items.length === 0) {
      superItemsList.innerHTML = `<div class="empty-state">Esta lista en confección está vacía. Ponele un nombre arriba, agregá los productos y después tocá <b>📌 Guardar en "Pendiente de Compra"</b>.</div>`;
    } else {
      borrador.items.forEach(item => {
        const fila = document.createElement('div');
        fila.className = 'task-item prio-simple super-card-sketch';
        const esComestible = item.comestible !== false;
        const cantTexto = item.cantidad ? item.cantidad : '1 u.';
        const autorTexto = item.autor || (usuarioActivo ? usuarioActivo.nombre : 'Alejandro');
        const precioRec = obtenerPrecioRecordadoSuper(item.texto);
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
              ${precioRec !== null ? `<span style="margin-left:8px; font-size:0.8rem; color:#60a5fa;">(🧠 Últ. precio: ${formatearMonedaSuper(precioRec)})</span>` : ''}
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
            <button type="button" class="super-delete-square" data-action="delete" title="Quitar de esta lista">✕</button>
          </div>
        `;

        fila.querySelector('[data-action="toggle-edible"]').addEventListener('click', () => {
          item.comestible = !esComestible;
          item.updatedAt = Date.now();
          borrador.updatedAt = Date.now();
          renderizarSupermercado();
          guardarEnNube();
        });

        fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
          borrador.items = borrador.items.filter(x => x.id !== item.id);
          borrador.updatedAt = Date.now();
          renderizarSupermercado();
          guardarEnNube();
        });

        superItemsList.appendChild(fila);
      });
    }
  }

  // --- RENDER PANTALLA 2: PENDIENTE DE COMPRA ---
  const listaActiva = pendientes.find(l => l.id === listaPendienteAbiertaId) || null;
  if (!listaActiva) {
    listaPendienteAbiertaId = null;
    modoModificarListaPendiente = false;
  }

  if (superPendingListsOverview) {
    superPendingListsOverview.classList.toggle('hidden', Boolean(listaActiva));
  }
  if (superActivePendingDetail) {
    superActivePendingDetail.classList.toggle('hidden', !listaActiva);
  }

  // Vista 2A: Tarjetas de todas las listas en espera
  if (superPendingListsContainer && !listaActiva) {
    superPendingListsContainer.innerHTML = '';
    if (pendientes.length === 0) {
      superPendingListsContainer.innerHTML = `<div class="empty-state">No tenés listas pendientes de compra en este momento. Tocá <b>+ Confeccionar otra lista</b> para armar una nueva.</div>`;
    } else {
      pendientes.forEach(lista => {
        const totalProd = (lista.items || []).length;
        const tildadosCount = (lista.items || []).filter(i => i.tildado).length;
        const subtotalActual = calcularTotalListaPendiente(lista);
        const card = document.createElement('div');
        card.className = 'task-item prio-simple';
        card.style.flexWrap = 'wrap';
        card.style.gap = '12px';

        const estadoBadge = lista.compraIniciada
          ? `<span class="priority-pill pill-intermedio">🛒 Compra iniciada (${tildadosCount}/${totalProd} · ${formatearMonedaSuper(subtotalActual)})</span>`
          : `<span class="priority-pill pill-simple">⏳ En espera (${totalProd} producto${totalProd === 1 ? '' : 's'})</span>`;

        card.innerHTML = `
          <div class="task-info" style="flex:1 1 220px; cursor:pointer;" data-action="open-list">
            ${estadoBadge}
            <div class="task-text" style="font-size:1.1rem; font-weight:700; margin-top:4px;">📋 ${escaparHTML(lista.nombre || 'Lista de Supermercado')}</div>
          </div>
          <div class="task-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-buy-finish" style="padding:8px 14px; font-size:0.9rem;" data-action="open-list">
              ${lista.compraIniciada ? '🛒 Continuar compra' : '🛍️ Abrir lista'}
            </button>
            <button type="button" class="btn-buy-finish" style="padding:8px 12px; font-size:0.86rem; background:#f59e0b; color:#1e293b; font-weight:700;" data-action="modify-list" title="Modificar productos, cantidades o nombre de esta lista">
              ✏️ Modificar
            </button>
            <button type="button" class="btn-delete" data-action="delete-list" title="Eliminar esta lista">✕</button>
          </div>
        `;

        card.querySelectorAll('[data-action="open-list"]').forEach(btn => {
          btn.addEventListener('click', () => {
            registrarPasoHistorial('super-open-pending');
            listaPendienteAbiertaId = lista.id;
            modoModificarListaPendiente = false;
            renderizarSupermercado();
          });
        });

        card.querySelector('[data-action="modify-list"]').addEventListener('click', () => {
          registrarPasoHistorial('super-open-pending');
          listaPendienteAbiertaId = lista.id;
          modoModificarListaPendiente = true;
          renderizarSupermercado();
          if (inputPendingExtraItem) inputPendingExtraItem.focus();
        });

        card.querySelector('[data-action="delete-list"]').addEventListener('click', () => {
          if (!confirm(`¿Eliminar la lista "${lista.nombre || 'Lista de compras'}" de Pendientes de Compra?`)) return;
          supermercado = supermercado.filter(x => x.id !== lista.id);
          renderizarSupermercado();
          guardarEnNube();
        });

        superPendingListsContainer.appendChild(card);
      });
    }
  }

  // Vista 2B: Detalle de la lista abierta en Pendiente de Compra
  if (listaActiva && superActivePendingItems) {
    if (activePendingListTitle) {
      activePendingListTitle.textContent = `📋 ${listaActiva.nombre || 'Lista de Supermercado'}`;
    }

    const totalItems = (listaActiva.items || []).length;
    const tildadosItems = (listaActiva.items || []).filter(i => i.tildado).length;
    const totalMonto = calcularTotalListaPendiente(listaActiva);

    if (activePendingListStatus) {
      if (modoModificarListaPendiente) {
        activePendingListStatus.textContent = `✏️ Modificando lista (${totalItems} producto${totalItems === 1 ? '' : 's'}) — Podés agregar, quitar o cambiar cantidades`;
      } else {
        activePendingListStatus.textContent = listaActiva.compraIniciada
          ? `🟢 Compra en curso — ${tildadosItems} de ${totalItems} producto(s) en el carrito`
          : `⏳ Lista en espera (${totalItems} producto${totalItems === 1 ? '' : 's'})`;
      }
    }
    if (activePendingTotalBadge) {
      activePendingTotalBadge.textContent = formatearMonedaSuper(totalMonto);
    }

    if (btnToggleModifyActiveList) {
      btnToggleModifyActiveList.textContent = modoModificarListaPendiente
        ? '✅ Guardar modificaciones'
        : '✏️ Modificar lista';
      btnToggleModifyActiveList.style.background = modoModificarListaPendiente ? '#10b981' : '#f59e0b';
      btnToggleModifyActiveList.style.color = modoModificarListaPendiente ? '#052e16' : '#1e293b';
    }

    // Mostrar u ocultar pregunta "¿Iniciar compra?" y panel de modificación
    if (superStartShoppingBox) {
      superStartShoppingBox.style.display = (listaActiva.compraIniciada || modoModificarListaPendiente) ? 'none' : 'flex';
    }
    if (superModifyListBox) {
      superModifyListBox.classList.toggle('hidden', !modoModificarListaPendiente);
      if (modoModificarListaPendiente && inputModifyPendingListName && document.activeElement !== inputModifyPendingListName) {
        inputModifyPendingListName.value = listaActiva.nombre || '';
      }
    }

    if (superCheckoutSummaryLine) {
      superCheckoutSummaryLine.textContent = tildadosItems > 0
        ? `Llevás ${tildadosItems} producto(s) tildados por un total de ${formatearMonedaSuper(totalMonto)}`
        : 'Tildá cada producto al ponerlo en el carrito para cargar su precio y cantidad';
    }
    if (btnFinishShopping) {
      btnFinishShopping.textContent = `💳 ¿Cerrar y pagar? (${formatearMonedaSuper(totalMonto)})`;
    }

    superActivePendingItems.innerHTML = '';
    if (totalItems === 0) {
      superActivePendingItems.innerHTML = `<div class="empty-state">No hay productos en esta lista. Usá el botón <b>✏️ Modificar lista</b> arriba para agregar productos.</div>`;
    } else {
      listaActiva.items.forEach(item => {
        const fila = document.createElement('div');
        fila.className = `task-item prio-simple super-card-sketch ${item.tildado ? 'realizada' : ''}`;

        const esComestible = item.comestible !== false;
        const cantTexto = item.cantidad ? item.cantidad : '1 u.';
        const precioRec = obtenerPrecioRecordadoSuper(item.texto);
        const precioUnitMostrar = Number(item.precioUnitario) > 0
          ? Number(item.precioUnitario)
          : (precioRec !== null ? precioRec : 0);
        const subtotalItem = item.tildado
          ? (Number(item.subtotal) || ( (Number(item.unidadesCalculo) || 1) * precioUnitMostrar ))
          : 0;

        const textoComestible = esComestible ? '✓ 🍎 Comestible' : '🧴 No comestible';
        const claseComestible = esComestible ? 'is-edible' : 'not-edible';

        if (modoModificarListaPendiente) {
          fila.innerHTML = `
            <div class="super-sketch-left" style="width:100%;">
              <div class="form-row" style="margin-bottom:8px; gap:8px; align-items:flex-end;">
                <div class="form-group flex-grow" style="margin-bottom:0;">
                  <label style="font-size:0.78rem; color:#93c5fd;">Producto</label>
                  <input type="text" data-action="input-mod-texto" value="${escaparHTML(item.texto)}" style="padding:7px 10px; font-size:0.95rem;">
                </div>
                <div class="form-group" style="min-width:130px; flex:0 1 150px; margin-bottom:0;">
                  <label style="font-size:0.78rem; color:#fde68a;">Cantidad</label>
                  <input type="text" data-action="input-mod-cant" value="${escaparHTML(cantTexto)}" style="padding:7px 10px; font-size:0.95rem; font-weight:700;">
                </div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="super-sketch-edible-btn ${claseComestible}" data-action="toggle-edible">
                  ${textoComestible}
                </button>
              </div>
            </div>
            <div class="super-sketch-right">
              <button type="button" class="super-delete-square" data-action="delete" title="Quitar de la lista">✕</button>
            </div>
          `;

          const inpModTexto = fila.querySelector('[data-action="input-mod-texto"]');
          const inpModCant = fila.querySelector('[data-action="input-mod-cant"]');

          if (inpModTexto) {
            inpModTexto.addEventListener('input', () => {
              item.texto = inpModTexto.value;
              item.updatedAt = Date.now();
              listaActiva.updatedAt = Date.now();
            });
            inpModTexto.addEventListener('change', () => {
              item.texto = inpModTexto.value.trim() || item.texto;
              guardarEnNube();
            });
          }

          if (inpModCant) {
            inpModCant.addEventListener('input', () => {
              item.cantidad = inpModCant.value;
              item.unidadesCalculo = estimarUnidadesMultiplicador(item.cantidad);
              if (item.tildado && Number(item.precioUnitario) > 0) {
                item.subtotal = Math.round(item.unidadesCalculo * Number(item.precioUnitario) * 100) / 100;
              }
              item.updatedAt = Date.now();
              listaActiva.updatedAt = Date.now();
            });
            inpModCant.addEventListener('change', () => {
              item.cantidad = inpModCant.value.trim() || '1 u.';
              guardarEnNube();
            });
          }
        } else {
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
                <span class="super-sketch-label">Precio:</span>
                ${item.tildado
                  ? `<strong style="color:#34d399;">Unit.: ${formatearMonedaSuper(precioUnitMostrar)} ➔ Subtotal: ${formatearMonedaSuper(subtotalItem)}</strong>`
                  : (precioRec !== null
                      ? `<span style="color:#93c5fd;">🧠 Precio recordado: <strong>${formatearMonedaSuper(precioRec)}</strong> (se pedirá al tildar)</span>`
                      : `<span style="color:#94a3b8;">Se pedirá al tildar el producto</span>`
                    )
                }
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:4px;">
                <button type="button" class="super-sketch-edible-btn ${claseComestible}" data-action="toggle-edible">
                  ${textoComestible}
                </button>
                <button type="button" class="btn-secondary" style="padding:4px 10px; font-size:0.8rem;" data-action="quick-edit-qty">
                  ✏️ Cambiar cantidad
                </button>
                ${item.tildado ? `<button type="button" class="btn-secondary" style="padding:4px 10px; font-size:0.8rem;" data-action="edit-price">💲 Precio</button>` : ''}
              </div>
            </div>
            <div class="super-sketch-right">
              <button type="button" class="super-check-btn ${item.tildado ? 'checked' : ''}" data-action="check" title="Tildar producto e ingresar precio y cantidad">
                ${item.tildado ? '✓' : ''}
              </button>
              <button type="button" class="super-delete-square" data-action="delete" title="Eliminar de la lista">✕</button>
            </div>
          `;

          fila.querySelector('[data-action="check"]').addEventListener('click', () => {
            if (!listaActiva.compraIniciada) {
              if (!confirm('¿Iniciar compra ahora para empezar a tildar productos?')) return;
              listaActiva.compraIniciada = true;
              listaActiva.updatedAt = Date.now();
              renderizarSupermercado();
            }
            abrirModalPrecioProductoSuper(listaActiva, item);
          });

          const btnQuickQty = fila.querySelector('[data-action="quick-edit-qty"]');
          if (btnQuickQty) {
            btnQuickQty.addEventListener('click', () => {
              const nuevaCant = prompt(`Cambiar cantidad para "${item.texto}":`, item.cantidad || '1 u.');
              if (nuevaCant === null) return;
              const limpia = nuevaCant.trim();
              if (!limpia) return;
              item.cantidad = limpia;
              item.unidadesCalculo = estimarUnidadesMultiplicador(limpia);
              if (item.tildado && Number(item.precioUnitario) > 0) {
                item.subtotal = Math.round(item.unidadesCalculo * Number(item.precioUnitario) * 100) / 100;
              }
              item.updatedAt = Date.now();
              listaActiva.updatedAt = Date.now();
              renderizarSupermercado();
              guardarEnNube();
            });
          }

          const btnEditPrice = fila.querySelector('[data-action="edit-price"]');
          if (btnEditPrice) {
            btnEditPrice.addEventListener('click', () => {
              abrirModalPrecioProductoSuper(listaActiva, item);
            });
          }
        }

        fila.querySelector('[data-action="toggle-edible"]').addEventListener('click', () => {
          item.comestible = !esComestible;
          item.updatedAt = Date.now();
          listaActiva.updatedAt = Date.now();
          renderizarSupermercado();
          guardarEnNube();
        });

        fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
          listaActiva.items = listaActiva.items.filter(x => x.id !== item.id);
          listaActiva.updatedAt = Date.now();
          renderizarSupermercado();
          guardarEnNube();
        });

        superActivePendingItems.appendChild(fila);
      });
    }
  }
}

// ==========================================
// EXTRAS -> 3. HELADERA Y GENERADOR DE RECETAS CON IA
// ==========================================
const inputFridgeName = document.getElementById('input-fridge-name');
const inputFridgeQty = document.getElementById('input-fridge-qty');
const btnAddFridgeItem = document.getElementById('btn-add-fridge-item');
const fridgeItemsList = document.getElementById('fridge-items-list');
const btnGenerateRecipe = document.getElementById('btn-generate-recipe');
const btnGenerateSelectedRecipe = document.getElementById('btn-generate-selected-recipe');
const fridgeSelectionBar = document.getElementById('fridge-selection-bar');
const fridgeSelectionStatus = document.getElementById('fridge-selection-status');
const btnConfirmSelectedRecipe = document.getElementById('btn-confirm-selected-recipe');
const btnCancelFridgeSelection = document.getElementById('btn-cancel-fridge-selection');
const btnCookRecipe = document.getElementById('btn-cook-recipe');
const btnAnotherRecipe = document.getElementById('btn-another-recipe');
const fridgeRecipeBox = document.getElementById('fridge-recipe-box');
const fridgeRecipeTitle = document.getElementById('fridge-recipe-title');
const fridgeRecipeContent = document.getElementById('fridge-recipe-content');
const fridgeRecipeActions = document.getElementById('fridge-recipe-actions');
const fridgeDiscountFeedback = document.getElementById('fridge-discount-feedback');

let modoSeleccionHeladera = false;
let ingredientesSeleccionadosIds = new Set();
let ultimoModoSeleccionados = false;
let ultimosIdsSeleccionados = [];
let ultimaRecetaTexto = '';
let historialRecetasDescartadas = [];
let recetaYaDescontada = false;

function agregarIngredienteHeladera() {
  if (!usuarioActivo) return;
  const nombre = inputFridgeName.value.trim();
  const cantidad = inputFridgeQty.value.trim() || 'Cantidad necesaria';
  if (!nombre) {
    inputFridgeName.focus();
    return;
  }

  const resSuma = sumarOAgregarIngredienteEnHeladera(nombre, cantidad);

  inputFridgeName.value = '';
  inputFridgeQty.value = '';
  renderizarHeladera();
  inputFridgeName.focus();
  guardarEnNube();

  if (resSuma.necesitaIA) {
    unificarCantidadesHeladeraConIA([resSuma.id]);
  }
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

function actualizarBarraSeleccionHeladera() {
  // Limpiar IDs que ya no existan en heladera
  const idsValidos = new Set(heladera.map(x => x.id));
  Array.from(ingredientesSeleccionadosIds).forEach(id => {
    if (!idsValidos.has(id)) ingredientesSeleccionadosIds.delete(id);
  });

  const cantSel = ingredientesSeleccionadosIds.size;
  if (fridgeSelectionBar) {
    if (modoSeleccionHeladera || cantSel > 0) {
      fridgeSelectionBar.classList.remove('hidden');
    } else {
      fridgeSelectionBar.classList.add('hidden');
    }
  }
  if (fridgeSelectionStatus) {
    fridgeSelectionStatus.textContent = cantSel > 0
      ? `✅ ${cantSel} ingrediente${cantSel === 1 ? '' : 's'} seleccionado${cantSel === 1 ? '' : 's'} para cocinar`
      : '👆 Tildá en la lista los ingredientes que querés usar hoy y tocá "Armar receta con seleccionados"';
  }
  if (btnGenerateSelectedRecipe) {
    btnGenerateSelectedRecipe.textContent = cantSel > 0
      ? `☑️ Generar con Seleccionados (${cantSel})`
      : '☑️ Generar con Ingredientes Seleccionados';
  }
}

function renderizarHeladera() {
  if (!fridgeItemsList) return;
  actualizarContadoresYAlertas();
  actualizarBarraSeleccionHeladera();
  fridgeItemsList.innerHTML = '';

  if (heladera.length === 0) {
    fridgeItemsList.innerHTML = `<div class="empty-state">Tu heladera está vacía. Cargá arriba los ingredientes y cantidades que tenés disponibles y después tocá <b>🎲 Generar Receta Aleatoria</b> o <b>☑️ Generar con Ingredientes Seleccionados</b>.</div>`;
    return;
  }

  heladera.forEach(ing => {
    const seleccionado = ingredientesSeleccionadosIds.has(ing.id);
    const fila = document.createElement('div');
    fila.className = 'task-item prio-simple';
    if (seleccionado) {
      fila.style.borderColor = '#3b82f6';
      fila.style.background = 'rgba(59, 130, 246, 0.12)';
    }

    fila.innerHTML = `
      <div class="task-info" style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1;" data-action="toggle-select">
        <button type="button" class="super-check-btn ${seleccionado ? 'checked' : ''}" style="width:32px; height:32px; flex-shrink:0; ${modoSeleccionHeladera && !seleccionado ? 'border-color:#60a5fa; box-shadow:0 0 0 2px rgba(59,130,246,0.35);' : ''}" title="Seleccionar ingrediente para receta">
          ${seleccionado ? '✓' : ''}
        </button>
        <span class="priority-pill pill-simple">🥬 ${escaparHTML(ing.cantidad)}</span>
        <span class="task-text" style="font-weight:${seleccionado ? '700' : '500'};">${escaparHTML(ing.nombre)}</span>
      </div>
      <div class="task-actions">
        <button type="button" class="btn-delete" data-action="delete" title="Quitar ingrediente">✕</button>
      </div>
    `;

    fila.querySelector('[data-action="toggle-select"]').addEventListener('click', () => {
      if (ingredientesSeleccionadosIds.has(ing.id)) {
        ingredientesSeleccionadosIds.delete(ing.id);
      } else {
        ingredientesSeleccionadosIds.add(ing.id);
      }
      renderizarHeladera();
    });

    fila.querySelector('[data-action="delete"]').addEventListener('click', () => {
      ingredientesSeleccionadosIds.delete(ing.id);
      heladera = heladera.filter(x => x.id !== ing.id);
      renderizarHeladera();
      guardarEnNube();
    });

    fridgeItemsList.appendChild(fila);
  });
}

async function generarRecetaDesdeHeladera(esOtraOpcion, soloSeleccionados) {
  if (heladera.length === 0) {
    alert('Primero agregá al menos un ingrediente en tu heladera para que la IA pueda armarte la receta.');
    if (inputFridgeName) inputFridgeName.focus();
    return;
  }

  const usarSeleccionados = esOtraOpcion ? ultimoModoSeleccionados : Boolean(soloSeleccionados);
  let itemsParaReceta = [];

  if (usarSeleccionados) {
    const idsTarget = esOtraOpcion && ultimosIdsSeleccionados.length > 0
      ? ultimosIdsSeleccionados
      : Array.from(ingredientesSeleccionadosIds);
    itemsParaReceta = heladera.filter(x => idsTarget.includes(x.id));
    if (itemsParaReceta.length === 0) {
      modoSeleccionHeladera = true;
      renderizarHeladera();
      if (fridgeSelectionBar) fridgeSelectionBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    ultimosIdsSeleccionados = itemsParaReceta.map(x => x.id);
  } else {
    itemsParaReceta = [...heladera];
    ultimosIdsSeleccionados = itemsParaReceta.map(x => x.id);
  }

  if (!esOtraOpcion) {
    historialRecetasDescartadas = [];
  } else if (ultimaRecetaTexto) {
    historialRecetasDescartadas.push(ultimaRecetaTexto.slice(0, 350));
  }

  ultimoModoSeleccionados = usarSeleccionados;
  recetaYaDescontada = false;

  const listado = itemsParaReceta.map(i => `- ${i.nombre} (Cantidad disponible: ${i.cantidad})`).join('\n');
  const previasTexto = historialRecetasDescartadas.length > 0
    ? `\n\nIMPORTANTE: El usuario pidió OTRA RECETA DISTINTA porque no quiso las anteriores. NO repitas ninguna de estas recetas previas:\n${historialRecetasDescartadas.map((r, idx) => `[Opción descartada ${idx + 1}]: ${r}`).join('\n')}\n`
    : '';

  const instruccionModo = usarSeleccionados
    ? `El usuario seleccionó específicamente estos ingredientes para cocinar hoy:\n${listado}\n\nArmame una receta rica y casera usando EXCLUSIVAMENTE estos ingredientes seleccionados (más condimentos básicos como sal, aceite, pimienta o agua), sin agregar otros ingredientes principales que no estén en esta selección.`
    : `Tengo estos ingredientes disponibles en mi heladera/cocina:\n${listado}\n\nArmame una receta aleatoria, rica y casera combinando todos o algunos de estos ingredientes disponibles (más condimentos básicos como sal, aceite, pimienta o agua).`;

  const promptReceta = `${instruccionModo}${previasTexto}\n\nRespetá las cantidades máximas disponibles y detallá claramente:\n1. Nombre del plato\n2. Lista exacta de ingredientes y qué cantidad se usa de cada uno\n3. Paso a paso claro y numerado para cocinarlo.`;

  if (btnGenerateRecipe) {
    btnGenerateRecipe.disabled = true;
    if (!usarSeleccionados) btnGenerateRecipe.textContent = '🍳 Generando receta...';
  }
  if (btnGenerateSelectedRecipe) {
    btnGenerateSelectedRecipe.disabled = true;
    if (usarSeleccionados) btnGenerateSelectedRecipe.textContent = '🍳 Generando con seleccionados...';
  }
  if (btnAnotherRecipe) btnAnotherRecipe.disabled = true;
  if (btnCookRecipe) {
    btnCookRecipe.disabled = true;
    btnCookRecipe.textContent = '✅ Sí, cocinaré la receta';
    btnCookRecipe.style.background = '#10b981';
  }
  if (fridgeDiscountFeedback) {
    fridgeDiscountFeedback.classList.add('hidden');
    fridgeDiscountFeedback.innerHTML = '';
  }
  if (fridgeRecipeTitle) {
    fridgeRecipeTitle.textContent = usarSeleccionados
      ? `👨‍🍳 Receta con tus ${itemsParaReceta.length} ingrediente(s) seleccionado(s)`
      : '👨‍🍳 Receta aleatoria sugerida con tu heladera';
  }

  fridgeRecipeBox.classList.remove('hidden');
  fridgeRecipeContent.innerHTML = '⏳ Pensando la mejor receta paso a paso con tus ingredientes...';
  fridgeRecipeBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
      ultimaRecetaTexto = texto;
      fridgeRecipeContent.innerHTML = escaparHTML(texto).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (btnCookRecipe) btnCookRecipe.disabled = false;
    } else {
      fridgeRecipeContent.textContent = 'Hubo un problema al generar la receta. Tocá el botón de nuevo.';
    }
  } catch (e) {
    fridgeRecipeContent.textContent = 'Error de conexión al consultar a la IA.';
  } finally {
    if (btnGenerateRecipe) {
      btnGenerateRecipe.disabled = false;
      btnGenerateRecipe.textContent = '🎲 Generar Receta Aleatoria';
    }
    if (btnGenerateSelectedRecipe) {
      btnGenerateSelectedRecipe.disabled = false;
    }
    if (btnAnotherRecipe) btnAnotherRecipe.disabled = false;
    actualizarBarraSeleccionHeladera();
  }
}

async function descontarIngredientesRecetaConIA() {
  if (!ultimaRecetaTexto || recetaYaDescontada) return;
  if (heladera.length === 0) return;

  if (btnCookRecipe) {
    btnCookRecipe.disabled = true;
    btnCookRecipe.textContent = '⏳ IA descontando cantidades usadas...';
  }
  if (btnAnotherRecipe) btnAnotherRecipe.disabled = true;

  const inventarioActual = heladera.map(h => ({
    id: h.id,
    nombre: h.nombre,
    cantidad: h.cantidad
  }));

  const promptDescuento = `El usuario confirmó que va a cocinar la siguiente receta y necesitamos descontar de su heladera las cantidades utilizadas.

INVENTARIO ACTUAL EN LA HELADERA (JSON):
${JSON.stringify(inventarioActual, null, 2)}

RECETA QUE VA A COCINAR:
${ultimaRecetaTexto}

INSTRUCCIONES DE DESCUENTO:
1. Analizá qué ingredientes del inventario se usan en esta receta y qué cantidad utiliza la receta de cada uno.
2. Restá la cantidad usada de la cantidad disponible en el inventario (interpretando unidades naturales como kg, gramos, litros, ml, unidades, pechugas, paquetes, o sumas como "1 litro + 2 litros").
3. Si un ingrediente usado se consume en su totalidad (queda 0 o menos, o si su cantidad decía "Cantidad necesaria" / "un poco" y se usó en la receta), marcá "agotado": true y "cantidadRestante": "0".
4. Si de un ingrediente usado todavía sobra cantidad (por ejemplo tenía "1 kg" y la receta usa "300 g", o tenía "6 u." y usa "2"), marcá "agotado": false y poné en "cantidadRestante" lo que queda expresado claramente (ej: "700g", "4 u.").
5. Si un ingrediente del inventario NO se menciona ni se usa en la receta, dejalo intacto con "agotado": false y su misma "cantidadRestante".

Respondé ÚNICAMENTE con un objeto JSON válido (sin texto extra fuera del JSON) con esta estructura exacta:
{
  "items": [
    { "id": "id_del_ingrediente", "nombre": "Nombre", "agotado": false, "cantidadRestante": "cantidad que queda", "usadoEnReceta": true, "detalle": "Se usaron X, quedan Y" }
  ]
}`;

  try {
    const res = await fetch(API_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreUsuario: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
        mensaje: promptDescuento,
        historial: []
      })
    });

    let aplicadoConExito = false;
    let detallesCambios = [];

    if (res.ok) {
      const data = await res.json();
      const raw = String(data.respuesta || '');
      const matchJson = raw.match(/\{[\s\S]*\}/);
      if (matchJson) {
        try {
          const parsed = JSON.parse(matchJson[0]);
          if (parsed && Array.isArray(parsed.items)) {
            const mapaActualizaciones = new Map();
            parsed.items.forEach(item => {
              if (item && item.id) mapaActualizaciones.set(item.id, item);
            });

            const nuevaHeladera = [];
            heladera.forEach(ing => {
              const info = mapaActualizaciones.get(ing.id) || parsed.items.find(
                x => (x.nombre || '').trim().toLowerCase() === (ing.nombre || '').trim().toLowerCase()
              );

              if (!info) {
                nuevaHeladera.push(ing);
                return;
              }

              const cantRest = String(info.cantidadRestante || '').trim();
              const seAgoto = Boolean(info.agotado) || cantRest === '0' || /^0(\s|$|[a-zA-Z])/.test(cantRest);

              if (seAgoto) {
                ingredientesSeleccionadosIds.delete(ing.id);
                detallesCambios.push(`🗑️ <b>${escaparHTML(ing.nombre)}</b>: consumido por completo (se quitó de la heladera).`);
              } else {
                const cambioCantidad = cantRest && cantRest !== ing.cantidad;
                if (cambioCantidad || info.usadoEnReceta) {
                  detallesCambios.push(`📉 <b>${escaparHTML(ing.nombre)}</b>: tenía <em>${escaparHTML(ing.cantidad)}</em> ➔ ahora quedan <b>${escaparHTML(cantRest || ing.cantidad)}</b>.`);
                }
                nuevaHeladera.push({
                  ...ing,
                  cantidad: cantRest || ing.cantidad,
                  updatedAt: Date.now()
                });
              }
            });

            heladera = nuevaHeladera;
            aplicadoConExito = true;
          }
        } catch (errParse) {}
      }
    }

    if (!aplicadoConExito) {
      // Respaldo inteligente si la respuesta no vino en JSON estricto
      const textoRecetaMin = ultimaRecetaTexto.toLowerCase();
      const nuevaHeladera = [];
      heladera.forEach(ing => {
        const nombreMin = (ing.nombre || '').trim().toLowerCase();
        if (nombreMin && textoRecetaMin.includes(nombreMin)) {
          ingredientesSeleccionadosIds.delete(ing.id);
          detallesCambios.push(`📉 <b>${escaparHTML(ing.nombre)}</b>: descontado de la heladera.`);
        } else {
          nuevaHeladera.push(ing);
        }
      });
      heladera = nuevaHeladera;
    }

    recetaYaDescontada = true;
    modoSeleccionHeladera = false;
    renderizarHeladera();
    guardarEnNube();

    if (btnCookRecipe) {
      btnCookRecipe.disabled = true;
      btnCookRecipe.textContent = '✅ ¡Ingredientes descontados de tu Heladera!';
      btnCookRecipe.style.background = '#059669';
    }
    if (fridgeDiscountFeedback) {
      fridgeDiscountFeedback.classList.remove('hidden');
      fridgeDiscountFeedback.innerHTML = detallesCambios.length > 0
        ? `<strong>👨‍🍳 ¡A cocinar! La IA actualizó el stock de tu heladera:</strong><br>${detallesCambios.join('<br>')}`
        : `<strong>👨‍🍳 ¡A cocinar! Se actualizaron los ingredientes de tu heladera.</strong>`;
    }
  } catch (e) {
    if (btnCookRecipe) {
      btnCookRecipe.disabled = false;
      btnCookRecipe.textContent = '✅ Sí, cocinaré la receta';
    }
    alert('No se pudo conectar con la IA para descontar los ingredientes. Intentá nuevamente.');
  } finally {
    if (btnAnotherRecipe) btnAnotherRecipe.disabled = false;
  }
}

if (btnGenerateRecipe) {
  btnGenerateRecipe.addEventListener('click', () => {
    modoSeleccionHeladera = false;
    generarRecetaDesdeHeladera(false, false);
  });
}

if (btnGenerateSelectedRecipe) {
  btnGenerateSelectedRecipe.addEventListener('click', () => {
    if (heladera.length === 0) {
      alert('Primero agregá al menos un ingrediente en tu heladera.');
      if (inputFridgeName) inputFridgeName.focus();
      return;
    }
    if (ingredientesSeleccionadosIds.size > 0) {
      generarRecetaDesdeHeladera(false, true);
    } else {
      modoSeleccionHeladera = true;
      renderizarHeladera();
      if (fridgeSelectionBar) fridgeSelectionBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (btnConfirmSelectedRecipe) {
  btnConfirmSelectedRecipe.addEventListener('click', () => {
    if (ingredientesSeleccionadosIds.size === 0) {
      alert('Tildá al menos un ingrediente de la lista con el botón "✓" para armar la receta.');
      return;
    }
    generarRecetaDesdeHeladera(false, true);
  });
}

if (btnCancelFridgeSelection) {
  btnCancelFridgeSelection.addEventListener('click', () => {
    modoSeleccionHeladera = false;
    ingredientesSeleccionadosIds.clear();
    renderizarHeladera();
  });
}

if (btnCookRecipe) {
  btnCookRecipe.addEventListener('click', descontarIngredientesRecetaConIA);
}

if (btnAnotherRecipe) {
  btnAnotherRecipe.addEventListener('click', () => {
    generarRecetaDesdeHeladera(true, ultimoModoSeleccionados);
  });
}

// ==========================================
// EXTRAS -> 4. ENTRENAMIENTO (MÚLTIPLES RUTINAS + COMPARTIR CON AMIGOS DE LA APP)
// ==========================================
const workoutZonesSelector = document.getElementById('workout-zones-selector');
const btnSelectAllZones = document.getElementById('btn-select-all-zones');
const workoutSplitPreview = document.getElementById('workout-split-preview');
const inputWorkoutName = document.getElementById('input-workout-name');
const inputWorkoutDays = document.getElementById('input-workout-days');
const inputWorkoutTime = document.getElementById('input-workout-time');
const inputWorkoutDuration = document.getElementById('input-workout-duration');
const btnGenerateWorkout = document.getElementById('btn-generate-workout');
const btnAnotherWorkout = document.getElementById('btn-another-workout');
const workoutRoutineBox = document.getElementById('workout-routine-box');
const workoutRoutineContent = document.getElementById('workout-routine-content');
const workoutExpiryBadge = document.getElementById('workout-expiry-badge');
const workoutActiveTitle = document.getElementById('workout-active-title');
const workoutShareStatusBadge = document.getElementById('workout-share-status-badge');

const btnNewWorkoutToggle = document.getElementById('btn-new-workout-toggle');
const workoutRoutinesSwitcherWrap = document.getElementById('workout-routines-switcher-wrap');
const workoutRoutinesPillsContainer = document.getElementById('workout-routines-pills-container');
const workoutCreatorBox = document.getElementById('workout-creator-box');
const btnCancelNewWorkout = document.getElementById('btn-cancel-new-workout');
const btnWorkoutModeSolo = document.getElementById('btn-workout-mode-solo');
const btnWorkoutModeShared = document.getElementById('btn-workout-mode-shared');
const workoutNewShareUsersBox = document.getElementById('workout-new-share-users-box');
const workoutNewShareCheckboxes = document.getElementById('workout-new-share-checkboxes');

const workoutShareModalBox = document.getElementById('workout-share-modal-box');
const workoutShareModalSubtitle = document.getElementById('workout-share-modal-subtitle');
const workoutEditShareCheckboxes = document.getElementById('workout-edit-share-checkboxes');
const btnWhatsappShareWorkout = document.getElementById('btn-whatsapp-share-workout');
const btnCloseWorkoutShare = document.getElementById('btn-close-workout-share');
const btnSaveWorkoutShare = document.getElementById('btn-save-workout-share');
const btnRenameWorkout = document.getElementById('btn-rename-workout');
const btnOpenShareWorkout = document.getElementById('btn-open-share-workout');
const btnDeleteWorkout = document.getElementById('btn-delete-workout');

const TODAS_LAS_ZONAS_GYM = ['Pecho', 'Espalda', 'Bíceps', 'Tríceps', 'Hombros', 'Piernas'];
let zonasSeleccionadasEntrenamiento = new Set(['Pecho', 'Espalda', 'Bíceps', 'Tríceps', 'Hombros', 'Piernas']);
let indiceVarianteRutina = 0;
let idRutinaGymActiva = null;
let mostrandoCreadorRutina = false;
let modoNuevaRutina = 'solo';
let amigosSeleccionadosNuevaRutina = new Set();
let amigosSeleccionadosEdicionRutina = new Set();

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

function asegurarEstructuraPasosLocal(entObj) {
  if (!entObj || typeof entObj !== 'object') return;
  if (!entObj.pasosData || typeof entObj.pasosData !== 'object') {
    entObj.pasosData = {
      metaDiaria: 8000,
      dias: {},
      sesiones: []
    };
  }
  if (!entObj.pasosData.metaDiaria || Number(entObj.pasosData.metaDiaria) < 500) {
    entObj.pasosData.metaDiaria = 8000;
  }
  if (!entObj.pasosData.dias || typeof entObj.pasosData.dias !== 'object') {
    entObj.pasosData.dias = {};
  }
  if (!Array.isArray(entObj.pasosData.sesiones)) {
    entObj.pasosData.sesiones = [];
  }
}

function normalizarEstructuraEntrenamientoLocal() {
  if (!entrenamiento || typeof entrenamiento !== 'object') {
    entrenamiento = { rutinas: [], rutinaActivaId: null, borradasRutinas: [], pasosData: { metaDiaria: 8000, dias: {}, sesiones: [] } };
    return entrenamiento;
  }

  if (Array.isArray(entrenamiento.rutinas)) {
    if (!Array.isArray(entrenamiento.borradasRutinas)) {
      entrenamiento.borradasRutinas = [];
    }
    const setBorradas = new Set(entrenamiento.borradasRutinas);
    entrenamiento.rutinas = entrenamiento.rutinas.filter(r => r && typeof r === 'object' && !setBorradas.has(r.id));
    asegurarEstructuraPasosLocal(entrenamiento);
    return entrenamiento;
  }

  // Migrar rutina única anterior a colección de rutinas sin perder nada
  if (Array.isArray(entrenamiento.diasPlan) || entrenamiento.rutinaTexto) {
    const legacy = entrenamiento;
    const zonasLegacy = Array.isArray(legacy.zonas) && legacy.zonas.length > 0 ? legacy.zonas : Array.from(zonasSeleccionadasEntrenamiento);
    const cantDiasLegacy = legacy.diasNumero || 3;
    const tiempoLegacy = legacy.tiempo || '45 minutos';
    const planLegacy = Array.isArray(legacy.diasPlan) && legacy.diasPlan.length > 0
      ? legacy.diasPlan
      : construirPlanEstructuradoEjercicios(zonasLegacy, cantDiasLegacy, tiempoLegacy, 0);

    const rutinaMigrada = {
      id: legacy.id || ('rut-' + (legacy.creadoEl || Date.now())),
      nombre: legacy.nombre || 'Mi Rutina #1',
      creadorId: legacy.creadorId || (usuarioActivo ? usuarioActivo.id : 'alejandro'),
      creadorNombre: legacy.creadorNombre || (usuarioActivo ? usuarioActivo.nombre : 'Alejandro'),
      compartidaCon: Array.isArray(legacy.compartidaCon) ? legacy.compartidaCon : [],
      zonas: zonasLegacy,
      diasNumero: cantDiasLegacy,
      dias: legacy.dias || `${cantDiasLegacy} día${cantDiasLegacy === 1 ? '' : 's'} por semana`,
      tiempo: tiempoLegacy,
      duracion: legacy.duracion || '1 mes',
      varianteOffset: legacy.varianteOffset || 0,
      creadoEl: legacy.creadoEl || Date.now(),
      venceEl: legacy.venceEl || (Date.now() + 30 * 24 * 60 * 60 * 1000),
      diasPlan: planLegacy,
      updatedAt: legacy.updatedAt || Date.now()
    };

    entrenamiento = {
      rutinas: [rutinaMigrada],
      rutinaActivaId: rutinaMigrada.id,
      borradasRutinas: [],
      pasosData: legacy.pasosData || { metaDiaria: 8000, dias: {}, sesiones: [] }
    };
    asegurarEstructuraPasosLocal(entrenamiento);
    return entrenamiento;
  }

  entrenamiento = { rutinas: [], rutinaActivaId: null, borradasRutinas: [], pasosData: { metaDiaria: 8000, dias: {}, sesiones: [] } };
  return entrenamiento;
}

function obtenerListaRutinasGym() {
  return normalizarEstructuraEntrenamientoLocal().rutinas;
}

function obtenerRutinaGymActiva() {
  const est = normalizarEstructuraEntrenamientoLocal();
  if (est.rutinas.length === 0) {
    idRutinaGymActiva = null;
    est.rutinaActivaId = null;
    return null;
  }
  const buscado = idRutinaGymActiva || est.rutinaActivaId;
  let encontrada = est.rutinas.find(r => r.id === buscado);
  if (!encontrada) {
    encontrada = est.rutinas[0];
  }
  idRutinaGymActiva = encontrada.id;
  est.rutinaActivaId = encontrada.id;
  return encontrada;
}

function obtenerAmigosParaCompartirRutina() {
  const todosOtros = (listaUsuariosPublica || []).filter(u => usuarioActivo && u.id !== usuarioActivo.id);
  const vinculosMap = new Map();
  (usuarioActivo?.vinculos || []).forEach(v => {
    if (v && v.usuarioId) vinculosMap.set(v.usuarioId, v);
  });

  // Ordenar poniendo primero a los amigos/convivientes vinculados y luego al resto de usuarios de la app
  return [...todosOtros].sort((a, b) => {
    const aVinc = vinculosMap.has(a.id) ? 0 : 1;
    const bVinc = vinculosMap.has(b.id) ? 0 : 1;
    if (aVinc !== bVinc) return aVinc - bVinc;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''));
  });
}

function renderizarCheckboxesAmigosRutina(contenedor, setSeleccionados) {
  if (!contenedor) return;
  contenedor.innerHTML = '';
  const amigos = obtenerAmigosParaCompartirRutina();
  if (amigos.length === 0) {
    contenedor.innerHTML = '<div style="color: #94a3b8; font-size: 0.88rem; font-style: italic; padding: 6px;">Aún no hay otros usuarios registrados en la app para compartir.</div>';
    return;
  }

  const vinculosMap = new Map();
  (usuarioActivo?.vinculos || []).forEach(v => {
    if (v && v.usuarioId) vinculosMap.set(v.usuarioId, v);
  });

  amigos.forEach(u => {
    const item = document.createElement('label');
    item.className = 'share-user-check-item';
    const checked = setSeleccionados.has(u.id);
    const vinc = vinculosMap.get(u.id);
    const badgeVinculo = vinc
      ? (vinc.tipo === 'convivientes'
          ? '<span class="priority-pill pill-verde" style="font-size:0.72rem; margin-left:auto;">🏠 Conviviente</span>'
          : '<span class="priority-pill pill-hora" style="font-size:0.72rem; margin-left:auto;">👥 Amigo</span>')
      : '<span class="priority-pill pill-simple" style="font-size:0.72rem; margin-left:auto;">👤 Usuario de la app</span>';

    item.innerHTML = `
      <input type="checkbox" data-user-id="${u.id}" ${checked ? 'checked' : ''}>
      <span class="user-avatar">${u.avatar || '👤'}</span>
      <span class="user-name">${escaparHTML(u.nombre)}</span>
      ${badgeVinculo}
    `;
    const chk = item.querySelector('input');
    chk.addEventListener('change', () => {
      if (chk.checked) {
        setSeleccionados.add(u.id);
      } else {
        setSeleccionados.delete(u.id);
      }
    });
    contenedor.appendChild(item);
  });
}

function actualizarModoNuevaRutinaUI() {
  if (btnWorkoutModeSolo) btnWorkoutModeSolo.classList.toggle('active', modoNuevaRutina === 'solo');
  if (btnWorkoutModeShared) btnWorkoutModeShared.classList.toggle('active', modoNuevaRutina === 'shared');
  if (workoutNewShareUsersBox) {
    if (modoNuevaRutina === 'shared') {
      workoutNewShareUsersBox.classList.remove('hidden');
      renderizarCheckboxesAmigosRutina(workoutNewShareCheckboxes, amigosSeleccionadosNuevaRutina);
    } else {
      workoutNewShareUsersBox.classList.add('hidden');
    }
  }
}

if (btnWorkoutModeSolo) {
  btnWorkoutModeSolo.addEventListener('click', () => {
    modoNuevaRutina = 'solo';
    actualizarModoNuevaRutinaUI();
  });
}

if (btnWorkoutModeShared) {
  btnWorkoutModeShared.addEventListener('click', () => {
    modoNuevaRutina = 'shared';
    actualizarModoNuevaRutinaUI();
  });
}

if (btnNewWorkoutToggle) {
  btnNewWorkoutToggle.addEventListener('click', () => {
    const rutinas = obtenerListaRutinasGym();
    if (rutinas.length === 0) {
      mostrandoCreadorRutina = true;
      renderizarEntrenamiento();
      if (inputWorkoutName) inputWorkoutName.focus();
      return;
    }
    mostrandoCreadorRutina = !mostrandoCreadorRutina;
    if (mostrandoCreadorRutina) {
      registrarPasoHistorial('workout-creator');
      if (workoutShareModalBox) workoutShareModalBox.classList.add('hidden');
    }
    renderizarEntrenamiento();
    if (mostrandoCreadorRutina && inputWorkoutName) {
      inputWorkoutName.focus();
    }
  });
}

if (btnCancelNewWorkout) {
  btnCancelNewWorkout.addEventListener('click', () => {
    mostrandoCreadorRutina = false;
    renderizarEntrenamiento();
  });
}

function renderizarEntrenamiento() {
  actualizarBotonesZonasEntrenamiento();
  if (!workoutRoutineBox || !workoutRoutineContent) return;

  const rutinas = obtenerListaRutinasGym();
  const rutinaActiva = obtenerRutinaGymActiva();

  // Actualizar contador de Uso Diario
  const extraWorkoutCounter = document.getElementById('extra-workout-counter');
  if (extraWorkoutCounter) {
    extraWorkoutCounter.textContent = rutinas.length === 0
      ? 'Crear rutina'
      : (rutinas.length === 1 ? '1 rutina activa' : `${rutinas.length} rutinas activas`);
  }

  // 1. Selector de múltiples rutinas en píldoras
  if (workoutRoutinesSwitcherWrap && workoutRoutinesPillsContainer) {
    if (rutinas.length > 0) {
      workoutRoutinesSwitcherWrap.classList.remove('hidden');
      workoutRoutinesPillsContainer.innerHTML = '';
      rutinas.forEach((r, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const esActiva = rutinaActiva && r.id === rutinaActiva.id;
        btn.className = `btn-list-pill ${esActiva ? 'active' : ''}`;
        const esCompartida = (Array.isArray(r.compartidaCon) && r.compartidaCon.length > 0) || (r.creadorId && usuarioActivo && r.creadorId !== usuarioActivo.id);
        const icono = esCompartida ? '👥' : '💪';
        const nombreMostrar = r.nombre || `Rutina #${idx + 1}`;
        const diasInfo = r.diasNumero ? `${r.diasNumero}d/sem` : '3d/sem';
        btn.textContent = `${icono} ${nombreMostrar} (${diasInfo})`;
        btn.onclick = () => {
          idRutinaGymActiva = r.id;
          entrenamiento.rutinaActivaId = r.id;
          mostrandoCreadorRutina = false;
          if (workoutShareModalBox) workoutShareModalBox.classList.add('hidden');
          renderizarEntrenamiento();
        };
        workoutRoutinesPillsContainer.appendChild(btn);
      });
    } else {
      workoutRoutinesSwitcherWrap.classList.add('hidden');
      workoutRoutinesPillsContainer.innerHTML = '';
    }
  }

  // 2. Mostrar u ocultar el formulario creador de nueva rutina
  if (workoutCreatorBox) {
    const debeMostrarCreador = rutinas.length === 0 || mostrandoCreadorRutina;
    workoutCreatorBox.classList.toggle('hidden', !debeMostrarCreador);
    if (btnCancelNewWorkout) {
      btnCancelNewWorkout.classList.toggle('hidden', rutinas.length === 0);
    }
    if (debeMostrarCreador) {
      actualizarModoNuevaRutinaUI();
    }
  }

  // 3. Renderizar la rutina activa seleccionada
  if (rutinaActiva) {
    workoutRoutineBox.classList.remove('hidden');

    if (workoutActiveTitle) {
      workoutActiveTitle.textContent = `🏋️‍♂️ ${rutinaActiva.nombre || 'Mi Rutina de Ejercicios'}`;
    }

    if (workoutShareStatusBadge) {
      const compartidaCon = Array.isArray(rutinaActiva.compartidaCon) ? rutinaActiva.compartidaCon : [];
      const esDeOtro = rutinaActiva.creadorId && usuarioActivo && rutinaActiva.creadorId !== usuarioActivo.id;
      if (esDeOtro) {
        workoutShareStatusBadge.className = 'list-share-status-tag shared';
        workoutShareStatusBadge.textContent = `👥 Compartida por ${rutinaActiva.creadorNombre || 'un amigo'}`;
      } else if (compartidaCon.length > 0) {
        workoutShareStatusBadge.className = 'list-share-status-tag shared';
        const nombresAmigos = compartidaCon.map(uid => {
          const u = (listaUsuariosPublica || []).find(x => x.id === uid);
          return u ? u.nombre : uid;
        }).join(', ');
        workoutShareStatusBadge.textContent = `👥 Compartida con ${nombresAmigos}`;
      } else {
        workoutShareStatusBadge.className = 'list-share-status-tag';
        workoutShareStatusBadge.textContent = '👤 Personal (solo para mí)';
      }
    }

    const cantDiasGuardados = rutinaActiva.diasNumero || 3;
    const zonasRutina = Array.isArray(rutinaActiva.zonas) && rutinaActiva.zonas.length > 0
      ? rutinaActiva.zonas
      : Array.from(zonasSeleccionadasEntrenamiento);
    const planAMostrar = Array.isArray(rutinaActiva.diasPlan) && rutinaActiva.diasPlan.length > 0
      ? rutinaActiva.diasPlan
      : construirPlanEstructuradoEjercicios(zonasRutina, cantDiasGuardados, rutinaActiva.tiempo || '45 minutos', rutinaActiva.varianteOffset || 0);

    renderizarTarjetasDePlan(planAMostrar, rutinaActiva.tiempo || '45 minutos');

    if (workoutExpiryBadge && rutinaActiva.venceEl) {
      const ahora = Date.now();
      const diffDias = Math.ceil((rutinaActiva.venceEl - ahora) / (1000 * 60 * 60 * 24));
      const fechaVence = new Date(rutinaActiva.venceEl).toLocaleDateString('es-AR');
      if (diffDias <= 0) {
        workoutExpiryBadge.className = 'priority-pill pill-urgente';
        workoutExpiryBadge.textContent = `⚠️ Rutina vencida (${fechaVence}) — ¡Generá o renová tu rutina!`;
      } else {
        workoutExpiryBadge.className = 'priority-pill pill-simple';
        workoutExpiryBadge.textContent = `📅 Vigente hasta el ${fechaVence} (faltan ${diffDias} día${diffDias === 1 ? '' : 's'})`;
      }
    }
  } else {
    workoutRoutineBox.classList.add('hidden');
  }

  if (typeof renderizarPanelPasosYCaminatas === 'function') {
    renderizarPanelPasosYCaminatas();
  }
}

function generarRutinaEntrenamiento(esOtraVariante) {
  normalizarEstructuraEntrenamientoLocal();

  // Si tocó "🔄 Cambiar variante", actualizar los ejercicios de la rutina activa
  if (esOtraVariante) {
    const rutinaActiva = obtenerRutinaGymActiva();
    if (!rutinaActiva) return;

    const nuevoOffset = ((rutinaActiva.varianteOffset || 0) + 1) % 6;
    const zonasUsar = Array.isArray(rutinaActiva.zonas) && rutinaActiva.zonas.length > 0
      ? rutinaActiva.zonas
      : Array.from(zonasSeleccionadasEntrenamiento);
    const cantDias = rutinaActiva.diasNumero || 3;
    const tiempo = rutinaActiva.tiempo || '45 minutos';

    rutinaActiva.varianteOffset = nuevoOffset;
    rutinaActiva.diasPlan = construirPlanEstructuradoEjercicios(zonasUsar, cantDias, tiempo, nuevoOffset);
    rutinaActiva.updatedAt = Date.now();

    renderizarEntrenamiento();
    guardarEnNube();
    return;
  }

  // Crear y guardar una NUEVA rutina en la colección
  const zonas = Array.from(zonasSeleccionadasEntrenamiento);
  if (zonas.length === 0) {
    alert('Por favor seleccioná al menos un grupo muscular (Pecho, Espalda, Bíceps, Tríceps, Hombros o Piernas).');
    return;
  }

  if (modoNuevaRutina === 'shared' && amigosSeleccionadosNuevaRutina.size === 0) {
    alert('Seleccionaste "👥 Compartir con amigos": tildá al menos un amigo de la lista o elegí "👤 Solo para mí".');
    return;
  }

  const cantDias = parseInt((inputWorkoutDays && inputWorkoutDays.value) || '3', 10) || 3;
  const tiempo = (inputWorkoutTime && inputWorkoutTime.value) || '45 minutos';
  const duracion = (inputWorkoutDuration && inputWorkoutDuration.value) || '1 mes';

  const numeroNueva = entrenamiento.rutinas.length + 1;
  const resumenZonasCorto = zonas.length === TODAS_LAS_ZONAS_GYM.length
    ? 'Cuerpo Completo'
    : zonas.slice(0, 2).join(' + ') + (zonas.length > 2 ? ` (+${zonas.length - 2})` : '');
  const nombreIngresado = inputWorkoutName ? inputWorkoutName.value.trim() : '';
  const nombreFinal = nombreIngresado || `Rutina #${numeroNueva} — ${resumenZonasCorto}`;

  const diasPlan = construirPlanEstructuradoEjercicios(zonas, cantDias, tiempo, 0);
  const diasVigencia = calcularDiasDuracionRutina(duracion);
  const ahora = Date.now();
  const venceEl = ahora + diasVigencia * 24 * 60 * 60 * 1000;

  const compartidaCon = modoNuevaRutina === 'shared' ? Array.from(amigosSeleccionadosNuevaRutina) : [];

  const nuevaRutina = {
    id: 'rut-' + ahora + '-' + Math.random().toString(36).slice(2, 6),
    nombre: nombreFinal,
    creadorId: usuarioActivo ? usuarioActivo.id : 'alejandro',
    creadorNombre: usuarioActivo ? usuarioActivo.nombre : 'Alejandro',
    compartidaCon: compartidaCon,
    zonas: zonas,
    diasNumero: cantDias,
    dias: `${cantDias} día${cantDias === 1 ? '' : 's'} por semana`,
    tiempo: tiempo,
    duracion: duracion,
    varianteOffset: 0,
    creadoEl: ahora,
    venceEl: venceEl,
    diasPlan: diasPlan,
    updatedAt: ahora
  };

  entrenamiento.rutinas.push(nuevaRutina);
  idRutinaGymActiva = nuevaRutina.id;
  entrenamiento.rutinaActivaId = nuevaRutina.id;
  mostrandoCreadorRutina = false;

  if (inputWorkoutName) inputWorkoutName.value = '';
  modoNuevaRutina = 'solo';
  amigosSeleccionadosNuevaRutina.clear();

  renderizarEntrenamiento();
  guardarEnNube();
}

if (btnGenerateWorkout) btnGenerateWorkout.addEventListener('click', () => generarRutinaEntrenamiento(false));
if (btnAnotherWorkout) btnAnotherWorkout.addEventListener('click', () => generarRutinaEntrenamiento(true));

if (inputWorkoutName) {
  inputWorkoutName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generarRutinaEntrenamiento(false);
    }
  });
}

// Renombrar rutina activa
if (btnRenameWorkout) {
  btnRenameWorkout.addEventListener('click', () => {
    const rutinaActiva = obtenerRutinaGymActiva();
    if (!rutinaActiva) return;
    const nuevoNombre = prompt('Ingresá el nuevo nombre para esta rutina:', rutinaActiva.nombre || 'Mi Rutina');
    if (nuevoNombre === null) return;
    const limpio = nuevoNombre.trim();
    if (!limpio) return;
    rutinaActiva.nombre = limpio;
    rutinaActiva.updatedAt = Date.now();
    renderizarEntrenamiento();
    guardarEnNube();
  });
}

// Abrir modal para compartir la rutina activa con amigos de la app
if (btnOpenShareWorkout) {
  btnOpenShareWorkout.addEventListener('click', () => {
    const rutinaActiva = obtenerRutinaGymActiva();
    if (!rutinaActiva || !workoutShareModalBox) return;

    registrarPasoHistorial('workout-share-modal');
    if (workoutShareModalSubtitle) {
      workoutShareModalSubtitle.textContent = `Seleccioná con qué amigos de la app querés compartir "${rutinaActiva.nombre || 'esta rutina'}" (les aparecerá automáticamente en su sección de Gimnasio):`;
    }
    amigosSeleccionadosEdicionRutina = new Set(Array.isArray(rutinaActiva.compartidaCon) ? rutinaActiva.compartidaCon : []);
    renderizarCheckboxesAmigosRutina(workoutEditShareCheckboxes, amigosSeleccionadosEdicionRutina);
    workoutShareModalBox.classList.remove('hidden');
  });
}

if (btnCloseWorkoutShare) {
  btnCloseWorkoutShare.addEventListener('click', () => {
    if (workoutShareModalBox) workoutShareModalBox.classList.add('hidden');
  });
}

if (btnSaveWorkoutShare) {
  btnSaveWorkoutShare.addEventListener('click', () => {
    const rutinaActiva = obtenerRutinaGymActiva();
    if (!rutinaActiva) return;
    rutinaActiva.compartidaCon = Array.from(amigosSeleccionadosEdicionRutina);
    rutinaActiva.updatedAt = Date.now();
    if (workoutShareModalBox) workoutShareModalBox.classList.add('hidden');
    renderizarEntrenamiento();
    guardarEnNube();
  });
}

if (btnWhatsappShareWorkout) {
  btnWhatsappShareWorkout.addEventListener('click', () => {
    const rutinaActiva = obtenerRutinaGymActiva();
    if (!rutinaActiva) return;
    const lineas = [`💪 *${rutinaActiva.nombre || 'Rutina de Entrenamiento'}* (${rutinaActiva.dias || '3 días/sem'} - ${rutinaActiva.tiempo || '45 min'})`];
    (rutinaActiva.diasPlan || []).forEach(d => {
      lineas.push(`\n📅 *Día ${d.numeroDia}: ${d.tituloGrupos}*`);
      (d.ejercicios || []).forEach((ej, i) => {
        lineas.push(`  ${i + 1}. ${ej.nombre} (${ej.series})`);
      });
    });
    const textoWp = lineas.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(textoWp)}`, '_blank');
  });
}

// Eliminar rutina activa
if (btnDeleteWorkout) {
  btnDeleteWorkout.addEventListener('click', () => {
    const rutinaActiva = obtenerRutinaGymActiva();
    if (!rutinaActiva) return;
    if (!confirm(`¿Seguro que querés eliminar la rutina "${rutinaActiva.nombre || 'seleccionada'}"?`)) return;

    normalizarEstructuraEntrenamientoLocal();
    if (!entrenamiento.borradasRutinas.includes(rutinaActiva.id)) {
      entrenamiento.borradasRutinas.push(rutinaActiva.id);
    }
    entrenamiento.rutinas = entrenamiento.rutinas.filter(r => r.id !== rutinaActiva.id);
    idRutinaGymActiva = entrenamiento.rutinas.length > 0 ? entrenamiento.rutinas[0].id : null;
    entrenamiento.rutinaActivaId = idRutinaGymActiva;

    if (workoutShareModalBox) workoutShareModalBox.classList.add('hidden');
    renderizarEntrenamiento();
    guardarEnNube();
  });
}

// ==========================================
// CONTADOR DE PASOS Y CAMINATAS (100% INDEPENDIENTE EN GIMNASIO)
// ==========================================
const btnGymTabRoutines = document.getElementById('btn-gym-tab-routines');
const btnGymTabSteps = document.getElementById('btn-gym-tab-steps');
const gymTabStepsBadge = document.getElementById('gym-tab-steps-badge');
const workoutStepsPanel = document.getElementById('workout-steps-panel');
const workoutRoutinesMainPanel = document.getElementById('workout-routines-main-panel');

const stepsTodayStatusPill = document.getElementById('steps-today-status-pill');
const btnChangeStepsGoal = document.getElementById('btn-change-steps-goal');
const stepsGoalLabel = document.getElementById('steps-goal-label');
const stepsTodayBigNumber = document.getElementById('steps-today-big-number');
const stepsTodayGoalInline = document.getElementById('steps-today-goal-inline');
const stepsTodayPercent = document.getElementById('steps-today-percent');
const stepsProgressBarFill = document.getElementById('steps-progress-bar-fill');
const stepsTodayKm = document.getElementById('steps-today-km');
const stepsTodayKcal = document.getElementById('steps-today-kcal');
const stepsTodayMinutes = document.getElementById('steps-today-minutes');

const stepsSensorStatusBadge = document.getElementById('steps-sensor-status-badge');
const stepsLiveSessionBox = document.getElementById('steps-live-session-box');
const stepsLiveStateLabel = document.getElementById('steps-live-state-label');
const stepsLiveTimer = document.getElementById('steps-live-timer');
const stepsLiveCount = document.getElementById('steps-live-count');
const stepsLiveKm = document.getElementById('steps-live-km');
const stepsLiveKcal = document.getElementById('steps-live-kcal');

const btnStartLiveWalk = document.getElementById('btn-start-live-walk');
const btnPauseLiveWalk = document.getElementById('btn-pause-live-walk');
const btnStopLiveWalk = document.getElementById('btn-stop-live-walk');

const inputManualSteps = document.getElementById('input-manual-steps');
const btnAddManualSteps = document.getElementById('btn-add-manual-steps');
const btnResetTodaySteps = document.getElementById('btn-reset-today-steps');
const stepsWeeklyHistoryList = document.getElementById('steps-weekly-history-list');
const stepsWalksSessionsList = document.getElementById('steps-walks-sessions-list');

let pestanaGymActiva = 'routines'; // 'routines' | 'steps'
let caminataEnVivoActiva = false;
let caminataPausada = false;
let pasosSesionActual = 0;
let segundosSesionActual = 0;
let timerIntervalCaminata = null;
let wakeLockCaminata = null;
let ultimoPasoTimestamp = 0;
let magnitudFiltroAnterior = 9.8;

function cambiarPestanaGym(cual) {
  pestanaGymActiva = cual === 'steps' ? 'steps' : 'routines';
  if (btnGymTabRoutines) btnGymTabRoutines.classList.toggle('active', pestanaGymActiva === 'routines');
  if (btnGymTabSteps) btnGymTabSteps.classList.toggle('active', pestanaGymActiva === 'steps');
  if (workoutRoutinesMainPanel) workoutRoutinesMainPanel.classList.toggle('hidden', pestanaGymActiva !== 'routines');
  if (workoutStepsPanel) workoutStepsPanel.classList.toggle('hidden', pestanaGymActiva !== 'steps');
  if (btnNewWorkoutToggle) btnNewWorkoutToggle.classList.toggle('hidden', pestanaGymActiva !== 'routines');
  renderizarPanelPasosYCaminatas();
  guardarEstadoNavegacionActual();
}

if (btnGymTabRoutines) {
  btnGymTabRoutines.addEventListener('click', () => cambiarPestanaGym('routines'));
}
if (btnGymTabSteps) {
  btnGymTabSteps.addEventListener('click', () => cambiarPestanaGym('steps'));
}

function obtenerRegistroPasosDia(isoDate) {
  const est = normalizarEstructuraEntrenamientoLocal();
  asegurarEstructuraPasosLocal(est);
  const clave = isoDate || HOY_ISO;
  if (!est.pasosData.dias[clave] || typeof est.pasosData.dias[clave] !== 'object') {
    est.pasosData.dias[clave] = {
      pasos: 0,
      minutosActivos: 0,
      updatedAt: Date.now()
    };
  }
  return est.pasosData.dias[clave];
}

function calcularKmDesdePasos(pasos) {
  // Zancada promedio: 0.75 metros por paso
  return ((Number(pasos) || 0) * 0.00075);
}

function calcularKcalDesdePasos(pasos) {
  // Promedio: ~0.045 kcal por paso (45 kcal cada 1.000 pasos)
  return Math.round((Number(pasos) || 0) * 0.045);
}

function formatearSegundosACronometro(totalSeg) {
  const segs = Math.max(0, Math.floor(Number(totalSeg) || 0));
  const h = Math.floor(segs / 3600);
  const m = Math.floor((segs % 3600) / 60);
  const s = segs % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderizarPanelPasosYCaminatas() {
  const est = normalizarEstructuraEntrenamientoLocal();
  asegurarEstructuraPasosLocal(est);
  const meta = Number(est.pasosData.metaDiaria) || 8000;
  const regHoy = obtenerRegistroPasosDia(HOY_ISO);
  const pasosHoy = Math.max(0, Math.round(Number(regHoy.pasos) || 0));
  const minutosHoy = Math.max(0, Math.round((Number(regHoy.minutosActivos) || 0) + (caminataEnVivoActiva ? segundosSesionActual / 60 : 0)));
  const kmHoy = calcularKmDesdePasos(pasosHoy);
  const kcalHoy = calcularKcalDesdePasos(pasosHoy);
  const porcentaje = Math.min(100, Math.round((pasosHoy / meta) * 100));

  if (gymTabStepsBadge) {
    gymTabStepsBadge.textContent = `${pasosHoy.toLocaleString('es-AR')} hoy`;
  }

  // Actualizar también el contador de Uso Diario
  const extraWorkoutCounter = document.getElementById('extra-workout-counter');
  if (extraWorkoutCounter) {
    const ruts = est.rutinas.length;
    const txtRut = ruts === 0 ? 'Sin rutinas' : (ruts === 1 ? '1 rutina' : `${ruts} rutinas`);
    extraWorkoutCounter.textContent = `${txtRut} · 👟 ${pasosHoy.toLocaleString('es-AR')} pasos hoy`;
  }

  if (stepsGoalLabel) stepsGoalLabel.textContent = meta.toLocaleString('es-AR');
  if (stepsTodayBigNumber) stepsTodayBigNumber.textContent = pasosHoy.toLocaleString('es-AR');
  if (stepsTodayGoalInline) stepsTodayGoalInline.textContent = meta.toLocaleString('es-AR');
  if (stepsTodayPercent) stepsTodayPercent.textContent = `${porcentaje}%`;
  if (stepsProgressBarFill) {
    stepsProgressBarFill.style.width = `${porcentaje}%`;
    stepsProgressBarFill.style.background = pasosHoy >= meta
      ? 'linear-gradient(90deg, #f59e0b, #10b981)'
      : 'linear-gradient(90deg, #10b981, #34d399)';
  }

  if (stepsTodayStatusPill) {
    if (pasosHoy >= meta) {
      stepsTodayStatusPill.className = 'priority-pill pill-verde';
      stepsTodayStatusPill.textContent = '🏆 ¡Meta diaria alcanzada!';
    } else {
      const faltan = meta - pasosHoy;
      stepsTodayStatusPill.className = 'priority-pill pill-simple';
      stepsTodayStatusPill.textContent = `🎯 Faltan ${faltan.toLocaleString('es-AR')} pasos para tu meta`;
    }
  }

  if (stepsTodayKm) stepsTodayKm.textContent = kmHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
  if (stepsTodayKcal) stepsTodayKcal.textContent = kcalHoy.toLocaleString('es-AR') + ' kcal';
  if (stepsTodayMinutes) stepsTodayMinutes.textContent = minutosHoy + ' min';

  // Actualizar vista de caminata en vivo si está activa
  if (stepsLiveSessionBox) {
    stepsLiveSessionBox.classList.toggle('hidden', !caminataEnVivoActiva);
  }
  if (btnStartLiveWalk) {
    btnStartLiveWalk.classList.toggle('hidden', caminataEnVivoActiva);
  }
  if (btnPauseLiveWalk) {
    btnPauseLiveWalk.classList.toggle('hidden', !caminataEnVivoActiva);
    btnPauseLiveWalk.textContent = caminataPausada ? '▶️ Reanudar' : '⏸️ Pausar';
  }
  if (btnStopLiveWalk) {
    btnStopLiveWalk.classList.toggle('hidden', !caminataEnVivoActiva);
  }
  if (caminataEnVivoActiva) {
    if (stepsLiveStateLabel) {
      stepsLiveStateLabel.textContent = caminataPausada
        ? '⏸️ Caminata en pausa'
        : '🟢 Contando pasos en vivo con el sensor del celular...';
    }
    if (stepsLiveTimer) stepsLiveTimer.textContent = formatearSegundosACronometro(segundosSesionActual);
    if (stepsLiveCount) stepsLiveCount.textContent = pasosSesionActual.toLocaleString('es-AR');
    if (stepsLiveKm) {
      stepsLiveKm.textContent = calcularKmDesdePasos(pasosSesionActual).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
    }
    if (stepsLiveKcal) {
      stepsLiveKcal.textContent = calcularKcalDesdePasos(pasosSesionActual).toLocaleString('es-AR') + ' kcal';
    }
  }

  // Historial de los últimos 7 días
  if (stepsWeeklyHistoryList) {
    stepsWeeklyHistoryList.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoyDate);
      d.setDate(d.getDate() - i);
      const iso = obtenerFechaISO(d);
      const reg = est.pasosData.dias[iso] || { pasos: 0, minutosActivos: 0 };
      const pDia = Math.max(0, Math.round(Number(reg.pasos) || 0));
      const kmDia = calcularKmDesdePasos(pDia).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const kcalDia = calcularKcalDesdePasos(pDia);
      const cumplio = pDia >= meta;
      const pctDia = Math.min(100, Math.round((pDia / meta) * 100));

      const nombreDia = i === 0
        ? 'Hoy'
        : (i === 1 ? 'Ayer' : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }));

      const fila = document.createElement('div');
      fila.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:10px; background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.07); flex-wrap:wrap;';
      fila.innerHTML = `
        <div style="min-width:110px;">
          <strong style="color:${i === 0 ? '#34d399' : '#f8fafc'}; font-size:0.94rem; text-transform:capitalize;">${escaparHTML(nombreDia)}</strong>
          <div style="font-size:0.78rem; color:#94a3b8;">${kmDia} km · ${kcalDia} kcal</div>
        </div>
        <div style="flex:1; min-width:120px; max-width:220px; height:8px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden;">
          <div style="width:${pctDia}%; height:100%; background:${cumplio ? '#10b981' : '#3b82f6'}; border-radius:999px;"></div>
        </div>
        <div style="text-align:right; min-width:110px;">
          <strong style="color:${cumplio ? '#34d399' : '#e2e8f0'}; font-size:0.95rem;">${cumplio ? '🏆 ' : '👟 '}${pDia.toLocaleString('es-AR')}</strong>
          <span style="font-size:0.78rem; color:#94a3b8;"> pasos</span>
        </div>
      `;
      stepsWeeklyHistoryList.appendChild(fila);
    }
  }

  // Sesiones de caminata guardadas
  if (stepsWalksSessionsList) {
    stepsWalksSessionsList.innerHTML = '';
    const sesiones = Array.isArray(est.pasosData.sesiones) ? est.pasosData.sesiones : [];
    if (sesiones.length === 0) {
      stepsWalksSessionsList.innerHTML = `<div class="empty-state" style="padding:14px;">Todavía no guardaste sesiones de caminata en vivo. Tocá <b>▶️ Iniciar Caminata en Vivo</b> arriba cuando salgas a caminar.</div>`;
    } else {
      sesiones.slice(0, 15).forEach(ses => {
        const card = document.createElement('div');
        card.className = 'task-item prio-simple';
        const fechaTxt = ses.fechaHora
          ? new Date(ses.fechaHora).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : (ses.fechaISO || HOY_ISO);
        const pSes = Number(ses.pasos) || 0;
        const kmSes = calcularKmDesdePasos(pSes).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const kcalSes = calcularKcalDesdePasos(pSes);
        const durTxt = formatearSegundosACronometro(ses.duracionSeg || 0);

        card.innerHTML = `
          <div class="task-info" style="flex:1;">
            <span class="priority-pill pill-verde">🏃 Caminata (${durTxt})</span>
            <strong class="task-text" style="margin-left:6px;">${pSes.toLocaleString('es-AR')} pasos · ${kmSes} km · ${kcalSes} kcal</strong>
            <small style="color:#94a3b8; margin-left:6px;">(${escaparHTML(fechaTxt)})</small>
          </div>
          <div class="task-actions">
            <button type="button" class="btn-delete" title="Eliminar registro de caminata">✕</button>
          </div>
        `;
        card.querySelector('.btn-delete').addEventListener('click', () => {
          if (!confirm('¿Eliminar este registro del historial de caminatas?')) return;
          est.pasosData.sesiones = est.pasosData.sesiones.filter(x => x.id !== ses.id);
          renderizarPanelPasosYCaminatas();
          guardarEnNube();
        });
        stepsWalksSessionsList.appendChild(card);
      });
    }
  }
}

async function activarWakeLockCaminata() {
  if ('wakeLock' in navigator) {
    try {
      wakeLockCaminata = await navigator.wakeLock.request('screen');
    } catch (e) {}
  }
}

function liberarWakeLockCaminata() {
  if (wakeLockCaminata) {
    try {
      wakeLockCaminata.release();
    } catch (e) {}
    wakeLockCaminata = null;
  }
}

function procesarMovimientoAcelerometro(event) {
  if (!caminataEnVivoActiva || caminataPausada) return;
  const acc = event.accelerationIncludingGravity || event.acceleration;
  if (!acc) return;

  const x = Number(acc.x) || 0;
  const y = Number(acc.y) || 0;
  const z = Number(acc.z) || 0;
  const magnitud = Math.sqrt(x * x + y * y + z * z);

  // Filtro suavizado y detección de pico de paso humano (anti-rebote de 330 ms)
  const delta = Math.abs(magnitud - magnitudFiltroAnterior);
  magnitudFiltroAnterior = magnitud * 0.7 + magnitudFiltroAnterior * 0.3;

  const ahora = Date.now();
  if (delta > 2.35 && (ahora - ultimoPasoTimestamp) > 330) {
    ultimoPasoTimestamp = ahora;
    pasosSesionActual += 1;
    const regHoy = obtenerRegistroPasosDia(HOY_ISO);
    regHoy.pasos = (Number(regHoy.pasos) || 0) + 1;
    regHoy.updatedAt = ahora;

    if (stepsLiveCount) stepsLiveCount.textContent = pasosSesionActual.toLocaleString('es-AR');
    if (stepsLiveKm) {
      stepsLiveKm.textContent = calcularKmDesdePasos(pasosSesionActual).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
    }
    if (stepsLiveKcal) {
      stepsLiveKcal.textContent = calcularKcalDesdePasos(pasosSesionActual).toLocaleString('es-AR') + ' kcal';
    }
    if (stepsTodayBigNumber) {
      stepsTodayBigNumber.textContent = regHoy.pasos.toLocaleString('es-AR');
    }
    if (gymTabStepsBadge) {
      gymTabStepsBadge.textContent = `${regHoy.pasos.toLocaleString('es-AR')} hoy`;
    }
  }
}

async function iniciarCaminataEnVivo() {
  // Solicitar permiso de sensor en iOS 13+ si corresponde
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const estadoPermiso = await DeviceMotionEvent.requestPermission();
      if (estadoPermiso !== 'granted') {
        alert('Para contar tus pasos en vivo necesitás permitir el acceso al sensor de movimiento de tu celular.');
        return;
      }
    } catch (e) {}
  }

  caminataEnVivoActiva = true;
  caminataPausada = false;
  pasosSesionActual = 0;
  segundosSesionActual = 0;
  ultimoPasoTimestamp = 0;

  window.addEventListener('devicemotion', procesarMovimientoAcelerometro, true);
  await activarWakeLockCaminata();

  if (stepsSensorStatusBadge) {
    stepsSensorStatusBadge.className = 'priority-pill pill-verde';
    stepsSensorStatusBadge.textContent = '🟢 Sensor activo';
  }

  if (timerIntervalCaminata) clearInterval(timerIntervalCaminata);
  timerIntervalCaminata = setInterval(() => {
    if (caminataEnVivoActiva && !caminataPausada) {
      segundosSesionActual += 1;
      if (stepsLiveTimer) {
        stepsLiveTimer.textContent = formatearSegundosACronometro(segundosSesionActual);
      }
      if (segundosSesionActual % 15 === 0) {
        renderizarPanelPasosYCaminatas();
        guardarCacheDatosUsuarioLocal();
      }
    }
  }, 1000);

  renderizarPanelPasosYCaminatas();
}

function pausarOReanudarCaminataEnVivo() {
  if (!caminataEnVivoActiva) return;
  caminataPausada = !caminataPausada;
  if (stepsSensorStatusBadge) {
    stepsSensorStatusBadge.className = caminataPausada ? 'priority-pill pill-intermedio' : 'priority-pill pill-verde';
    stepsSensorStatusBadge.textContent = caminataPausada ? '⏸️ En pausa' : '🟢 Sensor activo';
  }
  renderizarPanelPasosYCaminatas();
}

function finalizarYGuardarCaminataEnVivo() {
  if (!caminataEnVivoActiva) return;
  window.removeEventListener('devicemotion', procesarMovimientoAcelerometro, true);
  if (timerIntervalCaminata) {
    clearInterval(timerIntervalCaminata);
    timerIntervalCaminata = null;
  }
  liberarWakeLockCaminata();

  const est = normalizarEstructuraEntrenamientoLocal();
  asegurarEstructuraPasosLocal(est);
  const regHoy = obtenerRegistroPasosDia(HOY_ISO);
  const minSumados = Math.max(1, Math.round(segundosSesionActual / 60));
  regHoy.minutosActivos = (Number(regHoy.minutosActivos) || 0) + minSumados;
  regHoy.updatedAt = Date.now();

  if (pasosSesionActual > 0 || segundosSesionActual >= 10) {
    est.pasosData.sesiones.unshift({
      id: 'walk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      fechaISO: HOY_ISO,
      fechaHora: Date.now(),
      pasos: pasosSesionActual,
      duracionSeg: segundosSesionActual
    });
  }

  caminataEnVivoActiva = false;
  caminataPausada = false;
  if (stepsSensorStatusBadge) {
    stepsSensorStatusBadge.className = 'priority-pill pill-hora';
    stepsSensorStatusBadge.textContent = '📱 Sensor listo';
  }

  renderizarPanelPasosYCaminatas();
  guardarEnNube();
}

function sumarPasosManualesAHoy(cantidad) {
  const n = Math.round(Number(cantidad) || 0);
  if (n <= 0) return;
  const regHoy = obtenerRegistroPasosDia(HOY_ISO);
  regHoy.pasos = Math.max(0, (Number(regHoy.pasos) || 0) + n);
  regHoy.minutosActivos = Math.max(0, (Number(regHoy.minutosActivos) || 0) + Math.round(n / 100));
  regHoy.updatedAt = Date.now();
  renderizarPanelPasosYCaminatas();
  guardarEnNube();
}

if (btnStartLiveWalk) btnStartLiveWalk.addEventListener('click', iniciarCaminataEnVivo);
if (btnPauseLiveWalk) btnPauseLiveWalk.addEventListener('click', pausarOReanudarCaminataEnVivo);
if (btnStopLiveWalk) btnStopLiveWalk.addEventListener('click', finalizarYGuardarCaminataEnVivo);

document.querySelectorAll('.btn-quick-add-steps').forEach(btn => {
  btn.addEventListener('click', () => {
    const cant = parseInt(btn.getAttribute('data-steps') || '0', 10);
    sumarPasosManualesAHoy(cant);
  });
});

if (btnAddManualSteps) {
  btnAddManualSteps.addEventListener('click', () => {
    const val = inputManualSteps ? parseInt(inputManualSteps.value, 10) : 0;
    if (!val || val <= 0) {
      if (inputManualSteps) inputManualSteps.focus();
      return;
    }
    sumarPasosManualesAHoy(val);
    if (inputManualSteps) inputManualSteps.value = '';
  });
}

if (inputManualSteps) {
  inputManualSteps.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (btnAddManualSteps) btnAddManualSteps.click();
    }
  });
}

if (btnResetTodaySteps) {
  btnResetTodaySteps.addEventListener('click', () => {
    if (!confirm('¿Querés poner en 0 los pasos registrados hoy?')) return;
    const regHoy = obtenerRegistroPasosDia(HOY_ISO);
    regHoy.pasos = 0;
    regHoy.minutosActivos = 0;
    regHoy.updatedAt = Date.now();
    renderizarPanelPasosYCaminatas();
    guardarEnNube();
  });
}

if (btnChangeStepsGoal) {
  btnChangeStepsGoal.addEventListener('click', () => {
    const est = normalizarEstructuraEntrenamientoLocal();
    asegurarEstructuraPasosLocal(est);
    const actual = est.pasosData.metaDiaria || 8000;
    const nueva = prompt('Ingresá tu meta diaria de pasos (ej: 6000, 8000, 10000):', String(actual));
    if (nueva === null) return;
    const num = parseInt(nueva.replace(/\D/g, ''), 10);
    if (!num || num < 500) {
      alert('Ingresá una meta válida de al menos 500 pasos.');
      return;
    }
    est.pasosData.metaDiaria = num;
    renderizarPanelPasosYCaminatas();
    guardarEnNube();
  });
}

// ==========================================
// TAREAS COMPARTIDAS (EN EQUIPO Y PROGRAMADAS)
// ==========================================
let sociosSeleccionadosParaTarea = new Set();
let modoTareaProgramada = false;

const btnNewScheduledTask = document.getElementById('btn-new-scheduled-task');
const sharedPartnersChipsContainer = document.getElementById('shared-partners-chips-container');
const groupSharedScheduledDate = document.getElementById('group-shared-scheduled-date');
const inputSharedScheduledDate = document.getElementById('input-shared-scheduled-date');
const formSharedTaskTitle = document.getElementById('form-shared-task-title');
const formSharedTaskDesc = document.getElementById('form-shared-task-desc');

function renderizarChipsSociosCompartidos() {
  if (!sharedPartnersChipsContainer) return;
  sharedPartnersChipsContainer.innerHTML = '';

  const vinculosIds = (usuarioActivo?.vinculos || []).map(v => v.usuarioId);
  const otros = (listaUsuariosPublica || []).filter(u => u.id !== usuarioActivo?.id && vinculosIds.includes(u.id));

  if (otros.length === 0) {
    sharedPartnersChipsContainer.innerHTML = `
      <div style="padding: 12px; background: rgba(59, 130, 246, 0.08); border: 1px dashed #3b82f6; border-radius: 8px; color: #93c5fd; font-size: 0.88rem; width: 100%;">
        👥 Para hacer tareas compartidas o programadas en equipo, primero debés vincular al usuario por DNI como <strong>Amigo</strong> o <strong>Conviviente</strong>.<br>
        <button type="button" class="btn-secondary" style="margin-top: 8px; padding: 6px 12px; font-size: 0.82rem; border-color:#3b82f6; color:#93c5fd;" onclick="mostrarMenuExtras(); abrirHerramientaExtras('vincular');">
          🤝 Ir a Vincular Contactos
        </button>
      </div>`;
    return;
  }

  // Si no hay seleccionado ninguno o no son válidos, seleccionar el primero
  if (sociosSeleccionadosParaTarea.size === 0 || !otros.some(u => sociosSeleccionadosParaTarea.has(u.id))) {
    sociosSeleccionadosParaTarea.clear();
    if (otros.length > 0) sociosSeleccionadosParaTarea.add(otros[0].id);
  }

  otros.forEach(u => {
    const isSelected = sociosSeleccionadosParaTarea.has(u.id);
    const vinc = (usuarioActivo?.vinculos || []).find(v => v.usuarioId === u.id);
    const tipoBadge = vinc?.tipo === 'convivientes' ? '🏠' : '👥';
    const chip = document.createElement('div');
    chip.className = `partner-chip ${isSelected ? 'active' : ''}`;
    chip.innerHTML = `
      <span>${tipoBadge} ${u.avatar || '👤'}</span>
      <span>${escaparHTML(u.nombre)}</span>
      <span class="chip-check">${isSelected ? '✓' : '+'}</span>
    `;
    chip.onclick = () => {
      if (sociosSeleccionadosParaTarea.has(u.id)) {
        sociosSeleccionadosParaTarea.delete(u.id);
      } else {
        sociosSeleccionadosParaTarea.add(u.id);
      }
      renderizarChipsSociosCompartidos();
    };
    sharedPartnersChipsContainer.appendChild(chip);
  });
}

function renderizarTareasCompartidas() {
  if (!usuarioActivo || !viewSharedTasks) return;

  renderizarChipsSociosCompartidos();

  // 1. Invitaciones pendientes hacia el usuario activo
  const invitaciones = (tareasCompartidas || []).filter(t => {
    if (t.participantes) {
      return t.participantes.some(p => p.id === usuarioActivo.id && p.estadoInvitacion === 'pendiente');
    }
    return t.socioId === usuarioActivo.id && t.estado === 'pendiente_invitacion';
  });

  if (sharedTasksInvitationsBox && sharedInvitationsList) {
    if (invitaciones.length > 0) {
      sharedTasksInvitationsBox.classList.remove('hidden');
      sharedInvitationsList.innerHTML = '';
      invitaciones.forEach(inv => {
        const card = document.createElement('div');
        card.className = 'shared-invitation-card';
        const programadaPill = inv.esProgramada && inv.fechaProgramada
          ? `<div style="margin-top:6px;"><span class="priority-pill" style="background:#0284c7; color:#e0f2fe; font-size:0.82rem;">📅 Para el: ${inv.fechaProgramada.split('-').reverse().join('/')} (se agregará a tu Agenda Mensual)</span></div>`
          : '';

        const equipoTxt = inv.esGrupal ? 'en grupo' : 'en equipo';

        card.innerHTML = `
          <div>
            <div style="font-size:0.85rem; color:#93c5fd; margin-bottom:4px;">
              <b>${escaparHTML(inv.creadorNombre || 'Un usuario')}</b> te invitó a realizar una tarea ${equipoTxt}:
            </div>
            <div style="font-size:1.05rem; font-weight:700; color:#fff;">
              ${escaparHTML(inv.texto)}
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; align-items:center;">
              <span class="priority-pill pill-${inv.prioridad || 'simple'}">
                ${ETIQUETA_PRIORIDAD[inv.prioridad || 'simple']}
              </span>
              ${programadaPill}
            </div>
          </div>
          <div style="display:flex; gap:8px; margin-top:10px;">
            <button type="button" class="btn-primary btn-accept-shared" data-id="${inv.id}" style="background:#22c55e; border-color:#16a34a; padding:6px 14px; font-size:0.88rem;">
              ✓ Aceptar
            </button>
            <button type="button" class="btn-secondary btn-reject-shared" data-id="${inv.id}" style="padding:6px 14px; font-size:0.88rem; color:#fca5a5; border-color:#ef4444;">
              ✕ Rechazar
            </button>
          </div>
        `;
        card.querySelector('.btn-accept-shared').addEventListener('click', () => {
          responderInvitacionTareaCompartida(inv.id, true);
        });
        card.querySelector('.btn-reject-shared').addEventListener('click', () => {
          responderInvitacionTareaCompartida(inv.id, false);
        });
        sharedInvitationsList.appendChild(card);
      });
    } else {
      sharedTasksInvitationsBox.classList.add('hidden');
    }
  }

  // 2. Lista de tareas compartidas activas o invitaciones enviadas por mí
  if (!sharedTasksList) return;
  sharedTasksList.innerHTML = '';

  const ahora = Date.now();
  const activas = (tareasCompartidas || []).filter(t => {
    // 1. Participante activo o creador
    const esPart = (t.creadorId === usuarioActivo.id) ||
      (t.participantes && t.participantes.some(p => p.id === usuarioActivo.id && (p.estadoInvitacion === 'aceptada' || p.estadoInvitacion === 'pendiente'))) ||
      (t.socioId === usuarioActivo.id);
    if (!esPart) return false;

    // 2. Regla de los 60 minutos para la lista de tareas:
    // Si todos la completaron y ya pasaron 60 minutos, desaparece de la lista de tareas compartidas
    // (pero si fue programada en la agenda, sigue viviendo en el calendario por 1 año).
    const participantesAceptados = Array.isArray(t.participantes)
      ? t.participantes.filter(p => p.estadoInvitacion === 'aceptada')
      : [];
    const soyCreador = t.creadorId === usuarioActivo.id;
    const miPart = t.participantes ? t.participantes.find(p => p.id === usuarioActivo.id) : null;
    const miMarca = miPart ? Boolean(miPart.realizada) : (soyCreador ? Boolean(t.realizadaPorCreador) : Boolean(t.realizadaPorSocio));
    const todosCompletaron = (t.estado === 'completada') ||
      (miMarca && (participantesAceptados.length === 0 || participantesAceptados.every(p => p.realizada)));

    if (todosCompletaron) {
      if (!t.completadaEl) {
        t.completadaEl = t.actualizadoEl || ahora;
      }
      if (ahora - t.completadaEl >= UNA_HORA_MS) {
        return false; // Desaparece de la lista de tareas compartidas a los 60 min
      }
    }
    return true;
  });

  if (activas.length === 0) {
    sharedTasksList.innerHTML = `
      <div class="empty-state">
        No tenés tareas compartidas activas en este momento.<br>
        Tocá <b>+ Nueva tarea compartida</b> o <b>📅 Tarea programada</b> para invitar a tus compañeros a realizar una tarea juntos.
      </div>
    `;
    return;
  }

  activas.forEach(tc => {
    const soyCreador = tc.creadorId === usuarioActivo.id;
    const miPart = tc.participantes ? tc.participantes.find(p => p.id === usuarioActivo.id) : null;
    const miMarca = miPart ? Boolean(miPart.realizada) : (soyCreador ? Boolean(tc.realizadaPorCreador) : Boolean(tc.realizadaPorSocio));
    const esPendienteInvitacion = miPart ? miPart.estadoInvitacion === 'pendiente' : (tc.estado === 'pendiente_invitacion');

    const otrosParticipantes = tc.participantes
      ? tc.participantes.filter(p => p.id !== usuarioActivo.id)
      : [{
          id: soyCreador ? tc.socioId : tc.creadorId,
          nombre: soyCreador ? (tc.socioNombre || 'Socio') : (tc.creadorNombre || 'Creador'),
          estadoInvitacion: tc.estado === 'pendiente_invitacion' ? 'pendiente' : 'aceptada',
          realizada: soyCreador ? Boolean(tc.realizadaPorSocio) : Boolean(tc.realizadaPorCreador)
        }];

    const nombresOtros = otrosParticipantes.map(p => p.nombre).join(', ');
    const encabezadoEquipo = otrosParticipantes.length > 1
      ? `👥 En grupo (${(tc.participantes ? tc.participantes.length : otrosParticipantes.length + 1)} personas): <b>${escaparHTML(nombresOtros)}</b>`
      : `👥 Con: <b>${escaparHTML(nombresOtros || 'Compañero')}</b>`;

    const badgeProgramada = tc.esProgramada && tc.fechaProgramada
      ? `<span class="priority-pill" style="background:#0284c7; color:#e0f2fe; font-size:0.75rem;">📅 Agenda: ${tc.fechaProgramada.split('-').reverse().join('/')}</span>`
      : '';

    let estadosSociosHtml = '';
    otrosParticipantes.forEach(p => {
      if (p.estadoInvitacion === 'pendiente') {
        estadosSociosHtml += `<div style="margin-top:4px;"><span class="partner-status-pill partner-status-pending" style="background:rgba(234, 179, 8, 0.2); color:#fde047;">⏳ Esperando que ${escaparHTML(p.nombre)} acepte la invitación</span></div>`;
      } else if (p.estadoInvitacion === 'rechazada') {
        estadosSociosHtml += `<div style="margin-top:4px;"><span class="partner-status-pill" style="background:rgba(239, 68, 68, 0.2); color:#fca5a5;">❌ ${escaparHTML(p.nombre)} rechazó la invitación</span></div>`;
      } else if (p.realizada) {
        estadosSociosHtml += `<div style="margin-top:4px;"><span class="partner-status-pill partner-status-done">✅ ${escaparHTML(p.nombre)} ya la tildó como realizada</span></div>`;
      } else {
        estadosSociosHtml += `<div style="margin-top:4px;"><span class="partner-status-pill partner-status-pending">⏳ Falta que ${escaparHTML(p.nombre)} la tilde</span></div>`;
      }
    });

    const sociosAceptados = otrosParticipantes.filter(p => p.estadoInvitacion === 'aceptada');
    const todosCompletaron = miMarca && (sociosAceptados.length === 0 || sociosAceptados.every(p => p.realizada));

    const card = document.createElement('div');
    card.className = `shared-task-card prio-${tc.prioridad || 'simple'} ${todosCompletaron ? 'completada' : ''}`;

    const avisoOcultar = todosCompletaron
      ? `🎉 Todos la completaron · <span style="color:#38bdf8; font-weight:600;">⏱️ ${textoTiempoRestante(tc.completadaEl || ahora)}</span>${tc.esProgramada ? '<br><small style="color:#7dd3fc;">(Permanece guardada en tu Calendario)</small>' : ''}`
      : 'Todos deben tildarla para que desaparezca';

    card.innerHTML = `
      <div class="shared-task-header">
        <span class="partner-tag">${encabezadoEquipo}</span>
        <div style="display:flex; gap:6px; align-items:center;">
          ${badgeProgramada}
          <span class="priority-pill pill-${tc.prioridad || 'simple'}">${ETIQUETA_PRIORIDAD[tc.prioridad || 'simple']}</span>
        </div>
      </div>

      <div class="shared-task-text ${miMarca ? 'realizada-por-mi' : ''}">
        ${escaparHTML(tc.texto)}
      </div>

      <div class="shared-task-progress-box">
        <label class="shared-check-label ${esPendienteInvitacion ? 'disabled' : ''}">
          <input type="checkbox" class="chk-shared-done" ${miMarca ? 'checked' : ''} ${esPendienteInvitacion ? 'disabled' : ''}>
          <span>${miMarca ? '✓ Ya la marcaste como realizada' : 'Tildar cuando vos la realices'}</span>
        </label>
        <div style="margin-top:6px;">
          ${estadosSociosHtml}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:6px;">
        <span style="font-size:0.75rem; color:#94a3b8; line-height: 1.35;">
          ${esPendienteInvitacion ? 'Invitación enviada' : avisoOcultar}
        </span>
        <button type="button" class="btn-delete btn-delete-shared" style="padding:4px 8px; font-size:0.8rem;" title="Eliminar tarea compartida">
          🗑️ Eliminar
        </button>
      </div>
    `;

    const chk = card.querySelector('.chk-shared-done');
    if (chk) {
      chk.addEventListener('change', () => {
        marcarTareaCompartida(tc.id, chk.checked);
      });
    }

    const btnDel = card.querySelector('.btn-delete-shared');
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        eliminarTareaCompartida(tc.id);
      });
    }

    sharedTasksList.appendChild(card);
  });
}

async function crearNuevaTareaCompartida() {
  if (!usuarioActivo) return;
  const sociosIds = Array.from(sociosSeleccionadosParaTarea);
  const texto = inputSharedTaskText ? inputSharedTaskText.value.trim() : '';

  if (sociosIds.length === 0) {
    alert('Por favor seleccioná al menos a un compañero tocando su tarjeta.');
    return;
  }
  if (!texto) {
    alert('Ingresá el texto de la tarea a realizar.');
    if (inputSharedTaskText) inputSharedTaskText.focus();
    return;
  }

  const fechaProgramada = inputSharedScheduledDate ? inputSharedScheduledDate.value : '';
  if (modoTareaProgramada && !fechaProgramada) {
    alert('Por favor elegí una fecha en el calendario para programar la tarea.');
    if (inputSharedScheduledDate) inputSharedScheduledDate.focus();
    return;
  }

  if (btnSaveSharedTask) {
    btnSaveSharedTask.disabled = true;
    btnSaveSharedTask.textContent = 'Enviando...';
  }

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'crear_tarea_compartida',
        usuarioId: usuarioActivo.id,
        password: (usuarioActivo && usuarioActivo.password) || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        sociosIds: sociosIds,
        esProgramada: modoTareaProgramada,
        fechaProgramada: modoTareaProgramada ? fechaProgramada : null,
        texto: texto,
        prioridad: prioridadTareaCompartida
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'No se pudo crear la tarea');
      return;
    }

    if (Array.isArray(data.tareasCompartidas)) {
      tareasCompartidas = data.tareasCompartidas;
    } else if (data.tarea) {
      tareasCompartidas.unshift(data.tarea);
    }

    if (inputSharedTaskText) inputSharedTaskText.value = '';
    if (formNewSharedTaskBox) formNewSharedTaskBox.classList.add('hidden');

    renderizarTareasCompartidas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
    actualizarContadoresTareasAgendaMenu();
    actualizarContadoresEconomiaMenu();
    actualizarContadoresYAlertas();

    const cant = sociosIds.length;
    const msg = modoTareaProgramada
      ? `¡Tarea programada para el ${fechaProgramada.split('-').reverse().join('/')} enviada a ${cant === 1 ? 'tu compañero' : cant + ' compañeros'}!\n\nCuando la acepten, se les sumará en su Agenda Mensual.`
      : `¡Invitación enviada a ${cant === 1 ? 'tu compañero' : cant + ' compañeros'}!\n\nLes llegará una notificación para aceptarla.`;
    alert(msg);
  } catch (e) {
    alert('Error al enviar la tarea: ' + (e.message || String(e)));
  } finally {
    if (btnSaveSharedTask) {
      btnSaveSharedTask.disabled = false;
      btnSaveSharedTask.textContent = modoTareaProgramada ? 'Enviar y programar en agenda' : 'Enviar invitación (Enter)';
    }
  }
}

async function responderInvitacionTareaCompartida(tareaId, aceptar) {
  if (!usuarioActivo) return;
  try {
    actualizarEstadoSync('☁️ Guardando...', 'amarillo');
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'responder_tarea_compartida',
        usuarioId: usuarioActivo.id,
        password: (usuarioActivo && usuarioActivo.password) || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        tareaId: tareaId,
        aceptar: Boolean(aceptar)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'No se pudo responder a la invitación');
      return;
    }
    if (Array.isArray(data.tareasCompartidas)) {
      tareasCompartidas = data.tareasCompartidas;
    } else {
      const idx = tareasCompartidas.findIndex(t => t.id === tareaId);
      if (idx !== -1) {
        if (aceptar) tareasCompartidas[idx].estado = 'activa';
        else tareasCompartidas.splice(idx, 1);
      }
    }
    actualizarEstadoSync('☁️ En línea', 'verde');
    renderizarTareasCompartidas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
    actualizarContadoresTareasAgendaMenu();
    actualizarContadoresEconomiaMenu();
    actualizarContadoresYAlertas();

    if (aceptar && data.tarea && data.tarea.esProgramada && data.tarea.fechaProgramada) {
      alert(`¡Aceptaste la tarea!\n\nSe ha añadido a tus Tareas Compartidas y a tu Agenda Mensual para el día ${data.tarea.fechaProgramada.split('-').reverse().join('/')}.`);
    }
  } catch (e) {
    actualizarEstadoSync('☁️ Error', 'amarillo');
    alert('Error al responder: ' + (e.message || String(e)));
  }
}

async function marcarTareaCompartida(tareaId, realizada) {
  if (!usuarioActivo) return;
  const tc = tareasCompartidas.find(t => t.id === tareaId);
  if (tc) {
    if (tc.participantes) {
      const p = tc.participantes.find(x => x.id === usuarioActivo.id);
      if (p) p.realizada = Boolean(realizada);
    }
    if (tc.creadorId === usuarioActivo.id) tc.realizadaPorCreador = Boolean(realizada);
    else tc.realizadaPorSocio = Boolean(realizada);
    renderizarTareasCompartidas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
  }

  try {
    actualizarEstadoSync('☁️ Guardando...', 'amarillo');
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'marcar_tarea_compartida',
        usuarioId: usuarioActivo.id,
        password: (usuarioActivo && usuarioActivo.password) || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        tareaId: tareaId,
        realizada: Boolean(realizada)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'No se pudo actualizar la tarea');
      return;
    }
    if (Array.isArray(data.tareasCompartidas)) {
      tareasCompartidas = data.tareasCompartidas;
    }
    actualizarEstadoSync('☁️ En línea', 'verde');
    renderizarTareasCompartidas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
    actualizarContadoresTareasAgendaMenu();
    actualizarContadoresEconomiaMenu();
    actualizarContadoresYAlertas();
  } catch (e) {
    actualizarEstadoSync('☁️ Error', 'amarillo');
  }
}

async function eliminarTareaCompartida(tareaId) {
  if (!usuarioActivo) return;
  if (!confirm('¿Seguro que querés eliminar esta tarea compartida? Desaparecerá para todos los integrantes.')) return;
  try {
    actualizarEstadoSync('☁️ Eliminando...', 'amarillo');
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'eliminar_tarea_compartida',
        usuarioId: usuarioActivo.id,
        password: (usuarioActivo && usuarioActivo.password) || obtenerPasswordSesionVigente(usuarioActivo.id) || '',
        tareaId: tareaId
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'No se pudo eliminar la tarea');
      return;
    }
    if (Array.isArray(data.tareasCompartidas)) {
      tareasCompartidas = data.tareasCompartidas;
    } else {
      tareasCompartidas = tareasCompartidas.filter(t => t.id !== tareaId);
    }
    actualizarEstadoSync('☁️ En línea', 'verde');
    renderizarTareasCompartidas();
    renderizarCalendario();
    renderizarRecordatoriosDelDia();
    actualizarContadoresTareasAgendaMenu();
    actualizarContadoresEconomiaMenu();
    actualizarContadoresYAlertas();
  } catch (e) {
    actualizarEstadoSync('☁️ Error', 'amarillo');
    alert('Error al eliminar: ' + (e.message || String(e)));
  }
}

if (btnNewSharedTask && formNewSharedTaskBox) {
  btnNewSharedTask.addEventListener('click', () => {
    modoTareaProgramada = false;
    if (formSharedTaskTitle) formSharedTaskTitle.textContent = '➕ Crear tarea compartida';
    if (formSharedTaskDesc) formSharedTaskDesc.textContent = 'Al compañero o compañeros seleccionados les llegará una invitación para aceptarla. Todos la verán en su lista:';
    if (groupSharedScheduledDate) groupSharedScheduledDate.classList.add('hidden');
    if (btnSaveSharedTask) btnSaveSharedTask.textContent = 'Enviar invitación (Enter)';
    formNewSharedTaskBox.classList.remove('hidden');
    renderizarChipsSociosCompartidos();
    if (inputSharedTaskText) inputSharedTaskText.focus();
  });
}

if (btnNewScheduledTask && formNewSharedTaskBox) {
  btnNewScheduledTask.addEventListener('click', () => {
    modoTareaProgramada = true;
    if (formSharedTaskTitle) formSharedTaskTitle.textContent = '📅 Crear tarea grupal programada';
    if (formSharedTaskDesc) formSharedTaskDesc.textContent = 'Elegí los compañeros y la fecha. Al aceptarla, la tarea se agregará automáticamente a la agenda mensual de cada uno:';
    if (groupSharedScheduledDate) groupSharedScheduledDate.classList.remove('hidden');
    if (inputSharedScheduledDate && !inputSharedScheduledDate.value) {
      inputSharedScheduledDate.value = new Date().toISOString().slice(0, 10);
    }
    if (btnSaveSharedTask) btnSaveSharedTask.textContent = 'Enviar y programar en agenda';
    formNewSharedTaskBox.classList.remove('hidden');
    renderizarChipsSociosCompartidos();
    if (inputSharedTaskText) inputSharedTaskText.focus();
  });
}

if (btnCancelSharedTask && formNewSharedTaskBox) {
  btnCancelSharedTask.addEventListener('click', () => {
    formNewSharedTaskBox.classList.add('hidden');
  });
}

if (btnSaveSharedTask) {
  btnSaveSharedTask.addEventListener('click', crearNuevaTareaCompartida);
}

if (inputSharedTaskText) {
  inputSharedTaskText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      crearNuevaTareaCompartida();
    }
  });
}

if (sharedTaskPrioritySelector) {
  sharedTaskPrioritySelector.querySelectorAll('.prio-option').forEach(btn => {
    btn.addEventListener('click', () => {
      sharedTaskPrioritySelector.querySelectorAll('.prio-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      prioridadTareaCompartida = btn.dataset.priority || 'simple';
    });
  });
}

// ==========================================
// INGRESO Y REGISTRO CON DNI
// ==========================================
async function iniciarSesionConDni(forzarRegistroHuella = false) {
  const dni = inputLoginDni ? inputLoginDni.value.trim() : '';
  const pass = inputLoginDniPass ? inputLoginDniPass.value : '';

  if (dniLoginError) dniLoginError.classList.add('hidden');

  if (!dni) {
    if (dniLoginError) {
      dniLoginError.textContent = 'Por favor ingresá tu número de DNI o usuario';
      dniLoginError.classList.remove('hidden');
    }
    if (inputLoginDni) inputLoginDni.focus();
    return;
  }
  if (!pass) {
    if (dniLoginError) {
      dniLoginError.textContent = 'Por favor ingresá tu contraseña';
      dniLoginError.classList.remove('hidden');
    }
    if (inputLoginDniPass) inputLoginDniPass.focus();
    return;
  }

  if (btnSubmitDniLogin) {
    btnSubmitDniLogin.disabled = true;
    btnSubmitDniLogin.textContent = 'Ingresando...';
  }

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'ingresar_con_dni',
        dni: dni,
        password: pass
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (dniLoginError) {
        dniLoginError.textContent = data.error || 'DNI o contraseña incorrectos';
        dniLoginError.classList.remove('hidden');
      }
      if (data.blanqueada && typeof abrirRecuperacionPassword === 'function') {
        abrirRecuperacionPassword(dni);
      }
      return;
    }

    const u = data.usuario;
    localStorage.setItem('agenda_usuario_recordado', u.id);
    localStorage.setItem('agenda_dni_configurado', 'true');
    const esDev = Boolean(u.id === 'alejandro' || (u.dni && String(u.dni).replace(/\D/g, '') === '40218898') || (data.dni && String(data.dni).replace(/\D/g, '') === '40218898'));
    usuarioActivo = {
      id: u.id,
      nombre: u.nombre,
      dni: data.dni || u.dni || null,
      esAdmin: esDev,
      avatar: esDev ? '👑' : (u.avatar || '👤'),
      tienePreguntaSeguridad: Boolean(data.tienePreguntaSeguridad || u.tienePreguntaSeguridad),
      preguntaSeguridad: data.preguntaSeguridad || u.preguntaSeguridad || null,
      password: pass,
      tiempoBloqueoMin: data.tiempoBloqueoMin || Number(localStorage.getItem('agenda_bloqueo_' + u.id)) || 60
    };

    if (Array.isArray(data.usuarios)) listaUsuariosPublica = data.usuarios;
    tareas = Array.isArray(data.tareas) ? data.tareas : [];
    tareasCompartidas = Array.isArray(data.tareasCompartidas) ? data.tareasCompartidas : [];
    avisosTareas = Array.isArray(data.avisosTareas) ? data.avisosTareas : [];
    recordatorios = Array.isArray(data.recordatorios) ? data.recordatorios : [];
    movimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
    supermercado = Array.isArray(data.supermercado) ? data.supermercado : [];
    heladera = Array.isArray(data.heladera) ? data.heladera : [];
    entrenamiento = data.entrenamiento || null;
    listasPresupuestos = Array.isArray(data.listasPresupuestos) ? data.listasPresupuestos : [];
    deudores = Array.isArray(data.deudores) ? data.deudores : [];
    yoDebo = Array.isArray(data.yoDebo) ? data.yoDebo : [];
    idDeudorActivo = null;
    superCompartidoCon = Array.isArray(data.superCompartidoCon) ? data.superCompartidoCon : [];
    yaConfiguroCasa = Boolean(data.yaConfiguroCasa);
    borrados = Array.isArray(data.borrados) ? data.borrados : [];
    borradosListas = Array.isArray(data.borradosListas) ? data.borradosListas : [];
    if (data.tnaConfig) usuarioActivo.tnaConfig = data.tnaConfig;
    usuarioActivo.vinculos = Array.isArray(data.vinculos) ? data.vinculos : [];
    solicitudesVinculoRecibidas = Array.isArray(data.solicitudesVinculoRecibidas) ? data.solicitudesVinculoRecibidas : [];
    solicitudesVinculoEnviadas = Array.isArray(data.solicitudesVinculoEnviadas) ? data.solicitudesVinculoEnviadas : [];

    registrarActividadSesion();
    guardarCacheDatosUsuarioLocal();
    const checkBio = document.getElementById('check-enable-fingerprint-login');
    const activarBio = forzarRegistroHuella || (checkBio ? checkBio.checked : true);
    if (activarBio && window.PublicKeyCredential && !tieneHuellaGuardada(u.id)) {
      activarHuellaParaUsuario(usuarioActivo, pass).catch(err => console.warn('Huella no registrada:', err));
    }
    if (inputLoginDni) inputLoginDni.value = '';
    if (inputLoginDniPass) inputLoginDniPass.value = '';
    if (dniLoginBox) dniLoginBox.classList.add('hidden');

    entrarAMenuDeUsuarioActivo(true);
  } catch (e) {
    if (dniLoginError) {
      dniLoginError.textContent = 'Error de conexión. Intentá nuevamente.';
      dniLoginError.classList.remove('hidden');
    }
  } finally {
    if (btnSubmitDniLogin) {
      btnSubmitDniLogin.disabled = false;
      btnSubmitDniLogin.textContent = 'Iniciar sesión (Enter)';
    }
  }
}

async function guardarDniUsuario() {
  if (!usuarioActivo) return;
  const raw = inputUserDni ? inputUserDni.value.trim() : '';
  const dniLimpio = raw.replace(/\D/g, '');

  if (registerDniError) registerDniError.classList.add('hidden');

  if (!dniLimpio || dniLimpio.length < 5) {
    if (registerDniError) {
      registerDniError.textContent = 'Ingresá un número de DNI válido (mínimo 5 dígitos)';
      registerDniError.classList.remove('hidden');
    }
    if (inputUserDni) inputUserDni.focus();
    return;
  }

  if (btnSaveUserDni) {
    btnSaveUserDni.disabled = true;
    btnSaveUserDni.textContent = 'Guardando...';
  }

  try {
    const res = await fetch(API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'guardar_dni',
        usuarioId: usuarioActivo.id,
        password: usuarioActivo.password,
        dni: dniLimpio
      })
    });
    const data = await res.json();
    if (!res.ok) {
      if (registerDniError) {
        registerDniError.textContent = data.error || 'No se pudo guardar el DNI';
        registerDniError.classList.remove('hidden');
      }
      return;
    }

    usuarioActivo.dni = data.dni || dniLimpio;
    localStorage.setItem('agenda_dni_configurado', 'true');
    if (modalRegisterDni) modalRegisterDni.classList.add('hidden');
    alert('¡Tu DNI quedó registrado con éxito! Te servirá para futuros inicios de sesión.');
  } catch (e) {
    if (registerDniError) {
      registerDniError.textContent = 'Error al guardar el DNI: ' + (e.message || String(e));
      registerDniError.classList.remove('hidden');
    }
  } finally {
    if (btnSaveUserDni) {
      btnSaveUserDni.disabled = false;
      btnSaveUserDni.textContent = '✓ Guardar mi DNI';
    }
  }
}

if (btnSubmitDniLogin) btnSubmitDniLogin.addEventListener('click', iniciarSesionConDni);

if (inputLoginDni) {
  inputLoginDni.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputLoginDniPass) inputLoginDniPass.focus();
    }
  });
}

if (inputLoginDniPass) {
  inputLoginDniPass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      iniciarSesionConDni();
    }
  });
}

if (btnSaveUserDni) btnSaveUserDni.addEventListener('click', guardarDniUsuario);

if (inputUserDni) {
  inputUserDni.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      guardarDniUsuario();
    }
  });
}

if (btnToggleDniRegister) {
  btnToggleDniRegister.addEventListener('click', () => {
    if (boxDniRegisterNew) {
      boxDniRegisterNew.classList.toggle('hidden');
      if (!boxDniRegisterNew.classList.contains('hidden') && inputRegName) {
        inputRegName.focus();
      }
    }
  });
}

if (btnCancelDniRegister) {
  btnCancelDniRegister.addEventListener('click', () => {
    if (boxDniRegisterNew) boxDniRegisterNew.classList.add('hidden');
  });
}

if (btnSubmitDniRegister) {
  btnSubmitDniRegister.addEventListener('click', async () => {
    const nombre = inputRegName ? inputRegName.value.trim() : '';
    const rawDni = inputRegDni ? inputRegDni.value.trim() : '';
    const dniLimpio = rawDni.replace(/\D/g, '');
    const pass = inputRegPass ? inputRegPass.value.trim() : '';

    if (dniRegisterError) dniRegisterError.classList.add('hidden');

    if (!nombre) {
      if (dniRegisterError) {
        dniRegisterError.textContent = 'Por favor ingresá tu nombre completo';
        dniRegisterError.classList.remove('hidden');
      }
      if (inputRegName) inputRegName.focus();
      return;
    }
    if (!dniLimpio || dniLimpio.length < 5) {
      if (dniRegisterError) {
        dniRegisterError.textContent = 'Por favor ingresá tu DNI (mínimo 5 números)';
        dniRegisterError.classList.remove('hidden');
      }
      if (inputRegDni) inputRegDni.focus();
      return;
    }
    if (!pass || pass.length < 3) {
      if (dniRegisterError) {
        dniRegisterError.textContent = 'Por favor creá una contraseña de al menos 3 caracteres';
        dniRegisterError.classList.remove('hidden');
      }
      if (inputRegPass) inputRegPass.focus();
      return;
    }

    btnSubmitDniRegister.disabled = true;
    btnSubmitDniRegister.textContent = 'Creando cuenta...';

    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'crear_usuario',
          nombre: nombre,
          dni: dniLimpio,
          password: pass
        })
      });

      const data = await res.json();
      if (!res.ok || !data.usuario) {
        if (dniRegisterError) {
          dniRegisterError.textContent = data.error || 'No se pudo crear la cuenta';
          dniRegisterError.classList.remove('hidden');
        }
        return;
      }

      localStorage.setItem('agenda_dni_configurado', 'true');
      localStorage.setItem('agenda_usuario_recordado', data.usuario.id);

      usuarioActivo = {
        id: data.usuario.id,
        nombre: data.usuario.nombre,
        dni: dniLimpio,
        esAdmin: false,
        avatar: data.usuario.avatar || '👤',
        password: pass
      };

      tareas = [];
      tareasCompartidas = [];
      avisosTareas = [];
      recordatorios = [];
      movimientos = [];
      supermercado = [];
      heladera = [];
      entrenamiento = null;
      listasPresupuestos = [];
      deudores = [];
      yoDebo = [];
      idDeudorActivo = null;

      registrarActividadSesion();
      if (boxDniRegisterNew) boxDniRegisterNew.classList.add('hidden');
      if (dniLoginBox) dniLoginBox.classList.add('hidden');
      entrarAMenuDeUsuarioActivo();
      alert(`🎉 ¡Bienvenido/a ${nombre}! Tu cuenta fue creada con éxito con tu DNI.`);
    } catch (e) {
      if (dniRegisterError) {
        dniRegisterError.textContent = 'Error de conexión. Intentá nuevamente.';
        dniRegisterError.classList.remove('hidden');
      }
    } finally {
      if (btnSubmitDniRegister) {
        btnSubmitDniRegister.disabled = false;
        btnSubmitDniRegister.textContent = 'Crear mi cuenta';
      }
    }
  });
}

if (btnLogoutDevice) {
  btnLogoutDevice.addEventListener('click', () => {
    if (confirm('¿Cerrar tu sesión por completo en este dispositivo? Para volver a ingresar tendrás que poner tu DNI y tu contraseña.')) {
      volverAPantallaUsuarios(true);
    }
  });
}

// ==========================================
// RECUPERACIÓN / RESTABLECIMIENTO DE CONTRASEÑA CON PREGUNTA CLAVE
// ==========================================
const btnOpenRecoverPass = document.getElementById('btn-open-recover-pass');
const boxRecoverPass = document.getElementById('box-recover-pass');
const inputRecoverDni = document.getElementById('input-recover-dni');
const btnCheckRecoverDni = document.getElementById('btn-check-recover-dni');
const boxRecoverStep2 = document.getElementById('box-recover-step2');
const labelRecoverQuestion = document.getElementById('label-recover-question');
const groupRecoverAnswer = document.getElementById('group-recover-answer');
const inputRecoverAnswer = document.getElementById('input-recover-answer');
const boxRecoverSetupQuestion = document.getElementById('box-recover-setup-question');
const inputRecoverSetupQ = document.getElementById('input-recover-setup-q');
const inputRecoverSetupA = document.getElementById('input-recover-setup-a');
const inputRecoverNewPass = document.getElementById('input-recover-new-pass');
const inputRecoverRepeatPass = document.getElementById('input-recover-repeat-pass');
const btnSubmitRecoverPass = document.getElementById('btn-submit-recover-pass');
const btnCancelRecoverPass = document.getElementById('btn-cancel-recover-pass');
const recoverPassError = document.getElementById('recover-pass-error');
const recoverPassSuccess = document.getElementById('recover-pass-success');

let usuarioRecuperando = null;

function abrirRecuperacionPassword(dniPrellenado) {
  if (!boxRecoverPass) return;
  boxRecoverPass.classList.remove('hidden');
  if (recoverPassError) recoverPassError.classList.add('hidden');
  if (recoverPassSuccess) recoverPassSuccess.classList.add('hidden');
  if (boxRecoverStep2) boxRecoverStep2.classList.add('hidden');
  if (btnCheckRecoverDni) btnCheckRecoverDni.classList.remove('hidden');
  if (btnSubmitRecoverPass) btnSubmitRecoverPass.classList.add('hidden');

  if (inputRecoverDni) {
    inputRecoverDni.value = dniPrellenado || (inputLoginDni ? inputLoginDni.value.trim() : '');
    inputRecoverDni.focus();
  }
}

if (btnOpenRecoverPass) {
  btnOpenRecoverPass.addEventListener('click', () => {
    if (boxRecoverPass) {
      if (boxRecoverPass.classList.contains('hidden')) {
        abrirRecuperacionPassword();
      } else {
        boxRecoverPass.classList.add('hidden');
      }
    }
  });
}

if (btnCancelRecoverPass) {
  btnCancelRecoverPass.addEventListener('click', () => {
    if (boxRecoverPass) boxRecoverPass.classList.add('hidden');
  });
}

if (btnCheckRecoverDni) {
  btnCheckRecoverDni.addEventListener('click', async () => {
    const rawDni = inputRecoverDni ? inputRecoverDni.value.trim() : '';
    const dniLimpio = rawDni.replace(/\D/g, '');
    if (recoverPassError) recoverPassError.classList.add('hidden');

    if (!rawDni) {
      if (recoverPassError) {
        recoverPassError.textContent = 'Por favor ingresá tu número de DNI';
        recoverPassError.classList.remove('hidden');
      }
      if (inputRecoverDni) inputRecoverDni.focus();
      return;
    }

    btnCheckRecoverDni.disabled = true;
    btnCheckRecoverDni.textContent = 'Consultando...';

    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'obtener_pregunta_seguridad',
          dni: dniLimpio || rawDni
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (recoverPassError) {
          recoverPassError.textContent = data.error || 'No se encontró ningún usuario con ese DNI';
          recoverPassError.classList.remove('hidden');
        }
        return;
      }

      usuarioRecuperando = data;

      if (boxRecoverStep2) boxRecoverStep2.classList.remove('hidden');
      if (btnCheckRecoverDni) btnCheckRecoverDni.classList.add('hidden');
      if (btnSubmitRecoverPass) btnSubmitRecoverPass.classList.remove('hidden');

      if (data.tienePregunta) {
        if (labelRecoverQuestion) labelRecoverQuestion.textContent = data.preguntaSeguridad;
        if (groupRecoverAnswer) groupRecoverAnswer.classList.remove('hidden');
        if (boxRecoverSetupQuestion) boxRecoverSetupQuestion.classList.add('hidden');
        if (inputRecoverAnswer) {
          inputRecoverAnswer.value = '';
          inputRecoverAnswer.focus();
        }
      } else {
        if (labelRecoverQuestion) labelRecoverQuestion.textContent = 'Aún no tenías pregunta clave registrada. Podés crear una ahora junto a tu nueva clave.';
        if (groupRecoverAnswer) groupRecoverAnswer.classList.add('hidden');
        if (boxRecoverSetupQuestion) boxRecoverSetupQuestion.classList.remove('hidden');
        if (inputRecoverSetupQ) inputRecoverSetupQ.focus();
      }
    } catch(e) {
      if (recoverPassError) {
        recoverPassError.textContent = 'Error de conexión. Intentá nuevamente.';
        recoverPassError.classList.remove('hidden');
      }
    } finally {
      if (btnCheckRecoverDni) {
        btnCheckRecoverDni.disabled = false;
        btnCheckRecoverDni.textContent = 'Continuar';
      }
    }
  });
}

if (btnSubmitRecoverPass) {
  btnSubmitRecoverPass.addEventListener('click', async () => {
    const rawDni = inputRecoverDni ? inputRecoverDni.value.trim() : '';
    const dniLimpio = rawDni.replace(/\D/g, '') || rawDni;
    const resp = inputRecoverAnswer ? inputRecoverAnswer.value.trim() : '';
    const newPass = inputRecoverNewPass ? inputRecoverNewPass.value.trim() : '';
    const repeatPass = inputRecoverRepeatPass ? inputRecoverRepeatPass.value.trim() : '';

    const setupQ = inputRecoverSetupQ ? inputRecoverSetupQ.value.trim() : '';
    const setupA = inputRecoverSetupA ? inputRecoverSetupA.value.trim() : '';

    if (recoverPassError) recoverPassError.classList.add('hidden');

    if (usuarioRecuperando && usuarioRecuperando.tienePregunta && !resp) {
      if (recoverPassError) {
        recoverPassError.textContent = 'Por favor escribí la respuesta a tu pregunta clave';
        recoverPassError.classList.remove('hidden');
      }
      if (inputRecoverAnswer) inputRecoverAnswer.focus();
      return;
    }

    if (usuarioRecuperando && !usuarioRecuperando.tienePregunta && (!setupQ || !setupA)) {
      if (recoverPassError) {
        recoverPassError.textContent = 'Por favor completá tu nueva pregunta y respuesta de seguridad';
        recoverPassError.classList.remove('hidden');
      }
      return;
    }

    if (!newPass || newPass.length < 3) {
      if (recoverPassError) {
        recoverPassError.textContent = 'La nueva contraseña debe tener al menos 3 caracteres';
        recoverPassError.classList.remove('hidden');
      }
      if (inputRecoverNewPass) inputRecoverNewPass.focus();
      return;
    }

    if (newPass !== repeatPass) {
      if (recoverPassError) {
        recoverPassError.textContent = 'Las contraseñas no coinciden. Verificalas.';
        recoverPassError.classList.remove('hidden');
      }
      if (inputRecoverRepeatPass) inputRecoverRepeatPass.focus();
      return;
    }

    btnSubmitRecoverPass.disabled = true;
    btnSubmitRecoverPass.textContent = 'Guardando...';

    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'restablecer_password',
          dni: dniLimpio,
          respuestaSeguridad: resp,
          nuevaPreguntaSeguridad: setupQ,
          nuevaRespuestaSeguridad: setupA,
          nuevaPassword: newPass
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (recoverPassError) {
          recoverPassError.textContent = data.error || 'No se pudo restablecer la contraseña';
          recoverPassError.classList.remove('hidden');
        }
        return;
      }

      if (recoverPassSuccess) {
        recoverPassSuccess.textContent = '✓ ¡Contraseña restablecida con éxito! Ingresando a la agenda...';
        recoverPassSuccess.classList.remove('hidden');
      }

      if (inputLoginDni) inputLoginDni.value = rawDni;
      if (inputLoginDniPass) inputLoginDniPass.value = newPass;

      setTimeout(() => {
        if (boxRecoverPass) boxRecoverPass.classList.add('hidden');
        iniciarSesionConDni();
      }, 1000);

    } catch(e) {
      if (recoverPassError) {
        recoverPassError.textContent = 'Error de conexión al restablecer contraseña.';
        recoverPassError.classList.remove('hidden');
      }
    } finally {
      if (btnSubmitRecoverPass) {
        btnSubmitRecoverPass.disabled = false;
        btnSubmitRecoverPass.textContent = 'Guardar contraseña';
      }
    }
  });
}

// ==========================================
// CAMBIAR CONTRASEÑA EN CONFIGURACIÓN
// ==========================================
const btnToggleChangePass = document.getElementById('btn-toggle-change-pass');
const boxChangePasswordForm = document.getElementById('box-change-password-form');
const btnCancelChangePass = document.getElementById('btn-cancel-change-pass');
const btnSubmitChangePass = document.getElementById('btn-submit-change-pass');
const inputChangePassCurrent = document.getElementById('input-change-pass-current');
const inputChangePassNew = document.getElementById('input-change-pass-new');
const inputChangePassRepeat = document.getElementById('input-change-pass-repeat');
const changePassError = document.getElementById('change-pass-error');
const changePassSuccess = document.getElementById('change-pass-success');

if (btnToggleChangePass) {
  btnToggleChangePass.addEventListener('click', () => {
    if (boxChangePasswordForm) {
      boxChangePasswordForm.classList.toggle('hidden');
      if (changePassError) changePassError.classList.add('hidden');
      if (changePassSuccess) changePassSuccess.classList.add('hidden');
      if (!boxChangePasswordForm.classList.contains('hidden') && inputChangePassCurrent) {
        inputChangePassCurrent.value = '';
        if (inputChangePassNew) inputChangePassNew.value = '';
        if (inputChangePassRepeat) inputChangePassRepeat.value = '';
        inputChangePassCurrent.focus();
      }
    }
    const secBox = document.getElementById('box-security-question-form');
    if (secBox) secBox.classList.add('hidden');
  });
}

if (btnCancelChangePass) {
  btnCancelChangePass.addEventListener('click', () => {
    if (boxChangePasswordForm) boxChangePasswordForm.classList.add('hidden');
  });
}

if (btnSubmitChangePass) {
  btnSubmitChangePass.addEventListener('click', async () => {
    if (!usuarioActivo) return;
    const curPass = inputChangePassCurrent ? inputChangePassCurrent.value.trim() : '';
    const newPass = inputChangePassNew ? inputChangePassNew.value.trim() : '';
    const repPass = inputChangePassRepeat ? inputChangePassRepeat.value.trim() : '';

    if (changePassError) changePassError.classList.add('hidden');
    if (changePassSuccess) changePassSuccess.classList.add('hidden');

    if (!curPass) {
      if (changePassError) {
        changePassError.textContent = 'Por favor ingresá tu contraseña anterior';
        changePassError.classList.remove('hidden');
      }
      if (inputChangePassCurrent) inputChangePassCurrent.focus();
      return;
    }

    if (!newPass || newPass.length < 3) {
      if (changePassError) {
        changePassError.textContent = 'La nueva contraseña debe tener al menos 3 caracteres';
        changePassError.classList.remove('hidden');
      }
      if (inputChangePassNew) inputChangePassNew.focus();
      return;
    }

    if (newPass !== repPass) {
      if (changePassError) {
        changePassError.textContent = 'Las nuevas contraseñas no coinciden';
        changePassError.classList.remove('hidden');
      }
      if (inputChangePassRepeat) inputChangePassRepeat.focus();
      return;
    }

    btnSubmitChangePass.disabled = true;
    btnSubmitChangePass.textContent = 'Guardando...';

    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'cambiar_password',
          usuarioId: usuarioActivo.id,
          passwordAnterior: curPass,
          nuevaPassword: newPass
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (changePassError) {
          changePassError.textContent = data.error || 'No se pudo cambiar la contraseña';
          changePassError.classList.remove('hidden');
        }
        return;
      }

      usuarioActivo.password = newPass;

      // Actualizar sesión guardada
      const sesiones = leerSesionesGuardadas();
      if (sesiones[usuarioActivo.id]) {
        sesiones[usuarioActivo.id].password = newPass;
        sesiones[usuarioActivo.id].ultimaActividad = Date.now();
        localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sesiones));
      }

      // Actualizar huella biométrica local si está activada
      try {
        const bioRaw = localStorage.getItem('agenda_bio_' + usuarioActivo.id);
        if (bioRaw) {
          const bioObj = JSON.parse(bioRaw);
          if (bioObj) {
            bioObj.pass = newPass;
            localStorage.setItem('agenda_bio_' + usuarioActivo.id, JSON.stringify(bioObj));
          }
        }
      } catch(e) {}

      if (changePassSuccess) {
        changePassSuccess.textContent = '✓ ¡Contraseña cambiada exitosamente!';
        changePassSuccess.classList.remove('hidden');
      }

      setTimeout(() => {
        if (boxChangePasswordForm) boxChangePasswordForm.classList.add('hidden');
      }, 2000);

    } catch(e) {
      if (changePassError) {
        changePassError.textContent = 'Error de conexión al cambiar la contraseña.';
        changePassError.classList.remove('hidden');
      }
    } finally {
      if (btnSubmitChangePass) {
        btnSubmitChangePass.disabled = false;
        btnSubmitChangePass.textContent = 'Guardar contraseña';
      }
    }
  });
}

// ==========================================
// PREGUNTA CLAVE DE SEGURIDAD EN CONFIGURACIÓN
// ==========================================
const btnToggleSecurityQ = document.getElementById('btn-toggle-security-q');
const boxSecurityQuestionForm = document.getElementById('box-security-question-form');
const selectSecurityQ = document.getElementById('select-security-q');
const boxCustomSecurityQ = document.getElementById('box-custom-security-q');
const inputCustomSecurityQ = document.getElementById('input-custom-security-q');
const inputSecurityA = document.getElementById('input-security-a');
const inputSecurityConfirmPass = document.getElementById('input-security-confirm-pass');
const btnCancelSecurityQ = document.getElementById('btn-cancel-security-q');
const btnSubmitSecurityQ = document.getElementById('btn-submit-security-q');
const securityQError = document.getElementById('security-q-error');
const securityQSuccess = document.getElementById('security-q-success');

if (btnToggleSecurityQ) {
  btnToggleSecurityQ.addEventListener('click', () => {
    if (boxSecurityQuestionForm) {
      boxSecurityQuestionForm.classList.toggle('hidden');
      if (securityQError) securityQError.classList.add('hidden');
      if (securityQSuccess) securityQSuccess.classList.add('hidden');
      if (!boxSecurityQuestionForm.classList.contains('hidden')) {
        if (usuarioActivo && usuarioActivo.preguntaSeguridad && selectSecurityQ) {
          let found = false;
          for (let opt of selectSecurityQ.options) {
            if (opt.value === usuarioActivo.preguntaSeguridad) {
              selectSecurityQ.value = opt.value;
              found = true;
              break;
            }
          }
          if (!found) {
            selectSecurityQ.value = 'otra';
            if (boxCustomSecurityQ) boxCustomSecurityQ.classList.remove('hidden');
            if (inputCustomSecurityQ) inputCustomSecurityQ.value = usuarioActivo.preguntaSeguridad;
          }
        }
      }
    }
    if (boxChangePasswordForm) boxChangePasswordForm.classList.add('hidden');
  });
}

if (selectSecurityQ) {
  selectSecurityQ.addEventListener('change', () => {
    if (boxCustomSecurityQ) {
      if (selectSecurityQ.value === 'otra') {
        boxCustomSecurityQ.classList.remove('hidden');
        if (inputCustomSecurityQ) inputCustomSecurityQ.focus();
      } else {
        boxCustomSecurityQ.classList.add('hidden');
      }
    }
  });
}

if (btnCancelSecurityQ) {
  btnCancelSecurityQ.addEventListener('click', () => {
    if (boxSecurityQuestionForm) boxSecurityQuestionForm.classList.add('hidden');
  });
}

if (btnSubmitSecurityQ) {
  btnSubmitSecurityQ.addEventListener('click', async () => {
    if (!usuarioActivo) return;
    let preg = selectSecurityQ ? selectSecurityQ.value : '';
    if (preg === 'otra') {
      preg = inputCustomSecurityQ ? inputCustomSecurityQ.value.trim() : '';
    }
    const resp = inputSecurityA ? inputSecurityA.value.trim() : '';
    const pass = inputSecurityConfirmPass ? inputSecurityConfirmPass.value.trim() : '';

    if (securityQError) securityQError.classList.add('hidden');
    if (securityQSuccess) securityQSuccess.classList.add('hidden');

    if (!preg) {
      if (securityQError) {
        securityQError.textContent = 'Por favor elegí o escribí tu pregunta de seguridad';
        securityQError.classList.remove('hidden');
      }
      return;
    }

    if (!resp) {
      if (securityQError) {
        securityQError.textContent = 'Por favor escribí tu respuesta a la pregunta clave';
        securityQError.classList.remove('hidden');
      }
      if (inputSecurityA) inputSecurityA.focus();
      return;
    }

    if (!pass && usuarioActivo.password) {
      if (securityQError) {
        securityQError.textContent = 'Por favor confirmá con tu contraseña actual';
        securityQError.classList.remove('hidden');
      }
      if (inputSecurityConfirmPass) inputSecurityConfirmPass.focus();
      return;
    }

    btnSubmitSecurityQ.disabled = true;
    btnSubmitSecurityQ.textContent = 'Guardando...';

    try {
      const res = await fetch(API_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar_pregunta_seguridad',
          usuarioId: usuarioActivo.id,
          password: pass || usuarioActivo.password || '',
          preguntaSeguridad: preg,
          respuestaSeguridad: resp
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (securityQError) {
          securityQError.textContent = data.error || 'No se pudo guardar la pregunta clave';
          securityQError.classList.remove('hidden');
        }
        return;
      }

      usuarioActivo.tienePreguntaSeguridad = true;
      usuarioActivo.preguntaSeguridad = preg;

      renderizarConfiguracion();

      if (securityQSuccess) {
        securityQSuccess.textContent = '✓ ¡Pregunta clave guardada con éxito!';
        securityQSuccess.classList.remove('hidden');
      }

      setTimeout(() => {
        if (boxSecurityQuestionForm) boxSecurityQuestionForm.classList.add('hidden');
      }, 2000);

    } catch(e) {
      if (securityQError) {
        securityQError.textContent = 'Error de conexión al guardar la pregunta clave.';
        securityQError.classList.remove('hidden');
      }
    } finally {
      if (btnSubmitSecurityQ) {
        btnSubmitSecurityQ.disabled = false;
        btnSubmitSecurityQ.textContent = 'Guardar pregunta clave';
      }
    }
  });
}

// Botones de mostrar/ocultar contraseña (ojos)
function togglePasswordInputVisibility(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}
['btn-toggle-rec-pass1:input-recover-new-pass', 'btn-toggle-rec-pass2:input-recover-repeat-pass',
 'btn-toggle-chg-cur:input-change-pass-current', 'btn-toggle-chg-new:input-change-pass-new',
 'btn-toggle-chg-rep:input-change-pass-repeat', 'btn-toggle-sec-pass:input-security-confirm-pass'].forEach(pair => {
  const [btnId, inpId] = pair.split(':');
  const b = document.getElementById(btnId);
  if (b) b.addEventListener('click', () => togglePasswordInputVisibility(inpId));
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
mostrarFechaHoy();

const esEstadoCuenta = window.location.search.includes('estado_cuenta');

if (esEstadoCuenta) {
  viewUsers.classList.add('hidden');
  viewHome.classList.add('hidden');
  if (syncStatusEl) syncStatusEl.classList.add('hidden');
  inicializarEstadoCuentaPublico();
} else if (ES_MODO_EXTERNO) {
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

window.__APP_INITIALIZED = true;
