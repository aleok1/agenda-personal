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

  try {
    if (req.method === 'GET') {
      const r = await fetch(repoUrl, { headers, cache: 'no-store' });
      if (r.status === 404) {
        return res.status(200).json({ tareas: [], recordatorios: [], borrados: [], inicializado: false });
      }
      if (!r.ok) {
        const errText = await r.text();
        return res.status(r.status).json({ error: errText });
      }
      const fileData = await r.json();
      const jsonStr = Buffer.from(fileData.content, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr);
      return res.status(200).json(parsed);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Leer archivo actual en la nube para obtener su SHA y combinar cambios sin perder nada
      let sha = null;
      let cloudData = { tareas: [], recordatorios: [], borrados: [], inicializado: false };

      const getRes = await fetch(repoUrl, { headers, cache: 'no-store' });
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        try {
          cloudData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
        } catch (e) {}
      }

      const nuevoEstado = {
        tareas: Array.isArray(body.tareas) ? body.tareas : (cloudData.tareas || []),
        recordatorios: Array.isArray(body.recordatorios) ? body.recordatorios : (cloudData.recordatorios || []),
        borrados: Array.from(new Set([...(cloudData.borrados || []), ...(body.borrados || [])])),
        inicializado: true,
        actualizado: new Date().toISOString()
      };

      const contentBase64 = Buffer.from(JSON.stringify(nuevoEstado, null, 2), 'utf8').toString('base64');
      const putPayload = {
        message: 'Sincronizar datos de Agenda Personal',
        content: contentBase64
      };
      if (sha) putPayload.sha = sha;

      const putRes = await fetch(repoUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(putPayload)
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        return res.status(putRes.status).json({ error: errText });
      }

      return res.status(200).json(nuevoEstado);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
