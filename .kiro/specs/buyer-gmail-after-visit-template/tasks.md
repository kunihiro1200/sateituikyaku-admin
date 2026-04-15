# 実装計画: 買主Gmail送信「内覧後御礼メール」テンプレート追加

## 概要

変更箇所は2点のみ。フロントエンドの `filterTemplatesByConditions` から内覧日チェックロジックを削除し、スプレッドシートにテンプレート行を追加する。

## タスク

- [x] 1. `filterTemplatesByConditions` から内覧日チェックロジックを削除
  - `frontend/frontend/src/components/TemplateSelectionModal.tsx` を編集
  - 以下のブロックを削除する：
    ```typescript
    if (name === '内覧後御礼メール') {
      if (!viewingDate) return false;
      return viewingDate.getTime() <= today.getTime();
    }
    ```
  - 削除後、業者問合せ以外の全買主に「内覧後御礼メール」が表示されることを確認
  - _Requirements: 2.2, 2.3_

  - [ ]* 1.1 `filterTemplatesByConditions` のプロパティテストを作成
    - **Property 1: 非業者問合せ・任意内覧日で内覧後御礼メールが表示される**
    - **Validates: Requirements 1.2, 2.2, 2.3**
    - fast-check を使用し、`brokerInquiry !== '業者問合せ'` かつ任意の `latestViewingDate`（null含む）で「内覧後御礼メール」が結果に含まれることを検証

  - [ ]* 1.2 業者問合せ時の非表示プロパティテストを作成
    - **Property 2: 業者問合せの場合は内覧後御礼メールが非表示**
    - **Validates: Requirements 2.1**
    - `brokerInquiry === '業者問合せ'` で「内覧後御礼メール」が結果に含まれないことを検証

- [x] 2. スプレッドシートのテンプレートシートに「内覧後御礼メール」行を追加（手動作業）
  - ※ この作業はコードではなくスプレッドシートへの手動操作のため、実装エージェントは対象外
  - テンプレートシートに以下の行を追加する：
    - C列（区分）: `買主`
    - D列（種別）: `内覧後御礼メール`
    - E列（件名）: `【御礼】先日のご内覧について`
    - F列（本文）: 買主名・物件番号・物件住所・担当者署名のプレースホルダーを含む本文
  - _Requirements: 1.1, 3.1, 3.2, 3.3_

- [x] 3. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- タスク2はスプレッドシートへの手動作業のため、コーディングエージェントは実装しない
- プロパティテストには fast-check を使用する（既存テストで採用済み）
