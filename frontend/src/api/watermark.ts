/**
 * 水印去除 API
 */
import api from './index'

/** 水印去除结果 */
export interface WatermarkRemovalResult {
  status: string
  message?: string
  image_base64?: string
}

/** 水印区域 */
export interface WatermarkRegion {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

/** 检测结果 */
export interface DetectionResult {
  status: string
  regions: WatermarkRegion[]
  count: number
}

/** 模型状态 */
export interface ModelStatus {
  mode: string
  lama_loaded: boolean
  cloud_available: boolean
}

/** 工具信息 */
export interface ToolInfo {
  id: string
  name: string
  description: string
  version: string
  model_status: ModelStatus
  features: Array<{
    id: string
    name: string
    description: string
  }>
}

/** 获取工具信息 */
export async function getToolInfo(): Promise<ToolInfo> {
  const response = await api.get('/tools/watermark-removal/')
  return response.data
}

/** 去除水印（手动遮罩模式） */
export async function removeWatermark(
  imageFile: File,
  maskDataUrl: string
): Promise<WatermarkRemovalResult> {
  const maskBlob = await dataUrlToBlob(maskDataUrl)
  
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('mask', maskBlob, 'mask.png')

  const response = await api.post<WatermarkRemovalResult>(
    '/tools/watermark-removal/remove',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  
  return response.data
}

/** 自动去除水印 */
export async function removeWatermarkAuto(
  imageFile: File
): Promise<WatermarkRemovalResult> {
  const formData = new FormData()
  formData.append('image', imageFile)

  const response = await api.post<WatermarkRemovalResult>(
    '/tools/watermark-removal/remove-auto',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  
  return response.data
}

/** 检测水印区域 */
export async function detectWatermark(imageFile: File): Promise<DetectionResult> {
  const formData = new FormData()
  formData.append('image', imageFile)

  const response = await api.post<DetectionResult>(
    '/tools/watermark-removal/detect',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  
  return response.data
}

/** 获取模型状态 */
export async function getModelStatus(): Promise<ModelStatus> {
  const response = await api.get('/tools/watermark-removal/status')
  return response.data
}

/** DataURL 转 Blob */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}
