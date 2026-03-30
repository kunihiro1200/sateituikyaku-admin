# Bugfix Requirements Document

## Introduction

物件リスト詳細画面（PropertyListingDetailPage.tsx）で「isMobile is not defined」エラーが発生しています。このエラーは、`isMobile`変数が使用されているにもかかわらず、`react-device-detect`ライブラリからインポートされていないことが原因です。

**影響範囲**:
- URL: `https://sateituikyaku-admin-frontend.vercel.app/property-listings/BB14`
- エラー: `ReferenceError: isMobile is not defined`
- 発生箇所: PropertyListingDetailPage.tsxの複数箇所（行921, 935, 936, 937, 945, 949など）

**ビジネスへの影響**:
- 物件リスト詳細画面が表示されない
- モバイル/デスクトップで適切なレイアウトが表示されない
- ユーザーが物件情報を閲覧できない

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN PropertyListingDetailPage.tsxが読み込まれる THEN システムは「isMobile is not defined」エラーを発生させる

1.2 WHEN ユーザーが物件リスト詳細画面（例: `/property-listings/BB14`）にアクセスする THEN ページが正常に表示されず、エラーが発生する

1.3 WHEN コンポーネントがレンダリングされる THEN `isMobile`変数が未定義のため、条件分岐が正しく動作しない

### Expected Behavior (Correct)

2.1 WHEN PropertyListingDetailPage.tsxが読み込まれる THEN システムは`react-device-detect`から`isMobile`を正しくインポートする

2.2 WHEN ユーザーが物件リスト詳細画面にアクセスする THEN ページが正常に表示され、エラーが発生しない

2.3 WHEN コンポーネントがレンダリングされる THEN `isMobile`変数が正しく定義され、モバイル/デスクトップで適切なレイアウトが表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `isMobile`が`true`の場合 THEN システムはモバイル用のレイアウトを表示し続ける

3.2 WHEN `isMobile`が`false`の場合 THEN システムはデスクトップ用のレイアウトを表示し続ける

3.3 WHEN 他のインポート文が存在する THEN システムは既存のインポート文を保持し続ける

3.4 WHEN 他のコンポーネントが`isMobile`を使用している THEN システムはそれらのコンポーネントの動作を変更しない
