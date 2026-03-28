# 実装計画：内覧Gmailテンプレート物件種別フィルタリング

## 概要

フロントエンドのみの変更として、TemplateSelectionModal に物件種別フィルタリング機能を追加し、BuyerGmailSendButton と BuyerDetailPage を通じて property_type を受け渡す。

## タスク

- [x] 1. TemplateSelectionModal にフィルタリングロジックを追加
  - `frontend/frontend/src/components/TemplateSelectionModal.tsx` を修正
  - `propertyType?: string` プロパティをインターフェースに追加
  - `filterTemplatesByPropertyType(templates, propertyType)` 関数を実装
    - 全角括弧（）・半角括弧()の内容を抽出する `extractBracketContent` を実装
    - 戸建て（「戸」「戸建て」）：括弧内に「土」を含むテンプレートを除外
    - 土地（「土」）：括弧内に「戸」または「マ」を含むテンプレートを除外
    - マンション（「マ」「マンション」）：括弧内に「土」を含むテンプレートを除外
    - 括弧なしテンプレートは常に表示
    - `propertyType` が未定義・空文字の場合は全テンプレートを返す
  - テンプレート一覧表示時に `filterTemplatesByPropertyType` を適用
  - _要件: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 7.2, 7.3_

  - [ ]* 1.1 Property 1 のプロパティテストを作成
    - **Property 1: propertyType未指定時は全テンプレートを返す**
    - **Validates: 要件 2.2**

  - [ ]* 1.2 Property 2 のプロパティテストを作成
    - **Property 2: 戸建て物件フィルタリングの正確性**
    - **Validates: 要件 3.1, 3.2, 3.3**

  - [ ]* 1.3 Property 3 のプロパティテストを作成
    - **Property 3: 土地物件フィルタリングの正確性**
    - **Validates: 要件 4.1, 4.2, 4.3, 4.4**

  - [ ]* 1.4 Property 4 のプロパティテストを作成
    - **Property 4: マンション物件フィルタリングの正確性**
    - **Validates: 要件 5.1, 5.2, 5.3**

  - [ ]* 1.5 Property 5 のプロパティテストを作成
    - **Property 5: 括弧内文字列抽出の正確性**
    - **Validates: 要件 6.1, 6.2, 6.3**

  - [ ]* 1.6 Property 6 のプロパティテストを作成
    - **Property 6: 括弧なしテンプレートは常に表示**
    - **Validates: 要件 6.4, 3.3, 4.4, 5.3**
    - テストファイル: `frontend/frontend/src/__tests__/templatePropertyTypeFilter.property.test.ts`

- [x] 2. BuyerGmailSendButton に linkedPropertyType プロパティを追加
  - `frontend/frontend/src/components/BuyerGmailSendButton.tsx` を修正
  - `linkedPropertyType?: string` をプロパティインターフェースに追加
  - `TemplateSelectionModal` に `propertyType={linkedPropertyType}` として転送
  - _要件: 1.1, 1.4_

- [x] 3. BuyerDetailPage から linkedPropertyType を渡す
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` を修正
  - `BuyerGmailSendButton` に `linkedPropertyType={linkedProperties[0]?.property_type}` を追加
  - `linkedProperties` が空・未定義の場合は `undefined` が渡ることを確認
  - _要件: 1.2, 1.3_

- [x] 4. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` 付きのサブタスクはオプションであり、MVP向けにスキップ可能
- 各タスクは要件との対応を明記
- プロパティテストは `fast-check` を使用し、最低100回のイテレーションで実行
- バックエンドへの変更は不要（クライアントサイドのみ）
