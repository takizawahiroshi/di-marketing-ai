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

// ── テンプレートライブラリ ─────────────────────────────────────
const TEMPLATE_CATS = [
  { id: 'all',      label: 'ALL',      color: '#555555' },
  { id: 'research', label: 'RESEARCH', color: '#0A6E6E' },
  { id: 'strategy', label: 'STRATEGY', color: '#C8321A' },
  { id: 'creative', label: 'CREATIVE', color: '#B45309' },
  { id: 'media',    label: 'MEDIA',    color: '#4338CA' },
  { id: 'custom',   label: 'MY TEMPLATES', color: '#7C3AED' },
];

const TEMPLATES = [
  // ── RESEARCH ──────────────────────────────────────────────────
  {
    id: 'r1', cat: 'research', title: '新商品コンセプトリサーチ',
    text: '新商品のターゲット像・潜在ニーズ・市場機会をDIのリサーチフレームワークで深掘りし、コンセプト仮説を3〜5案作りたい',
  },
  {
    id: 'r2', cat: 'research', title: '顧客インサイト発掘',
    text: '既存顧客の購買動機・解約理由・使用状況をペルソナ軸でまとめ、本音ベースのインサイトと改善示唆を抽出したい',
  },
  {
    id: 'r3', cat: 'research', title: '競合ベンチマーク分析',
    text: '主要競合3〜5社のポジショニング・訴求軸・メディア戦略を比較分析し、自社の差別化機会と優位性を特定したい',
  },
  {
    id: 'r4', cat: 'research', title: 'BtoBバイヤー調査',
    text: 'BtoBバイヤーの意思決定プロセス・評価基準・情報収集経路を分析し、購買ファネル別の最適アプローチを設計したい',
  },
  {
    id: 'r5', cat: 'research', title: 'ブランドパーセプション診断',
    text: '自社ブランドに対する消費者認知・感情・連想ワードを把握し、ブランド健全性とポジショニングギャップを診断したい',
  },
  {
    id: 'r6', cat: 'research', title: 'トレンド・マクロ環境分析',
    text: '業界の直近トレンドとマクロ環境変化（PEST）がマーケティング戦略に与える影響を分析し、機会と脅威を整理したい',
  },

  // ── STRATEGY ─────────────────────────────────────────────────
  {
    id: 's1', cat: 'strategy', title: 'CVR改善診断',
    text: 'ECサイト/LPのCVRが目標を下回っている。原因仮説を構造的に立て、短期即効施策と中長期の改善ロードマップを設計したい',
  },
  {
    id: 's2', cat: 'strategy', title: '新規事業GTM戦略',
    text: '新サービスのGo-to-Market戦略を設計したい。ターゲットセグメント・チャネル選定・価格設定・ローンチシーケンスを含む全体プランを作りたい',
  },
  {
    id: 's3', cat: 'strategy', title: 'ブランドポジショニング設計',
    text: '競合環境を踏まえた差別化ポジションを定め、ブランドプロミス・バリュープロポジション・パーソナリティを言語化したい',
  },
  {
    id: 's4', cat: 'strategy', title: 'カスタマージャーニー設計',
    text: '購買ステージ別のタッチポイント・感情・行動・課題を整理し、各フェーズで最も効果的な介入施策とKPIを設計したい',
  },
  {
    id: 's5', cat: 'strategy', title: '売上停滞打破戦略',
    text: '直近数ヶ月で売上が横ばいになっている。主要因の仮説診断を行い、即効性のある施策と中長期戦略を両軸で提案してほしい',
  },
  {
    id: 's6', cat: 'strategy', title: 'LTV最大化戦略',
    text: '既存顧客のLTV（顧客生涯価値）を向上させるため、リテンション強化・アップセル・クロスセル・紹介施策を体系的に設計したい',
  },
  {
    id: 's7', cat: 'strategy', title: '新カテゴリ参入評価',
    text: '新カテゴリへの参入を検討中。市場規模・競合環境・自社シナジーを評価し、参入可否の判断基準と参入時の戦略オプションを提言してほしい',
  },

  // ── CREATIVE ─────────────────────────────────────────────────
  {
    id: 'c1', cat: 'creative', title: 'キャッチコピー開発',
    text: '商品・ブランドのターゲットと強みに基づいたキャッチコピーを10案以上作り、各コピーの訴求意図とターゲット感情を説明してほしい',
  },
  {
    id: 'c2', cat: 'creative', title: 'LP企画・構成設計',
    text: '新商品のランディングページ構成をリサーチに基づいて設計したい。ファーストビュー〜CTA・各セクションのコピー方針と訴求順序を作りたい',
  },
  {
    id: 'c3', cat: 'creative', title: 'コンテンツマーケティング企画',
    text: 'ターゲット向けのオウンドメディアコンテンツ企画を30本立案し、SEO・SNS連携の全体戦略と優先度マップを作りたい',
  },
  {
    id: 'c4', cat: 'creative', title: 'ブランドストーリー構築',
    text: '創業背景・商品哲学・社会的意義をつなぐブランドナラティブを構築し、各媒体（Web/SNS/PR）での展開シナリオを設計したい',
  },
  {
    id: 'c5', cat: 'creative', title: 'SNSクリエイティブ戦略',
    text: 'ブランド・商品のInstagram/X運用における投稿テーマ軸・トーン&マナー・月次カレンダー・エンゲージメント施策を設計したい',
  },
  {
    id: 'c6', cat: 'creative', title: 'CRM・メールシナリオ設計',
    text: '新規登録〜リピート購入までのメール/LINEシナリオを設計したい。各ステージのトリガー条件・配信タイミング・コピー方針を含む',
  },

  // ── MEDIA ────────────────────────────────────────────────────
  {
    id: 'm1', cat: 'media', title: 'デジタル広告プラン設計',
    text: 'KPI達成に向けたSearch/Display/SNS広告の予算配分・ターゲティング戦略・クリエイティブ方針・入札戦略を一括で策定したい',
  },
  {
    id: 'm2', cat: 'media', title: 'SNS×ペイド統合プラン',
    text: 'オーガニックSNSとペイドメディアを連動させた統合メディアプランを作りたい。KPI・予算・スケジュール・役割分担を含む',
  },
  {
    id: 'm3', cat: 'media', title: '新商品ローンチ統合プラン',
    text: '発売前・発売当月・発売後3ヶ月の統合コミュニケーションスケジュールとメディアミックス戦略を設計したい',
  },
  {
    id: 'm4', cat: 'media', title: '広告予算最適化診断',
    text: '現在の広告/メディア予算配分の課題を診断し、ROI最大化に向けた再配分シナリオとA/Bテスト計画を提案してほしい',
  },
  {
    id: 'm5', cat: 'media', title: 'インフルエンサー活用戦略',
    text: 'ブランド・商品のインフルエンサーマーケティング戦略を策定したい。選定基準・起用形態・KPI設計・契約留意事項を含む',
  },
  {
    id: 'm6', cat: 'media', title: '年間マーケティングカレンダー',
    text: '来年の販促・イベント・コンテンツ・広告を統合した年間マーケティングカレンダーを作りたい。季節要因と予算配分も含める',
  },
];

