import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // If deploying to GitHub Pages (not Vercel), uncomment and set your repo name:
  // base: '/your-repo-name/',
})
