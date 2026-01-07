# 📡 API COD Hub - Documentación

Base URL: `http://localhost:3000/cod-hub`

---

## 📋 Endpoints

### 1️⃣ Listar Órdenes

```http
GET /cod-hub/orders
```

**Query Parameters:**

| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `store_id` | integer | Filtrar por tienda | `1` |
| `order_status` | string | Estado de orden | `CONFIRMADA` |
| `delivery_status` | string | Estado de despacho | `EN TRANSITO` |
| `country` | string | País (CO, MX, EC, CL) | `CO` |
| `page` | integer | Página (default: 1) | `2` |
| `limit` | integer | Límite (default: 20) | `50` |
| `sort_by` | string | Campo para ordenar | `created_at` |
| `sort_order` | string | ASC o DESC | `DESC` |

**Ejemplo:**
```bash
curl "http://localhost:3000/cod-hub/orders?store_id=1&order_status=CONFIRMADA&page=1&limit=20"
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "store_id": 1,
      "shopify_order_id": 123456789,
      "order_name": "#1001",
      "order_status": "CONFIRMADA",
      "delivery_status": "EN TRANSITO",
      "customer_name": "Juan Pérez",
      "customer_phone": "+57300123456",
      "customer_email": "juan@example.com",
      "address": "Calle 123 #45-67",
      "city": "Bogotá",
      "region": "Cundinamarca",
      "country": "CO",
      "confirmed_at": "2026-01-05T10:30:00.000Z",
      "created_at": "2026-01-05T08:00:00.000Z",
      "updated_at": "2026-01-05T10:30:00.000Z",
      "confirmedByUser": {
        "id": 1,
        "name": "Admin User"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

---

### 2️⃣ Buscar Órdenes

```http
GET /cod-hub/orders/search
```

**Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `q` | string | ✅ | Término de búsqueda (min 2 caracteres) |
| `store_id` | integer | ❌ | Filtrar por tienda |
| `page` | integer | ❌ | Página |
| `limit` | integer | ❌ | Límite |

**Ejemplo:**
```bash
curl "http://localhost:3000/cod-hub/orders/search?q=juan&store_id=1"
```

---

### 3️⃣ Obtener Orden por ID

```http
GET /cod-hub/orders/:id
```

**Ejemplo:**
```bash
curl http://localhost:3000/cod-hub/orders/1
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "store_id": 1,
    "shopify_order_id": 123456789,
    "order_name": "#1001",
    "order_status": "CONFIRMADA",
    "delivery_status": "EN TRANSITO",
    "customer_name": "Juan Pérez",
    "address": "Calle 123 #45-67",
    "city": "Bogotá",
    "country": "CO",
    "confirmedByUser": {
      "id": 1,
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "updatedByUser": {
      "id": 2,
      "name": "Operator User",
      "email": "operator@example.com"
    },
    "cancelReason": null
  }
}
```

---

### 4️⃣ Crear Orden COD

```http
POST /cod-hub/orders
```

**Body:**
```json
{
  "store_url": "https://redusculpt.com",
  "shopify_order_id": 123456789,
  "order_name": "#1001",
  "customer_name": "Juan Pérez",
  "customer_phone": "+57300123456",
  "customer_email": "juan@example.com",
  "address": "Calle 123 #45-67",
  "city": "Bogotá",
  "region": "Cundinamarca",
  "country": "CO"
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/cod-hub/orders \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": 1,
    "shopify_order_id": 123456789,
    "order_name": "#1001",
    "customer_name": "Juan Pérez",
    "address": "Calle 123",
    "city": "Bogotá",
    "country": "CO"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "created": true,
  "data": {
    "id": 1,
    "store_id": 1,
    "shopify_order_id": 123456789,
    "order_name": "#1001",
    "order_status": "SIN CONFIRMAR",
    "delivery_status": "SIN CONFIRMAR",
    ...
  }
}
```

---

### 5️⃣ Confirmar Orden

```http
PATCH /cod-hub/orders/:id/confirm
```

**Ejemplo:**
```bash
curl -X PATCH http://localhost:3000/cod-hub/orders/1/confirm
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_status": "CONFIRMADA",
    "confirmed_at": "2026-01-05T10:30:00.000Z",
    "confirmed_by": 1,
    ...
  }
}
```

---

### 6️⃣ Actualizar Estado de Despacho

```http
PATCH /cod-hub/orders/:id/delivery-status
```

**Body:**
```json
{
  "delivery_status": "EN TRANSITO"
}
```

**Valores válidos:**
- `SIN CONFIRMAR`
- `SIN DESPACHAR`
- `EN TRANSITO`
- `ENTREGADA`
- `NOVEDAD`
- `RECLAMO EN OFICINA`
- `CANCELADA`
- `RECHAZADA`

**Transiciones válidas:**
```
SIN CONFIRMAR → [SIN DESPACHAR, CANCELADA]
SIN DESPACHAR → [EN TRANSITO, CANCELADA]
EN TRANSITO → [ENTREGADA, NOVEDAD, CANCELADA]
NOVEDAD → [EN TRANSITO, RECLAMO EN OFICINA, CANCELADA]
RECLAMO EN OFICINA → [ENTREGADA, CANCELADA]
```

**Ejemplo:**
```bash
curl -X PATCH http://localhost:3000/cod-hub/orders/1/delivery-status \
  -H "Content-Type: application/json" \
  -d '{"delivery_status": "EN TRANSITO"}'
