/**
 * プロパティテスト: 送信元アドレスのラウンドトリップ
 *
 * タスク 9.1: 送信元アドレスのラウンドトリップ プロパティテスト
 *
 * **Validates: Requirements 4.1, 4.2**
 *
 * saveSenderAddress(addr) → getSenderAddress() が同じアドレスを返すことを検証する
 * 実装: frontend/frontend/src/utils/senderAddressStorage.ts
 * ストレージ: sessionStorage（キー: 'email_sender_address'）
 */

import * as fc from 'fast-check';
import { saveSenderAddress, getSenderAddress } from '../utils/senderAddressStorage';

// ===== fast-check ジェネレーター =====

/**
 * 有効なメールアドレスを生成するアービトラリー
 * fast-check の emailAddress() を使用
 */
const validEmailArb = fc.emailAddress();

/**
 * 実際に使われそうなメールアドレスのサンプル
 */
const sampleEmailArb = fc.oneof(
  fc.constant('tenant@ifoo-oita.com'),
  fc.constant('staff@example.com'),
  fc.constant('sales@company.co.jp'),
  fc.constant('info@test.org'),
  fc.emailAddress()
);

// ===== プロパティテスト =====

describe('Property 4: 送信元アドレスのラウンドトリップ（タスク 9.1）', () => {
  // 各テスト前にsessionStorageをクリア
  beforeEach(() => {
    sessionStorage.clear();
  });

  /**
   * プロパティ4-1: 任意の有効なメールアドレスに対して
   * saveSenderAddress(addr) → getSenderAddress() が同じアドレスを返すこと
   *
   * Validates: Requirements 4.1, 4.2
   */
  it('任意の有効なメールアドレスに対してsave→getがラウンドトリップすること', () => {
    fc.assert(
      fc.property(validEmailArb, (email) => {
        // 保存
        saveSenderAddress(email);
        // 取得
        const retrieved = getSenderAddress();
        // 同じアドレスが返ること
        return retrieved === email;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ4-2: サンプルメールアドレスでもラウンドトリップが成立すること
   *
   * Validates: Requirements 4.1, 4.2
   */
  it('実際に使われるメールアドレスでもsave→getがラウンドトリップすること', () => {
    fc.assert(
      fc.property(sampleEmailArb, (email) => {
        saveSenderAddress(email);
        const retrieved = getSenderAddress();
        return retrieved === email;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ4-3: 上書き保存した場合、最後に保存したアドレスが返ること
   *
   * Validates: Requirements 4.2
   */
  it('上書き保存した場合、最後に保存したアドレスが返ること', () => {
    fc.assert(
      fc.property(
        validEmailArb,
        validEmailArb,
        (firstEmail, secondEmail) => {
          // 1回目の保存
          saveSenderAddress(firstEmail);
          // 2回目の保存（上書き）
          saveSenderAddress(secondEmail);
          // 最後に保存したアドレスが返ること
          const retrieved = getSenderAddress();
          return retrieved === secondEmail;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 具体的なエッジケーステスト =====

describe('送信元アドレスの具体的なエッジケース', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('保存していない場合はデフォルトアドレスが返ること', () => {
    // sessionStorageが空の場合
    const result = getSenderAddress();
    // デフォルトアドレスが返ること
    expect(result).toBe('tenant@ifoo-oita.com');
  });

  it('保存したアドレスが正確に取得できること', () => {
    const email = 'test@example.com';
    saveSenderAddress(email);
    expect(getSenderAddress()).toBe(email);
  });

  it('日本語ドメインを含むアドレスも保存・取得できること', () => {
    const email = 'user@example.co.jp';
    saveSenderAddress(email);
    expect(getSenderAddress()).toBe(email);
  });

  it('上書き保存が正しく機能すること', () => {
    saveSenderAddress('first@example.com');
    saveSenderAddress('second@example.com');
    expect(getSenderAddress()).toBe('second@example.com');
  });
});
