# API Reference — Backend ODEPA

Base URL (producción): `https://backend-odepa-production.up.railway.app`  
Base URL (local): `http://localhost:3000`

Todos los endpoints están bajo el prefijo `/api`.

---

## Autenticación

La API usa **JWT de Supabase**. Los endpoints protegidos requieren el header:

```
Authorization: Bearer <supabase_access_token>
```

Hay dos modos de autenticación:

| Modo | Descripción |
|---|---|
| `requireAuth` | Token obligatorio. Retorna `401` si falta o es inválido. |
| `optionalAuth` | Token opcional. Si no hay token, el usuario opera como invitado (sin historial). |

---

## Precios

### `GET /api/prices`

Lista registros de precios mayoristas ODEPA con filtros opcionales.

**Auth**: No requerida

**Query params**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `fecha_desde` | `YYYY-MM-DD` | — | Fecha inicial (inclusive) |
| `fecha_hasta` | `YYYY-MM-DD` | — | Fecha final (inclusive) |
| `producto` | `string` | — | Búsqueda parcial por nombre de producto |
| `mercado` | `string` | — | Búsqueda parcial por nombre de mercado |
| `region` | `string` | — | Búsqueda parcial por región |
| `limit` | `number` | `500` | Máximo de registros (1–5000) |

**Respuesta `200`**

```json
[
  {
    "id": 1,
    "fecha": "2026-04-10",
    "producto": "Tomate",
    "variedad_tipo": "Larga vida",
    "calidad": "Primera",
    "mercado": "Lo Valledor",
    "region": "Metropolitana",
    "id_region": 13,
    "subsector": "Hortalizas",
    "origen": "Nacional",
    "unidad_comercializacion": "Caja 20 kg",
    "volumen": 120,
    "precio_minimo": 8000,
    "precio_maximo": 12000,
    "precio_promedio_ponderado": 9500,
    "kg_unidad_comercializacion": 20,
    "precio_kg_unidad_comercializacion": 475,
    "total_volume": 2400
  }
]
```

**Ejemplo**

```
GET /api/prices?producto=tomate&mercado=Lo+Valledor&fecha_desde=2026-04-01&limit=100
```

---

### `GET /api/prices/products`

Lista todos los productos disponibles en la base de datos.

**Auth**: No requerida

**Respuesta `200`**

```json
[
  { "nombre": "Manzana", "subsector": "Frutas" },
  { "nombre": "Tomate", "subsector": "Hortalizas" }
]
```

---

### `GET /api/prices/markets`

Lista todos los mercados mayoristas activos.

**Auth**: No requerida

**Respuesta `200`**

```json
[
  { "nombre": "Lo Valledor", "region": "Metropolitana", "id_region": 13 },
  { "nombre": "La Vega", "region": "Metropolitana", "id_region": 13 }
]
```

---

## Chat (IA)

### `POST /api/chat`

Envía mensajes al asistente de IA. Responde en **streaming** (Vercel AI SDK `UIMessageStream`).

**Auth**: Opcional (`optionalAuth`). Sin token: modo invitado sin historial persistente.

**Body**

