// Bug condition exploration test: SellerService.updateSeller() sets updates.site = data.site
// Validates: Requirements 1.1, 1.2
//
// Bug condition: updateSeller() receives data.site and executes updates.site = data.site
// using a non-existent column name. The sellers table has no 'site' column; correct name is 'inquiry_site'.
//
// On unfixed code:
//   - Cases 1-3 FAIL (asserting updates.site is NOT set)
//   - This proves the bug exists

// Mock supabase.ts to avoid initialization errors
jest.mock('../../config/supabase', () => ({
  supabase: {},
  supabaseClient: {},
  default: {},
}));

jest.mock('../../utils/cache', () => ({
  CacheHelper: {
    del: jest.fn().mockResolvedValue(undefined),
    delPattern: jest.fn().mockResolvedValue(undefined),
    generateKey: jest.fn().mockReturnValue('mock-key'),
  },
  CACHE_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

jest.mock('../SellerNumberService', () => ({
  sellerNumberService: { generateWithRetry: jest.fn().mockResolvedValue('AA99999') },
}));

jest.mock('../DuplicateDetectionService', () => ({
  duplicateDetectionService: {
    instance: {
      checkDuplicates: jest.fn().mockResolvedValue([]),
      recordDuplicateHistory: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock('../SyncQueue');

import { SellerService } from '../SellerService.supabase';

const MOCK_SELLER_ROW = {
  id: 'test-seller-id-001',
  seller_number: 'AA99001',
  name: 'test',
  phone_number: '09012345678',
  email: null,
  status: 'following_up',
  inquiry_site: null,
  inquiry_date: '2026-01-01',
  next_call_date: null,
  confidence: null,
  first_caller_initials: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function createSupabaseMock(capturedUpdates: { value: any }) {
  return {
    from: jest.fn().mockImplementation((_table: string) => ({
      update: jest.fn().mockImplementation((updates: any) => {
        capturedUpdates.value = updates;
        return {
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockImplementation(() => {
                if ('site' in updates) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      message: 'column "site" of relation "sellers" does not exist',
                      code: '42703',
                    },
                  });
                }
                return Promise.resolve({
                  data: { ...MOCK_SELLER_ROW, ...updates },
                  error: null,
                });
              }),
            }),
          }),
        };
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: MOCK_SELLER_ROW, error: null }),
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: MOCK_SELLER_ROW, error: null }),
          }),
        }),
      }),
    })),
  } as any;
}

describe('Bug Condition Exploration: SellerService.updateSeller() sets updates.site = data.site', () => {
  let service: SellerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SellerService();
  });

  describe('Case 1: { status: "following_up", site: "u" }', () => {
    it('should set updates.inquiry_site not updates.site (FAILS on unfixed code)', async () => {
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      let thrownError: Error | null = null;
      try {
        await service.updateSeller('test-seller-id-001', { status: 'following_up', site: 'u' } as any);
      } catch (err: any) {
        thrownError = err;
      }

      // On unfixed code: updates.site = data.site is executed, Supabase returns error
      // "Failed to update seller: column "site" of relation "sellers" does not exist"
      // After fix: updates.inquiry_site = data.site, no error
      expect(thrownError).toBeNull();
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).toHaveProperty('inquiry_site', 'u');
    });
  });

  describe('Case 2: { site: "u" } only', () => {
    it('should set updates.inquiry_site not updates.site (FAILS on unfixed code)', async () => {
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      let thrownError: Error | null = null;
      try {
        await service.updateSeller('test-seller-id-001', { site: 'u' } as any);
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).toBeNull();
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).toHaveProperty('inquiry_site', 'u');
    });
  });

  describe('Case 3: Supabase error does not occur when site field is included', () => {
    it('should not throw "column site does not exist" error after fix (FAILS on unfixed code)', async () => {
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      let thrownError: Error | null = null;
      try {
        await service.updateSeller('test-seller-id-001', { status: 'following_up', site: 'u' } as any);
      } catch (err: any) {
        thrownError = err;
      }

      // Unfixed: updates.site causes Supabase error -> exception thrown
      // Fixed: updates.inquiry_site -> no error
      expect(thrownError).toBeNull();
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).toHaveProperty('inquiry_site', 'u');
    });
  });

  describe('Case 4: No site field - normal operation (PASSES on both unfixed and fixed code)', () => {
    it('status-only update should work normally', async () => {
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      let thrownError: Error | null = null;
      try {
        await service.updateSeller('test-seller-id-001', { status: 'following_up' } as any);
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).toBeNull();
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).not.toHaveProperty('inquiry_site');
      expect(capturedUpdates.value).toHaveProperty('status', 'following_up');
    });
  });
});
