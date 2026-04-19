# 要件定義書

## はじめに

売主管理システムの通話モードページ（CallModePage）では、売主へのメール送信機能を提供している。メールテンプレートには会社の住所として「大分市舞鶴町にございます」という文言がハードコードされているが、売主番号（property_number）に「FI」が含まれる場合は福岡支店の案件であるため、「福岡市中央区舞鶴にございます」に変換する必要がある。

既存の `replacePlaceholders` 関数は `<<当社住所>>` プレースホルダーを使ったFI判定ロジックを持っているが、メールテンプレート本文中にハードコードされた「大分市舞鶴町にございます」という文言には対応していない。本機能はこのギャップを埋めるものである。

## 用語集

- **EmailTemplate_System**: メールテンプレートの生成・変換を担うシステム（`emailTemplates.ts` および `smsTemplateGenerators.ts` の変換ロジック）
- **CallModePage**: 売主管理システムの通話モードページ（`frontend/frontend/src/pages/CallModePage.tsx`）
- **FI番号**: 売主番号（`sellerNumber` / `property_number`）に「FI」（大文字・小文字を問わない）が含まれる番号。福岡支店の案件を示す。
- **大分文言**: メールテンプレート本文中の「大分市舞鶴町にございます」という文言
- **福岡文言**: FI番号の場合に置換される「福岡市中央区舞鶴にございます」という文言
- **replacePlaceholders**: `smsTemplateGenerators.ts` に定義された、売主番号に基づいてプレースホルダーを置換する既存関数

---

## 要件

### 要件1: FI番号判定によるメール本文の文言変換

**ユーザーストーリー:** 営業担当者として、FI番号の売主にメールを送信する際、会社の住所が自動的に福岡支店の住所に変換されたメールを送りたい。そうすることで、誤った住所が記載されたメールを送ってしまうミスを防ぎたい。

#### 受け入れ基準

1. WHEN メールテンプレートが選択され本文が生成される時、THE EmailTemplate_System SHALL 売主番号に「FI」（大文字・小文字を区別しない）が含まれるかを判定する

2. WHEN 売主番号に「FI」が含まれ、かつ生成されたメール本文に「大分市舞鶴町にございます」という文言が含まれる場合、THE EmailTemplate_System SHALL その文言を「福岡市中央区舞鶴にございます」に変換する

3. WHEN 売主番号に「FI」が含まれない場合、THE EmailTemplate_System SHALL メール本文の「大分市舞鶴町にございます」という文言を変換せずそのまま保持する

4. WHEN 売主番号が空文字列、null、または undefined の場合、THE EmailTemplate_System SHALL メール本文の「大分市舞鶴町にございます」という文言を変換せずそのまま保持する

5. WHEN メール本文に「大分市舞鶴町にございます」という文言が複数箇所含まれる場合、THE EmailTemplate_System SHALL 全ての箇所を「福岡市中央区舞鶴にございます」に変換する

---

### 要件2: 既存の replacePlaceholders 関数への統合

**ユーザーストーリー:** 開発者として、FI番号による文言変換ロジックを既存の `replacePlaceholders` 関数に統合したい。そうすることで、SMS・メール両方のテンプレートで一貫した変換ロジックが適用され、保守性が高まる。

#### 受け入れ基準

1. THE EmailTemplate_System SHALL 「大分市舞鶴町にございます」→「福岡市中央区舞鶴にございます」の変換ロジックを、既存の `replacePlaceholders` 関数（`smsTemplateGenerators.ts`）内に実装する

2. WHEN `replacePlaceholders` 関数が呼び出される時、THE EmailTemplate_System SHALL 既存の `<<当社住所>>` および `<<売買実績ｖ>>` プレースホルダー置換に加えて、ハードコードされた「大分市舞鶴町にございます」文言の変換も実行する

3. THE EmailTemplate_System SHALL `replacePlaceholders` 関数の既存の動作（`<<当社住所>>`、`<<売買実績ｖ>>`、`<<売買実績v>>` の置換）を変更しない

4. WHEN `replaceEmailPlaceholders`（CallModePage内）が `replacePlaceholders` を呼び出す時、THE EmailTemplate_System SHALL メールテンプレートの本文にも文言変換が適用される

---

### 要件3: 変換対象の正確な文字列マッチング

**ユーザーストーリー:** 開発者として、変換ロジックが意図した文言のみを正確に変換し、類似した文言を誤って変換しないようにしたい。

#### 受け入れ基準

1. THE EmailTemplate_System SHALL 変換対象の文言を「大分市舞鶴町にございます」という完全一致の文字列として扱う

2. THE EmailTemplate_System SHALL 「大分市舞鶴町にございます」という文言のみを変換対象とし、「大分市舞鶴町」を含む他の文言（例：住所の一部として使われる「大分市舞鶴町1丁目3-30」）は変換しない

3. WHEN 変換後の本文に「大分市舞鶴町にございます」という文言が残っていない場合、THE EmailTemplate_System SHALL 変換が正常に完了したとみなす

---

### 要件4: 変換ロジックのテスト可能性

**ユーザーストーリー:** 開発者として、FI番号による文言変換ロジックが正しく動作することを自動テストで検証したい。

#### 受け入れ基準

1. THE EmailTemplate_System SHALL FI番号を持つ売主に対して「大分市舞鶴町にございます」が「福岡市中央区舞鶴にございます」に変換されることを検証できる純粋関数として実装する

2. THE EmailTemplate_System SHALL FI番号を持たない売主に対して文言が変換されないことを検証できる

3. FOR ALL 有効な売主番号に対して、`replacePlaceholders` 関数は「大分市舞鶴町にございます」を含まない文字列を入力した場合、出力も変換されないことを保証する（変換の冪等性）
