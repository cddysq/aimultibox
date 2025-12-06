/**
 * 应用根组件
 */
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ChangelogPage from './pages/ChangelogPage'
import WatermarkRemovalPage from './tools/watermark_removal/WatermarkRemovalPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="changelog" element={<ChangelogPage />} />
        <Route path="tools/watermark-removal" element={<WatermarkRemovalPage />} />
      </Route>
    </Routes>
  )
}

export default App
