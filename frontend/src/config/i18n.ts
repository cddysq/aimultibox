/**
 * 国际化配置（按 namespace 拆分并动态加载）
 *
 * 设计目标：
 * - 工具级文案解耦
 * - 按需加载降低首屏体积
 * - 保持现有 key 结构不变
 */
import i18n from 'i18next'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

export const SUPPORTED_LANGS = ['zh', 'en', 'ja'] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

export const NAMESPACES = [
  'common',
  'currency',
  'watermark',
  'errors',
  'changelog',
] as const

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ns: NAMESPACES as unknown as string[],
    defaultNS: 'common',
    fallbackNS: NAMESPACES as unknown as string[],
    supportedLngs: SUPPORTED_LANGS,
    fallbackLng: 'zh',
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'aimultibox-locale',
      // 规范化语言代码：zh-CN -> zh
      convertDetectedLanguage: (lng) => lng.split('-')[0] || lng,
    },
  })

export default i18n
