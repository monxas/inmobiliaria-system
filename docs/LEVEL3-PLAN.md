# 📋 LEVEL 3 - FRONTEND DASHBOARD PLAN

## 🎯 OBJETIVO
Implementar dashboard de administración SvelteKit funcional y conectado al backend.

## 📊 SCOPE & DELIVERABLES

### **Core Features (MUST HAVE)**
- [x] **Scaffolding SvelteKit** - Estructura base + componentes UI
- [ ] **Auth Frontend** - Login/logout + protected routes + JWT handling
- [ ] **Properties CRUD** - Lista, crear, editar, eliminar propiedades
- [ ] **Clients CRUD** - Gestión completa de clientes
- [ ] **File Upload** - Subida de imágenes + documentos con preview
- [ ] **Dashboard Home** - Métricas básicas + actividad reciente

### **Enhanced Features (SHOULD HAVE)**
- [ ] **Property Images** - Galería de fotos por propiedad
- [ ] **Document Sharing** - Links seguros + expiración
- [ ] **User Management** - Admin panel para usuarios/roles
- [ ] **Search & Filters** - Búsqueda avanzada propiedades/clientes
- [ ] **Responsive Design** - Mobile-first + desktop

### **Polish Features (NICE TO HAVE)**
- [ ] **Dark Mode** - Theme toggle + persistencia
- [ ] **Toast Notifications** - Feedback visual de acciones
- [ ] **Loading States** - Spinners + skeleton screens
- [ ] **Form Validation** - Client-side + error handling
- [ ] **Export Data** - CSV/PDF reports

## 🏗️ ARQUITECTURA FRONTEND

### **Stack Confirmado**
- **Framework:** SvelteKit (SSR + SPA hybrid)
- **Styling:** TailwindCSS + custom components
- **State:** Svelte stores + local state
- **API:** Fetch wrapper + TypeScript types
- **Build:** Vite + TypeScript strict

### **Folder Structure**
```
frontend/
├── src/
│   ├── routes/                 # SvelteKit file-based routing
│   │   ├── (auth)/            # Auth group layout
│   │   │   ├── login/         # Login page
│   │   │   └── register/      # Register page  
│   │   ├── (app)/             # Protected app layout
│   │   │   ├── dashboard/     # Dashboard home
│   │   │   ├── properties/    # Properties CRUD
│   │   │   ├── clients/       # Clients CRUD
│   │   │   └── users/         # User management
│   │   └── +layout.svelte     # Root layout
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/            # Base UI components (Button, Input, etc.)
│   │   │   ├── forms/         # Form components (PropertyForm, ClientForm)
│   │   │   └── layout/        # Layout components (Header, Sidebar)
│   │   ├── stores/            # Svelte stores (auth, theme, etc.)
│   │   ├── api/               # API client functions
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Helper functions
│   └── app.html               # HTML shell
└── static/                    # Static assets
```

### **Component Design System**

#### **Atoms (Base UI)**
- `Button.svelte` - Primary, secondary, danger variants
- `Input.svelte` - Text, email, password, file inputs
- `Badge.svelte` - Status, role, category badges
- `Card.svelte` - Container with header/body/footer
- `Modal.svelte` - Overlay dialogs + confirm actions
- `Toast.svelte` - Success/error notifications

#### **Molecules (Composed)**
- `FormField.svelte` - Input + label + validation error
- `DataTable.svelte` - Sortable table + pagination
- `FileUpload.svelte` - Drag & drop + preview + progress
- `PropertyCard.svelte` - Property thumbnail + key info
- `SearchBox.svelte` - Input + filters + clear

#### **Organisms (Complex)**  
- `PropertyForm.svelte` - Create/edit property form
- `ClientForm.svelte` - Create/edit client form
- `ImageGallery.svelte` - Multiple images + edit/delete
- `DocumentList.svelte` - File list + download/share
- `DashboardMetrics.svelte` - Cards with stats

## 🎨 FIGMA DESIGN REFERENCE

### **Design Status**
- **Source:** SwitchBot/Figma Make workflow  
- **Priority Screens:** Dashboard overview, Properties CRUD, Client management, Document upload, User settings
- **Style Reference:** Modern SaaS dashboards (Linear, Notion style) - clean, professional, real estate focused
- **Status:** ⏳ **PENDING DELIVERY** - Waiting for Figma mockups before UI implementation

### **Design Requirements Sent to Figma Make**
- **Target Users:** Admin, Real Estate Agents, Property Owners
- **Tech Stack Alignment:** SvelteKit + TailwindCSS aesthetic
- **Device Support:** Desktop-first, tablet responsive  
- **Color Palette:** Blues/grays for trust + accent colors for actions
- **Components:** Cards-based layout, generic CRUD tables, clean forms
- **Role-Based Views:** Admin (full access), Agent (limited), Client (read-only)

### **Implementation Strategy**
1. **Wait for Figma delivery** ⏳
2. **Extract design tokens** (colors, typography, spacing, components)
3. **Create Tailwind config** based on Figma design system
4. **Build component library** matching exact Figma components
5. **Implement layouts** screen by screen following mockups

**⚠️ CRITICAL:** No UI implementation should start until Figma mockups are delivered and reviewed.

---

## 🔌 API INTEGRATION

### **Auth Flow**
```typescript
// Login flow
1. POST /api/auth/login → {access_token, refresh_token}
2. Store tokens in httpOnly cookies (SvelteKit)
3. Interceptor adds Authorization header
4. Refresh token rotation on 401
5. Logout clears cookies + revokes tokens
```

