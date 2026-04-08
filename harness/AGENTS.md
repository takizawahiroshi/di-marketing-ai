# DI Marketing AI — エージェント一覧

バックエンドが参照するエージェントメタデータ。
詳細なプロンプトは `agents/**/*.md` と `backend/agent_registry.py` を参照。

## Research

| ID | 名前 | 説明 |
|---|---|---|
| `depth` | 生活者インタビューAI | ペルソナを模したAI生活者として深層インタビューに応じる |
| `grouin` | グループ座談会AI | 3〜5名の架空生活者による座談会を自動進行し、インサイトをまとめる |

## Strategy

| ID | 名前 | 説明 |
|---|---|---|
| `strategy` | マーケティング戦略AI | 課題タイプを特定し、STP・4パターン別アプローチで戦略骨格を設計 |
| `product` | 商品企画AI | Who/What/Why 構造でコンセプトをA/B/C案比較形式で提示 |
| `journey` | お客様の行動マップAI | 認知→購入→共有の各フェーズで感情・タッチポイント・施策を整理 |

## Creative

| ID | 名前 | 説明 |
|---|---|---|
| `brainstorm` | アイデア出しAI | SCAMPER・逆転発想で発散フェーズのアイデアを大量生成 |
| `activation` | 施策プランニングAI | 短期/中期/長期フレームで統合施策ロードマップを設計 |
| `copy` | コピーライティングAI | インサイト起点で最低5案のコピーを方向性別に提示 |
| `content` | コンテンツサジェストAI | 検索意図・感情トリガー・拡散動機の3軸でコンテンツ案を生成 |

## Media

| ID | 名前 | 説明 |
|---|---|---|
| `media` | 広告メディアプランAI | ターゲットのメディア接触データ基づくメディアミックス最適化 |
| `digital` | SNS・デジタル広告AI | ソーシャルリスニング×調査データでデジタル施策とA/Bテスト計画を設計 |

---

## 推奨パイプラインパターン

| ゴール | 推奨エージェント構成 |
|---|---|
| コンセプト開発 | depth → strategy → product → copy |
| 広告プランニング | strategy → copy → media → digital |
| 市場調査 | depth → grouin → strategy |
| SEO/コンテンツ | strategy → content → digital |
| 施策ロードマップ | strategy → activation → media |
