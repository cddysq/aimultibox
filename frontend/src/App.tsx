/**
 * 应用根组件
 */
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router'
import { Loader2 } from 'lucide-react'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import NotFound from './components/NotFound'

// 懒加载工具页面
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
const WatermarkRemovalPage = lazy(() => import('./tools/watermark_removal/WatermarkRemovalPage'))
const CurrencyManagerPage = lazy(() => import('./tools/currency_manager/CurrencyManagerPage'))

/** 加载占位组件 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="changelog" element={<Suspense fallback={<PageLoader />}><ChangelogPage /></Suspense>} />
        <Route path="tools/watermark-removal" element={<Suspense fallback={<PageLoader />}><WatermarkRemovalPage /></Suspense>} />
        <Route path="tools/currency-manager" element={<Suspense fallback={<PageLoader />}><CurrencyManagerPage /></Suspense>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
