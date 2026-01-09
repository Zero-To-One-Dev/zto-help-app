# Project Specification: COD Hub Management System
## Complete API Specification & Implementation Guide

---

## 1. Context & Role

**Role:** Senior Frontend Architect & Full-Stack Developer.

**Objective:** Build a robust, production-ready React application for managing "Cash on Delivery" (COD) orders with complete authentication, order management, and bulk operations capabilities.

**Key Requirements:**
- The application must start in **"Mock Mode"** with realistic data adhering strictly to the data models below, so the UI is fully functional immediately.
- All mock data should simulate real backend responses including success/error states, pagination, and API response structures.
- Easy toggle between mock and real API modes via environment variable.

---

## 2. Tech Stack (Non-Negotiable)

- **Framework:** React 18+ (Vite) with TypeScript
- **UI System:** **shadcn/ui** (Radix UI + Tailwind CSS) - Use exclusively for all foundational components (Tables, Dialogs, Toasts, Cards, Forms, Sheets, Select, etc.)
- **State Management:** **TanStack Query (React Query) v5** - For server state, caching, and optimistic updates
- **Table Logic:** **TanStack Table (react-table v8)** - Critical for bulk selection, filtering, and sorting
- **Icons:** **Lucide React** - No other icon library
- **Forms:** React Hook Form + Zod (for validation schemas)
- **Routing:** React Router v6 with Protected Routes wrapper
- **HTTP Client:** Axios with Interceptors for auth tokens and error handling
- **Date Handling:** date-fns or dayjs
- **Language Convention:** 
  - Code & Comments: **English**
  - User Interface (labels, buttons, messages, toasts): **Spanish**

---

## 3. Data Architecture & TypeScript Types

### A. Core Data Models

Create these interfaces in `src/types/` directory.

```typescript
// ==================== AUTH TYPES ====================

export interface User {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

// ==================== ORDER TYPES ====================

export type OrderStatus = 
  | "SIN CONFIRMAR" 
  | "CONFIRMADA" 
  | "ENTREGADA" 
  | "CANCELADA";

export type DeliveryStatus = 
  | "SIN CONFIRMAR" 
  | "SIN DESPACHAR" 
  | "CANCELADA" 
  | "RECHAZADA" 
  | "EN TRANSITO" 
  | "ENTREGADA" 
  | "NOVEDAD" 
  | "RECLAMO EN OFICINA";

export type CountryCode = "CO" | "MX" | "EC" | "CL";

export interface CodOrder {
  id: number;
  store_id: number;
  shopify_order_id: number;
  order_name: string; // e.g., "#1024"
  order_status: OrderStatus;
  delivery_status: DeliveryStatus;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  address: string;
  city: string;
  region: string | null;
  country: CountryCode;
  confirmed_at: string | null;
  cancel_reason_id: number | null;
  confirmed_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  // Computed Fields (from backend)
  store_shopify_url: string; // e.g., "my-store.myshopify.com"
  order_url: string; // Direct admin link: "https://admin.shopify.com/store/{store_name}/orders/{shopify_order_id}"
}

export interface OrderFilters {
  store_id?: number;
  order_status?: OrderStatus;
  delivery_status?: DeliveryStatus;
  country?: CountryCode;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface OrderStats {
  total_orders: number;
  by_order_status: Record<OrderStatus, number>;
  by_delivery_status: Record<DeliveryStatus, number>;
  by_country: Record<CountryCode, number>;
}

// ==================== CANCEL REASONS ====================

export interface CancelReason {
  id: number;
  reason: string;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

// ==================== ENUMS ====================

export interface AppEnums {
  orderStatus: OrderStatus[];
  deliveryStatus: DeliveryStatus[];
  countries: CountryCode[];
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
    per_page: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
```

### B. Service Layer Strategy: Mock vs Real API

**File:** `src/config/api.config.ts`

