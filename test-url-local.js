// Test: Check if the resolved URL matches COORD_PATTERNS
// From local test we know the redirect goes to:
// https://www.google.co.jp/maps/search/33.305802,+131.466274?entry=tts&g_ep=...&skid=...

const resolvedUrl = 'https://www.google.co.jp/maps/search/33.305802,+131.466274?entry=tts&g_ep=EgoyMDI2MDcyMi4wIPu8ASoASAFQAw%3D%3D&skid=6ef528c2-9f27-44a6-86d9-22abfebcc5dc';

const COORD_PATTERNS = [
  /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
  /!3d(-?\d+\.?\d*)![^!]*!4d(-?\d+\.?\d*)/,
  /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  /\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/,
  /\/place\/[^/]*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  /\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
];

const targets = [resolvedUrl];
try { targets.push(decodeURIComponent(resolvedUrl)); } catch {}

console.log('Testing URL:', resolvedUrl);
console.log('Decoded URL:', targets[1] || '(same)');

for (const target of targets) {
  for (let i = 0; i < COORD_PATTERNS.length; i++) {
    const m = target.match(COORD_PATTERNS[i]);
    if (m) {
      console.log(`\nMATCH! Pattern[${i}]: lat=${m[1]}, lng=${m[2]}`);
      process.exit(0);
    }
  }
}
console.log('\nNO MATCH - no pattern matched');
