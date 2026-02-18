# API Documentation | مستندات API

TC Manager REST API برای دریافت داده از دستگاه‌ها و مدیریت سیستم.

---

## Base URL

```
http://localhost:3000
```

<div dir="rtl">

در production، URL دامنه خودتان را جایگزین کنید.

</div>

---

## Authentication | احراز هویت

### برای دستگاه‌ها (Device APIs)

<div dir="rtl">

اگر `DEVICE_API_KEY` در `.env` تنظیم شده باشد:

</div>

```http
POST /api/data
Headers:
  X-API-Key: your-device-api-key
```

<div dir="rtl">

**یا از query parameter:**

</div>

```http
POST /api/data?api_key=your-device-api-key
```

### برای Admin APIs

<div dir="rtl">

باید ابتدا login کنید و session cookie دریافت کنید.

</div>

---

## Device Data APIs | دریافت داده از دستگاه‌ها

### POST /api/data

<div dir="rtl">

دریافت داده ترافیک از دستگاه‌ها (فرمت ساده).

**Headers:**

</div>

```http
Content-Type: application/json
X-API-Key: your-api-key  (optional)
```

**Request Body (Single Record):**

```json
{
  "device_code": "1234",
  "timestamp": "2026-02-18T10:00:00Z",
  "vehicle_class": 2,
  "speed": 85,
  "direction": 1,
  "lane": 2
}
```

**Request Body (Batch Records):**

```json
{
  "device_code": "1234",
  "records": [
    {
      "timestamp": "2026-02-18T10:00:00Z",
      "vehicle_class": 2,
      "speed": 85,
      "direction": 1,
      "lane": 2
    },
    {
      "timestamp": "2026-02-18T10:01:00Z",
      "vehicle_class": 1,
      "speed": 60,
      "direction": 1,
      "lane": 1
    }
  ]
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| device_code | string | ✅ Yes | 4-digit device code (e.g., "1234") |
| timestamp | string | ❌ No | ISO 8601 timestamp (default: now) |
| vehicle_class | integer | ❌ No | Vehicle class 0-8 (0=unknown) |
| speed | number | ❌ No | Speed in km/h (0-300) |
| direction | integer | ❌ No | Direction 1 or 2 (1=outbound, 2=inbound) |
| lane | integer | ❌ No | Lane number 1-8 |

**Response (Success):**

```json
{
  "success": true,
  "received": 1
}
```

**Response (Batch):**

```json
{
  "success": true,
  "received": 10
}
```

**Response (Error - Invalid device_code):**

```json
{
  "error": "device_code required"
}
```

**Response (Error - Validation Failed):**

```json
{
  "error": "validation_failed",
  "details": [
    "device_code must be 4 digits",
    "speed must be 0-300 km/h"
  ]
}
```

**Response (Error - Rate Limit):**

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 45
}
```

**Example (cURL):**

```bash
curl -X POST http://localhost:3000/api/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "device_code": "1234",
    "timestamp": "2026-02-18T10:00:00Z",
    "vehicle_class": 2,
    "speed": 85,
    "direction": 1,
    "lane": 2
  }'
```

**Example (Python):**

```python
import requests
import json
from datetime import datetime

url = "http://localhost:3000/api/data"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "your-api-key"
}
data = {
    "device_code": "1234",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "vehicle_class": 2,
    "speed": 85,
    "direction": 1,
    "lane": 2
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

---

### POST /api/irawdata

<div dir="rtl">

دریافت داده از دستگاه‌های ICCORE (فرمت 5-class).

**Headers:**

</div>

```http
Content-Type: application/json
X-API-Key: your-api-key  (optional)
```

**Request Body:**

```json
{
  "device_id": "1234",
  "create_at": "2026-02-18T10:00:00",
  "stop": "2026-02-18T10:15:00",
  "lane": 1,
  "a": 10,
  "b": 50,
  "c": 20,
  "d": 5,
  "e": 3,
  "x": 2,
  "sa": 500,
  "sb": 4000,
  "sc": 1600,
  "sd": 400,
  "se": 240,
  "sx": 160,
  "sao": 2,
  "sbo": 5,
  "sco": 3,
  "sdo": 1,
  "seo": 0,
  "sxo": 0,
  "overtaking": 3,
  "tooclose": 5
}
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| device_id | string | Device code (4 digits) |
| create_at | string | Period start time |
| stop | string | Period end time |
| lane | integer | Lane number |
| a, b, c, d, e, x | integer | Vehicle counts by class (a=motorcycle, b=car, c=van, d=bus, e=truck, x=unknown) |
| sa, sb, sc, sd, se, sx | integer | Sum of speeds per class |
| sao, sbo, sco, sdo, seo, sxo | integer | Over-speed count per class |
| overtaking | integer | Overtaking violations |
| tooclose | integer | Following too close violations |

