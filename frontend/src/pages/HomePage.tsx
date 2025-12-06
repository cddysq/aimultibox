/**
 * 首页 - 工具列表
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Eraser, Sparkles, Image, Loader2, AlertCircle, Wand2, FileImage, Scissors, Type } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToolsStore, Tool } from '@/stores'

/** 工具图标映射 */
const iconMap: Record<string, React.ReactNode> = {
  eraser: <Eraser className="w-8 h-8" />,
  image: <Image className="w-8 h-8" />,
  wand: <Wand2 className="w-8 h-8" />,
  'file-image': <FileImage className="w-8 h-8" />,
  scissors: <Scissors className="w-8 h-8" />,
  type: <Type className="w-8 h-8" />,
  default: <Wand2 className="w-8 h-8" />,
}

export default function HomePage() {
  const { tools, isLoading, error, fetchTools } = useToolsStore()
  const { t } = useTranslation()

  useEffect(() => {
    fetchTools()
  }, [fetchTools])

  return (
    <div className="flex-1 flex flex-col">
      {/* 标题区 */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-4 py-2 rounded-full text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          <span>{t('home.tagline')}</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
          {t('home.title')}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t('home.description')}
        </p>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400">{t('errors.loadToolsFailed')}</p>
          <button 
            onClick={fetchTools}
            className="ml-auto text-red-600 dark:text-red-400 hover:underline text-sm"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* 工具卡片列表 */}
      {!isLoading && tools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && tools.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Wand2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t('home.noTools')}</p>
          <p className="text-sm mt-2">{t('home.noToolsHint')}</p>
        </div>
      )}

      {/* 特性介绍 */}
      <div className="mt-auto pt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard 
          title={t('home.features.plugin.title')}
          description={t('home.features.plugin.desc')}
        />
        <FeatureCard 
          title={t('home.features.deploy.title')}
          description={t('home.features.deploy.desc')}
        />
        <FeatureCard 
          title={t('home.features.model.title')}
          description={t('home.features.model.desc')}
        />
      </div>
    </div>
  )
}

/** 工具卡片 */
function ToolCard({ tool }: { tool: Tool }) {
  const icon = iconMap[tool.icon] || iconMap.default
  const toolPath = `/tools/${tool.id}`

  return (
    <Link to={toolPath}>
      <div className="tool-card group">
        <div className="flex items-start space-x-4">
          <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {tool.name}
              </h3>
              {tool.status === 'active' && (
                <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
              {tool.description}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              v{tool.version}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

/** 特性卡片 */
function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  )
}
