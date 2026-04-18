# 要件定義書

## はじめに

売主リストの近隣買主セクションにおいて、PDFボタンを押して印刷プレビューを表示した際、PDFのヘッダー部分に「{物件住所}の近隣にお問合せ合った買主様」という見出しを大きめのフォントで表示する機能を実装する。

現在、`nearbyBuyersPrintUtils.ts` の `buildPrintContent` 関数が生成するPDFには会社情報（株式会社いふう）のみが表示されており、どの物件に関する近隣買主リストなのかが一目でわからない。本機能により、物件住所を動的に取得してヘッダーに表示することで、印刷物の可読性と業務効率を向上させる。

---

## 用語集

- **NearbyBuyersList**: 売主通話モードページ（`/sellers/:id/call`）に表示される近隣買主テーブルコンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）
- **nearbyBuyersPrintUtils**: PDF印刷用HTMLを生成するユーティリティモジュール（`frontend/frontend/src/components/nearbyBuyersPrintUtils.ts`）
- **buildPrintContent**: PDF印刷用HTMLを生成する純粋関数。`nearbyBuyersPrintUtils.ts` に定義されている
- **propertyAddress**: 売主物件の住所文字列。`NearbyBuyersList.tsx` の state として保持されており、バックエンドAPIの `/api/sellers/:id/nearby-buyers` レスポンスから取得される
- **PDFヘッダー**: `buildPrintContent` が生成するHTMLの上部に表示される見出し領域
- **PDFボタン**: `NearbyBuyersList` コンポーネントのアクションボタン行にある「PDF」ボタン。選択した買主行を印刷プレビューで表示する

---

## 要件

### 要件1: buildPrintContent への物件住所引数追加

**ユーザーストーリー:** 売主担当者として、近隣買主PDFのヘッダーにどの物件の近隣買主リストかを表示したい。そうすることで、印刷物を見ただけにどの案件のリストか判断できる。

#### 受け入れ基準

1. THE nearbyBuyersPrintUtils SHALL `buildPrintContent` 関数のパラメーターに `propertyAddress` を追加する
2. THE buildPrintContent SHALL `propertyAddress` パラメーターを省略可能（`string | null | undefined`）として受け付ける
3. IF `buildPrintContent` の呼び出し元が `propertyAddress` を渡さない場合、THEN THE buildPrintContent SHALL 後方互換性を維持し、既存の動作と同等の結果を返す

### 要件2: PDFヘッダーへの物件住所表示

**ユーザーストーリー:** 売主担当者として、PDFの上部に「{物件住所}の近隣にお問合せ合った買主様」という見出しを大きめのフォントで表示したい。そうすることで、印刷物がどの物件に関するものか一目でわかる。

#### 受け入れ基準

1. WHEN `propertyAddress` が設定されている場合、THE buildPrintContent SHALL PDFの会社情報ブロックの下に「{propertyAddress}の近隣にお問合せ合った買主様」という見出しを表示する
2. THE buildPrintContent SHALL 見出しのフォントサイズを通常のテーブル本文（12px）より大きく設定する（18px以上）
3. THE buildPrintContent SHALL 見出しを中央揃えまたは左揃えで表示し、テーブルとの間に適切な余白を設ける
4. WHEN `propertyAddress` が `null`、`undefined`、または空文字の場合、THE buildPrintContent SHALL 見出し行を表示しない

### 要件3: NearbyBuyersListコンポーネントからのpropertyAddress受け渡し

**ユーザーストーリー:** 売主担当者として、PDFボタンを押した際に自動的に物件住所がヘッダーに反映されてほしい。そうすることで、手動で住所を入力する手間なく正確な情報が表示される。

#### 受け入れ基準

1. WHEN PDFボタンが押された場合、THE NearbyBuyersList SHALL `buildPrintContent` 関数に `propertyAddress` state の値を渡す
2. THE NearbyBuyersList SHALL 既存の `handlePrint` 関数内で `buildPrintContent` の呼び出しを更新し、`propertyAddress` を追加引数として渡す
3. THE NearbyBuyersList SHALL `propertyAddress` state はバックエンドAPIレスポンスから既に取得・保持されているため、新たなAPIコールを行わない

### 要件4: 既存機能への影響なし

**ユーザーストーリー:** 売主担当者として、ヘッダー追加後も既存のPDF出力機能が正常に動作してほしい。そうすることで、業務フローを中断せずに機能を利用できる。

#### 受け入れ基準

1. THE buildPrintContent SHALL 既存の「買主番号」「名前」「受付日」「問合せ物件情報」「ヒアリング/内覧結果」「最新状況」の各列を変更せずに維持する
2. THE buildPrintContent SHALL 名前非表示（`isNameHidden`）機能を変更せずに維持する
3. THE buildPrintContent SHALL 希望価格表示（`desiredPriceLine`）機能を変更せずに維持する
4. THE NearbyBuyersList SHALL PDFボタンの表示・動作（選択行がない場合の警告、印刷後のクリーンアップ）を変更せずに維持する
5. IF `buildPrintContent` の呼び出し元が `propertyAddress` を渡さない場合、THEN THE buildPrintContent SHALL `propertyAddress` を `undefined` として扱い、見出し行を表示しない
