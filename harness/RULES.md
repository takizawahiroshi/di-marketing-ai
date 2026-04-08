# DI Marketing AI — ハーネスルール

## 品質基準（全エージェント共通）

### 必須達成条件

1. **DI固有性**: DI独自のフレームワーク・数値（CV率10〜30%、売上20〜40%向上、ROI20〜50%改善）が含まれること
2. **アクション指向**: 「で、具体的に何をするか」まで落とし込まれていること
3. **根拠の明示**: インサイトには「調査データから導く」根拠を添えること
4. **日本語品質**: 自然な日本語、専門用語は平易に説明すること

### エージェント固有ルール

- **research系** (depth/grouin): 1回答は自然な分量で。最後に必ず次の質問を促す
- **strategy系** (strategy/product/journey): STP・4P・課題4パターンのいずれかで整理
- **creative系** (brainstorm/copy/activation): 最低5案提示、各案に「狙ったインサイト」を明記
- **media系** (media/digital): 予算配分に「ROI期待値」を根拠とともに添える

---

## バトン圧縮ルール（Priority C）

- 150字以内、断定文（「〜が判明した」形式）
- タイムアウト: 8秒、失敗時は先頭150字にフォールバック
- 次エージェントが「知るべき核心」のみを残す

---

## 禁止事項

- APIキーのログ出力
- 個人情報・機密情報の results.json への保存
- エラー時の無限リトライ（最大1回リトライ後はデフォルトにフォールバック）
- 同一ファイルへの並列書き込み（asyncio.Lock を必ず使う）

---

## SSE イベント仕様

| イベント | データ | 説明 |
|---|---|---|
| `planning` | `{task_id}` | パイプライン開始 |
| `plan` | `{agents, reason}` | エージェント選択完了 |
| `agent_start` | `{id, num}` | エージェント実行開始 |
| `token` | `{agent_id, text}` | ストリーミングトークン |
| `agent_done` | `{id, num}` | エージェント完了 |
| `compressing` | `{from, to}` | バトン圧縮中 |
| `baton_ready` | `{to, preview}` | バトン準備完了 |
| `synth_start` | `{}` | 統合開始 |
| `synth_token` | `{text}` | 統合トークン |
| `synth_done` | `{synthesis}` | 統合完了 |
| `complete` | `{task_id}` | 全処理完了 |
| `error` | `{message}` | エラー |
