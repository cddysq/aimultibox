import { useNavigate, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Home, Mail } from 'lucide-react'

/**
 * 404 页面组件
 */
export default function NotFound() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  /** 推荐页面 */
  const suggestions = [
    { name: t('currency.title'), path: '/tools/currency-manager' },
    { name: t('watermark.title'), path: '/tools/watermark-removal' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* 主内容 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* 404 数字 */}
        <div className="mb-4">
          <span className="text-[100px] md:text-[120px] font-bold leading-none tracking-tighter text-gray-100 dark:text-slate-800 select-none">
            404
          </span>
        </div>

        {/* 标题 */}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {t('errors.notFound.title')}
        </h1>

        {/* 描述 */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
          {t('errors.notFound.description')}
        </p>

        {/* 按钮组 */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('errors.notFound.back')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            {t('errors.notFound.home')}
          </button>
        </div>

        {/* 推荐页面 */}
        <div className="text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {t('errors.notFound.orVisit')}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 底部信息 */}
      <div className="pb-6 flex flex-col items-center gap-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {t('errors.notFound.visitPath')}: <code className="text-gray-500 dark:text-gray-400">{location.pathname}</code>
        </p>
        <div className="flex items-center gap-1">
          <a
            href="mailto:tanghaotian.cn@gmail.com?subject=AIMultiBox Page Issue"
            title={t('errors.notFound.feedback')}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://github.com/cddysq/aimultibox/issues"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Issues"
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
