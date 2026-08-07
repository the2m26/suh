import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ GitHub Pages дэд замд байршуулах тул base замыг тохируулав (userapp-react-тэй
// ижил зарчим). Deploy хийхдээ: npm run build → dist/ фолдерийг repo-ийн
// "admin-react/" дэд хавтас руу upload хийнэ.
export default defineConfig({
  plugins: [react()],
  base: '/suh/admin-react/',
})
