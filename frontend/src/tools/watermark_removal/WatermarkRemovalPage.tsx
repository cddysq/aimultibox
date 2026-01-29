/**
 * 水印去除页
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { 
  Upload, 
  Eraser, 
  Download, 
  RefreshCw, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Wand2,
  Paintbrush,
  Info,
  Cloud,
  HardDrive,
  Copy
} from 'lucide-react'
import { removeWatermark, removeWatermarkAuto, getToolInfo } from './api'
import { addHistoryAsync } from '@/stores'
import { getErrorMessage, getErrorStatus, getRetryAfter } from '@/types'
import type { HistoryItem } from '@/stores'
import ImageCompare from './components/ImageCompare'
import MaskCanvas from './components/MaskCanvas'
import HistoryPanel from './components/HistoryPanel'

type Mode = 'manual' | 'auto'

/** 单个模式的完整状态 */
interface ModeState {
  image: string | null
  file: File | null
  result: string | null
  sliderPos: number
}

const createInitialState = (): ModeState => ({
  image: null,
  file: null,
  result: null,
  sliderPos: 50,
})

/** base64 转 File */
const base64ToFile = (base64: string, filename: string): File => {
  const arr = base64.split(',')
  const mimeMatch = arr[0]?.match(/:(.*?);/)
  const mime = mimeMatch?.[1] ?? 'image/png'
  const base64Data = arr[1] ?? ''
  const bstr = atob(base64Data)
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}

