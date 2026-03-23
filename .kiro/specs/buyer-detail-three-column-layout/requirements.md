# 要件ドキュメント

## はじめに

買主詳細画面（BuyerDetailPage.tsx）を現在の2列レイアウトから3列レイアウトに変更する機能です。
売主の通話モードページ（CallModePage.tsx）と同様に、左・中央・右の3列構成にします。

新たに追加する左列には「通話履歴」と「メール・SMS送信履歴」の2つのセクションを配置します。
「メール・SMS送信履歴」は現在の右列（買主情報フィールドの下）から左列に移動します。

### 現在の画面構成（2列）

- 左列（42%）: 物件詳細カード（PropertyInfoCard）
- 右列（残り）: 買主情報フィールド（BUYER_FIELD_SECTIONS）+ メール・SMS送信履歴 + 関連買主セクション

### 変更後の画面構成（3列）

- 左列（新規追加）: 通話履歴 + メール・SMS送信履歴
- 中央列: 物件詳細カード（PropertyInfoCard）
- 右列: 買主情報フィールド（BUYER_FIELD_SECTIONS）+ 関連買主セクション

---

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **CallModePage**: 売主の通話モードページ（`frontend/frontend/src/pages/CallModePage.tsx`）
- **PropertyInfoCard**: 物件詳細カードコンポーネント
- **BUYER_FIELD_SECTIONS**: 買主情報フィールドのセクション定義（問合せ内容・基本情報・その他）
- **Activity**: 通話・メール・SMS等の活動履歴レコード
- **三列レイアウト**: 左列・中央列・右列の3つの縦スクロール可能な列で構成される画面レイアウト

---

## 要件

### 要件1: 3列レイアウトへの変更

**ユーザーストーリー:** 担当者として、買主詳細画面を3列レイアウトで表示したい。そうすることで、通話履歴・物件情報・買主情報を同時に確認できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 現在の2列レイアウトを3列レイアウトに変更する
2. THE BuyerDetailPage SHALL 左列・中央列・右列の3つの独立したスクロール可能な列を表示する
3. WHEN 画面幅が900px以下の場合、THE BuyerDetailPage SHALL 列を縦に積み重ねて表示する（レスポンシブ対応）
4. THE BuyerDetailPage SHALL 各列が独立してスクロールできるようにする（`maxHeight: calc(100vh - 200px)`, `overflowY: auto`）
5. THE BuyerDetailPage SHALL 各列にカスタムスクロールバースタイルを適用する

---

### 要件2: 左列の新規追加（通話履歴・メール・SMS送信履歴）

**ユーザーストーリー:** 担当者として、買主詳細画面の左列に通話履歴とメール・SMS送信履歴を表示したい。そうすることで、コミュニケーション履歴を一目で確認しながら買主情報を編集できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 左列に「通話履歴」セクションを表示する
2. THE BuyerDetailPage SHALL 左列に「メール・SMS送信履歴」セクションを表示する
3. THE BuyerDetailPage SHALL 「通話履歴」セクションを「メール・SMS送信履歴」セクションの上に配置する
4. WHEN activities に action が 'call' または 'phone_call' のレコードが存在する場合、THE BuyerDetailPage SHALL 通話履歴を一覧表示する
5. IF activities に通話履歴が存在しない場合、THEN THE BuyerDetailPage SHALL 「通話履歴はありません」というメッセージを表示する

---

### 要件3: メール・SMS送信履歴の移動

**ユーザーストーリー:** 担当者として、メール・SMS送信履歴を左列で確認したい。そうすることで、通話履歴と並べてコミュニケーション全体を把握できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「メール・SMS送信履歴」セクションを右列から左列に移動する
2. THE BuyerDetailPage SHALL 右列の買主情報フィールド（BUYER_FIELD_SECTIONS）の下から「メール・SMS送信履歴」を削除する
3. WHEN activities に action が 'email' または 'sms' のレコードが存在する場合、THE BuyerDetailPage SHALL メール・SMS送信履歴を左列に一覧表示する
4. IF activities にメール・SMS送信履歴が存在しない場合、THEN THE BuyerDetailPage SHALL 「メール送信履歴はありません」というメッセージを表示する
5. THE BuyerDetailPage SHALL 既存のメール・SMS送信履歴の表示内容（件名・送信者・物件番号・内覧前伝達事項等）を維持する

---

### 要件4: 中央列（物件詳細カード）

**ユーザーストーリー:** 担当者として、物件詳細カードを中央列で確認したい。そうすることで、左列の履歴と右列の買主情報と並べて物件情報を確認できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 現在の左列（42%）にあった物件詳細カード（PropertyInfoCard）を中央列に移動する
2. THE BuyerDetailPage SHALL 中央列に「物件詳細カード」のタイトルと紐づき物件数を表示する
3. IF 紐づいた物件が存在しない場合、THEN THE BuyerDetailPage SHALL 「紐づいた物件はありません」というメッセージを表示する
4. THE BuyerDetailPage SHALL 中央列の既存の物件詳細カード表示内容（PropertyInfoCard）を維持する

---

### 要件5: 右列（買主情報フィールド・関連買主）

**ユーザーストーリー:** 担当者として、買主情報フィールドと関連買主セクションを右列で確認・編集したい。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 買主情報フィールド（BUYER_FIELD_SECTIONS）を右列に表示する
2. THE BuyerDetailPage SHALL 関連買主セクション（RelatedBuyersSection）を右列の最下部に表示する
3. THE BuyerDetailPage SHALL 右列の既存のインライン編集機能（InlineEditableField）を維持する
4. THE BuyerDetailPage SHALL 右列から「メール・SMS送信履歴」セクションを削除する（左列に移動済み）
