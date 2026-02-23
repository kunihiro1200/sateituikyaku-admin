// Vercel serverless function entry point (TypeScript)
// Step-by-step Express app loading with detailed error reporting

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
      console.log('🔄 Step 1: Starting Express app import...');
      
      // 動的インポートでExpressアプリを取得
      const appModule = await import('../src/index');
      console.log('✅ Step 2: Module imported successfully');
      console.log('📦 Step 3: Module exports:', Object.keys(appModule));
      
      app = appModule.default || appModule.app || appModule;
      console.log('📦 Step 4: App type:', typeof app);
      
      if (!app) {
        throw new Error('Failed to load Express app - no default export found');
      }
      
      if (typeof app !== 'function') {
        throw new Error(`Express app is not a function, got: ${typeof app}`);
      }
      
      console.log('✅ Step 5: Express app loaded successfully');
    } catch (error: any) {
      console.error('❌ Failed to load Express app:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Stack trace:', error.stack);
      appLoadError = error;
      throw error;
    }
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`📥 Request: ${req.method} ${req.url}`);
    
    const expressApp = await getApp();
    console.log('🚀 Calling Express app...');
    
    // Expressアプリを実行
    return expressApp(req, res);
  } catch (error: any) {
    console.error('❌ Handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
  }
}
