'use strict';

const assert = require('assert');
const { coordFromTitle, cleanTitle } = require('../api/data.js');

assert.strictEqual(
  coordFromTitle('[02] [Billions] [Nayara Ventura] PA robusto Giacobbo | Gerencial', 'Guilherme Duarte'),
  'Nayara Ventura',
  'título manda, não o executor de volta pra gerência',
);
assert.strictEqual(
  coordFromTitle('[01] [Billions] [Gustavo Smarito] Conectar NEKT | Gerencial', 'Gustavo Gazzola Smarito'),
  'Gustavo Smarito',
);
assert.strictEqual(
  coordFromTitle('[05] [Billions] [Nayara] Subir breakeven | Gerencial', 'Nayara Ventura'),
  'Nayara Ventura',
);
assert.strictEqual(
  coordFromTitle('[01] [Billions] [Guilherme Duarte] 1:1 com Frahm | Gerencial', 'Guilherme Duarte'),
  'Guilherme Duarte',
);
assert.strictEqual(
  coordFromTitle('Solicitação operacional sem marca', 'Nathan Nixon', 'Guilherme Duarte'),
  'Guilherme Duarte',
  'operação cai no dono do workspace',
);
assert.strictEqual(
  coordFromTitle('Sem marca no título', 'Nayara Ventura'),
  'Nayara Ventura',
  'executor coordenador como fallback',
);
assert.strictEqual(
  cleanTitle('[02] [Billions] [Nayara Ventura] PA robusto Giacobbo | Gerencial'),
  'PA robusto Giacobbo',
);

const { priorityKind, overdueGovernance, isNewToday } = require('../api/data.js');
assert.strictEqual(priorityKind('Antecipação HS ≤21', '297829'), 'antecipacao');
assert.strictEqual(priorityKind('Recuperação', '303719'), 'recuperacao');
assert.strictEqual(priorityKind('Expansão', '305096'), '');
assert.deepStrictEqual(
  overdueGovernance('ATRASADA', '2026-09-01', { text: 'follow feito', creation: '2026-09-10', is_auto: false }),
  { managed: true, unmanaged: false },
);
assert.deepStrictEqual(
  overdueGovernance('ATRASADA', '2026-09-22', { text: 'Temos alguns pendentes', creation: '2026-09-22', is_auto: false }),
  { managed: true, unmanaged: false },
  'comentário no dia do vencimento conta como gestão',
);
assert.deepStrictEqual(
  overdueGovernance('ATRASADA', '2026-09-01', { text: 'antes do prazo', creation: '2026-08-20', is_auto: false }),
  { managed: true, unmanaged: false },
  'qualquer comentário humano tira a marca de sem atualização',
);
assert.deepStrictEqual(
  overdueGovernance('ATRASADA', '2026-09-01', { text: '', creation: '', is_auto: false }),
  { managed: false, unmanaged: true },
);
assert.deepStrictEqual(
  overdueGovernance('EM_ANDAMENTO', '2026-09-30', { text: '', creation: '', is_auto: false }),
  { managed: false, unmanaged: false },
);

assert.strictEqual(isNewToday('2026-09-24', '2026-09-24'), true);
assert.strictEqual(isNewToday('2026-09-23', '2026-09-24'), false);
assert.strictEqual(isNewToday('', '2026-09-24'), false);

console.log('tarefas.coord.test.js ok');
