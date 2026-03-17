/**
 * Vercelサーバーレス関数のウォームアップ
 * コールドスタートによる遅延を軽減するため、アプリ起動時にhealthチェックを実行する
 */

let warmedUp = false;

export async function warmupApi(): Promise<void> {
  if (warmedUp) return;

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    // healthエンドポイントにpingを送ってサーバーを起こす
    await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5秒でタイムアウト
    });
    warmedUp = true;
    console.log('✅ API warmed up');
  } catch {
    // ウォームアップ失敗は無視（通常のリクエストで起動される）
  }
}
