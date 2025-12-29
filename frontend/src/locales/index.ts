/**
 * 国际化配置
 *
 * 语言检测优先级：localStorage -> navigator -> fallback(zh)
 *
 * 扩展新语言步骤：
 * 1. 创建翻译文件 locales/xx.json（可参考 en.json 结构）
 * 2. 在下方 resources 中 import 并添加
 * 3. 在 SUPPORTED_LANGS 数组中添加语言代码
 * 4. 在 COUNTRY_TO_LANG 中添加对应国家的语言映射
 * 5. 在各语言 json 的 langSuggestion.langs/langShort/countries 中补充本地化名称
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zh from './zh.json'
import en from './en.json'
import ja from './ja.json'

/** 支持的语言列表 */
export const SUPPORTED_LANGS = ['zh', 'en', 'ja'] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

/**
 * 国家代码 -> 推荐语言
 */
export const COUNTRY_TO_LANG: Partial<Record<string, SupportedLang>> = {
  // 中文地区
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',
  // 日语地区
  JP: 'ja',
  // 英语地区
  US: 'en', GB: 'en', AU: 'en', CA: 'en', NZ: 'en', IE: 'en', ZA: 'en', IN: 'en', SG: 'en',
  // 未支持的地区默认英语
  KR: 'en', DE: 'en', FR: 'en', IT: 'en', ES: 'en', RU: 'en', BR: 'en',
}

const STORAGE_KEY = 'aimultibox-locale'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
      ja: { translation: ja },
    },
    supportedLngs: SUPPORTED_LANGS,
    fallbackLng: 'zh',
    // 确保语言码规范化：将 ja-JP/zh-CN 等自动转为 ja/zh
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
    },
  })

export default i18n
