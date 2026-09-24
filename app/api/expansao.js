// Aba Expansão: cards Billions do FLOW nas etapas de trabalho, cruzados com as tarefas
// de expansão que cada coordenação abre no seu próprio workspace do Ekyte.
// A pergunta que a aba responde: que card já virou execução e qual ainda não tem task.
'use strict';

const { ekyteFromEnv, cockpitFromEnv, guard, cached, EKYTE_TASK_URL } = require('./_mcp.js');
const { displayShort } = require('./_names.js');
const { displayName, isMyCoord, isExcluded } = require('./_people.js');
const { nowLabel, todayISO, asNum, loadBillionsProjects } = require('./_flow.js');
const { buildIndex, matchTask } = require('./_match.js');
const { discoverCoordProjects, WS_COORDENACAO } = require('./_ekyte-scope.js');

const ETAPAS = {
  diagnostico: '// DIAGNÓSTICO',
  reuniao_agendada: '// REUNIÃO AGENDADA',
  apresentacao_realizada: '// APRESENTAÇÃO REALIZADA',
  follow_up: '// FOLLOW-UP',
};
const ETAPA_KEYS = Object.keys(ETAPAS);
const ETAPA_ORDER = { diagnostico: 0, reuniao_agendada: 1, apresentacao_realizada: 2, follow_up: 3 };
const LIM_OT = 120000;
const LIM_MRR = 30000;
const WS_TTL = 30 * 60_000;

function isoDate(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function fmtDate(v) {
  const s = isoDate(v);
  if (!s) return '';
  const [, y, m, d] = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return `${d}/${m}/${y}`;
}

function followISO(card) {
  return isoDate(card.proximoFollowup) || isoDate(card.reuniaoData);
}

function asComments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === 'object');
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v.filter((x) => x && typeof x === 'object');
    } catch (_) { /* ignore */ }
  }
  return [];
}

function commentText(x) {
  return String((x && x.texto) || '').replace(/\s+/g, ' ').trim();
}

function isObsComment(x) {
  return /^\[Observação anterior\]/i.test(commentText(x));
}

function stripObsPrefix(t) {
  return String(t || '').replace(/^\[Observação anterior\]\s*/i, '').replace(/\s+/g, ' ').trim();
}

function pickObservacao(card) {
  const com = asComments(card.comentarios).filter(isObsComment)
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
  if (com.length) return stripObsPrefix(com[0].texto);
  return String(card.obsStatusLead || card.obs || '').replace(/\s+/g, ' ').trim();
}

function pickUltimoComentario(card) {
  const all = asComments(card.comentarios)
    .map((x) => ({ data: String(x.data || ''), texto: commentText(x) }))
    .filter((x) => x.texto);
  if (!all.length) return '';
  all.sort((a, b) => a.data.localeCompare(b.data));
  const rest = all.filter((x) => !/^\[Observação anterior\]/i.test(x.texto));
  const pool = rest.length ? rest : all;
  return stripObsPrefix(pool[pool.length - 1].texto);
}

// OT/MRR acima do teto saem marcados: o FLOW engole o decimal e infla o valor em 100×.
function moneyOut(n, lim) {
  const v = asNum(n);
  if (v == null || v === 0) return { label: '—', raw: v, conferir: false };
  return { label: 'R$ ' + Math.round(v).toLocaleString('pt-BR'), raw: v, conferir: v > lim };
}

function normalizeCard(raw) {
  const etapa = String(raw.etapa || '');
  const project = raw.project || {};
  const legal = String(raw.projectName || project.name || '').trim();
  const coordUser = String(raw.coordenadorUsername || '').trim();
  const gpUser = String(raw.gestorProjetosUsername || '').trim();
  const ot = moneyOut(raw.receitaOnetime, LIM_OT);
  const mrr = moneyOut(raw.receitaBooking, LIM_MRR);
  const follow = followISO(raw);
  const dias = asNum(raw.diasNaEtapa);
  return {
    id: raw.documentId || String(raw.id || ''),
    etapa,
    etapa_label: ETAPAS[etapa] || etapa,
    name: displayShort(legal),
    legal_name: legal,
    ticker: String(project.ticker || '').toUpperCase(),
    produto: String(raw.produto || '').trim() || '—',
    coord: coordUser ? displayName(coordUser) : 'Sem coordenação',
    coord_user: coordUser,
    mine: isMyCoord(coordUser),
    gp: gpUser ? displayName(gpUser) : '—',
    gp_user: gpUser,
    ot: ot.label,
    ot_raw: ot.raw,
    ot_conferir: ot.conferir,
    mrr: mrr.label,
    mrr_raw: mrr.raw,
    mrr_conferir: mrr.conferir,
    dias: dias == null ? null : Math.round(dias),
    sla: !!raw.slaExcedido,
    follow: fmtDate(follow),
    follow_iso: follow,
    follow_overdue: !!(follow && follow < todayISO()),
    observacao: pickObservacao(raw) || '—',
    comentario: pickUltimoComentario(raw) || '—',
    ekyte_tasks: null,
    ekyte_items: [],
  };
}

