// De/para cliente ↔ tarefa do Ekyte.
//
// A tarefa gerencial/expansão não tem campo de cliente: a identificação está no texto.
// Camadas, da mais forte para a mais fraca:
//   1. (TICKER) ou [TICKER] no título/descrição — convenção real do time. Case-sensitive.
//   2. TICKER como palavra isolada, maiúsculo, >= 4 letras. Ticker curto só casa pela camada 1
//      (senão "geo do kickoff" casa GEO e "DER" casa dentro de palavra).
//   3. Marca — do nome do workspace do Ekyte ([BILLIONS] [GCBB] GIACOBBO...), da razão social
//      do FLOW e de aliases.json. Case-insensitive, com stoplist de palavras de ramo.
// Tarefa sem nenhum match não é erro: é ação de carteira.
'use strict';

const { fold, displayShort, bracketAliases, stripHtml, MATCH_STOP } = require('./_names.js');

let ALIASES = {};
try { ALIASES = require('./aliases.json'); } catch (_) { ALIASES = {}; }

const MIN_TICKER_TOKEN = 4;   // camada 2
const MIN_BRAND_WORD = 4;     // marca de uma palavra só
const MIN_BRAND_TOKEN = 5;    // token solto extraído de uma marca composta

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Palavras distintivas de uma marca (tira conectivos, genéricas e ramo).
function brandTokens(brand) {
  return fold(brand).split(/\s+/).filter((w) => w && w.length > 1 && !MATCH_STOP.has(w));
}

// Uma marca só vira agulha se sobrar sinal depois da stoplist.
function brandIsUsable(brand) {
  const f = fold(brand);
  if (!f) return false;
  const toks = brandTokens(brand);
  if (!toks.length) return false;
  if (toks.length === 1) return toks[0].length >= MIN_BRAND_WORD || /\d/.test(toks[0]);
  return true;
}

// "[BILLIONS] [GCBB] GIACOBBO CONTABILIDADE" → { ticker: 'GCBB', brand: 'GIACOBBO CONTABILIDADE' }
// O sufixo numérico não bate entre os dois sistemas nos dois sentidos: o Ekyte tem
// [MDCR1] para o ticker MDCR e [BLCF] para o ticker BLCF1. `tickers` pode ser um Set
// (forma exata) ou um Map da forma sem dígitos para o ticker do FLOW.
function lookupTicker(tickers, flat) {
  if (!flat) return '';
  if (tickers instanceof Map) return tickers.get(flat) || '';
  return tickers.has(flat) ? flat : '';
}

