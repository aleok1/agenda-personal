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
      tienePassword: Boolean(u.password)
    }));
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
        tareas: u.tareas || [],
        tareasCompartidas: (db.tareasCompartidas || []).filter(t => t.creadorId === u.id || t.socioId === u.id),
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
        if (u.password && u.password !== String(body.password || '')) {
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
            avatar: u.esAdmin ? '👑' : (u.avatar || '👤')
          },
          dni: u.dni || null,
          tareas: u.tareas || [],
          tareasCompartidas: (db.tareasCompartidas || []).filter(t => t.creadorId === u.id || t.socioId === u.id),
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
        if (u.password && u.password !== String(body.password || '')) {
          return res.status(401).json({ error: 'Sesión no válida' });
        }
        const socio = db.usuarios[body.socioId];
        if (!socio) return res.status(404).json({ error: 'Usuario socio no encontrado' });

        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        const nueva = {
          id: 'tc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          texto: String(body.texto || '').trim(),
          prioridad: body.prioridad || 'simple',
          creadorId: u.id,
          creadorNombre: u.nombre,
          socioId: socio.id,
          socioNombre: socio.nombre,
          estado: 'pendiente_invitacion',
          realizadaPorCreador: false,
          realizadaPorSocio: false,
          creadoEl: Date.now(),
          actualizadoEl: Date.now()
        };

        db.tareasCompartidas.push(nueva);

        if (Array.isArray(socio.pushSubscriptions) && socio.pushSubscriptions.length > 0) {
          const payload = {
            title: `👥 Invitación de tarea compartida de ${u.nombre}`,
            body: `Te invitó a hacer: "${nueva.texto}". Entrá a la app para aceptarla.`,
            tag: 'tc-' + nueva.id,
            url: '/'
          };
          for (const s of socio.pushSubscriptions) {
            try { await sendWebPushNotification(s, payload); } catch (e) {}
          }
        }

        await guardarBaseDeDatos(db, sha, `Tarea compartida entre ${u.nombre} y ${socio.nombre}`);
        return res.status(200).json({
          ok: true,
          tarea: nueva,
          tareasCompartidas: db.tareasCompartidas.filter(t => t.creadorId === u.id || t.socioId === u.id)
        });
      }

      if (accion === 'responder_tarea_compartida') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        const tc = db.tareasCompartidas.find(t => t.id === body.tareaId);
        if (!tc) return res.status(404).json({ error: 'Tarea compartida no encontrada' });

        const aceptar = Boolean(body.aceptar);
        tc.estado = aceptar ? 'activa' : 'rechazada';
        tc.actualizadoEl = Date.now();

        const creador = db.usuarios[tc.creadorId];
        if (creador && Array.isArray(creador.pushSubscriptions)) {
          const payload = {
            title: aceptar ? `✅ ${u.nombre} aceptó tu tarea compartida` : `❌ ${u.nombre} rechazó la tarea compartida`,
            body: `"${tc.texto}"`,
            tag: 'tc-resp-' + tc.id,
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
          tareasCompartidas: db.tareasCompartidas.filter(t => t.creadorId === u.id || t.socioId === u.id)
        });
      }

      if (accion === 'marcar_tarea_compartida') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        const tc = db.tareasCompartidas.find(t => t.id === body.tareaId);
        if (!tc) return res.status(404).json({ error: 'Tarea compartida no encontrada' });

        const realizada = Boolean(body.realizada);
        if (tc.creadorId === u.id) {
          tc.realizadaPorCreador = realizada;
        } else if (tc.socioId === u.id) {
          tc.realizadaPorSocio = realizada;
        }

        if (tc.realizadaPorCreador && tc.realizadaPorSocio) {
          tc.estado = 'completada';
          tc.completadaEl = Date.now();
        } else {
          tc.estado = 'activa';
        }
        tc.actualizadoEl = Date.now();

        const otroId = tc.creadorId === u.id ? tc.socioId : tc.creadorId;
        const otro = db.usuarios[otroId];
        if (otro && realizada && Array.isArray(otro.pushSubscriptions)) {
          const textoPush = tc.estado === 'completada'
            ? `🎉 ¡Tarea compartida completada! Ambos marcaron "${tc.texto}"`
            : `☑️ ${u.nombre} marcó como realizada: "${tc.texto}". ¡Marcála vos para completarla!`;
          const payload = {
            title: `👥 Tarea compartida: ${u.nombre}`,
            body: textoPush,
            tag: 'tc-mark-' + tc.id,
            url: '/'
          };
          for (const s of otro.pushSubscriptions) {
            try { await sendWebPushNotification(s, payload); } catch (e) {}
          }
        }

        await guardarBaseDeDatos(db, sha, `Actualizar estado de tarea compartida por ${u.nombre}`);
        return res.status(200).json({
          ok: true,
          tarea: tc,
          tareasCompartidas: db.tareasCompartidas.filter(t => t.creadorId === u.id || t.socioId === u.id)
        });
      }

      if (accion === 'eliminar_tarea_compartida') {
        const u = db.usuarios[body.usuarioId];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!Array.isArray(db.tareasCompartidas)) db.tareasCompartidas = [];

        db.tareasCompartidas = db.tareasCompartidas.filter(t => t.id !== body.tareaId || (t.creadorId !== u.id && t.socioId !== u.id));
        await guardarBaseDeDatos(db, sha, `Eliminar tarea compartida`);
        return res.status(200).json({
          ok: true,
          tareasCompartidas: db.tareasCompartidas.filter(t => t.creadorId === u.id || t.socioId === u.id)
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
          tareasCompartidas: (db.tareasCompartidas || []).filter(t => t.creadorId === u.id || t.socioId === u.id),
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
          tareasCompartidas: (db.tareasCompartidas || []).filter(t => t.creadorId === u.id || t.socioId === u.id),
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
        if (!nombre || !pass) {
          return res.status(400).json({ error: 'Completá el nombre y la contraseña' });
        }
        const idLimpio = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString().slice(-4);
        const avatarInicial = (body.avatar && body.avatar !== '👑') ? String(body.avatar) : '👤';

        db.usuarios[idLimpio] = {
          id: idLimpio,
          nombre: nombre,
          esAdmin: false,
          avatar: avatarInicial,
          password: pass,
          tareas: [],
          recordatorios: [],
          movimientos: [],
          supermercado: [],
          superCompartidoCon: [],
          deudores: [],
          yoDebo: [],
          borrados: []
        };

        await guardarBaseDeDatos(db, sha, `Crear nuevo usuario: ${nombre}`);
        const nuevoU = db.usuarios[idLimpio];
        return res.status(200).json({
          ok: true,
          usuario: { id: nuevoU.id, nombre: nuevoU.nombre, esAdmin: false, avatar: nuevoU.avatar },
          tareas: [],
          recordatorios: [],
          movimientos: [],
          supermercado: [],
          superCompartidoCon: [],
          deudores: [],
          yoDebo: [],
          borrados: [],
          usuarios: resumenPublicoUsuarios(db.usuarios)
        });
      }

      if (accion === 'eliminar_usuario') {
        const admin = db.usuarios['alejandro'];
        if (!admin || admin.password !== String(body.adminPassword || '').trim()) {
          return res.status(403).json({ error: 'Solo el administrador Alejandro puede eliminar usuarios' });
        }
        const targetId = body.targetUsuarioId;
        if (!targetId || targetId === 'alejandro') {
          return res.status(400).json({ error: 'No se puede eliminar al administrador principal' });
        }
        delete db.usuarios[targetId];
        // Limpiar referencias en superCompartidoCon
        Object.values(db.usuarios).forEach(u => {
          u.superCompartidoCon = (u.superCompartidoCon || []).filter(id => id !== targetId);
        });
        await guardarBaseDeDatos(db, sha, `Eliminar usuario ${targetId}`);
        return res.status(200).json({
          ok: true,
          usuarios: resumenPublicoUsuarios(db.usuarios)
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
        tareasCompartidas: (db.tareasCompartidas || []).filter(t => t.creadorId === u.id || t.socioId === u.id),
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
