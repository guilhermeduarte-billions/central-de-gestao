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

console.log('tarefas.coord.test.js ok');