function parseWorkspaceName(name, tickers) {
  const raw = String(name || '').trim();
  const brackets = [...raw.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  let ticker = '';
  for (const b of brackets) {
    const up = b.toUpperCase();
    if (/^BILLIONS$/.test(up) || /^ROCKET$/.test(up) || /^GEST/.test(up) || /^MP$/.test(up)) continue;
    if (!/^[A-Z0-9&. ]{2,8}$/.test(up)) continue;
    const flat = up.replace(/[^A-Z0-9]/g, '');
    const hit = lookupTicker(tickers, flat) || lookupTicker(tickers, flat.replace(/\d+$/, ''));
    if (hit) { ticker = hit; break; }
  }
  const brand = raw.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  return { ticker, brand };
}

/**
 * @param {Array<{ticker,legal_name,name}>} flowProjects projetos do FLOW (fonte dos tickers)
 * @param {Array<{id,name}>} ekyteWorkspaces workspaces do Ekyte (fonte das marcas reais)
 */
function buildIndex(flowProjects, ekyteWorkspaces) {
  const entries = new Map();   // ticker → { ticker, brands:Set, workspaceIds:Set, project }
  const tickers = new Set();
  const tickerLookup = new Map(); // forma exata e sem dígitos → ticker do FLOW

  for (const p of flowProjects || []) {
    const tk = String((p && p.ticker) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!tk || tk.length < 2) continue;
    tickers.add(tk);
    tickerLookup.set(tk, tk);
    const semDigito = tk.replace(/\d+$/, '');
    // só registra a forma curta se ela não pertencer a outro projeto
    if (semDigito.length >= 3 && semDigito !== tk && !tickers.has(semDigito) && !tickerLookup.has(semDigito)) {
      tickerLookup.set(semDigito, tk);
    }
    if (!entries.has(tk)) entries.set(tk, { ticker: tk, brands: new Set(), workspaceIds: new Set(), project: p });
    const e = entries.get(tk);
    const legal = String(p.legal_name || p.name || '');
    for (const b of [p.name, displayShort(legal, ''), ...bracketAliases(legal)]) {
      if (b && brandIsUsable(b)) e.brands.add(fold(b));
    }
  }

  // marcas vindas do Ekyte — é o nome que o time realmente escreve
  const wsUnresolved = [];
  const wsByTicker = new Map();
  for (const w of ekyteWorkspaces || []) {
    const { ticker, brand } = parseWorkspaceName(w && w.name, tickerLookup);
    if (ticker && entries.has(ticker)) {
      const e = entries.get(ticker);
      if (w.id != null) e.workspaceIds.add(Number(w.id));
      if (brandIsUsable(brand)) e.brands.add(fold(brand));
      wsByTicker.set(Number(w.id), ticker);
      continue;
    }
    if (/billions/i.test(String((w && w.name) || '')) && brand) wsUnresolved.push({ id: w && w.id, name: w && w.name, brand });
  }

  // workspaces Billions sem ticker no nome: casar pela marca com a razão social do FLOW,
  // e só aceitar quando o candidato é único (ambiguidade fica como pendência).
  for (const w of wsUnresolved) {
    const toks = brandTokens(w.brand).filter((t) => t.length >= MIN_BRAND_WORD);
    if (!toks.length) continue;
    const hits = [];
    for (const e of entries.values()) {
      const hay = ' ' + [...e.brands, fold(e.project && (e.project.legal_name || e.project.name))].join(' | ') + ' ';
      if (toks.every((t) => hay.includes(' ' + t + ' ') || hay.includes(' ' + t + '|') || new RegExp('(^| )' + escapeRe(t) + '($| |\\|)').test(hay))) hits.push(e);
    }
    if (hits.length === 1) {
      if (w.id != null) { hits[0].workspaceIds.add(Number(w.id)); wsByTicker.set(Number(w.id), hits[0].ticker); }
      if (brandIsUsable(w.brand)) hits[0].brands.add(fold(w.brand));
      w.resolved = hits[0].ticker;
    }
  }

  // Aliases manuais: são declaração explícita, então passam por cima da stoplist de ramo
  // (é o único jeito de "Ez Turismo" ou "Centro Visão" virarem agulha).
  for (const [tk, list] of Object.entries(ALIASES)) {
    if (tk.startsWith('_') || !Array.isArray(list)) continue;
    const key = tk.toUpperCase();
    if (!entries.has(key)) continue;
    for (const a of list) {
      const f = fold(a);
      if (f.length >= 3) entries.get(key).brands.add(f);
    }
  }

  // Token distintivo de marca: "Palazzo" basta para achar "Palazzo Prado", desde que
  // nenhum outro cliente use a mesma palavra (senão vira colisão silenciosa).
  const tokenOwners = new Map();
  for (const e of entries.values()) {
    const vistos = new Set();
    for (const b of e.brands) {
      for (const w of b.split(/\s+/)) {
        if (w.length < MIN_BRAND_TOKEN || MATCH_STOP.has(w) || vistos.has(w)) continue;
        vistos.add(w);
        if (!tokenOwners.has(w)) tokenOwners.set(w, new Set());
        tokenOwners.get(w).add(e.ticker);
      }
    }
  }
  for (const [w, owners] of tokenOwners) {
    if (owners.size !== 1) continue;
    entries.get([...owners][0]).brands.add(w);
  }

  // agulhas de marca ordenadas da mais longa para a mais curta (evita casar o pedaço antes do todo)
  const brandNeedles = [];
  for (const e of entries.values()) {
    for (const b of e.brands) brandNeedles.push({ ticker: e.ticker, needle: b });
  }
  brandNeedles.sort((a, b) => b.needle.length - a.needle.length);

  const tickerList = [...entries.keys()];
  return {
    entries,
    tickers,
    tickerList,
    brandNeedles,
    wsByTicker,
    unresolved: {
      // Workspaces Billions no Ekyte sem projeto ativo correspondente no FLOW — na maioria
      // clientes antigos. Informativo: só vira pendência se um deles tiver tarefa viva.
      workspaces: wsUnresolved.filter((w) => !w.resolved).map((w) => ({ id: w.id, name: w.name })),
      // Tickers do FLOW que só casam por ticker explícito: candidatos a entrar no aliases.json.
      tickers: tickerList.filter((t) => !entries.get(t).brands.size),
    },
  };
}

/**
 * Texto → tickers citados.
 * @param {{brands?:boolean}} opts brands=false desliga a camada de marca (usado na descrição,
 *   que cita clientes de passagem — "Não confundir com Prata Nobre" viraria match falso).
 */
function matchText(text, index, opts) {
  const raw = String(text || '');
  if (!raw.trim() || !index) return [];
  const allowBrands = !opts || opts.brands !== false;
  const folded = ' ' + fold(raw) + ' ';
  const hits = new Map();

  for (const tk of index.tickerList) {
    if (hits.has(tk)) continue;
    const esc = escapeRe(tk);
    // 1. (GCBB) / [GCBB] / [MDCR1]
    if (new RegExp('[\\(\\[]\\s*' + esc + '\\d?\\s*[\\)\\]]').test(raw)) { hits.set(tk, 'ticker-paren'); continue; }
    // 2. rótulo de lista: "APEQU — AP Equip", "3) GIG — Gigaclima"
    if (tk.length >= 3 && new RegExp('(^|[^A-Za-z0-9])' + esc + '\\s*[—–]\\s').test(raw)) { hits.set(tk, 'ticker-label'); continue; }
    // 3. token isolado maiúsculo, >= 4 letras
    if (tk.length >= MIN_TICKER_TOKEN && new RegExp('(^|[^A-Za-z0-9])' + esc + '([^A-Za-z0-9]|$)').test(raw)) {
      hits.set(tk, 'ticker-token');
    }
  }
  if (allowBrands) {
    for (const { ticker, needle } of index.brandNeedles) {
      if (hits.has(ticker)) continue;
      if (folded.includes(' ' + needle + ' ')) hits.set(ticker, 'marca');
    }
  }
  return [...hits.entries()].map(([ticker, via]) => ({ ticker, via }));
}

const VIA_RANK = { workspace: 0, 'ticker-paren': 1, 'ticker-label': 2, 'ticker-token': 3, marca: 4 };

/** Tarefa crua do Ekyte (v1.0 ou v1.1) → tickers citados, do sinal mais forte para o mais fraco. */
function matchTask(task, index) {
  if (!task) return [];
  const title = String(task.title || '');
  const desc = task.description ? stripHtml(task.description, 6000) : '';
  const hits = new Map();
  // Título aceita marca: quem está no título é o alvo da ação.
  const keep = (t, via) => {
    const cur = hits.get(t);
    if (cur == null || (VIA_RANK[via] ?? 9) < (VIA_RANK[cur] ?? 9)) hits.set(t, via);
  };
  for (const h of matchText(title, index, { brands: true })) keep(h.ticker, h.via);
  // Descrição só aceita sinal forte (ticker explícito).
  for (const h of matchText(desc, index, { brands: false })) keep(h.ticker, h.via);
  // O workspace de cliente é prova direta: entra mesmo se o texto não citar o nome.
  const byWs = index && index.wsByTicker && task.workspaceId != null
    ? index.wsByTicker.get(Number(task.workspaceId))
    : null;
  if (byWs) keep(byWs, 'workspace');
  return [...hits.entries()]
    .map(([ticker, via]) => ({ ticker, via }))
    .sort((a, b) => (VIA_RANK[a.via] ?? 9) - (VIA_RANK[b.via] ?? 9) || a.ticker.localeCompare(b.ticker));
}

module.exports = {
  buildIndex, matchText, matchTask, parseWorkspaceName, lookupTicker, brandIsUsable, brandTokens, ALIASES,
};
