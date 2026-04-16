# DI Marketing AI Harness

株式会社デジタルアイデンティティ（DI）の社内マーケティングAIプラットフォーム。
FastAPI バックエンド + 静的フロントエンド構成で、**11 エージェントをオーケストレーション**し、リサーチ → 戦略 → 施策 → メディア設計までを一気通貫で実行する。

---

## 特徴

- 🧠 **HARNESS モード**: 課題を入力すると AI が自動で最適な 2〜4 エージェントを選択し、SSE ストリーミングで順次実行
- 💬 **AGENTS モード**: 11 エージェントに個別チャットで相談可能
- 🔑 **APIキーはダッシュボード管理**: サーバー側 state に保持、`.env` 不要
- ⚡ **Prompt Caching 適用**: DI ナレッジ（6000 字）は `cache_control: ephemeral` で 2 回目以降 90% 割引
- 🔁 **自動リトライ**: 429 / 529 / ネットワーク系エラーは指数バックオフで再試行（Retry-After 尊重）
- 📂 **タスク履歴の永続化**: `data/memory/results.json` に保存、サイドバー履歴クリックで復元
- 📋 **常時コピペ**: 全ての出力（エージェント / 統合 / チャット / エラー）にワンクリックコピー
- 🧪 **A/B 実験 API**: 同一ゴールを複数コンテキストで並列実行、LLM-as-a-Judge でランキング比較

---

## セットアップ

### 必要環境
- Python 3.11+（検証は 3.13）
- Anthropic API キー（残高必要）
- Windows / macOS / Linux
- ブラウザ（Chrome / Edge 推奨、`navigator.clipboard` が使えるもの）

### インストール

```powershell
# 1. プロジェクトへ移動
cd C:\Users\hiroshi_takizawa\di-marketing-ai

# 2. Python 依存インストール
pip install -r backend/requirements.txt
```

`backend/requirements.txt` の中身:
```
anthropic>=0.49.0
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
aiofiles>=23.2.1
pyyaml>=6.0.1
```

---

## 起動

### 通常起動

```powershell
.\scripts\start.ps1
```

または直接：

```powershell
python -m uvicorn backend.main:app --reload --port 8000 --log-level info
```

起動後、ブラウザで **http://localhost:8000** を開く。

### APIキー登録

1. 画面右上「**⚙ 設定**」ボタン
2. Anthropic API キー（`sk-ant-...`）を入力 → **save**
3. ヘッダーに「`connected · 11 agents`」が出れば準備完了

> ⚠️ **再起動ごとに再登録が必要**（プロセス内 state、永続化なし）。これはセキュリティ設計上の選択。

### モデルの切り替え（任意）

残高不足やアカウント権限などで既定モデルが使えない場合、環境変数で上書き可能。

```powershell
$env:ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"
$env:ANTHROPIC_MODEL_FAST = "claude-haiku-4-5-20250929"
python -m uvicorn backend.main:app --reload --port 8000
```

既定値は `backend/models.py` 参照。

---

## 使い方

### HARNESS モード（推奨ワークフロー）

1. ヘッダー「**HARNESS**」タブを選択
2. （任意）「**＋ データ登録**」でコンテキストを投入
   - `survey`: アンケート結果
   - `persona`: ターゲットペルソナ（サンプル 5 種類をプルダウンから選択可能）
   - `brief`: 案件背景
3. 画面中央のテキストエリアに課題を入力（ヒントチップから選ぶのも可）
4. 「**送信**」で実行開始
5. プランニング → エージェント順次実行 → 統合アウトプット を SSE で逐次表示
6. 「**📋 コピー**」でエージェント単位／統合単位にコピー、「**↓ export**」で Markdown 保存

### AGENTS モード

- ヘッダー「**AGENTS**」タブ
- カテゴリ（RESEARCH / STRATEGY / CREATIVE / MEDIA）から 11 エージェントを選択
- 選んだエージェントと 1 対 1 チャット（SSE ストリーミング、Ctrl+Enter で送信）

### タスク履歴の再表示

左サイドバー `task history` に過去のタスクが一覧表示。クリックするとプラン、各エージェント出力、統合アウトプットまで完全復元。

---

## アーキテクチャ

