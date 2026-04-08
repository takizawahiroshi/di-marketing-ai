/**
 * DI Marketing AI — フロントエンド
 * バックエンド (FastAPI) と SSE で通信する。APIキーはフロントに持たない。
 */

// 同一オリジン配信（http://localhost:8000）から相対パスで呼ぶ
const API_BASE = '';

// ── カテゴリ定義 ──────────────────────────────────────────────
const CATS = {
  research: { color: '#0A6E6E', light: '#E0F2F1' },
  strategy: { color: '#C8321A', light: '#FDF0ED' },
  creative: { color: '#B45309', light: '#FFFBEB' },
  media:    { color: '#4338CA', light: '#EEF2FF' },
};

const HINTS = [
  '新商品のコンセプトとキャッチコピーを作りたい',
  '売上停滞の原因を調査して改善策を提案してほしい',
  '競合との差別化戦略を一から考えたい',
  'ターゲットへの広告プランを組みたい',
];

// ── アプリ状態 ─────────────────────────────────────────────────
const S = {
  mode: 'orch',
  agents: [],          // /api/agents から取得
  agent: null,         // 現在チャット中のエージェント
  agentMsgs: [],
  running: false,
  ctx: { survey: '', persona: '', brief: '' },
  tasks: [],           // タスク履歴
  currentTaskId: null,
};

// ── 起動処理 ──────────────────────────────────────────────────
async function init() {
  loadCtxFromStorage();
  renderHintChips();
  await loadAgents();
  checkHealth();
}

