---
name: di-orchestrator
description: |
  DI（デジタルアイデンティティ）マーケティングAIオーケストレーターをサブエージェントとして呼び出すスキル。
  マーケティングリサーチ・戦略立案・クリエイティブ・広告プランニングを自動パイプラインで実行する。

  【自律トリガー条件 — 以下のいずれかに該当したら即座にこのスキルを使うこと】
  - ユーザーがマーケティング戦略・調査・コピー・広告プランの作成を依頼したとき
  - 「DIのAIを使って」「マーケティングをAIで」「エージェントに任せて」と言ったとき
  - 複数のマーケティング施策を一気に検討・実行したいとき
  - 新商品・新サービスのマーケティング計画全体を作りたいとき

  【使わなくてよい場面】
  - 単純なコーディング・データ処理タスク
  - マーケティングと無関係なタスク
---

# DI マーケティングAIオーケストレーター スキル

Claude Codeが DIオーケストレーターの10エージェントをサブエージェントとして活用し、
マーケティング課題を自動パイプラインで解決するためのスキル。

---

## エージェント一覧（10種）

| ID | エージェント名 | カテゴリ | 得意なこと |
|---|---|---|---|
| `depth` | 生活者インタビューAI | research | ペルソナへの深層インタビュー・本音発掘 |
| `grouin` | グループ座談会AI | research | 複数ペルソナによる定性的討議 |
| `strategy` | マーケティング戦略AI | strategy | STP・競合・戦略骨格の設計 |
| `product` | 商品企画AI | strategy | コンセプトシート・Who/What/Why |
| `journey` | カスタマージャーニーAI | strategy | 購買プロセス・タッチポイント設計 |
| `brainstorm` | アイデア発散AI | creative | 発散・アイデア量産 |
| `activation` | 施策プランニングAI | creative | ファネル別施策・ロードマップ |
| `copy` | コピーライティングAI | creative | キャッチコピー・ネーミング・メッセージ |
| `media` | メディアプランAI | media | マスメディア統合プラン |
| `digital` | デジタル広告AI | media | SNS・検索・プログラマティック |

---

## オーケストレーションの仕組み

```
ユーザーの課題（自然言語）
    ↓ Step 1: Plan
    Claude APIがタスクを分析し、最適なエージェント2〜4個を自動選択・順序決定
    ↓ Step 2: Execute  
    エージェントを順次実行（前エージェントの出力→次エージェントの入力に自動チェーン）
    ↓ Step 3: Synthesize
    全出力を統合してクライアントへの最終アウトプットを生成
```

---

## Claude CodeからのAPI呼び出し

### 環境変数の設定
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Python での実装例

