# NEXT_TASKS.md — di-marketing-ai 社内継続利用システム

最終更新: 2026-04-16（セッション11: Phase 3 実装完了・診断強化・prompt caching 導入）

---

## プロジェクト概要

既存の `di-marketing-ai.html` を FastAPI バックエンド + フロントエンド分離構成に移行済み。
APIキーは **ダッシュボードの「⚙ 設定」から登録し、プロセス内 state に保持**（`.env` は廃止）。サーバー再起動ごとに再登録が必要。

---

## ✅ 実装完了ファイル一覧

### backend/
| ファイル | 内容 |
|---|---|
| `requirements.txt` | anthropic≥0.49.0 / fastapi / uvicorn / aiofiles / pyyaml |
| `__init__.py` | パッケージ初期化 |
| `models.py` | `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` を環境変数フックで切替 |
| `knowledge_loader.py` | `data/di-knowledge.json` の lru_cache 読み込み（30 ブロック） |
| `agent_registry.py` | 全 11 エージェントのメタ・プロンプト・`build_agent_sys_prompt_blocks`（prompt caching 対応） |
| `planner.py` | claude-sonnet-4-6 で 2〜4 個自動選択（system prompt 全体を cache_control） |
| `agent_runner.py` | SDK streaming + Haiku バトン圧縮（8 秒タイムアウト、静的部分キャッシュ） |
| `pipeline.py` | Plan → Execute → Synthesize の SSE AsyncGenerator。`save_result()` 統合済み |
| `main.py` | FastAPI + CORS（ローカル同一オリジンに絞った）+ 全エンドポイント |
| `memory_store.py` | `results.json` / `patterns.json` を asyncio.Lock で排他書き込み |
| `experiment_loop.py` | 同一ゴール複数バリアントの並列実行 + LLM-as-a-Judge 比較（API は未配線） |

### agents/
11 ファイル（research×2・strategy×3・creative×4・media×2） — フロントマター + プロンプト雛形

### harness/
| ファイル | 内容 |
|---|---|
| `AGENTS.md` | エージェント一覧（機械可読） |
| `RULES.md` | 全エージェント共通ルール・SSE 仕様 |
| `CONFIG.yaml` | モデル名・max_tokens・タイムアウト設定 |

### data/
- `di-knowledge.json` — 30 ブロックのナレッジベース（`"選ばせる"` 不正クォート修正済）
- `persona_data.json` — 5 ペルソナのサンプル（30代女性会社員 / 40代男性管理職 / 20代男性学生 / 50代女性専業主婦 / B2B SaaSマーケ責任者）
- `memory/results.json` / `memory/patterns.json` — 実行ごとに永続化

### frontend/
- `index.html` — マークアップ。ヘッダーに `⚙ 設定` ボタン
- `app.js` — SSE クライアント + 常時コピペ対応（チャット・タスク目標・プラン理由・エージェント出力・統合出力）
- `styles.css` — デザイントークン。ヘッダー `position:sticky`、`.exec-error` 永続エラー枠、`.copy-btn` 共通スタイル

### scripts/
- `start.ps1` — uvicorn 起動（`.env` 自動生成ロジック削除済）
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
- [ ] `/api/plan` に `{"goal":"新商品のコンセプトを作りたい"}` を POST するとエージェントリストが返る
- [ ] フロントから目標入力 → 送信で SSE トークンが流れる
- [ ] 統合アウトプットが表示される
- [ ] ↓ export ボタンで Markdown がダウンロードされる
- [ ] サーバーログに `agent=... cache_read=XXXX cache_create=YYYY ...` が出て prompt caching が効いている
- [ ] エラー時に画面の赤枠 `.exec-error` ブロックに full error（`request_id` 含む）が永続表示される

---

## 🟢 今後の候補タスク（Phase 4）

| ファイル / 領域 | 内容 | 優先度 |
|---|---|---|
| `main.py` | `/api/experiment` エンドポイントを追加して `experiment_loop.run_experiment` を wire up | 中 |
| `frontend/` | `persona_data.json` を読み込み、ペルソナ選択 UI（プルダウン or カード）を追加 | 中 |
| `frontend/` | タスク履歴（`/api/memory/results`）をサイドバーでクリック読み込み可能に | 中 |
| `backend/` | Chat エンドポイントにも SSE ストリーミング化（現状は一括レスポンス） | 低 |
| `backend/` | レート制限検出 → 自動リトライ（exponential backoff） | 低 |
| ドキュメント | `README.md` を新規作成し社内向け運用手順をまとめる | 低 |

---

## 📋 最近のセッションでの改善サマリー（セッション11）

### 診断強化
- 400 エラーの原因特定に必要な情報を可視化
- `planner.py` の 80 文字 truncation 撤廃、`{e!r}` で full error + `logger.exception`
- `pipeline.py` の 3 except 句に `_log.exception` 追加
- `agent_runner.compress_context` の silent catch → `_log.warning`
- フロント `.exec-error` 永続エラー枠と `console.error` でコピペ可能に
- 上記により「Your credit balance is too low」を即座に発見可能

### Prompt Caching 導入
- `build_agent_sys_prompt_blocks()` 新設。静的（ナレッジ + ルール ≈ 6000 字）を `cache_control: ephemeral`、動的（context + baton）は別ブロック
- planner / agents / synthesis / chat すべて blocks 形式
- `stream.get_final_message()` で `cache_read_input_tokens` を info ログ出力
- **2 回目以降のエージェント呼び出しで入力トークン 90% 割引**

### ユーザビリティ
- ヘッダー `position:sticky;z-index:100` で HARNESS/AGENTS タブが常時表示
- 全出力エリアに「📋 コピー」ボタン（チャット吹き出しはホバーで表示）
- `copy-btn` 共通スタイル、`navigator.clipboard` + textarea フォールバック
- XSS 防御：`renderAgentNav` / `renderAgentCards` / `handleSSEEvent` の name/desc/id を `escapeHtml`

### セキュリティ / 整理
- `.env` 廃止、`python-dotenv` 依存削除、`start.ps1` の `.env` 生成ブロック削除
- CORS を `localhost:8000` のみに絞り、`allow_credentials=False` に
- `data/di-knowledge.json` の不正クォート（`"選ばせる"`）を修正、JSON 30 ブロック正常パース

---

## API エンドポイント一覧

| パス | メソッド | 説明 |
|---|---|---|
| `/api/health` | GET | ヘルスチェック（API キー設定済みかを含む） |
| `/api/config` | GET/POST | API キーの取得（マスク済み）/ 設定 |
| `/api/agents` | GET | エージェント一覧（フロント向けメタ） |
| `/api/plan` | POST | エージェント選択（デバッグ用） |
| `/api/run` | POST | パイプライン実行（SSE ストリーミング） |
| `/api/agents/{id}/chat` | POST | 個別エージェントチャット（502 で Anthropic エラー透過） |
| `/api/memory/results` | GET | タスク履歴取得 |
| `/api/memory/patterns` | GET | パターン集計取得 |
| `/docs` | GET | Swagger UI |

---

## 🔐 運用メモ

- **API キー**: 起動ごとに UI から再登録（永続化しない設計）。キーがログに出る経路は `logger.exception` のみなので、本番では INFO/WARNING 相当に絞ること推奨
- **モデル切替**: `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` 環境変数でオーバーライド
- **クレジット監視**: Anthropic Console の Plans & Billing。残高不足は 400 invalid_request_error で表面化する
- **Prompt caching TTL**: 5 分。同じ system prompt での連続呼び出しが閾値内なら 90% 割引
