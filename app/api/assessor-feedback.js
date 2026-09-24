// Feedback da mesa (Feito / Era ruído / Manter) — GET lista, POST grava.
// O pipeline local puxa este JSON antes de cada rodada e realimenta o classificador.
'use strict';

const { FEEDBACK_PATH, authorize, readJsonBlob, writeJsonBlob, send, readBody } = require('./_assessor-lib.js');

const VALID = new Set(['done', 'noise', 'keep']);

module.exports = async (req, res) => {
  const auth = authorize(req, 'view');
  if (auth.error) return send(res, 500, { ok: false, error: auth.error });
  if (!auth.ok) return send(res, 401, { ok: false, error: 'Chave inválida.' });
  try {
    if (req.method === 'GET') {
      const feedback = (await readJsonBlob(FEEDBACK_PATH)) || { items: {} };
      return send(res, 200, { ok: true, feedback });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use GET ou POST.' });
    const body = await readBody(req);
    const key = String(body.feedback_key || '').trim();
    const status = body.status == null ? null : String(body.status).trim();
    if (!key) return send(res, 400, { ok: false, error: 'feedback_key ausente.' });
    if (status !== null && !VALID.has(status)) return send(res, 400, { ok: false, error: 'status precisa ser done, noise, keep ou null.' });
    const feedback = (await readJsonBlob(FEEDBACK_PATH)) || { items: {} };
    feedback.items = feedback.items || {};
    if (status === null) {
      delete feedback.items[key];
    } else {
      const item = (body.item && typeof body.item === 'object') ? body.item : {};
      feedback.items[key] = {
        status,
        updated_at: new Date().toISOString(),
        subject: item.subject || null,
        latest_from: item.latest_from || null,
        gmail_url: item.gmail_url || null,
        source: 'app',
      };
    }
    await writeJsonBlob(FEEDBACK_PATH, feedback);
    return send(res, 200, { ok: true, key, status, total: Object.keys(feedback.items).length });
  } catch (err) {
    return send(res, 500, { ok: false, error: String((err && err.message) || err) });
  }
};
