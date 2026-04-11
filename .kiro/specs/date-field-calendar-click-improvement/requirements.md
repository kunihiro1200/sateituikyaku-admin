# 要件定義書

## はじめに

売主リストの通話モードページ（CallModePage）、買主リストの内覧結果ページ（BuyerViewingResultPage）、買主詳細画面（BuyerDetailPage）、および業務一覧ページ（TaskListPage）において、日付フィールドのユーザビリティを改善する。

現状、日付フィールドはカレンダーアイコンボタンをクリックしないとカレンダーが開かない。この改善では、フィールドの入力枠内のどこをクリックしてもカレンダーが表示されるようにする。UIの見た目は変えず、クリック可能な領域を広げるのみとする。

## 用語集

- **DateField**: `type="date"` または `type="datetime-local"` を使用するMUI TextFieldコンポーネント
- **CalendarPicker**: ブラウザネイティブの日付選択UI（カレンダー）
- **CallModePage**: 売主リストの通話モードページ（`/sellers/:id/call`）
- **BuyerViewingResultPage**: 買主リストの内覧結果ページ（`/buyers/:id/viewing-result`）
- **InlineEditableField**: インライン編集可能なフィールドコンポーネント（`src/components/InlineEditableField.tsx`）
- **BuyerDetailPage**: 買主詳細画面（`/buyers/:id`）
- **TaskListPage**: 業務一覧ページ（WorkListPage とも呼ばれる）
- **ClickArea**: ユーザーがクリックしてカレンダーを開くことができる領域

## 要件

### 要件1: CallModePageの次電日フィールドのクリック領域拡大

**ユーザーストーリー:** 営業担当者として、通話モードページの次電日フィールドの入力枠内のどこをクリックしてもカレンダーが開くようにしたい。そうすることで、素早く日付を入力できる。

#### 受け入れ基準

1. WHEN ユーザーが次電日フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
2. WHEN ユーザーが次電日フィールドのカレンダーアイコンボタンをクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
3. THE DateField SHALL 次電日フィールドのUIの見た目（レイアウト、色、サイズ）を変更しない
4. WHEN ユーザーがカレンダーピッカーで日付を選択したとき、THE DateField SHALL 選択した日付を入力値として設定する

### 要件2: CallModePageの訪問予定日時フィールドのクリック領域拡大

**ユーザーストーリー:** 営業担当者として、通話モードページの訪問予定日時フィールドの入力枠内のどこをクリックしてもカレンダーが開くようにしたい。そうすることで、素早く日時を入力できる。

#### 受け入れ基準

1. WHEN ユーザーが訪問予定日時フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブの日時ピッカーを表示する
2. WHEN ユーザーが訪問予定日時フィールドのカレンダーアイコンボタンをクリックしたとき、THE DateField SHALL ブラウザネイティブの日時ピッカーを表示する
3. THE DateField SHALL 訪問予定日時フィールドのUIの見た目（レイアウト、色、サイズ）を変更しない
4. WHEN ユーザーがカレンダーピッカーで日時を選択したとき、THE DateField SHALL 選択した日時を入力値として設定する

### 要件3: BuyerViewingResultPageの内覧日フィールドのクリック領域拡大

**ユーザーストーリー:** 営業担当者として、内覧結果ページの内覧日フィールドの入力枠内のどこをクリックしてもカレンダーが開くようにしたい。そうすることで、素早く内覧日を入力できる。

#### 受け入れ基準

1. WHEN ユーザーが内覧日フィールドの入力枠内をクリックしたとき、THE InlineEditableField SHALL 編集モードに切り替わり、ブラウザネイティブのカレンダーピッカーを表示する
2. WHEN ユーザーが内覧日フィールドのカレンダーアイコンボタンをクリックしたとき、THE InlineEditableField SHALL ブラウザネイティブのカレンダーピッカーを表示する
3. THE InlineEditableField SHALL 内覧日フィールドのUIの見た目（レイアウト、色、サイズ）を変更しない
4. WHEN ユーザーがカレンダーピッカーで日付を選択したとき、THE InlineEditableField SHALL 選択した日付を入力値として設定する

### 要件5: BuyerDetailPageの次電日フィールドのクリック領域拡大

**ユーザーストーリー:** 営業担当者として、買主詳細画面の次電日フィールドの入力枠内のどこをクリックしてもカレンダーが開くようにしたい。そうすることで、素早く日付を入力できる。

#### 受け入れ基準

1. WHEN ユーザーが次電日フィールドの入力枠内をクリックしたとき、THE InlineEditableField SHALL 編集モードに切り替わり、ブラウザネイティブのカレンダーピッカーを表示する
2. WHEN ユーザーが次電日フィールドのカレンダーアイコンボタンをクリックしたとき、THE InlineEditableField SHALL ブラウザネイティブのカレンダーピッカーを表示する
3. THE InlineEditableField SHALL 次電日フィールドのUIの見た目（レイアウト、色、サイズ）を変更しない
4. WHEN ユーザーがカレンダーピッカーで日付を選択したとき、THE InlineEditableField SHALL 選択した日付を入力値として設定する

### 要件4: InlineEditableFieldコンポーネントの日付フィールド自動フォーカス

**ユーザーストーリー:** 開発者として、InlineEditableFieldコンポーネントの日付フィールドが編集モードに切り替わったとき、自動的にカレンダーが開くようにしたい。そうすることで、すべての日付フィールドで一貫したユーザー体験を提供できる。

#### 受け入れ基準

1. WHEN InlineEditableField の fieldType が "date" であり、編集モードに切り替わったとき、THE InlineEditableField SHALL 日付入力フィールドにフォーカスを当て、カレンダーピッカーを自動的に表示する
2. WHEN InlineEditableField の fieldType が "date" であり、編集モードに切り替わったとき、THE InlineEditableField SHALL 既存の値を保持したまま編集可能な状態にする
3. THE InlineEditableField SHALL fieldType が "date" 以外のフィールドの動作を変更しない

### 要件6: TaskListPageの日付フィールドのクリック領域拡大

**ユーザーストーリー:** 営業担当者として、業務一覧ページの各日付フィールドの入力枠内のどこをクリックしてもカレンダーが開くようにしたい。そうすることで、素早く日付を入力できる。

対象フィールド:
- サイト登録納期予定日（必須フィールド）
- サイト登録確認依頼日
- 間取図完了予定日（必須フィールド）
- 間取図完了日（必須フィールド）
- 配信日
- 公開予定日

#### 受け入れ基準

1. WHEN ユーザーがサイト登録納期予定日フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
2. WHEN ユーザーがサイト登録確認依頼日フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
3. WHEN ユーザーが間取図完了予定日フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
4. WHEN ユーザーが間取図完了日フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
5. WHEN ユーザーが配信日フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
6. WHEN ユーザーが公開予定日フィールドの入力枠内をクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
7. WHEN ユーザーが各日付フィールドのカレンダーアイコンボタンをクリックしたとき、THE DateField SHALL ブラウザネイティブのカレンダーピッカーを表示する
8. THE DateField SHALL 各日付フィールドのUIの見た目（レイアウト、色、サイズ）を変更しない
9. WHEN ユーザーがカレンダーピッカーで日付を選択したとき、THE DateField SHALL 選択した日付を入力値として設定する
