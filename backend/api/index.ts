// Vercel serverless function entry point (TypeScript)
// This file directly imports and runs the Express app

// @ts-nocheck - Vercel環境では型チェックを無効化
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel環境であることを明示
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

let app: any;

async function getApp() {
  if (!app) {
    try {
      // 動的インポートでExpressアプリを取得
      const appModule = await import('../src/index');
      app = appModule.default || appModule;
      
      if (!app) {
        throw new Error('Failed to load Express app from ../src/index');
      }
      
      console.log('✅ Express app loaded successfully');
    } catch (error: any) {
      console.error('❌ Failed to load Express app:', error);
      throw error;
    }
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`📥 ${req.method} ${req.url}`);
    
    const expressApp = await getApp();
    
    // Expressアプリを実行
    return expressApp(req, res);
  } catch (error: any) {
    console.error('❌ Error in Vercel handler:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
