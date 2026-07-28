import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://<user>.github.io/wordle-hangul/
const repoName = 'wordle-hangul'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.STDICT_API_KEY || ''
  const isPages = env.GITHUB_PAGES === 'true' || process.env.GITHUB_PAGES === 'true'

  return {
    plugins: [react()],
    // 로컬 개발은 /, GitHub Pages 배포는 /wordle-hangul/
    base: command === 'build' && isPages ? `/${repoName}/` : '/',
    server: {
      proxy: {
        '/api/stdict': {
          target: 'https://stdict.korean.go.kr',
          changeOrigin: true,
          rewrite: (path) => {
            const query = path.includes('?') ? path.slice(path.indexOf('?')) : ''
            const params = new URLSearchParams(query)
            if (apiKey) params.set('key', apiKey)
            const qs = params.toString()
            return `/api/search.do${qs ? `?${qs}` : ''}`
          },
        },
      },
    },
  }
})
