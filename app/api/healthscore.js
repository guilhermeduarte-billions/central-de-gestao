// Aba Healthscore: snapshot Billions no FLOW (média acumulada 8 semanas, não o score da semana)
// cruzado com as ações abertas da Gestão Gerencial no Ekyte.
//
// O cruzamento é por TICKER, não por semelhança de nome: a ação gerencial escreve o ticker
// entre parênteses ("Giacobbo (GCBB)"). Só a API v1.1 do Ekyte devolve a descrição, então é
// dela que vem o universo de tarefas; a v1.0 entra só para as pausadas, que a v1.1 omite.
'use strict';

const { ekyteFromEnv, cockpitFromEnv, guard, cached, EKYTE_TASK_URL } = require('./_mcp.js');
const { stripHtml } = require('./_names.js');
const { loadBillionsProjects, nowLabel, HS_CUT, HS_CUT_URG, RES_CUT } = require('./_flow.js');
const { buildIndex, matchTask } = require('./_match.js');
const { WS_GERENCIA, PROJETOS_GERENCIA } = require('./_ekyte-scope.js');

const WS_TTL = 30 * 60_000;

function isoDate(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function cleanTaskTitle(t) {
  let s = String(t || '').trim();
  s = s.replace(/^\[\d+\]\s*\[Billions\]\s*\[[^\]]+\]\s*/i, '');
  s = s.replace(/^\[\d+\]\s*\[[A-Z0-9]{2,8}\]\s*/i, '');
  s = s.replace(/^\[\d+\]\s*/, '');
  s = s.replace(/\s*\|\s*(Gerencial|Operacional)\s*$/i, '');
  return s.trim();
}

function projectLabel(task) {
  const id = String(task.projectId != null ? task.projectId : (task.ctcTaskProject && task.ctcTaskProject.id) || '');
  if (PROJETOS_GERENCIA[id]) return PROJETOS_GERENCIA[id];
  const name = String(task.project || (task.ctcTaskProject && task.ctcTaskProject.name) || '');
  return name.replace(/^\[Billions\]\s*/i, '').trim() || 'Sem projeto';
}

function executorName(task) {
  const ex = task.executor;
  if (!ex) return '—';
  if (typeof ex === 'string') return ex.includes('@') ? ex.split('@')[0] : ex;
  return ex.userName || ex.email || '—';
}

function situationOf(task) {
  return String(task.situation != null ? task.situation : task.taskSituation || '');
}

// Normaliza tarefa da v1.0 e da v1.1 no mesmo formato.
function normalizeTask(task) {
  return {
    id: task.id,
    url: EKYTE_TASK_URL(task.id),
    title: cleanTaskTitle(task.title) || String(task.title || 'Sem título'),
    raw_title: String(task.title || ''),
    description: task.description ? stripHtml(task.description, 6000) : '',
    due: isoDate(task.currentDueDate || task.phaseDueDate),
    created: isoDate(task.createdAt || task.creationDate),
    phase: String((task.phase && task.phase.name) || task.phase || '') || '—',
    executor: executorName(task),
    situation: situationOf(task),
    project_id: String(task.projectId != null ? task.projectId : (task.ctcTaskProject && task.ctcTaskProject.id) || ''),
    project_label: projectLabel(task),
    workspaceId: task.workspaceId,
  };
}

// Universo de ações gerenciais abertas: list_tasks dá o recorte (workspace + projetos +
// situação), get_detailed_task dá a descrição — que é onde o ticker do cliente é escrito.
async function loadGerenciaTasks(ekyte) {
  // Uma chamada por projeto: list_tasks corta em 200 e o lote da gerência já passa disso.
  const ids = Object.keys(PROJETOS_GERENCIA);
  const batches = await Promise.all(ids.map((id) => ekyte.listTasks({
    workspaceId: WS_GERENCIA,
    projectIds: id,
    situation: '10,20',
  }).catch(() => [])));
  const seen = new Set();
  const brutas = [];
  for (const batch of batches) {
    for (const task of batch || []) {
      if (!task || task.id == null || seen.has(String(task.id))) continue;
      seen.add(String(task.id));
      brutas.push(task);
    }
  }
  const tasks = brutas.map(normalizeTask).filter((t) => t.id && t.title);
  const detalhes = await ekyte.taskDetails(tasks.map((t) => t.id));
  for (const t of tasks) {
    const d = detalhes.get(String(t.id));
    if (d && d.description) t.description = stripHtml(d.description, 6000);
  }
  return tasks;
}


