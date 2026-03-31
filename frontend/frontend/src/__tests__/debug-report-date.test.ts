// Debug test to understand the report date logic

import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';

describe('Debug Report Date Logic', () => {
  it('should debug report date comparison', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log('Today:', today);
    console.log('Today ISO:', today.toISOString());
    console.log('Tomorrow:', tomorrow);
    console.log('Tomorrow ISO:', tomorrow.toISOString());
    console.log('Tomorrow string:', tomorrowStr);

    // parseDate関数をシミュレート
    const parsedTomorrow = new Date(tomorrowStr);
    parsedTomorrow.setHours(0, 0, 0, 0);
    console.log('Parsed tomorrow:', parsedTomorrow);
    console.log('Parsed tomorrow ISO:', parsedTomorrow.toISOString());
    console.log('Comparison (parsedTomorrow > today):', parsedTomorrow > today);
    console.log('Comparison (parsedTomorrow.getTime() > today.getTime()):', parsedTomorrow.getTime() > today.getTime());

    const listing = {
      property_number: 'DEBUG001',
      report_date: tomorrowStr,
      report_assignee: null,
      confirmation: null,
      atbb_status: null,
      sales_assignee: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      price_reduction_scheduled_date: null,
    };

    const status = calculatePropertyStatus(listing);
    console.log('Status:', status);

    expect(status.key).toBe('unreported');
  });
});
