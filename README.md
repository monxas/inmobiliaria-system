# 🏠 Sistema de Gestión Inmobiliaria
**Self-hosted | NAS-optimized | LLM-ready**

> **Estado:** 📋 Documentación técnica en desarrollo  
> **Versión:** 0.1.0-planning  
> **Stack:** Bun + Hono + PostgreSQL + SvelteKit

---

## 🎯 NIVELES Y OBJETIVOS

### **Nivel 0 — Documentación Técnica** ✅ En progreso
- [ ] Sistema-spec actualizado con stack final
- [ ] Schema de base de datos completo (incluye imágenes propiedades)  
- [ ] Arquitectura de componentes reutilizables definida
- [ ] Guías para agentes de desarrollo
- [ ] Templates y convenciones establecidas

### **Nivel 1 — Fundación** 
- [ ] Docker compose funcional
- [ ] PostgreSQL + migraciones
- [ ] Bun + Hono básico con health checks
- [ ] Estructura de carpetas establecida
- [ ] CI/CD básico

### **Nivel 2 — Core API**
- [ ] Auth + JWT + roles
- [ ] CRUD base genérico reutilizable  
- [ ] Modelos usuarios/clientes/propiedades
- [ ] API documentada con OpenAPI
- [ ] Tests unitarios

### **Nivel 3 — Funcionalidad Esencial**
- [ ] Upload de documentos con tokens seguros
- [ ] Galería de imágenes de propiedades
- [ ] Frontend básico (login + listados)
- [ ] Notificaciones básicas

### **Nivel 4 — Preparación Producción**
- [ ] Monitoreo y logs
- [ ] Backups automatizados
- [ ] Deploy en NAS
- [ ] Performance optimización

### **Nivel 5 — LLM Integration**
- [ ] API para agentes IA
- [ ] Webhooks + dry-run mode
- [ ] Automatizaciones inteligentes

---

## 📁 ESTRUCTURA

```
inmobiliaria-system/
├── docs/                    # Documentación técnica
│   ├── TECH-SPEC.md        # Especificaciones técnicas actualizadas
│   ├── COMPONENTS.md       # Arquitectura componentes reutilizables
│   ├── DATABASE.md         # Schema y migraciones
│   ├── API-DESIGN.md       # Diseño API + OpenAPI
│   └── AGENTS-GUIDE.md     # Guías para agentes de desarrollo
├── backend/                # API Bun + Hono
├── frontend/               # SvelteKit frontend único
├── database/               # Migraciones y seeders
├── docker/                 # Docker configs
├── .github/workflows/      # CI/CD
└── scripts/               # Utilidades y deploy
```

---

## 🔧 METODOLOGÍA

**"Base Sólida" - Un nivel a la vez:**
1. **No pasar al siguiente nivel** hasta completar el actual
2. **Cada nivel tiene gate de validación**
3. **Componentes genéricos y reutilizables** desde el inicio  
4. **Documentación primero**, código después
5. **Testing integrado** desde Nivel 2

---

## 📋 ESTADO ACTUAL

**Trabajando en:** Nivel 0 - Documentación técnica  
**Último commit:** Repo inicial creado  
**Siguiente:** Arreglar inconsistencias detectadas por agentes de auditoría