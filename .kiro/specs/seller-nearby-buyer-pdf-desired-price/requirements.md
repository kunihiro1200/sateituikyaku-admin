# 要件定義書

## はじめに

売主リストの近隣買主セクションにおいて、PDFボタンを押して印刷プレビューを表示した際、「問合せ物件情報」列の下に「希望価格：～」を追加表示する機能を実装する。

現在、画面上の近隣買主テーブルには「希望価格」列（`price_range_house` / `price_range_apartment` / `price_range_land` フィールドから物件種別に応じて取得）が表示されているが、PDFの印刷内容（`nearbyBuyersPrintUtils.ts` の `buildPrintContent` 関数）にはこの情報が含まれていない。

担当者がPDFを印刷して外部に持ち出す際、買主の希望価格情報が欠落しているため業務上の不便が生じている。本機能により、PDF出力にも希望価格情報を含めることで業務効率を向上させる。

---

## 用語集

- **NearbyBuyersList**: 売主通話モードページ（`/sellers/:id/call`）に表示される近隣買主テーブルコンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）
- **nearbyBuyersPrintUtils**: PDF印刷用HTMLを生成するユーティリティモジュール（`frontend/frontend/src/components/nearbyBuyersPrintUtils.ts`）
- **buildPrintContent**: PDF印刷用HTMLを生成する純粋関数。`nearbyBuyersPrintUtils.ts` に定義されている
- **問合せ物件情報**: PDF出力における列名。現在は「種別 / 問合せ住所 / 価格（inquiry_price）」をまとめて表示している
- **希望価格**: 買主が希望する購入価格帯の文字列。物件種別に応じて `price_range_house`（戸建）、`price_range_apartment`（マンション/アパート）、`price_range_land`（土地）のいずれかのフィールドから取得する
- **inquiry_price**: 買主の問合せ時の価格。円単位の数値（例: 35000000 = 3500万円）
- **price_range_house**: 戸建希望価格帯の文字列フィールド（例: "3000万円台"）
- **price_range_apartment**: マンション/アパート希望価格帯の文字列フィールド
- **price_range_land**: 土地希望価格帯の文字列フィールド
- **propertyType**: 売主物件の種別（"戸"/"戸建"/"戸建て"、"マ"/"マンション"/"アパート"、"土"/"土地"）
- **PDFボタン**: `NearbyBuyersList` コンポーネントのアクションボタン行にある「PDF」ボタン。選択した買主行を印刷プレビューで表示する

---

## 要件

### 要件1: PDF印刷用ユーティリティへの希望価格フィールド追加

**ユーザーストーリー:** 売主担当者として、近隣買主のPDF出力に希望価格情報を含めたい。そうすることで、印刷物を見ながら買主の希望価格を確認できる。

#### 受け入れ基準

1. THE nearbyBuyersPrintUtils SHALL `NearbyBuyer` インターフェースに `price_range_house`、`price_range_apartment`、`price_range_land` フィールドを追加する
2. THE nearbyBuyersPrintUtils SHALL `buildPrintContent` 関数のパラメーターに `propertyType` を追加する
3. WHEN `propertyType` が "戸"、"戸建"、または "戸建て" の場合、THE nearbyBuyersPrintUtils SHALL `price_range_house` フィールドの値を希望価格として使用する
4. WHEN `propertyType` が "マ"、"マンション"、または "アパート" の場合、THE nearbyBuyersPrintUtils SHALL `price_range_apartment` フィールドの値を希望価格として使用する
5. WHEN `propertyType` が "土" または "土地" の場合、THE nearbyBuyersPrintUtils SHALL `price_range_land` フィールドの値を希望価格として使用する
6. WHEN `propertyType` が上記以外または未設定の場合、THE nearbyBuyersPrintUtils SHALL `price_range_house`、`price_range_apartment`、`price_range_land` の順で最初に値があるフィールドを希望価格として使用する

### 要件2: PDF出力への希望価格表示

**ユーザーストーリー:** 売主担当者として、PDFの「問合せ物件情報」の下に希望価格を表示したい。そうすることで、印刷物から買主の希望価格を一目で確認できる。

#### 受け入れ基準

1. WHEN 希望価格が取得できる場合、THE buildPrintContent SHALL 「問合せ物件情報」セルの内容の下に「希望価格：{希望価格の値}」を改行して表示する
2. WHEN 希望価格が取得できない（全フィールドが null または空文字）場合、THE buildPrintContent SHALL 「希望価格：」の行を表示しない
3. THE buildPrintContent SHALL 「問合せ物件情報」と「希望価格：」の間に視覚的な区切り（改行）を設ける
4. THE buildPrintContent SHALL 希望価格の表示形式を「希望価格：{文字列}」とする（例: 「希望価格：3000万円台」）

### 要件3: NearbyBuyersListコンポーネントからのpropertyType受け渡し

**ユーザーストーリー:** 売主担当者として、売主物件の種別に応じた正しい希望価格がPDFに表示されてほしい。そうすることで、物件種別と一致した希望価格情報を確認できる。

#### 受け入れ基準

1. WHEN PDFボタンが押された場合、THE NearbyBuyersList SHALL `buildPrintContent` 関数に `propertyType` プロパティの値を渡す
2. THE NearbyBuyersList SHALL `buildPrintContent` 関数に渡す `buyers` 配列に `price_range_house`、`price_range_apartment`、`price_range_land` フィールドが含まれていることを保証する
3. THE NearbyBuyersList SHALL 既存の `handlePrint` 関数内で `buildPrintContent` の呼び出しを更新し、`propertyType` を追加引数として渡す

### 要件4: 既存機能への影響なし

**ユーザーストーリー:** 売主担当者として、希望価格追加後も既存のPDF出力機能が正常に動作してほしい。そうすることで、業務フローを中断せずに機能を利用できる。

#### 受け入れ基準

1. THE buildPrintContent SHALL 既存の「買主番号」「名前」「受付日」「問合せ物件情報」「ヒアリング/内覧結果」「最新状況」の各列を変更せずに維持する
2. THE buildPrintContent SHALL 名前非表示（`isNameHidden`）機能を変更せずに維持する
3. THE NearbyBuyersList SHALL PDFボタンの表示・動作（選択行がない場合の警告、印刷後のクリーンアップ）を変更せずに維持する
4. IF `buildPrintContent` の呼び出し元が `propertyType` を渡さない場合、THEN THE buildPrintContent SHALL `propertyType` を `undefined` として扱い、既存の動作と同等の結果を返す
