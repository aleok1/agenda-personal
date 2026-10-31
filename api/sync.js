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
    Object.values(raw.usuarios).forEach(u => {
      if (!Array.isArray(u.supermercado)) u.supermercado = [];
      if (!Array.isArray(u.heladera)) u.heladera = [];
      if (!Array.isArray(u.superCompartidoCon)) u.superCompartidoCon = [];
      if (typeof u.yaConfiguroCasa !== 'boolean') u.yaConfiguroCasa = false;
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
    return Object.values(usuariosMap).map(u => ({
      id: u.id,
      nombre: u.nombre,
      esAdmin: Boolean(u.esAdmin),
      avatar: u.esAdmin ? '👑' : (u.avatar || '👤'),
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
        avatar: u.esAdmin ? '👑' : (u.avatar || '👤'),
        tareas: u.tareas || [],
        avisosTareas: u.avisosTareas || [],
        recordatorios: u.recordatorios || [],
        movimientos: u.movimientos || [],
        supermercado: u.supermercado || [],
        heladera: u.heladera || [],
        entrenamiento: u.entrenamiento || null,
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
          tareas: u.tareas || [],
          avisosTareas: u.avisosTareas || [],
          recordatorios: u.recordatorios || [],
          movimientos: u.movimientos || [],
          supermercado: u.supermercado || [],
          heladera: u.heladera || [],
          entrenamiento: u.entrenamiento || null,
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
          tareas: u.tareas || [],
          avisosTareas: u.avisosTareas || [],
          recordatorios: u.recordatorios || [],
          movimientos: u.movimientos || [],
          supermercado: u.supermercado || [],
          heladera: u.heladera || [],
          entrenamiento: u.entrenamiento || null,
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
      u.borrados = Array.from(new Set([...(u.borrados || []), ...(body.borrados || [])]));

      await guardarBaseDeDatos(db, sha, `Sincronizar agenda de ${u.nombre}`);

      return res.status(200).json({
        avatar: u.esAdmin ? '👑' : (u.avatar || '👤'),
        tareas: u.tareas,
        avisosTareas: u.avisosTareas || [],
        recordatorios: u.recordatorios,
        movimientos: u.movimientos,
        supermercado: u.supermercado,
        heladera: u.heladera,
        entrenamiento: u.entrenamiento || null,
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
