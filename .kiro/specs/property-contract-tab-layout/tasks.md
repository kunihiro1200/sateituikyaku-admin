# タスクリスト：契約決済タブ レイアウト変更

## タスク

- [x] 1. ContractSettlementSection を左右2ペイン構成に変更する
  - [x] 1.1 外側コンテナを `display: 'flex'` の `Box` に変更し、`SiteRegistrationSection` と同じレイアウト構造を適用する
  - [x] 1.2 左ペイン `Box` を作成する（`flex: 1`, `borderRight: '2px solid'`, `overflowY: 'auto'`）
  - [x] 1.3 右ペイン `Box` を作成する（`flex: 1`, `overflowY: 'auto'`）
  - **対象ファイル:** `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

- [-] 2. 左ペイン「契約書、重説作成」セクションを実装する
  - [x] 2.1 ヘッダー行に `【契約書、重説作成】` テキスト（`color: '#1565c0'`）と保存ボタン（`color="primary"`）を配置する
  - [x] 2.2 保存ボタンに `SiteRegistrationSection` と同じパルスアニメーション（`rgba(25, 118, 210, 0.7)`）を適用する
  - [x] 2.3 `bgcolor: '#e3f2fd'` の `Box` を作成し、以下のフィールドをこの順序で配置する：
    - `EditableField` 売買契約締め日（`sales_contract_deadline`, type="date"）
    - `EditableField` 売買契約備考（`sales_contract_notes`）
    - `EditableField` 契約形態（`contract_type`）
    - CW（浅沼様）全エリア・種別依頼OK 表示行
    - `EditableField` 重説・契約書入力納期（`contract_input_deadline`, type="date"）
    - `PreRequestCheckButton`
    - `EditableButtonSelect` 社員が契約書作成（`employee_contract_creation`）
    - `EditableField` 製本予定日（`binding_scheduled_date`, type="date"）
    - `EditableField` 製本完了（`binding_completed`）
  - **対象ファイル:** `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

- [ ] 3. 右ペイン「決済詳細」セクションを実装する
  - [ ] 3.1 ヘッダー行に `【決済詳細】` テキスト（`color: '#2e7d32'`）と保存ボタン（`color="success"`）を配置する
  - [ ] 3.2 保存ボタンに `SiteRegistrationSection` と同じパルスアニメーション（`rgba(46, 125, 50, 0.7)`）を適用する
  - [ ] 3.3 `bgcolor: '#f3e5f5'` の `Box` を作成し、以下のフィールドをこの順序で配置する：
    - `EditableField` 決済日（`settlement_date`, type="date"）
    - `EditableField` 決済予定月（`settlement_scheduled_month`）
    - `EditableField` 売買価格（`sales_price`, type="number"）
    - `EditableField` 仲介手数料（売）（`brokerage_fee_seller`, type="number"）
    - `EditableField` 通常仲介手数料（売）（`standard_brokerage_fee_seller`, type="number"）
    - `EditableButtonSelect` キャンペーン（`campaign`, options=['あり', 'なし']）
    - `EditableField` 減額理由（`discount_reason`）
    - `EditableField` 減額理由他（`discount_reason_other`）
    - `EditableButtonSelect` 売・支払方法（`seller_payment_method`, options=['振込', '現金', '他']）
    - `EditableButtonSelect` 入金確認（売）（`payment_confirmed_seller`, options=['確認済み', '未']）
    - `EditableField` 仲介手数料（買）（`brokerage_fee_buyer`, type="number"）
    - `EditableField` 通常仲介手数料（買）（`standard_brokerage_fee_buyer`, type="number"）
    - `EditableButtonSelect` 買・支払方法（`buyer_payment_method`, options=['振込', '現金', '他']）
    - `EditableButtonSelect` 入金確認（買）（`payment_confirmed_buyer`, options=['確認済み', '未']）
    - `EditableButtonSelect` 経理確認済み（`accounting_confirmed`, options=['未', '済']）
  - **対象ファイル:** `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

- [-] 4. 動作確認
  - [x] 4.1 `getDiagnostics` でTypeScriptエラーがないことを確認する
  - [ ] 4.2 「契約決済」タブが左右2ペインで表示されることを手動確認する
  - [ ] 4.3 両ペインの保存ボタンが正常に動作することを手動確認する