// HINTS は後方互換（hint-chips + starter-cards 用）
const HINTS = TEMPLATES.filter(t => [
  'r1','s1','s2','c1','m1','s4'
].includes(t.id)).map(t => t.text);

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
  personas: [],        // /api/personas から取得したプリセット
  lastGoal: '',        // 最後に実行した課題（プラン介入再実行用）
  lastPlan: null,      // 最後に展開したプラン { agents, reason }
};

// ── 起動処理 ──────────────────────────────────────────────────
async function init() {
  loadCtxFromStorage();
  renderHintChips();
  renderStarterCards();
  await loadAgents();
  loadPersonaPresets();
  loadTaskHistoryFromServer();
  checkHealth();
}

// ── ペルソナプリセット ────────────────────────────────────────
async function loadPersonaPresets() {
  try {
    const res = await fetch(`${API_BASE}/api/personas`);
    if (!res.ok) return;
    const data = await res.json();
    S.personas = data.personas || [];
    const sel = document.getElementById('persona-select');
    if (!sel) return;
    // 先頭のプレースホルダを維持
    sel.innerHTML = '<option value="">— サンプルペルソナから選択 / 自由入力 —</option>'
      + S.personas.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`).join('');
  } catch (e) {
    console.warn('persona load failed:', e.message);
  }
}

function formatPersonaText(p) {
  const lines = [];
  lines.push(`${p.label}（${p.age}歳）`);
  if (p.occupation) lines.push(`職業: ${p.occupation}`);
  if (p.household) lines.push(`世帯: ${p.household}`);
  if (p.income) lines.push(`収入: ${p.income}`);
  if (Array.isArray(p.values) && p.values.length) lines.push(`価値観: ${p.values.join(' / ')}`);
  if (Array.isArray(p.media) && p.media.length) lines.push(`メディア接触: ${p.media.join(' / ')}`);
  if (Array.isArray(p.pain_points) && p.pain_points.length) {
    lines.push('痛み・課題:');
    p.pain_points.forEach(x => lines.push(`  - ${x}`));
  }
  if (Array.isArray(p.purchase_triggers) && p.purchase_triggers.length) {
    lines.push('購入トリガー:');
    p.purchase_triggers.forEach(x => lines.push(`  - ${x}`));
  }
  if (p.quote) lines.push(`本音: 「${p.quote}」`);
  return lines.join('\n');
}

function applyPersonaPreset(id) {
  if (!id) return;
  const p = (S.personas || []).find(x => x.id === id);
  if (!p) return;
  const ta = document.getElementById('ctx-persona-in');
  if (!ta) return;
  const text = formatPersonaText(p);
  ta.value = ta.value.trim() ? ta.value.trim() + '\n\n---\n\n' + text : text;
  showToast(`ペルソナ「${p.label}」を追加しました`);
}
window.applyPersonaPreset = applyPersonaPreset;

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
  document.getElementById('tab-exp')?.classList.toggle('active', mode === 'exp');
  document.getElementById('view-orch').style.display = mode === 'orch' ? 'flex' : 'none';
  document.getElementById('view-agents').style.display = mode === 'agents' ? 'flex' : 'none';
  document.getElementById('view-exp').style.display = mode === 'exp' ? 'flex' : 'none';
  document.getElementById('view-chat').style.display = 'none';
  document.getElementById('ln-orch-content').style.display = mode === 'orch' ? 'flex' : 'none';
  document.getElementById('ln-agents-content').style.display = mode === 'agents' ? 'flex' : 'none';
  if (mode === 'exp' && document.getElementById('exp-variants')?.children.length === 0) {
    addExpVariant(); addExpVariant();
  }
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

// スターターカード — HINTS をカテゴリ推定して richer なカードで描画
const _STARTER_CAT = [
  { key: 'research', label: 'RESEARCH', color: '#0A6E6E', icon: '🔍', rx: /(調査|リサーチ|インタビュー|座談|本音|ペルソナ)/ },
  { key: 'strategy', label: 'STRATEGY', color: '#C8321A', icon: '🗺', rx: /(戦略|企画|ポジショニング|ジャーニー|原因|分析)/ },
  { key: 'creative', label: 'CREATIVE', color: '#B45309', icon: '✍️', rx: /(コンセプト|コピー|アイデア|施策|コンテンツ|CVR)/ },
  { key: 'media',    label: 'MEDIA',    color: '#4338CA', icon: '📺', rx: /(メディア|SNS|広告|デジタル|配信)/ },
];

function _classifyHint(text) {
  for (const c of _STARTER_CAT) if (c.rx.test(text)) return c;
  return _STARTER_CAT[1]; // default: strategy
}

function renderStarterCards() {
  const container = document.getElementById('starter-cards');
  if (!container) return;
  container.innerHTML = HINTS.map(h => {
    const c = _classifyHint(h);
    return `
      <button type="button" class="starter-card" data-cat="${c.key}" onclick="fillTask(this.dataset.text)" data-text="${escapeHtml(h)}">
        <span class="starter-card-head">
          <span class="starter-card-icon" style="background:${c.color}22;color:${c.color};">${c.icon}</span>
          <span class="starter-card-cat" style="color:${c.color};">${c.label}</span>
        </span>
        <span class="starter-card-body">${escapeHtml(h)}</span>
        <span class="starter-card-arrow" aria-hidden="true">→</span>
      </button>`;
  }).join('');
}
window.renderStarterCards = renderStarterCards;

// ── プラン介入（エージェント列を手動編集して再実行） ────────
function openPlanEditor() {
  if (S.running) { showToast('実行中はプランを編集できません'); return; }
  const currentAgents = (S.lastPlan?.agents || []).slice();
  const list = document.getElementById('plan-edit-list');
  const available = document.getElementById('plan-edit-available');
  if (!list || !available) return;

  // 現在の列
  list.innerHTML = currentAgents.map((id, i) => {
    const a = S.agents.find(x => x.id === id);
    return `
      <div class="plan-edit-item" data-id="${escapeHtml(id)}" data-idx="${i}">
        <span class="plan-edit-icon">${a?.icon || '🤖'}</span>
        <span class="plan-edit-name">${escapeHtml(a?.name || id)}</span>
        <span class="plan-edit-order">${i + 1}</span>
        <button type="button" class="plan-edit-up" onclick="movePlanAgent(${i}, -1)" aria-label="上へ">↑</button>
        <button type="button" class="plan-edit-down" onclick="movePlanAgent(${i}, 1)" aria-label="下へ">↓</button>
        <button type="button" class="plan-edit-rm" onclick="removePlanAgent('${escapeHtml(id)}')" aria-label="削除">✕</button>
      </div>`;
  }).join('') || '<div class="plan-edit-empty">エージェントが選択されていません</div>';

  // 追加候補（現在の列にいないもの）
  available.innerHTML = S.agents
    .filter(a => !currentAgents.includes(a.id))
    .map(a => `<button type="button" class="plan-edit-add" onclick="addPlanAgent('${escapeHtml(a.id)}')">
        <span>${a.icon}</span> ${escapeHtml(a.name)}
      </button>`).join('');

  openModal('plan-edit-modal');
}
window.openPlanEditor = openPlanEditor;

function addPlanAgent(id) {
  if (!S.lastPlan) S.lastPlan = { agents: [], reason: '手動編集' };
  if (!S.lastPlan.agents.includes(id)) S.lastPlan.agents.push(id);
  openPlanEditor(); // 再描画
}
window.addPlanAgent = addPlanAgent;

function removePlanAgent(id) {
  if (!S.lastPlan) return;
  S.lastPlan.agents = S.lastPlan.agents.filter(a => a !== id);
  openPlanEditor();
}
window.removePlanAgent = removePlanAgent;

function movePlanAgent(idx, dir) {
  if (!S.lastPlan) return;
  const arr = S.lastPlan.agents;
  const j = idx + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[idx], arr[j]] = [arr[j], arr[idx]];
  openPlanEditor();
}
window.movePlanAgent = movePlanAgent;

function rerunWithEditedPlan() {
  if (!S.lastPlan || !S.lastPlan.agents.length) { showToast('エージェントを 1 つ以上選択してください'); return; }
  if (!S.lastGoal) { showToast('課題が取得できません'); return; }
  closeModal('plan-edit-modal');
  _executeOrchestrator(S.lastGoal, S.lastPlan.agents);
}
window.rerunWithEditedPlan = rerunWithEditedPlan;

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
          <span class="ln-icon">${a.icon}</span>${escapeHtml(a.name)}
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
              <span class="acard-name">${escapeHtml(a.name)}</span>
            </div>
            <div class="acard-desc">${escapeHtml(a.desc)}</div>
            ${a.starters && a.starters.length ? `<div class="acard-examples"><div class="acard-examples-label">使い方の例</div>${a.starters.map(s => `<div class="acard-example">${escapeHtml(s)}</div>`).join('')}</div>` : ''}
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
  const starterHtml = agent.starters && agent.starters.length
    ? '\n\n**使い方の例：**\n' + agent.starters.map(s => `- ${s}`).join('\n')
    : '';
  appendAiMsg(`${agent.icon} **${agent.name}** です。\n\n${agent.desc}${starterHtml}\n\nどんなことでもご相談ください。`, true);
  if (agent.starters && agent.starters.length) {
    const msgsEl = document.getElementById('msgs');
    const chips = document.createElement('div');
    chips.className = 'chat-starters';
    agent.starters.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'chat-starter-chip';
      btn.textContent = s;
      btn.onclick = () => { document.getElementById('ci').value = s; chips.remove(); sendMsg(); };
      chips.appendChild(btn);
    });
    msgsEl.appendChild(chips);
  }
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
  let shouldOpenSettings = false;
  let aiEl = null;      // ストリーミング開始時に生成する吹き出し要素
  let bubble = null;    // aiEl 内の .msg-bubble
  let accumulated = ''; // 累積テキスト（renderMarkdown の都度描画用）

  try {
    const res = await fetch(`${API_BASE}/api/agents/${S.agent.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: S.agentMsgs, context: S.ctx }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 403) {
        appendAiMsg(`⚠️ ${err.detail || 'APIキーが未設定です。'}\n\n右上の「⚙ 設定」からAPIキーを登録してください。`);
        shouldOpenSettings = true;
        return;
      }
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    // ── SSE 読み取り ───────────────────────────────────────
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let errMsg = '';

    const ensureBubble = () => {
      if (aiEl) return;
      thinkingEl.remove();
      aiEl = document.createElement('div');
      aiEl.className = 'msg-ai';
      bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      aiEl.appendChild(bubble);
      document.getElementById('msgs').appendChild(aiEl);
    };

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === 'token') {
          ensureBubble();
          accumulated += evt.data?.text || '';
          bubble.innerHTML = renderMarkdown(accumulated);
          const msgs = document.getElementById('msgs');
          msgs.scrollTop = msgs.scrollHeight;
        } else if (evt.type === 'error') {
          errMsg = evt.data?.message || 'unknown error';
          break outer;
        } else if (evt.type === 'done') {
          break outer;
        }
      }
    }

    if (errMsg) {
      ensureBubble();
      bubble.innerHTML = renderMarkdown((accumulated ? accumulated + '\n\n' : '') + `⚠️ ${errMsg}`);
      // エラーもコピペできるようボタンを付与
      _attachCopyBtn(bubble, errMsg);
      throw new Error('skip-handled');
    }

    if (accumulated) {
      _attachCopyBtn(bubble, accumulated);
      S.agentMsgs.push({ role: 'assistant', content: accumulated });
    } else if (aiEl === null) {
      // トークンが 1 個も来ず done だけ来たケース
      appendAiMsg('(応答なし)');
    }
  } catch (e) {
    if (e.message !== 'skip-handled') {
      thinkingEl.remove();
      appendAiMsg(`⚠️ エラーが発生しました: ${e.message}\n\nサーバーが起動しているか確認してください。`);
    }
  } finally {
    if (thinkingEl.isConnected) thinkingEl.remove();
    S.running = false;
    document.getElementById('send-btn').disabled = false;
    ci.focus();
    if (shouldOpenSettings && typeof openSettings === 'function') openSettings();
  }
}

