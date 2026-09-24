'use strict';

const {
  normalizeCard,
  pickObservacao,
  pickUltimoComentario,
  moneyOut,
  fmtDate,
  followISO,
  displayShort,
  displayName,
} = require('../api/expansao.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const card = {
  documentId: 'abc',
  etapa: 'follow_up',
  projectName: 'ROMA EMPREENDIMENTOS TURISMO LTDA',
  produto: 'Chatwoot com auditor',
  coordenadorUsername: 'Guilhermeduarte.coord',
  gestorProjetosUsername: 'stephanie14',
  receitaOnetime: 12000,
  receitaBooking: 2500,
  diasNaEtapa: 16,
  slaExcedido: true,
  proximoFollowup: '2026-10-01',
  reuniaoData: '2026-09-10',
  obsStatusLead: 'fallback obs',
  comentarios: [
    { data: '2026-08-01', texto: '[Observação anterior]  Cliente  sobrecarregado.' },
    { data: '2026-09-16', texto: 'Weekly Expansão 16/09 — follow até sexta.' },
  ],
  project: { ticker: 'RET' },
};

const n = normalizeCard(card);
assert(n.etapa === 'follow_up', 'etapa');
assert(n.mine === true, 'mine coord');
assert(n.coord === 'Guilherme Duarte', 'coord name');
assert(n.gp === 'Stephanie Molina', 'gp name');
assert(n.ot === 'R$ 12.000', 'ot fmt ' + n.ot);
assert(n.mrr === 'R$ 2.500', 'mrr fmt ' + n.mrr);
assert(n.dias === 16, 'dias');
assert(n.sla === true, 'sla');
assert(n.follow === '01/10/2026', 'follow fmt ' + n.follow);
assert(n.observacao === 'Cliente sobrecarregado.', 'obs ' + n.observacao);
assert(n.comentario === 'Weekly Expansão 16/09 — follow até sexta.', 'com ' + n.comentario);
assert(n.ticker === 'RET', 'ticker');
assert(displayShort(card.projectName).length > 0, 'short name');

assert(followISO({ proximoFollowup: null, reuniaoData: '2026-09-10T12:00:00.000Z' }) === '2026-09-10', 'follow fallback');
assert(fmtDate('2026-09-16T11:00:00Z') === '16/09/2026', 'fmtDate');
assert(moneyOut(0, 120000).label === '—', 'zero money');
assert(moneyOut(150000, 120000).conferir === true, 'ot conferir');
assert(moneyOut(2500, 30000).conferir === false, 'mrr ok');
assert(displayName('nayaraventura') === 'Nayara Ventura', 'nayara');
assert(displayName('', 'Sem coordenação') === 'Sem coordenação', 'sem coord');

assert(pickObservacao({ comentarios: [], obsStatusLead: 'Lead obs' }) === 'Lead obs', 'obs fallback');
assert(pickUltimoComentario({ comentarios: [{ data: '2026-01-01', texto: '[Observação anterior] só isso' }] }) === 'só isso', 'only obs');

const other = normalizeCard({
  documentId: 'x',
  etapa: 'reuniao_agendada',
  projectName: 'GIGA CLIMA',
  coordenadorUsername: 'gustavosmarito.coord',
  gestorProjetosUsername: 'nathan.nixon',
  receitaOnetime: null,
  receitaBooking: null,
  comentarios: [],
});
assert(other.mine === false, 'not mine');
assert(other.ot === '—' && other.mrr === '—', 'empty money');
assert(other.observacao === '—' && other.comentario === '—', 'empty text');

console.log('expansao.normalize.test.js ok');
