// API Key認証ミドルウェア（GAS専用）
import { Request, Response, NextFunction } from 'express';

/**
 * API Key認証ミドルウェア
 * 
 * GASからのリクエストを認証するために使用します。
 * リクエストヘッダーに `X-API-Key` を含める必要があります。
 * 
 * 環境変数 `GAS_API_KEY` に設定されたAPI Keyと照合します。
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.GAS_API_KEY;

  // API Keyが設定されていない場合はエラー
  if (!expectedApiKey) {
    console.error('[API Key Auth] GAS_API_KEY environment variable is not set');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API Key authentication is not configured'
    });
  }

  // API Keyが提供されていない場合
  if (!apiKey) {
    console.warn('[API Key Auth] No API Key provided in request');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'API Key is required. Please provide X-API-Key header.'
    });
  }

  // API Keyが一致しない場合
  if (apiKey !== expectedApiKey) {
    console.warn('[API Key Auth] Invalid API Key provided');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid API Key'
    });
  }

  // 認証成功
  console.log('[API Key Auth] Authentication successful');
  next();
}
