# API Reference

[中文](./API.md)

## Base

- **URL**: `http://localhost:8000/api`
- **Docs**: `/docs` (Swagger) | `/redoc` (ReDoc)

## Common

### App Info
```
GET /api/app
```

### Tool List
```
GET /api/tools
```

---

## Watermark Removal

### Tool Info
```
GET /api/tools/watermark-removal/
```

### Remove (with mask)
```
POST /api/tools/watermark-removal/remove
Content-Type: multipart/form-data
```

| Param | Type | Required | Note |
|-------|------|----------|------|
| image | File | Yes | Original image |
| mask | File | Yes | Mask (white=watermark) |

### Auto Remove
```
POST /api/tools/watermark-removal/remove-auto
Content-Type: multipart/form-data
```

| Param | Type | Required |
|-------|------|----------|
| image | File | Yes |

### Detect
```
POST /api/tools/watermark-removal/detect
Content-Type: multipart/form-data
```

### Model Status
```
GET /api/tools/watermark-removal/status
```

---

## Response Format

Success:
```json
{
  "status": "success",
  "message": "...",
  "image_base64": "..."
}
```

Error:
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

HTTP Codes: `400` `422` `500`

