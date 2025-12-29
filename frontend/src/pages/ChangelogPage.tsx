/**
 * 更新日志
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Sparkles,
  Rocket,
  Zap,
  Bug,
  GitBranch,
  Calendar,
  ChevronUp,
  ArrowLeft
} from 'lucide-react'

interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'minor' | 'patch'
  titleKey: string
  changes: {
    type: 'feature' | 'improve' | 'fix'
    textKey: string
  }[]
}

// 版本历史（新版本在前）
const changelog: ChangelogEntry[] = [
  {
    version: '0.0.2',
    date: '2025-12-29',
    type: 'minor',
    titleKey: 'changelog.v002.title',
    changes: [
      { type: 'feature', textKey: 'changelog.v002.feature1' },
      { type: 'feature', textKey: 'changelog.v002.feature2' },
      { type: 'feature', textKey: 'changelog.v002.feature3' },
      { type: 'feature', textKey: 'changelog.v002.feature4' },
      { type: 'improve', textKey: 'changelog.v002.improve1' },
      { type: 'improve', textKey: 'changelog.v002.improve2' },
    ]
  },
  {
    version: '0.0.1',
    date: '2025-12-07',
    type: 'major',
    titleKey: 'changelog.v001.title',
    changes: [
      { type: 'feature', textKey: 'changelog.v001.feature1' },
      { type: 'feature', textKey: 'changelog.v001.feature2' },
      { type: 'feature', textKey: 'changelog.v001.feature3' },
      { type: 'feature', textKey: 'changelog.v001.feature4' },
      { type: 'feature', textKey: 'changelog.v001.feature5' },
    ]
  },
]

const typeIcons = {
  feature: Sparkles,
  improve: Zap,
  fix: Bug,
}

const typeLabels = {
  feature: 'changelog.types.feature',
  improve: 'changelog.types.improve',
  fix: 'changelog.types.fix',
}

const typeColors = {
  feature: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
  improve: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
  fix: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
}

const versionColors = {
  major: 'from-primary-500 to-purple-500',
  minor: 'from-blue-500 to-cyan-500',
  patch: 'from-gray-400 to-gray-500',
}

const nodeColors = {
  major: 'bg-gradient-to-br from-primary-500 to-purple-500 shadow-primary-500/30',
  minor: 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/30',
  patch: 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-500/30',
}

export default function ChangelogPage() {
  const { t } = useTranslation()
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set())
  const [showBackTop, setShowBackTop] = useState(false)
  const itemRefs = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            setVisibleItems((prev) => new Set(prev).add(index))
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleScroll = () => setShowBackTop(window.scrollY > 300)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <GitBranch className="w-7 h-7 text-primary-600 dark:text-primary-400" />
              <span>{t('changelog.title')}</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('changelog.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* 时间线容器 */}
      <div className="relative">
        {/* 时间线轴 - 只在多版本时显示 */}
        {changelog.length > 1 && (
          <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary-400 via-purple-400 to-gray-200 dark:to-slate-700" />
        )}

        {/* 版本列表 */}
        <div className="space-y-6">
          {changelog.map((entry, index) => {
            const isVisible = visibleItems.has(index)
            const isLatest = index === 0
            const isLast = index === changelog.length - 1
            const hasMultiple = changelog.length > 1

            return (
              <div
                key={entry.version}
                ref={(el) => { if (el) itemRefs.current[index] = el }}
                data-index={index}
                className={`relative transition-all duration-500 ${hasMultiple ? 'pl-14' : ''} ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* 时间线节点 - 只在多版本时显示 */}
                {hasMultiple && (
                  <div className={`absolute left-0 w-10 h-10 rounded-xl ${nodeColors[entry.type]} flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
                    isLatest ? 'ring-2 ring-primary-200 dark:ring-primary-800 ring-offset-2 ring-offset-gray-50 dark:ring-offset-slate-900' : ''
                  }`}>
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                )}

                {/* 连接线动画点 - 只在非最后一个时显示 */}
                {hasMultiple && !isLast && (
                  <div
                    className={`absolute left-[18px] top-14 w-1.5 h-1.5 rounded-full bg-primary-400 transition-all duration-1000 ${
                      isVisible ? 'opacity-100 animate-pulse' : 'opacity-0'
                    }`}
                    style={{ transitionDelay: `${index * 100 + 300}ms` }}
                  />
                )}

                {/* 内容卡片 */}
                <div className={`rounded-xl border p-6 transition-all hover:shadow-md ${
                  isLatest
                    ? 'bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-950/50 dark:to-purple-950/50 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-500/10'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                }`}>
                  {/* 头部 */}
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center space-x-3">
                      {/* 单版本时显示图标 */}
                      {!hasMultiple && (
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${versionColors[entry.type]} flex items-center justify-center`}>
                          <Rocket className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${versionColors[entry.type]}`}>
                            v{entry.version}
                          </span>
                          {isLatest && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary-500 text-white animate-pulse">
                              {t('changelog.latest')}
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                          {t(entry.titleKey)}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-400 dark:text-gray-500 text-sm">
                      <Calendar className="w-4 h-4" />
                      <time>{entry.date}</time>
                    </div>
                  </div>

                  {/* 变更列表 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {entry.changes.map((change, changeIndex) => {
                      const Icon = typeIcons[change.type]
                      return (
                        <div
                          key={changeIndex}
                          className={`flex items-start space-x-3 p-3 rounded-lg bg-white/60 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600/50 transition-all duration-300 ${
                            isVisible ? 'opacity-100' : 'opacity-0'
                          }`}
                          style={{ transitionDelay: `${(index * 100) + (changeIndex * 50) + 200}ms` }}
                        >
                          <span className={`flex-shrink-0 p-1.5 rounded-lg ${typeColors[change.type]}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-semibold uppercase tracking-wide ${typeColors[change.type].split(' ')[0]}`}>
                              {t(typeLabels[change.type])}
                            </span>
                            <p className="text-gray-700 dark:text-gray-300 text-sm mt-0.5">
                              {t(change.textKey)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* 起点标记 */}
          <div
            ref={(el) => { if (el) itemRefs.current[changelog.length] = el }}
            data-index={changelog.length}
            className={`relative transition-all duration-500 ${changelog.length > 1 ? 'pl-14' : ''} ${
              visibleItems.has(changelog.length) ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {changelog.length > 1 && (
              <div className="absolute left-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-600">
                <Sparkles className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
            )}
            <div className={`flex items-center space-x-3 ${changelog.length > 1 ? '' : 'pt-2'}`}>
              {changelog.length <= 1 && (
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center border border-dashed border-gray-300 dark:border-slate-600">
                  <Sparkles className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
              )}
              <p className="text-gray-400 dark:text-gray-500 text-sm italic">
                {t('changelog.beginning')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 返回顶部 */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-6 right-6 w-10 h-10 rounded-full bg-gray-900 dark:bg-slate-700 text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-gray-800 dark:hover:bg-slate-600 ${
          showBackTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  )
}