### **CRUD Patterns**
```typescript
// Properties API client
export const propertiesApi = {
  async findAll(filters = {}) {
    const params = new URLSearchParams(filters)
    return api.get(`/properties?${params}`)
  },
  
  async findById(id: number) {
    return api.get(`/properties/${id}`)
  },
  
  async create(data: CreateProperty) {
    return api.post('/properties', data)
  },
  
  async update(id: number, data: UpdateProperty) {
    return api.put(`/properties/${id}`, data)
  },
  
  async delete(id: number) {
    return api.delete(`/properties/${id}`)
  }
}
```

### **File Upload Strategy**
```typescript
// Image upload for properties
1. Frontend: Resize/compress image (client-side)
2. Upload to /api/properties/:id/images (multipart)
3. Backend: Validate + store + thumbnail generation
4. Return image URLs + metadata
5. Frontend: Update UI + show thumbnails
```

## 📱 USER EXPERIENCE

### **Auth Experience**
- Login form with email/password + "Remember me"
- Protected routes redirect to login if unauthenticated
- Auto-logout after token expiration + warning
- Register form with role selection (admin-only)

### **Properties Management**
- Grid view + list view toggle
- Infinite scroll or pagination
- Quick filters (price range, status, agent)
- Bulk actions (delete, change status)
- Image gallery with lightbox
- Document attachments with icons

### **Navigation**
- Collapsible sidebar with icons + labels
- Breadcrumbs for deep navigation
- User menu (profile, settings, logout)
- Search global (properties + clients)

## 🧪 TESTING STRATEGY

### **Component Testing**
```typescript
// PropertyForm.test.ts
import { render, fireEvent } from '@testing-library/svelte'
import PropertyForm from './PropertyForm.svelte'

test('submits form with valid data', async () => {
  const { getByRole, getByLabelText } = render(PropertyForm)
  
  await fireEvent.input(getByLabelText('Title'), { target: { value: 'Test Property' } })
  await fireEvent.click(getByRole('button', { name: 'Save' }))
  
  // Assert API call made
})
```

### **E2E Testing**
```typescript  
// properties.e2e.ts
import { test, expect } from '@playwright/test'

test('can create new property', async ({ page }) => {
  await page.goto('/properties')
  await page.click('button:has-text("New Property")')
  await page.fill('[data-testid="property-title"]', 'Test Property')
  await page.click('button:has-text("Save")')
  
  await expect(page.locator('text=Property created')).toBeVisible()
})
```

## 🎨 DESIGN DECISIONS

### **Color Palette**
- Primary: Blue (#3B82F6) - actions, links
- Success: Green (#10B981) - confirmations  
- Warning: Yellow (#F59E0B) - alerts
- Danger: Red (#EF4444) - destructive actions
- Gray scale: Tailwind gray variants

### **Typography**
- Headings: Inter font, semibold
- Body: Inter font, regular
- Code: JetBrains Mono

### **Spacing & Layout**
- Container max-width: 1200px
- Grid: 12-column responsive
- Spacing scale: Tailwind default (0.25rem increments)
- Border radius: 0.375rem (rounded-md)

## 🚀 DEVELOPMENT WORKFLOW

### **Phase 1: Design Foundation (Week 1)**
1. **⏳ ESPERANDO:** Figma mockups del workflow SwitchBot/Figma Make  
2. Setup SvelteKit project + TailwindCSS (⚠️ Alineado con designs)
3. Implement auth flow (login/logout/protected routes)
4. Build base UI components siguiendo Figma design system
5. Create layout structure (Sidebar, Header) según mockups

### **Phase 2: CRUD Features (Week 2)**
1. Properties CRUD pages + forms (siguiendo Figma screens)
2. Clients CRUD pages + forms (siguiendo Figma screens) 
3. API integration + error handling
4. Basic file upload functionality según mockups

### **Phase 3: Enhanced UX (Week 3)**
1. Dashboard metrics + charts
2. Advanced search & filters
3. Image gallery + lightbox
4. Document sharing interface

### **Phase 4: Polish & Testing (Week 4)**
1. Responsive design refinement
2. Loading states + error boundaries
3. Component tests + E2E tests
4. Performance optimization

## 📋 ACCEPTANCE CRITERIA

### **Functionality**
- [ ] All CRUD operations work end-to-end
- [ ] Authentication flow secure + UX smooth
- [ ] File uploads work with progress indication
- [ ] Search & filtering responsive <500ms
- [ ] Mobile experience usable on 320px+ screens

### **Code Quality** 
- [ ] TypeScript strict mode - 0 errors
- [ ] Component tests >80% coverage
- [ ] E2E tests cover critical paths
- [ ] Accessibility WCAG 2.1 AA compliance
- [ ] Performance: LCP <2.5s, FID <100ms

### **UX Polish**
- [ ] Loading states on all async actions
- [ ] Error handling with clear messages
- [ ] Toast notifications for feedback
- [ ] Keyboard navigation works
- [ ] Dark mode toggle functional

---

## 📞 SUPPORT & ESCALATION

**Technical Issues:**
- Check `docs/TROUBLESHOOTING.md`
- Review backend API docs in OpenAPI
- Test API endpoints with curl/Postman

**Architecture Questions:**
- Follow patterns in `docs/AGENTS-GUIDE.md`
- Maintain component reusability
- Keep business logic in stores, not components

**Performance Concerns:**
- Lazy load images + components
- Implement virtual scrolling for large lists
- Use SvelteKit's built-in performance features

---

**Target Completion:** 2026-02-25  
**Level 3 Score Goal:** 9.5/10  
**Next Level:** Level 4 - Production Deployment