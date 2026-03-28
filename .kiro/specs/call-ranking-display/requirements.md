# 要件定義書

## はじめに

売主リストの通話モードページに、「1番電話」の当月件数をスタッフごとに集計し、ランキング形式で表示する機能を追加する。スタッフ間の競争意識を高め、1番電話の件数向上を促進することを目的とする。

「1番電話」とは、反響があった売主に対して最初に電話をかけた担当者を記録するフィールドであり、`sellers` テーブルの `first_call_person` カラム（スタッフのイニシャル: Y, I など）に格納されている。

## 用語集

- **Call_Ranking_Display**: 1番電話ランキング表示コンポーネント（フロントエンド）
- **Call_Ranking_API**: 1番電話ランキング集計APIエンドポイント（バックエンド）
- **First_Call_Person**: `sellers.first_call_person` カラムに格納されたスタッフのイニシャル
- **当月**: APIリクエスト時点の年月（例: 2026年4月）
- **通話モードページ**: `CallModePage.tsx` が担うページ（`/sellers/:id/call`）

---

## 要件

### 要件1: 当月の1番電話件数集計API

**ユーザーストーリー:** スタッフとして、今月自分が何件1番電話をかけているか確認したい。そうすることで、自分の貢献度を把握できる。

#### 受け入れ基準

1. THE Call_Ranking_API SHALL 当月（リクエスト時点の年月）に `first_call_person` が設定された `sellers` レコードを集計し、スタッフのイニシャルごとの件数を返す。
2. WHEN `first_call_person` が空欄または NULL の `sellers` レコードが存在する場合、THE Call_Ranking_API SHALL そのレコードを集計対象から除外する。
3. THE Call_Ranking_API SHALL 件数の多い順（降順）にソートされた配列を返す。
4. THE Call_Ranking_API SHALL 件数が同じスタッフが複数いる場合、イニシャルのアルファベット順（昇順）で並べる。
5. THE Call_Ranking_API SHALL 当月に1番電話が0件のスタッフはレスポンスに含めない。
6. WHEN 認証されていないリクエストが来た場合、THE Call_Ranking_API SHALL 401エラーを返す。
7. THE Call_Ranking_API SHALL レスポンスを以下の形式で返す:
   ```json
   [
     { "initial": "Y", "count": 12 },
     { "initial": "I", "count": 8 }
   ]
   ```

### 要件2: 当月の集計対象期間の定義

**ユーザーストーリー:** 管理者として、ランキングが正確な期間で集計されることを確認したい。そうすることで、公平な競争環境を提供できる。

#### 受け入れ基準

1. THE Call_Ranking_API SHALL `sellers.inquiry_date`（反響日付）が当月1日から当月末日（JST）の範囲にあるレコードを集計対象とする。
2. WHEN 月が変わった場合、THE Call_Ranking_API SHALL 自動的に新しい月の集計を開始する（前月のデータはリセットされる）。
3. THE Call_Ranking_API SHALL 集計に使用した期間（開始日・終了日）をレスポンスに含める:
   ```json
   {
     "period": { "from": "2026-04-01", "to": "2026-04-30" },
     "rankings": [...]
   }
   ```

### 要件3: ランキング表示コンポーネント

**ユーザーストーリー:** スタッフとして、通話モードページで1番電話のランキングを一目で確認したい。そうすることで、競争意識を持って業務に取り組める。

#### 受け入れ基準

1. THE Call_Ranking_Display SHALL 通話モードページ（`CallModePage`）内に表示される。
2. THE Call_Ranking_Display SHALL 1位から順に、イニシャルと件数を表示する。
3. THE Call_Ranking_Display SHALL 1位のスタッフを視覚的に強調表示する（例: 金色・トロフィーアイコン）。
4. THE Call_Ranking_Display SHALL 2位・3位のスタッフを視覚的に区別して表示する（例: 銀色・銅色）。
5. THE Call_Ranking_Display SHALL 当月の集計期間（例: 「2026年4月」）を表示する。
6. WHEN ランキングデータの取得中である場合、THE Call_Ranking_Display SHALL ローディングインジケーターを表示する。
7. IF ランキングデータの取得に失敗した場合、THEN THE Call_Ranking_Display SHALL エラーメッセージを表示し、再試行ボタンを提供する。
8. WHEN 当月に1番電話の記録が存在しない場合、THE Call_Ranking_Display SHALL 「今月はまだ記録がありません」というメッセージを表示する。

### 要件4: ランキングの競争促進表示

**ユーザーストーリー:** スタッフとして、ランキングを見て競争意識が高まるような表示を見たい。そうすることで、モチベーションを維持できる。

#### 受け入れ基準

1. THE Call_Ranking_Display SHALL 各スタッフの順位番号（1位、2位、3位...）を表示する。
2. THE Call_Ranking_Display SHALL 1位のスタッフに対してトロフィー（🏆）または王冠アイコンを表示する。
3. THE Call_Ranking_Display SHALL 件数バーまたは視覚的なインジケーターで件数の相対的な大きさを表現する。
4. WHERE 表示スペースが限られている場合、THE Call_Ranking_Display SHALL 上位5名のみを表示し、残りは折りたたんで表示する。

### 要件5: データの鮮度

**ユーザーストーリー:** スタッフとして、最新のランキングを確認したい。そうすることで、リアルタイムに近い競争状況を把握できる。

#### 受け入れ基準

1. THE Call_Ranking_Display SHALL ページ表示時に自動的にランキングデータを取得する。
2. THE Call_Ranking_Display SHALL 手動更新ボタンを提供し、ユーザーが任意のタイミングでランキングを更新できるようにする。
3. THE Call_Ranking_API SHALL レスポンスに最終更新日時を含める。
4. IF ランキングAPIのレスポンスが5秒以内に返らない場合、THEN THE Call_Ranking_Display SHALL タイムアウトエラーを表示する。
