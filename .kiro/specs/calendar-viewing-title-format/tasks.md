# 実装計画: カレンダー内覧タイトル形式

## 概要

`BuyerViewingResultPage.tsx` のカレンダーイベント生成ロジックを変更し、タイトル形式と説明欄を要件に従って更新する。

## タスク

- [x] 1. タイトル・説明生成の純粋関数を実装する
  - [x] 1.1 `generateCalendarTitle` 関数を実装する
    - `viewing_type`（優先）または `viewing_type_general` をタイトル先頭に使用する
    - 「立会」を含み「立会不要」を含まない場合のみ `（{name}）` を末尾に追加する
    - `name` が空の場合は `（）` を付けない
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 `generateCalendarDescription` 関数を実装する
    - 既存の説明欄フォーマットを維持しつつ末尾に買主詳細URLを追加する
    - URL形式: `買主詳細: https://sateituikyaku-admin-frontend.vercel.app/buyers/{buyer_number}`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]* 1.3 プロパティベーステストを作成する（`calendarViewingTitle.property.test.ts`）
    - **Property 1: タイトル基本形式** — viewing_type/viewing_type_general と property_address の組み合わせで `{viewingTypeValue}{propertyAddr}` で始まる
    - **Validates: Requirements 1.1, 1.5**
    - **Property 2: viewing_type の優先順位** — viewing_type が空でない場合は viewing_type を使用し、空の場合のみ viewing_type_general を使用する
    - **Validates: Requirements 1.2, 1.3**
    - **Property 3: 立会判定による買主氏名追加** — 「立会」を含み「立会不要」を含まない場合かつ name が空でない場合のみ `（{name}）` が追加される
    - **Validates: Requirements 2.1, 2.2, 2.4**
    - **Property 4: 説明欄の買主詳細URL** — buyer_number に対して説明欄末尾が `買主詳細: https://sateituikyaku-admin-frontend.vercel.app/buyers/{buyer_number}` になる
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 2. `BuyerViewingResultPage.tsx` のカレンダーロジックを更新する
  - [x] 2.1 `handleCalendarButtonClick` 内のタイトル生成を新形式に変更する
    - `generateCalendarTitle` を呼び出してタイトルを生成する
    - _Requirements: 4.1, 4.4_

  - [x] 2.2 `handleCalendarButtonClick` 内の description に買主詳細URLを追加する
    - `generateCalendarDescription` を呼び出して説明欄を生成する
    - _Requirements: 5.5_

  - [x] 2.3 `calendarConfirmDialog` 初期値のタイトルを新形式に変更する
    - `generateCalendarTitle` を使用して初期値を設定する
    - _Requirements: 4.1, 4.2_

  - [x] 2.4 `calendarConfirmDialog` 初期値の description に買主詳細URLを追加する
    - `generateCalendarDescription` を使用して初期値を設定する
    - _Requirements: 5.6_

- [x] 3. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP向けにスキップ可能
- 各タスクは要件との対応を明記している
- 純粋関数として切り出すことでテスト容易性を確保する
- プロパティベーステストは fast-check を使用する
