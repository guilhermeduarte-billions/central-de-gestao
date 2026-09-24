'use strict';

const assert = require('assert');
const {
  papelDupla, buildRoster, atribuir, roleLabel, canonPerson, canonCoord,
  sprintAnterior, sprintsAnteriores, tarefasAbertasDaSprint, tarefasAbertasDasSprints,
} = require('../api/sprint-growth.js');
const { isExcludedPerson } = require('../api/_people.js');

assert.strictEqual(canonCoord('Gustavo Gazzola Smarito'), 'Gustavo Smarito');
assert.strictEqual(canonPerson('Mychelly Severo | V4 Company'), 'Mychelly Severo');
assert.strictEqual(canonPerson('stephanie14'), 'Stephanie Molina');
assert.ok(isExcludedPerson('Athila Amaral'));
assert.ok(isExcludedPerson('athila.amaral'));

const projetos = [
  { ticker: 'AICE', coord: 'Guilherme Duarte', gp: 'Stephanie Molina', gt: 'David Dias' },
  { ticker: 'GCBB', coord: 'Nayara Ventura', gp: 'Mychelly Severo', gt: '' },
  { ticker: 'CDGF', coord: 'Guilherme Duarte', gp: 'Fabio José Aiello Junior', gt: '' },
  { ticker: 'MNSS', coord: 'Guilherme Duarte', gp: 'Fabio José Aiello Junior', gt: 'Lucas Silva' },
  { ticker: 'APE', coord: 'Guilherme Duarte', gp: 'Nathan Nixon', gt: 'Lucas Silva' },
];

const steph = papelDupla(projetos[0]);
assert.strictEqual(steph.coord, 'Guilherme Duarte');
assert.strictEqual(steph.gp, 'Stephanie Molina');
assert.strictEqual(steph.role, 'gp');
assert.strictEqual(roleLabel(steph.role, steph.partner), 'GP · David Dias');

const my = papelDupla(projetos[1]);
assert.strictEqual(my.coord, 'Nayara Ventura');
assert.strictEqual(my.gp, 'Mychelly Severo');

const fabio = papelDupla(projetos[2]);
assert.strictEqual(fabio.role, 'cientista');
assert.strictEqual(fabio.partner, '');
assert.ok(fabio.key.includes('Fabio José Aiello Junior'));

const mnss = papelDupla(projetos[3]);
assert.strictEqual(mnss.role, 'dupla');
assert.strictEqual(mnss.partner, 'Lucas Silva');
assert.notStrictEqual(mnss.key, fabio.key, 'Minussi não mistura no cientista solo');
assert.strictEqual(roleLabel(mnss.role, mnss.partner), 'Cientista · Lucas Silva');

assert.strictEqual(papelDupla({ coord: 'Nayara Ventura', gp: 'Athila Amaral', gt: '' }), null);

const roster = buildRoster(projetos);
assert.strictEqual(roster.get('Stephanie Molina').coord, 'Guilherme Duarte');
assert.strictEqual(roster.get('Mychelly Severo').coord, 'Nayara Ventura');

const semClienteSteph = atribuir({
  title: 'Sprint sem ticker',
  executor: 'Stephanie Molina',
  proj: null,
  roster,
});
assert.strictEqual(semClienteSteph.coord, 'Guilherme Duarte');
assert.strictEqual(semClienteSteph.gp, 'Stephanie Molina');

const semClienteMy = atribuir({
  title: 'Outra sem ticker',
  executor: 'Mychelly Severo | V4 Company',
  proj: null,
  roster,
});
assert.strictEqual(semClienteMy.coord, 'Nayara Ventura');

const athila = atribuir({
  title: 'Qualquer',
  executor: 'Athila Amaral',
  proj: null,
  roster,
});
assert.strictEqual(athila.drop, true);

const semanas = [
  { key: '2026-W37', parcial: false },
  { key: '2026-W38', parcial: false },
  { key: '2026-W39', parcial: true },
];
assert.strictEqual(sprintAnterior(semanas).key, '2026-W38', 'última fechada, não a semana em curso');
assert.deepStrictEqual(sprintsAnteriores(semanas).map((s) => s.key), ['2026-W37', '2026-W38']);

const leftover = tarefasAbertasDasSprints([
  { semana: '2026-W38', cancelada: false, concluida_semana: '', title: 'aberta s38' },
  { semana: '2026-W38', cancelada: false, concluida_semana: '2026-W38', title: 'fechou na hora' },
  { semana: '2026-W38', cancelada: true, concluida_semana: '', title: 'cancelada' },
  { semana: '2026-W37', cancelada: false, concluida_semana: '', title: 'aberta s37' },
  { semana: '2026-W38', cancelada: false, concluida_semana: '2026-W39', title: 'fechou depois' },
  { semana: '2026-W39', cancelada: false, concluida_semana: '', title: 'semana atual' },
], sprintsAnteriores(semanas));
assert.deepStrictEqual(leftover.map((t) => t.title).sort(), ['aberta s37', 'aberta s38']);

console.log('sprint-growth.test.js ok');
