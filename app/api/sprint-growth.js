// Aba Sprint Growth: auditoria de execução semana a semana.
//
// A Sprint Growth existe para bater os projetos com HS ≤ 21. A pergunta é: do que foi
// combinado e subido na sprint, quanto fechou dentro da própria sprint — e qual dupla
// (coordenador × gestor de projetos) está travando.
//
// O Ekyte não devolve data de conclusão em list_tasks, então a métrica sai de dois
// recortes por semana: criadas na semana ∩ concluídas na semana.
'use strict';

const { ekyteFromEnv, cockpitFromEnv, guard, cached, mapLimit, EKYTE_TASK_URL, EKYTE_SQUAD_BILLIONS } = require('./_mcp.js');
const { fold } = require('./_names.js');
const { canonName, canonCoord, canonPerson, isExcluded, isExcludedPerson, CIENTISTAS, CORE_COORDS, SPRINT_COORDS } = require('./_people.js');
const { loadBillionsProjects, nowLabel, todayISO, HS_CUT } = require('./_flow.js');
const { buildIndex, matchTask } = require('./_match.js');

const TAG_SPRINT = 'sprint growth';
const TAG_TTL = 30 * 60_000;
const WS_TTL = 30 * 60_000;
const SEMANAS_PADRAO = 8;
const SEMANAS_MAX = 16;
const TAG_OR = '20'; // qualquer valor != 10 = OR

function isoWeekKey(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const year = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return { key: `${year}-W${String(week).padStart(2, '0')}`, week, year };
}

// Janela de semanas ISO (segunda a domingo) terminando na semana corrente.
function buildWeeks(n, hoje) {
  const [y, m, d] = hoje.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const dow = base.getUTCDay() || 7;
  const segundaAtual = new Date(base);
  segundaAtual.setUTCDate(base.getUTCDate() - dow + 1);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const ini = new Date(segundaAtual);
    ini.setUTCDate(segundaAtual.getUTCDate() - 7 * i);
    const fim = new Date(ini);
    fim.setUTCDate(ini.getUTCDate() + 6);
    const inicio = ini.toISOString().slice(0, 10);
    const final = fim.toISOString().slice(0, 10);
    const { key, week } = isoWeekKey(inicio);
    out.push({ key, week, label: `SEMANA ${String(week).padStart(2, '0')}`, inicio, fim: final, parcial: i === 0 });
  }
  return out;
}

async function sprintTagIds(ekyte) {
  return cached('tags-sprint-growth', TAG_TTL, async () => {
    const tags = await ekyte.listTags('0');
    const ids = tags
      .filter((t) => fold(t && t.name) === TAG_SPRINT)
      .map((t) => String(t.id));
    return ids;
  });
}

function tagNames(task) {
  const raw = task && task.tags;
  if (Array.isArray(raw)) return raw.map((t) => String((t && t.name) || t || ''));
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim());
  return [];
}

function semanaDaTag(task) {
  for (const n of tagNames(task)) {
    const m = String(n).match(/SEMANA\s+(\d{1,2})/i);
    if (m) return Number(m[1]);
  }
  return null;
}

function cleanTitle(t) {
  return String(t || '')
    .replace(/^\[\d+\]\s*\[Billions\]\s*\[[^\]]+\]\s*/i, '')
    .replace(/^\[\d+\]\s*\[[A-Z0-9]{2,8}\]\s*/i, '')
    .replace(/^\[\d+\]\s*/, '')
    .replace(/\s*\|\s*(Gerencial|Operacional)\s*$/i, '')
    .trim() || String(t || 'Sem título');
}

function executorName(task) {
  const ex = task && task.executor;
  if (!ex) return '';
  if (typeof ex === 'string') return ex;
  return ex.userName || ex.email || '';
}

function coordDoTitulo(title) {
  const m = String(title || '').match(/\[Billions\]\s*\[([^\]]+)\]/i);
  return m ? canonCoord(m[1]) : '';
}

