/**
 * Preservation tests (property-based)
 *
 * Validates that the fixed getPurchaseStatusText behaves correctly
 * when only one source exists or both are null.
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import * as fc from 'fast-check';
import { getPurchaseStatusText } from '../utils/purchaseStatusUtils';

describe('Preservation: single source or both null', () => {
  it('offer_status only (latest_status=null) returns offer_status', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (offerStatus) => getPurchaseStatusText(null, offerStatus) === offerStatus
      ),
      { numRuns: 10 }
    );
  });

  it('offer_status only (latest_status=undefined) returns offer_status', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (offerStatus) => getPurchaseStatusText(undefined, offerStatus) === offerStatus
      ),
      { numRuns: 10 }
    );
  });

  it('latest_status only (contains "buy") returns latest_status', () => {
    fc.assert(
      fc.property(
        fc.string().map((s) => '\u8cb7' + s),
        (latestStatus) => getPurchaseStatusText(latestStatus, null) === latestStatus
      ),
      { numRuns: 10 }
    );
  });

  it('both null returns null', () => {
    expect(getPurchaseStatusText(null, null)).toBeNull();
    expect(getPurchaseStatusText(undefined, undefined)).toBeNull();
    expect(getPurchaseStatusText(null, undefined)).toBeNull();
    expect(getPurchaseStatusText(undefined, null)).toBeNull();
  });

  it('both null with timestamps returns null', () => {
    expect(
      getPurchaseStatusText(null, null, '2025-06-10T00:00:00.000Z', '2025-06-01T00:00:00.000Z')
    ).toBeNull();
  });

  it('latest_status without "buy" and null offer_status returns null', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('\u8cb7')),
        (latestStatus) => getPurchaseStatusText(latestStatus, null) === null
      ),
      { numRuns: 10 }
    );
  });
});
