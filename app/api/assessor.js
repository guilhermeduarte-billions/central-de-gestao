// Devolve o snapshot do Assessor (com overlay de feedback) para a aba do app.
// Auth: x-assessor-key ou ?k= == ASSESSOR_KEY (ou chave de publicação).
'use strict';

const { SNAPSHOT_PATH, FEEDBACK_PATH, authorize, readJsonBlob, send, applyFeedback } = require('./_assessor-lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Use GET.' });
  const auth = authorize(req, 'view');
  if (auth.error) return send(res, 500, { ok: false, error: auth.error });
  if (!auth.ok) return send(res, 401, { ok: false, error: 'Chave de acesso inválida.' });
  try {
    // raw=1 (pipeline): snapshot sem overlay — evita "assar" feedback na base ao mesclar o watch.
    let raw = false;
    try { raw = new URL(req.url, 'http://x').searchParams.get('raw') === '1'; } catch {}
    const [snapshot, feedback] = await Promise.all([readJsonBlob(SNAPSHOT_PATH), raw ? null : readJsonBlob(FEEDBACK_PATH)]);
    if (!snapshot) {
      return send(res, 200, { ok: true, empty: true, message: 'Nenhum snapshot publicado ainda. Rode o pipeline no Mac.' });
    }
    const email = (snapshot.sources && snapshot.sources.email) || {};
    if (!raw) email.items = applyFeedback(email.items || [], feedback);
    return send(res, 200, { ok: true, meta: snapshot.meta || {}, sources: snapshot.sources || {} });
  } catch (err) {
    return send(res, 500, { ok: false, error: String((err && err.message) || err) });
  }
};