```

---

### 7️⃣ Cancelar Orden

```http
PATCH /cod-hub/orders/:id/cancel
```

**Body:**
```json
{
  "cancel_reason_id": 1
}
```

**Ejemplo:**
```bash
curl -X PATCH http://localhost:3000/cod-hub/orders/1/cancel \
  -H "Content-Type: application/json" \
  -d '{"cancel_reason_id": 1}'
```

---

### 8️⃣ Marcar como Entregada

```http
PATCH /cod-hub/orders/:id/deliver
```

**Ejemplo:**
```bash
curl -X PATCH http://localhost:3000/cod-hub/orders/1/deliver
```

---

### 9️⃣ Obtener Estadísticas

```http
GET /cod-hub/orders/stats
```

**Query Parameters:**
- `store_id` (opcional): Filtrar por tienda

**Ejemplo:**
```bash
curl "http://localhost:3000/cod-hub/orders/stats?store_id=1"
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "order_status": "CONFIRMADA",
      "delivery_status": "EN TRANSITO",
      "count": "25"
    },
    {
      "order_status": "ENTREGADA",
      "delivery_status": "ENTREGADA",
      "count": "150"
    }
  ]
}
```

---

### 🔟 Health Check

```http
GET /cod-hub/health
```

**Ejemplo:**
```bash
curl http://localhost:3000/cod-hub/health
```

**Respuesta:**
```json
{
  "status": "ok",
  "module": "cod-hub"
}
```

---

## 📊 Estados de Órdenes

### Order Status (order_status)
- `SIN CONFIRMAR` - Orden recibida, pendiente de confirmar
- `CONFIRMADA` - Orden confirmada y validada
- `ENTREGADA` - Orden entregada al cliente
- `CANCELADA` - Orden cancelada

### Delivery Status (delivery_status)
- `SIN CONFIRMAR` - Sin confirmar
- `SIN DESPACHAR` - Confirmada pero no despachada
- `EN TRANSITO` - En camino al destino
- `ENTREGADA` - Entregada exitosamente
- `NOVEDAD` - Problema en la entrega
- `RECLAMO EN OFICINA` - Cliente debe recoger en oficina
- `CANCELADA` - Cancelada
- `RECHAZADA` - Rechazada por el cliente

### País (country)
- `CO` - Colombia
- `MX` - México
- `EC` - Ecuador
- `CL` - Chile

---

## ⚠️ Manejo de Errores

### Respuesta de Error
```json
{
  "success": false,
  "error": "Order not found"
}
```

### Errores de Validación
```json
{
  "success": false,
  "errors": [
    {
      "msg": "store_id must be an integer",
      "param": "store_id",
      "location": "body"
    }
  ]
}
```

### Códigos HTTP
- `200` - OK
- `201` - Created
- `400` - Bad Request (validación fallida)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔐 Notas de Autenticación

Los endpoints actualmente no tienen autenticación implementada. Para producción, deberás:

1. Agregar middleware de autenticación JWT
2. Inyectar `req.user` desde el token
3. Los campos `confirmed_by` y `updated_by` se llenarán automáticamente con el ID del usuario autenticado

---

## 📝 Próximos Pasos

1. Crear endpoints para gestionar razones de cancelación
2. Agregar exportación de órdenes (Excel/CSV)
3. Implementar auditoría completa de cambios
