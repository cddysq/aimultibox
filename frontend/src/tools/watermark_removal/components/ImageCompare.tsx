/**
 * 图片对比组件
 * 支持拖拽滑块对比处理前后效果
 */
import { useRef, useCallback, useEffect } from 'react'
import { MoveHorizontal } from 'lucide-react'

interface ImageCompareProps {
  beforeImage: string
  afterImage: string
  position: number
  onPositionChange: (position: number) => void
  className?: string
}

export default function ImageCompare({
  beforeImage,
  afterImage,
  position,
  onPositionChange,
  className = '',
}: ImageCompareProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    onPositionChange(percentage)
  }, [onPositionChange])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    handleMove(e.clientX)
  }, [handleMove])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDraggingRef.current = true
    const touch = e.touches[0]
    if (touch) handleMove(touch.clientX)
  }, [handleMove])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) handleMove(e.clientX)
    }
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (isDraggingRef.current && touch) handleMove(touch.clientX)
    }
    const handleEnd = () => { isDraggingRef.current = false }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [handleMove])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg cursor-ew-resize select-none ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* 处理后图片（底层） */}
      <img src={afterImage} alt="" className="w-full h-full object-contain" draggable={false} />

      {/* 原图（裁剪显示） */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={beforeImage} alt="" className="w-full h-full object-contain" draggable={false} />
      </div>

      {/* 分割线 */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white"
        style={{ left: `${position}%`, transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white dark:bg-slate-700 rounded-full shadow-lg flex items-center justify-center border-2 border-primary-500">
          <MoveHorizontal className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    </div>
  )
}
