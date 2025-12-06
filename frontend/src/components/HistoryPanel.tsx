/**
 * 处理历史面板组件
 */
import { useState } from 'react'
import { History, Trash2, ChevronDown, ChevronUp, X, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHistoryStore, HistoryItem } from '@/stores'

interface HistoryPanelProps {
  toolId: string
  onSelect?: (item: HistoryItem) => void
}

const MAX_HISTORY = 10

export default function HistoryPanel({ toolId, onSelect }: HistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { history, removeHistory, clearHistory } = useHistoryStore()
  const { t } = useTranslation()
  
  const toolHistory = history.filter(item => item.toolId === toolId)

  if (toolHistory.length === 0) return null

  const formatTime = (timestamp: number) => {
    const now = new Date()
    const diff = now.getTime() - timestamp
    
    if (diff < 60000) return t('history.justNow')
    if (diff < 3600000) return t('history.minutesAgo', { count: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('history.hoursAgo', { count: Math.floor(diff / 3600000) })
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* 标题栏 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
          <History className="w-4 h-4" />
          <span className="font-medium">{t('history.title')}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({toolHistory.length}/{MAX_HISTORY})
          </span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-slate-700">
          {/* 操作栏 */}
          <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('history.maxHint', { max: MAX_HISTORY })}
            </span>
            <button
              onClick={() => clearHistory()}
              className="text-xs text-red-500 hover:text-red-600 flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>{t('history.clear')}</span>
            </button>
          </div>

          {/* 历史列表 */}
          <div className="max-h-64 overflow-y-auto">
            {toolHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect?.(item)}
                className="px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-b-0 
                         hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  {/* 缩略图：原图 → 处理后 */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <div className="relative">
                      <img
                        src={item.originalImage}
                        alt=""
                        className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-slate-600"
                      />
                      <span className="absolute -bottom-1 -right-1 px-1 text-[10px] bg-gray-600 text-white rounded">
                        {t('history.original')}
                      </span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <div className="relative">
                      <img
                        src={item.processedImage}
                        alt=""
                        className="w-12 h-12 object-cover rounded border-2 border-green-400 dark:border-green-500"
                      />
                      <span className="absolute -bottom-1 -right-1 px-1 text-[10px] bg-green-500 text-white rounded">
                        {t('history.result')}
                      </span>
                    </div>
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        item.mode === 'manual' 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      }`}>
                        {item.mode === 'manual' ? t('watermark.modes.manualShort') : t('watermark.modes.autoShort')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatTime(item.timestamp)}
                    </p>
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeHistory(item.id)
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
