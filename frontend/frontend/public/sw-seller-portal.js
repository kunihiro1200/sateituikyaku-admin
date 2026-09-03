// 売却サポートページ専用の最小限のService Worker。
// PWAとして「standalone表示」を有効にするための最低条件を満たすことが目的で、
// オフラインキャッシュ等の機能は今回のMVPでは実装しない（fetchはすべてネットワークに委譲する）。
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // 何もしない（ネットワークパススルー）。将来のオフライン対応拡張のための土台として残す。
});
