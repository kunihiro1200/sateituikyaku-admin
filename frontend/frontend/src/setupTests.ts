import '@testing-library/jest-dom';
import * as React from 'react';

// React をグローバルに設定（jsx: 'react' モードで React import なしのコンポーネントをサポート）
(global as any).React = React;

// Mock import.meta for Vite compatibility
(global as any).import = {
  meta: {
    env: {
      VITE_API_URL: 'http://localhost:3000',
    },
  },
};
