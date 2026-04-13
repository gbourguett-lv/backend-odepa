# API - Asistente de Precios ODEPA

API RESTful para el asistente inteligente de consulta de precios de productos ODEPA.

## 🚀 Características

- **Chat con IA**: Conversaciones contextuales con memoria persistente usando UUID
- **Sync Semanal**: Sincronización automática de precios ODEPA sin duplicar datos
- **Base de Datos**: Supabase para almacenamiento escalable
- **Validación**: Zod para validación de schemas

## 📋 Requisitos

- Node.js >= 18.x
- npm o yarn
- Cuenta en Supabase
- Variables de entorno configuradas

## 🔧 Instalación

```bash
cd api
npm install
```

### Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key
ANTHROPIC_API_KEY=tu_api_key
GROQ_API_KEY=tu_api_key
```

## 🏃‍♂️ Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Iniciar servidor en producción
npm run start

# Tests
npm run test
npm run test:watch

# Linting y formato
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Versionado y releases
npm run release
npm run release:minor
npm run release:major
```

## 📡 Endpoints Principales

### Chat
- `POST /api/chat` - Enviar mensaje y obtener respuesta de IA
- `GET /api/chats/:threadId` - Obtener historial de chat

### Sync
- `POST /api/sync/weekly` - Ejecutar sync semanal inteligente
- `POST /api/sync/full` - Ejecutar sync completo

### ODEPA
- `GET /api/odepa` - Obtener precios (con filtros opcionales)
- `GET /api/odepa/:id` - Obtener precio por ID

## 🧪 Testing

```bash
# Ejecutar tests con coverage
npm run test

# Ver reporte HTML de coverage
open coverage/index.html
```

## 📦 Estructura del Proyecto

```
api/
├── src/
│   ├── routes/        # Endpoints de la API
│   ├── scraper/       # Lógica de scraping
│   ├── db/            # Configuración de base de datos
│   ├── utils/         # Utilidades y helpers
│   └── index.ts       # Punto de entrada
├── __tests__/         # Tests unitarios e integración
├── .eslintrc.json     # Configuración ESLint
├── .prettierrc        # Configuración Prettier
├── jest.config.js     # Configuración Jest
├── tsconfig.json      # Configuración TypeScript
└── package.json
```

## 🔄 Versionado

Este proyecto usa [Standard Version](https://github.com/conventional-changelog/standard-version) para versionado semántico automático basado en commits convencionales.

```bash
# Crear nuevo release (patch)
npm run release

# Release menor (nuevas features)
npm run release:minor

# Release mayor (breaking changes)
npm run release:major
```

## 📝 Convenciones de Commit

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Cambios en documentación
- `style:` Formato, faltantes punto y coma, etc.
- `refactor:` Refactorización de código
- `test:` Agregar/modificar tests
- `chore:` Cambios en build process, herramientas auxiliares

## 🤝 Contribuir

1. Crear rama desde `dev` (`git checkout -b feature/nueva-funcionalidad`)
2. Hacer commit (`git commit -m 'feat: agregué nueva funcionalidad'`)
3. Push a la rama (`git push origin feature/nueva-funcionalidad`)
4. Abrir Pull Request a `dev`

## 📄 Licencia

ISC
