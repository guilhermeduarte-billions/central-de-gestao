// Clientes MCP compartilhados: Ekyte (api.ekyte.com/mcp) e FLOW/Cockpit.
'use strict';

const EKYTE_MCP = 'https://api.ekyte.com/mcp';
const COCKPIT_MCP = process.env.MCP_URL || 'https://mcp-cockpit.dados.collieassociados.com/mcp';

const EKYTE_TASK_URL = (id) => `https://app.ekyte.com/#/tasks/list/${id}/edit`;
const EKYTE_SQUAD_BILLIONS = '2378';

// ── parsing comum (a resposta pode vir JSON ou SSE) ───────────────────────────
function parseBody(raw) {
  const t = String(raw || '').trim();
  if (!t) return {};
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  const lines = t.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] && lines[i] !== '[DONE]') return JSON.parse(lines[i]);
  }
  return {};
}

function toolResult(msg) {
  if (!msg || msg.error) throw new Error(`MCP: ${JSON.stringify(msg && msg.error)}`);
  const content = msg.result && msg.result.content;
  const txt = Array.isArray(content)
    ? content.filter((c) => c && c.type === 'text').map((c) => c.text || '').join('\n')
    : null;
  if (txt == null || txt === '') return msg.result;
  try { return JSON.parse(txt); } catch (_) { return txt; }
}

// Aceita array puro ou envelope {data|tasks|items|results|rows}.
function asList(raw) {
  if (Array.isArray(raw)) {
    if (raw.length && raw.every((x) => x && typeof x === 'object' && !Array.isArray(x) && ('data' in x || 'error' in x))) {
      const flat = [];
      for (const chunk of raw) if (Array.isArray(chunk.data)) flat.push(...chunk.data);
      if (flat.length) return flat.filter((x) => x && typeof x === 'object');
    }
    return raw.filter((x) => x && typeof x === 'object');
  }
  if (raw && typeof raw === 'object') {
    for (const k of ['tasks', 'comments', 'data', 'items', 'results', 'rows']) {
      if (Array.isArray(raw[k])) return raw[k].filter((x) => x && typeof x === 'object');
    }
  }
  return [];
}

function pagingOf(raw) {
  const p = (Array.isArray(raw) ? (raw[0] || {}).paging : raw && raw.paging) || {};
  const page = (p.currentPage && p.currentPage.number) || 1;
  const total = p.totalPages || 1;
  return { page: Number(page) || 1, totalPages: Number(total) || 1 };
}