```typescript
export const API_CONFIG = {
  USE_MOCK_DATA: import.meta.env.VITE_USE_MOCK === 'true',
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.example.com',
  TIMEOUT: 10000,
  MOCK_DELAY: 500, // ms
};
```

**Implementation Rules:**
1. Create a `src/services/api.ts` with Axios instance configured with interceptors.
2. Create a `src/services/mock/` directory with mock data generators.
3. Each service method should check `API_CONFIG.USE_MOCK_DATA` and either:
   - Return mocked data with artificial delay (`await new Promise(r => setTimeout(r, 500))`)
   - Make actual API call
4. **Mock Data Requirements:**
   - Generate 50+ realistic orders covering all status combinations
   - Include orders from all countries
   - Vary customer data (names, phones, addresses)
   - Simulate timestamps spanning the last 30 days
   - Include some orders with null fields (phone, email, region, etc.)

---

## 4. Complete API Specification

All endpoints follow this response structure unless otherwise noted.

### Standard Response Format

```typescript
// Success
{
  "success": true,
  "data": { /* payload */ }
}

// Success with pagination
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 95,
    "per_page": 20
  }
}

// Error
{
  "success": false,
  "error": "Error message in English"
}

// Validation Error
{
  "success": false,
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

---

### Module 1: Authentication (`/auth`)

#### 1.1 Register User
```http
POST /auth/register
Content-Type: application/json

Body:
{
  "name": "string (required, max 255)",
  "email": "string (required, valid email, unique)",
  "password": "string (required, min 8 characters)"
}

Response 201:
{
  "success": true,
  "data": {
    "user": { /* User object */ },
    "token": "jwt-token-string"
  }
}

Error 400:
{
  "success": false,
  "error": "Email already registered"
}
```

#### 1.2 Login
```http
POST /auth/login
Content-Type: application/json

Body:
{
  "email": "string (required)",
  "password": "string (required)"
}

Response 200:
{
  "success": true,
  "data": {
    "user": { /* User object with last_login_at updated */ },
    "token": "jwt-token-string"
  }
}

Error 401:
{
  "success": false,
  "error": "Invalid credentials" | "User account is inactive"
}
```

**Frontend Implementation:**
- Store token in `localStorage` with key `'auth_token'`
- Set up Axios interceptor to attach token to all requests:
  ```typescript
  headers: { Authorization: `Bearer ${token}` }
  ```
- On 401 response, clear token and redirect to login

#### 1.3 Get Current User
```http
GET /auth/me
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": { /* User object */ }
}
```

#### 1.4 Update Profile
```http
PATCH /auth/profile
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "name": "string (optional)",
  "email": "string (optional)"
}

Response 200:
{
  "success": true,
  "data": { /* Updated User object */ }
}
```

#### 1.5 Change Password
```http
PATCH /auth/password
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "current_password": "string (required)",
  "new_password": "string (required, min 8)"
}

Response 200:
{
  "success": true,
  "message": "Password changed successfully"
}

Error 400:
{
  "success": false,
  "error": "Current password is incorrect"
}
```

#### 1.6 List Users (Admin)
```http
GET /auth/users?page=1&limit=20&is_active=true
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": [ /* User[] */ ],
  "pagination": { /* ... */ }
}
```

#### 1.7 Toggle User Status (Admin)
```http
PATCH /auth/users/:id/status
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "is_active": boolean
}

Response 200:
{
  "success": true,
  "data": { /* Updated User */ }
}
```

---

### Module 2: COD Hub (`/cod-hub`)

#### 2.1 Get Enums (CRITICAL - Call on App Mount)

```http
GET /cod-hub/enums
Access: Public (No auth required)

