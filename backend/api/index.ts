// Vercel serverless function entry point (TypeScript)
// This file directly imports and runs the Express app

// @ts-nocheck - Vercel環境では型チェックを無効化
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel環境であることを明示
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

let app: any;
let appLoadError: any = null;

async function getApp() {
  if (appLoadError) {
    throw appLoadError;
  }
  
  if (!app) {
    try {
      console.log('🔄 Loading Express app from ../src/index...');
      
      // 動的インポートでExpressアプリを取得
      const appModule = await import('../src/index');
      console.log('📦 Module loaded:', Object.keys(appModule));
      
      app = appModule.default || appModule.app || appModule;
      
      if (!app) {
        throw new Error('Failed to load Express app from ../src/index - no default export found');
      }
      
      if (typeof app !== 'function') {
        throw new Error(`Express app is not a function, got: ${typeof app}`);
      }
      
      console.log('✅ Express app loaded successfully');
    } catch (error: any) {
      console.error('❌ Failed to load Express app:', error);
      console.error('Stack:', error.stack);
      appLoadError = error;
      throw error;
    }
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`📥 ${req.method} ${req.url}`);
    console.log('🔍 Headers:', JSON.stringify(req.headers, null, 2));
    
    const expressApp = await getApp();
    console.log('🚀 Calling Express app...');
    
    // Expressアプリを実行
    return expressApp(req, res);
  } catch (error: any) {
    console.error('❌ Error in Vercel handler:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: error.stack
    });
  }
}
