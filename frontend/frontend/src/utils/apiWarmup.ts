/**
 * Vercelサーバーレス関数のウォームアップ
 * コールドスタートによる遅延を軽減するため、アプリ起動時にhealthチェックを実行する
 */

let warmedUp = false;

export async function warmupApi(): Promise<void> {
  if (warmedUp) return;

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // healthエンドポイントと主要APIを並列でウォームアップ
  // レスポンスは使わない（サーバーを起こすだけ）
  const endpoints = [
    '/health',
    '/api/sellers/sidebar-counts',
    '/api/buyers/status-categories-only',
  ];

  try {
    await Promise.allSettled(
      endpoints.map((path) =>
        fetch(`${apiUrl}${path}`, {
          method: 'GET',
          signal: AbortSignal.timeout(8000),
        })
      )
    );
    warmedUp = true;
    console.log('✅ API warmed up');
  } catch {
    // ウォームアップ失敗は無視（通常のリクエストで起動される）
  }
}
