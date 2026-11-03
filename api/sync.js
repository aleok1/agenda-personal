import { sendWebPushNotification } from './_push.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.GITHUB_DB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Falta configurar GITHUB_DB_TOKEN en Vercel' });
  }

  const repoUrl = 'https://api.github.com/repos/aleok1/agenda-personal-datos/contents/datos.json';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agenda-personal-vercel'
  };

  async function leerBaseDeDatos() {
    let sha = null;
    let raw = {};
    const r = await fetch(repoUrl, { headers, cache: 'no-store' });
    if (r.ok) {
      const fileData = await r.json();
      sha = fileData.sha;
      try {
        raw = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
      } catch (e) {
        raw = {};
      }
    }

    if (!raw.usuarios) {
      raw.usuarios = {
        alejandro: {
          id: 'alejandro',
          nombre: 'Alejandro',
          esAdmin: true,
          password: null,
          tareas: Array.isArray(raw.tareas) ? raw.tareas : [],
          recordatorios: Array.isArray(raw.recordatorios) ? raw.recordatorios : [],
          movimientos: Array.isArray(raw.movimientos) ? raw.movimientos : [],
          supermercado: [],
          superCompartidoCon: [],
          borrados: Array.isArray(raw.borrados) ? raw.borrados : []
        }
      };
    } else if (!raw.usuarios.alejandro) {
      raw.usuarios.alejandro = {
        id: 'alejandro',
        nombre: 'Alejandro',
        esAdmin: true,
        password: null,
        tareas: [],
        recordatorios: [],
        movimientos: [],
        supermercado: [],
        superCompartidoCon: [],
        borrados: []
      };
    }

    // Asegurar campos de supermercado, heladera y casa en todos los usuarios
    if (!Array.isArray(raw.tareasCompartidas)) raw.tareasCompartidas = [];
    Object.values(raw.usuarios).forEach(u => {
      if (!Array.isArray(u.supermercado)) u.supermercado = [];
      if (!Array.isArray(u.heladera)) u.heladera = [];
      if (!Array.isArray(u.listasPresupuestos)) u.listasPresupuestos = [];
      if (!Array.isArray(u.deudores)) u.deudores = [];
      if (!Array.isArray(u.yoDebo)) u.yoDebo = [];
      if (!Array.isArray(u.superCompartidoCon)) u.superCompartidoCon = [];
      if (typeof u.yaConfiguroCasa !== 'boolean') u.yaConfiguroCasa = false;
      if (u.dni === undefined) u.dni = null;
    });

    return { sha, db: raw };
  }

  async function guardarBaseDeDatos(db, sha, mensajeCommit) {
    db.actualizado = new Date().toISOString();
    const contentBase64 = Buffer.from(JSON.stringify(db, null, 2), 'utf8').toString('base64');
    const putPayload = {
      message: mensajeCommit || 'Actualizar Agenda Familiar',
      content: contentBase64
    };
    if (sha) putPayload.sha = sha;

    const putRes = await fetch(repoUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(putPayload)
    });
    return putRes.ok;
  }

  function resumenPublicoUsuarios(usuariosMap) {
    const defaultAvatars = {
      'alejandro': '👑',
      'nico-7999': '🦁',
      'romi-7301': '🌸',
      'ariel-0414': '⚡'
    };
    return Object.values(usuariosMap).map(u => ({
      id: u.id,
      nombre: u.nombre,
      esAdmin: Boolean(u.esAdmin),
      avatar: u.avatar || defaultAvatars[u.id] || (u.esAdmin ? '👑' : '👤'),
      tienePassword: Boolean(u.password),
      passwordBlanqueada: Boolean(u.passwordBlanqueada),
      tienePreguntaSeguridad: Boolean(u.respuestaSeguridad)
    }));
  }

  function esUsuarioParticipanteDeTarea(t, usuarioId) {
    if (!t || !usuarioId) return false;
    if (t.creadorId === usuarioId) return true;
    if (t.socioId === usuarioId) return true;
    if (Array.isArray(t.sociosIds) && t.sociosIds.includes(usuarioId)) return true;
    if (Array.isArray(t.participantes) && t.participantes.some(p => p.id === usuarioId)) return true;
    return false;
  }

  // Propagar la lista de supermercado y heladera a todos los usuarios con los que vive en la misma casa
  function propagarSupermercadoCompartido(db, usuarioOrigen) {
    const listaActual = usuarioOrigen.supermercado || [];
    const heladeraActual = usuarioOrigen.heladera || [];
    const vinculados = Array.isArray(usuarioOrigen.superCompartidoCon) ? usuarioOrigen.superCompartidoCon : [];
    vinculados.forEach(otroId => {
      const otroU = db.usuarios[otroId];
      if (otroU) {
        otroU.supermercado = JSON.parse(JSON.stringify(listaActual));
        otroU.heladera = JSON.parse(JSON.stringify(heladeraActual));
      }
    });
  }

  // Propagar listas de compras/presupuestos compartidas entre usuarios y notificar invitaciones
  async function propagarListasCompartidas(db, usuarioOrigen) {
    const listasOrigen = Array.isArray(usuarioOrigen.listasPresupuestos) ? usuarioOrigen.listasPresupuestos : [];

    for (const lista of listasOrigen) {
      const compartidaCon = Array.isArray(lista.compartidaCon) ? lista.compartidaCon : [];
      if (compartidaCon.length === 0) continue;

      const destinatariosIds = new Set(compartidaCon);
      if (lista.creadorId && lista.creadorId !== usuarioOrigen.id) {
        destinatariosIds.add(lista.creadorId);
      }
      destinatariosIds.delete(usuarioOrigen.id);

      for (const targetId of destinatariosIds) {
        const targetUser = db.usuarios[targetId];
        if (!targetUser) continue;
        if (!Array.isArray(targetUser.listasPresupuestos)) targetUser.listasPresupuestos = [];

        const idx = targetUser.listasPresupuestos.findIndex(l => l.id === lista.id);
        if (idx === -1) {
          // Invitación a nueva lista compartida
          targetUser.listasPresupuestos.push(JSON.parse(JSON.stringify(lista)));

          // Enviar Push notification al celular del invitado si tiene suscripción
          if (Array.isArray(targetUser.pushSubscriptions) && targetUser.pushSubscriptions.length > 0) {
            const payload = {
              title: `📋 Lista compartida por ${usuarioOrigen.nombre}`,
              body: `Te compartió la lista "${lista.nombre}". Podés verla y agregar materiales.`,
              tag: 'lista-invitacion-' + lista.id,
              url: '/'
            };
            for (const sub of targetUser.pushSubscriptions) {
              await sendWebPushNotification(sub, payload);
            }
          }
        } else {
          // Ya existe: actualizar contenido de la lista con los cambios más recientes
          const listaExistente = targetUser.listasPresupuestos[idx];
          const fechaOrigen = Number(lista.updatedAt) || Number(lista.creadoEl) || 0;
          const fechaTarget = Number(listaExistente.updatedAt) || Number(listaExistente.creadoEl) || 0;
          if (fechaOrigen >= fechaTarget) {
            targetUser.listasPresupuestos[idx] = JSON.parse(JSON.stringify(lista));
          }
        }
      }
    }

    // Propagar listas eliminadas
    const borradosListas = Array.isArray(usuarioOrigen.borradosListas) ? usuarioOrigen.borradosListas : [];
    if (borradosListas.length > 0) {
      for (const listaIdBorrada of borradosListas) {
        Object.values(db.usuarios).forEach(otro => {
          if (otro.id !== usuarioOrigen.id && Array.isArray(otro.listasPresupuestos)) {
            otro.listasPresupuestos = otro.listasPresupuestos.filter(
              l => l.id !== listaIdBorrada || (l.creadorId && l.creadorId !== usuarioOrigen.id)
            );
          }
        });
      }
    }
  }

  try {
    if (req.method === 'GET') {
      const { db } = await leerBaseDeDatos();
      const accion = req.query?.accion || 'lista_usuarios';

      if (accion === 'lista_usuarios') {
        return res.status(200).json({
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      const usuarioId = req.query?.usuarioId;
      const pass = req.query?.password || '';
      const u = db.usuarios[usuarioId];
      if (!u) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      if (u.password && u.password !== pass) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      return res.status(200).json({
        dni: u.dni || null,
        avatar: u.esAdmin ? '👑' : (u.avatar || '👤'),
        tienePreguntaSeguridad: Boolean(u.respuestaSeguridad),
        preguntaSeguridad: u.preguntaSeguridad || null,
        tareas: u.tareas || [],
        tareasCompartidas: (db.tareasCompartidas || []).filter(t => esUsuarioParticipanteDeTarea(t, u.id)),
        avisosTareas: u.avisosTareas || [],
        recordatorios: u.recordatorios || [],
        movimientos: u.movimientos || [],
        supermercado: u.supermercado || [],
        heladera: u.heladera || [],
        entrenamiento: u.entrenamiento || null,
        listasPresupuestos: u.listasPresupuestos || [],
        deudores: u.deudores || [],
        yoDebo: u.yoDebo || [],
        superCompartidoCon: u.superCompartidoCon || [],
        yaConfiguroCasa: Boolean(u.yaConfiguroCasa),
        tiempoBloqueoMin: u.tiempoBloqueoMin || 60,
        borrados: u.borrados || [],
        usuarios: resumenPublicoUsuarios(db.usuarios)
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { sha, db } = await leerBaseDeDatos();
      const accion = body.accion || 'sincronizar_usuario';

      if (accion === 'guardar_dni') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (u.password && body.password && u.password !== String(body.password || '')) {
          return res.status(401).json({ error: 'Sesión no válida' });
        }
        const dniLimpio = String(body.dni || '').replace(/\D/g, '').trim();
        if (!dniLimpio || dniLimpio.length < 5) {
          return res.status(400).json({ error: 'Ingresá un número de DNI válido (mínimo 5 números)' });
        }
        const duplicado = Object.values(db.usuarios).find(
          otro => otro.id !== u.id && String(otro.dni || '').replace(/\D/g, '') === dniLimpio
        );
        if (duplicado) {
          return res.status(400).json({ error: `El DNI ya está registrado por ${duplicado.nombre}` });
        }
        u.dni = dniLimpio;
        await guardarBaseDeDatos(db, sha, `Guardar DNI para ${u.nombre}`);
        return res.status(200).json({ ok: true, dni: dniLimpio });
      }

      if (accion === 'ingresar_con_dni') {
        const inputDni = String(body.dni || '').trim();
        const dniSoloNumeros = inputDni.replace(/\D/g, '');
        const pass = String(body.password || '').trim();

        if (!inputDni || !pass) {
          return res.status(400).json({ error: 'Completá tu DNI y tu contraseña' });
        }

        // Buscar por DNI o temporalmente por nombre/id para quienes aún no registraron DNI
        const u = Object.values(db.usuarios).find(x => {
          if (dniSoloNumeros && x.dni && String(x.dni).replace(/\D/g, '') === dniSoloNumeros) {
            return true;
          }
          if (String(x.nombre || '').toLowerCase() === inputDni.toLowerCase()) {
            return true;
          }
          if (x.id.toLowerCase() === inputDni.toLowerCase()) {
            return true;
          }
          return false;
        });

        if (!u) {
          return res.status(404).json({ error: 'No se encontró ningún usuario con ese DNI o nombre' });
        }

        if (u.passwordBlanqueada) {
          return res.status(403).json({
            error: 'Tu contraseña fue blanqueada por el administrador Alejandro. Hacé clic en "¿Olvidaste tu contraseña o fue blanqueada?" para restablecerla con tu pregunta clave.',
            blanqueada: true
          });
        }

        if (u.password && u.password !== pass) {
          return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        return res.status(200).json({
          ok: true,
          usuario: {
            id: u.id,
            nombre: u.nombre,
            dni: u.dni || null,
            esAdmin: Boolean(u.esAdmin),
            avatar: u.esAdmin ? '👑' : (u.avatar || '👤'),
            tienePreguntaSeguridad: Boolean(u.respuestaSeguridad),
            preguntaSeguridad: u.preguntaSeguridad || null
          },
          dni: u.dni || null,
          tienePreguntaSeguridad: Boolean(u.respuestaSeguridad),
          preguntaSeguridad: u.preguntaSeguridad || null,
          tareas: u.tareas || [],
          tareasCompartidas: (db.tareasCompartidas || []).filter(t => esUsuarioParticipanteDeTarea(t, u.id)),
          avisosTareas: u.avisosTareas || [],
          recordatorios: u.recordatorios || [],
          movimientos: u.movimientos || [],
          supermercado: u.supermercado || [],
          heladera: u.heladera || [],
          entrenamiento: u.entrenamiento || null,
          listasPresupuestos: u.listasPresupuestos || [],
          deudores: u.deudores || [],
          yoDebo: u.yoDebo || [],
          superCompartidoCon: u.superCompartidoCon || [],
          yaConfiguroCasa: Boolean(u.yaConfiguroCasa),
          tiempoBloqueoMin: u.tiempoBloqueoMin || 60,
          borrados: u.borrados || [],
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      if (accion === 'crear_tarea_compartida') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (u.password && body.password && u.password !== String(body.password || '')) {
          return res.status(401).json({ error: 'Sesión no válida' });
        }

        // Obtener lista de socios seleccionados (uno o varios)
        let sociosIds = [];
        if (Array.isArray(body.sociosIds)) {
          sociosIds = body.sociosIds.filter(id => id && id !== u.id);
        } else if (body.socioId) {
          sociosIds = [body.socioId];
        }

        if (sociosIds.length === 0) {
          return res.status(400).json({ error: 'Seleccioná al menos un participante para la tarea' });
        }

        const sociosValidos = [];
        sociosIds.forEach(sId => {
          const sObj = db.usuarios[sId];
          if (sObj) sociosValidos.push(sObj);
        });

        if (sociosValidos.length === 0) {
          return res.status(404).json({ error: 'No se encontraron los usuarios socios seleccionados' });
        }

        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        const esProgramada = Boolean(body.esProgramada);
        const fechaProgramada = esProgramada && body.fechaProgramada ? String(body.fechaProgramada).trim() : null;

        const participantes = [
          {
            id: u.id,
            nombre: u.nombre,
            rol: 'creador',
            estadoInvitacion: 'aceptada',
            realizada: false,
            realizadaEl: null
          },
          ...sociosValidos.map(s => ({
            id: s.id,
            nombre: s.nombre,
            rol: 'socio',
            estadoInvitacion: 'pendiente',
            realizada: false,
            realizadaEl: null
          }))
        ];

        const primerSocio = sociosValidos[0];
        const nombresSociosStr = sociosValidos.map(s => s.nombre).join(', ');

        const nueva = {
          id: 'tc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          texto: String(body.texto || '').trim(),
          prioridad: body.prioridad || 'simple',
          creadorId: u.id,
          creadorNombre: u.nombre,
          socioId: primerSocio.id,
          socioNombre: primerSocio.nombre,
          sociosIds: sociosValidos.map(s => s.id),
          sociosNombres: nombresSociosStr,
          esGrupal: sociosValidos.length > 1,
          participantes: participantes,
          esProgramada: esProgramada,
          fechaProgramada: fechaProgramada,
          estado: 'pendiente_invitacion',
          realizadaPorCreador: false,
          realizadaPorSocio: false,
          creadoEl: Date.now(),
          actualizadoEl: Date.now()
        };

        db.tareasCompartidas.push(nueva);

        // Notificar a todos los socios invitados
        for (const socio of sociosValidos) {
          if (Array.isArray(socio.pushSubscriptions) && socio.pushSubscriptions.length > 0) {
            const fechaTxt = fechaProgramada ? ` para el día ${fechaProgramada.split('-').reverse().join('/')}` : '';
            const payload = {
              title: esProgramada ? `📅 Tarea programada de ${u.nombre}` : `👥 Invitación de tarea en equipo de ${u.nombre}`,
              body: `Te invitó a realizar${fechaTxt}: "${nueva.texto}". Entrá para responder.`,
              tag: 'tc-' + nueva.id,
              url: '/'
            };
            for (const s of socio.pushSubscriptions) {
              try { await sendWebPushNotification(s, payload); } catch (e) {}
            }
          }
        }

        await guardarBaseDeDatos(db, sha, `Tarea ${esProgramada ? 'programada' : 'compartida'} de ${u.nombre} con ${nombresSociosStr}`);
        return res.status(200).json({
          ok: true,
          tarea: nueva,
          tareasCompartidas: db.tareasCompartidas.filter(t => esUsuarioParticipanteDeTarea(t, u.id))
        });
      }

      if (accion === 'responder_tarea_compartida') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        const tc = db.tareasCompartidas.find(t => t.id === body.tareaId);
        if (!tc) return res.status(404).json({ error: 'Tarea compartida no encontrada' });

        const aceptar = Boolean(body.aceptar);

        if (!Array.isArray(tc.participantes)) {
          tc.participantes = [
            { id: tc.creadorId, nombre: tc.creadorNombre, rol: 'creador', estadoInvitacion: 'aceptada', realizada: Boolean(tc.realizadaPorCreador) },
            { id: tc.socioId, nombre: tc.socioNombre, rol: 'socio', estadoInvitacion: 'pendiente', realizada: Boolean(tc.realizadaPorSocio) }
          ];
        }

        const miPart = tc.participantes.find(p => p.id === u.id);
        if (miPart) {
          miPart.estadoInvitacion = aceptar ? 'aceptada' : 'rechazada';
        }

        const sociosParts = tc.participantes.filter(p => p.rol === 'socio');
        const tienenPendientes = sociosParts.some(p => p.estadoInvitacion === 'pendiente');
        const algunAceptado = sociosParts.some(p => p.estadoInvitacion === 'aceptada');

        if (algunAceptado) {
          tc.estado = 'activa';
        } else if (!tienenPendientes) {
          tc.estado = 'rechazada';
        } else {
          tc.estado = 'pendiente_invitacion';
        }
        tc.actualizadoEl = Date.now();

        // Notificar al creador
        const creador = db.usuarios[tc.creadorId];
        if (creador && Array.isArray(creador.pushSubscriptions)) {
          const payload = {
            title: aceptar ? `✅ ${u.nombre} aceptó tu tarea grupal` : `❌ ${u.nombre} rechazó la tarea grupal`,
            body: `"${tc.texto}"${tc.fechaProgramada ? ` (${tc.fechaProgramada.split('-').reverse().join('/')})` : ''}`,
            tag: 'tc-resp-' + tc.id + '-' + u.id,
            url: '/'
          };
          for (const s of creador.pushSubscriptions) {
            try { await sendWebPushNotification(s, payload); } catch (e) {}
          }
        }

        await guardarBaseDeDatos(db, sha, `${u.nombre} ${aceptar ? 'aceptó' : 'rechazó'} tarea compartida`);
        return res.status(200).json({
          ok: true,
          tarea: tc,
          tareasCompartidas: db.tareasCompartidas.filter(t => esUsuarioParticipanteDeTarea(t, u.id))
        });
      }

      if (accion === 'marcar_tarea_compartida') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        const tc = db.tareasCompartidas.find(t => t.id === body.tareaId);
        if (!tc) return res.status(404).json({ error: 'Tarea compartida no encontrada' });

        const realizada = Boolean(body.realizada);

        if (!Array.isArray(tc.participantes)) {
          tc.participantes = [
            { id: tc.creadorId, nombre: tc.creadorNombre, rol: 'creador', estadoInvitacion: 'aceptada', realizada: Boolean(tc.realizadaPorCreador) },
            { id: tc.socioId, nombre: tc.socioNombre, rol: 'socio', estadoInvitacion: 'aceptada', realizada: Boolean(tc.realizadaPorSocio) }
          ];
        }

        const miPart = tc.participantes.find(p => p.id === u.id);
        if (miPart) {
          miPart.realizada = realizada;
          miPart.realizadaEl = realizada ? Date.now() : null;
        }

        if (tc.creadorId === u.id) tc.realizadaPorCreador = realizada;
        if (tc.socioId === u.id) tc.realizadaPorSocio = realizada;

        const participantesAceptados = tc.participantes.filter(p => p.estadoInvitacion === 'aceptada');
        const todosTildaron = participantesAceptados.length > 0 && participantesAceptados.every(p => p.realizada);

        if (todosTildaron) {
          tc.estado = 'completada';
          tc.completadaEl = Date.now();
        } else {
          tc.estado = 'activa';
        }
        tc.actualizadoEl = Date.now();

        // Notificar a los otros participantes activos
        const otrosIds = tc.participantes.filter(p => p.id !== u.id && p.estadoInvitacion === 'aceptada').map(p => p.id);
        for (const otroId of otrosIds) {
          const otro = db.usuarios[otroId];
          if (otro && realizada && Array.isArray(otro.pushSubscriptions)) {
            const textoPush = tc.estado === 'completada'
              ? `🎉 ¡Tarea grupal completada! Todos marcaron "${tc.texto}"`
              : `☑️ ${u.nombre} marcó como realizada: "${tc.texto}". ¡Marcála vos para completarla!`;
            const payload = {
              title: `👥 Tarea grupal: ${u.nombre}`,
              body: textoPush,
              tag: 'tc-mark-' + tc.id + '-' + u.id,
              url: '/'
            };
            for (const s of otro.pushSubscriptions) {
              try { await sendWebPushNotification(s, payload); } catch (e) {}
            }
          }
        }

        await guardarBaseDeDatos(db, sha, `Actualizar estado de tarea compartida por ${u.nombre}`);
        return res.status(200).json({
          ok: true,
          tarea: tc,
          tareasCompartidas: db.tareasCompartidas.filter(t => esUsuarioParticipanteDeTarea(t, u.id))
        });
      }

      if (accion === 'eliminar_tarea_compartida') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        db.tareasCompartidas = db.tareasCompartidas.filter(t => t.id !== body.tareaId || !esUsuarioParticipanteDeTarea(t, u.id));
        await guardarBaseDeDatos(db, sha, `Eliminar tarea compartida`);
        return res.status(200).json({
          ok: true,
          tareasCompartidas: db.tareasCompartidas.filter(t => esUsuarioParticipanteDeTarea(t, u.id))
        });
      }

      if (accion === 'configurar_password') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (u.password) return res.status(400).json({ error: 'El usuario ya tiene contraseña configurada' });
        const nuevaPass = String(body.password || '').trim();
        if (!nuevaPass) return res.status(400).json({ error: 'Ingresá una contraseña válida' });

        u.password = nuevaPass;
        await guardarBaseDeDatos(db, sha, `Configurar contraseña de ${u.nombre}`);
        return res.status(200).json({
          ok: true,
          usuario: { id: u.id, nombre: u.nombre, esAdmin: Boolean(u.esAdmin), avatar: u.esAdmin ? '👑' : (u.avatar || '👤') },
          dni: u.dni || null,
          tareas: u.tareas || [],
          tareasCompartidas: (db.tareasCompartidas || []).filter(t => esUsuarioParticipanteDeTarea(t, u.id)),
          avisosTareas: u.avisosTareas || [],
          recordatorios: u.recordatorios || [],
          movimientos: u.movimientos || [],
          supermercado: u.supermercado || [],
          heladera: u.heladera || [],
          entrenamiento: u.entrenamiento || null,
          listasPresupuestos: u.listasPresupuestos || [],
          deudores: u.deudores || [],
          yoDebo: u.yoDebo || [],
          superCompartidoCon: u.superCompartidoCon || [],
          yaConfiguroCasa: Boolean(u.yaConfiguroCasa),
          tiempoBloqueoMin: u.tiempoBloqueoMin || 60,
          borrados: u.borrados || [],
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      if (accion === 'ingresar_usuario') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        const pass = String(body.password || '').trim();
        if (u.password !== pass) {
          return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        return res.status(200).json({
          ok: true,
          usuario: { id: u.id, nombre: u.nombre, esAdmin: Boolean(u.esAdmin), avatar: u.esAdmin ? '👑' : (u.avatar || '👤') },
          dni: u.dni || null,
          tareas: u.tareas || [],
          tareasCompartidas: (db.tareasCompartidas || []).filter(t => esUsuarioParticipanteDeTarea(t, u.id)),
          avisosTareas: u.avisosTareas || [],
          recordatorios: u.recordatorios || [],
          movimientos: u.movimientos || [],
          supermercado: u.supermercado || [],
          heladera: u.heladera || [],
          entrenamiento: u.entrenamiento || null,
          listasPresupuestos: u.listasPresupuestos || [],
          deudores: u.deudores || [],
          yoDebo: u.yoDebo || [],
          superCompartidoCon: u.superCompartidoCon || [],
          yaConfiguroCasa: Boolean(u.yaConfiguroCasa),
          tiempoBloqueoMin: u.tiempoBloqueoMin || 60,
          borrados: u.borrados || [],
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      if (accion === 'crear_usuario') {
        const nombre = String(body.nombre || '').trim();
        const pass = String(body.password || '').trim();
        const dniLimpio = String(body.dni || '').replace(/\D/g, '').trim();

        if (!nombre || !pass) {
          return res.status(400).json({ error: 'Completá el nombre y la contraseña' });
        }

        if (dniLimpio) {
          if (dniLimpio.length < 5) {
            return res.status(400).json({ error: 'El DNI debe tener al menos 5 números' });
          }
          const dup = Object.values(db.usuarios).find(otro => String(otro.dni || '').replace(/\D/g, '') === dniLimpio);
          if (dup) {
            return res.status(400).json({ error: `El DNI ya está registrado por ${dup.nombre}` });
          }
        }

        const idLimpio = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString().slice(-4);
        const avatarInicial = (body.avatar && body.avatar !== '👑') ? String(body.avatar) : '👤';

        db.usuarios[idLimpio] = {
          id: idLimpio,
          nombre: nombre,
          dni: dniLimpio || null,
          esAdmin: false,
          avatar: avatarInicial,
          password: pass,
          tareas: [],
          tareasCompartidas: [],
          recordatorios: [],
          movimientos: [],
          supermercado: [],
          superCompartidoCon: [],
          deudores: [],
          yoDebo: [],
          borrados: []
        };

        // Si se registra desde el link de estado de cuenta de un deudor
        if (body.vincularEstadoCuenta) {
          const propId = body.vincularEstadoCuenta.propietarioId || 'alejandro';
          const deudorId = body.vincularEstadoCuenta.deudorId;
          const uAcreedor = db.usuarios[propId];
          if (uAcreedor && Array.isArray(uAcreedor.deudores)) {
            const deudor = uAcreedor.deudores.find(d => d.id === deudorId);
            if (deudor) {
              deudor.usuarioId = idLimpio;
              if (dniLimpio) deudor.dni = dniLimpio;
              (deudor.conceptos || []).forEach(c => {
                if (!c.tipo || c.tipo === 'deuda') {
                  const sumP = (c.pagos || []).reduce((a, x) => a + (Number(x.monto) || 0), 0);
                  const saldoResta = Math.max(0, (Number(c.monto) || 0) - sumP);
                  if (saldoResta > 0 && !c.pagado) {
                    const cuotasTot = Number(c.cuotasTotal) || 1;
                    const valCuota = Number(c.valorCuota) || Math.round(((Number(c.monto) || 0) / cuotasTot) * 100) / 100;
                    db.usuarios[idLimpio].yoDebo.push({
                      id: 'yodebo_' + c.id,
                      vinculadoAcreedorId: uAcreedor.id,
                      vinculadoDeudorId: deudor.id,
                      vinculadoConceptoId: c.id,
                      concepto: c.concepto,
                      acreedor: uAcreedor.nombre,
                      montoTotal: Number(c.monto) || 0,
                      cuotasTotal: cuotasTot,
                      valorCuota: valCuota,
                      cuotasPagadas: 0,
                      montoPagado: sumP,
                      saldoPendiente: saldoResta,
                      fechaVencimiento: new Date().toISOString().split('T')[0],
                      hora: '09:00',
                      recordatorio: '1d',
                      pagos: c.pagos || [],
                      pagosPendientes: []
                    });
                  }
                }
              });

              if (Array.isArray(uAcreedor.pushSubscriptions) && uAcreedor.pushSubscriptions.length > 0) {
                const payload = {
                  title: `📲 ${nombre} se unió a la app`,
                  body: `Tu deudor ${deudor.nombre} se registró con DNI. Ahora sus deudas están vinculadas directamente a su cuenta.`,
                  tag: 'deudor-unido-' + Date.now(),
                  url: '/'
                };
                for (const sub of uAcreedor.pushSubscriptions) {
                  try { sendWebPushNotification(sub, payload); } catch (e) {}
                }
              }
            }
          }
        }

        await guardarBaseDeDatos(db, sha, `Crear nuevo usuario: ${nombre}`);
        const nuevoU = db.usuarios[idLimpio];
        return res.status(200).json({
          ok: true,
          usuario: { id: nuevoU.id, nombre: nuevoU.nombre, dni: nuevoU.dni || null, esAdmin: false, avatar: nuevoU.avatar },
          dni: nuevoU.dni || null,
          tareas: [],
          tareasCompartidas: [],
          recordatorios: [],
          movimientos: [],
          supermercado: [],
          superCompartidoCon: [],
          deudores: [],
          yoDebo: nuevoU.yoDebo || [],
          borrados: [],
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      if (accion === 'eliminar_usuario') {
        const admin = db.usuarios['alejandro'];
        if (!admin) return res.status(404).json({ error: 'Usuario administrador no encontrado' });

        const passEnviada = String(body.adminPassword || body.password || '').trim();
        const targetId = String(body.targetUsuarioId || body.eliminarUsuarioId || '').trim();

        if (admin.password && passEnviada && admin.password !== passEnviada) {
          return res.status(403).json({ error: 'Contraseña de administrador incorrecta' });
        }
        if (admin.password && !passEnviada && body.usuarioId !== 'alejandro') {
          return res.status(403).json({ error: 'Solo el administrador Alejandro puede eliminar usuarios' });
        }

        if (!targetId || targetId === 'alejandro') {
          return res.status(400).json({ error: 'No se puede eliminar al administrador principal' });
        }

        delete db.usuarios[targetId];

        // Limpiar referencias en superCompartidoCon
        Object.values(db.usuarios).forEach(u => {
          u.superCompartidoCon = (u.superCompartidoCon || []).filter(id => id !== targetId);
        });

        if (Array.isArray(db.tareasCompartidas)) {
          db.tareasCompartidas = db.tareasCompartidas.filter(t => !esUsuarioParticipanteDeTarea(t, targetId));
        }

        await guardarBaseDeDatos(db, sha, `Eliminar usuario ${targetId} por administrador`);
        return res.status(200).json({
          ok: true,
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      if (accion === 'blanquear_password') {
        const admin = db.usuarios['alejandro'];
        if (!admin) return res.status(404).json({ error: 'Usuario administrador no encontrado' });

        const passEnviada = String(body.adminPassword || body.password || '').trim();
        const targetId = String(body.targetUsuarioId || body.eliminarUsuarioId || '').trim();

        if (admin.password && passEnviada && admin.password !== passEnviada) {
          return res.status(403).json({ error: 'Contraseña de administrador incorrecta' });
        }
        if (admin.password && !passEnviada && body.usuarioId !== 'alejandro') {
          return res.status(403).json({ error: 'Solo el administrador Alejandro puede blanquear contraseñas' });
        }

        const targetUser = db.usuarios[targetId];
        if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (targetUser.id === 'alejandro' || targetUser.esAdmin) {
          return res.status(400).json({ error: 'No se puede blanquear la contraseña del administrador principal' });
        }

        targetUser.password = '';
        targetUser.passwordBlanqueada = true;
        targetUser.blanqueadaEl = Date.now();

        await guardarBaseDeDatos(db, sha, `Blanquear contraseña de ${targetUser.nombre}`);
        return res.status(200).json({
          ok: true,
          mensaje: `Contraseña de ${targetUser.nombre} blanqueada exitosamente.`,
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      if (accion === 'obtener_pregunta_seguridad') {
        const inputDni = String(body.dni || '').trim();
        const dniSoloNumeros = inputDni.replace(/\D/g, '');
        if (!inputDni) return res.status(400).json({ error: 'Ingresá tu DNI' });

        const targetUser = Object.values(db.usuarios).find(x => {
          if (dniSoloNumeros && x.dni && String(x.dni).replace(/\D/g, '') === dniSoloNumeros) return true;
          if (String(x.nombre || '').toLowerCase() === inputDni.toLowerCase()) return true;
          if (x.id.toLowerCase() === inputDni.toLowerCase()) return true;
          return false;
        });

        if (!targetUser) {
          return res.status(404).json({ error: 'No se encontró ningún usuario con ese DNI o nombre' });
        }

        return res.status(200).json({
          ok: true,
          usuarioId: targetUser.id,
          nombre: targetUser.nombre,
          blanqueada: Boolean(targetUser.passwordBlanqueada),
          tienePregunta: Boolean(targetUser.respuestaSeguridad),
          preguntaSeguridad: targetUser.preguntaSeguridad || '¿Cuál es tu pregunta de seguridad registrada?'
        });
      }

      if (accion === 'restablecer_password') {
        const inputDni = String(body.dni || '').trim();
        const dniSoloNumeros = inputDni.replace(/\D/g, '');
        const nuevaPass = String(body.nuevaPassword || '').trim();
        const respEnviada = String(body.respuestaSeguridad || '').trim().toLowerCase();

        if (!inputDni) return res.status(400).json({ error: 'Ingresá tu DNI' });
        if (!nuevaPass || nuevaPass.length < 3) {
          return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 3 caracteres' });
        }

        const targetUser = Object.values(db.usuarios).find(x => {
          if (dniSoloNumeros && x.dni && String(x.dni).replace(/\D/g, '') === dniSoloNumeros) return true;
          if (String(x.nombre || '').toLowerCase() === inputDni.toLowerCase()) return true;
          if (x.id.toLowerCase() === inputDni.toLowerCase()) return true;
          return false;
        });

        if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (targetUser.respuestaSeguridad) {
          const respReal = String(targetUser.respuestaSeguridad).trim().toLowerCase();
          if (respReal !== respEnviada) {
            return res.status(400).json({ error: 'La respuesta a la pregunta clave no es correcta' });
          }
        } else {
          if (body.nuevaPreguntaSeguridad && body.nuevaRespuestaSeguridad) {
            targetUser.preguntaSeguridad = String(body.nuevaPreguntaSeguridad).trim();
            targetUser.respuestaSeguridad = String(body.nuevaRespuestaSeguridad).trim().toLowerCase();
          }
        }

        targetUser.password = nuevaPass;
        targetUser.passwordBlanqueada = false;

        await guardarBaseDeDatos(db, sha, `Restablecer contraseña para ${targetUser.nombre}`);
        return res.status(200).json({
          ok: true,
          mensaje: '¡Contraseña restablecida exitosamente! Ya podés ingresar.'
        });
      }

      if (accion === 'cambiar_password') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

        const passAnterior = String(body.passwordAnterior || '').trim();
        const passNueva = String(body.nuevaPassword || '').trim();

        if (!passNueva || passNueva.length < 3) {
          return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 3 caracteres' });
        }

        if (u.password && u.password !== passAnterior) {
          return res.status(401).json({ error: 'La contraseña anterior no es correcta' });
        }

        u.password = passNueva;
        u.passwordBlanqueada = false;

        await guardarBaseDeDatos(db, sha, `Cambio de contraseña para ${u.nombre}`);
        return res.status(200).json({
          ok: true,
          mensaje: '¡Contraseña cambiada exitosamente!'
        });
      }

      if (accion === 'guardar_pregunta_seguridad') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

        const pass = String(body.password || '').trim();
        if (u.password && pass && u.password !== pass) {
          return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const preg = String(body.preguntaSeguridad || '').trim();
        const resp = String(body.respuestaSeguridad || '').trim().toLowerCase();

        if (!preg || !resp) {
          return res.status(400).json({ error: 'Debés ingresar la pregunta y la respuesta clave' });
        }

        u.preguntaSeguridad = preg;
        u.respuestaSeguridad = resp;

        await guardarBaseDeDatos(db, sha, `Pregunta de seguridad guardada para ${u.nombre}`);
        return res.status(200).json({
          ok: true,
          mensaje: '¡Pregunta clave guardada exitosamente!',
          preguntaSeguridad: preg
        });
      }

      if (accion === 'suscribir_push') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (body.subscription && body.subscription.endpoint) {
          if (!Array.isArray(u.pushSubscriptions)) u.pushSubscriptions = [];
          const yaExiste = u.pushSubscriptions.some(s => s.endpoint === body.subscription.endpoint);
          if (!yaExiste) {
            u.pushSubscriptions.push(body.subscription);
            await guardarBaseDeDatos(db, sha, `Suscripción Web Push para ${u.nombre}`);
          }
        }
        return res.status(200).json({ ok: true });
      }

      if (accion === 'pedir_tarea_usuario') {
        const destinoId = body.destinoUsuarioId;
        const destino = db.usuarios[destinoId];
        if (!destino) {
          return res.status(404).json({ error: 'El usuario destinatario no existe' });
        }
        if (!Array.isArray(destino.tareas)) destino.tareas = [];
        destino.tareas.push(body.nuevaTarea);
        await guardarBaseDeDatos(db, sha, `Tarea enviada a ${destino.nombre}`);

        // Enviar notificación Push al celular del destinatario si la app está cerrada
        if (Array.isArray(destino.pushSubscriptions) && destino.pushSubscriptions.length > 0) {
          const payload = {
            title: `📨 Nueva tarea de ${body.nuevaTarea.autor || 'alguien'}`,
            body: body.nuevaTarea.texto || 'Te asignaron una nueva tarea',
            tag: 'tarea-' + body.nuevaTarea.id,
            url: '/'
          };
          for (const sub of destino.pushSubscriptions) {
            await sendWebPushNotification(sub, payload);
          }
        }

        return res.status(200).json({ ok: true });
      }

      // Guardar una sola vez con quién vive el usuario (vincula la casa para ambos)
      if (accion === 'guardar_convivencia') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (u.password && u.password !== String(body.password || '')) {
          return res.status(401).json({ error: 'Sesión inválida' });
        }

        const convivientesIds = Array.isArray(body.convivientesIds) ? body.convivientesIds : [];
        u.yaConfiguroCasa = true;
        u.superCompartidoCon = convivientesIds;

        // Combinar la lista de supermercado entre todos los que viven en la misma casa y marcarles yaConfiguroCasa = true
        const mapa = new Map();
        (u.supermercado || []).forEach(item => mapa.set(item.id, item));

        convivientesIds.forEach(otroId => {
          const otro = db.usuarios[otroId];
          if (otro) {
            (otro.supermercado || []).forEach(item => {
              if (!mapa.has(item.id)) mapa.set(item.id, item);
            });
            if (!otro.superCompartidoCon.includes(u.id)) {
              otro.superCompartidoCon.push(u.id);
            }
            otro.yaConfiguroCasa = true;
          }
        });

        u.supermercado = Array.from(mapa.values());
        propagarSupermercadoCompartido(db, u);

        await guardarBaseDeDatos(db, sha, `Guardar convivencia de casa para ${u.nombre}`);
        return res.status(200).json({
          ok: true,
          yaConfiguroCasa: true,
          supermercado: u.supermercado,
          superCompartidoCon: u.superCompartidoCon
        });
      }

      if (accion === 'obtener_estado_cuenta') {
        const propId = body.propietarioId || 'alejandro';
        const u = db.usuarios[propId];
        if (!u) return res.status(404).json({ error: 'Acreedor no encontrado' });
        const d = (u.deudores || []).find(x => x.id === body.deudorId);
        if (!d) return res.status(404).json({ error: 'Registro de deuda no encontrado' });
        return res.status(200).json({
          ok: true,
          acreedorNombre: u.nombre,
          acreedorId: u.id,
          deudor: {
            id: d.id,
            nombre: d.nombre,
            conceptos: d.conceptos || [],
            pagosPendientes: d.pagosPendientes || []
          }
        });
      }

      if (accion === 'informar_pago_deudor') {
        const propId = body.propietarioId || 'alejandro';
        const u = db.usuarios[propId];
        if (!u) return res.status(404).json({ error: 'Acreedor no encontrado' });
        const d = (u.deudores || []).find(x => x.id === body.deudorId);
        if (!d) return res.status(404).json({ error: 'Registro de deuda no encontrado' });
        if (!Array.isArray(d.pagosPendientes)) d.pagosPendientes = [];

        const concId = body.conceptoId || null;
        let concNombre = 'Abono general / a distribuir';
        if (concId) {
          const encontrado = (d.conceptos || []).find(c => c.id === concId);
          if (encontrado) concNombre = encontrado.concepto;
        }

        const monto = Number(body.monto) || 0;
        if (monto <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

        const nuevoPago = {
          id: 'pago_inf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          conceptoId: concId,
          conceptoNombre: concNombre,
          monto: monto,
          nota: String(body.nota || '').trim(),
          fechaHora: Date.now(),
          estado: 'pendiente'
        };

        d.pagosPendientes.unshift(nuevoPago);
        await guardarBaseDeDatos(db, sha, `Pago informado por ${d.nombre}: $${monto}`);

        if (Array.isArray(u.pushSubscriptions) && u.pushSubscriptions.length > 0) {
          const payload = {
            title: `💵 Pago informado por ${d.nombre}`,
            body: `Informó un pago de $${monto.toLocaleString('es-AR')} (${concNombre}). Abrí la app para aceptarlo o rechazarlo.`,
            tag: 'pago-deudor-' + Date.now(),
            url: '/'
          };
          for (const sub of u.pushSubscriptions) {
            try { await sendWebPushNotification(sub, payload); } catch (e) {}
          }
        }

        return res.status(200).json({ ok: true, pago: nuevoPago });
      }

      if (accion === 'crear_deudor_con_dni') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        const nombre = String(body.nombre || '').trim();
        if (!nombre) return res.status(400).json({ error: 'Ingresá el nombre del deudor' });
        const dniLimpio = String(body.dni || '').replace(/\D/g, '').trim();

        if (!Array.isArray(u.deudores)) u.deudores = [];

        // Buscar si coincide con algún usuario de la aplicación
        let usuarioVinculado = null;
        if (dniLimpio) {
          usuarioVinculado = Object.values(db.usuarios).find(otro => otro.id !== u.id && String(otro.dni || '').replace(/\D/g, '') === dniLimpio);
        }

        const nuevoDeudor = {
          id: 'deudor_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          nombre: nombre,
          dni: dniLimpio || null,
          usuarioId: usuarioVinculado ? usuarioVinculado.id : null,
          conceptos: [],
          pagosPendientes: [],
          creadoEl: Date.now(),
          updatedAt: Date.now()
        };

        u.deudores.push(nuevoDeudor);
        await guardarBaseDeDatos(db, sha, `Crear deudor ${nombre} en ${u.nombre}`);

        return res.status(200).json({
          ok: true,
          deudor: nuevoDeudor,
          deudores: u.deudores,
          usuarioVinculado: usuarioVinculado ? { id: usuarioVinculado.id, nombre: usuarioVinculado.nombre, dni: usuarioVinculado.dni } : null
        });
      }

      if (accion === 'agregar_concepto_deudor') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!Array.isArray(u.deudores)) u.deudores = [];
        const deudor = u.deudores.find(d => d.id === body.deudorId);
        if (!deudor) return res.status(404).json({ error: 'Deudor no encontrado' });

        const conceptoTexto = String(body.concepto || '').trim();
        const monto = Number(body.monto) || 0;
        const cuotasTotal = Math.max(1, parseInt(body.cuotasTotal, 10) || 1);
        if (!conceptoTexto || monto <= 0) {
          return res.status(400).json({ error: 'Completá concepto y monto válido' });
        }

        if (!Array.isArray(deudor.conceptos)) deudor.conceptos = [];

        const nuevoConcepto = {
          id: 'conc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          tipo: 'deuda',
          concepto: conceptoTexto,
          monto: monto,
          cuotasTotal: cuotasTotal,
          valorCuota: Math.round((monto / cuotasTotal) * 100) / 100,
          pagado: false,
          pagos: [],
          fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
          creadoEl: Date.now()
        };

        deudor.conceptos.push(nuevoConcepto);
        deudor.updatedAt = Date.now();

        // Si el deudor está vinculado a un usuario de la app, agregarlo a su "Yo debo"
        if (deudor.usuarioId && db.usuarios[deudor.usuarioId]) {
          const uSocio = db.usuarios[deudor.usuarioId];
          if (!Array.isArray(uSocio.yoDebo)) uSocio.yoDebo = [];
          
          const deudaYoDebo = {
            id: 'yodebo_' + nuevoConcepto.id,
            vinculadoAcreedorId: u.id,
            vinculadoDeudorId: deudor.id,
            vinculadoConceptoId: nuevoConcepto.id,
            concepto: nuevoConcepto.concepto,
            acreedor: u.nombre,
            montoTotal: nuevoConcepto.monto,
            cuotasTotal: nuevoConcepto.cuotasTotal,
            valorCuota: nuevoConcepto.valorCuota,
            cuotasPagadas: 0,
            montoPagado: 0,
            saldoPendiente: nuevoConcepto.monto,
            fechaVencimiento: body.fechaVencimiento || new Date().toISOString().split('T')[0],
            hora: '09:00',
            recordatorio: '1d',
            pagos: [],
            pagosPendientes: []
          };
          uSocio.yoDebo.unshift(deudaYoDebo);

          if (Array.isArray(uSocio.pushSubscriptions) && uSocio.pushSubscriptions.length > 0) {
            const payload = {
              title: `💸 ${u.nombre} te cargó una deuda`,
              body: `"${nuevoConcepto.concepto}" por $${nuevoConcepto.monto.toLocaleString('es-AR')} (${nuevoConcepto.cuotasTotal} cuota/s). Entrá a "Yo debo" para verla.`,
              tag: 'deuda-nueva-' + nuevoConcepto.id,
              url: '/'
            };
            for (const s of uSocio.pushSubscriptions) {
              try { await sendWebPushNotification(s, payload); } catch (e) {}
            }
          }
        }

        await guardarBaseDeDatos(db, sha, `Nueva deuda en deudor ${deudor.nombre}: ${nuevoConcepto.concepto}`);
        return res.status(200).json({ ok: true, deudor, deudores: u.deudores, concepto: nuevoConcepto });
      }

      if (accion === 'informar_pago_deudor_app') {
        const uDebtor = db.usuarios[body.usuarioId];
        if (!uDebtor) return res.status(404).json({ error: 'Usuario deudor no encontrado' });
        if (!Array.isArray(uDebtor.yoDebo)) uDebtor.yoDebo = [];

        const itemYoDebo = uDebtor.yoDebo.find(x => x.id === body.yoDeboId);
        if (!itemYoDebo) return res.status(404).json({ error: 'Deuda no encontrada en tu cuenta' });

        const monto = Number(body.monto) || 0;
        if (monto <= 0) return res.status(400).json({ error: 'Ingresá un monto mayor a 0' });

        const tipoPago = body.tipoPago === 'cuota' ? 'cuota' : 'parcial';
        const nota = String(body.nota || '').trim();

        if (!Array.isArray(itemYoDebo.pagosPendientes)) itemYoDebo.pagosPendientes = [];

        const nuevoPago = {
          id: 'pago_app_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          yoDeboId: itemYoDebo.id,
          vinculadoAcreedorId: itemYoDebo.vinculadoAcreedorId,
          vinculadoDeudorId: itemYoDebo.vinculadoDeudorId,
          vinculadoConceptoId: itemYoDebo.vinculadoConceptoId,
          conceptoNombre: itemYoDebo.concepto,
          monto: monto,
          tipoPago: tipoPago,
          nota: nota,
          fechaHora: Date.now(),
          estado: 'pendiente'
        };

        itemYoDebo.pagosPendientes.unshift(nuevoPago);

        // Si está vinculado a un acreedor en la app, registrarlo en el deudor del acreedor
        if (itemYoDebo.vinculadoAcreedorId && db.usuarios[itemYoDebo.vinculadoAcreedorId]) {
          const uAcreedor = db.usuarios[itemYoDebo.vinculadoAcreedorId];
          const deudorEnAcreedor = (uAcreedor.deudores || []).find(d => d.id === itemYoDebo.vinculadoDeudorId);
          if (deudorEnAcreedor) {
            if (!Array.isArray(deudorEnAcreedor.pagosPendientes)) deudorEnAcreedor.pagosPendientes = [];
            deudorEnAcreedor.pagosPendientes.unshift({
              id: nuevoPago.id,
              deudorId: deudorEnAcreedor.id,
              deudorUsuarioId: uDebtor.id,
              deudorNombre: uDebtor.nombre,
              conceptoId: itemYoDebo.vinculadoConceptoId,
              conceptoNombre: itemYoDebo.concepto,
              monto: monto,
              tipoPago: tipoPago,
              nota: nota,
              fechaHora: nuevoPago.fechaHora,
              estado: 'pendiente'
            });

            if (Array.isArray(uAcreedor.pushSubscriptions) && uAcreedor.pushSubscriptions.length > 0) {
              const payload = {
                title: `💵 Pago informado por ${uDebtor.nombre}`,
                body: `${uDebtor.nombre} te informó un pago de $${monto.toLocaleString('es-AR')} por "${itemYoDebo.concepto}" (${tipoPago === 'cuota' ? 'cuota completa' : 'pago parcial'}). Tocá para aceptar o rechazar.`,
                tag: 'pago-' + nuevoPago.id,
                url: '/'
              };
              for (const s of uAcreedor.pushSubscriptions) {
                try { await sendWebPushNotification(s, payload); } catch (e) {}
              }
            }
          }
        }

        await guardarBaseDeDatos(db, sha, `Pago informado por ${uDebtor.nombre} para ${itemYoDebo.acreedor}`);
        return res.status(200).json({ ok: true, pago: nuevoPago, yoDebo: uDebtor.yoDebo });
      }

      if (accion === 'aprobar_pago_deudor') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario acreedor no encontrado' });
        const deudor = (u.deudores || []).find(d => d.id === body.deudorId);
        if (!deudor) return res.status(404).json({ error: 'Deudor no encontrado' });

        if (!Array.isArray(deudor.pagosPendientes)) deudor.pagosPendientes = [];
        const pago = deudor.pagosPendientes.find(p => p.id === body.pagoId);
        if (!pago) return res.status(404).json({ error: 'Pago pendiente no encontrado' });

        const aceptar = Boolean(body.aceptar);
        pago.estado = aceptar ? 'aceptado' : 'rechazado';
        pago.fechaResolucion = Date.now();

        let conceptoAfectado = null;
        if (aceptar) {
          if (!Array.isArray(deudor.conceptos)) deudor.conceptos = [];
          conceptoAfectado = deudor.conceptos.find(c => c.id === pago.conceptoId);
          if (!conceptoAfectado && deudor.conceptos.length > 0) {
            conceptoAfectado = deudor.conceptos[0];
          }

          const nuevoAbono = {
            id: 'abono_' + Date.now(),
            monto: pago.monto,
            nota: pago.nota ? `Pago informado (${pago.tipoPago || 'pago'}): ${pago.nota}` : `Pago informado (${pago.tipoPago || 'pago'})`,
            fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
            creadoEl: Date.now()
          };

          if (conceptoAfectado) {
            if (!Array.isArray(conceptoAfectado.pagos)) conceptoAfectado.pagos = [];
            conceptoAfectado.pagos.push(nuevoAbono);
            const sumP = conceptoAfectado.pagos.reduce((a, x) => a + (Number(x.monto) || 0), 0);
            if (sumP >= (Number(conceptoAfectado.monto) || 0)) {
              conceptoAfectado.pagado = true;
            }
          }
        }

        // Si el deudor es usuario de la app, impactar en su "Yo debo" y enviarle Push
        if (deudor.usuarioId && db.usuarios[deudor.usuarioId]) {
          const uDebtor = db.usuarios[deudor.usuarioId];
          if (Array.isArray(uDebtor.yoDebo)) {
            const itemDebtor = uDebtor.yoDebo.find(x => x.vinculadoConceptoId === pago.conceptoId || (x.pagosPendientes && x.pagosPendientes.some(pp => pp.id === pago.id)));
            if (itemDebtor) {
              if (Array.isArray(itemDebtor.pagosPendientes)) {
                const pendInDebtor = itemDebtor.pagosPendientes.find(pp => pp.id === pago.id);
                if (pendInDebtor) pendInDebtor.estado = aceptar ? 'aceptado' : 'rechazado';
              }

              if (aceptar) {
                if (!Array.isArray(itemDebtor.pagos)) itemDebtor.pagos = [];
                itemDebtor.pagos.push({
                  id: 'pago_conf_' + Date.now(),
                  monto: pago.monto,
                  fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
                  nota: pago.nota || 'Aprobado por acreedor'
                });
                const totalPag = itemDebtor.pagos.reduce((a, x) => a + (Number(x.monto) || 0), 0);
                itemDebtor.montoPagado = totalPag;
                itemDebtor.saldoPendiente = Math.max(0, (Number(itemDebtor.montoTotal) || 0) - totalPag);
                if (itemDebtor.valorCuota && itemDebtor.valorCuota > 0) {
                  itemDebtor.cuotasPagadas = Math.min(itemDebtor.cuotasTotal, Math.floor(totalPag / itemDebtor.valorCuota));
                }
              }
            }
          }

          if (Array.isArray(uDebtor.pushSubscriptions) && uDebtor.pushSubscriptions.length > 0) {
            const payload = {
              title: aceptar ? `✅ ${u.nombre} aceptó tu pago` : `❌ ${u.nombre} rechazó tu pago`,
              body: aceptar
                ? `Se descontaron $${pago.monto.toLocaleString('es-AR')} de tu deuda "${pago.conceptoNombre || 'Deuda'}".`
                : `Tu pago de $${pago.monto.toLocaleString('es-AR')} por "${pago.conceptoNombre || 'Deuda'}" fue rechazado. No se descontó saldo.`,
              tag: 'resol-pago-' + pago.id,
              url: '/'
            };
            for (const s of uDebtor.pushSubscriptions) {
              try { await sendWebPushNotification(s, payload); } catch (e) {}
            }
          }
        }

        await guardarBaseDeDatos(db, sha, `${aceptar ? 'Aprobado' : 'Rechazado'} pago de ${deudor.nombre}: $${pago.monto}`);
        return res.status(200).json({ ok: true, deudor, deudores: u.deudores, pago });
      }

      if (accion === 'agregar_externa' && body.nuevaTarea) {
        const targetId = body.destinoUsuarioId || 'alejandro';
        const uDestino = db.usuarios[targetId] || db.usuarios['alejandro'];
        if (!Array.isArray(uDestino.tareas)) uDestino.tareas = [];
        uDestino.tareas.push(body.nuevaTarea);
        await guardarBaseDeDatos(db, sha, `Tarea externa para ${uDestino.nombre}`);
        return res.status(200).json({ ok: true });
      }

      // Sincronizar datos propios del usuario activo
      const usuarioId = body.usuarioId || 'alejandro';
      const u = db.usuarios[usuarioId];
      if (!u) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      if (u.password && u.password !== String(body.password || '')) {
        return res.status(401).json({ error: 'Sesión inválida' });
      }

      u.tareas = Array.isArray(body.tareas) ? body.tareas : (u.tareas || []);
      if (Array.isArray(body.avisosTareas)) {
        u.avisosTareas = body.avisosTareas;
      }
      u.recordatorios = Array.isArray(body.recordatorios) ? body.recordatorios : (u.recordatorios || []);
      u.movimientos = Array.isArray(body.movimientos) ? body.movimientos : (u.movimientos || []);
      if (Array.isArray(body.supermercado)) {
        u.supermercado = body.supermercado;
      }
      if (Array.isArray(body.heladera)) {
        u.heladera = body.heladera;
      }
      if (body.entrenamiento !== undefined) {
        u.entrenamiento = body.entrenamiento;
      }
      if (Array.isArray(body.listasPresupuestos)) {
        u.listasPresupuestos = body.listasPresupuestos;
      }
      if (Array.isArray(body.deudores)) {
        u.deudores = body.deudores;
      }
      if (Array.isArray(body.yoDebo)) {
        u.yoDebo = body.yoDebo;
      }
      if (body.tiempoBloqueoMin !== undefined) {
        u.tiempoBloqueoMin = Number(body.tiempoBloqueoMin) || 60;
      }
      if (!u.esAdmin && body.avatar && body.avatar !== '👑') {
        u.avatar = String(body.avatar);
      }

      // Si el usuario marcó como realizada o rechazó una tarea que le pidió otro usuario, avisarle al autor
      if (body.avisoParaAutor && typeof body.avisoParaAutor === 'object') {
        const info = body.avisoParaAutor;
        let uAutor = info.autorId ? db.usuarios[info.autorId] : null;
        if (!uAutor && info.autorNombre) {
          const buscado = String(info.autorNombre).trim().toLowerCase();
          uAutor = Object.values(db.usuarios).find(
            x => String(x.nombre || '').trim().toLowerCase() === buscado
          );
        }
        if (uAutor && uAutor.id !== u.id) {
          if (!Array.isArray(uAutor.avisosTareas)) uAutor.avisosTareas = [];
          uAutor.avisosTareas.push({
            id: 'aviso-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            estado: info.estado === 'rechazada' ? 'rechazada' : 'realizada',
            texto: String(info.texto || ''),
            respondidoPor: u.nombre,
            fechaHora: Date.now()
          });

          // Enviar notificación Push al celular del autor
          if (Array.isArray(uAutor.pushSubscriptions) && uAutor.pushSubscriptions.length > 0) {
            const esRealizada = info.estado !== 'rechazada';
            const payload = {
              title: esRealizada ? `✅ Tarea realizada por ${u.nombre}` : `❌ Tarea rechazada por ${u.nombre}`,
              body: esRealizada ? `Completó: "${info.texto}"` : `Rechazó: "${info.texto}"`,
              tag: 'aviso-' + Date.now(),
              url: '/'
            };
            for (const sub of uAutor.pushSubscriptions) {
              await sendWebPushNotification(sub, payload);
            }
          }
        }
      }

      propagarSupermercadoCompartido(db, u);
      await propagarListasCompartidas(db, u);
      u.borrados = Array.from(new Set([...(u.borrados || []), ...(body.borrados || [])]));
      u.borradosListas = Array.from(new Set([...(u.borradosListas || []), ...(body.borradosListas || [])]));

      await guardarBaseDeDatos(db, sha, `Sincronizar agenda de ${u.nombre}`);

      return res.status(200).json({
        dni: u.dni || null,
        avatar: u.esAdmin ? '👑' : (u.avatar || '👤'),
        tareas: u.tareas,
        tareasCompartidas: (db.tareasCompartidas || []).filter(t => esUsuarioParticipanteDeTarea(t, u.id)),
        avisosTareas: u.avisosTareas || [],
        recordatorios: u.recordatorios,
        movimientos: u.movimientos,
        supermercado: u.supermercado,
        heladera: u.heladera,
        entrenamiento: u.entrenamiento || null,
        listasPresupuestos: u.listasPresupuestos || [],
        deudores: u.deudores || [],
        yoDebo: u.yoDebo || [],
        superCompartidoCon: u.superCompartidoCon,
        borrados: u.borrados,
        usuarios: resumenPublicoUsuarios(db.usuarios)
      });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
