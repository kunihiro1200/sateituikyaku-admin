# 要件ドキュメント

## はじめに

本機能は、社内管理システムの操作性向上を目的とした2つの改善を含みます。

1. **物件詳細画面の物件番号コピー機能の視認性向上**  
   物件詳細画面（`PropertyListingDetailPage.tsx`）では既にコピーアイコンが実装されているが、ユーザーにはコピーできているか不明瞭に感じられている。コピー完了時のフィードバックをより明確にし、アイコンの視認性を高める。

2. **業務詳細画面ヘッダーへの物件情報追加**  
   業務詳細モーダル（`WorkTaskDetailModal.tsx`）のヘッダーに、物件番号の右隣に物件所在地・種別・売主名・物件担当名・媒介形態を表示する。これらのフィールドは既に `WorkTaskData` に含まれているため、バックエンド変更は不要。

## 用語集

- **PropertyListingDetailPage**: 物件詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **WorkTaskDetailModal**: 業務詳細モーダル（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **物件番号**: `property_number` カラム（例: AA13501）
- **物件所在地**: `property_address` カラム
- **種別**: `property_type` カラム
- **売主名**: `seller_name` カラム
- **物件担当名**: `sales_assignee` カラム
- **媒介形態**: `mediation_type` カラム
- **クリップボード**: ブラウザの `navigator.clipboard` API

## 要件

### 要件1: 物件詳細画面の物件番号コピー機能の視認性向上

**ユーザーストーリー:** 担当者として、物件番号をコピーしたとき、コピーが成功したことを明確に確認したい。そうすることで、コピーできているか不安にならずに業務を進められる。

#### 受け入れ基準

1. THE PropertyListingDetailPage SHALL 物件番号の隣にコピーアイコン（ContentCopyIcon）を常時表示する
2. WHEN ユーザーがコピーアイコンをクリックする, THE PropertyListingDetailPage SHALL `navigator.clipboard.writeText()` を使用して物件番号をクリップボードにコピーする
3. WHEN コピーが成功する, THE PropertyListingDetailPage SHALL アイコンをチェックマーク（CheckIcon）に変化させ、色を緑（`success.main`）に変更し、2秒後に元のアイコンに戻す
4. WHEN コピーが成功する, THE PropertyListingDetailPage SHALL 「物件番号をコピーしました」というスナックバー通知を表示する
5. IF コピーが失敗する, THEN THE PropertyListingDetailPage SHALL 「物件番号のコピーに失敗しました」というエラースナックバーを表示する
6. THE PropertyListingDetailPage SHALL コピーアイコンに `title="物件番号をコピー"` のツールチップを設定する

### 要件2: 業務詳細画面ヘッダーへの物件情報追加

**ユーザーストーリー:** 担当者として、業務詳細モーダルを開いたとき、物件番号の右隣に物件所在地・種別・売主名・物件担当名・媒介形態を確認したい。そうすることで、タブを切り替えずに物件の基本情報を把握できる。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL ヘッダー（`DialogTitle`）内の物件番号の右隣に、物件所在地・種別・売主名・物件担当名・媒介形態を表示する
2. WHILE データが読み込み中である, THE WorkTaskDetailModal SHALL 各情報フィールドを空文字またはスケルトン表示にする
3. WHEN データが取得される, THE WorkTaskDetailModal SHALL `data.property_address`・`data.property_type`・`data.seller_name`・`data.sales_assignee`・`data.mediation_type` の値をヘッダーに表示する
4. IF フィールドの値が空または未入力である, THEN THE WorkTaskDetailModal SHALL そのフィールドを非表示にする（空のラベルを表示しない）
5. THE WorkTaskDetailModal SHALL 各情報を「ラベル: 値」の形式でコンパクトに表示し、ヘッダーが1行に収まるよう横スクロール可能なレイアウトにする
6. THE WorkTaskDetailModal SHALL 物件番号のコピー機能（クリックでコピー）を維持する
