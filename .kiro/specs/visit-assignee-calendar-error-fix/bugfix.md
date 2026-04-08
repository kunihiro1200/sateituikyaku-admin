# バグ修正要件ドキュメント：訪問予約カレンダー送信エラー（特定アカウントのみ）

## Introduction

売主リストの通話モードページで訪問日を保存してGoogleカレンダー送信する際、特定のアカウント（yurine~、mariko~）でのみ400エラーが発生する。tomoko~やgenta~のアカウントでは正常に動作する。

コンソールログでは`seller.visitAssignee`と`seller.visitAssigneeInitials`が`undefined`と表示されるが、ネットワークタブでは正しく取得できている（`visitAssignee: "裏天真"`, `visitAssigneeInitials: "U"`）。

過去の実装記録（visit-appointment-features.md、コミット: 6f5bdfa7）によると、営担チェックで`visitAssigneeInitials`もフォールバックとして使用するように修正済みだが、特定のアカウントでのみ問題が発生している。

ユーザーからの情報：「いつもKIROはイニシャルが合致していないという」

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN yurine~またはmariko~のアカウントで売主番号AA18を開き、訪問予約を編集して保存する THEN Googleカレンダー送信時に400エラーが発生する

1.2 WHEN yurine~またはmariko~のアカウントで訪問予約を保存する THEN コンソールに「現在の売主の営担が設定されていません。サイドバーを表示しません。」という警告が表示される

1.3 WHEN yurine~またはmariko~のアカウントで訪問予約を保存する THEN コンソールログで`seller.visitAssignee`、`seller.visitAssigneeInitials`、`seller.assignedTo`が全て`undefined`と表示される

1.4 WHEN ネットワークタブでAPIレスポンスを確認する THEN `visitAssignee: "裏天真"`、`visitAssigneeInitials: "U"`が正しく返されている

1.5 WHEN イニシャル「U」がemployeesテーブルに存在しない、または異なる名前にマッピングされている THEN `SellerService.decryptSeller()`でイニシャルからフルネームへの変換が失敗し、`visitAssignee`と`visitAssigneeInitials`が`undefined`になる

### Expected Behavior (Correct)

2.1 WHEN yurine~またはmariko~のアカウントで訪問予約を保存する THEN tomoko~やgenta~のアカウントと同様に、Googleカレンダー送信が成功する

2.2 WHEN 訪問予約を保存する THEN 営業担当が正しく取得され、カレンダーURLに含まれる

2.3 WHEN イニシャル「U」がemployeesテーブルに存在しない、または異なる名前にマッピングされている THEN `visitAssigneeInitials`（元のイニシャル）が`undefined`にならず、フォールバックとして使用できる

2.4 WHEN `SellerService.decryptSeller()`でイニシャルからフルネームへの変換が失敗する THEN `visitAssignee`は`undefined`になるが、`visitAssigneeInitials`は元のイニシャル値（例: "U"）を保持する

2.5 WHEN フロントエンドで営担をチェックする THEN `visitAssignee`または`visitAssigneeInitials`のいずれかが存在すればサイドバーを表示し、カレンダー送信を許可する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN tomoko~やgenta~のアカウントで訪問予約を保存する THEN 引き続き正常にGoogleカレンダー送信が成功する

3.2 WHEN イニシャルがemployeesテーブルに正しく登録されている売主の訪問予約を保存する THEN `visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される

3.3 WHEN 営担チェックで`visitAssignee`または`visitAssigneeInitials`のいずれかが存在する THEN サイドバーが正しく表示される

3.4 WHEN 訪問日削除機能を使用する THEN 引き続き正常に訪問日・営担・訪問査定取得者が削除される

3.5 WHEN 訪問査定取得者の自動設定機能を使用する THEN 引き続き正常にログインユーザーに自動設定される
