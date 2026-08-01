const https = require('https');

function fetchBatch(offset) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sateituikyaku-admin-backend.vercel.app',
      path: '/api/property-listings?limit=500&offset=' + offset + '&orderBy=distribution_date&orderDirection=desc',
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
  console.log('Fetching batch at offset 1000...');
  const json = await fetchBatch(1000);
  console.log('Items returned:', json.data.length);
  const incomplete = json.data.filter(l => l.confirmation === '未');
  console.log('Incomplete count:', incomplete.length);
  incomplete.forEach(l => {
    console.log(' -', l.property_number, '| confirmation:', l.confirmation, '| atbb_status:', l.atbb_status, '| sidebar_status:', l.sidebar_status);
  });

  if (incomplete.length === 0) {
    console.log('\nFetching batch at offset 1500...');
    const json2 = await fetchBatch(1500);
    console.log('Items returned:', json2.data.length);
    const incomplete2 = json2.data.filter(l => l.confirmation === '未');
    console.log('Incomplete count:', incomplete2.length);
    incomplete2.forEach(l => {
      console.log(' -', l.property_number, '| confirmation:', l.confirmation, '| atbb_status:', l.atbb_status, '| sidebar_status:', l.sidebar_status);
    });
  }
}

main().catch(console.error);