**Response:**

```json
{
  "success": true,
  "received": 1
}
```

**Example (cURL):**

```bash
curl -X POST http://localhost:3000/api/irawdata \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "device_id": "1234",
    "create_at": "2026-02-18T10:00:00",
    "stop": "2026-02-18T10:15:00",
    "lane": 1,
    "a": 10, "b": 50, "c": 20, "d": 5, "e": 3, "x": 2,
    "sa": 500, "sb": 4000, "sc": 1600, "sd": 400, "se": 240, "sx": 160
  }'
```

---

## Authentication APIs | احراز هویت

### POST /api/auth/login

<div dir="rtl">

ورود به سیستم.

</div>

**Request:**

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (Success):**

```json
{
  "success": true,
  "username": "admin",
  "role": "admin"
}
```

**Response (Error):**

```json
{
  "error": "نام کاربری یا رمز عبور اشتباه است"
}
```

---

### POST /api/auth/logout

<div dir="rtl">

خروج از سیستم.

</div>

**Response:**

```json
{
  "success": true
}
```

---

### GET /api/auth/check

<div dir="rtl">

بررسی وضعیت لاگین.

</div>

**Response (Logged In):**

```json
{
  "loggedIn": true,
  "username": "admin",
  "role": "admin"
}
```

**Response (Not Logged In):**

```json
{
  "loggedIn": false
}
```

---

## Device Management APIs | مدیریت دستگاه‌ها

### GET /api/devices

<div dir="rtl">

لیست تمام دستگاه‌ها.

**Authentication:** Required

</div>

**Response:**

```json
[
  {
    "id": 1,
    "device_code": "1234",
    "name": "Device 1234",
    "type": "sensor",
    "route": "Tehran-Qom",
    "ip": "192.168.1.100",
    "status": "online",
    "last_seen": "2026-02-18T10:30:00",
    "firmware": "v2.1.0",
    "created_at": "2026-01-01T00:00:00"
  }
]
```

---

### GET /api/devices/:code

<div dir="rtl">

جزئیات یک دستگاه.

</div>

**Parameters:**

- `code`: Device code (e.g., "1234")

**Response:**

```json
{
  "id": 1,
  "device_code": "1234",
  "name": "Device 1234",
  "type": "sensor",
  "route": "Tehran-Qom",
  "ip": "192.168.1.100",
  "status": "online",
  "last_seen": "2026-02-18T10:30:00",
  "firmware": "v2.1.0",
  "created_at": "2026-01-01T00:00:00"
}
```

---

### POST /api/devices

<div dir="rtl">

اضافه کردن دستگاه جدید.

</div>

**Request:**

```json
{
  "device_code": "1234",
  "name": "Device 1234",
  "type": "sensor",
  "route": "Tehran-Qom",
  "ip": "192.168.1.100",
  "firmware": "v2.1.0"
}
```

**Response:**

```json
{
  "success": true,
  "device_code": "1234"
}
```

---

### PUT /api/devices/:code

<div dir="rtl">

به‌روزرسانی دستگاه.

</div>

**Request:**

```json
{
  "name": "Updated Name",
  "type": "camera",
  "route": "Tehran-Karaj"
}
```

**Response:**

```json
{
  "success": true
}
```

---

### DELETE /api/devices/:code

<div dir="rtl">

حذف دستگاه.

</div>

**Response:**

```json
{
  "success": true
}
```

---

## Dashboard & Stats APIs | آمار و اطلاعات

### GET /api/stats

<div dir="rtl">

آمار dashboard.

</div>

**Response:**

```json
{
  "totalDevices": 125,
  "onlineDevices": 118,
  "todayVehicles": 45678,
  "todayAvgSpeed": 82,
  "unsentRMTO": 5,
  "unsentRMTO5": 3
}
```

---

### GET /api/traffic

<div dir="rtl">

Query داده‌های ترافیک.

</div>

**Query Parameters:**

- `device_code` (optional): Filter by device
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)
- `limit` (optional): Max records (default: 100)

**Example:**

```
GET /api/traffic?device_code=1234&from=2026-02-18T00:00:00Z&limit=50
```

**Response:**

```json
[
  {
    "id": 12345,
    "device_code": "1234",
    "timestamp": "2026-02-18T10:30:00Z",
    "vehicle_class": 2,
    "speed": 85,
    "direction": 1,
    "lane": 2,
    "raw_payload": "{...}",
    "received_at": "2026-02-18T10:30:05Z"
  }
]
```

---

## RMTO APIs | ارسال به RMTO

### GET /api/rmto/logs

<div dir="rtl">

لاگ‌های ارسال به RMTO.

</div>

**Query Parameters:**

- `limit` (optional): Max records (default: 50)

**Response:**

