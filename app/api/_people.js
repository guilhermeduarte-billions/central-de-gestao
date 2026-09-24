// De/para de usernames do FLOW e nomes do Ekyte para nome de exibição.
'use strict';

// username do FLOW (project_coordinator / account_manager) → nome de exibição
const NAMES = {
  'analitico26.colli': 'Guilherme Duarte',
  'ariel.pinguelli': 'Ariel Pinguelli',
  'athila.amaral': 'Athila Amaral',
  'athila_amaral': 'Athila Amaral',
  athilamaral: 'Athila Amaral',
  'beatriz.andrade': 'Beatriz de Andrade Vieira',
  'bhrenda.cruz': 'Bhrenda Silva Cruz',
  bhrendacruz: 'Bhrenda Silva Cruz',
  'bruno.sergio': 'Bruno Sergio da Silva',
  'bruno.sergio.silva': 'Bruno Sergio da Silva',
  'david.dias': 'David Dias',
  davidobdias: 'David Dias',
  'denis.orosco': 'Denis Orosco',
  'eduardo.w': 'Eduardo Wellausen',
  'fabiojose.aiello': 'Fabio José Aiello Junior',
  'filipe.santana': 'Filipe Santana',
  'guilherme.duarte': 'Guilherme Duarte',
  'guilhermeduarte.coord': 'Guilherme Duarte',
  gustavosmarito: 'Gustavo Gazzola Smarito',
  'gustavo.smarito': 'Gustavo Gazzola Smarito',
  'gustavosmarito.coord': 'Gustavo Gazzola Smarito',
  'gustavosmarito.tech': 'Gustavo Gazzola Smarito',
  'hernanne.domiciano': 'Hernanne Rodrigues Domiciano',
  'ian.cerqueira': 'Ian Cerqueira',
  'jean.reis': 'Jean Reis',
  'jhonatan.mayer': 'Jhonatan Mayer',
  'juliana.rolim': 'Juliana Rolim',
  'leonardo.augusto': 'Leonardo Augusto Campos de Almeida',
  'leonardo.esteves': 'Leonardo Esteves',
  'lucas.andrade': 'Lucas Raphael Almeida de Andrade',
  'lucas.silva.santos': 'Lucas Silva',
  'marielle.campos': 'Marielle Campos',
  'matheus.jordan': 'Matheus Jordan',
  matheusjordan: 'Matheus Jordan',
  'mayara.alvares': 'Mayara Alvares Santana',
  'melissa.pessoa': 'Melissa Pessoa',
  'melissa.pessoa.acc': 'Melissa Pessoa',
  mychelly: 'Mychelly Severo',
  'nathan.nixon': 'Nathan Nixon',
  nayaraaccount: 'Nayara Ventura',
  nayaraventura: 'Nayara Ventura',
  'rafael.lino.seabra': 'Rafael Lino Seabra',
  'simao.farias': 'Simão de Farias',
  stephanie14: 'Stephanie Molina',
  'stephanie.molina': 'Stephanie Molina',
};

// usernames que representam a coordenação do Guilherme (recorte "Minha coord.")
const MY_COORD_USERS = new Set([
  'guilhermeduarte.coord',
  'guilherme.duarte',
  'analitico26.colli',
]);

const GUILHERME_EMAILS = new Set([
  'analitico26.colli@v4company.com',
  'guilherme.duarte@v4company.com',
]);

// nome escrito no título da tarefa do Ekyte ([Billions][Nome]) → nome canônico
const COORD_ALIASES = {
  'nayara ventura': 'Nayara Ventura',
  nayara: 'Nayara Ventura',
  'gustavo gazzola smarito': 'Gustavo Smarito',
  'gustavo smarito': 'Gustavo Smarito',
  gustavo: 'Gustavo Smarito',
  'guilherme duarte': 'Guilherme Duarte',
  guilherme: 'Guilherme Duarte',
  'melissa pessoa': 'Melissa Pessoa',
  melissa: 'Melissa Pessoa',
};

// Coordenações ativas da gerência Billions hoje.
const CORE_COORDS = ['Nayara Ventura', 'Gustavo Smarito', 'Guilherme Duarte'];

