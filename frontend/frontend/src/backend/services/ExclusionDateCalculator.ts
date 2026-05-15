/**
 * ExclusionDateCalculator
 * 
 * Calculates exclusion dates for sellers based on inquiry date and site.
 * Each site has specific rules for when a seller should be excluded from follow-up.
 */

export class ExclusionDateCalculator {
  /**
   * Calculate exclusion date based on inquiry date and site
   * 
   * Site-specific rules (addDays = days to add to inquiry date):
   * - Y: add 5 days
   * - ウ: add 7 days
   * - L: add 5 days
   * - す: add 9 days
   * - a: add 8 days
   * 
   * @param inquiryDate - The inquiry date (Date object or ISO string)
   * @param site - The site identifier (Y, ウ, L, す, a)
   * @returns The calculated exclusion date or null if site has no rule
   */
  static calculateExclusionDate(
    inquiryDate: Date | string | null | undefined,
    site: string | null | undefined
  ): Date | null {
    // Handle null or undefined inputs
    if (!inquiryDate || !site) {
      return null;
    }

    // Parse inquiry date
    const inquiry = new Date(inquiryDate);
    
    // Validate date parsing
    if (isNaN(inquiry.getTime())) {
      return null;
    }

    // Normalize inquiry date to midnight UTC
    inquiry.setUTCHours(0, 0, 0, 0);

    // Site-specific rules: addDays = days to add to inquiry date
    // 除外日 = 問い合わせ日 + addDays（固定。日数経過で変わらない）
    const rules: Record<string, { addDays: number }> = {
      'Y': { addDays: 5 },
      'ウ': { addDays: 7 },
      'L': { addDays: 5 },
      'す': { addDays: 9 },
      'a': { addDays: 8 },
    };

    // Get rule for the site
    const rule = rules[site];
    if (!rule) {
      return null;
    }

    // 除外日 = 問い合わせ日 + addDays
    const exclusionDate = new Date(inquiry);
    exclusionDate.setUTCDate(exclusionDate.getUTCDate() + rule.addDays);
    return exclusionDate;
  }
}