```
frontend/
├── index.html      ヘッダー sticky / モーダル（ctx, settings）
├── app.js          SSE クライアント / ペルソナ適用 / 履歴復元 / コピペ
└── styles.css      DI デザイントークン / レスポンシブ

backend/
├── main.py             FastAPI + 全エンドポイント
├── pipeline.py         Plan → Execute → Synthesize の SSE AsyncGenerator
├── planner.py          claude-sonnet-4-6 でエージェント選択
├── agent_runner.py     SDK streaming + Haiku バトン圧縮
├── agent_registry.py   11 エージェント定義 + build_agent_sys_prompt_blocks（caching 対応）
├── knowledge_loader.py di-knowledge.json の lru_cache
├── memory_store.py     results.json / patterns.json 排他書き込み
├── experiment_loop.py  A/B 実験並列実行 + LLM-as-a-Judge
├── retry.py            429/529 を Retry-After + 指数バックオフでリトライ
└── models.py           ANTHROPIC_MODEL / ANTHROPIC_MODEL_FAST の env フック

data/
├── di-knowledge.json   DI ナレッジ 30 ブロック
├── persona_data.json   ターゲットウィザード用サンプルペルソナ 5 件
└── memory/
    ├── results.json    タスク実行履歴（最大 50 件、本文含む）
    └── patterns.json   エージェント組み合わせ使用パターン
```

### データフロー（HARNESS 実行時）

```
[ユーザー] → POST /api/run { goal, context }
    ↓ StreamingResponse (SSE)
[pipeline.run_pipeline]
    ↓ plan_task() (planner)
    event: planning, plan
    ↓ for each agent:
        ↓ run_agent_stream() (agent_runner)
        events: agent_start, token*, agent_done
        ↓ compress_context() (Haiku)
        event: compressing, baton_ready
    ↓ run_synthesis_stream()
    events: synth_start, synth_token*, synth_done
    ↓ save_result() (memory_store)
    event: complete
```

---

## API エンドポイント

| パス | メソッド | 説明 |
|---|---|---|
| `/api/health` | GET | ヘルスチェック（API キー設定状況を含む） |
| `/api/config` | GET / POST | APIキー マスク取得 / 設定 |
| `/api/agents` | GET | エージェント一覧メタ |
| `/api/plan` | POST | プランナー単独実行（デバッグ用） |
| `/api/run` | POST | パイプライン実行（**SSE**） |
| `/api/agents/{id}/chat` | POST | 個別エージェントチャット（**SSE**） |
| `/api/memory/results` | GET | タスク履歴一覧（サマリー） |
| `/api/memory/results/{task_id}` | GET | タスク履歴詳細（本文含む） |
| `/api/memory/patterns` | GET | パターン集計 |
| `/api/personas` | GET | ペルソナプリセット一覧 |
| `/api/experiment` | POST | A/B 並列実行 + LLM-as-a-Judge |
| `/docs` | GET | Swagger UI |

### `/api/experiment` リクエスト例

```bash
curl -X POST http://localhost:8000/api/experiment \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "30代女性向け新商品のキャッチコピーを作りたい",
    "contexts": [
      {"persona": "田中美咲（32歳・会社員・独身）"},
      {"persona": "佐藤由紀（35歳・既婚・子持ち）"}
    ],
    "forced_agents": ["strategy", "copy"],
    "concurrency": 2,
    "judge": true
  }'
```

---

## 運用

### 依存のアップデート

```powershell
pip install -U -r backend/requirements.txt
```

### ログ

- `--log-level info` 推奨
- Prompt caching 効果: `agent=strategy cache_read=1234 cache_create=0 input=56 output=789`
- 500 エラーの traceback はサーバーコンソールに full 出力

### トラブルシューティング

| 症状 | 対処 |
|------|------|
| `Your credit balance is too low to access the Anthropic API` | Console → Plans & Billing でチャージ |
| `invalid x-api-key` | ダッシュボードで正しい `sk-ant-...` を再登録 |
| モデル `claude-sonnet-4-6` が使えない | `$env:ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"` |
| 画面真っ白 / コンソールに `SyntaxError` | サーバー再起動、ブラウザ強制リロード（Ctrl+F5） |
| `data/di-knowledge.json` の JSON パースエラー | 日本語の `"` はエスケープ or 全角 `「」` に |
| SSE が途中で止まる | プロキシやリバースプロキシが buffering している可能性、`X-Accel-Buffering: no` が通るか確認 |

エラー画面の **赤枠 `.exec-error`** ブロックの「📋 コピー」ボタンで詳細を取得できる。

---

## セキュリティ注意

- **`backend/.env` は廃止**。旧 `.env` にAPIキーを書いていた場合は **Anthropic Console で即 revoke** する
- `.gitignore` に `.env` 系は全て登録済
- CORS は `localhost:8000` のみ許可、`allow_credentials=False`
- フロントは全出力を `textContent` / `escapeHtml` 経由で描画（XSS 防御）

---

## ライセンス / 権利

社内利用限定。外部公開・二次配布不可。
ナレッジベース（`data/di-knowledge.json`）は DI の知的財産。