// Ordem da quebra na Sprint Growth (pedido gerencial).
const SPRINT_COORDS = [
  { key: 'Gustavo Smarito', label: 'Gustavo' },
  { key: 'Guilherme Duarte', label: 'Guilherme' },
  { key: 'Nayara Ventura', label: 'Nayara' },
];

// Não são coordenação da gerência Billions — não entram em nenhuma aba (set/2026).
// Ariel e Jhonatan saíram da coordenação. Melissa Pessoa é da Invictus: aparecia porque o
// projeto AXSIS está cadastrado no FLOW com as duas squads (Invictus + Billions).
const COORD_EXCLUIDOS = new Set(['Ariel Pinguelli', 'Jhonatan Mayer', 'Jhonatan Felipe', 'Melissa Pessoa']);

// Saiu da operação — some de report de dupla (set/2026).
const PEOPLE_EXCLUIDOS = new Set(['Athila Amaral']);

// Cientista: opera sozinho, salvo quando o FLOW coloca um GT no mesmo projeto.
const CIENTISTAS = new Set(['Fabio José Aiello Junior']);

const PERSON_ALIASES = {
  'stephanie molina': 'Stephanie Molina',
  stephanie: 'Stephanie Molina',
  'mychelly severo': 'Mychelly Severo',
  mychelly: 'Mychelly Severo',
  'fabio jose aiello junior': 'Fabio José Aiello Junior',
  'fábio josé aiello junior': 'Fabio José Aiello Junior',
  fabio: 'Fabio José Aiello Junior',
  'nathan nixon': 'Nathan Nixon',
  nathan: 'Nathan Nixon',
  'lucas silva': 'Lucas Silva',
  'matheus jordan': 'Matheus Jordan',
  'bruno sergio da silva': 'Bruno Sergio da Silva',
  'bruno sergio': 'Bruno Sergio da Silva',
  'denis orosco': 'Denis Orosco',
  'david dias': 'David Dias',
  'athila amaral': 'Athila Amaral',
  athila: 'Athila Amaral',
};

function displayName(username, vazio) {
  if (!username) return vazio === undefined ? '—' : vazio;
  const key = String(username).trim();
  const mapped = NAMES[key.toLowerCase()];
  if (mapped) return mapped;
  return key
    .split(/[._]+/)
    .filter((p) => p && p.toLowerCase() !== 'coord')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || key;
}

// Nome vindo do Ekyte (executor, título) → nome canônico do time.
function canonName(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.includes('@')) s = displayName(s.split('@')[0]);
  const hit = COORD_ALIASES[s.toLowerCase()];
  if (hit) return hit;
  const first = s.split(' ')[0].toLowerCase();
  return COORD_ALIASES[first] || s;
}

function canonCoord(raw) {
  const n = canonName(raw);
  if (!n || n === '—') return '';
  if (CORE_COORDS.includes(n)) return n;
  return COORD_ALIASES[n.toLowerCase()] || n;
}

// GP / cientista / executor: tira sufixo de empresa (" | V4 Company") e casa com o FLOW.
function canonPerson(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s || s === '—') return '';
  s = s.replace(/\s*\|\s*.+$/, '').trim();
  if (!s) return '';
  if (s.includes('@')) s = displayName(s.split('@')[0]);
  const fromUser = NAMES[s.toLowerCase()];
  if (fromUser) return fromUser;
  const n = canonName(s);
  return PERSON_ALIASES[n.toLowerCase()]
    || PERSON_ALIASES[n.split(' ')[0].toLowerCase()]
    || n;
}

function isMyCoord(username) {
  return MY_COORD_USERS.has(String(username || '').trim().toLowerCase());
}

function isExcluded(nome) {
  return COORD_EXCLUIDOS.has(String(nome || '').trim())
    || COORD_EXCLUIDOS.has(canonCoord(nome));
}

function isExcludedPerson(nome) {
  const n = canonPerson(nome);
  return !n || PEOPLE_EXCLUIDOS.has(n);
}

module.exports = {
  NAMES, MY_COORD_USERS, GUILHERME_EMAILS, COORD_ALIASES, CORE_COORDS, SPRINT_COORDS,
  COORD_EXCLUIDOS, PEOPLE_EXCLUIDOS, CIENTISTAS, PERSON_ALIASES,
  displayName, canonName, canonCoord, canonPerson, isMyCoord, isExcluded, isExcludedPerson,
};