window.sendMsg = sendMsg;
window.showAgentsView = showAgentsView;
window.openAgent = openAgent;
window.setMode = setMode;

// ── メッセージ描画 ────────────────────────────────────────────
function _attachCopyBtn(bubble, rawText) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn msg-copy-btn';
  btn.textContent = '📋';
  btn.title = 'コピー';
  btn.onclick = (e) => { e.stopPropagation(); copyText(rawText, btn); };
  bubble.appendChild(btn);
}

function appendUserMsg(text) {
  const msgs = document.getElementById('msgs');
  const el = document.createElement('div');
  el.className = 'msg-user';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = escapeHtml(text);
  _attachCopyBtn(bubble, text);
  el.appendChild(bubble);
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendAiMsg(text, isWelcome = false) {
  const msgs = document.getElementById('msgs');
  const el = document.createElement('div');
  el.className = 'msg-ai';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = renderMarkdown(text);
  _attachCopyBtn(bubble, text);
  el.appendChild(bubble);
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

// ── EXPERIMENT モード ─────────────────────────────────────────
let _expSeq = 0;
function addExpVariant() {
  _expSeq += 1;
  const id = 'v' + _expSeq;
  const wrap = document.getElementById('exp-variants');
  if (!wrap) return;
  const personaOptions = '<option value="">— 自由入力 / プリセットなし —</option>'
    + (S.personas || []).map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`).join('');
  const box = document.createElement('div');
  box.className = 'exp-variant';
  box.dataset.vid = id;
  box.innerHTML = `
    <div class="exp-variant-head">
      <span class="exp-variant-title">${id}</span>
      <button type="button" class="exp-del-btn" onclick="removeExpVariant('${id}')" aria-label="削除">✕</button>
    </div>
    <label class="exp-sublabel">ペルソナプリセット</label>
    <select class="exp-persona-sel" onchange="applyExpPersonaToVariant('${id}', this.value)">${personaOptions}</select>
    <label class="exp-sublabel">ペルソナ（自由入力可）</label>
    <textarea class="exp-persona-ta" data-field="persona" rows="4" placeholder="田中美咲（32歳・会社員）…"></textarea>
    <label class="exp-sublabel">調査データ / ブリーフ（任意）</label>
    <textarea class="exp-brief-ta" data-field="brief" rows="2" placeholder="案件背景や既存の調査結果があれば…"></textarea>`;
  wrap.appendChild(box);
}
window.addExpVariant = addExpVariant;

function removeExpVariant(id) {
  const el = document.querySelector(`.exp-variant[data-vid="${id}"]`);
  if (el) el.remove();
}
window.removeExpVariant = removeExpVariant;

function applyExpPersonaToVariant(vid, personaId) {
  const box = document.querySelector(`.exp-variant[data-vid="${vid}"]`);
  if (!box || !personaId) return;
  const p = (S.personas || []).find(x => x.id === personaId);
  if (!p) return;
  const ta = box.querySelector('.exp-persona-ta');
  if (ta) ta.value = formatPersonaText(p);
}
window.applyExpPersonaToVariant = applyExpPersonaToVariant;

async function runExperiment() {
  const goal = (document.getElementById('exp-goal')?.value || '').trim();
  if (!goal) { showToast('課題を入力してください'); return; }
  const variantEls = [...document.querySelectorAll('.exp-variant')];
  if (variantEls.length < 2) { showToast('バリアントを 2 つ以上追加してください'); return; }
  const contexts = variantEls.map(v => ({
    persona: v.querySelector('[data-field="persona"]')?.value.trim() || '',
    brief:   v.querySelector('[data-field="brief"]')?.value.trim() || '',
    survey:  '',
  }));
  const judge = !!document.getElementById('exp-judge')?.checked;
  const concurrency = parseInt(document.getElementById('exp-concurrency')?.value || '2', 10);

  const runBtn = document.getElementById('exp-run');
  const results = document.getElementById('exp-results');
  if (runBtn) { runBtn.disabled = true; runBtn.textContent = '⏳ 実行中... (数分かかります)'; }
  results.innerHTML = `
    <div class="exp-loading">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="18" stroke="var(--blue-lt)" stroke-width="3" fill="none"/>
        <circle cx="24" cy="24" r="18" stroke="var(--blue)" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="30 120">
          <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <div class="exp-loading-title">${variantEls.length} バリアントを並列実行中…</div>
      <div class="exp-loading-desc">各バリアントで plan → agents → synthesis を実行します。${judge ? '完了後 AI Judge が比較評価します。' : ''}</div>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/api/experiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, contexts, concurrency, judge }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    renderExperimentResults(goal, data);
  } catch (e) {
    results.innerHTML = '';
    appendExecErrorInto(results, e.message);
    showToast('実験失敗: ' + e.message);
  } finally {
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = '▶ 実験を実行'; }
  }
}
window.runExperiment = runExperiment;

