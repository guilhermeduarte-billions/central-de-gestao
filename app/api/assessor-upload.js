// Recebe o snapshot do pipeline local (Mac) e grava no Blob privado.
// Auth: x-assessor-key == ASSESSOR_PUBLISH_KEY.
'use strict';

const { SNAPSHOT_PATH, authorize, writeJsonBlob, send, readBody } = require('./_assessor-lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });
  const auth = authorize(req, 'publish');
  if (auth.error) return send(res, 500, { ok: false, error: auth.error });
  if (!auth.ok) return send(res, 401, { ok: false, error: 'Chave de publicação inválida.' });
  try {
    const body = await readBody(req);
    const items = body && body.sources && body.sources.email && body.sources.email.items;
    if (!Array.isArray(items)) return send(res, 400, { ok: false, error: 'Snapshot sem sources.email.items.' });
    body.meta = Object.assign({}, body.meta, { received_at: new Date().toISOString() });
    await writeJsonBlob(SNAPSHOT_PATH, body);
    return send(res, 200, { ok: true, items: items.length, received_at: body.meta.received_at });
  } catch (err) {
    return send(res, 500, { ok: false, error: String((err && err.message) || err) });
  }
};