Response 200:
{
  "success": true,
  "data": {
    "orderStatus": ["SIN CONFIRMAR", "CONFIRMADA", "ENTREGADA", "CANCELADA"],
    "deliveryStatus": [
      "SIN CONFIRMAR",
      "SIN DESPACHAR",
      "CANCELADA",
      "RECHAZADA",
      "EN TRANSITO",
      "ENTREGADA",
      "NOVEDAD",
      "RECLAMO EN OFICINA"
    ],
    "countries": ["CO", "MX", "EC", "CL"]
  }
}
```

**Implementation Requirements:**
- Create a React Context `EnumsContext` that fetches and stores this data
- Fetch immediately on app mount, before rendering main UI
- If fetch fails, show full-screen error with retry button
- Use these values for ALL dropdowns - do NOT hardcode enum values anywhere
- Cache with React Query: `staleTime: 1000 * 60 * 60` (1 hour)

**Individual Enum Endpoints (Optional):**
- `GET /cod-hub/enums/order-status`
- `GET /cod-hub/enums/delivery-status`
- `GET /cod-hub/enums/countries`

#### 2.2 List Orders (with Filters & Pagination)

```http
GET /cod-hub/orders?page=1&limit=20&store_id=1&order_status=SIN_CONFIRMAR&delivery_status=EN_TRANSITO&country=CO&sort_by=created_at&sort_order=DESC
Authorization: Bearer {token}

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20, options: 10, 20, 50, 100)
- store_id: number (optional)
- order_status: OrderStatus (optional)
- delivery_status: DeliveryStatus (optional)
- country: CountryCode (optional)
- sort_by: string (default: "created_at", options: created_at, order_name, customer_name)
- sort_order: "ASC" | "DESC" (default: "DESC")

Response 200:
{
  "success": true,
  "data": [ /* CodOrder[] with computed fields */ ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 95,
    "per_page": 20
  }
}
```

**Frontend Filter Implementation:**
- Use controlled inputs for all filters
- Debounce filter changes by 300ms before making request
- Update URL query params to make filters shareable
- Show filter badges with clear buttons
- Persist filter state in React Query cache

#### 2.3 Search Orders

```http
GET /cod-hub/orders/search?q=12345&store_id=1&page=1&limit=20
Authorization: Bearer {token}

Query Parameters:
- q: string (required, min 2 chars) - Searches in order_name, customer_name, customer_phone, customer_email
- store_id: number (optional)
- page, limit: same as list

Response 200: Same structure as List Orders
```

**Frontend Implementation:**
- Minimum 2 characters to trigger search
- Debounce by 400ms
- Show "Buscando..." indicator
- Highlight search term in results (if possible)

#### 2.4 Get Order Statistics

```http
GET /cod-hub/orders/stats?store_id=1
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "total_orders": 1247,
    "by_order_status": {
      "SIN CONFIRMAR": 45,
      "CONFIRMADA": 832,
      "ENTREGADA": 298,
      "CANCELADA": 72
    },
    "by_delivery_status": {
      "SIN CONFIRMAR": 12,
      "SIN DESPACHAR": 33,
      "EN TRANSITO": 156,
      "ENTREGADA": 298,
      "CANCELADA": 45,
      "RECHAZADA": 18,
      "NOVEDAD": 9,
      "RECLAMO EN OFICINA": 6
    },
    "by_country": {
      "CO": 745,
      "MX": 312,
      "EC": 142,
      "CL": 48
    }
  }
}
```

**Frontend Display:**
- Show as cards at top of dashboard
- Use chart library (Recharts) for visual representation
- Allow filtering by clicking stat cards

#### 2.5 Get Single Order

```http
GET /cod-hub/orders/:id
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": { /* Full CodOrder object */ }
}

Error 404:
{
  "success": false,
  "error": "Order not found"
}
```

#### 2.6 Confirm Order

```http
PATCH /cod-hub/orders/:id/confirm
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": { /* Updated order with order_status: "CONFIRMADA", confirmed_at: timestamp, confirmed_by: user_id */ }
}

Error 400:
{
  "success": false,
  "error": "Order cannot be confirmed in current status"
}
```

**Business Rules:**
- Can only confirm if `order_status === "SIN CONFIRMAR"`
- Updates `confirmed_at`, `confirmed_by`, and `order_status`

#### 2.7 Update Delivery Status

```http
PATCH /cod-hub/orders/:id/delivery-status
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "delivery_status": DeliveryStatus (required, must be from enums)
}

