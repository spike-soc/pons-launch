import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 3050
  },
  preview: {
    host: true,
    port: 3050
  },
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', '@privy-io/react-auth', 'wagmi', 'viem', '@tanstack/react-query']
  },
  optimizeDeps: {
    include: ['@privy-io/react-auth', '@privy-io/wagmi', 'wagmi', 'viem']
  }
});