function appendExecErrorInto(container, message) {
  const box = document.createElement('div');
  box.className = 'exec-error';
  const head = document.createElement('div');
  head.className = 'exec-error-head';
  const label = document.createElement('span');
  label.textContent = '⚠ エラー詳細';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn';
  btn.textContent = '📋 コピー';
  btn.onclick = () => copyText(String(message), btn);
  head.appendChild(label);
  head.appendChild(btn);
  const pre = document.createElement('pre');
  pre.textContent = String(message);
  box.appendChild(head);
  box.appendChild(pre);
  container.appendChild(box);
}

function renderExperimentResults(goal, data) {
  const container = document.getElementById('exp-results');
  container.innerHTML = '';
  const records = data.records || [];
  const judge = data.judge || null;

  // Judge ランキングバナー
  if (judge && Array.isArray(judge.ranking) && judge.ranking.length) {
    const banner = document.createElement('div');
    banner.className = 'exp-judge-banner';
    const orderList = judge.ranking.map((vid, i) => `<span class="exp-rank-pill r${i+1}">${i+1}. ${escapeHtml(vid)}</span>`).join('');
    banner.innerHTML = `
      <div class="exp-judge-head">
        <span class="exp-judge-title">🏆 AI Judge ランキング</span>
        <button type="button" class="copy-btn" onclick="copyText(${JSON.stringify(JSON.stringify(judge))}, this)">📋 JSONコピー</button>
      </div>
      <div class="exp-rank-row">${orderList}</div>
      <div class="exp-judge-summary">${escapeHtml(judge.summary || '')}</div>`;
    container.appendChild(banner);
  }

  // バリアント結果
  const grid = document.createElement('div');
  grid.className = 'exp-result-grid';
  grid.style.setProperty('--n', String(Math.min(records.length, 3)));
  records.forEach(r => {
    const hasError = (r.errors || []).length > 0 && !r.synthesis;
    const synth = hasError
      ? `⚠️ 失敗\n\n` + (r.errors || []).map(e => '- ' + e).join('\n')
      : (r.synthesis || '*(本文なし)*');
    const agents = (r.plan?.agents || []).join(' → ');
    const card = document.createElement('div');
    card.className = 'exp-result-card' + (hasError ? ' exp-result-error' : '');
    card.innerHTML = `
      <div class="exp-result-head">
        <span class="exp-result-id">${escapeHtml(r.variant_id)}</span>
        <span class="exp-result-meta">${escapeHtml(String(r.elapsed_s) + 's')} · ${escapeHtml(agents)}</span>
        <button type="button" class="copy-btn" style="margin-left:auto;">📋 コピー</button>
      </div>
      <div class="exp-result-plan"><strong>plan:</strong> ${escapeHtml(r.plan?.reason || '')}</div>
      <div class="exp-result-body"></div>`;
    const body = card.querySelector('.exp-result-body');
    body.innerHTML = renderMarkdown(synth);
    card.querySelector('.copy-btn').onclick = (e) => { e.stopPropagation(); copyText(synth, card.querySelector('.copy-btn')); };
    grid.appendChild(card);
  });
  container.appendChild(grid);

  showToast(`実験完了: ${records.length} バリアント`);
}

