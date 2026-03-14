/**
 * Bug Condition Exploration Test: Property List Order Fix
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import * as fs from 'fs';
import * as path from 'path';

function extractGetAllBody(source: string): string {
  const startIdx = source.indexOf('async getAll(');
  if (startIdx === -1) return '';
  const nextMethodIdx = source.indexOf('\n  async ', startIdx + 'async getAll('.length);
  if (nextMethodIdx === -1) return source.substring(startIdx);
  return source.substring(startIdx, nextMethodIdx);
}

describe('Bug Condition Exploration: distribution_date sort is used (not contract_date)', () => {
  const serviceFilePath = path.resolve(__dirname, '../PropertyListingService.ts');
  let serviceSource: string;
  let getAllBody: string;

  beforeAll(() => {
    serviceSource = fs.readFileSync(serviceFilePath, 'utf-8');
    getAllBody = extractGetAllBody(serviceSource);
  });

  describe('Verification 1: getAll() sorts by distribution_date (not contract_date)', () => {
    it('getAll() body contains distribution_date sort order', () => {
      expect(getAllBody.length).toBeGreaterThan(0);
      const hasDistributionDateSort =
        getAllBody.includes("order('distribution_date'") ||
        getAllBody.includes('order("distribution_date"');
      expect(hasDistributionDateSort).toBe(true);
    });

    it('getAll() does NOT sort by contract_date directly', () => {
      const hasContractDateSort =
        getAllBody.includes("order('contract_date'") ||
        getAllBody.includes('order("contract_date"');
      expect(hasContractDateSort).toBe(false);
    });

    it('getAll() does NOT use orderBy parameter for sort (hardcoded sort)', () => {
      const hasOrderByParam =
        getAllBody.includes('.order(orderBy') ||
        getAllBody.includes('.order( orderBy');
      expect(hasOrderByParam).toBe(false);
    });
  });

  describe('Verification 2: null distribution_date items are placed at the end', () => {
    it('getAll() uses nullsFirst: false for distribution_date sort', () => {
      const hasNullsLast =
        getAllBody.includes('nullsFirst: false') ||
        getAllBody.includes('nullsFirst:false');
      expect(hasNullsLast).toBe(true);
    });

    it('distribution_date sort is descending (ascending: false)', () => {
      const hasDescendingSort =
        getAllBody.includes('ascending: false') ||
        getAllBody.includes('ascending:false');
      expect(hasDescendingSort).toBe(true);
    });
  });

  describe('Verification 3: property_number fallback sort is present', () => {
    it('getAll() body contains property_number sort as fallback', () => {
      const hasPropertyNumberSort =
        getAllBody.includes("order('property_number'") ||
        getAllBody.includes('order("property_number"');
      expect(hasPropertyNumberSort).toBe(true);
    });

    it('property_number sort comes after distribution_date sort', () => {
      const distributionDateSortIdx =
        getAllBody.indexOf("order('distribution_date'") !== -1
          ? getAllBody.indexOf("order('distribution_date'")
          : getAllBody.indexOf('order("distribution_date"');
      const propertyNumberSortIdx =
        getAllBody.indexOf("order('property_number'") !== -1
          ? getAllBody.indexOf("order('property_number'")
          : getAllBody.indexOf('order("property_number"');
      expect(distributionDateSortIdx).toBeGreaterThan(-1);
      expect(propertyNumberSortIdx).toBeGreaterThan(-1);
      expect(propertyNumberSortIdx).toBeGreaterThan(distributionDateSortIdx);
    });
  });

  describe('Verification 4: distribution_date is included in SELECT clause', () => {
    it('getAll() SELECT clause includes distribution_date', () => {
      expect(getAllBody.includes('distribution_date')).toBe(true);
    });

    it('getAll() SELECT clause includes contract_date', () => {
      expect(getAllBody.includes('contract_date')).toBe(true);
    });
  });

  describe('Verification 5: two-level sort structure is correct', () => {
    it('getAll() has at least two .order() calls for sort', () => {
      const orderCallMatches = getAllBody.match(/\.order\(/g);
      expect(orderCallMatches).not.toBeNull();
      expect(orderCallMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it('sort section is between filter and pagination sections', () => {
      const filterIdx = getAllBody.indexOf('if (search)');
      const firstOrderIdx = getAllBody.indexOf('.order(');
      const rangeIdx = getAllBody.indexOf('.range(');
      expect(filterIdx).toBeGreaterThan(-1);
      expect(firstOrderIdx).toBeGreaterThan(-1);
      expect(rangeIdx).toBeGreaterThan(-1);
      expect(firstOrderIdx).toBeGreaterThan(filterIdx);
      expect(rangeIdx).toBeGreaterThan(firstOrderIdx);
    });
  });
});