Response 200:
{
  "success": true,
  "data": { /* Updated order */ }
}
```

**Business Rules:**
- Can update delivery status for any non-cancelled order
- Updates `updated_by` field

#### 2.8 Cancel Order

```http
PATCH /cod-hub/orders/:id/cancel
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "cancel_reason_id": number (required, must exist in cancel_reasons table)
}

Response 200:
{
  "success": true,
  "data": { /* Updated order with order_status: "CANCELADA", delivery_status: "CANCELADA", cancel_reason_id set */ }
}

Error 400:
{
  "success": false,
  "error": "Cancel reason not found" | "Order cannot be cancelled in current status"
}
```

**Business Rules:**
- Cannot cancel already delivered orders
- Automatically sets `order_status` to "CANCELADA" and `delivery_status` to "CANCELADA"

#### 2.9 Mark as Delivered

```http
PATCH /cod-hub/orders/:id/deliver
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": { /* Updated order with order_status: "ENTREGADA", delivery_status: "ENTREGADA" */ }
}
```

**Business Rules:**
- Sets both `order_status` and `delivery_status` to "ENTREGADA"
- Should typically only be used for confirmed orders

---

#### 2.10 Cancel Reasons CRUD

**List Cancel Reasons**
```http
GET /cod-hub/cancel-reasons
Access: Public

Response 200:
{
  "success": true,
  "data": [ /* CancelReason[] */ ]
}
```

**Get Cancel Reason by ID**
```http
GET /cod-hub/cancel-reasons/:id

Response 200:
{
  "success": true,
  "data": { /* CancelReason */ }
}
```

**Create Cancel Reason**
```http
POST /cod-hub/cancel-reasons
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "reason": "string (required, max 255)"
}

Response 201:
{
  "success": true,
  "data": { /* Created CancelReason with created_by set */ }
}
```

**Update Cancel Reason**
```http
PATCH /cod-hub/cancel-reasons/:id
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "reason": "string (required)"
}

Response 200:
{
  "success": true,
  "data": { /* Updated CancelReason with updated_by set */ }
}
```

**Delete Cancel Reason**
```http
DELETE /cod-hub/cancel-reasons/:id
Authorization: Bearer {token}

Response 200:
{
  "success": true
}

