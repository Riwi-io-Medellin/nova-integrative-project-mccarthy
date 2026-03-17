<div align="center">

<img src="frontend/assets/img/logo_oscuro_SF.png" alt="NOVA Logo" width="120" />

# NOVA — Sistema de Gestión de Novedades

**Plataforma web para gestionar ausencias, permisos e incapacidades del personal**

![Version](https://img.shields.io/badge/Version-1.0.0-6d28d9?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat-square&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?style=flat-square&logo=mysql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Render](https://img.shields.io/badge/Render-Starter-46E3B7?style=flat-square&logo=render&logoColor=white)
![Gmail](https://img.shields.io/badge/Gmail-SMTP-EA4335?style=flat-square&logo=gmail&logoColor=white)
![Security](https://img.shields.io/badge/Security-Helmet%20%2B%20Rate%20Limit-green?style=flat-square)

</div>

---

## Tabla de contenidos

1. [Descripción](#-descripción)
2. [Funcionalidades](#-funcionalidades)
3. [Stack tecnológico](#-stack-tecnológico)
4. [Seguridad](#-seguridad)
5. [Requisitos previos](#-requisitos-previos)
6. [Instalación](#-instalación)
7. [Variables de entorno](#️-variables-de-entorno)
8. [Base de datos](#️-base-de-datos)
9. [Ejecución](#️-ejecución)
10. [Dependencias](#-dependencias)
11. [Roles y permisos](#-roles-y-permisos)
12. [Carga masiva de usuarios](#-carga-masiva-de-usuarios)
13. [Servicios externos](#-servicios-externos)
14. [Despliegue en Render](#️-despliegue-en-render)
15. [Credenciales iniciales](#-credenciales-iniciales)
16. [Estructura del proyecto](#-estructura-del-proyecto)
17. [Solución de problemas](#-solución-de-problemas)

---

## 📋 Descripción

NOVA v1.0 es una plataforma web **full-stack** lanzada en 2026 para la gestión digital de ausencias, permisos e incapacidades del personal. Reemplaza procesos informales (mensajes de WhatsApp, correos sin registro, hojas de cálculo) por un sistema centralizado, trazable, con inteligencia artificial incorporada y medidas de seguridad que protegen los datos del personal.

Permite a los **usuarios** registrar solicitudes con documentos adjuntos y a los **administradores** revisarlas con apoyo de IA, mientras el sistema notifica automáticamente a cualquier correo del mundo.

> **Plataforma:** Render Starter ($7/mes) — necesario para SMTP y servidor siempre activo.

---

## ✨ Funcionalidades

### Panel del Usuario
- Registrar solicitudes: incapacidad médica, calamidad doméstica, permiso, constancia de entrenamiento, solicitud de egresado
- Adjuntar documento (imagen o PDF, máx. 10 MB) con drag-and-drop
- Ver historial con estado y observación del administrador
- Recibir emails automáticos en cada cambio de estado
- Recuperación de contraseña con enlace seguro de 1 hora

### Panel del Administrador
- Dashboard con estadísticas en tiempo real
- Filtros por estado y búsqueda full-text
- **Análisis IA** (LLaMA 3.3 70B): recomendación, confianza, retroactividad, historial, observación sugerida
- Prioridad automática al crear cada novedad (Alta / Media / Baja)
- CRUD completo de usuarios con validación de seguridad
- Importación masiva CSV con validación de formato por fila
- Administración de clanes y cohortes
- Historial de auditoría completo

---

## 🛠 Stack tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Runtime | Node.js 18.x | Entorno de ejecución |
| Framework | Express.js 4.19 | API REST + archivos estáticos |
| Autenticación | JWT (HS256) | Sesiones stateless |
| Hashing | bcryptjs (cost 12) | Hash seguro de contraseñas |
| **Seguridad HTTP** | **helmet** | **7 headers de protección** |
| **Rate limiting** | **express-rate-limit** | **Protección fuerza bruta** |
| BD principal | MySQL 5.7+ | Datos relacionales |
| BD auditoría | MongoDB Atlas | Historial de acciones |
| Email | Nodemailer + SMTP Gmail | Envío a cualquier correo |
| Archivos | Cloudinary | Avatares y adjuntos |
| IA | Groq — LLaMA 3.3 70B | Prioridad y análisis |
| Frontend | HTML5/CSS3/JS vanilla | Sin framework |
| Despliegue | Render Starter | PaaS con SMTP habilitado |

---

## 🔒 Seguridad

NOVA v1.0 implementa las siguientes medidas de seguridad:

### Headers HTTP (helmet)
Protección automática con 7 headers en todas las respuestas: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection` y otros.

### Rate Limiting por endpoint

| Endpoint | Límite | Protege contra |
|----------|--------|----------------|
| POST /api/auth/login | 10 intentos / 15 min | Fuerza bruta de contraseñas |
| POST /api/auth/register | 10 intentos / 15 min | Spam de cuentas |
| POST /api/auth/forgot-password | 5 intentos / 15 min | Abuso de emails y enumeración |
| POST /api/auth/reset-password | 5 intentos / 15 min | Fuerza bruta de tokens |
| GET/POST /api/* (general) | 200 req / 10 min | Scraping masivo |

### Protección de datos
- Contraseñas hasheadas con bcryptjs — nunca en texto plano
- Campos `password`, `reset_token` y `reset_token_expires` excluidos de **todas** las respuestas de la API
- Mensajes de error genéricos al cliente — sin detalles internos del servidor
- Tokens de recuperación con 256 bits de entropía criptográfica
- Validación de formato de correo en todos los endpoints de entrada

### Protección contra enumeración
El endpoint `forgot-password` devuelve el mismo mensaje si el correo existe o no, evitando que se descubran correos registrados en el sistema.

---

## 📦 Requisitos previos

| Herramienta | Versión mínima | Descarga |
|-------------|---------------|---------|
| Node.js | 18.x o superior | https://nodejs.org |
| npm | 9.x o superior | Incluido con Node.js |
| MySQL | 5.7 o superior | https://dev.mysql.com/downloads/ |
| MongoDB | Atlas en la nube | https://www.mongodb.com/atlas |

---

## 🚀 Instalación

```bash
# 1. Descomprimir el proyecto
unzip nova.zip && cd nova

# 2. Instalar dependencias (incluye helmet y express-rate-limit)
cd backend && npm install

# 3. Crear archivo de configuración
cp .env.example .env
```

---

## ⚙️ Variables de entorno

```env
# ── Servidor ──────────────────────────────────────
PORT=3000                              # *

# ── JWT ───────────────────────────────────────────
JWT_SECRET=clave_aleatoria_larga       # * (openssl rand -hex 32)
JWT_EXPIRES_IN=7d

# ── MySQL ─────────────────────────────────────────
DB_HOST=localhost                      # *
DB_PORT=3306
DB_USER=root                           # *
DB_PASSWORD=tu_password                # *
DB_NAME=nova                           # *

# ── MongoDB Atlas (opcional) ──────────────────────
MONGO_URI=mongodb+srv://usuario:pass@cluster.mongodb.net/nova

# ── Cloudinary (opcional) ─────────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── Gmail SMTP (opcional) ─────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx         # Contraseña de app Google (16 chars)
SMTP_FROM=NOVA <tucorreo@gmail.com>

# ── Groq IA (opcional) ────────────────────────────
GROQ_API_KEY=gsk_...

# ── URL del frontend ──────────────────────────────
FRONTEND_URL=https://tu-servicio.onrender.com
```

---

## 🗄️ Base de datos

```bash
mysql -u root -p < nova_schema.sql
```

---

## ▶️ Ejecución

```bash
# Desarrollo
cd backend && npm run dev

# Producción
cd backend && npm start
```

---

## 📚 Dependencias

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `express` | ^4.19.2 | Framework HTTP |
| `mysql2` | ^3.11.3 | Driver MySQL |
| `bcryptjs` | ^2.4.3 | Hash contraseñas |
| `jsonwebtoken` | ^9.0.2 | JWT |
| `dotenv` | ^16.4.5 | Variables de entorno |
| `cors` | ^2.8.5 | CORS con lista blanca |
| **`helmet`** | **^7.x** | **Headers de seguridad** |
| **`express-rate-limit`** | **^7.x** | **Rate limiting** |
| `mongoose` | ^8.4.3 | ODM MongoDB |
| `nodemailer` | ^6.9.14 | SMTP Gmail |
| `multer` | ^1.4.5-lts.1 | Archivos multipart |
| `cloudinary` | ^1.41.0 | CDN archivos |
| `streamifier` | ^0.1.1 | Buffer a stream |
| `groq-sdk` | ^0.5.0 | IA LLaMA |
| `express-validator` | ^7.2.0 | Validación inputs |
| `nodemon` (dev) | ^3.1.4 | Recarga automática |

---

## 👥 Roles y permisos

| Funcionalidad | Administrador | Usuario |
|---------------|:---:|:---:|
| Ver todas las novedades | ✅ | ❌ |
| Aprobar / rechazar | ✅ | ❌ |
| Análisis IA | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ |
| Ver auditoría | ✅ | ❌ |
| Configuración catálogos | ✅ | ❌ |
| Carga masiva CSV | ✅ | ❌ |
| Registrar novedad propia | ✅ | ✅ |
| Ver historial propio | ✅ | ✅ |

---

## 📤 Carga masiva de usuarios

**Columnas obligatorias:** `nombre, apellido, documento, correo, password`

**Columnas opcionales:** `tipo_documento, telefono, role, estado, clan, cohorte, horario, observaciones`

> Cada correo se valida con regex antes de insertar. Duplicados se omiten sin error.

---

## 🔗 Servicios externos

### Gmail SMTP
1. Activar verificación en 2 pasos en Google Account
2. Seguridad → Contraseñas de aplicación → crear para "Correo"
3. Usar los 16 caracteres **sin espacios** como `SMTP_PASS`

### MongoDB Atlas
1. Crear cluster M0 Free → crear usuario → Network Access `0.0.0.0/0`
2. Copiar URI como `MONGO_URI`

### Cloudinary
1. Copiar Cloud Name, API Key y API Secret del dashboard

### Groq IA
1. Generar API Key en console.groq.com → usar como `GROQ_API_KEY`

---

## ☁️ Despliegue en Render

| Campo | Valor |
|-------|-------|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Plan | **Starter ($7/mes)** — requerido para SMTP |

---

## 🔑 Credenciales iniciales

| Campo | Valor |
|-------|-------|
| Correo | `admin@nova.com` |
| Contraseña | `123456` |
| Rol | Administrador |

> ⚠️ Cambiar la contraseña inmediatamente tras el primer inicio de sesión.

---

## 📁 Estructura del proyecto

```
nova/
├── backend/
│   ├── config/
│   │   ├── cloudinary.js        Cloudinary v1
│   │   ├── mailer.js            Nodemailer + SMTP + templates
│   │   ├── mongo.js             Conexión MongoDB Atlas
│   │   └── mysql.js             Pool conexiones MySQL
│   ├── controllers/
│   │   ├── auth.controller.js   Login, registro, recuperación (con validaciones)
│   │   ├── catalogs.controller.js
│   │   ├── novedades.controller.js  Con límites de longitud
│   │   └── users.controller.js  Con fmt() seguro (excluye password y tokens)
│   ├── middleware/auth.js        JWT + roles
│   ├── models/AuditLog.js        MongoDB
│   ├── routes/
│   ├── package.json
│   └── server.js                Helmet + Rate limiting + CORS
├── frontend/
│   ├── css/global.css
│   ├── js/config.js
│   ├── js/utils.js
│   └── pages/
├── nova_schema.sql
└── render.yaml
```

---

## 🔧 Solución de problemas

<details>
<summary><strong>Emails no se envían — Connection timeout</strong></summary>
El servidor está en plan gratuito de Render que bloquea SMTP. Subir al plan Starter ($7/mes).
</details>

<details>
<summary><strong>Emails no se envían — Invalid login</strong></summary>
SMTP_PASS debe ser la contraseña de aplicación de Google (16 chars sin espacios), no la contraseña normal de Gmail.
</details>

<details>
<summary><strong>Error 429 — Too Many Requests</strong></summary>
El rate limiting bloqueó la IP por demasiados intentos. En producción esperar 15 minutos. En desarrollo reiniciar el servidor.
</details>

<details>
<summary><strong>ER_ACCESS_DENIED_ERROR</strong></summary>
Credenciales MySQL incorrectas. Verificar DB_USER y DB_PASSWORD.
</details>

<details>
<summary><strong>Análisis IA retorna prioridad Media siempre</strong></summary>
Verificar que GROQ_API_KEY esté configurado correctamente.
</details>

<details>
<summary><strong>Módulo de auditoría no registra acciones</strong></summary>
Verificar MONGO_URI y que 0.0.0.0/0 esté permitido en MongoDB Atlas Network Access.
</details>

---

<div align="center">

NOVA v1.0.0 — 2026

</div>
