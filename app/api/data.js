// Função serverless: puxa o Ekyte (MCP oficial) ao vivo e devolve JSON das 2 seções.
// Token vem de process.env.EKYTE_MCP_TOKEN (variável ENCRIPTADA na Vercel — nunca no cliente).
'use strict';

const { ekyteFromEnv, guard, mapLimit, EKYTE_TASK_URL } = require('./_mcp.js');
const { GUILHERME_EMAILS, canonName, CORE_COORDS } = require('./_people.js');
const { WS_GERENCIA, PROJETOS_GERENCIA } = require('./_ekyte-scope.js');

// ── escopos (das skills /ekyte-acao-gerencial e /ekyte-acao-operacional) ──────
const SCOPES = [
  {
    key: 'gerencia',
    titulo: 'Coordenadores — tarefas para a gerência',
    workspaceId: WS_GERENCIA,
    projectIds: Object.keys(PROJETOS_GERENCIA).join(','),
  },
  {
    key: 'operacao',
    titulo: 'Operação — coordenação Guilherme Duarte',
    workspaceId: '145324',
    projectIds: '312831,329498',
  },
];

const CRITICAL_KEYWORDS = [
  'bloqueio', 'bloqueado', 'travado', 'parado', 'risco', 'churn', 'cancelamento',
  'aviso previo', 'urgente', 'nao esta funcionando', 'sem retorno',
];

// Rótulos curtos por projeto (para o filtro por projeto do Ekyte)
const PROJECT_LABELS = {
  ...Object.fromEntries(Object.entries(PROJETOS_GERENCIA).map(([id, label]) => [String(id), label])),
  '312831': 'Solicitação',
  '329498': 'Expansão',
};
function scopeProjects(scope) {
  return String(scope.projectIds || '').split(',').map((id) => id.trim()).filter(Boolean)
    .map((id) => ({ id, label: PROJECT_LABELS[id] || id }));
}
function projectLabel(proj) {
  const id = proj && proj.id != null ? String(proj.id) : '';
  if (PROJECT_LABELS[id]) return PROJECT_LABELS[id];
  const name = (proj && proj.name ? String(proj.name) : '').replace(/^\[Billions\]\s*/i, '').trim();
  return name || 'Sem projeto';
}

const CONCURRENCY = 8;
const TASK_URL = EKYTE_TASK_URL;

// ── datas / buckets ───────────────────────────────────────────────────────────
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function todayBRT() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function parseDate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
function isNewToday(created, today) {
  return !!(created && today && created === today);
}
function weekday(s) { const [y, m, d] = s.split('-').map(Number); return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }

const BUCKETS = {
  ATRASADA: ['atrasada', 'st-atrasada', 0],
  VENCE_HOJE: ['hoje', 'st-hoje', 1],
  PROXIMAS_48H: ['em 48h', 'st-48h', 2],
  EM_ANDAMENTO: ['no prazo', 'st-andamento', 3],
  SEM_PRAZO: ['sem prazo', 'st-sem-prazo', 4],
  PAUSADA: ['pausada', 'st-pausada', 5],
};
function classify(due, situation, today) {
  if (String(situation) === '20') return 'PAUSADA';
  if (!due) return 'SEM_PRAZO';
  if (due < today) return 'ATRASADA';
  if (due === today) return 'VENCE_HOJE';
  if (due === addDays(today, 1) || due === addDays(today, 2)) return 'PROXIMAS_48H';
  return 'EM_ANDAMENTO';
}
function vencParts(due, today, bucket) {
  const d = due ? due.slice(8, 10) + '/' + due.slice(5, 7) : '—';
  if (bucket === 'PAUSADA') return { date: d, hint: 'pausada' };
  if (!due) return { date: '—', hint: '' };
  if (bucket === 'ATRASADA') return { date: d, hint: daysBetween(due, today) + 'd atraso' };
  if (bucket === 'VENCE_HOJE') return { date: d, hint: 'hoje' };
  return { date: d, hint: weekday(due) };
}
function cleanTitle(t) {
  t = String(t || '').trim();
  t = t.replace(/^\[\d+\]\s*\[Billions\]\s*\[[^\]]+\]\s*/i, '');
  t = t.replace(/^\[\d+\]\s*/, '');
  t = t.replace(/\s*\|\s*(Gerencial|Operacional)\s*$/i, '');
  return t.trim() || String(t || 'Sem título').trim();
}

// Coordenador = nome no título ([Billions][Nome]), não o executor atual — a tarefa
// volta pra gerência na validação e cairia no grupo errado. Na Operação, o dono do workspace.
function coordFromTitle(rawTitle, executorName, fallback) {
  const title = String(rawTitle || '');
  const m = title.match(/\[Billions\]\s*\[([^\]]+)\]/i);
  if (m) {
    const name = canonName(m[1]);
    if (name && !/^teste\b/i.test(name)) return name;
  }
  const ex = canonName(executorName || '');
  if (CORE_COORDS.includes(ex)) return ex;
  return fallback || ex || 'Outros';
}

