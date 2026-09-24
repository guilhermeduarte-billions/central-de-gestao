'use strict';

const assert = require('assert');
const { test } = require('node:test');
const { buildIndex, matchTask, parseWorkspaceName } = require('../api/_match.js');

const FLOW = [
  { ticker: 'GCBB', legal_name: 'GIACOBBO CONTABILIDADE', name: 'Giacobbo Contabilidade' },
  { ticker: 'CVSN', legal_name: '[ENCANTA +] Criativ Brindes', name: 'Criativ Brindes' },
  { ticker: 'EZTR', legal_name: 'EZ TURISMO', name: 'Ez Turismo' },
  { ticker: 'MI5', legal_name: '[ACMAX] MI5 DISTRIBUIDORA DE PECAS LTDA', name: 'MI5 Pecas' },
  { ticker: 'G6S', legal_name: 'G6 SVA', name: 'G6 Sva' },
  { ticker: 'STUD', legal_name: 'STUDIO HENRIQUE HOFFMAN ARQUITETURA ARTE DESIGN PAISAGISMO URBANISMO LTDA', name: 'Studio Henrique Hoffman' },
  { ticker: 'RVSV', legal_name: 'Reveservice - Revestimentos', name: 'Reveservice' },
  { ticker: 'RDOP', legal_name: 'RDO PRO', name: 'RDO Pro' },
  { ticker: 'KRNS', legal_name: 'Kronos', name: 'Kronos' },
  { ticker: 'JNV', legal_name: 'Ravi Tecidos', name: 'Ravi Tecidos' },
  { ticker: 'AICE', legal_name: 'AUDIOFRAHM ELETROELETRONICOS', name: 'Audiofrahm Eletroeletronicos' },
  { ticker: 'NUVE', legal_name: 'Nuveto Comunicacoes', name: 'Nuveto' },
  { ticker: 'GEO', legal_name: 'Geoqi', name: 'Geoqi' },
  { ticker: 'DER', legal_name: 'Derpom Industria', name: 'Derpom' },
  { ticker: 'MDCR', legal_name: 'MEDICAR EMERGENCIAS MEDICAS', name: 'Medicar Emergencias' },
  { ticker: 'PTNB', legal_name: 'PRATA NOBRE', name: 'Prata Nobre' },
  { ticker: 'APEQU', legal_name: 'AP EQUIP', name: 'AP Equip' },
  { ticker: 'CAR', legal_name: 'Carflix', name: 'Carflix' },
  { ticker: 'PSTN', legal_name: 'WK CARPETES', name: 'WK Carpetes' },
];

const WORKSPACES = [
  { id: 109211, name: '[BILLIONS] [GCBB] GIACOBBO CONTABILIDADE' },
  { id: 143375, name: '[MDCR1] [Billions] Medicar Emergências Médicas' },
  { id: 143027, name: '[KRNS1] [Billions] Kronos ' },
  { id: 130741, name: '[BILLIONS] Ravi Tecidos' },
  { id: 131150, name: '[BILLIONS] [PSTN] WK Carpetes' },
  { id: 112006, name: '[BILLIONS] Gestão Gerencial' },
];

const IDX = buildIndex(FLOW, WORKSPACES);
const tickers = (task) => matchTask(task, IDX).map((h) => h.ticker).sort();
const via = (task, tk) => (matchTask(task, IDX).find((h) => h.ticker === tk) || {}).via;

test('ticker entre parênteses na descrição é o sinal mais forte', () => {
  const t = {
    title: '[02] [Billions] [Nayara Ventura] PA robusto Giacobbo | Gerencial',
    description: '<div>Cockpit FLOW → Giacobbo (GCBB) → plano de ação.</div>',
  };
  assert.deepStrictEqual(tickers(t), ['GCBB']);
  assert.strictEqual(via(t, 'GCBB'), 'ticker-paren');
});

test('uma tarefa pode citar vários clientes', () => {
  const t = {
    title: '[06] [Billions] [Nayara Ventura] Subir/refazer breakevens Kronos, Ravi, RDO Pro e ACMAX | Gerencial',
    description: 'Subir os breakevens de Kronos (KRNS), Ravi Tecidos (JNV), RDO Pro (RDOP) e ACMAX (MI5).',
  };
  assert.deepStrictEqual(tickers(t), ['JNV', 'KRNS', 'MI5', 'RDOP']);
});

