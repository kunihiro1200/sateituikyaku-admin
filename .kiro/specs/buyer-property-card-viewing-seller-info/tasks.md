# 実装計画：物件詳細カードへの内覧情報・売主情報セクション追加

## Overview

`PropertyInfoCard.tsx` に対して、型定義の追加とUIセクション2つ（内覧情報・売主情報）を追加する。
変更対象は `frontend/frontend/src/components/PropertyInfoCard.tsx` のみ。バックエンド変更は不要。

## Tasks

- [x] 1. `PropertyFullDetails` インターフェースへのフィールド追加
  - `PropertyFullDetails` インターフェースに以下の5フィールドを `string | undefined` 型で追加する
    - `viewing_key?: string` （内覧時（鍵等））
    - `viewing_parking?: string` （内覧時駐車場）
    - `viewing_notes?: string` （内覧の時の伝達事項）
    - `viewing_available_date?: string` （内覧可能日）
    - `seller_contact?: string` （連絡先）
  - `seller_name`・`seller_email`・`sale_reason` は既存フィールドのため追加不要
  - _Requirements: 4.1, 4.2_

  - [ ]* 1.1 型定義追加後に TypeScript 型チェックを実施
    - `getDiagnostics` で `PropertyInfoCard.tsx` に型エラーがないことを確認
    - _Requirements: 4.1, 4.2_

- [x] 2. 内覧情報セクションの実装
  - 「値下げ履歴」「理由」ブロック（`price_reduction_history || sale_reason` の Grid item）の直後に追加する
  - 表示条件: `viewing_key || viewing_parking || viewing_notes || viewing_available_date` のいずれかが truthy の場合のみ表示
  - 背景色: `bgcolor: '#e3f2fd'`、ボーダー: `border: '1px solid #bbdefb'`、`borderRadius: 1`、`p: 2`
  - セクションタイトル「内覧情報」を `Typography variant="caption" fontWeight="bold"` で表示
  - 各フィールドを条件付きで表示（値が存在する場合のみ）:
    - `viewing_key` → ラベル「内覧時（鍵等）」
    - `viewing_parking` → ラベル「内覧時駐車場」
    - `viewing_notes` → ラベル「内覧の時の伝達事項」
    - `viewing_available_date` → ラベル「内覧可能日」
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.1 Property 1 のプロパティベーステスト（内覧情報セクションの条件付き表示）
    - **Property 1: 内覧情報セクションの条件付き表示**
    - `viewing_key`・`viewing_parking`・`viewing_notes`・`viewing_available_date` の任意の組み合わせに対して、1つ以上が非null・非空文字なら表示、全て falsy なら非表示になることを fast-check で検証
    - **Validates: Requirements 1.1, 1.7**

  - [ ]* 2.2 Property 2 のプロパティベーステスト（内覧情報フィールドのラベルと値の表示）
    - **Property 2: 内覧情報フィールドのラベルと値の表示**
    - 非空文字列の値を持つ各フィールドに対して、対応するラベルと値がレンダリング結果に含まれることを fast-check で検証
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**

- [x] 3. 売主情報セクションの実装
  - 内覧情報セクションの直後に追加する（内覧情報セクションが非表示の場合は「値下げ履歴」「理由」ブロックの直後）
  - 表示条件: `seller_name || seller_contact || seller_email || sale_reason` のいずれかが truthy の場合のみ表示
  - 背景色: `bgcolor: '#fff3e0'`、ボーダー: `border: '1px solid #ffe0b2'`、`borderRadius: 1`、`p: 2`
  - セクションタイトル「売主情報」を `Typography variant="caption" fontWeight="bold"` で表示
  - 各フィールドを条件付きで表示（値が存在する場合のみ）:
    - `seller_name` → ラベル「売主名前」
    - `seller_contact` → ラベル「連絡先」
    - `seller_email` → ラベル「メールアドレス」
    - `sale_reason` → ラベル「売却理由」
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.1 Property 3 のプロパティベーステスト（売主情報セクションの条件付き表示）
    - **Property 3: 売主情報セクションの条件付き表示**
    - `seller_name`・`seller_contact`・`seller_email`・`sale_reason` の任意の組み合わせに対して、1つ以上が非null・非空文字なら表示、全て falsy なら非表示になることを fast-check で検証
    - **Validates: Requirements 2.1, 2.7**

  - [ ]* 3.2 Property 4 のプロパティベーステスト（売主情報フィールドのラベルと値の表示）
    - **Property 4: 売主情報フィールドのラベルと値の表示**
    - 非空文字列の値を持つ各フィールドに対して、対応するラベルと値がレンダリング結果に含まれることを fast-check で検証
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**

- [x] 4. チェックポイント - 型チェックとビルド確認
  - `getDiagnostics` で `PropertyInfoCard.tsx` に型エラーがないことを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する

## Notes

- `*` 付きのサブタスクはオプションであり、MVPとして省略可能
- 各タスクは要件番号でトレーサビリティを確保
- プロパティテストには fast-check（TypeScript/JavaScript向けPBTライブラリ）を使用
- 変更対象ファイルは `frontend/frontend/src/components/PropertyInfoCard.tsx` のみ