// ── comentários ───────────────────────────────────────────────────────────────
function htmlToText(raw, limit = 600) {
  if (!raw) return '';
  let t = raw.replace(/<\/(div|p|li)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/﻿/g, '');
  t = t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return t.length > limit ? t.slice(0, limit - 1).trimEnd() + '…' : t;
}
function norm(s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function isCritical(text) { const h = norm(text); return CRITICAL_KEYWORDS.some((k) => h.includes(norm(k))); }

// Antecipação e Recuperação são o recorte em que a falta de comentário é crítica.
function priorityKind(label, projectId) {
  const id = String(projectId || '');
  if (id === '297829' || /antecipa/i.test(String(label || ''))) return 'antecipacao';
  if (id === '303719' || /recupera/i.test(String(label || ''))) return 'recuperacao';
  return '';
}

// Gestão da tarefa atrasada = existe comentário humano. Sem comentário = não está em execução.
function overdueGovernance(bucket, due, comment) {
  const text = comment && comment.text ? String(comment.text).trim() : '';
  const human = !!(text && comment && !comment.is_auto);
  const managed = bucket === 'ATRASADA' && human;
  return {
    managed,
    unmanaged: bucket === 'ATRASADA' && !human,
  };
}
function pickComment(comments) {
  if (!comments.length) return null;
  const ordered = [...comments].sort((a, b) => String(b.creation || b.updated || '').localeCompare(String(a.creation || a.updated || '')));
  const pool = ordered.filter((c) => !c.isAuto);
  for (const c of (pool.length ? pool : ordered)) {
    const text = htmlToText(c.description || '');
    if (text) {
      const r = c.responsible || {};
      return { text, author: r.userName || r.email || '', creation: (c.creation || '').slice(0, 10), is_auto: !!c.isAuto };
    }
  }
  return null;
}

function executorOf(task) {
  const ex = task.executor || {};
  let name = ex.userName || ex.email || '';
  const email = (ex.email || '').trim().toLowerCase();
  if (name === email && name.includes('@')) name = name.split('@')[0];
  return { name: name || '—', email };
}

async function buildScope(client, scope, today) {
  // Uma chamada por projeto: list_tasks corta em 200 e o lote da gerência já passa disso.
  const ids = String(scope.projectIds || '').split(',').map((id) => id.trim()).filter(Boolean);
  const batches = await Promise.all(ids.map((id) => client.listTasks({
    workspaceId: scope.workspaceId,
    projectIds: id,
    situation: '10,20',
  }).catch(() => [])));
  const seen = new Set();
  const tasks = [];
  for (const batch of batches) {
    for (const task of batch || []) {
      if (!task || task.id == null || seen.has(String(task.id))) continue;
      seen.add(String(task.id));
      tasks.push(task);
    }
  }
  const comments = await mapLimit(tasks, CONCURRENCY, (t) => client.listTaskComments(t.id).catch(() => []));
  const rows = tasks.map((task, i) => {
    const situation = String(task.situation);
    const due = parseDate(task.currentDueDate || task.phaseDueDate);
    const created = parseDate(task.createdAt || task.creationDate);
    const bucket = classify(due, situation, today);
    const [label, css] = BUCKETS[bucket];
    const { name, email } = executorOf(task);
    const last = pickComment(comments[i] || []) || {};
    const text = last.text || '';
    const proj = task.ctcTaskProject || {};
    const project_label = projectLabel(proj);
    const project_id = proj.id != null ? String(proj.id) : '';
    const gov = overdueGovernance(bucket, due, { text, creation: last.creation || '', is_auto: !!last.is_auto });
    const vp = vencParts(due, today, bucket);
    const fallbackCoord = scope.key === 'operacao' ? 'Guilherme Duarte' : '';
    return {
      id: task.id,
      url: TASK_URL(task.id),
      title: cleanTitle(task.title),
      coord: coordFromTitle(task.title, name, fallbackCoord),
      executor: name,
      executor_email: email,
      project_id,
      project_label,
      priority: priorityKind(project_label, project_id),
      bucket,
      status_label: label,
      status_css: css,
      weight: BUCKETS[bucket][2],
      due,
      created,
      is_new: isNewToday(created, today),
      venc_date: vp.date,
      venc_hint: vp.hint,
      comment_text: text,
      comment_author: last.author || '',
      comment_date: last.creation || '',
      comment_is_auto: !!last.is_auto,
      managed_overdue: gov.managed,
      unmanaged_overdue: gov.unmanaged,
      is_critical: isCritical(text),
      back_to_you: GUILHERME_EMAILS.has(email),
    };
  });
  rows.sort((a, b) => {
    const ca = String(a.coord || '').localeCompare(String(b.coord || ''), 'pt-BR');
    if (ca) return ca;
    const ua = a.unmanaged_overdue ? (a.priority ? 0 : 1) : 2;
    const ub = b.unmanaged_overdue ? (b.priority ? 0 : 1) : 2;
    if (ua !== ub) return ua - ub;
    return a.weight - b.weight || (a.due || '9999').localeCompare(b.due || '9999') || String(a.id).localeCompare(String(b.id));
  });
  return { key: scope.key, titulo: scope.titulo, projects: scopeProjects(scope), rows };
}

function weekLabel() {
  // Semana ISO (BRT), alinhada ao POP de tags SEMANA XX do Ekyte.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year').value);
  const m = Number(parts.find((p) => p.type === 'month').value);
  const day = Number(parts.find((p) => p.type === 'day').value);
  const utc = new Date(Date.UTC(y, m - 1, day));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `SEMANA ${String(wk).padStart(2, '0')}`;
}
function nowLabel() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
}

async function handler(req, res) {
  // Senha do app: obrigatória (e resposta vira no-store — cache CDN vazaria o dado sem auth).
  if (!guard(req, res)) return undefined;
  try {
    const client = ekyteFromEnv('central-tarefas');
    const today = todayBRT();
    const sections = [];
    for (const scope of SCOPES) sections.push(await buildScope(client, scope, today));
    return res.status(200).send(JSON.stringify({
      ok: true, generated_at: nowLabel(), today, week_label: weekLabel(), sections,
    }));
  } catch (err) {
    return res.status(500).send(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
  }
}

handler.coordFromTitle = coordFromTitle;
handler.cleanTitle = cleanTitle;
handler.priorityKind = priorityKind;
handler.overdueGovernance = overdueGovernance;
handler.isNewToday = isNewToday;
module.exports = handler;
