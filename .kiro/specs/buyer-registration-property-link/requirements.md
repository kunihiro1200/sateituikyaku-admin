# 要件定義書

## イントロダクション

新規買主登録ページにおいて、左側に表示されている物件情報に物件詳細画面へのリンクを追加する機能を実装します。これにより、ユーザーは買主登録中に物件の詳細情報を素早く確認できるようになります。

## 用語集

- **新規買主登録ページ**: 買主の基本情報や問い合わせ情報を入力して新規登録を行う画面（`/buyers/new`）
- **物件情報エリア**: 新規買主登録ページの左側に表示される物件の基本情報を表示するエリア
- **物件詳細画面**: 物件の詳細情報を表示する画面（`/property-listings/:propertyNumber`）
- **System**: 新規買主登録ページのフロントエンドシステム
- **Property_Link**: 物件詳細画面へのリンクコンポーネント

## 要件

### 要件1: 物件情報エリアにリンクを表示

**ユーザーストーリー**: ユーザーとして、新規買主登録ページの物件情報エリアから物件詳細画面に直接遷移したい。そうすることで、買主登録中に物件の詳細情報を素早く確認できる。

#### 受入基準

1. WHEN 物件番号が入力されている AND 物件情報が正常に取得されている、THE System SHALL 物件情報エリアの上部に物件詳細画面へのリンクを表示する
2. THE Property_Link SHALL 「物件詳細を見る」というラベルを表示する
3. THE Property_Link SHALL アイコン（OpenInNewアイコン）を含む
4. THE Property_Link SHALL Material-UIのButtonコンポーネントとして実装される
5. THE Property_Link SHALL `variant="outlined"` および `size="small"` のスタイルを持つ

### 要件2: リンクのクリック動作

**ユーザーストーリー**: ユーザーとして、物件詳細リンクをクリックしたときに新しいタブで物件詳細画面が開くようにしたい。そうすることで、買主登録フォームの入力内容を失わずに物件情報を確認できる。

#### 受入基準

1. WHEN ユーザーがProperty_Linkをクリックする、THE System SHALL 新しいタブで物件詳細画面を開く
2. THE System SHALL 現在のタブの買主登録フォームの入力内容を保持する
3. THE System SHALL 物件詳細画面のURL `/property-listings/:propertyNumber` に遷移する（:propertyNumberは入力された物件番号）

### 要件3: リンクの表示条件

**ユーザーストーリー**: ユーザーとして、物件番号が入力されていない場合や物件情報が取得できない場合はリンクを表示しないでほしい。そうすることで、無効なリンクをクリックするリスクを回避できる。

#### 受入基準

1. WHEN 物件番号フィールドが空である、THE System SHALL Property_Linkを表示しない
2. WHEN 物件情報の取得に失敗した、THE System SHALL Property_Linkを表示しない
3. WHEN 物件情報を読み込み中である、THE System SHALL Property_Linkを表示しない
4. WHEN 物件情報が正常に取得された、THE System SHALL Property_Linkを表示する

### 要件4: リンクの配置位置

**ユーザーストーリー**: ユーザーとして、物件詳細リンクが物件情報エリアの目立つ位置に配置されていてほしい。そうすることで、リンクを素早く見つけてクリックできる。

#### 受入基準

1. THE System SHALL Property_Linkを物件情報エリアのタイトル「物件情報」の直下に配置する
2. THE System SHALL Property_Linkを物件番号入力フィールドの上に配置する
3. THE System SHALL Property_Linkに適切なマージン（下部に16px）を設定する
4. THE System SHALL Property_Linkを全幅（fullWidth）で表示する

### 要件5: アクセシビリティ

**ユーザーストーリー**: ユーザーとして、物件詳細リンクがアクセシブルであってほしい。そうすることで、スクリーンリーダーやキーボード操作でもリンクを利用できる。

#### 受入基準

1. THE Property_Link SHALL `aria-label`属性に「物件詳細を新しいタブで開く」という説明を含む
2. THE Property_Link SHALL キーボードのEnterキーまたはSpaceキーで操作可能である
3. THE Property_Link SHALL フォーカス時に視覚的なフィードバック（アウトライン）を表示する
4. THE Property_Link SHALL `target="_blank"` および `rel="noopener noreferrer"` 属性を持つ（セキュリティ対策）

