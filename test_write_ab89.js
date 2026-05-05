// AB89への書き込みを直接テスト
const https = require('https');

const data = JSON.stringify({
  extractResult: {
    acquisitionYearWareki: "8",
    acquisitionMonth: "5",
    acquisitionDay: "1",
    ownerAddress: null,
    ownerNames: null,
    otherAddressOwnerCount: null,
    totalOwnerCount: null,
    ownerDetails: null,
    hasSharedOwnership: false,
    lands: [],
    buildingLocation: null,
    houseNumber: null,
    buildingType: null,
    annexBuildings: null,
    structure: null,
    roofType: null,
    floors: null,
    floor1Area: null,
    floor2Area: null,
    registrationDate: null,
    extensionDate: null,
    hasExtension: false,
    renovationDate: null,
    hasRenovation: false,
    hasOtherRights: false,
    hasMortgage: false,
    rightChecks96: [],
    rightChecks110: []
  },
  sheetName: "重説",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1pu66LWhtbHt8_HxInR4OHIpLHpIJNaZqukix38gdo1w/edit?usp=drivesdk"
});

const options = {
  hostname: 'sateituikyaku-admin-backend.vercel.app',
  path: '/api/toki-extract/AA13984/write-kodate-keiyaku',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => { console.log('Status:', res.statusCode); console.log('Response:', body); });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
