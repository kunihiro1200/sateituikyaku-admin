# 実装計画：buyer-other-property-viewing-type-display

## 概要

`BuyerViewingResultPage.tsx` の内覧形態表示ロジックを拡張し、`linkedProperties` が空（他社物件）の場合でも `viewing_mobile` の選択肢を表示してカレンダー送信を可能にする。変更はフロントエンドのみ。

## タスク

- [x] 1. 内覧形態表示ロジックの拡張
  - [x] 1.1 `BuyerViewingResultPage.tsx` の内覧形態表示 IIFE に「他社物件」分岐を追加する
    - `hasViewingDate` が true かつ `linkedProperties` が空の場合に `VIEWING_FORM_EXCLUSIVE_OPTIONS` のボタン群を表示する分岐を追加
    - 既存の `hasExclusiveProperty` / `hasGeneralProperty` 分岐はそのまま維持する
    - 保存フィールドは `viewing_mobile`（専任物件と同じ）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.2 Property 1 のプロパティテストを書く
    - **Property 1: 他社物件（linkedProperties 空）での内覧形態表示**
    - 表示判定ロジックを純粋関数として抽出し、`fc.string({ minLength: 1 })` で任意の非空内覧日を生成してテスト
    - テストファイル: `frontend/frontend/src/pages/__tests__/BuyerViewingResultPage.otherProperty.test.ts`
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 1.3 Property 2 のプロパティテストを書く
    - **Property 2: 内覧日なしでは内覧形態を表示しない**
    - 空・null・undefined・空白のみの内覧日を生成し、表示判定が false を返すことを検証
    - **Validates: Requirements 1.3**

  - [ ]* 1.4 Property 3 のプロパティテストを書く
    - **Property 3: linkedProperties の状態に応じた表示分岐**
    - `fc.record({ atbb_status: fc.oneof(...) })` で物件データを生成し、分岐判定ロジックを検証
    - **Validates: Requirements 1.4, 1.5**

- [x] 2. viewingTypeValue・isCalendarEnabled の動作確認と必須強調表示
  - [x] 2.1 `viewingTypeValue` 計算ロジックが他社物件ケースで正しく動作することを確認する
    - `linkedProperties` が空のとき `atbbStatus` が `''` になり `viewing_mobile || viewing_type_general` の分岐が適用されることをコードレビューで確認
    - 既存コードの変更は不要だが、コメントを追加して意図を明示する
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.2 Property 4 のプロパティテストを書く
    - **Property 4: 他社物件での viewingTypeValue 計算**
    - `fc.string({ minLength: 1 })` で任意の `viewing_mobile` 値を生成し、`viewingTypeValue` が `buyer.viewing_mobile` と等しくなることを検証
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 2.3 内覧形態未選択時の必須強調表示（赤枠・「*必須」ラベル）が他社物件ケースでも動作することを確認する
    - 既存の `isRequired` 計算ロジックが他社物件ケースをカバーしているか確認し、必要に応じて修正
    - _Requirements: 3.4_

  - [ ]* 2.4 Property 7 のプロパティテストを書く
    - **Property 7: 内覧形態未選択時の必須強調表示**
    - `fc.string({ minLength: 1 })` で非空内覧日、`viewing_mobile = ''` を固定し、`isRequired` が true を返すことを検証
    - **Validates: Requirements 3.4**

- [x] 3. チェックポイント - 全テストがパスすることを確認する
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

- [x] 4. 内覧形態ボタンのトグル動作と選択スタイル
  - [x] 4.1 他社物件向けボタンのクリックハンドラーを実装する
    - 未選択ボタンをクリックで `viewing_mobile` に値を保存（`sync: true`）
    - 選択済みボタンを再クリックで `viewing_mobile` を空文字列にクリア（`sync: true`）
    - _Requirements: 3.1, 3.2, 3.5_

  - [ ]* 4.2 Property 5 のプロパティテストを書く
    - **Property 5: 内覧形態ボタンのトグル動作**
    - `fc.constantFrom(...VIEWING_FORM_EXCLUSIVE_OPTIONS)` で任意の選択肢を生成し、トグルロジック `newValue = current === option ? '' : option` を検証
    - **Validates: Requirements 3.1, 3.2**

  - [x] 4.3 選択済みボタンの `contained` スタイル判定を実装する
    - `buyer.viewing_mobile === option` のとき `'contained'`、それ以外は `'outlined'` を返す判定ロジックを確認・実装
    - _Requirements: 3.3_

  - [ ]* 4.4 Property 6 のプロパティテストを書く
    - **Property 6: 選択済みボタンの contained スタイル**
    - `fc.constantFrom(...VIEWING_FORM_EXCLUSIVE_OPTIONS)` で任意の選択肢を生成し、`variant` 判定が正しく `'contained'` / `'outlined'` を返すことを検証
    - **Validates: Requirements 3.3**

- [x] 5. generateCalendarTitle への影響確認
  - [x] 5.1 `generateCalendarTitle` の呼び出しが他社物件ケースで正しく動作することを確認する
    - `linkedProperties` が空のとき `property` が `null` になるが `buyer.viewing_mobile` は正しく渡されることをコードレビューで確認
    - 既存コードの変更は不要だが、コメントを追加して意図を明示する
    - _Requirements: 2.4_

- [x] 6. 最終チェックポイント - 全テストがパスすることを確認する
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件番号でトレーサビリティを確保
- バックエンド・DBスキーマの変更は不要（フロントエンドのみ）
- スプレッドシート同期は `SYNC_FIELDS` に `viewing_mobile` が既に含まれているため追加対応不要
- プロパティテストは `fast-check` ライブラリを使用（既存プロジェクトで使用中）
