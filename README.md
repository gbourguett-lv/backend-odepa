# Backend ODEPA — API de Precios de Frutas y Hortalizas

API RESTful + scraper automatizado para consulta de precios mayoristas de productos hortofrutícolas publicados por [ODEPA](https://www.odepa.gob.cl). Diseñado para alimentar un asistente conversacional con IA.

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | >=20 | Runtime |
| TypeScript | 5.8 | Lenguaje (strict, ESM, NodeNext) |
| Hono | 4.x | Framework web |
| Supabase | 2.x | Base de datos + Auth |
| Vercel AI SDK | 6.x | Integración multi-LLM |
| node-cron | 4.x | Scheduler del scraper |
| Jest + ts-jest | 29.x | Testing |

## Requisitos

- Node.js **>=20**
- npm
- Cuenta en [Supabase](https://supabase.com)
- API keys de los proveedores de IA (ver Variables de Entorno)

## Instalación

```bash
npm install
cp .env.example .env   # completar con los valores reales
```

## Variables de Entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `SUPABASE_URL` | **SI** | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **SI** | Service role key (NO la anon key) |
| `ANTHROPIC_API_KEY` | SI (chat) | API key de Anthropic |
| `GOOGLE_GENERATIVE_AI_API_KEY` | SI (chat) | API key de Google AI Studio |
| `GROQ_API_KEY` | SI (chat) | API key de Groq |
| `MINIMAX_API_KEY` | SI (chat) | API key de MiniMax |
| `ANTHROPIC_MODEL` | No | Default: `claude-haiku-4-5-20251001` |
| `GEMINI_MODEL` | No | Default: `gemini-2.5-flash` |
| `MINIMAX_MODEL` | No | Default: `MiniMax-M2.5` |
| `PORT` | No | Railway lo inyecta automáticamente |

## Scripts

```bash
npm run dev          # Servidor de desarrollo con hot-reload
npm run build        # Compilar TypeScript → dist/
npm run start        # Iniciar servidor en producción
npm test             # Tests con coverage
npm run test:watch   # Tests en modo watch
npm run lint         # ESLint
npm run format       # Prettier
npm run release      # Nuevo release patch (conventional commits)
npm run release:minor
npm run release:major
```

## Endpoints

### Precios
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/prices` | Listar precios con filtros opcionales |

### Sync / Scraper
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/sync/weekly` | Sincronización semanal inteligente |
| `POST` | `/api/sync` | Backfill desde última fecha en DB |

### Chat (IA)
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/chat` | Enviar mensaje, recibir respuesta de IA |
| `GET` | `/api/threads` | Listar threads del usuario |

### Perfil
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/profile` | Obtener perfil del usuario autenticado |
| `PATCH` | `/api/profile` | Actualizar perfil |

> Todos los endpoints de chat, threads y perfil requieren `Authorization: Bearer <token>` (JWT de Supabase).

## Scraper

El scraper descarga boletines diarios de ODEPA en formato XLSX y los upsertea en Supabase. Se ejecuta **automáticamente al iniciar el servidor** via `node-cron`:

- **Schedule**: Lunes a Viernes, 13:00 UTC (10:00 CLT)
- **Estrategia**: Backfill inteligente — solo sincroniza días que no existen en DB
- **Fuente**: `https://www.odepa.gob.cl/wp-content/uploads/...`

## Estructura del Proyecto

```
api/
├── src/
│   ├── routes/          # Un router Hono por dominio
│   │   ├── chat.ts
│   │   ├── prices.ts
│   │   ├── profile.ts
│   │   ├── sync.ts
│   │   └── threads.ts
│   ├── scraper/         # Lógica de scraping y sync
│   │   ├── odepa.ts     # Download + parse XLSX
│   │   └── sync.ts      # Scheduler y lógica de sync
│   ├── agent/           # Tools del agente de IA
│   ├── middleware/       # Auth middleware
│   ├── lib/             # Clientes (Supabase)
│   ├── types.ts
│   ├── database.types.ts
│   └── index.ts         # Entry point
├── __tests__/           # Tests (Jest + ts-jest ESM)
├── railway.toml         # Configuración de deploy
├── jest.config.js
├── tsconfig.json
└── package.json
```

## Deploy (Railway)

El proyecto incluye `railway.toml` con la configuración lista:

```toml
[build]
buildCommand = "npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/api/prices"
```

1. Crear proyecto en [Railway](https://railway.app)
2. Conectar este repositorio
3. Configurar las variables de entorno en Railway Dashboard
4. Deploy automático en cada push a `main`

## Workflow de Desarrollo

```
main          ← producción (Railway despliega desde acá)
  └── dev     ← integración (PRs desde feature branches)
        └── feature/nombre-feature
```

```bash
git checkout dev
git checkout -b feature/mi-feature
# ... desarrollar ...
git push origin feature/mi-feature
# Abrir PR → dev
# Una vez aprobado y mergeado a dev → PR dev → main para release
```

## Testing

```bash
npm test                    # Tests + coverage
NODE_OPTIONS=--experimental-vm-modules jest --watch   # Watch mode
```

Tests en `__tests__/` con sufijo `.test.ts`. Framework: Jest 29 + ts-jest (ESM mode).

## Convenciones de Commit

Seguimos [Conventional Commits](https://www.conventionalcommits.org):

| Prefijo | Uso |
|---|---|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `docs:` | Documentación |
| `refactor:` | Refactorización sin cambio de comportamiento |
| `test:` | Tests |
| `chore:` | Build, dependencias, config |
| `ci:` | CI/CD |

## Licencia

ISC