```json
[
  {
    "id": 1,
    "method": "AddData5",
    "device_code": "1234",
    "request_data": "{...}",
    "response_data": "{...}",
    "success": 1,
    "error_message": null,
    "created_at": "2026-02-18T10:30:00"
  }
]
```

---

### POST /api/rmto/send-now

<div dir="rtl">

ارسال فوری داده‌های unsent به RMTO.

</div>

**Response:**

```json
{
  "success": true
}
```

---

### GET /api/rmto/queue

<div dir="rtl">

صف ارسال RMTO.

</div>

**Response:**

```json
{
  "unsent": [
    {
      "device_code": "1234",
      "period_start": "2026-02-18T10:00:00",
      "total_vehicles": 150,
      "avg_speed": 82,
      "created_at": "2026-02-18T10:15:00"
    }
  ],
  "sent": [
    {
      "device_code": "1234",
      "period_start": "2026-02-18T09:45:00",
      "total_vehicles": 145,
      "avg_speed": 80,
      "sent_at": "2026-02-18T10:16:00",
      "rmto_response": "{...}"
    }
  ]
}
```

---

## Backup APIs | بکاپ و بازیابی

### GET /api/backup/download

<div dir="rtl">

دانلود بکاپ دیتابیس.

</div>

**Response:**

File download (`tc-manager-backup-YYYY-MM-DD.db`)

---

### POST /api/backup/restore

<div dir="rtl">

بازیابی از بکاپ (`.db` file).

</div>

**Request:**

```http
Content-Type: multipart/form-data
backup: [file]
```

**Response:**

```json
{
  "success": true,
  "message": "بازیابی انجام شد. سرویس باید ریستارت شود."
}
```

---

### POST /api/backup/import-sql-gz

<div dir="rtl">

Import بکاپ SQL یا SQL.GZ.

</div>

**Request:**

```http
Content-Type: multipart/form-data
backup: [file]
```

**Response:**

```json
{
  "success": true,
  "importId": "1708249999000",
  "message": "Import started..."
}
```

---

### GET /api/backup/import-progress/:id

<div dir="rtl">

پیگیری پیشرفت import.

</div>

**Response (In Progress):**

```json
{
  "status": "importing",
  "message": "Imported: 1500 of 5000",
  "imported": 1500,
  "total": 5000,
  "progress": 30
}
```

**Response (Complete):**

```json
{
  "status": "complete",
  "message": "Import successful: 5000 records",
  "imported": 5000,
  "errors": 0
}
```

---

### GET /api/backup/list

<div dir="rtl">

لیست فایل‌های بکاپ آپلود شده.

</div>

**Response:**

```json
[
  {
    "name": "backup-20260218.sql.gz",
    "size": 21234567,
    "sizeFormatted": "20.25 MB",
    "date": "2026-02-18T10:00:00Z",
    "type": "sql.gz"
  }
]
```

---

## Health & Monitoring APIs | سلامت و مانیتورینگ

### GET /health

<div dir="rtl">

Health check endpoint (برای load balancers).

**Authentication:** Not required

</div>

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-18T10:30:00Z",
  "database": "postgresql",
  "uptime": 86400,
  "memory": {
    "rss": 52428800,
    "heapTotal": 18874368,
    "heapUsed": 12345678,
    "external": 1234567
  }
}
```

---

### GET /metrics

<div dir="rtl">

Metrics برای monitoring tools.

**Authentication:** Not required

</div>

**Response:**

```json
{
  "devices_total": 125,
  "devices_online": 118,
  "rmto_queue_unsent": 5,
  "uptime_seconds": 86400
}
```

---

## Rate Limiting

<div dir="rtl">

برای device endpoints:

- **100 requests per minute** per device/IP
- Header `Retry-After` در response 429

</div>

---

## Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (authentication required) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limit exceeded) |
| 500 | Internal Server Error |

---

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

// Send data
client.post('/api/data', {
  device_code: '1234',
  vehicle_class: 2,
  speed: 85
}).then(response => {
  console.log('Success:', response.data);
});
```

### Python

```python
import requests

class TCManagerClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {'X-API-Key': api_key}
    
    def send_data(self, device_code, data):
        url = f"{self.base_url}/api/data"
        payload = {"device_code": device_code, **data}
        response = requests.post(url, json=payload, headers=self.headers)
        return response.json()

client = TCManagerClient('http://localhost:3000', 'your-api-key')
result = client.send_data('1234', {
    'vehicle_class': 2,
    'speed': 85
})
print(result)
```

---

## Webhooks (Future)

<div dir="rtl">

در نسخه‌های آینده، webhook support اضافه خواهد شد برای:

- Device status changes
- RMTO send failures
- System alerts

</div>

---

## Support

<div dir="rtl">

برای سوالات API، به تیم پشتیبانی مراجعه کنید.

</div>