test('marca do aliases.json resolve nome que não sai da razão social', () => {
  assert.deepStrictEqual(tickers({ title: '[02] [Billions] [Guilherme Duarte] 1:1 com Frahm | Gerencial' }), ['AICE']);
  assert.deepStrictEqual(tickers({ title: '[05] [Billions] [Nayara] PA funil B2B Encanta (e ecom) | Gerencial' }), ['CVSN']);
});

test('ticker curto não casa dentro de palavra nem em texto solto', () => {
  // "geo do kickoff" não pode virar o ticker GEO
  assert.deepStrictEqual(tickers({ title: '[02] [Billions] [Nayara] Reveservice — geo do kickoff e resposta no grupo | Gerencial' }), ['RVSV']);
  // "DER" não pode sair de "Atualizar"/"perder"
  assert.deepStrictEqual(tickers({ title: '[02] [Billions] [Nayara] Atualizar plano de mídia no FLOW | Gerencial', description: 'Não deixar o plano perder validade.' }), []);
});

test('rótulo de lista resolve ticker de 3 letras', () => {
  const t = {
    title: '[01] [Billions] [Gustavo Smarito] Conectar NEKT no GA4 | Gerencial',
    description: 'Escopo: 1) APEQU — AP Equip 2) CAR — Carflix',
  };
  assert.deepStrictEqual(tickers(t), ['APEQU', 'CAR']);
  assert.strictEqual(via(t, 'CAR'), 'ticker-label');
});

test('cliente citado de passagem na descrição não vira match', () => {
  const t = {
    title: '[02] [Billions] [Gustavo Smarito] Agendar visita com Medicar | Gerencial',
    description: 'Agendar visita presencial com a Medicar (MDCR). Não confundir com Prata Nobre (lá é 1:1, não visita).',
  };
  assert.ok(tickers(t).includes('MDCR'));
  assert.ok(!tickers(t).includes('PTNB'), 'Prata Nobre é menção de contraste, não alvo');
});

test('ação de carteira não casa com nenhum cliente', () => {
  for (const title of [
    '[01] [Billions] [Nayara Ventura] Preencher Black Friday Legends 2026 | Gerencial',
    '[01] [Billions] [Guilherme Duarte] Planejar Strategy Review Q4 — todos os clientes | Gerencial',
    '[01] [Billions] [Nayara Ventura] Mapear datas sazonais da carteira até dez/2026 | Gerencial',
  ]) {
    assert.deepStrictEqual(tickers({ title }), [], title);
  }
});

test('workspace de cliente é prova direta do projeto', () => {
  const t = { id: 1, title: '[01][LP][IA] Revisar e concluir LP de válvula', workspaceId: 131150 };
  assert.deepStrictEqual(tickers(t), ['PSTN']);
  assert.strictEqual(via(t, 'PSTN'), 'workspace');
});

test('ticker no título das tarefas de expansão', () => {
  assert.deepStrictEqual(tickers({ title: '[MDCR1][EXP] Medicar | Apresentação' }), ['MDCR']);
  assert.deepStrictEqual(tickers({ title: '[EXP] PSTN - Diagnóstico - Redes Sociais' }), ['PSTN']);
});

test('workspace com sufixo numérico no ticker resolve para o ticker do FLOW', () => {
  assert.strictEqual(parseWorkspaceName('[MDCR1] [Billions] Medicar', new Set(['MDCR'])).ticker, 'MDCR');
  assert.strictEqual(parseWorkspaceName('[BILLIONS] [GCBB] GIACOBBO', new Set(['GCBB'])).ticker, 'GCBB');
  assert.strictEqual(parseWorkspaceName('[BILLIONS] Gestão Gerencial', new Set(['GCBB'])).ticker, '');
});

test('workspace Billions sem ticker casa pela marca quando é único', () => {
  assert.strictEqual(IDX.wsByTicker.get(130741), 'JNV', 'Ravi Tecidos');
});