export default function WatermarkRemovalPage() {
  const { t } = useTranslation()
  
  // 两个模式完全独立的状态
  const [manualState, setManualState] = useState<ModeState>(createInitialState)
  const [autoState, setAutoState] = useState<ModeState>(createInitialState)
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null)
  
  const [mode, setMode] = useState<Mode>('manual')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0)
  const toolInfoQuery = useQuery({
    queryKey: ['watermark', 'toolInfo'],
    queryFn: getToolInfo,
    staleTime: 10 * 60_000,
  })
  const [showReuseHint, setShowReuseHint] = useState(false)
  const [brushSize, setBrushSize] = useState(30)
  const [maskResetKey, setMaskResetKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rateLimitTimerRef = useRef<number | null>(null)

  // 当前模式的状态
  const currentState = mode === 'manual' ? manualState : autoState
  const setCurrentState = mode === 'manual' ? setManualState : setAutoState
  const otherState = mode === 'manual' ? autoState : manualState

  // 是否有任何图片（用于判断显示上传区还是操作区）
  const hasAnyImage = manualState.image || autoState.image

  const toolInfo = toolInfoQuery.data || null

  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current !== null) {
        clearInterval(rateLimitTimerRef.current)
        rateLimitTimerRef.current = null
      }
    }
  }, [])

  // 检测是否可复用另一模式的图片
  const handleModeSwitch = useCallback((newMode: Mode) => {
    if (newMode === mode) return
    
    const targetState = newMode === 'manual' ? manualState : autoState
    const sourceState = newMode === 'manual' ? autoState : manualState
    
    setMode(newMode)
    
    // 如果源模式有图片，且与目标模式图片不同，提示复用/同步
    if (sourceState.image && sourceState.image !== targetState.image) {
      setShowReuseHint(true)
    } else {
      setShowReuseHint(false)
    }
  }, [mode, manualState, autoState])

  // 复用另一模式的图片
  const handleReuseImage = useCallback(() => {
    if (!otherState.image || !otherState.file) return
    
    setCurrentState({
      image: otherState.image,
      file: otherState.file,
      result: null,
      sliderPos: 50,
    })
    if (mode === 'manual') {
      setMaskDataUrl(null)
    }
    setShowReuseHint(false)
    setError(null)
  }, [otherState, setCurrentState, mode])

  // 从历史记录恢复（只恢复原图，需重新处理）
  const handleHistorySelect = useCallback((item: HistoryItem) => {
    const file = base64ToFile(item.originalImage, 'history.png')
    const newState: ModeState = {
      image: item.originalImage,
      file: file,
      result: null,
      sliderPos: 50,
    }
    
    if (item.mode === 'manual') {
      setManualState(newState)
      setMaskDataUrl(null)
      setMode('manual')
    } else {
      setAutoState(newState)
      setMode('auto')
    }
    setError(null)
  }, [])

  // 选择文件（只影响当前模式）
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(t('errors.invalidImage'))
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target?.result as string
      setCurrentState({
        image: imageData,
        file: file,
        result: null,
        sliderPos: 50,
      })
      if (mode === 'manual') {
        setMaskDataUrl(null)
      }
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [mode, setCurrentState, t])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  // 处理水印去除
  const handleProcess = useCallback(async () => {
    if (!currentState.file || !currentState.image) return
    
    if (mode === 'manual' && !maskDataUrl) {
      setError(t('watermark.warnings.needMask'))
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      let result
      
      if (mode === 'manual' && maskDataUrl) {
        result = await removeWatermark(currentState.file, maskDataUrl)
      } else {
        result = await removeWatermarkAuto(currentState.file)
      }
      
      if (result.image_base64) {
        const processedImageData = `data:image/png;base64,${result.image_base64}`
        
        setCurrentState(prev => ({
          ...prev,
          result: processedImageData,
          sliderPos: 50,
        }))
        
        // 处理成功后清空 mask（画笔大小保持）
        if (mode === 'manual') {
          setMaskDataUrl(null)
          setMaskResetKey(k => k + 1)
        }
        
        addHistoryAsync({
          toolId: 'watermark-removal',
          toolName: t('watermark.title'),
          originalImage: currentState.image,
          processedImage: processedImageData,
          mode: mode,
        })
      } else {
        setError(t('errors.processingFailed'))
      }
    } catch (err) {
      if (getErrorStatus(err) === 429) {
        const retryAfter = getRetryAfter(err)
        if (rateLimitTimerRef.current !== null) {
          clearInterval(rateLimitTimerRef.current)
          rateLimitTimerRef.current = null
        }
        setRateLimitCountdown(retryAfter)
        setError(t('errors.rateLimited'))

        const timer = window.setInterval(() => {
          setRateLimitCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              rateLimitTimerRef.current = null
              setError(null)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        rateLimitTimerRef.current = timer
      } else {
        setError(getErrorMessage(err, t('errors.processingFailed')))
      }
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }, [currentState, mode, maskDataUrl, setCurrentState, t])

  const handleDownload = useCallback(() => {
    if (!currentState.result) return
    const link = document.createElement('a')
    link.href = currentState.result
    link.download = `watermark_removed_${Date.now()}.png`
    link.click()
  }, [currentState.result])

  // 使用结果作为新原图继续处理
  const handleUseResultAsSource = useCallback(() => {
    if (!currentState.result) return
    
    const file = base64ToFile(currentState.result, `continue_${Date.now()}.png`)
    setCurrentState({
      image: currentState.result,
      file: file,
      result: null,
      sliderPos: 50,
    })
    
    if (mode === 'manual') {
      setMaskDataUrl(null)
      setMaskResetKey(k => k + 1)
    }
    setError(null)
  }, [currentState.result, mode, setCurrentState])

  // 重置当前模式
  const handleReset = useCallback(() => {
    setCurrentState(createInitialState())
    if (mode === 'manual') {
      setMaskDataUrl(null)
    }
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [mode, setCurrentState])

  // 更新滑块位置
  const handleSliderChange = useCallback((pos: number) => {
    setCurrentState(prev => ({ ...prev, sliderPos: pos }))
  }, [setCurrentState])

  const modelReady = toolInfo?.model_status?.lama_loaded || toolInfo?.model_status?.cloud_available
  const isCloudMode = toolInfo?.model_status?.mode === 'cloud'

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
              <Eraser className="w-7 h-7 text-primary-600 dark:text-primary-400" />
              <span>{t('watermark.title')}</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {isCloudMode ? t('watermark.subtitleCloud') : t('watermark.subtitle')}
            </p>
          </div>
        </div>
        
        {toolInfo && (
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm ${
            modelReady 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          }`}>
            {isCloudMode ? <Cloud className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
            <span>{modelReady ? (isCloudMode ? t('watermark.sdxlCloud') : t('watermark.lamaLocal')) : t('watermark.modelNotLoaded')}</span>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={`rounded-lg p-4 flex items-center space-x-3 ${
          rateLimitCountdown > 0 
            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
            rateLimitCountdown > 0 ? 'text-amber-500' : 'text-red-500'
          }`} />
          <div className="flex-1">
            <p className={rateLimitCountdown > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}>
              {error}
            </p>
            {rateLimitCountdown > 0 && (
              <p className="text-amber-600 dark:text-amber-500 text-sm mt-1">
                {t('errors.rateLimitWait', { seconds: rateLimitCountdown })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 模型未加载警告 */}
      {toolInfo && !modelReady && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              {isCloudMode ? (
                <>
                  <p className="text-yellow-800 dark:text-yellow-300 font-medium">{t('watermark.warnings.sdxlNotConfigured')}</p>
                  <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">{t('watermark.warnings.sdxlConfigHint')}</p>
                </>
              ) : (
                <>
                  <p className="text-yellow-800 dark:text-yellow-300 font-medium">{t('watermark.warnings.lamaNotLoaded')}</p>
                  <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">
                    {t('watermark.warnings.lamaDownloadHint')} <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">backend/models/lama_fp32.onnx</code>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 历史记录 */}
      <HistoryPanel toolId="watermark-removal" onSelect={handleHistorySelect} />

      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
          e.target.value = ''
        }}
      />

      {/* 上传区域（无图片时显示） */}
      {!hasAnyImage && (
        <div
          className="dropzone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">{t('watermark.upload.hint')}</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">{t('watermark.upload.formats')}</p>
        </div>
      )}

      {/* 主操作区 */}
      {hasAnyImage && (
        <div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* 左侧：操作面板 */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <Paintbrush className="w-5 h-5 text-primary-500" />
                  <span>{t('watermark.markArea')}</span>
                </h2>
                {currentState.image && (
                  <button
                    onClick={handleReset}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{t('watermark.reselect')}</span>
                  </button>
                )}
              </div>

              {/* 模式切换 */}
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => handleModeSwitch('manual')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'manual'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Paintbrush className="w-4 h-4 inline mr-2" />
                  {t('watermark.modes.manual')}
                  {manualState.image && <span className="ml-1 text-xs opacity-70">●</span>}
                </button>
                <button
                  onClick={() => handleModeSwitch('auto')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'auto'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Wand2 className="w-4 h-4 inline mr-2" />
                  {t('watermark.modes.auto')}
                  {autoState.image && <span className="ml-1 text-xs opacity-70">●</span>}
                </button>
              </div>

              {/* 复用/同步图片提示 */}
              {showReuseHint && otherState.image && otherState.image !== currentState.image && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-400 text-sm">
                      <Copy className="w-4 h-4" />
                      <span>{currentState.image ? t('watermark.syncHint') : t('watermark.reuseHint')}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleReuseImage}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        {currentState.image ? t('watermark.syncYes') : t('watermark.reuseYes')}
                      </button>
                      <button
                        onClick={() => setShowReuseHint(false)}
                        className="px-3 py-1 text-xs bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
                      >
                        {currentState.image ? t('watermark.syncNo') : t('watermark.reuseNo')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 当前模式无图片时的上传提示 */}
              {!currentState.image && (
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{t('watermark.upload.hint')}</p>
                </div>
              )}

              {/* 手动模式 - 使用 hidden 保持组件状态 */}
              {manualState.image && (
                <div className={`space-y-2 ${mode !== 'manual' ? 'hidden' : ''}`}>
                  <div className="flex justify-end">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center space-x-1"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{t('common.changeImage')}</span>
                    </button>
                  </div>
                  <MaskCanvas 
                    key={maskResetKey}
                    imageUrl={manualState.image} 
                    onMaskChange={setMaskDataUrl}
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                  />
                </div>
              )}

              {/* 自动模式 */}
              {mode === 'auto' && autoState.image && (
                <div className="space-y-3">
                  <div 
                    className="aspect-video bg-gray-100 dark:bg-slate-900 rounded-lg overflow-hidden relative group cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <img src={autoState.image} alt="" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-white text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <span className="text-sm">{t('common.changeImage')}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-start space-x-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{t('watermark.warnings.autoDetectNote')}</span>
                  </p>
                </div>
              )}

              {/* 处理按钮 */}
              {currentState.image && (
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || rateLimitCountdown > 0 || (mode === 'manual' && !maskDataUrl)}
                  className="w-full mt-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rateLimitCountdown > 0 ? (
                    <>
                      <Loader2 className="w-5 h-5" />
                      <span>{rateLimitCountdown}s</span>
                    </>
                  ) : isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('common.processing')}</span>
                    </>
                  ) : (
                    <>
                      <Eraser className="w-5 h-5" />
                      <span>{t('watermark.removeWatermark')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 右侧：结果面板 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('watermark.result')}</h2>
            
            {!currentState.result ? (
              <div className="aspect-video bg-gray-50 dark:bg-slate-900 rounded-lg flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                <ImageIcon className="w-16 h-16 mb-4" />
                <p>{t('watermark.resultPlaceholder')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <ImageCompare 
                  beforeImage={currentState.image!} 
                  afterImage={currentState.result}
                  position={currentState.sliderPos}
                  onPositionChange={handleSliderChange}
                  className="aspect-video bg-gray-100 dark:bg-slate-900" 
                />
                
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-700 dark:text-green-400">{t('watermark.successMsg')}</span>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleUseResultAsSource}
                    className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>{t('watermark.continueProcess')}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>{t('watermark.downloadImage')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">{t('watermark.guide.title')}</h3>
        <ol className="text-blue-800 dark:text-blue-400 space-y-2 text-sm list-decimal list-inside">
          <li>{t('watermark.guide.step1')}</li>
          <li><strong>{t('watermark.guide.step2')}</strong></li>
          <li>{t('watermark.guide.step3')}</li>
          <li>{t('watermark.guide.step4')}</li>
          <li>{t('watermark.guide.step5')}</li>
        </ol>
      </div>
    </div>
  )
}
