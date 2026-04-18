/**
 * バグ探索テスト: SUUMO URL 要登録サイドバー表示バグ
 *
 * Property 1: Bug Condition
 * - 専任・公開中の場合に calculateSidebarStatus() が返すラベルが
 *   'レインズ登録＋SUUMO URL 要登録' ではなく 'レインズ登録＋SUUMO登録' になるバグを確認する
 *
 * 重要: このテストは未修正コードで FAIL することが期待される
 * FAIL = バグの存在を証明する
 *
 * Validates: Requirements 1.1, 1.2
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PropertyListingSyncService } from '../services/PropertyListingSyncService';

describe('SUUMO URL 要登録サイドバー表示バグ - 探索テスト', () => {
  let service: PropertyListingSyncService;

  beforeAll(() => {
    service = new PropertyListingSyncService();
  });

  /**
   * Property 1: Bug Condition（専任・公開中）
   *
   * isBugCondition:
   *   atbb_status = '専任・公開中'
   *   AND suumo_url IS EMPTY
   *   AND suumo_registered != 'S不要'
   *   AND publishDate <= TODAY() - 1
   *
   * expectedBehavior: result = 'レインズ登録＋SUUMO URL 要登録'
   * bugBehavior:      result = 'レインズ登録＋SUUMO登録'
   *
   * 未修正コードでは FAIL する（バグの存在を証明）
   */
  test(
    '専任・公開中・suumo_url空・S不要でない・公開予定日が昨日以前 → "レインズ登録＋SUUMO URL 要登録" が返されること（未修正コードでFAIL）',
    () => {
      // バグ条件を満たす入力データを作成
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD形式

      const row = {
        '物件番号': 'AA3959',
        'atbb成約済み/非公開': '専任・公開中',
        'Suumo URL': '',          // 空（バグ条件）
        'Suumo登録': '',          // S不要ではない（バグ条件）
        '報告日': null,
        '確認': '',
        '一般媒介非公開（仮）': '',
        '１社掲載': '',
        '買付': '',
        '担当名（営業）': '',
      };

      // 公開予定日が昨日以前のgyomuListDataを作成
      const gyomuListData = [
        {
          '物件番号': 'AA3959',
          '公開予定日': yesterdayStr,
        },
      ];

      const result = service.calculateSidebarStatus(row, gyomuListData);

      console.log('\n--- 専任・公開中バグ条件の確認 ---');
      console.log(`  入力: atbb_status='専任・公開中', suumo_url='', suumo_registered='', 公開予定日='${yesterdayStr}'`);
      console.log(`  実際の返り値: '${result}'`);
      console.log(`  期待値: 'レインズ登録＋SUUMO URL 要登録'`);

      if (result === 'レインズ登録＋SUUMO登録') {
        console.log('\n🐛 バグ確認: calculateSidebarStatus() が専任・公開中の場合に');
        console.log("   'レインズ登録＋SUUMO URL 要登録' ではなく 'レインズ登録＋SUUMO登録' を返している");
        console.log('   反例: { atbb_status: "専任・公開中", suumo_url: "", 公開予定日: 昨日以前 }');
        console.log('   根本原因: PropertyListingSyncService.calculateSidebarStatus() 条件⑥のラベル文字列が誤っている');
      }

      // 期待動作: 'レインズ登録＋SUUMO URL 要登録' が返されるべき
      // 未修正コードでは FAIL する（これがバグの証明）
      expect(result).toBe('レインズ登録＋SUUMO URL 要登録');
    }
  );

  /**
   * 一般・公開中の場合は既に正しいラベルが返されることを確認
   * （こちらは修正前のコードでも PASS する）
   */
  test(
    '一般・公開中・suumo_url空・S不要でない・公開予定日が昨日以前 → "SUUMO URL　要登録" が返されること（修正前コードでもPASS）',
    () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const row = {
        '物件番号': 'AA3959',
        'atbb成約済み/非公開': '一般・公開中',
        'Suumo URL': '',          // 空
        'Suumo登録': '',          // S不要ではない
        '報告日': null,
        '確認': '',
        '一般媒介非公開（仮）': '',
        '１社掲載': '',
        '買付': '',
        '担当名（営業）': '',
      };

      const gyomuListData = [
        {
          '物件番号': 'AA3959',
          '公開予定日': yesterdayStr,
        },
      ];

      const result = service.calculateSidebarStatus(row, gyomuListData);

      console.log('\n--- 一般・公開中の確認 ---');
      console.log(`  入力: atbb_status='一般・公開中', suumo_url='', suumo_registered='', 公開予定日='${yesterdayStr}'`);
      console.log(`  実際の返り値: '${result}'`);
      console.log(`  期待値: 'SUUMO URL\u3000要登録'`);

      // 一般・公開中は修正前のコードでも正しいラベルが返される
      expect(result).toBe('SUUMO URL\u3000要登録');
    }
  );

  /**
   * suumo_url が null の場合も空として扱われることを確認
   */
  test(
    '専任・公開中・suumo_url=null・S不要でない・公開予定日が昨日以前 → "レインズ登録＋SUUMO URL 要登録" が返されること（未修正コードでFAIL）',
    () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const row = {
        '物件番号': 'AA3959',
        'atbb成約済み/非公開': '専任・公開中',
        'Suumo URL': null,        // null（バグ条件）
        'Suumo登録': '',
        '報告日': null,
        '確認': '',
        '一般媒介非公開（仮）': '',
        '１社掲載': '',
        '買付': '',
        '担当名（営業）': '',
      };

      const gyomuListData = [
        {
          '物件番号': 'AA3959',
          '公開予定日': yesterdayStr,
        },
      ];

      const result = service.calculateSidebarStatus(row, gyomuListData);

      console.log('\n--- 専任・公開中・suumo_url=null のバグ条件確認 ---');
      console.log(`  実際の返り値: '${result}'`);
      console.log(`  期待値: 'レインズ登録＋SUUMO URL 要登録'`);

      // 未修正コードでは FAIL する
      expect(result).toBe('レインズ登録＋SUUMO URL 要登録');
    }
  );
});