Error 400:
{
  "success": false,
  "error": "Cannot delete cancel reason that is in use"
}
```

---

## 5. Feature Implementation: Orders Management

### A. Dashboard Layout (`pages/Dashboard.tsx`)

**Structure:**
```
┌─────────────────────────────────────────────────────┐
│  [Stats Cards Row]                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Total   │ │ Pending │ │ Transit │ │ Delivered│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────────────────┤
│  [Filters Bar]                                      │
│  🔍 Search  [Status▼] [Delivery▼] [Country▼] [🔄] │
├─────────────────────────────────────────────────────┤
│  [Orders Table with Bulk Actions]                   │
│  ☑ Order    Customer    Status    ...    Actions   │
│  ...                                                │
├─────────────────────────────────────────────────────┤
│  [Pagination]                    [Items per page▼]  │
└─────────────────────────────────────────────────────┘
```

**Stats Cards Implementation:**
- Fetch from `GET /cod-hub/orders/stats`
- Show total orders prominently
- Display key metrics with icons and colors
- Make clickable to filter by that status
- Use shadcn `Card` component

**Filters Bar:**
- **Search Input:** Debounced text input (400ms)
- **Order Status:** Multi-select dropdown (shadcn `Select` or custom multi-select)
- **Delivery Status:** Multi-select dropdown
- **Country:** Single select dropdown
- **Reset Button:** Clear all filters
- Show active filter count badge

### B. Orders Table (`components/orders/OrdersTable.tsx`)

**Use TanStack Table v8 with these features:**

#### Column Configuration

```typescript
const columns = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  },
  {
    accessorKey: 'order_name',
    header: 'Orden',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.order_name}</span>
        <a
          href={row.original.order_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
          title="Ver en Shopify"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    ),
  },
  {
    accessorKey: 'customer_name',
    header: 'Cliente',
  },
  {
    accessorKey: 'order_status',
    header: 'Estado Orden',
    cell: ({ row }) => <OrderStatusBadge status={row.original.order_status} />,
  },
  {
    accessorKey: 'delivery_status',
    header: 'Estado Despacho',
    cell: ({ row }) => <DeliveryStatusBadge status={row.original.delivery_status} />,
  },
  {
    accessorKey: 'country',
    header: 'País',
    cell: ({ row }) => <CountryFlag country={row.original.country} />,
  },
  {
    accessorKey: 'city',
    header: 'Ciudad',
  },
  {
    accessorKey: 'created_at',
    header: 'Fecha',
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    id: 'actions',
    header: 'Acciones',
    cell: ({ row }) => <OrderActionsMenu order={row.original} />,
  },
];
```

#### Table Features to Implement

1. **Row Selection:**
   - Enable multi-row selection
   - Show selection count in bulk actions bar
   - "Select All" checkbox in header
   - Individual checkboxes per row

2. **Sorting:**
   - Click column headers to sort
   - Visual indicators (arrows) for sort direction
   - Support for multiple sort columns

3. **Pagination:**
   - Controls at bottom
   - Show "Showing X-Y of Z results"
   - Items per page selector: 10, 20, 50, 100
   - First/Previous/Next/Last buttons

4. **Row Actions Menu:**
   - shadcn `DropdownMenu` component
   - Actions: Ver Detalle, Confirmar, Actualizar Despacho, Cancelar, Marcar Entregada
   - Conditionally enable/disable based on order status
   - Each action opens appropriate modal/triggers API call

### C. Bulk Actions Implementation (CRITICAL FEATURE)

#### UI: Floating Action Bar

When rows are selected, show a fixed bottom bar:

```tsx
<AnimatePresence>
  {selectedCount > 0 && (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50"
    >
      <div className="container mx-auto flex items-center justify-between">
        <span className="font-medium">
          {selectedCount} {selectedCount === 1 ? 'orden seleccionada' : 'órdenes seleccionadas'}
        </span>
        <div className="flex gap-2">
          <Button onClick={handleBulkConfirm}>Confirmar</Button>
          <Button onClick={handleBulkUpdateDelivery}>Actualizar Despacho</Button>
          <Button onClick={handleBulkCancel} variant="destructive">Cancelar</Button>
          <Button onClick={handleBulkDeliver} variant="secondary">Marcar Entregadas</Button>
          <Button onClick={clearSelection} variant="ghost">Limpiar</Button>
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

#### Technical Implementation: Concurrent Requests Pattern

Since the API only provides single-item endpoints, implement bulk operations as follows:

```typescript
async function bulkConfirmOrders(orderIds: number[]) {
  // Show loading toast
  toast.loading(`Confirmando ${orderIds.length} órdenes...`, { id: 'bulk-confirm' });

  // Execute all requests concurrently
  const results = await Promise.allSettled(
    orderIds.map(id => apiClient.patch(`/cod-hub/orders/${id}/confirm`))
  );

  // Process results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  // Update toast with results
  if (failed === 0) {
    toast.success(`${successful} órdenes confirmadas exitosamente`, { id: 'bulk-confirm' });
  } else {
    toast.warning(
      `${successful} órdenes confirmadas, ${failed} fallaron`,
      { id: 'bulk-confirm' }
    );
  }

  // Invalidate queries to refresh table
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['orderStats'] });

  // Clear selection
  table.resetRowSelection();

  // Return detailed results for error handling
  return {
    successful,
    failed,
    results: results.map((result, index) => ({
      orderId: orderIds[index],
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? result.reason : null,
    })),
  };
}
```

#### Bulk Actions with User Input

For actions requiring additional data (Update Delivery Status, Cancel):

```typescript
function handleBulkUpdateDelivery() {
  // Open modal with form
  openModal({
    title: 'Actualizar Estado de Despacho',
    content: (
      <BulkUpdateDeliveryForm
        selectedOrders={selectedOrders}
        onSubmit={async (newStatus) => {
          const results = await Promise.allSettled(
            selectedOrders.map(order =>
              apiClient.patch(`/cod-hub/orders/${order.id}/delivery-status`, {
                delivery_status: newStatus,
              })
            )
          );
          // Handle results...
          closeModal();
        }}
      />
    ),
  });
}
```

**Form Requirements:**
- Use React Hook Form + Zod validation
- Dropdown populated from `useEnums()` hook
- Show preview of affected orders
- Confirm button with loading state
- Progress indicator during execution

#### Error Handling Strategy

1. **Individual Failures:**
   - Show detailed error list in toast or modal
   - Allow retry for failed items only
   - Log errors to console for debugging

2. **Network Failures:**
   - Catch and display network errors
   - Offer "Retry All" button
   - Don't invalidate cache until successful

3. **Partial Success:**
   - Show summary: "15/20 successful"
   - List failed orders with reasons
   - Refresh table to show updated orders

---

## 6. UI/UX Design System

### A. Color Palette & Badge System

Implement using Tailwind classes and shadcn `Badge` component:

**Order Status Colors:**
```typescript
const orderStatusConfig = {
  'SIN CONFIRMAR': { variant: 'secondary', color: 'gray' },
  'CONFIRMADA': { variant: 'default', color: 'blue' },
  'ENTREGADA': { variant: 'default', color: 'green' },
  'CANCELADA': { variant: 'destructive', color: 'red' },
};
```

**Delivery Status Colors:**
```typescript
const deliveryStatusConfig = {
  'SIN CONFIRMAR': { variant: 'secondary', color: 'gray' },
  'SIN DESPACHAR': { variant: 'outline', color: 'yellow' },
  'CANCELADA': { variant: 'destructive', color: 'red' },
  'RECHAZADA': { variant: 'destructive', color: 'red' },
  'EN TRANSITO': { variant: 'default', color: 'orange' },
  'ENTREGADA': { variant: 'default', color: 'green' },
  'NOVEDAD': { variant: 'default', color: 'purple' },
  'RECLAMO EN OFICINA': { variant: 'default', color: 'pink' },
};
```

**Badge Component Example:**
```tsx
function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatusConfig[status];
  return (
    <Badge variant={config.variant} className={`bg-${config.color}-500`}>
      {status}
    </Badge>
  );
}
```

### B. Component Standards

**All UI components must use shadcn/ui:**
- `Button` - All buttons
- `Card` - Stats, containers
- `Table` - Use with TanStack Table
- `Dialog` - Modals
- `Sheet` - Side panels
- `Select` - Dropdowns
- `Input` - Text inputs
- `Checkbox` - Selection
- `Badge` - Status indicators
- `Toast` - Notifications (sonner)
- `DropdownMenu` - Action menus
- `Form` - With React Hook Form

### C. Responsive Design

- **Desktop (≥1024px):** Full layout with sidebar, multi-column table
- **Tablet (768-1023px):** Collapsible sidebar, scrollable table
- **Mobile (<768px):** 
  - Bottom navigation
  - Card view for orders instead of table
  - Collapsible filters
  - Stack bulk actions vertically

### D. Loading & Empty States

**Loading States:**
- Skeleton loaders for tables (shadcn `Skeleton`)
- Spinner overlays for actions
- Disabled states during bulk operations
- Progress bars for multi-step processes

**Empty States:**
- Friendly illustrations (optional)
- Clear messaging: "No hay órdenes"
- Call-to-action if applicable
- Show active filters with option to clear

### E. Error Handling UI

**Error Boundaries:**
- Wrap entire app in error boundary
- Show friendly error page with retry
- Log errors to console (or error service)

**Toast Notifications:**
- Success: Green with checkmark
- Error: Red with X icon
- Warning: Yellow/orange
- Info: Blue
- Auto-dismiss after 5s (except errors - require manual dismiss)

---

## 7. Authentication Flow

### A. Route Protection

```tsx
// ProtectedRoute.tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}
```

### B. Token Management

**Storage:**
- Store JWT in `localStorage` under key `'auth_token'`
- Set token in Axios default headers on app init
- Clear token on logout or 401 response

**Axios Interceptor:**
```typescript
// Request interceptor
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### C. Auth Context

```typescript
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}

// Provide to entire app via Context API
```

---

## 8. React Query Configuration

### A. Setup

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      cacheTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### B. Query Keys Convention

```typescript
// User auth
['auth', 'me']

// Enums (long cache)
['enums'] // staleTime: 1 hour

// Orders list
['orders', { filters }]

// Single order
['orders', orderId]

// Stats
['orderStats', { storeId }]

// Cancel reasons
['cancelReasons']
```

### C. Optimistic Updates

For bulk actions, use optimistic updates:

```typescript
const mutation = useMutation({
  mutationFn: bulkConfirmOrders,
  onMutate: async (orderIds) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['orders'] });
    
    // Snapshot previous value
    const previousOrders = queryClient.getQueryData(['orders']);
    
    // Optimistically update
    queryClient.setQueryData(['orders'], old => {
      return old.map(order =>
        orderIds.includes(order.id)
          ? { ...order, order_status: 'CONFIRMADA' }
          : order
      );
    });
    
    return { previousOrders };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['orders'], context.previousOrders);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  },
});
```

---

## 9. Additional Features

### A. Cancel Reasons Management Page

Full CRUD interface:
- Table listing all reasons
- "Add New Reason" button → Opens dialog with form
- Edit icon in each row → Opens dialog with pre-filled form
- Delete icon → Shows confirmation dialog
- Show `created_by` and `updated_by` (user names if possible)

### B. User Profile Page

- Display current user info
- Form to update name/email
- Separate form to change password
- Show last login date
- Logout button

### C. Admin: User Management

If user is admin (you may need to add `is_admin` field):
- List all users
- Filter by active/inactive
- Toggle user status
- Show user stats (last login, created date)

### D. Dashboard Analytics (Optional)

- Charts showing trends over time (Recharts)
- Order volume by country
- Status distribution pie chart
- Recent orders list

---

## 10. Implementation Checklist & Order

### Phase 1: Foundation (Day 1)
- [ ] Scaffold Vite + React + TypeScript project
- [ ] Install and configure shadcn/ui
- [ ] Setup TanStack Query with QueryClientProvider
- [ ] Create TypeScript types in `src/types/`
- [ ] Setup Axios instance with interceptors
- [ ] Create mock data generators
- [ ] Implement environment variable for mock mode

### Phase 2: Authentication (Day 1-2)
- [ ] Create `AuthContext` and `useAuth` hook
- [ ] Build Login page with form validation
- [ ] Build Register page
- [ ] Implement token storage and retrieval
- [ ] Create `ProtectedRoute` component
- [ ] Build Profile page

### Phase 3: Enums & Core Services (Day 2)
- [ ] Implement `GET /cod-hub/enums` service
- [ ] Create `EnumsContext` and `useEnums` hook
- [ ] Build error boundary for enum loading failure
- [ ] Create reusable Badge components

### Phase 4: Orders Dashboard (Day 2-3)
- [ ] Build Dashboard layout
- [ ] Implement stats cards with `GET /orders/stats`
- [ ] Create filters bar with all controls
- [ ] Implement debounced search

### Phase 5: Orders Table (Day 3-4)
- [ ] Setup TanStack Table with all columns
- [ ] Implement row selection
- [ ] Add sorting functionality
- [ ] Implement pagination controls
- [ ] Create row actions dropdown menu
- [ ] Build order detail modal

### Phase 6: Bulk Actions (Day 4-5)
- [ ] Build floating bulk actions bar
- [ ] Implement bulk confirm with Promise.allSettled
- [ ] Build bulk update delivery modal + form
- [ ] Build bulk cancel modal with reason selection
- [ ] Implement bulk deliver
- [ ] Add progress indicators and result toasts
- [ ] Handle partial failures gracefully

### Phase 7: Cancel Reasons (Day 5)
- [ ] Build Cancel Reasons page with table
- [ ] Implement Create dialog
- [ ] Implement Edit dialog
- [ ] Implement Delete with confirmation
- [ ] Add error handling

### Phase 8: Polish & Testing (Day 6)
- [ ] Add loading skeletons everywhere
- [ ] Implement empty states
- [ ] Test responsive design on mobile
- [ ] Add proper error messages
- [ ] Test all bulk actions thoroughly
- [ ] Optimize React Query cache strategies
- [ ] Add keyboard shortcuts (optional)

### Phase 9: Real API Integration (Day 7)
- [ ] Test with real backend
- [ ] Fix any API contract mismatches
- [ ] Implement proper error handling for real scenarios
- [ ] Performance testing with large datasets

---

## 11. Critical Success Factors

1. **Mock Mode Must Work Perfectly:**
   - Generate enough realistic data to test all scenarios
   - Simulate API delays and occasional errors
   - Make it easy to toggle between mock and real

2. **Bulk Actions Are Non-Negotiable:**
   - Users must be able to select multiple orders and perform actions
   - Must handle partial failures gracefully
   - Must show clear feedback (progress, success, errors)

3. **Performance:**
   - Table should handle 100+ rows smoothly
   - Use virtual scrolling if needed (react-window)
   - Optimize re-renders with React.memo where appropriate
   - Debounce user inputs

4. **UX Details Matter:**
   - Loading states for every async operation
   - Toast notifications for all actions
   - Confirmation dialogs for destructive actions
   - Keyboard navigation support
   - Accessible (ARIA labels, semantic HTML)

5. **Type Safety:**
   - No `any` types
   - All API responses properly typed
   - Form validation with Zod schemas matching API validation

---

## 12. Environment Variables

Create `.env` file:

```bash
VITE_USE_MOCK=true
VITE_API_BASE_URL=https://api.example.com
VITE_API_TIMEOUT=10000
```

---

## 13. Testing Recommendations

While not required for initial delivery, consider:

- **Unit Tests:** Critical utility functions, hooks
- **Integration Tests:** React Testing Library for forms, tables
- **E2E Tests:** Playwright for complete user flows
- **Mock Service Worker (MSW):** For more sophisticated API mocking

---

## 14. Deliverables

At the end of implementation, you should have:

1. ✅ Fully functional React application
2. ✅ Working in mock mode with realistic data
3. ✅ Complete authentication flow
4. ✅ Orders dashboard with filters and search
5. ✅ Functional table with sorting and pagination
6. ✅ Working bulk actions (confirm, update, cancel, deliver)
7. ✅ Cancel reasons CRUD page
8. ✅ User profile management
9. ✅ Responsive design (mobile-friendly)
10. ✅ Proper error handling and loading states
11. ✅ Toast notifications for user feedback
12. ✅ Clean, typed, well-documented code
13. ✅ Easy toggle to switch to real API

---

## 15. Final Notes

- **Priority:** Focus on the orders table and bulk actions - this is the core functionality
- **shadcn/ui:** Use it for everything - it's built on Radix UI and will save tons of time
- **TanStack Table:** Essential for bulk selection - don't try to roll your own
- **React Query:** Perfect for managing server state - use it heavily
- **TypeScript:** Don't fight it - proper types will save debugging time
- **Spanish UI:** All user-facing text must be in Spanish
- **Mock Mode:** Make it so good that the app is usable without a backend

**When in doubt, refer back to this specification. Good luck!** 🚀
