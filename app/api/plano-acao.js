// Aba Plano de Ação: o PA da Coordenação escrito no FLOW × as ações abertas no Ekyte.
//
// Responde "o plano existe?", "virou tarefa?" e "com que prazo?" — que é o buraco entre
// o cockpit (onde o PA é texto livre) e o Ekyte (onde a execução acontece).
'use strict';

const { ekyteFromEnv, cockpitFromEnv, guard, cached } = require('./_mcp.js');
const { fold, MATCH_STOP } = require('./_names.js');
const { loadBillionsProjects, nowLabel, todayISO, HS_CUT, HS_CUT_URG } = require('./_flow.js');
const { buildIndex } = require('./_match.js');
const healthscore = require('./healthscore.js');
const { WS_GERENCIA, PROJETOS_GERENCIA } = require('./_ekyte-scope.js');

const WS_TTL = 30 * 60_000;
const { attachEkyte } = healthscore;

const STATUS_ORDER = { 'sem-nada': 0, 'pa-sem-task': 1, 'task-sem-pa': 2, casado: 3 };
const STATUS_LABEL = {
  'sem-nada': 'Sem PA e sem task',
  'pa-sem-task': 'PA sem task',
  'task-sem-pa': 'Task sem PA',
  casado: 'PA com task',
};

function sigTokens(s) {
  return new Set(fold(s).split(/\s+/).filter((w) => w.length >= 4 && !MATCH_STOP.has(w)));
}

// Casamento best-effort item do PA ↔ tarefa: interseção de palavras distintivas.
// Não inventa vínculo — abaixo do limiar o item fica "sem cobertura declarada".
function cobertura(itensPA, acoes) {
  const acaoTokens = acoes.map((a) => sigTokens(`${a.title} ${a.phase}`));
  return itensPA.map((item) => {
    const toks = sigTokens(item.texto);
    if (toks.size < 2) return { ...item, cobre: [] };
    const cobre = [];
    acaoTokens.forEach((at, i) => {
      let inter = 0;
      for (const t of toks) if (at.has(t)) inter += 1;
      if (inter >= 2 || (inter >= 1 && inter / toks.size >= 0.5)) cobre.push(acoes[i].id);
    });
    return { ...item, cobre };
  });
}

function statusDe(temPA, temTask) {
  if (temPA && temTask) return 'casado';
  if (temPA) return 'pa-sem-task';
  if (temTask) return 'task-sem-pa';
  return 'sem-nada';
}

async function handler(req, res) {
  if (!guard(req, res)) return undefined;
  try {
    const cockpit = cockpitFromEnv('central-plano-acao');
    let ekyte = null;
    try { ekyte = ekyteFromEnv('central-plano-acao'); } catch (_) { ekyte = null; }

    const ekytePromise = ekyte
      ? Promise.all([
        healthscore.loadGerenciaTasks(ekyte),
        cached('ekyte-workspaces', WS_TTL, () => ekyte.listShortWorkspaces()).catch(() => []),
      ]).then(([tasks, workspaces]) => ({ ok: true, tasks, workspaces }))
        .catch((err) => ({ ok: false, error: String((err && err.message) || err), tasks: [], workspaces: [] }))
      : Promise.resolve({ ok: false, error: 'EKYTE_MCP_TOKEN não configurado na Vercel.', tasks: [], workspaces: [] });

    const [projects, ek] = await Promise.all([loadBillionsProjects(cockpit), ekytePromise]);

    let carteira = [];
    if (ek.ok) {
      const index = buildIndex(projects, ek.workspaces);
      carteira = attachEkyte(projects, ek.tasks, index).carteira;
    } else {
      for (const p of projects) { p.ekyte_tasks = null; p.ekyte_items = []; }
    }

    const hoje = todayISO();
    const rows = projects.map((p) => {
      const acoes = (p.ekyte_items || []).map((a) => ({
        ...a,
        atrasada: !!(a.due && a.due < hoje),
        sem_prazo: !a.due,
      }));
      const temPA = !!(p.pa.texto && p.pa.texto.trim());
      const temTask = acoes.length > 0;
      const itens = cobertura(p.pa.itens, acoes);
      const cobertos = new Set(itens.flatMap((i) => i.cobre));
      return {
        id: p.id,
        name: p.name,
        legal_name: p.legal_name,
        ticker: p.ticker,
        hs: p.hs,
        resultado: p.resultado,
        flag: p.flag,
        coord: p.coord,
        coord_user: p.coord_user,
        gp: p.gp,
        mine: p.mine,
        pa: {
          texto: p.pa.texto,
          itens,
          abertos: itens.filter((i) => !i.feito).length,
          feitos: itens.filter((i) => i.feito).length,
          deadline: p.pa.deadline,
          deadline_vencido: !!(p.pa.deadline && p.pa.deadline < hoje),
          auditado_coord: p.pa.auditado_coord,
          auditado_gerencia: p.pa.auditado_gerencia,
        },
        acoes,
        acoes_atrasadas: acoes.filter((a) => a.atrasada).length,
        prazo_proximo: acoes.map((a) => a.due).filter(Boolean).sort()[0] || '',
        acoes_sem_pa: temPA ? acoes.filter((a) => !cobertos.has(a.id)).length : acoes.length,
        status: statusDe(temPA, temTask),
        status_label: STATUS_LABEL[statusDe(temPA, temTask)],
      };
    });

    // Pior primeiro: quem não tem nada, depois PA sem execução, depois execução sem plano.
    rows.sort((a, b) => {
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) return sa - sb;
      const ha = a.hs == null ? 999 : a.hs;
      const hb = b.hs == null ? 999 : b.hs;
      return ha - hb || a.name.localeCompare(b.name, 'pt-BR');
    });

    return res.status(200).send(JSON.stringify({
      ok: true,
      generated_at: nowLabel(),
      hoje,
      fonte: 'cockpit_query_table (results_action_plan_coordenacao) × list_tasks Ekyte',
      ekyte_ok: !!ek.ok,
      ekyte_error: ek.ok ? undefined : ek.error,
      ekyte_fonte: `workspace ${WS_GERENCIA} — ${Object.values(PROJETOS_GERENCIA).join(' / ')}`,
      corte_hs: HS_CUT,
      corte_hs_urgente: HS_CUT_URG,
      status_label: STATUS_LABEL,
      total: rows.length,
      rows,
      carteira,
    }));
  } catch (err) {
    return res.status(500).send(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
  }
}

module.exports = handler;
