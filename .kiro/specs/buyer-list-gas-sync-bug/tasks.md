# Implementation Tasks

## Task 1: GASプロジェクトのデプロイ状態を確認

**Status**: Not Started

**Description**: GASプロジェクト（スプレッドシートに紐づいたGASエディタ）に最新コードがデプロイされているか確認する。

### Sub-tasks:

- [ ] 1.1 スプレッドシートを開き、「拡張機能」→「Apps Script」でGASエディタを開く
- [ ] 1.2 `BuyerSync.gs`の内容を確認
- [ ] 1.3 `BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在するか確認
- [ ] 1.4 存在しない場合、ローカルの`gas/buyer-sync/BuyerSync.gs`と比較して差分を確認

**Acceptance Criteria**:
- GASプロジェクトのコードバージョンが明確になっている
- `BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在するか確認されている
- ローカルコードとの差分が明確になっている

---

## Task 2: GASの実行ログを確認

**Status**: Not Started

**Description**: GASの10分トリガーが正常に実行されているか、エラーが発生していないか確認する。

### Sub-tasks:

- [ ] 2.1 GASエディタの「実行数」タブを開く
- [ ] 2.2 最近の`syncBuyers`の実行ログを確認
- [ ] 2.3 エラーが記録されている場合、エラーメッセージを記録
- [ ] 2.4 成功している場合、同期されたレコード数を確認

**Acceptance Criteria**:
- GASの実行ログが確認されている
- エラーの有無が明確になっている
- 同期されたレコード数が確認されている

---

## Task 3: 最新コードをGASプロジェクトにデプロイ

**Status**: Not Started

**Description**: ローカルの`gas/buyer-sync/BuyerSync.gs`の最新コードをGASプロジェクトにデプロイする。

### Sub-tasks:

- [ ] 3.1 ローカルの`gas/buyer-sync/BuyerSync.gs`の内容を全てコピー
- [ ] 3.2 GASエディタに貼り付けて保存
- [ ] 3.3 GASのバージョン管理で最新バージョンが選択されていることを確認
- [ ] 3.4 GASエディタで`buyerTestSync()`を手動実行してテスト
- [ ] 3.5 実行ログを確認して、エラーがないことを確認

**Acceptance Criteria**:
- 最新コードがGASプロジェクトにデプロイされている
- `BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在する
- テスト実行でエラーが発生していない

---

## Task 4: 買主番号7260を手動同期

**Status**: Not Started

**Description**: GASエディタで`syncSingleBuyer('7260')`を実行して、「業者向けアンケート」フィールドが正しく同期されることを確認する。

### Sub-tasks:

- [ ] 4.1 GASエディタで`syncSingleBuyer('7260')`を実行
- [ ] 4.2 実行ログを確認して、`vendor_survey`フィールドが同期されたことを確認
- [ ] 4.3 `backend/check-buyer-7260.ts`を実行して、DBの`vendor_survey`カラムが正しく更新されたことを確認
- [ ] 4.4 スプレッドシートの値とDBの値が一致することを確認

**Acceptance Criteria**:
- 手動同期が成功している
- DBの`vendor_survey`カラムがスプレッドシートの値と一致している
- 実行ログにエラーが記録されていない

---

## Task 5: 10分トリガーの次回実行を確認

**Status**: Not Started

**Description**: 10分トリガーの次回実行時に、全買主の「業者向けアンケート」データが正しく同期されることを確認する。

### Sub-tasks:

- [ ] 5.1 GASエディタの「トリガー」タブを開く
- [ ] 5.2 `syncBuyers`の10分トリガーが存在することを確認
- [ ] 5.3 次回実行時刻を確認
- [ ] 5.4 次回実行後、GASの実行ログを確認して、エラーがないことを確認
- [ ] 5.5 DBの`buyers`テーブルを確認して、全買主の`vendor_survey`カラムが正しく同期されていることを確認

**Acceptance Criteria**:
- 10分トリガーが正常に実行されている
- 全買主の「業者向けアンケート」データが正しく同期されている
- 実行ログにエラーが記録されていない

---

## Task 6: ステアリングドキュメントの更新

**Status**: Not Started

**Description**: `buyer-column-sync-rule.md`を更新して、今回の問題と解決策を記録する。

### Sub-tasks:

- [ ] 6.1 `.kiro/steering/buyer-column-sync-rule.md`を開く
- [ ] 6.2 「過去の失敗事例」セクションに今回の問題を追加
- [ ] 6.3 根本原因（GASプロジェクトに最新コードがデプロイされていなかった）、影響、解決策を記録
- [ ] 6.4 チェックリストに「GASプロジェクトのデプロイ状態を確認」を追加
- [ ] 6.5 最終更新日を更新

**Acceptance Criteria**:
- ステアリングドキュメントが更新されている
- 今回の問題と解決策が明確に記録されている
- 将来の同様の問題を防ぐための情報が含まれている

---

## Notes

- **調査結果**: ローカルの`gas/buyer-sync/BuyerSync.gs`には`'業者向けアンケート': 'vendor_survey'`のマッピングが既に存在
- **推測される原因**: GASプロジェクトに最新コードがデプロイされていない可能性が高い
- **重要**: GASの10分トリガーは古いバージョンのコードを実行している可能性がある
- Task 3で最新コードをデプロイすることで問題が解決する見込み
