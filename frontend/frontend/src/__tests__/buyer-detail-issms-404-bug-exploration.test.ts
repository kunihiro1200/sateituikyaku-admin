/**
 * Bug Condition Exploration Test: BuyerDetailPage isSms未定義・論理削除済み買主404バグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは修正前のコードで実行すると失敗する（これが正しい - バグの存在を証明する）
 * 修正後は成功する（バグが修正されたことを確認）
 *
 * バグ1条件:
 * - `frontend/frontend/src/pages/BuyerDetailPage.tsx` の1550行目で
 *   通話履歴セクション（action === 'call' または 'phone_call'）のコールバック内で
 *   `isSms` 変数が未定義のまま参照される
 * - `isSms` はメール・SMS履歴セクション（1604行目）のコールバック内でのみ定義されている
 *
 * バグ2条件:
 * - `backend/src/routes/buyers.ts` の682行目で
 *   `getByBuyerNumber(id)` が `includeDeleted=false`（デフォルト）で呼ばれる
 * - 論理削除済み買主（deleted_at IS NOT NULL）の場合にnullが返り404になる
 *
 * 期待される動作（修正後）:
 * - バグ1: `const hasBody = !!metadata.body;`（isSms参照を削除）
 * - バグ2: `getByBuyerNumber(id, true)`（includeDeleted=trueを渡す）
 *
 * 未修正コードでの期待される失敗:
 * - バグ1: 通話履歴セクションのコールバック内に `!isSms` が存在する
 * - バグ2: /:id/related エンドポイントで `getByBuyerNumber(id)` が引数1つで呼ばれる
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// バグ1: BuyerDetailPage.tsx の isSms 未定義バグ
// ============================================================

describe('Property 1: Bug Condition - BuyerDetailPage isSms未定義バグ', () => {
  const componentPath = path.join(__dirname, '../pages/BuyerDetailPage.tsx');
  let componentContent: string;
  let lines: string[];

  beforeAll(() => {
    componentContent = fs.readFileSync(componentPath, 'utf-8');
    lines = componentContent.split('\n');
  });

  /**
   * テスト: 通話履歴セクションのコールバック内に `!isSms` が存在しないことを確認
   *
   * 未修正コードでの期待される動作:
   * - 通話履歴セクション（action === 'call' || action === 'phone_call'）のコールバック内に
   *   `const hasBody = !isSms && !!metadata.body;` が存在する
   * - このテストは失敗する（バグが存在することを証明）
   *
   * 修正後コードでの期待される動作:
   * - `const hasBody = !!metadata.body;` に変更されている
   * - このテストはパスする
   *
   * **CRITICAL**: このテストは未修正コードで失敗することが正しい動作
   * **DO NOT attempt to fix the test or the code when it fails**
   *
   * カウンターエグザンプル（未修正コードで発生）:
   * - 1550行目: `const hasBody = !isSms && !!metadata.body;`
   * - `isSms` は通話履歴セクションのスコープに存在しない（ReferenceError）
   */
  test('通話履歴セクションのhasBodyに !isSms が含まれていない（修正確認）', () => {
    // 通話履歴セクションのフィルタ行を探す
    const callFilterLineIndex = lines.findIndex(
      line => line.includes("a.action === 'call'") && line.includes("a.action === 'phone_call'")
    );

    expect(callFilterLineIndex).toBeGreaterThan(-1);
    console.log(`通話履歴セクション開始行: ${callFilterLineIndex + 1}`);

    // 通話履歴セクションのコールバック内（フィルタ行から50行以内）を検索
    const callSectionLines = lines.slice(callFilterLineIndex, callFilterLineIndex + 50);
    const callSectionContent = callSectionLines.join('\n');

    // メール・SMS履歴セクションのフィルタ行を探す（境界を確認）
    const emailFilterLineIndex = lines.findIndex(
      line => line.includes("a.action === 'email'") && line.includes("a.action === 'sms'")
    );
    console.log(`メール・SMS履歴セクション開始行: ${emailFilterLineIndex + 1}`);

    // 通話履歴セクション内に `!isSms` が含まれているか確認
    const hasIsSmsInCallSection = callSectionContent.includes('!isSms');

    console.log('\n📊 バグ1確認:');
    console.log(`  通話履歴セクション開始行: ${callFilterLineIndex + 1}`);
    console.log(`  メール・SMS履歴セクション開始行: ${emailFilterLineIndex + 1}`);
    console.log(`  通話履歴セクション内に !isSms が存在: ${hasIsSmsInCallSection}`);

    if (hasIsSmsInCallSection) {
      // hasBodyの行を特定
      const hasBodyLineIndex = callSectionLines.findIndex(line => line.includes('hasBody'));
      if (hasBodyLineIndex >= 0) {
        console.log(`\n❌ バグ確認: 通話履歴セクション内（行${callFilterLineIndex + hasBodyLineIndex + 1}）に !isSms が存在します`);
        console.log(`  該当行: ${callSectionLines[hasBodyLineIndex].trim()}`);
        console.log('  isSms はこのスコープに存在しないため ReferenceError が発生します');
      }
    }

    // 修正後のコードでは通話履歴セクション内に !isSms が存在しない
    // 未修正コードでは !isSms が存在するためこのテストは失敗する
    expect(hasIsSmsInCallSection).toBe(false);
  });

  /**
   * テスト: isSms が通話履歴セクションではなくメール・SMS履歴セクションで定義されていることを確認
   *
   * このテストは修正前後どちらでもパスする（バグの根本原因を文書化）
   */
  test('isSms はメール・SMS履歴セクションのコールバック内でのみ定義されている（根本原因確認）', () => {
    // isSms の定義行を探す
    const isSmsDefinitionLines: number[] = [];
    lines.forEach((line, index) => {
      if (line.includes('const isSms =') || line.includes('const isSms=')) {
        isSmsDefinitionLines.push(index + 1);
      }
    });

    console.log('\n📊 isSms 定義箇所:');
    isSmsDefinitionLines.forEach(lineNum => {
      console.log(`  行${lineNum}: ${lines[lineNum - 1].trim()}`);
    });

    // isSms はメール・SMS履歴セクション内でのみ定義されている
    expect(isSmsDefinitionLines.length).toBeGreaterThan(0);

    // メール・SMS履歴セクションのフィルタ行を探す
    const emailFilterLineIndex = lines.findIndex(
      line => line.includes("a.action === 'email'") && line.includes("a.action === 'sms'")
    );

    // isSms の定義はメール・SMS履歴セクション以降にある
    isSmsDefinitionLines.forEach(lineNum => {
      expect(lineNum).toBeGreaterThan(emailFilterLineIndex + 1);
    });

    console.log(`\n✅ isSms はメール・SMS履歴セクション（行${emailFilterLineIndex + 1}以降）でのみ定義されています`);
  });

  /**
   * テスト: 通話履歴セクション内で hasBody が定義されていることを確認（バグ箇所の特定）
   *
   * このテストは修正前後どちらでもパスする（hasBody が存在することを確認）
   */
  test('通話履歴セクション内に hasBody の定義が存在する（バグ箇所の特定）', () => {
    const callFilterLineIndex = lines.findIndex(
      line => line.includes("a.action === 'call'") && line.includes("a.action === 'phone_call'")
    );

    const callSectionLines = lines.slice(callFilterLineIndex, callFilterLineIndex + 50);
    const hasBodyLineIndex = callSectionLines.findIndex(line => line.includes('const hasBody'));

    expect(hasBodyLineIndex).toBeGreaterThan(-1);

    const hasBodyLine = callSectionLines[hasBodyLineIndex].trim();
    console.log(`\n📊 通話履歴セクション内の hasBody 定義:`);
    console.log(`  行${callFilterLineIndex + hasBodyLineIndex + 1}: ${hasBodyLine}`);

    // バグ条件: !isSms が含まれているか
    const isBugCondition = hasBodyLine.includes('!isSms');
    console.log(`  バグ条件（!isSms が含まれる）: ${isBugCondition}`);

    if (isBugCondition) {
      console.log('\n❌ カウンターエグザンプル:');
      console.log('  入力: action === "call" のアクティビティを持つ買主の詳細画面');
      console.log('  期待: 通話履歴セクションが正常にレンダリングされる');
      console.log('  実際: ReferenceError: isSms is not defined');
    }
  });
});

