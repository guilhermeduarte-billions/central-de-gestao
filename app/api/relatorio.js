// Aba Adoção: tarefas subidas × concluídas, por coordenador, na Gerência e na Operação.
// Fonte: list_project_tasks (único caminho com data de conclusão; list_tasks não traz).
'use strict';

const { ekyteFromEnv, guard, mapLimit, EKYTE_TASK_URL } = require('./_mcp.js');
const { canonName, isExcluded, CORE_COORDS } = require('./_people.js');
const { nowLabel, todayISO } = require('./_flow.js');
const { PROJETOS_GERENCIA, WS_COORDENACAO, discoverCoordProjects } = require('./_ekyte-scope.js');

const PROJETOS_GERENCIA_LIST = Object.entries(PROJETOS_GERENCIA)
  .map(([id, label]) => ({ id: String(id), label, scope: 'gerencia', scope_label: 'Gerência', coord: '' }));

function parseDate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function isoWeek(s) {
  const [y, m, d] = s.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const year = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return { year, week };
}

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function weekFromTags(tags) {
  let best = null;
  for (const tg of tags || []) {
    const name = String((tg && tg.name) || tg || '');
    const m = name.match(/SEMANA\s+(\d{1,2})/i);
    if (m) {
      const n = Number(m[1]);
      if (!best || n > best) best = n;
    }
  }
  return best;
}

// O coordenador é o nome no título ([Billions][Nome]) — não o executor atual, que volta
// para a gerência na fase de validação e distorceria a adoção.
function coordOf(task, title, fallbackCoord) {
  const m = String(title || '').match(/\[Billions\]\s*\[([^\]]+)\]/i);
  if (m) {
    const name = canonName(m[1]);
    if (name && !/^teste\b/i.test(name)) return name;
  }
  const ex = canonName((task.executor && (task.executor.userName || task.executor.email)) || '');
  if (CORE_COORDS.includes(ex)) return ex;
  if (fallbackCoord) return fallbackCoord;
  if (ex === 'Guilherme Duarte') return /\[QC\]/i.test(title) ? 'QC (lote)' : 'Guilherme Duarte';
  return ex || 'Outros';
}

function cleanTitle(t) {
  let s = String(t || '').trim();
  s = s.replace(/^\[\d+\]\s*\[Billions\]\s*\[[^\]]+\]\s*/i, '');
  s = s.replace(/^\[\d+\]\s*\[[A-Z0-9]{2,8}\]\s*/i, '');
  s = s.replace(/^\[\d+\]\s*/, '');
  s = s.replace(/\s*\|\s*(Gerencial|Operacional)\s*$/i, '');
  return s.trim() || String(t || 'Sem título').trim();
}

function sitOf(task) {
  const v = task.taskSituation != null ? task.taskSituation : task.situation;
  return String(v);
}

function normalize(task, project) {
  const created = parseDate(task.createdAt || task.creationDate);
  const resolved = parseDate(task.resolvedAt || task.resolvedDate || task.concludedDate);
  const title = String(task.title || '');
  const iso = created ? isoWeek(created) : null;
  const tagWeek = weekFromTags(task.tags);
  const year = iso ? iso.year : (created ? Number(created.slice(0, 4)) : null);
  const week = tagWeek || (iso && iso.week) || null;
  const ex = task.executor || {};
  const coord = coordOf(task, title, project.coord);
  return {
    id: task.id,
    url: EKYTE_TASK_URL(task.id),
    title: cleanTitle(title),
    coord,
    executor: canonName(ex.userName || ex.email || '') || '—',
    project_id: String(project.id),
    project_label: project.label,
    scope: project.scope,
    scope_label: project.scope_label,
    sit: sitOf(task),
    created,
    resolved,
    month: created ? created.slice(0, 7) : null,
    week: week && year ? `${year}-W${String(week).padStart(2, '0')}` : null,
    week_n: week,
    week_src: tagWeek ? 'tag' : (iso ? 'iso' : null),
    cycle_days: created && resolved ? Math.max(0, daysBetween(created, resolved)) : null,
    skip: /^\[TESTE MCP\]/i.test(title) || /^Teste MCP$/i.test(coord) || isExcluded(coord),
  };
}

module.exports = async (req, res) => {
  if (!guard(req, res)) return undefined;
  try {
    const ekyte = ekyteFromEnv('central-adocao');
    const today = todayISO();
    const currentWeek = isoWeek(today);
    const errors = [];

    // Operação: os projetos de cada coordenação nascem junto com a coordenação, então
    // são descobertos a partir das próprias tarefas em vez de ficarem fixos no código.
    let operacao = [];
    try {
      const packs = await discoverCoordProjects(ekyte);
      operacao = packs.flatMap((pack) => pack.projects
        .filter((p) => p.kind !== 'outro')
        .map((p) => ({
          id: p.id,
          label: `${p.label} · ${pack.coord.split(' ')[0]}`,
          scope: 'operacao',
          scope_label: 'Operação',
          coord: pack.coord,
        })));
    } catch (err) {
      errors.push({ project_id: 'operacao', error: String((err && err.message) || err) });
    }

    const PROJECTS = [...PROJETOS_GERENCIA_LIST, ...operacao];
    const fetched = await mapLimit(PROJECTS, 4, async (project) => {
      try {
        const raw = await ekyte.listProjectTasks(project.id);
        return { project, tasks: raw, error: null };
      } catch (err) {
        const msg = String((err && err.message) || err);
        errors.push({ project_id: project.id, error: msg });
        return { project, tasks: [], error: msg };
      }
    });

    const tasks = [];
    const projectsMeta = [];
    for (const pack of fetched) {
      const rows = (pack.tasks || []).map((t) => normalize(t, pack.project)).filter((t) => t.id && !t.skip);
      projectsMeta.push({
        id: String(pack.project.id),
        label: pack.project.label,
        scope: pack.project.scope,
        scope_label: pack.project.scope_label,
        n: rows.length,
        error: pack.error,
      });
      tasks.push(...rows);
    }
    tasks.sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')) || String(b.id).localeCompare(String(a.id)));

    return res.status(200).send(JSON.stringify({
      ok: true,
      generated_at: nowLabel(),
      today,
      current_week: `${currentWeek.year}-W${String(currentWeek.week).padStart(2, '0')}`,
      current_month: today.slice(0, 7),
      core_coords: CORE_COORDS,
      scopes: [
        { key: 'gerencia', label: 'Gerência' },
        { key: 'operacao', label: 'Operação' },
      ],
      coordenacoes: WS_COORDENACAO.map((w) => w.coord),
      projects: projectsMeta,
      errors,
      tasks,
      formula: 'adoção = concluídas ÷ (subidas − canceladas), no recorte em que a tarefa foi criada (mês) ou na etiqueta SEMANA XX (semana). Coordenador = nome no título [Billions][Nome]; na Operação, o dono do workspace.',
    }));
  } catch (err) {
    return res.status(500).send(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
  }
};
