const https = require('https');

function fetchBatch(offset) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sateituikyaku-admin-backend.vercel.app',
      path: '/api/property-listings?limit=1000&offset=' + offset + '&orderBy=distribution_date&orderDirection=desc',
      method: 'GET'
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get all listings
  const allData = [];
  
  console.log('Fetching all batches...');
  const batch1 = await fetchBatch(0);
  allData.push(...batch1.data);
  console.log('Batch 1:', batch1.data.length, 'items. Total so far:', allData.length);
  
  const batch2 = await fetchBatch(1000);
  allData.push(...batch2.data);
  console.log('Batch 2:', batch2.data.length, 'items. Total so far:', allData.length);

  console.log('\n=== Confirmation field analysis ===');
  
  // Count distinct values of confirmation
  const confirmationValues = {};
  allData.forEach(l => {
    const val = l.confirmation === null ? 'null' : 
                l.confirmation === undefined ? 'undefined' : 
                JSON.stringify(l.confirmation);
    confirmationValues[val] = (confirmationValues[val] || 0) + 1;
  });
  
  console.log('Distinct confirmation values:');
  Object.entries(confirmationValues).forEach(([val, count]) => {
    console.log('  ', val, ':', count);
  });

  // Check for items where confirmation looks like '未' but might be different
  const suspiciousItems = allData.filter(l => {
    if (!l.confirmation) return false;
    return l.confirmation.includes('未') || l.confirmation.trim() !== l.confirmation;
  });
  
  console.log('\nItems with confirmation containing 未 or with whitespace:');
  suspiciousItems.forEach(l => {
    console.log('  ', l.property_number, '| confirmation:', JSON.stringify(l.confirmation), '| hex:', Buffer.from(l.confirmation).toString('hex'));
  });

  // Also check sidebar_status for '未完了'
  const sidebarIncomplete = allData.filter(l => l.sidebar_status === '未完了');
  console.log('\nItems with sidebar_status === "未完了":', sidebarIncomplete.length);
  sidebarIncomplete.forEach(l => {
    console.log('  ', l.property_number, '| confirmation:', JSON.stringify(l.confirmation), '| sidebar_status:', l.sidebar_status, '| atbb_status:', l.atbb_status);
  });
}

main().catch(console.error);