async function listBillionsCards(client) {
  const out = [];
  for (let page = 1; page <= 8; page++) {
    const snap = await client.call('cockpit_expansion_cards_query', {
      gerencia: 'Billions',
      pageSize: 250,
      page,
      includeSummary: false,
      groupByEtapa: false,
    });
    const rows = (snap && (snap.data || snap.rows)) || (Array.isArray(snap) ? snap : []);
    out.push(...rows);
    if (rows.length < 250) break;
  }
  return out;
}

function cleanExpTitle(t) {
  return String(t || '')
    .replace(/^\[\d+\]\s*\[Billions\]\s*\[[^\]]+\]\s*/i, '')
    .replace(/^\[\d+\]\s*/, '')
    .replace(/^\[[A-Z0-9]{2,8}\]\s*/i, '')
    .replace(/^\[(EXP|AN|QC|LP)\]\s*/i, '')
    .replace(/^[A-Z]{3,8}[0-9]?\s*[-–—]\s+(?=.{8})/, '')
    .replace(/\s*\|\s*(Expans[ãa]o|Gerencial|Operacional)\s*$/i, '')
    .trim() || String(t || 'Sem título');
}

// Tarefas de expansão de todas as coordenações. O ticker está no próprio título
// ("[MDCR1][EXP] Medicar | Apresentação", "[EXP] PSTN - Diagnóstico - Social Media").
//
// Não dá para filtrar por projeto: boa parte das tarefas de diagnóstico é criada solta no
// workspace da coordenação, com ctcTaskProject null. Então puxa o workspace inteiro e
// reconhece a tarefa de expansão pelo projeto OU pela marca [EXP] no título.
const RE_EXP = /\[EXP\]/i;

async function loadExpansaoTasks(ekyte) {
  const packs = await discoverCoordProjects(ekyte);
  const expProjects = new Map();
  for (const pack of packs) {
    for (const proj of pack.projects) {
      if (proj.kind === 'expansao') expProjects.set(String(proj.id), pack.coord);
    }
  }
  const chunks = await Promise.all(WS_COORDENACAO.map(async (w) => {
    try {
      const rows = await ekyte.listTasks({ workspaceId: w.id, situation: '10,20' });
      return rows
        .filter((t) => {
          const pid = t && t.ctcTaskProject && t.ctcTaskProject.id != null ? String(t.ctcTaskProject.id) : '';
          return (pid && expProjects.has(pid)) || RE_EXP.test(String((t && t.title) || ''));
        })
        .map((t) => ({
          id: t.id,
          url: EKYTE_TASK_URL(t.id),
          title: cleanExpTitle(t.title),
          raw_title: String(t.title || ''),
          due: isoDate(t.currentDueDate || t.phaseDueDate),
          phase: String((t.phase && t.phase.name) || '') || '—',
          executor: String((t.executor && (t.executor.userName || t.executor.email)) || '—'),
          situation: String(t.situation || ''),
          coord: w.coord,
          workspaceId: Number(w.id),
        }));
    } catch (_) { return []; }
  }));
  const byId = new Map();
  for (const t of chunks.flat()) byId.set(String(t.id), t);
  return [...byId.values()];
}

function attachTasks(cards, tasks, index) {
  const byTicker = new Map();
  for (const c of cards) {
    if (!c.ticker) continue;
    if (!byTicker.has(c.ticker)) byTicker.set(c.ticker, []);
    byTicker.get(c.ticker).push(c);
  }
  for (const c of cards) { c.ekyte_tasks = 0; c.ekyte_items = []; }
  const orfas = [];
  for (const t of tasks) {
    // o workspace aqui é o da coordenação, não o do cliente: só o texto identifica o cliente
    const hits = matchTask({ title: t.raw_title }, index).filter((h) => byTicker.has(h.ticker));
    if (!hits.length) { orfas.push(t); continue; }
    for (const h of hits) {
      for (const card of byTicker.get(h.ticker)) {
        card.ekyte_items.push({
          id: t.id, title: t.title, url: t.url, due: t.due, phase: t.phase,
          executor: t.executor, situation: t.situation, coord: t.coord, via: h.via,
        });
      }
    }
  }
  for (const c of cards) {
    c.ekyte_items.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    c.ekyte_tasks = c.ekyte_items.length;
  }
  orfas.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return orfas;
}

