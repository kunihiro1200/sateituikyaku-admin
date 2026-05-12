# GAS更新手順（物件リスト同期）

## 概要
物件リストのスプレッドシート同期GASに売主名フォールバックロジックを追加しました。
Google Apps Scriptエディタで更新する必要があります。

## 更新が必要な理由
- O列「名前(売主）」が空の場合、BL列「●所有者情報」から自動的に取得するロジックを追加
- これにより、次回の同期実行時から、AA5279などの物件のseller_nameが自動的に埋められる

## 更新手順

### 1. Google Apps Scriptエディタを開く
1. スプレッドシート「物件」を開く
2. メニューから「拡張機能」→「Apps Script」をクリック

### 2. PropertyListingSync.gs を更新
1. 左側のファイル一覧から「PropertyListingSync.gs」を選択
2. 以下のファイルの内容をコピー：
   ```
   gas/property-listing-sync/PropertyListingSync.gs
   ```
3. Google Apps Scriptエディタに貼り付けて上書き
4. 「保存」ボタン（💾アイコン）をクリック

### 3. 動作確認（オプション）
1. 関数選択ドロップダウンから「testSync」を選択
2. 「実行」ボタンをクリック
3. ログを確認：
   ```
   売主名フォールバック適用: owner_info="尾田様" → seller_name
   ```
   のようなログが表示されればOK

### 4. 自動同期の確認
- 次回の10分ごとの自動同期実行時から、フォールバックロジックが適用される
- AA5279などの物件で、seller_nameが自動的にowner_infoの値で埋められる

## 修正内容の詳細

### 変更箇所
`mapRowToRecord`関数の最後に以下のロジックを追加：

```javascript
// 売主名のフォールバックロジック: seller_nameが空または"様"のみの場合はowner_infoを使用
if (record.seller_name !== undefined && record.owner_info !== undefined) {
  var trimmedSellerName = record.seller_name ? String(record.seller_name).trim() : '';
  var isBlankOrSamaOnly = !trimmedSellerName || trimmedSellerName === '様';
  if (isBlankOrSamaOnly && record.owner_info) {
    record.seller_name = record.owner_info;
    Logger.log('売主名フォールバック適用: owner_info="' + record.owner_info + '" → seller_name');
  }
}
```

### 動作
1. O列「名前(売主）」が空または"様"のみの場合
2. BL列「●所有者情報」に値がある場合
3. → seller_nameにowner_infoの値を設定

## 影響を受ける物件
以下の物件で、次回の同期実行時からseller_nameが自動的に埋められます：
- AA5279: "尾田様"
- BB3: "渡邉様"
- AA8579: "黒澤 直様"
- AA2097: "大村様"
- AA5821: "三好一紀様"
- AA4915: "岩本様"
- AA4029: "首藤様"
- AA2996: "嘉納様"
- AA2088: "山根様"
- AA4885: "古田様"
- AA6179: "髙橋　吏様"
- その他、同様の状態の物件

## 注意事項
- この修正により、スプレッドシートのO列が空でもBL列に値があれば、DBのseller_nameが自動的に埋められる
- Gmail送信時にも正しい売主名が表示されるようになる