async function _executeOrchestrator(goal, forcedAgents = null) {
  if (S.running) return;
  S.running = true;
  S.lastGoal = goal;

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
    <div class="task-goal-wrap">
      <div class="task-goal">${escapeHtml(goal)}</div>
      <button type="button" class="copy-btn" onclick="copyText(${JSON.stringify(goal)}, this)">📋 コピー</button>
    </div>
    <div class="task-meta">
      <span class="task-status-badge planning" id="task-badge">⏳ プランニング中...</span>
    </div>`;
  execContent.appendChild(taskHeader);

  // プランブロック
  const planBlock = document.createElement('div');
  planBlock.className = 'plan-block';
  planBlock.innerHTML = `
    <div class="plan-title-row">
      <div class="plan-title">AGENT PIPELINE</div>
      <button type="button" class="plan-edit-btn" onclick="openPlanEditor()" title="エージェント列を編集して再実行">✎ 編集して再実行</button>
    </div>
    <div class="plan-steps" id="plan-steps-row"></div>
    <div class="plan-reason" id="plan-reason"></div>`;
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
      <button type="button" class="copy-btn" onclick="copySynthesis(this)">📋 コピー</button>
      <div class="export-wrap">
        <button class="export-btn" onclick="toggleExportMenu(this)">↓ export ▾</button>
        <div class="export-menu" style="display:none;">
          <button onclick="exportMarkdown()">📄 Markdown</button>
          <button onclick="exportRich('docx')">📝 DOCX</button>
          <button onclick="exportRich('pptx')">📊 PPTX</button>
          <button onclick="exportRich('pdf')">📑 PDF</button>
        </div>
      </div>
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
    await _streamPipeline(goal, taskRecord, planBlock, agentOutputs, finalOutput, forcedAgents);
  } catch (e) {
    setBadge('error', '❌ エラー');
    console.error('orchestrator error', e);
    if (e.message.includes('APIキー') || e.message.includes('未設定')) {
      showToast('APIキーが未設定です。設定画面を開きます…');
      if (typeof openSettings === 'function') openSettings();
    } else {
      showToast(`エラー: ${e.message}`);
    }
    appendExecError(e.message);
  } finally {
    S.running = false;
    document.getElementById('run-btn').disabled = false;
    document.getElementById('run-btn-bottom').disabled = false;
  }
}

async function _streamPipeline(goal, taskRecord, planBlock, agentOutputs, finalOutput, forcedAgents = null) {
  const body = { goal, context: S.ctx };
  if (Array.isArray(forcedAgents) && forcedAgents.length) body.forced_agents = forcedAgents;
  const res = await fetch(`${API_BASE}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
      S.lastGoal = taskRecord.goal || S.lastGoal;
      S.lastPlan = { agents: [...data.agents], reason: data.reason };
      setBadge('running', '▶ 実行中');
      const stepsRow = document.getElementById('plan-steps-row');
      const reasonEl = document.getElementById('plan-reason');
      if (stepsRow) {
        stepsRow.innerHTML = data.agents.map((id, i) => {
          const agent = S.agents.find(a => a.id === id);
          return [
            i > 0 ? '<span class="plan-arrow">→</span>' : '',
            `<span class="plan-step" id="ps-${escapeHtml(id)}">`,
            agent ? agent.icon : '🤖',
            ` ${escapeHtml(agent ? agent.name : id)}`,
            '</span>',
          ].join('');
        }).join('');
      }
      if (reasonEl) {
        reasonEl.textContent = data.reason;
        // プラン理由は常時コピー可能にする
        const existingBtn = reasonEl.parentElement?.querySelector('.copy-btn.plan-reason-copy');
        if (!existingBtn && data.reason) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'copy-btn plan-reason-copy';
          btn.style.marginTop = '6px';
          btn.textContent = '📋 コピー';
          btn.onclick = () => copyText(data.reason, btn);
          reasonEl.parentElement?.appendChild(btn);
        }
      }
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
          <span class="ao-name">${escapeHtml(agent?.name || data.id)}</span>
          <span class="ao-status running" id="aos-${escapeHtml(data.id)}">● 実行中</span>
          <button type="button" class="copy-btn" style="margin-left:auto;" onclick="copyAgentOutput('${escapeHtml(data.id)}', this)">📋 コピー</button>
        </div>
        <div class="ao-body" id="aob-${escapeHtml(data.id)}"></div>`;
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
      // export 用にエージェント出力を保持
      if (!taskRecord.results) taskRecord.results = [];
      taskRecord.results.push({ agent_id: data.id, output: agentTextMap[data.id] || '' });
      break;
    }

    case 'compressing': {
      const bi = document.getElementById('baton-indicator');
      if (bi) {
        bi.style.display = 'flex';
        const fromAgent = S.agents.find(a => a.id === data.from);
        const toAgent = S.agents.find(a => a.id === data.to);
        // textContent なので raw 代入で安全
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
      refreshUsage();
      break;

    case 'error':
      setBadge('error', '❌ エラー');
      showToast(`エラー: ${data.message}`);
      appendExecError(data.message);
      console.error('orchestrator error', data.message);
      break;
  }
}

function setBadge(cls, text) {
  const badge = document.getElementById('task-badge');
  if (badge) { badge.className = `task-status-badge ${cls}`; badge.textContent = text; }
}

// ── ワンクリックコピー ────────────────────────────────────────
async function copyText(text, btn) {
  const original = btn ? btn.textContent : null;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // 非 HTTPS / 古いブラウザのフォールバック
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (btn) {
      btn.textContent = '✓ コピー完了';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    }
    showToast('クリップボードにコピーしました');
  } catch (e) {
    console.error('copy failed', e);
    showToast('コピーに失敗しました: ' + e.message);
  }
}
window.copyText = copyText;

// エージェント出力をコピー（Markdown 生テキスト）
function copyAgentOutput(agentId, btn) {
  const body = document.getElementById(`aob-${agentId}`);
  if (!body) return;
  copyText(body.innerText || body.textContent || '', btn);
}
window.copyAgentOutput = copyAgentOutput;

// 統合出力をコピー
function copySynthesis(btn) {
  const body = document.getElementById('fo-body');
  if (!body) return;
  copyText(body.innerText || body.textContent || '', btn);
}
window.copySynthesis = copySynthesis;

// ── 永続エラー表示（toast は 2.5 秒で消えるためコピー用に DOM に残す） ──
function appendExecError(message) {
  if (!message) return;
  const container = document.getElementById('exec-content');
  if (!container) return;
  const text = String(message);
  const box = document.createElement('div');
  box.className = 'exec-error';
  const head = document.createElement('div');
  head.className = 'exec-error-head';
  const label = document.createElement('span');
  label.textContent = '⚠ エラー詳細';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn';
  btn.textContent = '📋 コピー';
  btn.onclick = () => copyText(text, btn);
  head.appendChild(label);
  head.appendChild(btn);
  const pre = document.createElement('pre');
  pre.textContent = text;
  box.appendChild(head);
  box.appendChild(pre);
  container.appendChild(box);
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── タスク履歴 ────────────────────────────────────────────────
function renderTaskHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (S.tasks.length === 0) {
    list.innerHTML = `
      <div class="hist-empty empty-state">
        <svg class="empty-state-illus" width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
          <rect x="14" y="18" width="36" height="44" rx="3" stroke="currentColor" stroke-width="2" fill="none" opacity=".25"/>
          <rect x="20" y="12" width="36" height="44" rx="3" stroke="currentColor" stroke-width="2" fill="none" opacity=".55"/>
          <rect x="26" y="6" width="36" height="44" rx="3" stroke="currentColor" stroke-width="2.5" fill="none"/>
          <line x1="32" y1="18" x2="56" y2="18" stroke="currentColor" stroke-width="2" opacity=".6"/>
          <line x1="32" y1="26" x2="50" y2="26" stroke="currentColor" stroke-width="2" opacity=".45"/>
          <line x1="32" y1="34" x2="46" y2="34" stroke="currentColor" stroke-width="2" opacity=".30"/>
          <circle cx="60" cy="46" r="8" fill="var(--gold)"/>
          <line x1="60" y1="42" x2="60" y2="50" stroke="#1A1203" stroke-width="2" stroke-linecap="round"/>
          <line x1="56" y1="46" x2="64" y2="46" stroke="#1A1203" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div class="empty-state-title">まだ履歴がありません</div>
        <div class="empty-state-desc">最初のタスクを実行すると<br>ここに結果が残ります。</div>
      </div>`;
    return;
  }
  list.innerHTML = S.tasks.slice(0, 10).map(t => `
    <div class="hist-item ${t.id === S.currentTaskId ? 'active' : ''}" onclick="replayTask('${escapeHtml(t.id)}')">
      <div class="hist-title">${escapeHtml(t.goal.slice(0, 40))}</div>
      <div class="hist-meta">${escapeHtml((t.agents || []).join(' → '))}</div>
    </div>
  `).join('');
}

// サーバー側の永続履歴から初期表示
async function loadTaskHistoryFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/memory/results`);
    if (!res.ok) return;
    const data = await res.json();
    const records = data.results || [];
    if (records.length === 0) return;
    S.tasks = records.map(r => ({
      id: r.id,
      goal: r.goal || '',
      agents: r.agent_ids || [],
      synthesis: '',  // 詳細取得時に埋まる
      ts: Date.parse(r.timestamp || '') || 0,
      persisted: true,
    }));
    renderTaskHistory();
  } catch (e) {
    console.warn('history load failed:', e.message);
  }
}

