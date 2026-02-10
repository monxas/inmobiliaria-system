# 📝 TEMPLATES

Templates para agentes desarrolladores — seguir estos patrones exactamente.

## 🎯 USO

Cada template está diseñado para mantener consistencia en:
- Estructura de código
- Naming conventions  
- Type safety
- Error handling
- Testing patterns

## 📁 ESTRUCTURA

```
templates/
├── backend/
│   ├── controller.template.ts
│   ├── service.template.ts
│   ├── repository.template.ts
│   └── test.template.ts
├── frontend/
│   ├── page.template.svelte
│   ├── component.template.svelte
│   └── api.template.ts
└── database/
    ├── migration.template.sql
    └── seed.template.sql
```

## ⚡ QUICK START

```bash
# Copia template y renombra
cp templates/backend/controller.template.ts src/controllers/new-controller.ts

# Reemplaza placeholders
# {{EntityName}} → PropertiesController
# {{entityName}} → propertiesController  
# {{entity}} → property
```

**Próximo:** Templates se añadirán en Nivel 1 - Foundation