async function loadAgents() {
  try {
    const res = await fetch(`${API_BASE}/api/agents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    S.agents = data.agents || [];
    renderAgentNav();
    renderAgentCards();
  } catch (e) {
    console.warn('エージェント一覧の取得に失敗:', e.message);
  }
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    const dot = document.getElementById('api-dot');
    const txt = document.getElementById('api-txt');
    if (data.status === 'ok' && data.api_key_configured) {
      dot.className = 'status-dot ok';
      txt.textContent = `connected · ${data.agents} agents`;
    } else if (data.status === 'ok') {
      dot.className = 'status-dot err';
      txt.textContent = 'api key not set';
    }
  } catch {
    const dot = document.getElementById('api-dot');
    const txt = document.getElementById('api-txt');
    dot.className = 'status-dot err';
    txt.textContent = 'server offline';
  }
}

// ── モード切替 ────────────────────────────────────────────────
function setMode(mode) {
  S.mode = mode;
  document.getElementById('tab-orch').classList.toggle('active', mode === 'orch');
  document.getElementById('tab-agents').classList.toggle('active', mode === 'agents');
  document.getElementById('view-orch').style.display = mode === 'orch' ? 'flex' : 'none';
  document.getElementById('view-agents').style.display = mode === 'agents' ? 'flex' : 'none';
  document.getElementById('view-chat').style.display = 'none';
  document.getElementById('ln-orch-content').style.display = mode === 'orch' ? 'flex' : 'none';
  document.getElementById('ln-agents-content').style.display = mode === 'agents' ? 'flex' : 'none';
}

// ── コンテキスト管理 ──────────────────────────────────────────
function loadCtxFromStorage() {
  try {
    const saved = sessionStorage.getItem('di_ctx');
    if (saved) S.ctx = JSON.parse(saved);
  } catch {}
  updateCtxStatus();
  // モーダルのテキストエリアに反映
  const si = document.getElementById('ctx-survey-in');
  const pi = document.getElementById('ctx-persona-in');
  const bi = document.getElementById('ctx-brief-in');
  if (si) si.value = S.ctx.survey || '';
  if (pi) pi.value = S.ctx.persona || '';
  if (bi) bi.value = S.ctx.brief || '';
}

function saveCtx() {
  S.ctx.survey  = document.getElementById('ctx-survey-in').value.trim();
  S.ctx.persona = document.getElementById('ctx-persona-in').value.trim();
  S.ctx.brief   = document.getElementById('ctx-brief-in').value.trim();
  sessionStorage.setItem('di_ctx', JSON.stringify(S.ctx));
  updateCtxStatus();
  closeModal('ctx-modal');
  showToast('コンテキストを保存しました');
}

function updateCtxStatus() {
  const fields = ['survey', 'persona', 'brief'];
  fields.forEach(f => {
    const dot = document.getElementById(`cdot-${f}`);
    const val = document.getElementById(`cval-${f}`);
    if (!dot || !val) return;
    const v = S.ctx[f] || '';
    dot.classList.toggle('set', v.length > 0);
    val.textContent = v ? `${v.length}字` : '—';
  });
}

// ── モーダル ──────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
window.openModal = openModal;
window.closeModal = closeModal;
window.saveCtx = saveCtx;

// ── ヒントチップ ──────────────────────────────────────────────
function renderHintChips() {
  const container = document.getElementById('hint-chips');
  if (!container) return;
  container.innerHTML = HINTS.map(h =>
    `<button class="hint-chip" onclick="fillTask(this.textContent)">${h}</button>`
  ).join('');
}

function fillTask(text) {
  const ti = document.getElementById('task-input');
  if (ti) { ti.value = text; ti.focus(); }
}
window.fillTask = fillTask;

// ── エージェントナビ & カード ─────────────────────────────────
function renderAgentNav() {
  const container = document.getElementById('nav-agents-list');
  if (!container) return;
  const grouped = groupByCategory(S.agents);
  container.innerHTML = Object.entries(grouped).map(([cat, agents]) => `
    <div class="ln-cat-wrap">
      <button class="ln-item" style="font-weight:600;color:${CATS[cat]?.color||'#333'}" onclick="scrollToCat('${cat}')">
        <span>${catLabel(cat)}</span>
      </button>
      ${agents.map(a => `
        <button class="ln-item ln-sub-item" onclick="openAgent('${a.id}')">
          <span class="ln-icon">${a.icon}</span>${a.name}
        </button>
      `).join('')}
    </div>
  `).join('');
}

function renderAgentCards() {
  const container = document.getElementById('cards-container');
  if (!container) return;
  const grouped = groupByCategory(S.agents);
  container.innerHTML = Object.entries(grouped).map(([cat, agents]) => `
    <div class="cat-section" id="cat-${cat}">
      <div class="cat-header">
        <div class="cat-bar" style="background:${CATS[cat]?.color||'#333'}"></div>
        <span class="cat-title">${catLabel(cat)}</span>
        <span class="cat-count">${agents.length}</span>
      </div>
      <div class="cards-grid">
        ${agents.map(a => `
          <div class="acard" onclick="openAgent('${a.id}')">
            <div class="acard-top">
              <div class="acard-icon" style="background:${CATS[cat]?.light||'#eee'}">${a.icon}</div>
              <span class="acard-name">${a.name}</span>
            </div>
            <div class="acard-desc">${a.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function groupByCategory(agents) {
  const order = ['research', 'strategy', 'creative', 'media'];
  const grouped = {};
  order.forEach(c => { grouped[c] = []; });
  agents.forEach(a => {
    if (!grouped[a.cat]) grouped[a.cat] = [];
    grouped[a.cat].push(a);
  });
  return grouped;
}

function catLabel(cat) {
  return { research: 'RESEARCH', strategy: 'STRATEGY', creative: 'CREATIVE', media: 'MEDIA' }[cat] || cat.toUpperCase();
}

function scrollToCat(cat) {
  document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth' });
}
window.scrollToCat = scrollToCat;

// ── エージェントチャット ──────────────────────────────────────
function openAgent(id) {
  const agent = S.agents.find(a => a.id === id);
  if (!agent) return;
  S.agent = agent;
  S.agentMsgs = [];
  document.getElementById('view-agents').style.display = 'none';
  document.getElementById('view-chat').style.display = 'flex';
  document.getElementById('chat-icon').textContent = agent.icon;
  document.getElementById('chat-name').textContent = agent.name;
  document.getElementById('chat-cat').textContent = catLabel(agent.cat);
  document.getElementById('msgs').innerHTML = '';
  appendAiMsg(`${agent.icon} **${agent.name}** です。\n\n${agent.desc}\n\nどんなことでもご相談ください。`, true);
  document.getElementById('ci').focus();
}

function showAgentsView() {
  document.getElementById('view-chat').style.display = 'none';
  document.getElementById('view-agents').style.display = 'flex';
}

async function sendMsg() {
  if (!S.agent || S.running) return;
  const ci = document.getElementById('ci');
  const text = ci.value.trim();
  if (!text) return;
  ci.value = '';
  ci.style.height = 'auto';

  appendUserMsg(text);
  S.agentMsgs.push({ role: 'user', content: text });

  S.running = true;
  document.getElementById('send-btn').disabled = true;
  const thinkingEl = appendThinking();

  try {
    const res = await fetch(`${API_BASE}/api/agents/${S.agent.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: S.agentMsgs, context: S.ctx }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    thinkingEl.remove();
    const reply = data.reply || '(応答なし)';
    S.agentMsgs.push({ role: 'assistant', content: reply });
    appendAiMsg(reply);
  } catch (e) {
    thinkingEl.remove();
    appendAiMsg(`⚠️ エラーが発生しました: ${e.message}\n\nサーバーが起動しているか確認してください。`);
  } finally {
    S.running = false;
    document.getElementById('send-btn').disabled = false;
    ci.focus();
  }
}

window.sendMsg = sendMsg;
window.showAgentsView = showAgentsView;
window.openAgent = openAgent;
window.setMode = setMode;

// ── メッセージ描画 ────────────────────────────────────────────
function appendUserMsg(text) {
  const msgs = document.getElementById('msgs');
  const el = document.createElement('div');
  el.className = 'msg-user';
  el.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendAiMsg(text, isWelcome = false) {
  const msgs = document.getElementById('msgs');
  const el = document.createElement('div');
  el.className = 'msg-ai';
  el.innerHTML = `<div class="msg-bubble">${renderMarkdown(text)}</div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

function appendThinking() {
  const msgs = document.getElementById('msgs');
  const el = document.createElement('div');
  el.className = 'msg-ai';
  el.innerHTML = `<div class="msg-thinking"><span>考え中</span><span class="dots"><span></span><span></span><span></span></span></div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

// ── オーケストレーター ─────────────────────────────────────────
async function runOrchestrator() {
  const ti = document.getElementById('task-input');
  const goal = (ti?.value || '').trim();
  if (!goal) { showToast('課題を入力してください'); return; }
  await _executeOrchestrator(goal);
}

async function runOrchestratorBottom() {
  const ti = document.getElementById('task-input-bottom');
  const goal = (ti?.value || '').trim();
  if (!goal) return;
  ti.value = '';
  await _executeOrchestrator(goal);
}

window.runOrchestrator = runOrchestrator;
window.runOrchestratorBottom = runOrchestratorBottom;

async function _executeOrchestrator(goal) {
  if (S.running) return;
  S.running = true;

  // ランディング → 実行エリアへ切替
  document.getElementById('orch-landing').style.display = 'none';
  document.getElementById('exec-area').style.display = 'flex';
  document.getElementById('exec-area').style.flexDirection = 'column';
  document.getElementById('input-zone').style.display = 'block';
  document.getElementById('run-btn').disabled = true;
  document.getElementById('run-btn-bottom').disabled = true;

  // 実行コンテンツをリセット
  const execContent = document.getElementById('exec-content');
  execContent.innerHTML = '';

  // タスクヘッダー
  const taskHeader = document.createElement('div');
  taskHeader.className = 'task-header';
  taskHeader.innerHTML = `
    <div class="task-goal">${escapeHtml(goal)}</div>
    <div class="task-meta">
      <span class="task-status-badge planning" id="task-badge">⏳ プランニング中...</span>
    </div>`;
  execContent.appendChild(taskHeader);

  // プランブロック
  const planBlock = document.createElement('div');
  planBlock.className = 'plan-block';
  planBlock.innerHTML = `<div class="plan-title">AGENT PIPELINE</div><div class="plan-steps" id="plan-steps-row"></div><div class="plan-reason" id="plan-reason"></div>`;
  execContent.appendChild(planBlock);

  // エージェント出力コンテナ
  const agentOutputs = document.createElement('div');
  agentOutputs.id = 'agent-outputs';
  execContent.appendChild(agentOutputs);

  // 最終出力コンテナ
  const finalOutput = document.createElement('div');
  finalOutput.className = 'final-output';
  finalOutput.style.display = 'none';
  finalOutput.innerHTML = `
    <div class="fo-header">
      <span class="fo-label">📋 統合アウトプット</span>
      <button class="export-btn" onclick="exportMarkdown()">↓ export</button>
    </div>
    <div class="fo-body" id="fo-body"></div>`;
  execContent.appendChild(finalOutput);

  // タスク履歴に追加
  const taskId = 'task_' + Date.now();
  S.currentTaskId = taskId;
  const taskRecord = { id: taskId, goal, agents: [], synthesis: '', ts: Date.now() };
  S.tasks.unshift(taskRecord);
  renderTaskHistory();

  // SSE 開始
  try {
    await _streamPipeline(goal, taskRecord, planBlock, agentOutputs, finalOutput);
  } catch (e) {
    setBadge('error', '❌ エラー');
    showToast(`エラー: ${e.message}`);
  } finally {
    S.running = false;
    document.getElementById('run-btn').disabled = false;
    document.getElementById('run-btn-bottom').disabled = false;
  }
}

async function _streamPipeline(goal, taskRecord, planBlock, agentOutputs, finalOutput) {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, context: S.ctx }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  const agentTextMap = {};  // agent_id → 蓄積テキスト

  function pump() {
    return reader.read().then(({ done, value }) => {
      if (done) return;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          handleSSEEvent(event, taskRecord, planBlock, agentOutputs, finalOutput, agentTextMap);
        } catch {}
      }
      return pump();
    });
  }
  await pump();
}

function handleSSEEvent(event, taskRecord, planBlock, agentOutputs, finalOutput, agentTextMap) {
  const { type, data } = event;
  switch (type) {
    case 'planning':
      setBadge('planning', '⏳ プランニング中...');
      break;

    case 'plan': {
      taskRecord.agents = data.agents;
      setBadge('running', '▶ 実行中');
      const stepsRow = document.getElementById('plan-steps-row');
      const reasonEl = document.getElementById('plan-reason');
      if (stepsRow) {
        stepsRow.innerHTML = data.agents.map((id, i) => {
          const agent = S.agents.find(a => a.id === id);
          return [
            i > 0 ? '<span class="plan-arrow">→</span>' : '',
            `<span class="plan-step" id="ps-${id}">`,
            agent ? agent.icon : '🤖',
            ` ${agent ? agent.name : id}`,
            '</span>',
          ].join('');
        }).join('');
      }
      if (reasonEl) reasonEl.textContent = data.reason;
      break;
    }

    case 'agent_start': {
      document.getElementById(`ps-${data.id}`)?.classList.add('running');
      const agent = S.agents.find(a => a.id === data.id);
      agentTextMap[data.id] = '';
      const div = document.createElement('div');
      div.className = 'agent-output';
      div.id = `ao-${data.id}`;
      div.innerHTML = `
        <div class="ao-header">
          <span class="ao-num">0${data.num}</span>
          <span class="ao-icon">${agent?.icon || '🤖'}</span>
          <span class="ao-name">${agent?.name || data.id}</span>
          <span class="ao-status running" id="aos-${data.id}">● 実行中</span>
        </div>
        <div class="ao-body" id="aob-${data.id}"></div>`;
      agentOutputs.appendChild(div);
      agentOutputs.scrollTop = agentOutputs.scrollHeight;
      break;
    }

    case 'token': {
      agentTextMap[data.agent_id] = (agentTextMap[data.agent_id] || '') + data.text;
      const body = document.getElementById(`aob-${data.agent_id}`);
      if (body) {
        body.innerHTML = renderMarkdown(agentTextMap[data.agent_id]);
        body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      break;
    }

    case 'agent_done': {
      const ps = document.getElementById(`ps-${data.id}`);
      if (ps) { ps.classList.remove('running'); ps.classList.add('done'); }
      const status = document.getElementById(`aos-${data.id}`);
      if (status) { status.className = 'ao-status done'; status.textContent = '✓ 完了'; }
      break;
    }

    case 'compressing': {
      const bi = document.getElementById('baton-indicator');
      if (bi) {
        bi.style.display = 'flex';
        const fromAgent = S.agents.find(a => a.id === data.from);
        const toAgent = S.agents.find(a => a.id === data.to);
        bi.textContent = `🔗 ${fromAgent?.name || data.from} → ${toAgent?.name || data.to} バトン圧縮中...`;
      }
      break;
    }

    case 'baton_ready': {
      const bi = document.getElementById('baton-indicator');
      if (bi) bi.style.display = 'none';
      // 前のエージェント出力にバトン表示
      const prevId = taskRecord.agents[taskRecord.agents.indexOf(data.to) - 1];
      if (prevId) {
        const ao = document.getElementById(`ao-${prevId}`);
        if (ao) {
          const baton = document.createElement('div');
          baton.className = 'ao-baton';
          baton.textContent = `→ ${data.preview}...`;
          ao.appendChild(baton);
        }
      }
      break;
    }

    case 'synth_start':
      setBadge('running', '📋 統合中...');
      finalOutput.style.display = 'block';
      break;

    case 'synth_token': {
      taskRecord.synthesis = (taskRecord.synthesis || '') + data.text;
      const foBody = document.getElementById('fo-body');
      if (foBody) {
        foBody.innerHTML = renderMarkdown(taskRecord.synthesis);
        foBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      break;
    }

    case 'synth_done':
      setBadge('done', '✅ 完了');
      renderTaskHistory();
      break;

    case 'complete':
      S.currentTaskId = data.task_id;
      break;

    case 'error':
      setBadge('error', '❌ エラー');
      showToast(`エラー: ${data.message}`);
      break;
  }
}

function setBadge(cls, text) {
  const badge = document.getElementById('task-badge');
  if (badge) { badge.className = `task-status-badge ${cls}`; badge.textContent = text; }
}

// ── タスク履歴 ────────────────────────────────────────────────
function renderTaskHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (S.tasks.length === 0) {
    list.innerHTML = '<div class="hist-empty">タスクはまだありません。</div>';
    return;
  }
  list.innerHTML = S.tasks.slice(0, 10).map(t => `
    <div class="hist-item ${t.id === S.currentTaskId ? 'active' : ''}">
      <div class="hist-title">${escapeHtml(t.goal.slice(0, 40))}</div>
      <div class="hist-meta">${t.agents.join(' → ')}</div>
    </div>
  `).join('');
}

// ── エクスポート ──────────────────────────────────────────────
function exportMarkdown() {
  const task = S.tasks[0];
  if (!task) return;
  const md = [
    `# ${task.goal}`,
    '',
    `エージェント: ${task.agents.join(' → ')}`,
    '',
    '## 統合アウトプット',
    '',
    task.synthesis || '(なし)',
  ].join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `di-output-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
window.exportMarkdown = exportMarkdown;

// ── ユーティリティ ────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('fs-toast');
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(8px)';
  }, 2500);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`)
    .replace(/<p><\/p>/g, '');
}

function toggleMenu() {
  const left = document.getElementById('left');
  left?.classList.toggle('open');
}
window.toggleMenu = toggleMenu;

// Ctrl+Enter / Cmd+Enter でチャット送信
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const ci = document.getElementById('ci');
    if (document.activeElement === ci) sendMsg();
  }
});

// ── 起動 ──────────────────────────────────────────────────────
init();
