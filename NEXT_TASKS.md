# NEXT_TASKS.md — di-marketing-ai 社内継続利用システム

最終更新: 2026-04-16（セッション12: Phase 4 完了・履歴書き換え・public repo 公開）

---

## プロジェクト概要

既存の `di-marketing-ai.html` を FastAPI バックエンド + 静的フロントエンド構成に移行済み。
APIキーは **ダッシュボードの「⚙ 設定」から登録し、プロセス内 state に保持**（`.env` は廃止）。サーバー再起動ごとに再登録が必要。
公開リポ: https://github.com/takizawahiroshi/di-marketing-ai

---

## ✅ 実装完了ファイル一覧

### backend/
| ファイル | 内容 |
|---|---|
| `requirements.txt` | anthropic≥0.49.0 / fastapi / uvicorn / aiofiles / pyyaml |
| `__init__.py` | パッケージ初期化 |
| `models.py` | `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` を環境変数フックで切替 |
| `retry.py` | 429/529/接続系を Retry-After + 指数バックオフで自動リトライ |
| `knowledge_loader.py` | `data/di-knowledge.json` の lru_cache 読み込み（30 ブロック） |
| `agent_registry.py` | 全 11 エージェントのメタ・プロンプト・`build_agent_sys_prompt_blocks`（prompt caching 対応） |
| `planner.py` | claude-sonnet-4-6 で 2〜4 個自動選択（system prompt 全体を cache_control、リトライ付） |
| `agent_runner.py` | SDK streaming + Haiku バトン圧縮（10 秒タイムアウト、静的部分キャッシュ、リトライ付） |
| `pipeline.py` | Plan → Execute → Synthesize の SSE AsyncGenerator。`save_result()` 統合済み |
| `main.py` | FastAPI + CORS（ローカル同一オリジンに絞った）+ 全エンドポイント |
| `memory_store.py` | `results.json` / `patterns.json` を asyncio.Lock で排他書き込み、本文を full text で保存 |
| `experiment_loop.py` | 同一ゴール複数バリアントの並列実行 + LLM-as-a-Judge 比較（`/api/experiment` で配線済） |

### agents/
11 ファイル（research×2・strategy×3・creative×4・media×2） — フロントマター + プロンプト雛形。`creative/content.md` 追加済み

### harness/
| ファイル | 内容 |
|---|---|
| `AGENTS.md` | エージェント一覧（機械可読） |
| `RULES.md` | 全エージェント共通ルール・SSE 仕様 |
| `CONFIG.yaml` | モデル名・max_tokens・タイムアウト設定 |

### data/
- `di-knowledge.json` — 30 ブロックのナレッジベース
- `persona_data.json` — 5 ペルソナのサンプル
- `memory/results.json` / `memory/patterns.json` — 実行ごとに永続化（synthesis/outputs も本文保存）

### frontend/
- `index.html` — ヘッダー sticky、ペルソナプルダウン、settings / context モーダル
- `app.js` — SSE クライアント、履歴復元、ペルソナ適用、常時コピペ、Chat SSE
- `styles.css` — DI デザイントークン、`.exec-error`、`.copy-btn`、`.hist-item`

### ドキュメント
- `README.md` — 社内向け運用手順書（概要 / セットアップ / 起動 / API / トラブル）
- `NEXT_TASKS.md` — 本ファイル

### scripts/
- `start.ps1` — uvicorn 起動
- `export_memory.ps1` — results.json → CSV エクスポート

---

## 🚀 起動・動作確認

### 手順

```powershell
# 1. 依存インストール（初回 / requirements.txt 変更時）
cd C:\Users\hiroshi_takizawa\di-marketing-ai
pip install -r backend/requirements.txt

# 2. サーバー起動
.\scripts\start.ps1
# or
python -m uvicorn backend.main:app --reload --port 8000 --log-level info

# 3. ブラウザで開く
# http://localhost:8000

# 4. APIキー登録（再起動ごと必須）
# 画面右上「⚙ 設定」ボタン → sk-ant-... を入力 → save
# ヘッダーに「connected · 11 agents」が出れば OK

# 5. モデルを切り替えたい場合
$env:ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"
$env:ANTHROPIC_MODEL_FAST = "claude-haiku-4-5-20250929"
python -m uvicorn backend.main:app --reload --port 8000
```

### テスト観点

- [ ] `/api/health` が `api_key_configured: true` を返す
- [ ] `/api/agents` で 11 エージェントが返る
- [ ] フロントから目標入力 → 送信で SSE トークンが流れる
- [ ] 統合アウトプットが表示される
- [ ] 各エージェント / 統合 / チャットに「📋 コピー」ボタンが出て動作する
- [ ] サイドバーの履歴をクリックすると完全復元される
- [ ] コンテキストモーダルのペルソナプルダウンから選ぶと textarea に反映される
- [ ] Chat モード（個別エージェント）がストリーミングでトークンが流れる
- [ ] ↓ export ボタンで Markdown がダウンロードされる
- [ ] サーバーログに `agent=... cache_read=XXXX cache_create=YYYY ...` が出て prompt caching が効いている
- [ ] エラー時に画面の赤枠 `.exec-error` ブロックに full error（`request_id` 含む）が永続表示される

---

## 🟢 今後の候補タスク（Phase 5）

