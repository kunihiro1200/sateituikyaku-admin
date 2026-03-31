/**
 * Property Listing Suumo URL Filter - Preservation Tests
 * 
 * These tests verify that the fix does NOT break existing behavior:
 * - Properties without Suumo URL should still be categorized as reins_suumo_required
 * - Properties with suumo_registered = "S不要" should NOT be categorized
 * - Properties with publish_scheduled_date >= today should NOT be categorized
 * - Properties with atbb_status not containing "公開中" should NOT be categorized
 * 
 * IMPORTANT: Run these tests on UNFIXED code first to establish baseline behavior.
 */

import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';

describe('Property Listing Suumo URL Filter - Preservation', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  describe('Preservation: Properties WITHOUT Suumo URL should still be categorized when workTaskMap is provided', () => {
    it('should categorize property without Suumo URL as suumo_url_required (一般・公開中) when workTaskMap is provided', () => {
      const property = {
        property_number: 'TEST001',
        atbb_status: '一般・公開中',
        suumo_url: '', // Empty Suumo URL
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST001', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).toBe('suumo_required');
    });

    it('should categorize property without Suumo URL as reins_suumo_required (専任・公開中) when workTaskMap is provided', () => {
      const property = {
        property_number: 'TEST002',
        atbb_status: '専任・公開中',
        suumo_url: null, // Null Suumo URL
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST002', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).toBe('reins_suumo_required');
    });

    it('should categorize property with undefined Suumo URL as reins_suumo_required when workTaskMap is provided', () => {
      const property = {
        property_number: 'TEST003',
        atbb_status: '専任・公開中',
        // suumo_url is undefined
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST003', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).toBe('reins_suumo_required');
    });
  });

  describe('Preservation: Properties with suumo_registered = "S不要" should NOT be categorized', () => {
    it('should NOT categorize property with suumo_registered = "S不要" even without Suumo URL', () => {
      const property = {
        property_number: 'TEST004',
        atbb_status: '専任・公開中',
        suumo_url: '',
        suumo_registered: 'S不要',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST004', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('reins_suumo_required');
      expect(status.key).not.toBe('suumo_url_required');
    });

    it('should NOT categorize property with suumo_registered = "S不要" (一般・公開中)', () => {
      const property = {
        property_number: 'TEST005',
        atbb_status: '一般・公開中',
        suumo_url: '',
        suumo_registered: 'S不要',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST005', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('suumo_url_required');
    });
  });

  describe('Preservation: Properties with publish_scheduled_date >= today should NOT be categorized', () => {
    it('should NOT categorize property with publish_scheduled_date = today', () => {
      const property = {
        property_number: 'TEST006',
        atbb_status: '専任・公開中',
        suumo_url: '',
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST006', today);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('reins_suumo_required');
      expect(status.key).not.toBe('suumo_url_required');
    });

    it('should NOT categorize property with publish_scheduled_date in the future', () => {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const property = {
        property_number: 'TEST007',
        atbb_status: '専任・公開中',
        suumo_url: '',
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST007', tomorrow);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('reins_suumo_required');
      expect(status.key).not.toBe('suumo_url_required');
    });

    it('should NOT categorize property with empty publish_scheduled_date', () => {
      const property = {
        property_number: 'TEST008',
        atbb_status: '専任・公開中',
        suumo_url: '',
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST008', null);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('reins_suumo_required');
      expect(status.key).not.toBe('suumo_url_required');
    });
  });

  describe('Preservation: Properties with atbb_status not containing "公開中" should NOT be categorized', () => {
    it('should NOT categorize property with atbb_status = "成約済み"', () => {
      const property = {
        property_number: 'TEST009',
        atbb_status: '成約済み',
        suumo_url: '',
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST009', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('reins_suumo_required');
      expect(status.key).not.toBe('suumo_url_required');
    });

    it('should NOT categorize property with atbb_status = "非公開"', () => {
      const property = {
        property_number: 'TEST010',
        atbb_status: '非公開',
        suumo_url: '',
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST010', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('reins_suumo_required');
      expect(status.key).not.toBe('suumo_url_required');
    });

    it('should NOT categorize property with empty atbb_status', () => {
      const property = {
        property_number: 'TEST011',
        atbb_status: '',
        suumo_url: '',
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();
      workTaskMap.set('TEST011', twoDaysAgo);

      const status = calculatePropertyStatus(property as any, workTaskMap);
      expect(status.key).not.toBe('reins_suumo_required');
      expect(status.key).not.toBe('suumo_url_required');
    });
  });

  describe('Preservation: Edge cases', () => {
    it('should handle property with all empty fields', () => {
      const property = {
        property_number: 'TEST012',
        atbb_status: '',
        suumo_url: '',
        suumo_registered: '',
      };

      const workTaskMap = new Map<string, Date | null>();

      const status = calculatePropertyStatus(property as any, workTaskMap);
      // Should not crash, should return some valid status
      expect(status).toBeDefined();
      expect(status.key).toBeDefined();
    });

    it('should handle property with null values', () => {
      const property = {
        property_number: 'TEST013',
        atbb_status: null,
        suumo_url: null,
        suumo_registered: null,
      };

      const workTaskMap = new Map<string, Date | null>();

      const status = calculatePropertyStatus(property as any, workTaskMap);
      // Should not crash, should return some valid status
      expect(status).toBeDefined();
      expect(status.key).toBeDefined();
    });
  });
});
