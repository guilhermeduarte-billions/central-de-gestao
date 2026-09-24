// Snapshot dos projetos Billions no FLOW, normalizado para as abas da Central.
'use strict';

const { displayShort } = require('./_names.js');
const { displayName, isMyCoord, isExcluded } = require('./_people.js');

const HS_CUT = 21;        // corte oficial de antecipação
const HS_CUT_URG = 17;    // corte de urgência
const RES_CUT = 7;        // falha operacional / resultado

function unwrap(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v !== null && 'value' in v) {
    const inner = v.value;
    return inner == null || inner === '' ? null : inner;
  }
  return v;
}

function asNum(v) {
  const raw = unwrap(v);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function asBool(v) {
  const raw = unwrap(v);
  if (raw == null) return null;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (['true', 'sim', '1', 'yes'].includes(s)) return true;
  if (['false', 'nao', 'não', '0', 'no'].includes(s)) return false;
  return null;
}

function asISODate(v) {
  const s = String(unwrap(v) || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function pick(raw, key) {
  const hst = raw.healthScoreTable || {};
  return unwrap(hst[key] != null ? hst[key] : raw[key]);
}

function squadNames(raw) {
  const list = raw.squad || [];
  if (!Array.isArray(list)) return [];
  return list.map((sq) => String((sq && sq.name) || '').trim()).filter(Boolean);
}

function isBillions(raw) {
  return squadNames(raw).some((n) => n.toLowerCase() === 'billions');
}

function isActive(raw) {
  const st = raw.statuses;
  if (Array.isArray(st)) return st.includes('active') || st.includes('ativo');
  return String(st || 'active').toLowerCase() === 'active';
}

// PA da Coordenação é texto livre multilinha; o time marca item pronto com "FEITO".
function parsePA(texto) {
  const raw = String(texto || '').replace(/\r/g, '');
  const itens = raw
    .split(/\n+|(?:^|\s)[•·]\s*/)
    .map((l) => l.replace(/^\s*[-–—*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 2);
  return itens.map((t) => {
    const feito = /\bfeito\b\s*[.!]?$/i.test(t) || /^\s*\[x\]/i.test(t);
    return { texto: t.replace(/\s*\bFEITO\b\s*[.!]?$/i, '').trim() || t, feito };
  });
}

function normalizeProject(raw) {
  const hst = raw.healthScoreTable || {};
  const hs = asNum(pick(raw, 'algorithm_health_avg_score'));
  const resultado = asNum(pick(raw, 'algorithm_results_score'));
  const gpUser = unwrap(raw.account_manager);
  const coordUser = unwrap(raw.project_coordinator);
  const gtUser = unwrap(raw.paid_media_specialist) || unwrap(raw.traffic_manager);
  const trafegoUser = gtUser;
  const legal = String(unwrap(hst.name) || raw.name || '').trim();
  const paTexto = String(pick(raw, 'results_action_plan_coordenacao') || '').trim();
  return {
    id: raw.documentId || String(raw.id || ''),
    name: displayShort(legal),
    legal_name: legal,
    ticker: String(raw.ticker || unwrap(hst.ticker) || '').toUpperCase(),
    hs: hs == null ? null : Math.round(hs),
    resultado: resultado == null ? null : Math.round(resultado),
    flag: String(pick(raw, 'algorithm_flag') || '') || null,
    gp: displayName(gpUser),
    gp_user: gpUser ? String(gpUser) : '',
    coord: displayName(coordUser),
    coord_user: coordUser ? String(coordUser) : '',
    gt: gtUser ? displayName(gtUser) : '',
    gt_user: gtUser ? String(gtUser) : '',
    trafego: trafegoUser ? displayName(trafegoUser) : '—',
    mine: isMyCoord(coordUser),
    pa: {
      texto: paTexto,
      itens: parsePA(paTexto),
      auditado_coord: asBool(pick(raw, 'results_action_plan_audited_by_coordinator_bool')),
      auditado_gerencia: asBool(pick(raw, 'results_audited_by_manager_bool')),
      deadline: asISODate(pick(raw, 'deliveries_action_plan_deadline_date')),
      anomalia: String(pick(raw, 'deliveries_anomaly_action_plan') || '').trim(),
    },
    ekyte_tasks: null,
    ekyte_items: [],
  };
}

// Snapshot Billions ativo, ordenado do pior HS para o melhor.
//
// O filtro por squad não basta: um projeto pode carregar duas squads no cadastro
// (AXSIS tem Invictus + Billions) e entrar no recorte com um coordenador de outra
// gerência. Quem define a gerência aqui é a coordenação.
async function loadBillionsProjects(cockpit) {
  const snap = await cockpit.call('cockpit_query_table', {
    filterBySquad: 'Billions',
    fetchAllPages: true,
    pageSize: 100,
    sortBy: 'name',
  });
  const rows = (snap && (snap.data || snap.rows)) || (Array.isArray(snap) ? snap : []);
  const projects = rows
    .filter((r) => r && isBillions(r) && isActive(r))
    .map(normalizeProject)
    .filter((p) => p.id)
    .filter((p) => !isExcluded(p.coord));
  projects.sort((a, b) => {
    const ha = a.hs == null ? 999 : a.hs;
    const hb = b.hs == null ? 999 : b.hs;
    return ha - hb || a.name.localeCompare(b.name, 'pt-BR');
  });
  return projects;
}

function nowLabel() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
}

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

module.exports = {
  HS_CUT, HS_CUT_URG, RES_CUT,
  unwrap, asNum, asBool, asISODate, pick, squadNames, isBillions, isActive,
  parsePA, normalizeProject, loadBillionsProjects, nowLabel, todayISO,
};
