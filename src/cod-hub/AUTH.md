# 🔐 Autenticación JWT - COD Hub

## 🔑 Configuración

Agregar al archivo `.env`:

```env
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

⚠️ **Importante**: Cambia `JWT_SECRET` en producción por una clave segura aleatoria.

---

## 📡 Endpoints de Autenticación

### 1. Registrar Usuario

```http
POST /cod-hub/auth/register
```

**Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "is_active": true,
      "created_at": "2026-01-06T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 2. Login

```http
POST /cod-hub/auth/login
```

**Body:**
```json
{
  "email": "juan@example.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "is_active": true,
      "last_login_at": "2026-01-06T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 3. Obtener Usuario Autenticado

```http
GET /cod-hub/auth/me
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "is_active": true,
    "last_login_at": "2026-01-06T10:30:00.000Z"
  }
}
```

---

### 4. Cambiar Contraseña

```http
PATCH /cod-hub/auth/password
Authorization: Bearer {token}
```

**Body:**
```json
{
  "current_password": "password123",
  "new_password": "newpassword456"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 5. Actualizar Perfil

```http
PATCH /cod-hub/auth/profile
Authorization: Bearer {token}
```

**Body:**
```json
{
  "name": "Juan Carlos Pérez"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Juan Carlos Pérez",
    "email": "juan@example.com",
    "is_active": true
  }
}
```

---

## 🛡️ Uso del Token

### Header de Autenticación

Para todos los endpoints protegidos, incluir el header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Ejemplo con curl

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/cod-hub/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com","password":"password123"}' \
  | jq -r '.data.token')

# Usar token en requests
curl -X PATCH http://localhost:3000/cod-hub/orders/1/confirm \
  -H "Authorization: Bearer $TOKEN"
```

### Ejemplo con JavaScript/Fetch

```javascript
// Login
const loginResponse = await fetch('http://localhost:3000/cod-hub/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'juan@example.com',
    password: 'password123'
  })
});

const { data } = await loginResponse.json();
const token = data.token;

// Usar token
const response = await fetch('http://localhost:3000/cod-hub/orders/1/confirm', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 🔒 Endpoints Protegidos

Los siguientes endpoints **requieren autenticación** (token JWT):

### Órdenes COD
- `PATCH /cod-hub/orders/:id/confirm` - Confirmar orden
- `PATCH /cod-hub/orders/:id/delivery-status` - Actualizar estado
- `PATCH /cod-hub/orders/:id/cancel` - Cancelar orden
- `PATCH /cod-hub/orders/:id/deliver` - Marcar entregada

### Autenticación
- `GET /cod-hub/auth/me` - Obtener perfil
- `PATCH /cod-hub/auth/password` - Cambiar contraseña
- `PATCH /cod-hub/auth/profile` - Actualizar perfil

---

## ⚠️ Manejo de Errores

### Sin Token
```json
{
  "success": false,
  "error": "No token provided"
}
```
**Status:** `401 Unauthorized`

### Token Inválido o Expirado
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```
**Status:** `401 Unauthorized`

### Usuario Inactivo
```json
{
  "success": false,
  "error": "User account is inactive"
}
```
**Status:** `401 Unauthorized`

### Credenciales Inválidas
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```
**Status:** `401 Unauthorized`

### Email Ya Registrado
```json
{
  "success": false,
  "error": "Email already registered"
}
```
**Status:** `400 Bad Request`

---

## 🧪 Testing

### 1. Crear Usuario de Prueba

```bash
curl -X POST http://localhost:3000/cod-hub/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123"
  }'
```

### 2. Hacer Login

```bash
curl -X POST http://localhost:3000/cod-hub/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

### 3. Usar Token

```bash
# Guardar token en variable
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Confirmar orden
curl -X PATCH http://localhost:3000/cod-hub/orders/1/confirm \
  -H "Authorization: Bearer $TOKEN"

# Ver perfil
curl http://localhost:3000/cod-hub/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔐 Seguridad

### Buenas Prácticas Implementadas

✅ Contraseñas hasheadas con bcrypt (salt rounds: 10)  
✅ Tokens JWT con expiración (default: 7 días)  
✅ Validación de email y contraseñas  
✅ No se devuelve la contraseña en respuestas  
✅ Verificación de usuario activo  
✅ Logging de eventos de autenticación  

### Recomendaciones para Producción

1. **Cambiar JWT_SECRET**: Usar una clave aleatoria larga
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **HTTPS**: Siempre usar HTTPS en producción

3. **Rate Limiting**: Limitar intentos de login

4. **Refresh Tokens**: Implementar refresh tokens para mayor seguridad

5. **2FA**: Considerar autenticación de dos factores

---

## 📝 Flujo de Autenticación

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB

    Client->>API: POST /auth/register
    API->>DB: Verificar email único
    API->>DB: Crear usuario (password hasheado)
    API->>API: Generar JWT
    API->>Client: Token + Usuario

    Client->>API: POST /auth/login
    API->>DB: Buscar usuario por email
    API->>API: Verificar password
    API->>DB: Actualizar last_login_at
    API->>API: Generar JWT
    API->>Client: Token + Usuario

    Client->>API: PATCH /orders/1/confirm (+ token)
    API->>API: Verificar JWT
    API->>DB: Buscar usuario
    API->>API: req.user = usuario
    API->>DB: Actualizar orden
    API->>Client: Orden actualizada
```

---

## 🔍 Estructura del Token JWT

```javascript
{
  "id": 1,
  "email": "juan@example.com",
  "name": "Juan Pérez",
  "iat": 1704537600,  // Issued at
  "exp": 1705142400   // Expiration
}
```

El middleware `authenticate` decodifica el token y carga el usuario completo desde la BD en `req.user`.
