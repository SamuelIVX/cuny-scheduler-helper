import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import type { Plugin } from 'vite'

// Chrome extensions reject the `crossorigin` attribute on popup scripts/styles
function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '')
    },
  }
}

export default defineConfig({
  plugins: [react(), removeCrossorigin()],
  base: '',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
})