function papelDupla(proj) {
  if (!proj) return null;
  const coord = canonCoord(proj.coord);
  const gp = canonPerson(proj.gp);
  const gtRaw = canonPerson(proj.gt);
  const gt = isExcludedPerson(gtRaw) ? '' : gtRaw;
  if (!coord || !CORE_COORDS.includes(coord) || isExcluded(coord)) return null;
  if (!gp || isExcludedPerson(gp)) return null;
  const cientista = CIENTISTAS.has(gp);
  const partner = gt && gt !== gp ? gt : '';
  const partnerKey = cientista ? partner : '';
  const role = cientista ? (partner ? 'dupla' : 'cientista') : 'gp';
  return {
    coord,
    gp,
    partner,
    role,
    key: `${coord} ||| ${gp} ||| ${partnerKey}`,
    mine: coord === 'Guilherme Duarte',
  };
}

function buildRoster(projetos) {
  const votes = new Map();
  for (const p of projetos || []) {
    const papel = papelDupla(p);
    if (!papel) continue;
    const cur = votes.get(papel.gp) || new Map();
    cur.set(papel.coord, (cur.get(papel.coord) || 0) + 1);
    votes.set(papel.gp, cur);
  }
  const roster = new Map();
  for (const [gp, byCoord] of votes) {
    let best = '', n = 0;
    for (const [coord, c] of byCoord) if (c > n) { best = coord; n = c; }
    if (best) roster.set(gp, { coord: best, gp, mine: best === 'Guilherme Duarte' });
  }
  return roster;
}

function atribuir({ title, executor, proj, roster }) {
  if (proj) {
    const fromProj = papelDupla(proj);
    if (fromProj) return fromProj;
    const c = canonCoord(proj.coord);
    if (c && isExcluded(c)) return { drop: true };
  }

  const person = canonPerson(executor);
  if (person && isExcludedPerson(person)) return { drop: true };

  if (person && roster && roster.has(person)) {
    const home = roster.get(person);
    const cientista = CIENTISTAS.has(person);
    return {
      coord: home.coord,
      gp: person,
      partner: '',
      role: cientista ? 'cientista' : 'gp',
      key: `${home.coord} ||| ${person} ||| `,
      mine: home.mine,
      inferido: !proj,
    };
  }

  const coord = (proj && canonCoord(proj.coord)) || coordDoTitulo(title);
  if (!coord || !CORE_COORDS.includes(coord) || isExcluded(coord)) return { drop: true };
  if (!person) return { coord, gp: '', partner: '', role: '', key: null, mine: coord === 'Guilherme Duarte', inferido: !proj };
  return {
    coord,
    gp: person,
    partner: '',
    role: CIENTISTAS.has(person) ? 'cientista' : 'gp',
    key: `${coord} ||| ${person} ||| `,
    mine: coord === 'Guilherme Duarte',
    inferido: !proj,
  };
}

function roleLabel(role, partner) {
  if (role === 'cientista') return partner ? `Cientista · ${partner}` : 'Cientista';
  if (role === 'dupla') return partner ? `Cientista · ${partner}` : 'Dupla';
  return partner ? `GP · ${partner}` : 'GP';
}

// Puxa, por semana, quem subiu e quem concluiu. São dois recortes distintos da mesma
// tag; a interseção é o que fechou dentro da própria sprint.
async function coletar(ekyte, semanas, tagIds) {
  const jobs = [];
  for (const s of semanas) {
    jobs.push({ s, tipo: 'criadas' });
    jobs.push({ s, tipo: 'concluidas' });
  }
  const res = await mapLimit(jobs, 6, async ({ s, tipo }) => {
    const base = { squadId: EKYTE_SQUAD_BILLIONS, tagIds: tagIds.join(','), tagOperator: TAG_OR };
    const opts = tipo === 'criadas'
      ? { ...base, createdFrom: s.inicio, createdTo: s.fim }
      : { ...base, concludedFrom: s.inicio, concludedTo: s.fim };
    try {
      return { s, tipo, rows: await ekyte.listTasks(opts) };
    } catch (err) {
      return { s, tipo, rows: [], error: String((err && err.message) || err) };
    }
  });
  const criadas = new Map();      // semana → tarefas
  const concluidasEm = new Map(); // id da tarefa → semana em que foi concluída
  const erros = [];
  for (const r of res) {
    if (r.error) erros.push({ semana: r.s.key, tipo: r.tipo, error: r.error });
    if (r.tipo === 'criadas') criadas.set(r.s.key, r.rows);
    else for (const t of r.rows) if (t && t.id != null) concluidasEm.set(String(t.id), r.s.key);
  }
  return { criadas, concluidasEm, erros, truncado: res.some((r) => (r.rows || []).length >= 200) };
}

