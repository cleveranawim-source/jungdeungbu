import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@fontsource/gowun-batang/400.css'
import '@fontsource/gowun-batang/700.css'
import './ui/theme.css'
import './ui/base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
