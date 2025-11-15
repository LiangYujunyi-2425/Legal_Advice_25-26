import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /predict to the remote Cloud Run API during development to avoid CORS
      '/predict': {
        target: 'https://api-452141441389.europe-west1.run.app',
        changeOrigin: true,
        secure: false,
        ws: false
      },
      // Proxy /extract-pdf-text to avoid CORS errors
      '/extract-pdf-text': {
        target: 'https://api-452141441389.europe-west1.run.app',
        changeOrigin: true,
        secure: false,
        ws: false
      },
      // Proxy /analyze to avoid CORS errors
      '/analyze': {
        target: 'https://api-452141441389.europe-west1.run.app',
        changeOrigin: true,
        secure: false,
        ws: false
      }
    }
  }
})
