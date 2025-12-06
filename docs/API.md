# API 文档

[English](./API_EN.md)

## 基础信息

- **地址**: `http://localhost:8000/api`
- **文档**: `/docs` (Swagger) | `/redoc` (ReDoc)

## 通用接口

### 应用信息
```
GET /api/app
```

### 工具列表
```
GET /api/tools
```

---

## 去水印工具

### 工具信息
```
GET /api/tools/watermark-removal/
```

### 去除水印（需遮罩）
```
POST /api/tools/watermark-removal/remove
Content-Type: multipart/form-data
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image | File | 是 | 原图 |
| mask | File | 是 | 遮罩（白色=水印区域） |

### 自动去除
```
POST /api/tools/watermark-removal/remove-auto
Content-Type: multipart/form-data
```

| 参数 | 类型 | 必填 |
|------|------|------|
| image | File | 是 |

### 检测水印
```
POST /api/tools/watermark-removal/detect
Content-Type: multipart/form-data
```

### 模型状态
```
GET /api/tools/watermark-removal/status
```

---

## 响应格式

成功:
```json
{
  "status": "success",
  "message": "...",
  "image_base64": "..."
}
```

错误:
```json
{
  "success": false,
  "error": {
    "type": "...",
    "message": "..."
  },
  "request_id": "..."
}
```

HTTP 状态码: `400` `422` `500`