// 履歴クリック → サーバーから詳細取得して再描画
async function replayTask(taskId) {
  if (S.running) { showToast('実行中は履歴を開けません'); return; }
  try {
    const res = await fetch(`${API_BASE}/api/memory/results/${encodeURIComponent(taskId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`履歴の取得に失敗: ${err.detail || res.status}`);
      return;
    }
    const detail = await res.json();
    S.currentTaskId = taskId;
    renderTaskHistory();
    renderRestoredTask(detail);
  } catch (e) {
    showToast('履歴取得エラー: ' + e.message);
  }
}
window.replayTask = replayTask;

function renderRestoredTask(rec) {
  // ランディング → 実行エリア
  document.getElementById('orch-landing').style.display = 'none';
  document.getElementById('exec-area').style.display = 'flex';
  document.getElementById('exec-area').style.flexDirection = 'column';
  document.getElementById('input-zone').style.display = 'block';

  const execContent = document.getElementById('exec-content');
  execContent.innerHTML = '';

  const goal = rec.goal || '';
  const agents = (rec.agent_results || []).map(a => a.agent_id);
  const plan = rec.plan || {};

  // タスクヘッダー
  const taskHeader = document.createElement('div');
  taskHeader.className = 'task-header';
  taskHeader.innerHTML = `
    <div class="task-goal-wrap">
      <div class="task-goal">${escapeHtml(goal)}</div>
      <button type="button" class="copy-btn" onclick="copyText(${JSON.stringify(goal)}, this)">📋 コピー</button>
    </div>
    <div class="task-meta">
      <span class="task-status-badge done">📂 履歴復元</span>
      <span style="font-size:10px;color:var(--muted);margin-left:8px;">${escapeHtml(rec.timestamp || '')}</span>
    </div>`;
  execContent.appendChild(taskHeader);

  // プランブロック
  const planBlock = document.createElement('div');
  planBlock.className = 'plan-block';
  planBlock.innerHTML = `
    <div class="plan-title-row">
      <div class="plan-title">AGENT PIPELINE</div>
      <button type="button" class="plan-edit-btn" onclick="openPlanEditor()" title="エージェント列を編集して再実行">✎ 編集して再実行</button>
    </div>
    <div class="plan-steps" id="plan-steps-row"></div>
    <div class="plan-reason" id="plan-reason"></div>`;
  execContent.appendChild(planBlock);
  const stepsRow = document.getElementById('plan-steps-row');
  if (stepsRow) {
    stepsRow.innerHTML = agents.map((id, i) => {
      const ag = S.agents.find(a => a.id === id);
      return [
        i > 0 ? '<span class="plan-arrow">→</span>' : '',
        `<span class="plan-step done" id="ps-${escapeHtml(id)}">`,
        ag ? ag.icon : '🤖',
        ` ${escapeHtml(ag ? ag.name : id)}`,
        '</span>',
      ].join('');
    }).join('');
  }
  const reasonEl = document.getElementById('plan-reason');
  if (reasonEl && plan.reason) reasonEl.textContent = plan.reason;

  // 各エージェント出力
  const agentOutputs = document.createElement('div');
  agentOutputs.id = 'agent-outputs';
  execContent.appendChild(agentOutputs);
  (rec.agent_results || []).forEach((ar, i) => {
    const ag = S.agents.find(a => a.id === ar.agent_id);
    const div = document.createElement('div');
    div.className = 'agent-output';
    div.id = `ao-${ar.agent_id}`;
    div.innerHTML = `
      <div class="ao-header">
        <span class="ao-num">0${i + 1}</span>
        <span class="ao-icon">${ag?.icon || '🤖'}</span>
        <span class="ao-name">${escapeHtml(ag?.name || ar.agent_id)}</span>
        <span class="ao-status done">✓ 完了</span>
        <button type="button" class="copy-btn" style="margin-left:auto;" onclick="copyAgentOutput('${escapeHtml(ar.agent_id)}', this)">📋 コピー</button>
      </div>
      <div class="ao-body" id="aob-${escapeHtml(ar.agent_id)}"></div>`;
    agentOutputs.appendChild(div);
    const body = document.getElementById(`aob-${ar.agent_id}`);
    if (body) body.innerHTML = renderMarkdown(ar.output || '(保存されていません)');
  });

  // 統合出力
  const synthText = rec.synthesis || '';
  if (synthText) {
    const finalOutput = document.createElement('div');
    finalOutput.className = 'final-output';
    finalOutput.innerHTML = `
      <div class="fo-header">
        <span class="fo-label">📋 統合アウトプット（履歴）</span>
        <button type="button" class="copy-btn" onclick="copySynthesis(this)">📋 コピー</button>
        <div class="export-wrap">
        <button class="export-btn" onclick="toggleExportMenu(this)">↓ export ▾</button>
        <div class="export-menu" style="display:none;">
          <button onclick="exportMarkdown()">📄 Markdown</button>
          <button onclick="exportRich('docx')">📝 DOCX</button>
          <button onclick="exportRich('pptx')">📊 PPTX</button>
          <button onclick="exportRich('pdf')">📑 PDF</button>
        </div>
      </div>
      </div>
      <div class="fo-body" id="fo-body"></div>`;
    execContent.appendChild(finalOutput);
    document.getElementById('fo-body').innerHTML = renderMarkdown(synthText);
  }

  // 現在タスクとしても保持（export 用）
  const taskRec = S.tasks.find(t => t.id === rec.id);
  if (taskRec) {
    taskRec.synthesis = synthText;
    taskRec.agents = agents;
  } else {
    S.tasks.unshift({ id: rec.id, goal, agents, synthesis: synthText, ts: Date.now() });
  }
}

// ── エクスポート ──────────────────────────────────────────────
let _exportMenuOpen = false;

function toggleExportMenu(btn) {
  _exportMenuOpen = !_exportMenuOpen;
  const menu = btn?.parentElement?.querySelector('.export-menu');
  if (menu) menu.style.display = _exportMenuOpen ? 'block' : 'none';
  if (_exportMenuOpen) {
    // 他のクリックで閉じる
    const close = (e) => {
      if (!menu?.contains(e.target) && e.target !== btn) {
        menu.style.display = 'none';
        _exportMenuOpen = false;
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}
window.toggleExportMenu = toggleExportMenu;

function _buildExportPayload() {
  const task = S.tasks[0];
  if (!task) return null;
  // agentNames マップを S.agents から生成
  const agentNames = {};
  (S.agents || []).forEach(a => { agentNames[a.id] = a.name || a.id; });
  return {
    goal: task.goal || '',
    agents: task.agents || [],
    agent_names: agentNames,
    results: task.results || [],
    synthesis: task.synthesis || '',
  };
}

function exportMarkdown() {
  const payload = _buildExportPayload();
  if (!payload) { showToast('エクスポートするタスクがありません'); return; }
  const parts = [
    `# ${payload.goal}`,
    '',
    `エージェント: ${payload.agents.map(id => payload.agent_names[id] || id).join(' → ')}`,
    '',
  ];
  for (const r of (payload.results || [])) {
    const name = payload.agent_names[r.agent_id] || r.agent_id;
    parts.push(`## ${name}`, '', r.output || '', '');
  }
  parts.push('## 統合アウトプット', '', payload.synthesis || '(なし)');
  const blob = new Blob([parts.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `di-output-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
window.exportMarkdown = exportMarkdown;

async function exportRich(format) {
  const payload = _buildExportPayload();
  if (!payload) { showToast('エクスポートするタスクがありません'); return; }
  showToast(`${format.toUpperCase()} を生成中...`);
  try {
    const res = await fetch(`${API_BASE}/api/export/${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `di-output-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${format.toUpperCase()} をダウンロードしました`);
  } catch (e) {
    console.error('export failed', e);
    showToast(`export 失敗: ${e.message}`);
  }
}
window.exportRich = exportRich;

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

// marked の一度きりセットアップ（GFM + highlight.js）
let _mdReady = false;
function _setupMarkdown() {
  if (_mdReady) return;
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') return;
  if (typeof hljs !== 'undefined' && marked.use) {
    marked.use({
      gfm: true,
      breaks: true,
      async: false,
      hooks: {
        postprocess(html) { return html; },
      },
      renderer: {
        code(code, lang) {
          const language = hljs.getLanguage(lang) ? lang : null;
          const highlighted = language
            ? hljs.highlight(code, { language, ignoreIllegals: true }).value
            : hljs.highlightAuto(code).value;
          return `<pre><code class="hljs language-${language || 'plaintext'}">${highlighted}</code></pre>`;
        },
      },
    });
  } else if (marked.use) {
    marked.use({ gfm: true, breaks: true, async: false });
  }
  _mdReady = true;
}

function renderMarkdown(text) {
  if (!text) return '';
  _setupMarkdown();
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    // フォールバック：ライブラリが読めていない場合は安全な textContent 化のみ
    const escaped = String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre>${escaped}</pre>`;
  }
  try {
    const html = marked.parse(text, { gfm: true, breaks: true, async: false });
    return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  } catch (e) {
    console.error('markdown render failed', e);
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

function toggleMenu() {
  const left = document.getElementById('left');
  left?.classList.toggle('open');
}
window.toggleMenu = toggleMenu;

// ── テーマ切替 ─────────────────────────────────────────────────
function _applyHljsTheme(theme) {
  const light = document.getElementById('hljs-light');
  const dark = document.getElementById('hljs-dark');
  if (!light || !dark) return;
  if (theme === 'dark') { light.disabled = true; dark.disabled = false; }
  else { light.disabled = false; dark.disabled = true; }
}

function toggleTheme() {
  const root = document.documentElement;
  const cur = root.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  _applyHljsTheme(next);
  try { localStorage.setItem('di-theme', next); } catch {}
}
window.toggleTheme = toggleTheme;

// 起動時に一度 hljs テーマを現状に合わせる
_applyHljsTheme(document.documentElement.getAttribute('data-theme') || 'light');

// OS のテーマ変更に追従（localStorage が未設定のときのみ）
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', (e) => {
    try {
      if (localStorage.getItem('di-theme')) return; // 明示保存済みは尊重
    } catch {}
    const next = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    _applyHljsTheme(next);
  });
}

// Ctrl+Enter / Cmd+Enter でチャット送信
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const ci = document.getElementById('ci');
    if (document.activeElement === ci) sendMsg();
  }
});

// ── テンプレートライブラリ UI ─────────────────────────────────
const _TMPL_STORAGE_KEY = 'di_user_templates';
let _tmplTab = 'all';

function loadUserTemplates() {
  try {
    return JSON.parse(localStorage.getItem(_TMPL_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveUserTemplates(list) {
  try { localStorage.setItem(_TMPL_STORAGE_KEY, JSON.stringify(list)); } catch {}
}

function openTemplateModal() {
  const modal = document.getElementById('tmpl-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderTemplateModal(_tmplTab);
}
window.openTemplateModal = openTemplateModal;

function closeTemplateModal() {
  const modal = document.getElementById('tmpl-modal');
  if (modal) modal.style.display = 'none';
}
window.closeTemplateModal = closeTemplateModal;

function switchTmplTab(id) {
  _tmplTab = id;
  renderTemplateModal(id);
}
window.switchTmplTab = switchTmplTab;

function renderTemplateModal(tabId) {
  // タブアクティブ状態
  document.querySelectorAll('.tmpl-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });

  const grid = document.getElementById('tmpl-grid');
  if (!grid) return;

  const userTmpl = loadUserTemplates();
  let items;

  if (tabId === 'custom') {
    items = userTmpl;
  } else if (tabId === 'all') {
    items = TEMPLATES;
  } else {
    items = TEMPLATES.filter(t => t.cat === tabId);
  }

  if (items.length === 0) {
    grid.innerHTML = '<div class="tmpl-empty">テンプレートがありません</div>';
    return;
  }

  grid.innerHTML = items.map(t => {
    const cat = TEMPLATE_CATS.find(c => c.id === (t.cat || 'custom')) || TEMPLATE_CATS[0];
    const isCustom = !!t.created_at;
    return `
      <div class="tmpl-card" onclick="applyTemplate(${JSON.stringify(t.text).replace(/'/g,"&#39;")})">
        <div class="tmpl-card-head">
          <span class="tmpl-cat-badge" style="background:${cat.color}18;color:${cat.color};">${cat.label}</span>
          ${isCustom ? `<button class="tmpl-del-btn" onclick="event.stopPropagation();deleteUserTemplate('${t.id}')" title="削除">×</button>` : ''}
        </div>
        <div class="tmpl-title">${escapeHtml(t.title)}</div>
        <div class="tmpl-preview">${escapeHtml(t.text.slice(0, 70))}${t.text.length > 70 ? '…' : ''}</div>
      </div>
    `;
  }).join('');
}

function applyTemplate(text) {
  const ti = document.getElementById('task-input');
  const tib = document.getElementById('task-input-bottom');
  if (ti) ti.value = text;
  if (tib) tib.value = text;
  closeTemplateModal();
  showToast('テンプレートを適用しました');
  // ランディングが表示中なら task-input にフォーカス
  if (ti && document.getElementById('orch-landing')?.style.display !== 'none') {
    ti.focus();
  }
}
window.applyTemplate = applyTemplate;

function saveCurrentAsTemplate() {
  const ti = document.getElementById('task-input');
  const tib = document.getElementById('task-input-bottom');
  const text = (ti?.value || tib?.value || '').trim();
  if (!text) { showToast('保存するテキストを入力してください'); return; }

  const titleInput = document.getElementById('tmpl-save-title');
  const title = (titleInput?.value || '').trim() || text.slice(0, 20) + '…';

  const list = loadUserTemplates();
  const newItem = {
    id: 'u_' + Date.now(),
    cat: 'custom',
    title,
    text,
    created_at: new Date().toISOString(),
  };
  list.unshift(newItem);
  saveUserTemplates(list);
  if (titleInput) titleInput.value = '';
  showToast(`「${title}」を保存しました`);
  // カスタムタブに切り替えて表示
  _tmplTab = 'custom';
  renderTemplateModal('custom');
}
window.saveCurrentAsTemplate = saveCurrentAsTemplate;

function deleteUserTemplate(id) {
  const list = loadUserTemplates().filter(t => t.id !== id);
  saveUserTemplates(list);
  renderTemplateModal(_tmplTab);
  showToast('テンプレートを削除しました');
}
window.deleteUserTemplate = deleteUserTemplate;

// ── コスト・キャッシュダッシュボード ─────────────────────────
let _usagePanelOpen = false;

function toggleUsagePanel() {
  _usagePanelOpen = !_usagePanelOpen;
  const p = document.getElementById('usage-panel');
  if (p) p.style.display = _usagePanelOpen ? 'block' : 'none';
  if (_usagePanelOpen) refreshUsage();
}
window.toggleUsagePanel = toggleUsagePanel;

async function refreshUsage() {
  try {
    const res = await fetch(`${API_BASE}/api/usage`);
    if (!res.ok) return;
    const d = await res.json();
    renderUsage(d);
  } catch (e) {
    console.warn('usage fetch failed:', e.message);
  }
}

function renderUsage(d) {
  const badge = document.getElementById('usage-badge');
  const totalCostEl = document.getElementById('u-total-cost');
  const savingsEl   = document.getElementById('u-savings');
  const rowsEl      = document.getElementById('u-token-rows');

  const cost    = d.total_cost_usd    || 0;
  const savings = d.total_savings_usd || 0;

  // バッジ更新
  if (badge) {
    const savingsText = savings > 0.0001 ? ` · 💾$${savings.toFixed(3)}` : '';
    badge.textContent = `💰 $${cost.toFixed(3)}${savingsText}`;
    badge.style.display = '';
    // 節約がある場合はハイライト
    badge.style.borderColor = savings > 0.001 ? 'rgba(74,222,128,.5)' : '';
  }

  // パネル更新
  if (totalCostEl) totalCostEl.textContent = `$${cost.toFixed(4)}`;
  if (savingsEl)   savingsEl.textContent   = `$${savings.toFixed(4)}`;

  if (rowsEl) {
    const rows = [];
    const models = [
      { key: 'main', label: 'Sonnet (main)' },
      { key: 'fast', label: 'Haiku (fast)'  },
    ];
    for (const { key, label } of models) {
      const b = d[key];
      if (!b || b.calls === 0) continue;
      rows.push(`
        <div style="padding:6px 8px;background:var(--panel);border-radius:4px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);font-family:var(--mono);margin-bottom:4px;">${label} · ${b.calls} calls</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;">
            ${_uRow('input',        b.input_tokens)}
            ${_uRow('output',       b.output_tokens)}
            ${_uRow('cache write',  b.cache_create_tokens, 'var(--amber,#f59e0b)')}
            ${_uRow('cache read',   b.cache_read_tokens,   'var(--green2,#22c55e)')}
          </div>
          <div style="margin-top:4px;font-size:10px;font-family:var(--mono);color:var(--muted);">
            cost: <strong style="color:var(--text);">$${(b.cost_usd||0).toFixed(5)}</strong>
            &nbsp;saved: <strong style="color:var(--green2,#22c55e);">$${(b.savings_usd||0).toFixed(5)}</strong>
          </div>
        </div>
      `);
    }
    rowsEl.innerHTML = rows.join('') || '<div style="font-size:11px;color:var(--muted);font-family:var(--mono);">まだ API 呼び出しはありません</div>';
  }
}

function _uRow(label, val, color) {
  const color_ = color || 'var(--text)';
  return `
    <div style="font-size:10px;font-family:var(--mono);color:var(--muted);">${label}</div>
    <div style="font-size:10px;font-family:var(--mono);color:${color_};text-align:right;">${(val||0).toLocaleString()}</div>
  `;
}

async function resetUsage() {
  try {
    await fetch(`${API_BASE}/api/usage/reset`, { method: 'POST' });
    await refreshUsage();
    showToast('使用量をリセットしました');
  } catch (e) {
    console.warn('reset failed:', e.message);
  }
}
window.resetUsage = resetUsage;

// ── 起動 ──────────────────────────────────────────────────────
init();
