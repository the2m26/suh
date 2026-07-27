import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ GitHub Pages дэд замд байршуулах тул base замыг тохируулав.
// Deploy хийхдээ: npm run build → dist/ фолдерийг repo-ийн
// "userapp-react/" дэд хавтас руу upload хийнэ.
export default defineConfig({
  plugins: [react()],
  base: '/suh/userapp-react/',
})
