# 実装計画: 売主通話モードページのメール署名に営業担当者情報を追加

## 概要

バックエンドの `employeeUtils.ts` に `phone_number` を追加し、フロントエンドの `employeeService.ts` で型定義とマッピングを更新する。CallModePageは変更不要。

## タスク

- [x] 1. バックエンド: `getActiveEmployeesWithEmail` に `phone_number` を追加
  - `backend/src/utils/employeeUtils.ts` のSELECTクエリに `phone_number` を追加
  - 戻り値の型定義に `phone_number: string | null` を追加
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

  - [ ]* 1.1 `getActiveEmployeesWithEmail` のプロパティテストを作成
    - **Property 1: EmployeeServiceのphone_numberマッピング**
    - **Validates: Requirements 2.2**
    - `fast-check` を使用し、任意の `phone_number` 値（文字列またはnull）に対してマッピングが正しく行われることを検証

- [x] 2. フロントエンド: `Employee` 型と `getActiveEmployees` マッピングを更新
  - `frontend/frontend/src/services/employeeService.ts` の `Employee` インターフェースに `phoneNumber: string | null` を追加
  - `getActiveEmployees` 関数で `phone_number` → `phoneNumber` のマッピングを追加
  - _Requirements: 2.1, 2.2_

  - [ ]* 2.1 `getActiveEmployees` マッピングのプロパティテストを作成
    - **Property 1: EmployeeServiceのphone_numberマッピング**
    - **Validates: Requirements 2.2**
    - 任意の `phone_number` 値（文字列またはnull）を持つAPIレスポンスに対して `phoneNumber` フィールドが正しくマッピングされることを検証

  - [ ]* 2.2 担当者情報置換のプロパティテストを作成
    - **Property 2: 担当者情報の全置換**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - 任意の従業員リストと `assignedTo` に対して、プレースホルダーが全て置換されることを検証

  - [ ]* 2.3 フォールバック動作のプロパティテストを作成
    - **Property 3: 担当者未発見時のフォールバック**
    - **Validates: Requirements 3.4, 3.5**
    - `assignedTo` に一致する従業員が存在しない場合、ログインユーザー情報でフォールバックされることを検証

- [x] 3. チェックポイント — 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応を明示
- CallModePage（`frontend/frontend/src/pages/CallModePage.tsx`）は変更不要