function novaCelula() {
  return { subidas: 0, na_sprint: 0, fora: 0, abertas: 0, canceladas: 0, pct: null };
}

function sprintsAnteriores(semanas) {
  return (semanas || []).filter((s) => !s.parcial);
}

function sprintAnterior(semanas) {
  const closed = sprintsAnteriores(semanas);
  return closed.length ? closed[closed.length - 1] : null;
}

function tarefaAindaAberta(t) {
  return !!(t && !t.cancelada && !t.concluida_semana);
}

function tarefasAbertasDasSprints(tarefas, semanas) {
  const keys = new Set((semanas || []).map((s) => s.key || s));
  if (!keys.size) return [];
  return (tarefas || []).filter((t) => keys.has(t.semana) && tarefaAindaAberta(t));
}

function tarefasAbertasDaSprint(tarefas, semanaKey) {
  return tarefasAbertasDasSprints(tarefas, semanaKey ? [{ key: semanaKey }] : []);
}

function fecharCelula(c) {
  const base = c.subidas - c.canceladas;
  c.pct = base > 0 ? Math.round((c.na_sprint / base) * 100) : null;
  return c;
}

async function handler(req, res) {
  if (!guard(req, res)) return undefined;
  try {
    const url = new URL(req.url || '/', 'http://x');
    const nSemanas = Math.min(SEMANAS_MAX, Math.max(2, Number(url.searchParams.get('semanas')) || SEMANAS_PADRAO));

    const cockpit = cockpitFromEnv('central-sprint');
    const ekyte = ekyteFromEnv('central-sprint');
    const hoje = todayISO();
    const semanas = buildWeeks(nSemanas, hoje);

    const [projetos, workspaces, tagIds] = await Promise.all([
      loadBillionsProjects(cockpit),
      cached('ekyte-workspaces', WS_TTL, () => ekyte.listShortWorkspaces()).catch(() => []),
      sprintTagIds(ekyte),
    ]);
    if (!tagIds.length) throw new Error('Nenhuma tag "SPRINT GROWTH" encontrada no Ekyte.');

    const index = buildIndex(projetos, workspaces);
    const porTicker = new Map(projetos.map((p) => [p.ticker, p]));
    const roster = buildRoster(projetos);
    const { criadas, concluidasEm, erros, truncado } = await coletar(ekyte, semanas, tagIds);

    const ordemSemana = new Map(semanas.map((s, i) => [s.key, i]));
    const duplas = new Map();
    const tarefas = [];

    function ensureDupla(papel) {
      if (!papel || !papel.key) return null;
      if (!duplas.has(papel.key)) {
        const semanasMap = {};
        for (const s of semanas) semanasMap[s.key] = novaCelula();
        duplas.set(papel.key, {
          key: papel.key,
          coord: papel.coord,
          gp: papel.gp,
          partner: papel.partner || '',
          role: papel.role,
          mine: !!papel.mine,
          semanas: semanasMap,
          total: novaCelula(),
          projetos: new Set(),
          hs21: new Set(),
          partnerVotes: new Map(),
        });
      }
      const d = duplas.get(papel.key);
      if (papel.partner) d.partnerVotes.set(papel.partner, (d.partnerVotes.get(papel.partner) || 0) + 1);
      if (papel.role && (papel.role === 'cientista' || papel.role === 'dupla' || !d.role || d.role === 'gp')) d.role = papel.role;
      return d;
    }

    for (const p of projetos) ensureDupla(papelDupla(p));

    for (const s of semanas) {
      for (const t of criadas.get(s.key) || []) {
        if (!t || t.id == null) continue;
        const titulo = String(t.title || '');
        const hits = matchTask({ title: titulo, workspaceId: t.workspaceId }, index);
        const ticker = (hits[0] && hits[0].ticker) || '';
        const proj = ticker ? porTicker.get(ticker) : null;
        const papel = atribuir({ title: titulo, executor: executorName(t), proj, roster });
        if (!papel || papel.drop) continue;

        const sitCode = String(t.situation || '');
        const semanaConcluida = concluidasEm.get(String(t.id)) || '';
        const na_sprint = semanaConcluida === s.key;
        const atraso = semanaConcluida
          ? (ordemSemana.get(semanaConcluida) ?? 0) - (ordemSemana.get(s.key) ?? 0)
          : null;

        const row = {
          id: t.id,
          url: EKYTE_TASK_URL(t.id),
          title: cleanTitle(titulo),
          semana: s.key,
          semana_label: s.label,
          semana_tag: semanaDaTag(t),
          ticker,
          cliente: proj ? proj.name : (ticker || '—'),
          hs: proj ? proj.hs : null,
          coord: papel.coord,
          gp: papel.gp || '—',
          partner: papel.partner || '',
          role: papel.role,
          inferido: !!papel.inferido,
          executor: canonPerson(executorName(t)) || canonName(executorName(t)) || '—',
          workspace: String((t.workspace && t.workspace.name) || ''),
          criada_em: s.inicio,
          situation: sitCode,
          concluida_semana: semanaConcluida,
          atraso_semanas: atraso,
          na_sprint,
          cancelada: sitCode === '40',
        };
        tarefas.push(row);

        const d = ensureDupla(papel);
        if (!d) continue;
        const cel = d.semanas[s.key] || (d.semanas[s.key] = novaCelula());
        for (const alvo of [cel, d.total]) {
          alvo.subidas += 1;
          if (row.cancelada) alvo.canceladas += 1;
          else if (na_sprint) alvo.na_sprint += 1;
          else if (semanaConcluida) alvo.fora += 1;
          else alvo.abertas += 1;
        }
        if (ticker) {
          d.projetos.add(ticker);
          if (proj && proj.hs != null && proj.hs <= HS_CUT) d.hs21.add(ticker);
        }
      }
    }

    const coordOrdem = new Map(SPRINT_COORDS.map((c, i) => [c.key, i]));
    const geralSemana = {};
    for (const s of semanas) geralSemana[s.key] = novaCelula();
    const geralTotal = novaCelula();
    const linhas = [...duplas.values()].map((d) => {
      let partner = d.partner || '';
      let votes = 0;
      for (const [name, n] of d.partnerVotes || []) {
        if (n > votes) { partner = name; votes = n; }
      }
      for (const s of semanas) {
        const cel = d.semanas[s.key] || (d.semanas[s.key] = novaCelula());
        fecharCelula(cel);
      }
      fecharCelula(d.total);
      const ultimas = semanas.slice(-5, -1).map((s) => (d.semanas[s.key] && d.semanas[s.key].subidas ? d.semanas[s.key].pct : null));
      return {
        key: d.key,
        coord: d.coord,
        gp: d.gp,
        partner,
        role: d.role,
        papel: roleLabel(d.role, partner),
        mine: d.mine,
        semanas: d.semanas,
        total: d.total,
        tendencia: ultimas,
        projetos: [...d.projetos],
        hs21: d.hs21.size,
      };
    });

    const byCoord = new Map(SPRINT_COORDS.map((c) => [c.key, {
      key: c.key, label: c.label, mine: c.key === 'Guilherme Duarte',
      semanas: Object.fromEntries(semanas.map((s) => [s.key, novaCelula()])),
      total: novaCelula(), projetos: new Set(), hs21: 0,
    }]));
    for (const t of tarefas) {
      const bloco = byCoord.get(t.coord);
      if (!bloco) continue;
      const cel = bloco.semanas[t.semana];
      if (!cel) continue;
      for (const alvo of [cel, bloco.total]) {
        alvo.subidas += 1;
        if (t.cancelada) alvo.canceladas += 1;
        else if (t.na_sprint) alvo.na_sprint += 1;
        else if (t.concluida_semana) alvo.fora += 1;
        else alvo.abertas += 1;
      }
      if (t.ticker) bloco.projetos.add(t.ticker);
    }
    const coordenacoes = SPRINT_COORDS.map((c) => {
      const d = byCoord.get(c.key);
      const hsTickers = new Set(tarefas.filter((t) => t.coord === c.key && t.hs != null && t.hs <= HS_CUT && t.ticker).map((t) => t.ticker));
      for (const s of semanas) fecharCelula(d.semanas[s.key]);
      fecharCelula(d.total);
      const ultimas = semanas.slice(-5, -1).map((s) => (d.semanas[s.key] && d.semanas[s.key].subidas ? d.semanas[s.key].pct : null));
      for (const s of semanas) {
        const cel = d.semanas[s.key];
        const g = geralSemana[s.key];
        g.subidas += cel.subidas; g.na_sprint += cel.na_sprint;
        g.fora += cel.fora; g.abertas += cel.abertas; g.canceladas += cel.canceladas;
      }
      geralTotal.subidas += d.total.subidas; geralTotal.na_sprint += d.total.na_sprint;
      geralTotal.fora += d.total.fora; geralTotal.abertas += d.total.abertas;
      geralTotal.canceladas += d.total.canceladas;
      return {
        key: d.key, coord: d.key, label: d.label, mine: d.mine,
        semanas: d.semanas, total: d.total, tendencia: ultimas,
        projetos: [...d.projetos], hs21: hsTickers.size,
      };
    });
    for (const s of semanas) fecharCelula(geralSemana[s.key]);
    fecharCelula(geralTotal);

    linhas.sort((a, b) => {
      const oa = coordOrdem.has(a.coord) ? coordOrdem.get(a.coord) : 99;
      const ob = coordOrdem.has(b.coord) ? coordOrdem.get(b.coord) : 99;
      if (oa !== ob) return oa - ob;
      const pa = a.total.pct == null ? 999 : a.total.pct;
      const pb = b.total.pct == null ? 999 : b.total.pct;
      return pa - pb || b.total.subidas - a.total.subidas || a.gp.localeCompare(b.gp, 'pt-BR');
    });

    return res.status(200).send(JSON.stringify({
      ok: true,
      generated_at: nowLabel(),
      hoje,
      fonte: 'FLOW (coordenador × GP/cientista) × Ekyte tag SPRINT GROWTH, squad Billions, criação × conclusão na semana ISO',
      definicao: '% na sprint = concluídas dentro da mesma semana ISO em que foram criadas ÷ (subidas − canceladas). Dupla e coordenação saem do FLOW. Célula sem número = nada novo subido naquela sprint.',
      tag_ids: tagIds,
      corte_hs: HS_CUT,
      semanas,
      sprint_anterior: sprintAnterior(semanas),
      sprints_anteriores: sprintsAnteriores(semanas),
      coordenacoes,
      duplas: linhas,
      geral: { por_semana: geralSemana, total: geralTotal },
      tarefas,
      erros,
      truncado,
    }));
  } catch (err) {
    return res.status(500).send(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
  }
}

handler.buildWeeks = buildWeeks;
handler.isoWeekKey = isoWeekKey;
handler.papelDupla = papelDupla;
handler.buildRoster = buildRoster;
handler.atribuir = atribuir;
handler.roleLabel = roleLabel;
handler.canonPerson = canonPerson;
handler.canonCoord = canonCoord;
handler.sprintsAnteriores = sprintsAnteriores;
handler.sprintAnterior = sprintAnterior;
handler.tarefasAbertasDasSprints = tarefasAbertasDasSprints;
handler.tarefasAbertasDaSprint = tarefasAbertasDaSprint;
handler.tarefaAindaAberta = tarefaAindaAberta;
module.exports = handler;
