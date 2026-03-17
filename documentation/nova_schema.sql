-- ═══════════════════════════════════════════════════════════════════════════════
-- NOVA — Schema SQL Completo v5.0
-- Sistema de Gestión de Novedades para Bootcamps
-- ───────────────────────────────────────────────────────────────────────────────
-- Compatible con: MySQL 5.7+ y MySQL 8.0+
-- Codificacion:   utf8mb4 (soporta caracteres especiales de todos los idiomas)
-- Motor:          InnoDB (transacciones y claves foraneas)
--
-- USO:
--   mysql -u root -p < nova_schema.sql
--
-- RESULTADO:
--   Crea la base de datos 'nova' desde cero con todas las tablas,
--   relaciones, indices y datos iniciales necesarios para arrancar.
--
-- ADVERTENCIA:
--   Este script ELIMINA y RECREA la base de datos 'nova' completa.
--   Usarlo solo en instalacion inicial o para reiniciar desde cero.
--
-- CREDENCIALES INICIALES:
--   Correo:     admin@nova.com
--   Contrasena: 123456
--   Rol:        Administrador
--   Cambiar la contrasena en el primer login.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP DATABASE IF EXISTS nova;

CREATE DATABASE nova
  CHARACTER SET  utf8mb4
  COLLATE        utf8mb4_unicode_ci;

USE nova;

-- Desactivar FK durante la creacion (se reactiva al final)
SET FOREIGN_KEY_CHECKS = 0;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLAS DE CATALOGO
-- Valores de referencia que alimentan los formularios y filtros del sistema.
-- El backend las expone via GET /api/catalogs
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- tipos_documento
-- Catalogo de documentos de identidad aceptados.
-- Referenciada por: usuarios.tipo_documento_id (opcional)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tipos_documento (
  id     INT          AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60)  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
-- roles
-- Perfiles de acceso del sistema.
-- id=1 Administrador: acceso total al sistema
-- id=2 Coder:         acceso solo a sus propias novedades
-- Referenciada por: usuarios.role_id
-- El middleware verifica este campo para proteger rutas de administrador.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id     INT          AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60)  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
-- estados
-- Ciclo de vida de un usuario.
-- id=1 Activo:    puede iniciar sesion
-- id=2 Inactivo:  NO puede iniciar sesion (estado por defecto al registrarse)
-- id=3 Egresado:  completo el bootcamp
-- id=4 Abandono:  abandono durante el proceso
-- id=5 Retirado:  retirado por la institucion
-- Referenciada por: usuarios.estado_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE estados (
  id     INT          AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60)  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
-- horarios
-- Turno academico del coder.
-- id=1 Manana
-- id=2 Tarde
-- Referenciada por: usuarios.horario_id (opcional)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE horarios (
  id     INT          AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60)  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
