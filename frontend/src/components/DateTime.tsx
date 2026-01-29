/**
 * DateTime 组件 - 标准化时间展示，自动根据用户时区格式化
 */
import { formatDateTime, type DateTimeFormat } from '@/utils/datetime'

interface DateTimeProps {
  value: string | Date | null | undefined
  format?: DateTimeFormat
  timezone?: string
  className?: string
  fallback?: string
}

export function DateTime({ value, format = 'datetime', timezone, className, fallback = '-' }: DateTimeProps) {
  if (!value) return <span className={className}>{fallback}</span>

  const formatted = formatDateTime(value, { format, timezone })
  if (!formatted) return <span className={className}>{fallback}</span>

  const utc = typeof value === 'string' ? value : value.toISOString()

  return (
    <time dateTime={utc} title={`UTC: ${utc}`} className={className}>
      {formatted}
    </time>
  )
}
