// Helpers compartilhados dos endpoints do Assessor (Blob privado + auth por chave).
'use strict';

const SNAPSHOT_PATH = 'assessor/latest.json';
const FEEDBACK_PATH = 'assessor/feedback.json';

function keyFrom(req) {
  const h = req.headers['x-app-key'] || req.headers['x-assessor-key'];
  if (h) return String(h);
  try {
    const url = new URL(req.url, 'http://x');
    return url.searchParams.get('k') || '';
  } catch {
    return '';
  }
}

// view: senha do app (usuário). publish: chave da máquina (pipeline). publish também pode ler.
// A antiga ASSESSOR_KEY deixou de valer para leitura (chegou a ficar embutida no HTML público).
function authorize(req, level) {
  const key = keyFrom(req);
  const password = process.env.APP_PASSWORD || '';
  const publish = process.env.ASSESSOR_PUBLISH_KEY || '';
  if (!password || !publish) return { ok: false, error: 'APP_PASSWORD/ASSESSOR_PUBLISH_KEY não configuradas na Vercel.' };
  if (level === 'publish') return { ok: key === publish };
  return { ok: key === password || key === publish };
}

async function readJsonBlob(pathname) {
  const { get } = require('@vercel/blob');
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream).text();
  return text ? JSON.parse(text) : null;
}

async function writeJsonBlob(pathname, data) {
  const { put } = require('@vercel/blob');
  await put(pathname, JSON.stringify(data, null, 1), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

function send(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      // Vercel já parseia JSON quando Content-Type é application/json
      if (typeof req.body === 'object') return resolve(req.body);
      try { return resolve(JSON.parse(String(req.body))); } catch { return resolve({}); }
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// Mesma semântica do apply_feedback do run.py — overlay do feedback no snapshot.
function applyFeedback(items, feedback) {
  const fb = (feedback && feedback.items) || {};
  for (const item of items) {
    const rec = fb[item.feedback_key];
    if (!rec || !rec.status) continue;
    const c = item.classification || (item.classification = {});
    item.feedback = rec;
    if (rec.status === 'noise') {
      c.assistant_visibility = 'hidden'; c.assistant_bucket = 'oculto'; c.assistant_score = 0;
      c.assistant_reason = 'Ocultado por feedback do Guilherme.';
    } else if (rec.status === 'done') {
      c.assistant_visibility = 'hidden'; c.assistant_bucket = 'feito'; c.assistant_score = 0;
      c.requires_reply = false; c.assistant_reason = 'Marcado como feito pelo Guilherme.';
    } else if (rec.status === 'keep') {
      c.assistant_visibility = 'main';
      if (c.assistant_bucket === 'oculto') c.assistant_bucket = 'cliente_contexto';
      c.assistant_score = Math.max(65, Number(c.assistant_score) || 0);
      c.assistant_reason = 'Mantido na mesa por feedback do Guilherme.';
    }
  }
  return items;
}

module.exports = { SNAPSHOT_PATH, FEEDBACK_PATH, authorize, readJsonBlob, writeJsonBlob, send, readBody, applyFeedback };