// ============================================================
// バグ2: backend/src/routes/buyers.ts の /:id/related 404バグ
// ============================================================

describe('Property 1: Bug Condition - /:id/related 論理削除済み買主404バグ', () => {
  const routesPath = path.join(
    __dirname,
    '../../../../backend/src/routes/buyers.ts'
  );
  let routesContent: string;
  let lines: string[];

  beforeAll(() => {
    routesContent = fs.readFileSync(routesPath, 'utf-8');
    lines = routesContent.split('\n');
  });

  /**
   * テスト: /:id/related エンドポイントで getByBuyerNumber が includeDeleted=true で呼ばれていることを確認
   *
   * 未修正コードでの期待される動作:
   * - `getByBuyerNumber(id)` が引数1つで呼ばれている（includeDeleted=false デフォルト）
   * - 論理削除済み買主の場合にnullが返り404になる
   * - このテストは失敗する（バグが存在することを証明）
   *
   * 修正後コードでの期待される動作:
   * - `getByBuyerNumber(id, true)` が引数2つで呼ばれている
   * - このテストはパスする
   *
   * **CRITICAL**: このテストは未修正コードで失敗することが正しい動作
   * **DO NOT attempt to fix the test or the code when it fails**
   *
   * カウンターエグザンプル（未修正コードで発生）:
   * - 682行目: `const buyer = await buyerService.getByBuyerNumber(id);`
   * - 論理削除済み買主番号（例: 7359）で GET /buyers/7359/related を呼ぶと404が返る
   */
  test('/:id/related エンドポイントで getByBuyerNumber が includeDeleted=true で呼ばれている（修正確認）', () => {
    // /:id/related エンドポイントの開始行を探す
    const relatedEndpointLineIndex = lines.findIndex(
      line => line.includes("'/:id/related'") && line.includes('router.get')
    );

    expect(relatedEndpointLineIndex).toBeGreaterThan(-1);
    console.log(`\n📊 /:id/related エンドポイント開始行: ${relatedEndpointLineIndex + 1}`);

    // エンドポイント内（開始行から50行以内）を検索
    const endpointLines = lines.slice(relatedEndpointLineIndex, relatedEndpointLineIndex + 50);
    const endpointContent = endpointLines.join('\n');

    // getByBuyerNumber の呼び出しを探す
    const getByBuyerNumberCallIndex = endpointLines.findIndex(
      line => line.includes('getByBuyerNumber(id)')
    );

    if (getByBuyerNumberCallIndex >= 0) {
      const callLine = endpointLines[getByBuyerNumberCallIndex].trim();
      console.log(`  getByBuyerNumber 呼び出し行: ${relatedEndpointLineIndex + getByBuyerNumberCallIndex + 1}`);
      console.log(`  該当行: ${callLine}`);

      // includeDeleted=true が渡されているか確認
      const hasIncludeDeleted = callLine.includes('getByBuyerNumber(id, true)');
      console.log(`  includeDeleted=true が渡されている: ${hasIncludeDeleted}`);

      if (!hasIncludeDeleted) {
        console.log('\n❌ カウンターエグザンプル:');
        console.log('  入力: deleted_at IS NOT NULL の買主番号（例: 7359）で GET /buyers/7359/related');
        console.log('  期待: 200 + 関連買主データ');
        console.log('  実際: 404 {"error":"Not Found","code":"BUYER_NOT_FOUND"}');
        console.log('  原因: getByBuyerNumber(id) が deleted_at IS NULL フィルタを適用するため null を返す');
      }
    }

    // 修正後のコードでは getByBuyerNumber(id, true) が呼ばれる
    // 未修正コードでは getByBuyerNumber(id) のみのためこのテストは失敗する
    const hasCorrectCall = endpointContent.includes('getByBuyerNumber(id, true)');
    expect(hasCorrectCall).toBe(true);
  });

  /**
   * テスト: /:id/restore エンドポイントでは getByBuyerNumber(id, true) が使われていることを確認
   *
   * このテストは修正前後どちらでもパスする（正しいパターンが存在することを確認）
   */
  test('/:id/restore エンドポイントでは getByBuyerNumber(id, true) が使われている（正しいパターン確認）', () => {
    // /:id/restore エンドポイントの開始行を探す
    const restoreEndpointLineIndex = lines.findIndex(
      line => line.includes("'/:id/restore'") && line.includes('router.post')
    );

    expect(restoreEndpointLineIndex).toBeGreaterThan(-1);
    console.log(`\n📊 /:id/restore エンドポイント開始行: ${restoreEndpointLineIndex + 1}`);

    // エンドポイント内を検索
    const endpointLines = lines.slice(restoreEndpointLineIndex, restoreEndpointLineIndex + 20);
    const endpointContent = endpointLines.join('\n');

    // getByBuyerNumber(id, true) が使われているか確認
    const hasCorrectCall = endpointContent.includes('getByBuyerNumber(id, true)');
    console.log(`  getByBuyerNumber(id, true) が使われている: ${hasCorrectCall}`);

    expect(hasCorrectCall).toBe(true);
    console.log('\n✅ /:id/restore では正しく includeDeleted=true が渡されています');
    console.log('  /:id/related でも同様の修正が必要です（バグ2の根本原因）');
  });

  /**
   * テスト: getByBuyerNumber のデフォルト引数が includeDeleted=false であることを確認
   *
   * このテストは修正前後どちらでもパスする（バグの根本原因を文書化）
   */
  test('getByBuyerNumber のデフォルト引数が includeDeleted=false である（根本原因確認）', () => {
    // BuyerService.ts のパスを構築
    const buyerServicePath = path.join(
      __dirname,
      '../../../../backend/src/services/BuyerService.ts'
    );

    const buyerServiceContent = fs.readFileSync(buyerServicePath, 'utf-8');

    // getByBuyerNumber のシグネチャを確認
    const signaturePattern = /getByBuyerNumber\s*\(\s*buyerNumber\s*:\s*string\s*,\s*includeDeleted\s*:\s*boolean\s*=\s*false\s*\)/;
    const hasDefaultFalse = signaturePattern.test(buyerServiceContent);

    console.log(`\n📊 getByBuyerNumber のデフォルト引数:`);
    console.log(`  includeDeleted のデフォルト値が false: ${hasDefaultFalse}`);

    expect(hasDefaultFalse).toBe(true);
    console.log('\n✅ getByBuyerNumber(id) は deleted_at IS NULL フィルタを適用します');
    console.log('  論理削除済み買主の場合は null を返すため、/:id/related で404になります');
  });
});
