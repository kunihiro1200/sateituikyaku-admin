# 要件定義書：買主メール・SMS送信履歴統合表示

## はじめに

買主詳細画面の「メール・SMS送信履歴」セクションに、複数の送信元からのメール・SMS送信履歴を統合して表示する機能を実装します。現在は一部の送信履歴しか表示されていませんが、4つの異なる送信元からの履歴を全て統合表示することで、買主への連絡履歴を一元管理できるようにします。

## 用語集

- **Buyer_Detail_Page**: 買主詳細画面（`/buyers/:buyer_number`）
- **Email_SMS_History_Section**: 買主詳細画面左側の「メール・SMS送信履歴」セクション
- **Activity_Logs_Table**: メール・SMS送信履歴を記録するデータベーステーブル
- **Other_Company_Distribution**: 買主リスト一覧ヘッダーの「他社物件新着配信」機能
- **Pre_Public_Price_Reduction_Email**: 物件リスト詳細ページの「公開前、値下げメール」機能
- **Buyer_Candidate_List**: 物件リスト詳細ページの「買主候補リスト」機能
- **Nearby_Buyers**: 売主リスト通話モードページの「近隣買主」機能
- **Distribution_Email**: 配信メール（複数の買主に一斉送信されるメール）
- **Target_Type**: activity_logsテーブルのtarget_typeカラム（送信対象の種別）
- **Target_Id**: activity_logsテーブルのtarget_idカラム（送信対象のID）

## 要件

### 要件1: 他社物件新着配信の履歴記録

**ユーザーストーリー**: 従業員として、買主リスト一覧ヘッダーの「他社物件新着配信」から送信したメール履歴を、買主詳細画面で確認したい。

#### 受入基準

1. WHEN 従業員が「他社物件新着配信」ページから配信メールを送信する、THE System SHALL 送信履歴をActivity_Logs_Tableに記録する
2. THE System SHALL Target_Typeを「buyer」に設定する
3. THE System SHALL Target_Idを買主番号（buyer_number）に設定する
4. THE System SHALL actionを「email」に設定する
5. THE System SHALL metadataに以下の情報を含める：
   - templateName: テンプレート名
   - subject: メール件名
   - senderEmail: 送信者メールアドレス
   - source: 「other_company_distribution」（送信元識別用）
6. THE Buyer_Detail_Page SHALL 「他社物件新着配信」から送信されたメール履歴をEmail_SMS_History_Sectionに表示する

### 要件2: 公開前・値下げメールの履歴記録

**ユーザーストーリー**: 従業員として、物件リスト詳細ページの「公開前、値下げメール」から送信したメール履歴を、買主詳細画面で確認したい。

#### 受入基準

1. WHEN 従業員が「公開前、値下げメール」ボタンから配信メールを送信する、THE System SHALL 送信履歴をActivity_Logs_Tableに記録する
2. THE System SHALL Target_Typeを「buyer」に設定する
3. THE System SHALL Target_Idを買主番号（buyer_number）に設定する
4. THE System SHALL actionを「email」に設定する
5. THE System SHALL metadataに以下の情報を含める：
   - templateName: テンプレート名
   - subject: メール件名
   - senderEmail: 送信者メールアドレス
   - propertyNumbers: 配信対象物件番号の配列
   - source: 「pre_public_price_reduction」（送信元識別用）
6. THE Buyer_Detail_Page SHALL 「公開前、値下げメール」から送信されたメール履歴をEmail_SMS_History_Sectionに表示する

### 要件3: 買主候補リストの履歴記録

**ユーザーストーリー**: 従業員として、物件リスト詳細ページの「買主候補リスト」から送信したメール履歴を、買主詳細画面で確認したい。

#### 受入基準

1. WHEN 従業員が「買主候補リスト」ページから配信メールを送信する、THE System SHALL 送信履歴をActivity_Logs_Tableに記録する
2. THE System SHALL Target_Typeを「buyer」に設定する
3. THE System SHALL Target_Idを買主番号（buyer_number）に設定する
4. THE System SHALL actionを「email」に設定する
5. THE System SHALL metadataに以下の情報を含める：
   - templateName: テンプレート名
   - subject: メール件名
   - senderEmail: 送信者メールアドレス
   - propertyNumbers: 配信対象物件番号の配列
   - source: 「buyer_candidate_list」（送信元識別用）
