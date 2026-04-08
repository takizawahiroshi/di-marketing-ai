# NEXT_TASKS.md — di-marketing-ai 社内継続利用システム

最終更新: 2026-04-08（セッション10: Phase 1〜2 実装完了 ✅）

---

## プロジェクト概要

既存の `di-marketing-ai.html` を FastAPI バックエンド + フロントエンド分離構成に移行完了。
APIキーを `backend/.env` に隠蔽し、社内共用環境で安全・安定運用できる状態。

---

## ✅ 実装完了ファイル一覧

### backend/
| ファイル | 内容 |
|---|---|
| `requirements.txt` | anthropic / fastapi / uvicorn / python-dotenv / pyyaml |
| `.env` | ANTHROPIC_API_KEY のプレースホルダー（**要書き換え**） |
| `__init__.py` | パッケージ初期化 |
| `knowledge_loader.py` | di-knowledge.json の lru_cache 読み込み |
| `agent_registry.py` | 全11エージェントのメタデータ・プロンプト・ビルダー |
| `planner.py` | claude-sonnet-4-6 でエージェント2〜4個を自動選択 |
| `agent_runner.py` | SDK streaming + Haiku 圧縮（8秒タイムアウト） |
| `pipeline.py` | Plan→Execute→Synthesize の SSE AsyncGenerator |
| `main.py` | FastAPI + CORS + 全エンドポイント |
| `memory_store.py` | results.json / patterns.json 排他書き込み |

### agents/
10ファイル（research×2, strategy×3, creative×3, media×2）— frontmatter + プロンプト

### harness/
| ファイル | 内容 |
|---|---|
| `AGENTS.md` | エージェント一覧（機械可読） |
| `RULES.md` | 全エージェント共通ルール・SSE仕様 |
| `CONFIG.yaml` | モデル名・max_tokens・タイムアウト設定 |

### data/
- `di-knowledge.json` — 38ブロックのナレッジベース
- `memory/results.json` — タスク結果（初期: 空）
- `memory/patterns.json` — パターン集計（初期: 空）

### frontend/
- `styles.css` — 既存HTMLから抽出したデザイントークン
- `index.html` — マークアップ（APIキーモーダル削除済み）
- `app.js` — SSEクライアント + DOM更新 + エクスポート

### scripts/
- `start.ps1` — uvicorn 起動（.env チェック付き）
- `export_memory.ps1` — results.json → CSV エクスポート

---

## 🚀 次回セッション: 起動・動作確認

### 手順

```powershell
# 1. APIキーを設定（backend/.env を編集）
notepad C:\Users\hiroshi_takizawa\di-marketing-ai\backend\.env
# → ANTHROPIC_API_KEY=sk-ant-api03-xxxx に書き換える

# 2. 依存インストール（初回のみ）
cd C:\Users\hiroshi_takizawa\di-marketing-ai
pip install -r backend/requirements.txt

# 3. サーバー起動
.\scripts\start.ps1

# 4. ヘルスチェック
# ブラウザで http://localhost:8000/api/health を開く
# → {"status":"ok","agents":11,"api_key_configured":true} を確認

# 5. フロントエンドを開く
# ブラウザで frontend/index.html を開く（または VS Code Live Server）
```

### テスト観点

- [ ] `/api/health` が `api_key_configured: true` を返す
- [ ] `/api/agents` で 11 エージェントが返る
- [ ] `/api/plan` に `{"goal":"新商品のコンセプトを作りたい"}` を POST するとエージェントリストが返る
- [ ] フロントから目標入力 → ▶実行 でSSEトークンが流れる
- [ ] 統合アウトプットが表示される
- [ ] ↓ export ボタンで Markdown ファイルがダウンロードされる

---

## 🟢 残タスク（Phase 3）

| ファイル | 内容 | 優先度 |
|---|---|---|
| `backend/experiment_loop.py` | ABテスト生成・結果比較分析 | 低 |
| `data/persona_data.json` | ターゲットウィザード用ペルソナ定義 | 低 |
| agents に `content.md` 追加 | content エージェントの Markdown ファイル | 低 |

---

## APIエンドポイント一覧

| パス | メソッド | 説明 |
|---|---|---|
| `/api/health` | GET | ヘルスチェック |
| `/api/agents` | GET | エージェント一覧 |
| `/api/plan` | POST | エージェント選択（デバッグ用） |
| `/api/run` | POST | パイプライン実行（SSEストリーミング） |
| `/api/agents/{id}/chat` | POST | 個別エージェントチャット |
| `/api/memory/results` | GET | タスク履歴取得 |
| `/api/memory/patterns` | GET | パターン集計取得 |
| `/docs` | GET | Swagger UI |
