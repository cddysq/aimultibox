/**
 * 语言建议横幅
 *
 * 基于 IP 地理位置检测用户所在地区，当地区语言与当前网站语言不同时，建议用户切换
 */
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Globe, X } from 'lucide-react'
import { SUPPORTED_LANGS, type SupportedLang, COUNTRY_TO_LANG } from '@/locales'

const DISMISSED_KEY = 'aimultibox-lang-suggestion-dismissed'

/** GeoIP API 列表（按优先级排序，失败时自动切换） */
const GEOIP_APIS = [
  // ipapi.co - 免费 1000 次/天，支持 HTTPS
  { url: 'https://ipapi.co/json/', parse: (d: { country_code: string; country_name: string }) => ({ countryCode: d.country_code, country: d.country_name }) },
  // ipwho.is - 免费无限制，支持 HTTPS
  { url: 'https://ipwho.is/', parse: (d: { country_code: string; country: string }) => ({ countryCode: d.country_code, country: d.country }) },
] as const

interface GeoInfo {
  countryCode: string
  country: string
}

/** 获取用户地理位置 */
function useGeoLocation() {
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGeo = async () => {
      for (const api of GEOIP_APIS) {
        try {
          const res = await fetch(api.url)
          if (!res.ok) {
            console.warn(`[i18n] GeoIP API 请求失败 (${api.url}):`, res.status)
            continue
          }
          const data = await res.json()
          const parsed = api.parse(data)
          if (parsed.countryCode) {
            setGeoInfo(parsed)
            return
          }
        } catch (err) {
          console.warn(`[i18n] GeoIP 请求异常 (${api.url}):`, err instanceof Error ? err.message : err)
        }
      }
      console.warn('[i18n] 所有 GeoIP API 均失败')
    }
    fetchGeo().finally(() => setLoading(false))
  }, [])

  return { geoInfo, loading }
}

export default function LanguageSuggestionBanner() {
  const { t, i18n } = useTranslation()
  const { geoInfo, loading } = useGeoLocation()
  const [visible, setVisible] = useState(false)
  const [suggestedLang, setSuggestedLang] = useState<SupportedLang | null>(null)

  const currentLang = i18n.language as SupportedLang

  // 判断是否需要显示横幅
  useEffect(() => {
    if (loading || !geoInfo) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const suggested = COUNTRY_TO_LANG[geoInfo.countryCode]
    if (suggested && SUPPORTED_LANGS.includes(suggested) && suggested !== currentLang) {
      setSuggestedLang(suggested)
      setTimeout(() => setVisible(true), 500)
    }
  }, [loading, geoInfo, currentLang])

  const handleSwitch = useCallback(() => {
    if (suggestedLang) i18n.changeLanguage(suggestedLang)
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }, [suggestedLang, i18n])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }, [])

  if (!visible || !geoInfo || !suggestedLang) return null

  // 从翻译文件获取本地化名称
  const countryName = t(`langSuggestion.countries.${geoInfo.countryCode}`, { defaultValue: geoInfo.country })
  const suggestedLangName = t(`langSuggestion.langs.${suggestedLang}`, { defaultValue: suggestedLang })

  const bannerContent = (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50
                 animate-in slide-in-from-bottom-4 fade-in-0 duration-300"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
                   ring-1 ring-black/5 dark:ring-white/10
                   overflow-hidden"
      >
        {/* 主内容区 */}
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {/* 图标 */}
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full
                         bg-primary-50 dark:bg-primary-500/10
                         flex items-center justify-center"
            >
              <Globe className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>

            {/* 文本内容 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('langSuggestion.detected', { country: countryName })}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('langSuggestion.switchHint', { lang: suggestedLangName })}
              </p>
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1.5 -m-1.5 rounded-full
                         text-gray-400 dark:text-gray-500
                         hover:text-gray-600 dark:hover:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-slate-700
                         transition-colors"
              aria-label={t('common.close') || 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 h-9 px-4 rounded-lg text-sm font-medium
                         bg-gray-100 dark:bg-slate-700
                         text-gray-700 dark:text-gray-200
                         hover:bg-gray-200 dark:hover:bg-slate-600
                         transition-colors"
            >
              {t('langSuggestion.keepCurrent')}
            </button>
            <button
              onClick={handleSwitch}
              className="flex-1 h-9 px-4 rounded-lg text-sm font-medium
                         bg-primary-600 dark:bg-primary-500
                         text-white
                         hover:bg-primary-700 dark:hover:bg-primary-600
                         transition-colors"
            >
              {t('langSuggestion.switchTo', { lang: suggestedLangName })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(bannerContent, document.body)
}
