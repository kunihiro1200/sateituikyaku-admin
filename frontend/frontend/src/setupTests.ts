import '@testing-library/jest-dom';

// Mock import.meta for Vite compatibility
(global as any).import = {
  meta: {
    env: {
      VITE_API_URL: 'http://localhost:3000',
    },
  },
};
