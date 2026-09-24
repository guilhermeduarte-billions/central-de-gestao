// Normalização de nomes de empresa (razão social → nome curto) compartilhada pelas abas.
'use strict';

const DN_CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'com', 'para', 'no', 'na', 'nos', 'nas', '&', '+']);
const DN_GENERICAS = new Set([
  'industria', 'industrias', 'comercio', 'comercios', 'industrial', 'comercial',
  'importacao', 'exportacao', 'varejo', 'distribuidora', 'distribuicao', 'distribuidoras',
  'servicos', 'servico', 'tecnologia', 'tecnologias', 'solucoes', 'solucao',
  'produtos', 'produto', 'materiais', 'material', 'equipamentos', 'equipamento',
  'sociedade', 'grupo', 'empresa', 'companhia',
]);
const DN_SUFIXOS = new Set(['ltda', 'limitada', 's.a.', 's/a', 'sa', 'eireli', 'me', 'epp', 'sociedade', 'cia', 'co']);
const DN_VOGAIS = new Set('aeiouAEIOU');

// Palavras de ramo que não identificam a marca — usadas pelo matcher para não casar
// "Consultoria" de um cliente com "Consultoria" de outro.
const MATCH_STOP = new Set([
  ...DN_CONECTIVOS, ...DN_GENERICAS, ...DN_SUFIXOS,
  'locacao', 'maquinas', 'plasticos', 'contabilidade', 'logistics', 'laticinios',
  'turismo', 'brindes', 'studio', 'farmacia', 'manipulacao', 'beleza', 'quimica',
  'marcas', 'patentes', 'participacao', 'varejista', 'promocionais', 'metalurgica',
  'eletroeletronicos', 'supply', 'industriais', 'pisos', 'revestimentos', 'sementes',
  'bike', 'teck', 'heating', 'cooling', 'intermediacao', 'veiculos', 'importadora',
  'express', 'capital', 'cafe', 'visao', 'centro', 'consultoria', 'advogados',
  'associados', 'engenharia', 'sistemas', 'digital', 'holding', 'brasil', 'brazil',
  'gestao', 'qualidade', 'arquitetura', 'paisagismo', 'urbanismo', 'arte', 'design',
  'pecas', 'comunicacoes', 'tecidos', 'emergencias', 'medicas', 'automatizadores',
  'clinica', 'hotel', 'restaurante', 'academia', 'atacadista', 'atacado', 'embalagens',
]);

function fold(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isSigla(w) {
  if (/\d/.test(w) && /[A-Za-zÀ-ÿ]/.test(w)) return true;
  if (!/^[A-Za-zÀ-ÿ]+$/.test(w)) return false;
  if (w === w.toUpperCase() && w.length <= 3) return true;
  if (w === w.toUpperCase() && w.length === 4 && ![...w].some((c) => DN_VOGAIS.has(c))) return true;
  return false;
}

function capWord(w) {
  return isSigla(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

// Razão social → 3 palavras de marca. "STUDIO HENRIQUE HOFFMAN ARQUITETURA ..." → "Studio Henrique Hoffman".
function displayShort(nome, vazio) {
  if (!nome) return vazio || 'Sem Nome';
  let s = String(nome).replace(/\([^)]*\)/g, '');
  s = s.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '');
  s = s.split(/\s+-\s+/)[0];
  s = s.replace(/^\s*\[[^\]]+\]\s*/, '');
  const palavras = s.match(/[A-Za-zÀ-ÿ0-9]+/g) || [];
  const keep = [];
  for (const p of palavras) {
    const low = p.toLowerCase();
    if (DN_SUFIXOS.has(low) || DN_CONECTIVOS.has(low) || DN_GENERICAS.has(low)) continue;
    keep.push(p);
    if (keep.length >= 3) break;
  }
  if (!keep.length) {
    for (const p of palavras) {
      if (DN_CONECTIVOS.has(p.toLowerCase())) continue;
      keep.push(p);
      if (keep.length >= 2) break;
    }
  }
  const words = keep.length ? keep : (palavras.slice(0, 2).length ? palavras.slice(0, 2) : ['Projeto']);
  return words.map(capWord).join(' ');
}

// Aliases entre colchetes dentro da razão social: "[ENCANTA +] Criativ" → ["encanta"].
function bracketAliases(legal) {
  const out = [];
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(String(legal || '')))) {
    const inner = fold(m[1]);
    if (inner) out.push(inner);
  }
  return out;
}

function stripHtml(raw, limit) {
  let t = String(raw || '')
    .replace(/<\/(div|p|li|tr|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/﻿/g, '');
  t = t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
  if (limit && t.length > limit) return t.slice(0, limit - 1).trimEnd() + '…';
  return t;
}

module.exports = {
  DN_CONECTIVOS, DN_GENERICAS, DN_SUFIXOS, DN_VOGAIS, MATCH_STOP,
  fold, isSigla, capWord, displayShort, bracketAliases, stripHtml,
};