-- prioridades
-- Nivel de urgencia de una novedad, asignado automaticamente por IA.
-- id=1 Alta:  emergencias medicas, situaciones criticas
-- id=2 Media: citas programadas, tramites (valor por defecto si no hay IA)
-- id=3 Baja:  solicitudes no urgentes
-- Referenciada por: novedades.prioridad_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE prioridades (
  id                INT          AUTO_INCREMENT PRIMARY KEY,
  tipo_de_prioridad VARCHAR(50)  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLAS GESTIONABLES DESDE EL PANEL DE CONFIGURACION
-- El administrador puede crear, editar y eliminar estos registros
-- en tiempo real desde la interfaz, sin tocar la base de datos.
-- Endpoints: GET/POST/PUT/DELETE /api/catalogs/clanes
--            GET/POST/PUT/DELETE /api/catalogs/cohortes
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- clan
-- Agrupacion de coders dentro del bootcamp.
-- Ejemplos de nombres: Carthy, Tesla, Turing, Lovelace, Curie
-- Referenciada por: usuarios.clan_id
-- ON DELETE SET NULL: eliminar un clan no elimina los usuarios, solo les quita el clan
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE clan (
  id     INT           AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100)  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
-- cohorte
-- Promocion o generacion del bootcamp, identificada por numero entero.
-- El frontend muestra "Cohorte 1", "Cohorte 2", etc.
-- Referenciada por: usuarios.cohorte_id
-- ON DELETE SET NULL: eliminar cohorte no elimina usuarios
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE cohorte (
  id     INT  AUTO_INCREMENT PRIMARY KEY,
  numero INT  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLA PRINCIPAL: usuarios
-- Almacena administradores y coders.
-- role_id  determina permisos de acceso.
-- estado_id controla si el usuario puede iniciar sesion.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE usuarios (
  -- Clave primaria
  id                  INT           AUTO_INCREMENT PRIMARY KEY,

  -- Datos personales
  nombre              VARCHAR(100)  NOT NULL,
  apellido            VARCHAR(100)  NOT NULL,
  tipo_documento_id   INT,
  documento           VARCHAR(30)   NOT NULL UNIQUE,
  correo              VARCHAR(150)  NOT NULL UNIQUE,
  password            VARCHAR(255)  NOT NULL,        -- SIEMPRE hash bcrypt, nunca texto plano
  telefono            VARCHAR(20),
  avatar              VARCHAR(500),                  -- URL en Cloudinary (opcional)
  observaciones       TEXT,                          -- notas internas del administrador

  -- Perfil de acceso
  role_id             INT           NOT NULL,
  estado_id           INT           NOT NULL DEFAULT 2, -- 2=Inactivo: los nuevos quedan inactivos

  -- Asignacion academica (todos opcionales, NULL si no aplica)
  clan_id             INT,
  cohorte_id          INT,
  horario_id          INT,

  -- Recuperacion de contrasena por email
  -- reset_token:         token UUID de 32 bytes generado al pedir recuperacion
  -- reset_token_expires: expira 1 hora despues de generado
  -- Ambos se ponen en NULL despues de usarse o al crear nueva contrasena
  reset_token         VARCHAR(255),
  reset_token_expires DATETIME,

  -- Fecha de creacion (no se modifica)
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,

  -- ── Claves foraneas ────────────────────────────────────────────────────────
  CONSTRAINT fk_u_tipodoc  FOREIGN KEY (tipo_documento_id)
    REFERENCES tipos_documento(id) ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_u_role     FOREIGN KEY (role_id)
    REFERENCES roles(id) ON UPDATE CASCADE,
    -- Sin ON DELETE: no se puede borrar un rol que tenga usuarios

  CONSTRAINT fk_u_estado   FOREIGN KEY (estado_id)
    REFERENCES estados(id) ON UPDATE CASCADE,
    -- Sin ON DELETE: no se puede borrar un estado en uso

  CONSTRAINT fk_u_horario  FOREIGN KEY (horario_id)
    REFERENCES horarios(id) ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_u_clan     FOREIGN KEY (clan_id)
    REFERENCES clan(id) ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_u_cohorte  FOREIGN KEY (cohorte_id)
    REFERENCES cohorte(id) ON UPDATE CASCADE ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indices para acelerar consultas frecuentes
CREATE INDEX idx_u_correo    ON usuarios(correo);      -- login y busqueda por correo
CREATE INDEX idx_u_documento ON usuarios(documento);   -- busqueda por documento
CREATE INDEX idx_u_role      ON usuarios(role_id);     -- filtro por rol
CREATE INDEX idx_u_estado    ON usuarios(estado_id);   -- filtro por estado e inactivos


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLA PRINCIPAL: novedades
-- Cada registro es una solicitud de ausencia de un coder.
-- Flujo: pending → accepted o rejected
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE novedades (
  -- Clave primaria
  id              INT           AUTO_INCREMENT PRIMARY KEY,

  -- Usuario que genera la solicitud
  -- ON DELETE CASCADE: eliminar usuario elimina todas sus novedades
  student_id      INT           NOT NULL,

  -- Datos de la solicitud
  date_of_absence DATE          NOT NULL,   -- fecha de la ausencia (no del registro)
  reason          VARCHAR(120)  NOT NULL,   -- tipo: "Incapacidad medica", "Permiso", etc.
  excuse_text     TEXT,                     -- descripcion libre del coder
  excuse_url      VARCHAR(500),             -- URL del adjunto en Cloudinary (imagen o PDF)

  -- Estado de aprobacion
  -- pending  = nueva, esperando revision del administrador
  -- accepted = aprobada por el administrador
  -- rejected = rechazada por el administrador
  status          ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',

  -- Texto del administrador al aprobar o rechazar
  observacion     TEXT,

  -- Nivel de urgencia (asignado por IA al crear, Media si no hay IA configurada)
  prioridad_id    INT           NOT NULL DEFAULT 2,

  -- Auditoria
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- ── Claves foraneas ────────────────────────────────────────────────────────
  CONSTRAINT fk_nov_student   FOREIGN KEY (student_id)
    REFERENCES usuarios(id) ON DELETE CASCADE,

  CONSTRAINT fk_nov_prioridad FOREIGN KEY (prioridad_id)
    REFERENCES prioridades(id) ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indices para filtros del panel de novedades
CREATE INDEX idx_nov_student ON novedades(student_id);
CREATE INDEX idx_nov_status  ON novedades(status);
CREATE INDEX idx_nov_date    ON novedades(date_of_absence);

-- Reactivar FK
SET FOREIGN_KEY_CHECKS = 1;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DATOS INICIALES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO tipos_documento (id, nombre) VALUES
  (1, 'Cedula de Ciudadania'),
  (2, 'Tarjeta de Identidad'),
  (3, 'Pasaporte'),
  (4, 'Cedula de Extranjeria');

-- CRITICO: No cambiar los IDs de roles y estados.
-- El codigo backend los referencia por nombre pero los defaults usan ID.
INSERT INTO roles (id, nombre) VALUES
  (1, 'Administrador'),
  (2, 'Coder');

INSERT INTO estados (id, nombre) VALUES
  (1, 'Activo'),     -- unico estado que permite iniciar sesion
  (2, 'Inactivo'),   -- estado por defecto al registrarse
  (3, 'Egresado'),
  (4, 'Abandono'),
  (5, 'Retirado');

INSERT INTO horarios (id, nombre) VALUES
  (1, 'Manana'),
  (2, 'Tarde');

-- CRITICO: id=2 es Media, el valor por defecto cuando no hay IA configurada
INSERT INTO prioridades (id, tipo_de_prioridad) VALUES
  (1, 'Alta'),
  (2, 'Media'),
  (3, 'Baja');

-- Clanes iniciales (administrador puede agregar mas desde el panel)
INSERT INTO clan (id, nombre) VALUES
  (1, 'Carthy'),
  (2, 'Tesla'),
  (3, 'Turing'),
  (4, 'Lovelace'),
  (5, 'Curie');

-- Cohortes iniciales (administrador puede agregar mas desde el panel)
INSERT INTO cohorte (id, numero) VALUES
  (1, 1), (2, 2), (3, 3), (4, 4), (5, 5);


-- ═══════════════════════════════════════════════════════════════════════════════
-- USUARIO ADMINISTRADOR INICIAL
-- ───────────────────────────────────────────────────────────────────────────────
-- Correo:     admin@nova.com
-- Contrasena: 123456
-- Hash:       bcrypt rounds=10 generado con bcryptjs
--
-- Para usar una contrasena distinta desde el inicio:
--   1. Instalar dependencias: cd backend && npm install
--   2. Generar hash:
--      node -e "require('bcryptjs').hash('TuContrasena',10,(e,h)=>console.log(h));"
--   3. Reemplazar el valor del campo password abajo antes de ejecutar el script.
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO usuarios
  (id, nombre, apellido, tipo_documento_id, documento, correo, password, telefono, role_id, estado_id)
VALUES (
  1,
  'Administrador', 'Nova',
  1,
  '0000000001',
  'admin@nova.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '3000000000',
  1,  -- Administrador
  1   -- Activo
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICACION (ejecutar despues del script para confirmar)
-- ───────────────────────────────────────────────────────────────────────────────
-- SHOW TABLES;
-- SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
--   WHERE TABLE_SCHEMA = 'nova' ORDER BY TABLE_NAME;
-- SELECT id, correo, role_id, estado_id FROM usuarios;
-- ═══════════════════════════════════════════════════════════════════════════════
