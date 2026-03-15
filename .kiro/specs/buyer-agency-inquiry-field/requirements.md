# 要件ドキュメント

## はじめに

新規買主登録画面（`NewBuyerPage.tsx`）において、「法人名」フィールドに入力がある場合に「業者問合せ」フィールドを条件付きで表示する機能を追加する。

`broker_inquiry`カラムはデータベース（`buyers`テーブル）およびスプレッドシートマッピング（`buyer-column-mapping.json`）に既に存在しており、フロントエンドへの追加のみが必要となる。

また、買主詳細画面（`BuyerDetailPage.tsx`）との統合ルールに従い、同画面にも同様のフィールドを追加する。

## 用語集

- **NewBuyerPage**: `frontend/frontend/src/pages/NewBuyerPage.tsx` - 新規買主登録画面
- **BuyerDetailPage**: `frontend/frontend/src/pages/BuyerDetailPage.tsx` - 買主詳細画面
- **法人名フィールド**: `company_name` カラムに対応するフォームフィールド
- **業者問合せフィールド**: `broker_inquiry` カラムに対応するフォームフィールド
- **BUYER_FIELD_SECTIONS**: BuyerDetailPage で使用されるフィールド定義の配列

## 要件

### 要件1: 新規買主登録画面への法人名フィールド追加

**ユーザーストーリー:** 担当者として、新規買主登録時に法人名を入力できるようにしたい。そうすることで、業者からの問い合わせを正確に記録できる。

#### 受け入れ基準

1. THE NewBuyerPage SHALL 基本情報セクションに「法人名」（`company_name`）フィールドを表示する
2. WHEN 「法人名」フィールドに1文字以上の入力がある場合、THE NewBuyerPage SHALL 「業者問合せ」フィールドを表示する
3. WHEN 「法人名」フィールドが空欄の場合、THE NewBuyerPage SHALL 「業者問合せ」フィールドを非表示にする
4. WHEN 「法人名」フィールドがクリアされた場合、THE NewBuyerPage SHALL 「業者問合せ」フィールドを非表示にし、選択済みの値をリセットする

---

### 要件2: 業者問合せフィールドの選択肢

**ユーザーストーリー:** 担当者として、業者問い合わせの種別を選択できるようにしたい。そうすることで、業者問い合わせの内容を正確に分類できる。

#### 受け入れ基準

1. THE 業者問合せフィールド SHALL 以下の2つの選択肢を提供する：
   - 「業者問合せ」
   - 「業者（両手）」
2. THE 業者問合せフィールド SHALL ドロップダウン形式で表示する
3. WHEN 業者問合せフィールドが表示されている場合、THE NewBuyerPage SHALL 未選択状態（空）を初期値とする

---

### 要件3: 登録時のデータ送信

**ユーザーストーリー:** 担当者として、業者問合せの値が登録データに含まれるようにしたい。そうすることで、スプレッドシートと正しく同期される。

#### 受け入れ基準

1. WHEN 登録ボタンが押された場合、THE NewBuyerPage SHALL `broker_inquiry` フィールドの値を `POST /api/buyers` リクエストに含める
2. WHEN 「法人名」が空欄で登録された場合、THE NewBuyerPage SHALL `broker_inquiry` を空文字列として送信する
3. THE NewBuyerPage SHALL `broker_inquiry` の値をスプレッドシートの「業者問合せ」カラムにマッピングされた形式で送信する

---

### 要件4: 買主詳細画面への業者問合せフィールド追加（統合ルール）

**ユーザーストーリー:** 担当者として、登録後の買主詳細画面でも業者問合せを確認・編集できるようにしたい。そうすることで、登録後に情報を修正できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 基本情報セクションの「法人名」フィールドの直後に「業者問合せ」フィールドを表示する
2. WHEN 買主の `company_name` が空欄の場合、THE BuyerDetailPage SHALL 「業者問合せ」フィールドを非表示にする
3. WHEN 買主の `company_name` に値がある場合、THE BuyerDetailPage SHALL 「業者問合せ」フィールドを表示する
4. THE BuyerDetailPage SHALL 「業者問合せ」フィールドをインライン編集可能なドロップダウンとして表示する
5. THE BuyerDetailPage SHALL 「業者問合せ」の選択肢として「業者問合せ」と「業者（両手）」を提供する
