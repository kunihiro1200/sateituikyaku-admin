# Bugfix Requirements Document

## Introduction

物件リスト詳細画面のサイドバーに表示されるセクションラベルが誤っている。
`SellerSendHistory` コンポーネントに「売主への送信履歴」と表示されているが、
正しくは「売主・物件の送信履歴」であるべき。
ラベルの誤りによりユーザーが機能の対象範囲を誤解する可能性がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件リスト詳細画面のサイドバーを表示する THEN the system displays「売主への送信履歴」というセクションラベルを表示する

### Expected Behavior (Correct)

2.1 WHEN 物件リスト詳細画面のサイドバーを表示する THEN the system SHALL「売主・物件の送信履歴」というセクションラベルを表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主・物件への送信履歴データが存在する THEN the system SHALL CONTINUE TO 送信履歴の一覧を正しく表示する
3.2 WHEN 送信履歴が存在しない THEN the system SHALL CONTINUE TO「送信履歴はありません」というメッセージを表示する
3.3 WHEN 送信履歴アイテムをクリックする THEN the system SHALL CONTINUE TO 詳細モーダルを表示する
