// Escopos de projeto no Ekyte + descoberta dos projetos por coordenação.
'use strict';

const { cached } = require('./_mcp.js');

// Gestão Gerencial: um workspace, projetos fixos (skills /ekyte-acao-gerencial).
const WS_GERENCIA = '112006';
const PROJETOS_GERENCIA = {
  297829: 'Antecipação HS ≤21',
  303719: 'Recuperação',
  303720: 'Solicitação Gerencial',
  305096: 'Expansão',
  314844: 'People',
  331912: 'Strategy Review Q4',
};

// Workspaces de coordenação — um por coordenador. Cada um tem seu próprio projeto
// de Expansão e de Solicitação; os ids nascem junto com a coordenação, então são
// descobertos, não fixados.
const WS_COORDENACAO = [
  { id: '145324', coord: 'Guilherme Duarte' },
  { id: '151417', coord: 'Nayara Ventura' },
  { id: '151418', coord: 'Gustavo Smarito' },
];

function classifyProject(name) {
  const n = String(name || '');
  if (/expans/i.test(n)) return 'expansao';
  if (/solicita/i.test(n)) return 'solicitacao';
  if (/antecipa/i.test(n)) return 'antecipacao';
  if (/recupera/i.test(n)) return 'recuperacao';
  if (/people/i.test(n)) return 'people';
  return 'outro';
}

// "[BILLIONS] Solicitações Coordenação-Coord. Gustavo" → "Solicitações Coordenação"
function shortProjectLabel(name) {
  return String(name || '')
    .replace(/^\[[^\]]*\]\s*/i, '')
    .split(/\s*-?\s*Coord\.?\s/i)[0]
    .replace(/\s+/g, ' ')
    .replace(/[-–—\s]+$/, '')
    .trim() || 'Sem projeto';
}

/**
 * Descobre os projetos ativos de cada workspace de coordenação a partir das
 * próprias tarefas (o Ekyte não expõe listagem de projetos por workspace).
 * @returns {Promise<Array<{workspaceId,coord,projects:Array<{id,name,kind,label}>}>>}
 */
function discoverCoordProjects(ekyte, workspaces = WS_COORDENACAO) {
  return cached('coord-projects:' + workspaces.map((w) => w.id).join(','), 10 * 60_000, async () => {
    const out = await Promise.all(workspaces.map(async (w) => {
      let tasks = [];
      try {
        tasks = await ekyte.listTasks({ workspaceId: w.id, situation: '10,20,30', limit: 200, order: 50 });
      } catch (_) { tasks = []; }
      const byId = new Map();
      for (const t of tasks) {
        const p = t && t.ctcTaskProject;
        if (!p || p.id == null) continue;
        const id = String(p.id);
        if (!byId.has(id)) {
          byId.set(id, { id, name: String(p.name || ''), kind: classifyProject(p.name), label: shortProjectLabel(p.name) });
        }
      }
      return { workspaceId: w.id, coord: w.coord, projects: [...byId.values()] };
    }));
    return out;
  });
}

module.exports = {
  WS_GERENCIA, PROJETOS_GERENCIA, WS_COORDENACAO,
  classifyProject, shortProjectLabel, discoverCoordProjects,
};