```python
import anthropic
import json

client = anthropic.Anthropic()

# Step 1: プランナー（どのエージェントを使うか決定）
def plan_task(user_goal: str) -> dict:
    agents_desc = """
    depth: 生活者インタビューAI（ペルソナへの深層インタビュー）
    grouin: グループ座談会AI（複数ペルソナによる討議）
    strategy: マーケティング戦略AI（STP・競合・戦略設計）
    product: 商品企画AI（コンセプトシート・Who/What/Why）
    journey: カスタマージャーニーAI（購買プロセス・タッチポイント）
    brainstorm: アイデア発散AI（アイデア量産）
    activation: 施策プランニングAI（ファネル別施策）
    copy: コピーライティングAI（キャッチコピー・メッセージ）
    media: メディアプランAI（マスメディア統合プラン）
    digital: デジタル広告AI（SNS・検索広告）
    """
    
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=500,
        system=f"DIのオーケストレーターAI。利用可能エージェント:\n{agents_desc}\n最適な2〜4個を選びJSONで返す。フォーマット: {{\"agents\":[\"id1\",\"id2\"],\"reason\":\"理由\"}}",
        messages=[{"role": "user", "content": f"タスク: {user_goal}"}]
    )
    text = response.content[0].text
    # JSON抽出
    import re
    m = re.search(r'\{[\s\S]*?\}', text)
    return json.loads(m.group(0)) if m else {"agents": ["strategy"], "reason": "デフォルト"}


# Step 2: 各エージェントを実行（チェーン）
def execute_agent(agent_id: str, user_goal: str, context: str = "") -> str:
    agent_prompts = {
        "depth": "デプスインタビューAIとして、ペルソナへの深層インタビューを実施し本音を発掘する。",
        "strategy": "マーケティング戦略AIとして、STP・4P・課題別アプローチで実践的な戦略を設計する。",
        "product": "商品プランナーAIとして、Who×What×Why(RTB)の構造でコンセプトを複数案設計する。",
        "copy": "コピーライターAIとして、インサイトとベネフィットを掛け合わせたコピーを5案以上生成する。",
        # 他のエージェントも同様...
    }
    
    sys_prompt = agent_prompts.get(agent_id, "DIのマーケティングAIとして最高品質のアウトプットを出す。")
    if context:
        sys_prompt += f"\n\n【前エージェントの要点】\n{context[:500]}"
    
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1800,
        system=sys_prompt,
        messages=[{"role": "user", "content": f"タスク: {user_goal}\n最高品質のアウトプットを日本語で出してください。"}]
    )
    return response.content[0].text


# Step 3: 統合
def synthesize(user_goal: str, results: list[dict]) -> str:
    combined = "\n\n".join([f"【{r['agent']}の出力】\n{r['output'][:800]}" for r in results])
    
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        system="DIのシンセサイザーAI。複数エージェントの出力を統合し、クライアントへの最終アウトプットとして整理する。",
        messages=[{"role": "user", "content": f"タスク: {user_goal}\n\n{combined}"}]
    )
    return response.content[0].text


# メインの実行フロー
def run_di_orchestrator(user_goal: str) -> str:
    print(f"🎯 タスク: {user_goal}")
    
    # 1. プランニング
    plan = plan_task(user_goal)
    print(f"📋 選択エージェント: {plan['agents']}")
    print(f"💡 理由: {plan['reason']}")
    
    # 2. エージェント実行
    results = []
    context = ""
    for agent_id in plan['agents']:
        print(f"⚡ {agent_id} 実行中...")
        output = execute_agent(agent_id, user_goal, context)
        results.append({"agent": agent_id, "output": output})
        context = output  # 次のエージェントへチェーン
        print(f"✓ {agent_id} 完了")
    
    # 3. 統合
    print("🔄 統合中...")
    final_output = synthesize(user_goal, results)
    print("✅ 完了")
    
    return final_output


# 使用例
if __name__ == "__main__":
    goal = "30代女性向け新商品のコンセプトとキャッチコピーをリサーチから一気に作りたい"
    result = run_di_orchestrator(goal)
    print("\n" + "="*60)
    print("最終アウトプット:")
    print("="*60)
    print(result)
```

---

## DI_KNOWLEDGE の活用

オーケストレーターには38ブロックのDI固有ナレッジが組み込まれています。
詳細は `di-knowledge.json` を参照してください。

```python
import json

# DIナレッジを読み込んでコンテキストに追加
with open('di-knowledge.json') as f:
    knowledge = json.load(f)

# 業種別に事例を抽出
case_studies = [b for b in knowledge['blocks'] if b['category'] == 'case_study']
methods = [b for b in knowledge['blocks'] if b['category'] == 'method']

# システムプロンプトに追加
di_context = "\n\n".join([b['content'] for b in case_studies[:5]])
```

---

## ナレッジカバレッジ

### 対応業種（実績事例あり）
- 生命保険（ソニー生命・アクサ生命）
- 資産運用（三井住友DSアセットマネジメント）
- 損害保険（日本損害保険協会）
- 不動産（大京 THE LIONS）
- リースバック（一建設）
- 中古車買取（アップルオートネットワーク）
- SaaS（Nimway 座席管理システム）
- フォトスタジオ（らかんスタジオ）
- BtoB製造業（住友金属鉱山 / クロスマイニング）
- 金融機関（内閣府・日本証券業協会・全国地方銀行協会・全国銀行協会）

### 対応調査手法
- Webアンケート（定量・大規模）
- デプスインタビュー（定性・深層）
- グループインタビュー
- 覆面調査（競合調査）
- 面談時アンケート（継続トラッキング）
- KW調査・SEO分析
- GA分析・Web解析

---

## 参考ファイル

| ファイル | 内容 |
|---|---|
| `di-orchestrator.html` | ブラウザで動くGUI版オーケストレーター |
| `di-marketing-ai-v4.html` | エージェント別チャットUI（ナレッジ38ブロック込み） |
| `di-knowledge.json` | DI_KNOWLEDGEの機械可読JSON（38ブロック・4カテゴリ） |
