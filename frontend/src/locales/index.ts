/**
 * 国际化配置
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import zh from './zh.json'
import en from './en.json'

const STORAGE_KEY = 'aimultibox-locale'

/** 获取保存的语言设置 */
const getSavedLocale = (): string => {
  if (typeof window === 'undefined') return 'zh'
  return localStorage.getItem(STORAGE_KEY) || 'zh'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: getSavedLocale(),
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
  })

// 语言切换时保存到 localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