async function handler(req, res) {
  if (!guard(req, res)) return undefined;
  try {
    const cockpit = cockpitFromEnv('central-expansao');
    let ekyte = null;
    try { ekyte = ekyteFromEnv('central-expansao'); } catch (_) { ekyte = null; }

    const ekytePromise = ekyte
      ? Promise.all([
        loadExpansaoTasks(ekyte),
        cached('ekyte-workspaces', WS_TTL, () => ekyte.listShortWorkspaces()).catch(() => []),
      ]).then(([tasks, workspaces]) => ({ ok: true, tasks, workspaces }))
        .catch((err) => ({ ok: false, error: String((err && err.message) || err), tasks: [], workspaces: [] }))
      : Promise.resolve({ ok: false, error: 'EKYTE_MCP_TOKEN não configurado na Vercel.', tasks: [], workspaces: [] });

    // O índice sai da carteira inteira (não só dos cards): assim uma task de expansão de
    // cliente sem card ainda é identificada e aparece como "task sem card".
    const [raw, projetosFlow, ek] = await Promise.all([
      listBillionsCards(cockpit),
      loadBillionsProjects(cockpit).catch(() => []),
      ekytePromise,
    ]);

    const cards = raw
      .filter((c) => c && ETAPA_KEYS.includes(c.etapa))
      .map(normalizeCard)
      .filter((c) => c.id)
      // coordenação de outra gerência não entra (ver COORD_EXCLUIDOS em _people.js)
      .filter((c) => !isExcluded(c.coord))
      .sort((a, b) => {
        const ea = ETAPA_ORDER[a.etapa] ?? 9;
        const eb = ETAPA_ORDER[b.etapa] ?? 9;
        if (ea !== eb) return ea - eb;
        const ca = a.coord.localeCompare(b.coord, 'pt-BR');
        if (ca) return ca;
        const da = a.dias == null ? -1 : a.dias;
        const db = b.dias == null ? -1 : b.dias;
        return db - da || a.name.localeCompare(b.name, 'pt-BR');
      });

    let orfas = [];
    if (ek.ok) {
      // índice de tickers a partir dos próprios cards (o ticker vem do projeto no FLOW)
      const doCard = cards.map((c) => ({ ticker: c.ticker, legal_name: c.legal_name, name: c.name }));
      const vistos = new Set(doCard.map((p) => p.ticker));
      const projetos = [...doCard, ...projetosFlow.filter((p) => p.ticker && !vistos.has(p.ticker))];
      const index = buildIndex(projetos, ek.workspaces);
      const nomePorTicker = new Map(projetos.map((p) => [p.ticker, p.name]));
      orfas = attachTasks(cards, ek.tasks, index).map((t) => {
        const hit = matchTask({ title: t.raw_title }, index)[0];
        return { ...t, ticker: hit ? hit.ticker : '', cliente: hit ? (nomePorTicker.get(hit.ticker) || hit.ticker) : '—' };
      });
    } else {
      for (const c of cards) { c.ekyte_tasks = null; c.ekyte_items = []; }
    }

    const counts = {};
    const cobertura = {};
    for (const key of ETAPA_KEYS) {
      const doGrupo = cards.filter((c) => c.etapa === key);
      counts[key] = doGrupo.length;
      cobertura[key] = { total: doGrupo.length, com_task: doGrupo.filter((c) => c.ekyte_tasks > 0).length };
    }

    return res.status(200).send(JSON.stringify({
      ok: true,
      generated_at: nowLabel(),
      fonte: 'cockpit_expansion_cards_query',
      gerencia: 'Billions',
      etapas: ETAPAS,
      ekyte_ok: !!ek.ok,
      ekyte_error: ek.ok ? undefined : ek.error,
      ekyte_fonte: `projetos de Expansão das coordenações (${WS_COORDENACAO.map((w) => w.coord.split(' ')[0]).join(', ')})`,
      ekyte_open: ek.ok ? ek.tasks.length : 0,
      total: cards.length,
      counts,
      cobertura,
      cards,
      orfas,
    }));
  } catch (err) {
    return res.status(500).send(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
  }
}

handler.ETAPAS = ETAPAS;
handler.normalizeCard = normalizeCard;
handler.pickObservacao = pickObservacao;
handler.pickUltimoComentario = pickUltimoComentario;
handler.moneyOut = moneyOut;
handler.fmtDate = fmtDate;
handler.followISO = followISO;
handler.displayShort = displayShort;
handler.displayName = displayName;
handler.cleanExpTitle = cleanExpTitle;
handler.attachTasks = attachTasks;
module.exports = handler;