```json
{
  "messages": [
    {
      "id": "msg_abc123",
      "role": "user",
      "content": "¿Cuál es el precio del tomate hoy?"
    }
  ],
  "modelId": "claude-haiku-4-5",
  "threadId": "uuid-del-thread"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `messages` | `UIMessage[]` | Sí | Mensajes en formato Vercel AI SDK |
| `modelId` | `string` | No | ID del modelo a usar (ver `/api/chat/models`). Default: `claude-haiku-4-5` |
| `threadId` | `string` (UUID) | No | ID del thread para persistir historial. Solo aplica si hay token válido. |

**Respuesta**: Stream `text/event-stream` en formato UI Message Stream.

> Usar con `useChat()` de `@ai-sdk/react` o consumir el stream manualmente.

**Modelos disponibles**

| ID | Proveedor | Descripción |
|---|---|---|
| `claude-haiku-4-5` | Anthropic | Default. Preciso, rápido en razonamiento estructurado. |
| `gemini-2.5-flash` | Google | Muy rápido, ideal para consultas simples. |
| `kimi-k2` | Groq | 128k contexto, código abierto. Limitado a 10 mensajes de historial. |
| `minimax-m2` | MiniMax | Modelo de respaldo. |

---

### `GET /api/chat/models`

Lista los modelos de IA disponibles.

**Auth**: No requerida

**Respuesta `200`**

```json
{
  "models": [
    {
      "id": "claude-haiku-4-5",
      "label": "Claude Haiku 4.5",
      "provider": "Anthropic",
      "description": "Preciso, rápido en razonamiento estructurado"
    },
    {
      "id": "gemini-2.5-flash",
      "label": "Gemini 2.5 Flash",
      "provider": "Google",
      "description": "Muy rápido, ideal para consultas simples"
    }
  ],
  "default": "claude-haiku-4-5"
}
```

---

## Threads (Historial de Chat)

> Todos los endpoints de threads requieren autenticación.

### `GET /api/threads`

Lista los threads del usuario autenticado, ordenados por última actividad.

**Auth**: Requerida

**Respuesta `200`**

```json
{
  "threads": [
    {
      "id": "uuid",
      "title": "Nueva conversación",
      "archived": false,
      "created_at": "2026-04-10T12:00:00Z",
      "updated_at": "2026-04-10T13:00:00Z"
    }
  ]
}
```

---

### `POST /api/threads/:id`

Crea o registra un thread (upsert). Llamado por el adapter del frontend al inicializar un chat.

**Auth**: Requerida

**Params**: `:id` — UUID del thread (generado por el frontend)

**Respuesta `200`**

```json
{ "id": "uuid" }
```

---

### `GET /api/threads/:id/messages`

Obtiene todos los mensajes de un thread, ordenados cronológicamente.

**Auth**: Requerida (solo el dueño del thread puede leerlo)

**Respuesta `200`**

```json
{
  "messages": [
    {
      "id": "msg_abc",
      "role": "user",
      "content": "¿Cuál es el precio del tomate?",
      "parts": [{ "type": "text", "text": "¿Cuál es el precio del tomate?" }]
    },
    {
      "id": "msg_xyz",
      "role": "assistant",
      "content": "El tomate en Lo Valledor hoy...",
      "parts": [{ "type": "text", "text": "El tomate en Lo Valledor hoy..." }]
    }
  ]
}
```

**Respuesta `404`**: Thread no encontrado o no pertenece al usuario.

---

### `PATCH /api/threads/:id`

Renombra o archiva un thread.

**Auth**: Requerida

**Body**

```json
{
  "title": "Consulta de tomates abril",
  "archived": false
}
```

**Respuesta `200`**

```json
{ "ok": true }
```

---

### `DELETE /api/threads/:id`

Elimina un thread y todos sus mensajes.

**Auth**: Requerida

**Respuesta `200`**

```json
{ "ok": true }
```

---

## Perfil de Usuario

### `GET /api/profile`

Obtiene el perfil del usuario autenticado. Si no existe, retorna valores por defecto.

**Auth**: Requerida

**Respuesta `200`**

```json
{
  "role": "free",
  "ai_config": {
    "temperature": 0.7,
    "system_prompt_extra": "Responde siempre en bullet points"
  },
  "preferred_model": "gemini-2.5-flash",
  "messages_today": 5,
  "messages_today_date": "2026-04-13"
}
```

| Campo | Descripción |
|---|---|
| `role` | `"free"` o `"premium"` |
| `ai_config.temperature` | Temperatura del LLM (0–1). Opcional. |
| `ai_config.system_prompt_extra` | Instrucciones extra que se inyectan al system prompt. Opcional. |
| `preferred_model` | Modelo preferido del usuario. |
| `messages_today` | Cantidad de mensajes enviados hoy. |
| `messages_today_date` | Fecha del contador (YYYY-MM-DD). |

---

### `PATCH /api/profile`

Actualiza la configuración del perfil.

**Auth**: Requerida

**Body** (todos los campos son opcionales, mínimo 1)

```json
{
  "ai_config": {
    "temperature": 0.5,
    "system_prompt_extra": "Responde siempre en bullet points"
  },
  "preferred_model": "claude-haiku-4-5"
}
```

**Respuesta `200`**

```json
{ "ok": true }
```

**Respuesta `400`**: Si no se envía ningún campo a actualizar.

---

## Sync / Scraper

> Endpoints de administración para el scraper de ODEPA. No son de uso frecuente desde el frontend.

### `GET /api/sync/status`

Estado actual del scraper y de los datos en la base de datos.

**Auth**: No requerida

**Respuesta `200`**

```json
{
  "last_date": "2026-04-10",
  "total_rows": 148432,
  "is_running": false
}
```

---

### `POST /api/sync`

Dispara un backfill manual: sincroniza todos los días hábiles desde la última fecha en DB hasta hoy.

**Auth**: No requerida

**Respuesta `202`**

```json
{ "message": "Backfill started" }
```

**Respuesta `409`**: Si ya hay un sync en progreso.

---

### `POST /api/sync/weekly`

Sincroniza solo los días hábiles de la semana actual que faltan en la DB.

**Auth**: No requerida

**Respuesta `202`**

```json
{ "message": "Weekly sync started" }
```

**Respuesta `409`**: Si ya hay un sync en progreso.

---

## Errores

Todas las respuestas de error siguen el mismo formato:

```json
{ "error": "Descripción del error" }
```

| Código | Significado |
|---|---|
| `400` | Parámetros inválidos o faltantes |
| `401` | No autenticado |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej: sync ya en progreso) |
| `500` | Error interno del servidor |

---

## Guía de Integración para el Frontend

### 1. Autenticación con Supabase

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login
const { data } = await supabase.auth.signInWithOAuth({ provider: 'google' });

// Obtener token para llamadas a la API
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Header para todas las llamadas autenticadas
const headers = { Authorization: `Bearer ${token}` };
```

### 2. Chat con streaming (Vercel AI SDK)

```ts
import { useChat } from '@ai-sdk/react';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: `${API_BASE_URL}/api/chat`,
  headers: { Authorization: `Bearer ${token}` },
  body: {
    modelId: 'claude-haiku-4-5',
    threadId: currentThreadId,
  },
});
```

### 3. Consultar precios

```ts
const res = await fetch(
  `${API_BASE_URL}/api/prices?producto=tomate&mercado=Lo+Valledor&limit=50`
);
const prices = await res.json();
```

### 4. CORS

El backend tiene CORS habilitado para todas las rutas `/api/*`. No se necesita configuración adicional en el frontend.
