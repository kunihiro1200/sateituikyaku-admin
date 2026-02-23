// 社内管理システム（sateituikyaku-admin）専用のエントリーポイント
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/index';

// Health check
console.log('🚀 Vercel serverless function initialized');

// Vercel用のハンドラー（重要：これがないとVercelで動作しない）
// Vercelのサーバーレス関数として動作させるため、Expressアプリをラップ
export default async (req: VercelRequest, res: VercelResponse) => {
  console.log(`📥 Request: ${req.method} ${req.url}`);
  
  // Expressアプリにリクエストを渡す
  return app(req as any, res as any);
};

