import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// webOS 24 ships Chromium 108; newer JS/CSS syntax silently breaks on the TV,
// so pin the build target. `base:'./'` emits relative asset paths for file://
// packaging inside the .ipk. hls.js and React are split into their own chunks
// so the player code stays out of the startup bundle (it is lazy-loaded).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'chrome108',
    rollupOptions: {
      output: {
        // Function form (required by Vite 8's Rolldown bundler). Keep hls.js and
        // React in their own chunks so the player stays out of the startup path.
        manualChunks(id) {
          if (id.includes('node_modules/hls.js')) return 'hls'
          if (id.includes('node_modules/react')) return 'react-vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
