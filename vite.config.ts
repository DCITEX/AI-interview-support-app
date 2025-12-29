　　
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 環境変数をロード（Viteのデフォルト挙動を補完）
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // process.env.API_KEY を直接文字列として置換するように設定
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY)
    },
    server: {
      port: 3000
    },
    // index.htmlがルートにある場合のベースパス設定
    base: './'
  };
});