| ファイル / 領域 | 内容 | 優先度 |
|---|---|---|
| `frontend/` | A/B 実験 UI — `/api/experiment` をダッシュボードで叩けるモードを追加。ペルソナ選択を multi-select にして並列比較 | 中 |
| `frontend/` | export 拡張 — 統合だけでなく各エージェント出力も 1 つの Markdown にバンドルしてダウンロード | 中 |
| `frontend/` | プランに対するユーザー介入 — 提示されたエージェント列を手動追加/削除/並び替えして再実行できる | 中 |
| `backend/pipeline.py` | SSE keepalive — 30 秒ごとに `data: :heartbeat\n\n` を挿入（逆プロキシの idle timeout 対策） |  低 |
| `backend/` | 残高監視 — 定期的に Anthropic API に ping して credit balance をヘルスチェックに含める | 低 |
| `tests/` | E2E smoke test（Playwright or pytest + httpx）— push 前に自動で走るようにする | 低 |
| `frontend/app.js` | Markdown レンダリングを正規表現から `marked` / `micromark` に置換（リスト・テーブル・コードブロック対応強化） | 低 |
| `backend/memory_store.py` | results.json の肥大化対策（synthesis が大きくなりすぎたとき自動トリム、または SQLite に移行） | 低 |
| ドキュメント | `CONTRIBUTING.md` で社内コーディング規約とデプロイ手順を整備 | 低 |

---

## 📋 最近のセッション履歴

### セッション 12（2026-04-16 後半）
- **Phase 4 完了**:
  - `/api/experiment` エンドポイント配線（並列実行 + LLM-as-a-Judge）
  - ペルソナ選択 UI（CONTEXT モーダルにプルダウン、`/api/personas` 経由）
  - タスク履歴復元（`/api/memory/results/{task_id}`、memory_store で本文保存、クリックで UI 完全再構築）
  - Chat エンドポイント SSE 化（`/api/agents/{id}/chat` を StreamingResponse に、フロント sendMsg 書き換え）
  - `retry.py` で 429/529/接続系の自動リトライ（Retry-After 尊重、指数バックオフ + jitter）
  - `README.md` 新規作成（概要・セットアップ・起動・API・トラブルシュート）
- **セキュリティ**:
  - GitHub Push Protection が旧コミットの `backend/.env` 内 API キーを検出
  - `git filter-branch` で全履歴から `backend/.env` を除去、`force-push-with-lease` で反映
  - 露出していた API キーは revoke 済み

### セッション 11（2026-04-16 前半）
- **診断強化**:
  - `planner.py` の `str(e)[:80]` 撤廃、`{e!r}` で full error + `logger.exception`
  - `pipeline.py` の 3 except 句に `_log.exception`、`compress_context` の silent catch → `_log.warning`
  - フロント `.exec-error` 永続エラー枠と `console.error` でコピペ可能に
  - これにより「Your credit balance is too low」を即座に特定できた
- **Prompt Caching**: `build_agent_sys_prompt_blocks()` + `cache_control: ephemeral`、2 回目以降の入力トークン 90% 割引
- **UX**: ヘッダー `position:sticky`、「📋 コピー」全箇所、常時 `user-select:text`
- **整理**: `.env` 廃止、`python-dotenv` 削除、CORS をローカル同一オリジンに絞る
- **バグ修正**: `data/di-knowledge.json` の不正クォート（`"選ばせる"` → `「選ばせる」`）

---

## API エンドポイント一覧

| パス | メソッド | 説明 |
|---|---|---|
| `/api/health` | GET | ヘルスチェック（API キー設定済みかを含む） |
| `/api/config` | GET / POST | API キーの取得（マスク済み）/ 設定 |
| `/api/agents` | GET | エージェント一覧メタ |
| `/api/plan` | POST | プランナー単独実行（デバッグ用） |
| `/api/run` | POST | パイプライン実行（**SSE**） |
| `/api/agents/{id}/chat` | POST | 個別エージェントチャット（**SSE**、リトライ付） |
| `/api/memory/results` | GET | タスク履歴一覧（サマリー） |
| `/api/memory/results/{task_id}` | GET | タスク履歴詳細（本文含む） |
| `/api/memory/patterns` | GET | パターン集計 |
| `/api/personas` | GET | ペルソナプリセット一覧 |
| `/api/experiment` | POST | A/B 並列実行 + LLM-as-a-Judge |
| `/docs` | GET | Swagger UI |

---

## 🔐 運用メモ

- **API キー**: 起動ごとに UI から再登録（永続化しない設計）。`.env` に絶対にコミットしないこと
- **モデル切替**: `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` 環境変数でオーバーライド
- **クレジット監視**: Anthropic Console の Plans & Billing。残高不足は 400 invalid_request_error で表面化する
- **Prompt caching TTL**: 5 分。同じ system prompt での連続呼び出しが閾値内なら 90% 割引
- **リトライ**: 429 / 529 / 接続系は自動（Retry-After 尊重）。400 / 401 / 403 / 404 はリトライしない
- **履歴保存上限**: results.json は最大 50 件、1 エージェント出力は 20KB、synthesis は 30KB でトリム

---

## 🚨 開発時の注意

- **`backend/.env` は絶対に作らない・コミットしない**（`.gitignore` 済。Git 履歴から除去済）
- `data/memory/*.json` にはタスクの実出力が入るため、機密案件では定期的に掃除するか gitignore 対象化を検討
- チャット・ハーネスは同じ `ANTHROPIC_MODEL` を共有。モデル切替後は必ずサーバー再起動（プロセス起動時に env を読み取る）
