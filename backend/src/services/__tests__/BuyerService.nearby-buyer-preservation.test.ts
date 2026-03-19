// 近隣買主候補テーブル フィールド表示バグ - 保全プロパティテスト
// Property 2: Preservation - 既存フィールドの動作が変わらない
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
//
// このテストは未修正コードで PASS することが期待される（ベースライン動作を確認）
// 修正後も PASS し続けることでリグレッションがないことを確認する

import * as fs from 'fs';
import * as path from 'path';

describe('保全プロパティ: getBuyersByAreas() の既存フィールドが変わらない', () => {
  const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
  let buyerServiceSource: string;

  function extractSelectBlock(source: string): string | null {
    const methodMatch = source.match(
      /async getBuyersByAreas\s*\([^)]*\)([\s\S]*?)(?=\n  private parseDistributionAreas)/
    );
    if (!methodMatch) return null;
    const selectMatch = methodMatch[1].match(/\.select\(`([\s\S]*?)`\)/);
    return selectMatch ? selectMatch[1] : null;
  }

  function extractMethodBody(source: string): string | null {
    const methodMatch = source.match(
      /async getBuyersByAreas\s*\([^)]*\)([\s\S]*?)(?=\n  private parseDistributionAreas)/
    );
    return methodMatch ? methodMatch[1] : null;
  }

  beforeAll(() => {
    buyerServiceSource = fs.readFileSync(buyerServicePath, 'utf-8');
  });

  describe('Preservation 3.1: buyer_number が保持される', () => {
    it('buyer_number が .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('buyer_number');
    });

    it('buyer_id が .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('buyer_id');
    });
  });

  describe('Preservation 3.2: name が保持される', () => {
    it('name が .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('name');
    });
  });

  describe('Preservation 3.3: distribution_areas が保持される', () => {
    it('distribution_areas が .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('distribution_areas');
    });

    it('desired_area が .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('desired_area');
    });
  });

  describe('Preservation 3.4: フィルタリング・ソートロジックが保持される', () => {
    it('filterBuyerCandidates() の呼び出しが保持されている', () => {
      const body = extractMethodBody(buyerServiceSource);
      expect(body).not.toBeNull();
      expect(body).toContain('filterBuyerCandidates');
    });

    it('sortBuyersByDateAndConfidence() の呼び出しが保持されている', () => {
      const body = extractMethodBody(buyerServiceSource);
      expect(body).not.toBeNull();
      expect(body).toContain('sortBuyersByDateAndConfidence');
    });

    it('フィルタリングに必要なフィールドが .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('desired_property_type');
      expect(selectBlock).toContain('price_range_house');
      expect(selectBlock).toContain('price_range_apartment');
      expect(selectBlock).toContain('price_range_land');
      expect(selectBlock).toContain('inquiry_confidence');
      expect(selectBlock).toContain('reception_date');
    });
  });

  describe('Preservation 3.5: メール/SMS送信フィールドが保持される', () => {
    it('email が .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('email');
    });

    it('phone_number が .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('phone_number');
    });
  });

  describe('Preservation 3.6: ページネーション処理が保持される', () => {
    it('pageSize = 1000 が保持されている', () => {
      const body = extractMethodBody(buyerServiceSource);
      expect(body).not.toBeNull();
      expect(body).toContain('pageSize');
      expect(body).toContain('1000');
    });

    it('.range() によるページネーションが保持されている', () => {
      const body = extractMethodBody(buyerServiceSource);
      expect(body).not.toBeNull();
      expect(body).toContain('.range(');
    });
  });

  describe('全既存フィールドの一括確認', () => {
    it('全ての既存フィールドが .select() に含まれている', () => {
      const selectBlock = extractSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      const preservedFields = [
        'buyer_id',
        'buyer_number',
        'name',
        'latest_status',
        'latest_viewing_date',
        'inquiry_confidence',
        'inquiry_source',
        'distribution_type',
        'distribution_areas',
        'broker_inquiry',
        'desired_area',
        'desired_property_type',
        'price_range_house',
        'price_range_apartment',
        'price_range_land',
        'reception_date',
        'email',
        'phone_number',
      ];

      const missing: string[] = [];
      for (const field of preservedFields) {
        if (!selectBlock!.includes(field)) {
          missing.push(field);
        }
      }

      if (missing.length > 0) {
        console.log('=== リグレッション検出: 既存フィールドが削除されている ===');
        missing.forEach(f => console.log(`  ${f} が .select() から削除されている`));
      }

      expect(missing).toHaveLength(0);
    });
  });
});