6. THE Buyer_Detail_Page SHALL 「買主候補リスト」から送信されたメール履歴をEmail_SMS_History_Sectionに表示する

### 要件4: 近隣買主の履歴記録

**ユーザーストーリー**: 従業員として、売主リスト通話モードページの「近隣買主」から送信したメール履歴を、買主詳細画面で確認したい。

#### 受入基準

1. WHEN 従業員が「近隣買主」セクションから配信メールを送信する、THE System SHALL 送信履歴をActivity_Logs_Tableに記録する
2. THE System SHALL Target_Typeを「buyer」に設定する
3. THE System SHALL Target_Idを買主番号（buyer_number）に設定する
4. THE System SHALL actionを「email」に設定する
5. THE System SHALL metadataに以下の情報を含める：
   - templateName: テンプレート名
   - subject: メール件名
   - senderEmail: 送信者メールアドレス
   - propertyNumbers: 配信対象物件番号の配列（売主物件番号）
   - source: 「nearby_buyers」（送信元識別用）
6. THE Buyer_Detail_Page SHALL 「近隣買主」から送信されたメール履歴をEmail_SMS_History_Sectionに表示する

### 要件5: 統合履歴表示

**ユーザーストーリー**: 従業員として、買主詳細画面で全ての送信元からのメール・SMS履歴を時系列順に確認したい。

#### 受入基準

1. THE Buyer_Detail_Page SHALL Email_SMS_History_Sectionに以下の送信元からの履歴を全て表示する：
   - 他社物件新着配信
   - 公開前、値下げメール
   - 買主候補リスト
   - 近隣買主
   - 既存の送信履歴（買主詳細画面から直接送信したメール・SMS）
2. THE System SHALL 履歴を送信日時の降順（新しい順）で表示する
3. THE System SHALL 各履歴に以下の情報を表示する：
   - 送信種別（メール/SMS）
   - テンプレート名または件名
   - 送信者名とメールアドレス
   - 送信日時
   - 配信対象物件番号（該当する場合）
4. THE System SHALL 送信元を識別できるように表示する（metadata.sourceを使用）

### 要件6: 重複送信防止の支援

**ユーザーストーリー**: 従業員として、買主に同じ内容のメールを重複して送信しないように、過去の送信履歴を確認したい。

#### 受入基準

1. THE Buyer_Detail_Page SHALL 同じ物件番号に対する過去の送信履歴を視覚的に識別できるように表示する
2. THE System SHALL 物件番号をクリック可能なチップとして表示する
3. THE System SHALL 送信履歴を最大400pxの高さでスクロール可能にする

### 要件7: パフォーマンス要件

**ユーザーストーリー**: 従業員として、買主詳細画面を開いた時に、メール・SMS送信履歴が迅速に表示されることを期待する。

#### 受入基準

1. THE System SHALL 買主詳細画面の初期ロード時に、メール・SMS送信履歴を2秒以内に表示する
2. THE System SHALL Activity_Logs_Tableに適切なインデックスを設定する（target_type, target_id, created_at）
3. THE System SHALL 履歴取得クエリを最適化する

### 要件8: 既存機能の保全

**ユーザーストーリー**: 従業員として、既存のメール・SMS送信機能が正常に動作し続けることを期待する。

#### 受入基準

1. THE System SHALL 既存の「メール・SMS送信履歴」表示機能を壊さない
2. THE System SHALL 既存のメール・SMS送信機能の動作を変更しない
3. THE System SHALL 買主詳細画面から直接送信したメール・SMSの履歴記録機能を変更しない
4. THE System SHALL 既存のactivity_logsテーブルのスキーマを変更しない

## 制約事項

1. 既存のactivity_logsテーブルのスキーマは変更しない（metadataカラムのJSONBを活用）
2. 既存のメール・SMS送信機能の動作は変更しない（履歴記録機能のみ追加）
3. 買主詳細画面の表示パフォーマンスに影響を与えない（2秒以内のロード時間を維持）
4. 4つの送信元からの履歴記録は、各送信機能の実装に最小限の変更で追加する

## 非機能要件

### パフォーマンス
- 買主詳細画面の初期ロード時間: 2秒以内
- 履歴取得クエリの実行時間: 500ms以内

### 保守性
- 各送信元の履歴記録ロジックは独立して実装する
- metadata.sourceフィールドで送信元を明確に識別できるようにする

### 拡張性
- 将来的に新しい送信元が追加された場合でも、同じ仕組みで履歴記録できるようにする