async function postJson(url, headers, body, { attempts = 4, timeout = 60_000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
      const raw = await res.text();
      if (res.ok) return { raw, headers: res.headers };
      if (res.status < 500 || i === attempts - 1) {
        throw new Error(`MCP HTTP ${res.status}: ${raw.slice(0, 300)}`);
      }
      lastErr = new Error(`MCP HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, 600 * 2 ** i));
  }
  throw lastErr || new Error('MCP indisponível');
}

const _taskDetailCache = new Map();

// ── Ekyte ─────────────────────────────────────────────────────────────────────
class Ekyte {
  constructor(token, clientName) {
    if (!token) throw new Error('EKYTE_MCP_TOKEN não configurado na Vercel.');
    this.url = `${EKYTE_MCP}?token=${encodeURIComponent(token)}`;
    this.clientName = clientName || 'central-gestao';
    this.id = 0;
    this.ready = null;
  }
  async init() {
    if (!this.ready) {
      this.ready = (async () => {
        await postJson(this.url, { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, {
          jsonrpc: '2.0', id: ++this.id, method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: this.clientName, version: '3.0' } },
        });
        await postJson(this.url, { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, {
          jsonrpc: '2.0', method: 'notifications/initialized', params: {},
        });
      })().catch((err) => { this.ready = null; throw err; });
    }
    return this.ready;
  }
  async call(name, args) {
    await this.init();
    const { raw } = await postJson(
      this.url,
      { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      { jsonrpc: '2.0', id: ++this.id, method: 'tools/call', params: { name, arguments: args } },
    );
    return toolResult(parseBody(raw));
  }

  // list_tasks: filtra workspace/projeto/situação/squad/tag/data. NÃO devolve description
  // (a descrição só vem em get_detailed_task) e corta em 200 registros.
  listTasks(opts = {}) {
    const args = { limit: String(opts.limit || 200) };
    const set = (k, v) => { if (v !== undefined && v !== null && v !== '') args[k] = String(v); };
    set('workspaceId', opts.workspaceId);
    set('ctcTaskProjectId', opts.projectIds);
    set('situation', opts.situation);
    set('squadId', opts.squadId);
    set('tagId', opts.tagIds);
    set('tagOperator', opts.tagOperator);
    set('executorId', opts.executorId);
    set('creationDateStart', opts.createdFrom);
    set('creationDateEnd', opts.createdTo);
    set('concludedDateStart', opts.concludedFrom);
    set('concludedDateEnd', opts.concludedTo);
    set('currentDueDateStart', opts.dueFrom);
    set('currentDueDateEnd', opts.dueTo);
    set('textKey', opts.textKey);
    set('textSearch', opts.textSearch);
    set('concluded', opts.concluded);
    set('order', opts.order === undefined ? 50 : opts.order);
    return this.call('list_tasks', args).then(asList);
  }

  // Única rota com a descrição da tarefa (onde o time escreve o ticker do cliente).
  async taskDetail(taskId) {
    const raw = await this.call('get_detailed_task', { taskId: Number(taskId) });
    const list = asList(raw);
    if (list.length && list[0] && list[0].id != null) return list[0];
    return (raw && raw.data) || raw || null;
  }

  // Descrições em lote, com cache por id (a descrição de uma ação não muda na prática).
  async taskDetails(ids, { concurrency = 8 } = {}) {
    const out = new Map();
    const faltando = [];
    for (const id of ids) {
      const hit = _taskDetailCache.get(String(id));
      if (hit) out.set(String(id), hit); else faltando.push(id);
    }
    await mapLimit(faltando, concurrency, async (id) => {
      try {
        const t = await this.taskDetail(id);
        if (t) { _taskDetailCache.set(String(id), t); out.set(String(id), t); }
      } catch (_) { /* tarefa sem detalhe não derruba a carga */ }
    });
    return out;
  }

  listShortWorkspaces() {
    return this.call('list_short_workspaces', { active: '1' }).then(asList);
  }

  listTags(type = '0') {
    return this.call('list_tags', { type: String(type) }).then(asList);
  }


  // Histórico de um projeto: é o único caminho com resolvedDate/resolvedAt.
  listProjectTasks(projectId, page) {
    const args = { projectId: Number(projectId), project_id: String(projectId) };
    if (page) { args.page = String(page); }
    return this.call('list_project_tasks', args).then(asList);
  }

  listTaskComments(taskId) {
    return this.call('list_task_comments', { taskId: Number(taskId), task_id: String(taskId) }).then(asList);
  }

  listWorkspaces() {
    return this.listShortWorkspaces();
  }
}

// ── FLOW / Cockpit ────────────────────────────────────────────────────────────
class Cockpit {
  constructor(jwt, gateway, clientName) {
    if (!jwt || !gateway) throw new Error('MCP_COCKPIT_JWT e MCP_GATEWAY_TOKEN não configurados na Vercel.');
    this.jwt = jwt;
    this.gateway = gateway;
    this.clientName = clientName || 'central-gestao';
    this.sessionId = null;
    this.id = 0;
    this.ready = null;
  }
  headers() {
    const h = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.jwt}`,
      'x-mcp-gateway': this.gateway,
    };
    if (this.sessionId) h['mcp-session-id'] = this.sessionId;
    return h;
  }
  parseAll(ct, raw) {
    const out = [];
    if (String(ct || '').includes('text/event-stream')) {
      for (const line of String(raw).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const s = line.slice(6).trim();
        if (!s || s === '[DONE]') continue;
        try { out.push(JSON.parse(s)); } catch (_) { /* skip */ }
      }
      return out;
    }
    const t = String(raw).trim();
    if (!t) return [];
    if (t.startsWith('{') || t.startsWith('[')) return [JSON.parse(t)];
    for (const line of t.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const s = line.slice(5).trim();
      if (s && s !== '[DONE]') { try { out.push(JSON.parse(s)); } catch (_) { /* skip */ } }
    }
    return out;
  }
  async rpc(method, params, notification) {
    const id = notification ? undefined : ++this.id;
    const body = { jsonrpc: '2.0', method, params };
    if (!notification) body.id = id;
    const { raw, headers } = await postJson(COCKPIT_MCP, this.headers(), body, { timeout: 90_000 });
    const sid = headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;
    if (notification) return null;
    const msgs = this.parseAll(headers.get('content-type') || '', raw);
    const r = msgs.find((m) => m && m.id === id) || msgs[msgs.length - 1] || {};
    if (r.error) throw new Error(`MCP: ${JSON.stringify(r.error)}`);
    return r.result;
  }
  async init() {
    if (!this.ready) {
      this.ready = (async () => {
        this.sessionId = null;
        this.id = 0;
        await this.rpc('initialize', {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: this.clientName, version: '3.0' },
        });
        await this.rpc('notifications/initialized', {}, true);
      })().catch((err) => { this.ready = null; throw err; });
    }
    return this.ready;
  }
  async call(name, args) {
    await this.init();
    const result = await this.rpc('tools/call', { name, arguments: args });
    if (result && Array.isArray(result.content)) {
      const text = result.content.filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
      try { return JSON.parse(text); } catch (_) { return text; }
    }
    return result;
  }
}

// ── helpers de ambiente / resposta ────────────────────────────────────────────
function ekyteFromEnv(clientName) {
  return new Ekyte(process.env.EKYTE_MCP_TOKEN, clientName);
}
function cockpitFromEnv(clientName) {
  return new Cockpit(process.env.MCP_COCKPIT_JWT, process.env.MCP_GATEWAY_TOKEN, clientName);
}

// Guard de senha + no-store. Devolve true quando a requisição pode seguir.
function guard(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const appKey = String(req.headers['x-app-key'] || '');
  if (!process.env.APP_PASSWORD || appKey !== process.env.APP_PASSWORD) {
    res.status(401).send(JSON.stringify({ ok: false, error: 'Senha inválida.' }));
    return false;
  }
  return true;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 0 }, worker));
  return out;
}

module.exports = {
  Ekyte, Cockpit, ekyteFromEnv, cockpitFromEnv, guard, mapLimit,
  asList, toolResult, parseBody, pagingOf,
  EKYTE_TASK_URL, EKYTE_SQUAD_BILLIONS,
};

// ── cache em memória entre invocações quentes da mesma instância ──────────────
const _cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = _cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.value;
  const value = await fn();
  _cache.set(key, { at: now, value });
  return value;
}
module.exports.cached = cached;
