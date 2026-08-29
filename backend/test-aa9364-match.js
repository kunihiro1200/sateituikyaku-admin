require('dotenv').config({ path: '../.env.local' });
const { MatchingIntentService } = require('./dist/services/MatchingIntentService');

const service = new MatchingIntentService();

service.findSellerCandidatesForSellerBuyIntent('AA9364')
  .then(result => {
    console.log('AA9364の買いたいマッチング結果:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\nAA14856が候補に含まれているか:', result.candidates.some(c => c.number === 'AA14856'));
  })
  .catch(error => console.error('Error:', error));
