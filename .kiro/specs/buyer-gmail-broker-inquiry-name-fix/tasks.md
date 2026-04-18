# Implementation Plan

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 業者問合せ時に法人名が宛名に付加されるバグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — 失敗がバグの存在を証明する
  - **修正やコードを変更しないこと（テストが失敗しても）**
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ**: `broker_inquiry='業者問合せ'` かつ `company_name` が存在する具体的なケースに絞る
  - `backend/src/services/EmailTemplateService.ts` の `mergeAngleBracketPlaceholders` に以下の入力を渡す:
    - `broker_inquiry='業者問合せ'`, `name='田中太郎'`, `company_name='株式会社ABC'`
    - `broker_inquiry='業者問合せ'`, `name='山田花子'`, `company_name='不動産会社XYZ'`
  - `<<●氏名・会社名>>` の置換結果が `{name}・{company_name}` 形式になっていることをアサート（修正前コードでの失敗を観察）
  - テストを修正前コードで実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見したカウンターエグザンプルを記録する（例: `田中太郎・株式会社ABC` が返される）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非業者問合せ時の従来動作が維持される
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前コードで非バグ条件の入力（`broker_inquiry !== '業者問合せ'`）の動作を観察する:
    - 観察: `broker_inquiry=''`, `company_name='株式会社ABC'` → `{name}・{company_name}` 形式が返される
    - 観察: `broker_inquiry=''`, `company_name=''` → `name` のみが返される
    - 観察: `broker_inquiry='その他'`, `company_name='株式会社DEF'` → `{name}・{company_name}` 形式が返される
    - 観察: `<<氏名>>` プレースホルダーは `broker_inquiry` に関わらず `name` のみに置換される
  - 観察した動作パターンをプロパティベーステストとして記述する:
    - `broker_inquiry !== '業者問合せ'` かつ `company_name` あり → `{name}・{company_name}` 形式が維持される
    - `broker_inquiry !== '業者問合せ'` かつ `company_name` なし → `name` のみが維持される
    - `<<氏名>>` プレースホルダーは常に `name` のみに置換される
  - テストを修正前コードで実行する
  - **期待される結果**: テストが PASS する（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを作成・実行し、パスを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 業者問合せ時の宛名バグを修正する

  - [x] 3.1 フロントエンド: `BuyerGmailSendButton.tsx` に `broker_inquiry` フィールドを追加する
    - `frontend/frontend/src/components/BuyerGmailSendButton.tsx` を編集する
    - `handleTemplateSelect` メソッド内の `buyer` オブジェクトに `broker_inquiry: brokerInquiry || ''` を追加する
    - `company_name` フィールドの直後に配置する（アルファベット順）
    - 変更前: `buyer` オブジェクトに `broker_inquiry` フィールドが存在しない
    - 変更後: `broker_inquiry: brokerInquiry || ''` を追加
    - _Bug_Condition: isBugCondition(X) where X.broker_inquiry = '業者問合せ' AND X.company_name ≠ ''_
    - _Expected_Behavior: broker_inquiry フィールドが mergeMultiple エンドポイントへのリクエストに含まれる_
    - _Preservation: 他のフィールド（buyerName, name, company_name, buyer_number, email 等）は変更しない_
    - _Requirements: 2.2_

  - [x] 3.2 バックエンド: `EmailTemplateService.ts` の `buyerName` 生成ロジックを修正する
    - `backend/src/services/EmailTemplateService.ts` を編集する
    - `mergeAngleBracketPlaceholders` メソッド内に `isBrokerInquiry` フラグを追加する
    - `buyerName` 生成ロジックを変更する:
      - 変更前: `const buyerName = buyer.company_name ? \`${buyer.name || ''}・${buyer.company_name}\` : (buyer.name || buyer.buyerName || '');`
      - 変更後: `const isBrokerInquiry = buyer.broker_inquiry === '業者問合せ'; const buyerName = (!isBrokerInquiry && buyer.company_name) ? \`${buyer.name || ''}・${buyer.company_name}\` : (buyer.name || buyer.buyerName || '');`
    - _Bug_Condition: isBugCondition(X) where X.broker_inquiry = '業者問合せ' AND X.company_name ≠ ''_
    - _Expected_Behavior: broker_inquiry === '業者問合せ' の場合、<<●氏名・会社名>> は buyer.name のみに置換される_
    - _Preservation: broker_inquiry !== '業者問合せ' の場合、従来通り company_name が存在すれば {name}・{company_name} 形式に置換される_
    - _Requirements: 2.1, 3.1, 3.2, 3.3_

  - [x] 3.3 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 業者問合せ時の宛名に法人名が含まれない
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非業者問合せ時の従来動作が維持される
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認する）
    - 全テストがパスすることを確認する

- [x] 4. チェックポイント — 全テストがパスすることを確認する
  - バグ条件探索テスト（タスク1）が PASS することを確認する
  - 保全プロパティテスト（タスク2）が PASS することを確認する
  - 疑問点があればユーザーに確認する
