/**
 * 遮罩绘制画布组件
 * 用于手动标注水印区域
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Paintbrush, Eraser, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

interface MaskCanvasProps {
  imageUrl: string
  onMaskChange: (maskDataUrl: string) => void
  brushSize: number
  onBrushSizeChange: (size: number) => void
  className?: string
}

export default function MaskCanvas({ imageUrl, onMaskChange, brushSize, onBrushSizeChange, className = '' }: MaskCanvasProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 })
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // 加载图片并初始化画布
  useEffect(() => {
    if (!imageUrl || !canvasRef.current || !maskCanvasRef.current || !containerRef.current) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current!
      const maskCanvas = maskCanvasRef.current!
      const container = containerRef.current!
      
      // 保存原图尺寸
      setOriginalSize({ width: img.width, height: img.height })
      
      const maxWidth = container.clientWidth
      const maxHeight = 500
      
      // 计算显示尺寸
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
      const displayWidth = Math.floor(img.width * ratio)
      const displayHeight = Math.floor(img.height * ratio)
      
      // 设置画布尺寸为显示尺寸（用于绘制交互）
      canvas.width = displayWidth
      canvas.height = displayHeight
      maskCanvas.width = displayWidth
      maskCanvas.height = displayHeight
      
      // 设置容器高度
      container.style.height = `${displayHeight}px`
      
      // 绘制原图
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight)
      
      // 初始化遮罩（黑色背景）
      const maskCtx = maskCanvas.getContext('2d')!
      maskCtx.fillStyle = 'black'
      maskCtx.fillRect(0, 0, displayWidth, displayHeight)
    }
    img.src = imageUrl
  }, [imageUrl])

  /** 获取画布坐标 */
  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const maskCanvas = maskCanvasRef.current!
    const rect = maskCanvas.getBoundingClientRect()
    
    let clientX: number, clientY: number
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    
    // 计算相对于画布的坐标
    const x = clientX - rect.left
    const y = clientY - rect.top
    
    return { x, y }
  }, [])

  /** 导出遮罩（缩放到原图尺寸） */
  const exportMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas || originalSize.width === 0) return
    
    // 检查是否有涂抹（白色像素）
    const maskCtx = maskCanvas.getContext('2d')!
    const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
    const hasWhite = imageData.data.some((v, i) => i % 4 === 0 && v > 10)
    
    if (!hasWhite) {
      onMaskChange('')
      return
    }
    
    // 创建原图尺寸的画布
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = originalSize.width
    exportCanvas.height = originalSize.height
    
    const ctx = exportCanvas.getContext('2d')!
    ctx.drawImage(maskCanvas, 0, 0, originalSize.width, originalSize.height)
    
    onMaskChange(exportCanvas.toDataURL('image/png'))
  }, [onMaskChange, originalSize])

  /** 绘制 */
  const draw = useCallback((x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    
    const ctx = maskCanvas.getContext('2d')!
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = tool === 'brush' ? 'white' : 'black'
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }, [tool, brushSize])

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const pos = getPosition(e)
    draw(pos.x, pos.y)
  }, [getPosition, draw])

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPosition(e)
    setCursorPos(pos)
    
    if (!isDrawing) return
    e.preventDefault()
    draw(pos.x, pos.y)
  }, [isDrawing, getPosition, draw])

  const handleEnd = useCallback(() => {
    setIsDrawing(false)
    // 绘制结束时导出 mask
    exportMask()
  }, [exportMask])

  // 滚轮控制画笔大小
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -5 : 5
      const newSize = Math.max(10, Math.min(100, brushSize + delta))
      onBrushSizeChange(newSize)
    }
    
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [brushSize, onBrushSizeChange])

  /** 清空遮罩 */
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    const ctx = maskCanvas.getContext('2d')!
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
    onMaskChange('')
  }, [onMaskChange])

  return (
    <div className={`flex flex-col ${className}`}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-3 p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
        <div className="flex items-center space-x-2">
          {/* 画笔 */}
          <button
            onClick={() => setTool('brush')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'brush' 
                ? 'bg-primary-500 text-white' 
                : 'bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-500'
            }`}
            title={t('watermark.canvas.brush')}
          >
            <Paintbrush className="w-5 h-5" />
          </button>
          
          {/* 橡皮擦 */}
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'eraser' 
                ? 'bg-primary-500 text-white' 
                : 'bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-500'
            }`}
            title={t('watermark.canvas.eraser')}
          >
            <Eraser className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-slate-500 mx-2" />
          
          {/* 画笔大小 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onBrushSizeChange(Math.max(10, brushSize - 10))}
              className="p-1.5 rounded bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-500"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 w-12 text-center">{brushSize}px</span>
            <button
              onClick={() => onBrushSizeChange(Math.min(100, brushSize + 10))}
              className="p-1.5 rounded bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-500"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* 清空 */}
        <button
          onClick={clearMask}
          className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{t('watermark.canvas.clear')}</span>
        </button>
      </div>
      
      {/* 提示 */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">💡 {t('watermark.canvas.hint')}</p>
      
      {/* 画布容器 */}
      <div 
        ref={containerRef} 
        className="relative flex items-center justify-center" 
        style={{ minHeight: '300px' }}
      >
        {/* 画布包裹层 */}
        <div className="relative rounded-lg overflow-hidden shadow-lg">
          {/* 原图画布 */}
          <canvas ref={canvasRef} className="block" />
          
          {/* 遮罩画布 */}
          <canvas
            ref={maskCanvasRef}
            className="absolute top-0 left-0 cursor-none"
            style={{ 
              mixBlendMode: 'multiply', 
              opacity: 0.6,
            }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={() => { handleEnd(); setCursorPos(null) }}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
          
          {/* 画笔大小预览 */}
          {cursorPos && (
            <div 
              className="absolute pointer-events-none border-2 rounded-full"
              style={{
                width: brushSize,
                height: brushSize,
                left: cursorPos.x - brushSize / 2,
                top: cursorPos.y - brushSize / 2,
                borderColor: tool === 'brush' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
