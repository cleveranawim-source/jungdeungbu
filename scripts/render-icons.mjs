// 일회성: public/icons/icon.svg 를 PNG 로 렌더한다. 실행: node scripts/render-icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/icons/icon.svg', 'utf8')
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 }
const b = await chromium.launch()
for (const [name, n] of Object.entries(sizes)) {
  const p = await b.newPage({ viewport: { width: n, height: n } })
  // iOS 가 직접 모서리를 둥글리므로 apple-touch-icon 은 꽉 찬 사각형(투명 모서리는 검게 칠해진다)
  const art = name.startsWith('apple') ? svg.replace('rx="112"', 'rx="0"') : svg
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${n}px;height:${n}px}</style>${art}`)
  await p.screenshot({ path: `public/icons/${name}`, omitBackground: true })
  await p.close()
}
await b.close()