function attachEkyte(projects, tasks, index) {
  const byTicker = new Map();
  for (const p of projects) if (p.ticker) byTicker.set(p.ticker, p);
  for (const p of projects) { p.ekyte_tasks = 0; p.ekyte_items = []; }
  const carteira = [];
  let casadas = 0;
  for (const t of tasks) {
    const hits = matchTask(t, index).filter((h) => byTicker.has(h.ticker));
    if (!hits.length) { carteira.push(t); continue; }
    casadas += 1;
    for (const h of hits) {
      const p = byTicker.get(h.ticker);
      p.ekyte_items.push({
        id: t.id, title: t.title, url: t.url, due: t.due, phase: t.phase,
        executor: t.executor, situation: t.situation, project: t.project_label, via: h.via,
      });
    }
  }
  for (const p of projects) {
    p.ekyte_items.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || String(a.id).localeCompare(String(b.id)));
    p.ekyte_tasks = p.ekyte_items.length;
  }
  carteira.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return { casadas, carteira };
}

async function handler(req, res) {
  if (!guard(req, res)) return undefined;
  try {
    const cockpit = cockpitFromEnv('central-healthscore');
    let ekyte = null;
    try { ekyte = ekyteFromEnv('central-healthscore'); } catch (_) { ekyte = null; }

    const ekytePromise = ekyte
      ? Promise.all([
        loadGerenciaTasks(ekyte),
        cached('ekyte-workspaces', WS_TTL, () => ekyte.listShortWorkspaces()).catch(() => []),
      ]).then(([tasks, workspaces]) => ({ ok: true, tasks, workspaces }))
        .catch((err) => ({ ok: false, error: String((err && err.message) || err), tasks: [], workspaces: [] }))
      : Promise.resolve({ ok: false, error: 'EKYTE_MCP_TOKEN não configurado na Vercel.', tasks: [], workspaces: [] });

    const [projects, ek] = await Promise.all([loadBillionsProjects(cockpit), ekytePromise]);

    let stats = { tarefas: 0, casadas: 0, carteira: 0, unresolved_workspaces: 0, unresolved_tickers: [] };
    let carteira = [];
    if (ek.ok) {
      const index = buildIndex(projects, ek.workspaces);
      const r = attachEkyte(projects, ek.tasks, index);
      carteira = r.carteira;
      stats = {
        tarefas: ek.tasks.length,
        casadas: r.casadas,
        carteira: r.carteira.length,
        unresolved_workspaces: index.unresolved.workspaces.length,
        unresolved_tickers: index.unresolved.tickers,
      };
    } else {
      for (const p of projects) { p.ekyte_tasks = null; p.ekyte_items = []; }
    }

    return res.status(200).send(JSON.stringify({
      ok: true,
      generated_at: nowLabel(),
      fonte: 'cockpit_query_table',
      ekyte_fonte: `list_tasks + get_detailed_task no workspace ${WS_GERENCIA} (${Object.values(PROJETOS_GERENCIA).join(' / ')}) — match por ticker`,
      ekyte_ok: !!ek.ok,
      ekyte_error: ek.ok ? undefined : ek.error,
      ekyte_open: ek.ok ? ek.tasks.length : 0,
      corte_hs: HS_CUT,
      corte_hs_urgente: HS_CUT_URG,
      corte_resultado: RES_CUT,
      total: projects.length,
      projects,
      carteira,
      match_stats: stats,
    }));
  } catch (err) {
    return res.status(500).send(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
  }
}

handler.attachEkyte = attachEkyte;
handler.loadGerenciaTasks = loadGerenciaTasks;
handler.normalizeTask = normalizeTask;
handler.cleanTaskTitle = cleanTaskTitle;
module.exports = handler;
