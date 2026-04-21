# 要件ドキュメント

## はじめに

買主リストの内覧結果ページ（`BuyerViewingResultPage`）において、「内覧後売主連絡」フィールドの表示位置を変更するUI改善。

現状、「内覧後売主連絡」フィールドは「ヒアリング項目」セクション内のテキストエリア上部に条件付きで表示されている。これを「内覧未確定」フィールドの右隣に移動し、関連フィールドを横並びにまとめることで、視認性と操作効率を向上させる。

## 用語集

- **BuyerViewingResultPage**: 買主リストの内覧結果ページ（`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`）
- **内覧未確定フィールド**: `viewing_unconfirmed` カラムに対応するUIフィールド。「未確定」ボタンを縦並びで表示する
- **内覧後売主連絡フィールド**: `post_viewing_seller_contact` カラムに対応するUIフィールド。「済」「未」「不要」ボタンを横並びで表示する。一般媒介条件を満たす場合のみ表示される
- **内覧情報行**: 内覧日・時間・内覧形態・後続担当・内覧未確定を横並びに配置している `display: flex` の行
- **ヒアリング項目セクション**: 内覧情報行の下に位置する、クイック入力ボタンとテキストエリアを含むセクション
- **一般媒介条件**: `viewing_mobile` または `viewing_type_general` に「一般」が含まれる場合

## 要件

### 要件1: 内覧後売主連絡フィールドの配置変更

**ユーザーストーリー:** 担当者として、内覧未確定と内覧後売主連絡を同じ行で確認・操作したい。そうすることで、内覧後の状態を一目で把握し、入力漏れを防ぐことができる。

#### 受け入れ基準

1. THE BuyerViewingResultPage SHALL 内覧未確定フィールドの右隣に内覧後売主連絡フィールドを配置する
2. WHEN 一般媒介条件を満たす場合、THE BuyerViewingResultPage SHALL 内覧情報行の内覧未確定フィールドの右隣に内覧後売主連絡フィールドを表示する
3. WHEN 一般媒介条件を満たさない場合、THE BuyerViewingResultPage SHALL 内覧後売主連絡フィールドを表示しない
4. THE BuyerViewingResultPage SHALL ヒアリング項目セクション内から内覧後売主連絡フィールドを削除する
5. WHEN 内覧後売主連絡フィールドが表示される場合、THE BuyerViewingResultPage SHALL 内覧未確定フィールドと内覧後売主連絡フィールドを同一の横並び行内に収める

### 要件2: 内覧後売主連絡フィールドのレイアウト整合性

**ユーザーストーリー:** 担当者として、内覧後売主連絡フィールドが他のフィールドと視覚的にバランスよく表示されることを期待する。そうすることで、画面の一貫性が保たれ、操作しやすくなる。

#### 受け入れ基準

1. THE BuyerViewingResultPage SHALL 内覧後売主連絡フィールドのラベルを「内覧後売主連絡」と表示する
2. WHEN 必須条件（一般・公開中 かつ 内覧日が2025-07-05以降かつ今日以前 かつ viewing_result_follow_up が非空）を満たす場合、THE BuyerViewingResultPage SHALL ラベルに「*」を付与して必須であることを示す
3. THE BuyerViewingResultPage SHALL 「済」「未」「不要」の3つの選択ボタンを横並びで表示する
4. WHEN いずれかのボタンが選択済みの場合、THE BuyerViewingResultPage SHALL 選択済みボタンを `contained` スタイルで強調表示する
5. WHEN 選択済みのボタンを再クリックした場合、THE BuyerViewingResultPage SHALL `post_viewing_seller_contact` の値をクリアする
6. THE BuyerViewingResultPage SHALL 注意書き「*一般媒介は内覧後に、全ての売り主に結果報告をしてください」を内覧後売主連絡フィールドの下部に表示する

### 要件3: 既存機能の保持

**ユーザーストーリー:** 担当者として、フィールド移動後も内覧後売主連絡の保存・表示機能が正常に動作することを期待する。そうすることで、業務フローが中断されない。

#### 受け入れ基準

1. WHEN 内覧後売主連絡フィールドのボタンをクリックした場合、THE BuyerViewingResultPage SHALL `post_viewing_seller_contact` フィールドをバックエンドに保存する
2. WHEN 保存が成功した場合、THE BuyerViewingResultPage SHALL UIの選択状態を即座に更新する
3. IF 保存が失敗した場合、THEN THE BuyerViewingResultPage SHALL 元の値にロールバックする
4. THE BuyerViewingResultPage SHALL 内覧後売主連絡フィールドの表示・非表示ロジック（一般媒介条件）を変更しない
