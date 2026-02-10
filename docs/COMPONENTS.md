# 🧩 COMPONENTS ARCHITECTURE
**Componentes genéricos reutilizables del sistema inmobiliaria**

---

## 🎯 FILOSOFÍA

**"Write Once, Use Everywhere"**
- Componentes genéricos que sirvan para: Users, Properties, Clients, Documents
- Type-safe con TypeScript + templates
- Consistencia en UX/DX across todo el sistema
- Preparados para scaling (más entidades en el futuro)

---

## 🏗️ BACKEND COMPONENTS

### **1. Generic CRUD Controller**
```typescript
// src/controllers/base/crud.controller.ts
export abstract class CRUDController<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TFilters = Record<string, any>
> {
  abstract service: CRUDService<TEntity, TCreateInput, TUpdateInput, TFilters>
  
  // GET /resources
  async findAll(c: Context) {
    const filters = this.parseFilters(c.req.query())
    const page = Number(c.req.query('page')) || 1
    const limit = Math.min(Number(c.req.query('limit')) || 10, 100)
    
    try {
      const result = await this.service.findAll(filters, { page, limit })
      return c.json(apiResponse(result.data, {
        pagination: result.pagination
      }))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch resources')
    }
  }
  
  // GET /resources/:id  
  async findById(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)
    
    try {
      const data = await this.service.findById(id)
      if (!data) return c.json(apiError('Resource not found', 404), 404)
      return c.json(apiResponse(data))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch resource')
    }
  }
  
  // POST /resources
  async create(c: Context) {
    try {
      const input = await c.req.json()
      const validatedInput = this.validateCreateInput(input)
      const data = await this.service.create(validatedInput)
      return c.json(apiResponse(data), 201)
    } catch (error) {
      return this.handleError(c, error, 'Failed to create resource')
    }
  }
  
  // PUT /resources/:id
  async update(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)
    
    try {
      const input = await c.req.json()
      const validatedInput = this.validateUpdateInput(input)
      const data = await this.service.update(id, validatedInput)
      return c.json(apiResponse(data))
    } catch (error) {
      return this.handleError(c, error, 'Failed to update resource')
    }
  }
  
  // DELETE /resources/:id
  async delete(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)
    
    try {
      await this.service.delete(id)
      return c.json(apiResponse({ id, deleted: true }))
    } catch (error) {
      return this.handleError(c, error, 'Failed to delete resource')
    }
  }
  
  // Abstract methods — cada controller implementa
  protected abstract validateCreateInput(input: any): TCreateInput
  protected abstract validateUpdateInput(input: any): TUpdateInput
  protected abstract parseFilters(query: Record<string, string>): TFilters
  
  protected handleError(c: Context, error: any, defaultMessage: string) {
    if (error instanceof ValidationError) {
      return c.json(apiError(error.message, 400, error.details), 400)
    }
    if (error instanceof NotFoundError) {
      return c.json(apiError(error.message, 404), 404)
    }
    
    console.error(`${this.constructor.name}:`, error)
    return c.json(apiError(defaultMessage, 500), 500)
  }
}
```

### **2. Generic Service Layer**
```typescript
// src/services/base/crud.service.ts
export abstract class CRUDService<
  TEntity,
  TCreateInput,
  TUpdateInput, 
  TFilters = Record<string, any>
> {
  abstract repository: CRUDRepository<TEntity>
  
  async findAll(
    filters: TFilters,
    pagination: { page: number; limit: number }
  ): Promise<PaginatedResult<TEntity>> {
    const processedFilters = this.processFilters(filters)
    const offset = (pagination.page - 1) * pagination.limit
    
    const [data, total] = await Promise.all([
      this.repository.findMany(processedFilters, pagination.limit, offset),
      this.repository.count(processedFilters)
    ])
    
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit)
      }
    }
  }
  
  async findById(id: number): Promise<TEntity | null> {
    return this.repository.findById(id)
  }
  
  async create(input: TCreateInput): Promise<TEntity> {
    const processedInput = await this.processCreateInput(input)
    return this.repository.create(processedInput)
  }
  
  async update(id: number, input: TUpdateInput): Promise<TEntity> {
    const existing = await this.findById(id)
    if (!existing) throw new NotFoundError('Resource not found')
    
    const processedInput = await this.processUpdateInput(input, existing)
    return this.repository.update(id, processedInput)
  }
  
  async delete(id: number): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) throw new NotFoundError('Resource not found')
    
    await this.repository.delete(id)
  }
  
  // Hook methods — override si necesitas custom logic
  protected processFilters(filters: TFilters): Record<string, any> {
    return filters as Record<string, any>
  }
  
  protected async processCreateInput(input: TCreateInput): Promise<TCreateInput> {
    return input
  }
  
  protected async processUpdateInput(
    input: TUpdateInput, 
    existing: TEntity
  ): Promise<TUpdateInput> {
    return input
  }
}
```

### **3. Generic Repository**
```typescript
// src/repositories/base/crud.repository.ts
export abstract class CRUDRepository<TEntity> {
  abstract table: PgTableWithColumns<any>
  abstract db: Database
  
  async findMany(
    filters: Record<string, any> = {},
    limit: number = 10,
    offset: number = 0
  ): Promise<TEntity[]> {
    let query = this.db.select().from(this.table).limit(limit).offset(offset)
    
    // Apply filters
    if (Object.keys(filters).length > 0) {
      query = query.where(this.buildWhereClause(filters))
    }
    
    // Apply soft delete filter
    if (this.hasSoftDelete) {
      query = query.where(isNull(this.table.deleted_at))
    }
    
    return query
  }
  
  async findById(id: number): Promise<TEntity | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1)
    
    return result[0] || null
  }
  
  async create(data: any): Promise<TEntity> {
    const result = await this.db
      .insert(this.table)
      .values(data)
      .returning()
    
    return result[0]
  }
  
  async update(id: number, data: any): Promise<TEntity> {
    const result = await this.db
      .update(this.table)
      .set({ ...data, updated_at: new Date() })
      .where(eq(this.table.id, id))
      .returning()
    
    return result[0]
  }
  
  async delete(id: number): Promise<void> {
    if (this.hasSoftDelete) {
      await this.db
        .update(this.table)
        .set({ deleted_at: new Date() })
        .where(eq(this.table.id, id))
    } else {
      await this.db
        .delete(this.table)
        .where(eq(this.table.id, id))
    }
  }
  
  async count(filters: Record<string, any> = {}): Promise<number> {
    let query = this.db.select({ count: sql`count(*)` }).from(this.table)
    
    if (Object.keys(filters).length > 0) {
      query = query.where(this.buildWhereClause(filters))
    }
    
    if (this.hasSoftDelete) {
      query = query.where(isNull(this.table.deleted_at))
    }
    
    const result = await query
    return Number(result[0].count)
  }
  
  // Implementar en cada repository
  protected abstract buildWhereClause(filters: Record<string, any>): SQL
  protected get hasSoftDelete(): boolean { return true }
}
```

### **4. Auth & Permission Middleware**
```typescript
// src/middleware/auth.ts
export const requireAuth = () => async (c: Context, next: Next) => {
  const token = extractToken(c)
  if (!token) return c.json(apiError('Authentication required', 401), 401)
  
  try {
    const payload = verifyJWT(token)
    const user = await userService.findById(payload.userId)
    if (!user) return c.json(apiError('User not found', 401), 401)
    
    c.set('user', user)
    await next()
  } catch (error) {
    return c.json(apiError('Invalid token', 401), 401)
  }
}

export const requireRole = (allowedRoles: UserRole[]) => async (c: Context, next: Next) => {
  const user = c.get('user')
  if (!user) return c.json(apiError('Authentication required', 401), 401)
  
  if (!allowedRoles.includes(user.role)) {
    return c.json(apiError('Insufficient permissions', 403), 403)
  }
  
  await next()
}

export const requireOwnership = (resourceField: string = 'id') => 
  async (c: Context, next: Next) => {
    const user = c.get('user')
    const resourceId = c.req.param(resourceField)
    
    // Admin can access everything
    if (user.role === 'admin') {
      await next()
      return
    }
    
    // Check ownership logic aquí
    // Implementation depends on resource type
    await next()
  }
```

### **5. File Manager Component**
```typescript
// src/utils/file-manager.ts
export class FileManager {
  constructor(
    private storage: StorageProvider,
    private config: FileManagerConfig
  ) {}
  
  async upload(
    file: File,
    category: FileCategory,
    metadata: UploadMetadata = {}
  ): Promise<FileRecord> {
    // Validate file
    this.validateFile(file, category)
    
    // Generate secure filename
    const filename = this.generateSecureFilename(file.name)
    const filepath = path.join(category, filename)
    
    // Store file
    await this.storage.store(filepath, file)
    
    // Create database record
    const fileRecord = await fileRepository.create({
      filename: file.name,
      file_path: filepath,
      mime_type: file.type,
      file_size: file.size,
      category,
      ...metadata
    })
    
    return fileRecord
  }
  
  generateSecureToken(fileId: number, expiresIn: string = '24h'): string {
    const payload = {
      fileId,
      exp: Math.floor(Date.now() / 1000) + this.parseExpiry(expiresIn)
    }
    return jwt.sign(payload, this.config.secretKey)
  }
  
  async getByToken(token: string): Promise<FileRecord | null> {
    try {
      const payload = jwt.verify(token, this.config.secretKey) as any
      return await fileRepository.findById(payload.fileId)
    } catch (error) {
      return null
    }
  }
  
  private validateFile(file: File, category: FileCategory) {
    const config = this.config.categories[category]
    
    // Check size
    if (file.size > config.maxSize) {
      throw new ValidationError('file_size', `File too large (max ${config.maxSize} bytes)`)
    }
    
    // Check MIME type
    if (!config.allowedTypes.includes(file.type)) {
      throw new ValidationError('mime_type', `Invalid file type: ${file.type}`)
    }
    
    // Additional validation per category
    if (category === 'images' && !file.type.startsWith('image/')) {
      throw new ValidationError('file_type', 'Only images allowed in this category')
    }
  }
}
```

---

## 🎨 FRONTEND COMPONENTS

### **1. Generic CRUD Table**
```svelte
<!-- src/lib/components/organisms/CRUDTable.svelte -->
<script lang="ts" generics="T">
  export let items: T[]
  export let columns: TableColumn<T>[]
  export let actions: TableAction<T>[] = []
  export let loading = false
  export let pagination: PaginationData | null = null
  
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher<{
    action: { action: string; item: T }
    pageChange: number
  }>()
</script>

<div class="crud-table">
  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <table class="table">
      <thead>
        <tr>
          {#each columns as column}
            <th>{column.label}</th>
          {/each}
          {#if actions.length > 0}
            <th>Actions</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each items as item}
          <tr>
            {#each columns as column}
              <td>
                {#if column.render}
                  {@html column.render(item)}
                {:else}
                  {item[column.field]}
                {/if}
              </td>
            {/each}
            {#if actions.length > 0}
              <td class="actions">
                {#each actions as action}
                  <button 
                    class="btn btn-{action.variant || 'secondary'}"
                    on:click={() => dispatch('action', { action: action.key, item })}
                  >
                    {action.label}
                  </button>
                {/each}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
    
    {#if pagination}
      <Pagination 
        current={pagination.page}
        total={pagination.pages}
        on:change={(e) => dispatch('pageChange', e.detail)}
      />
    {/if}
  {/if}
</div>
```

### **2. Generic CRUD Form**
```svelte
<!-- src/lib/components/organisms/CRUDForm.svelte -->
<script lang="ts" generics="T">
  export let schema: z.ZodSchema<T>
  export let initialData: Partial<T> = {}
  export let mode: 'create' | 'edit' = 'create'
  export let loading = false
  
  import { createForm } from 'svelte-forms-lib'
  import { z } from 'zod'
  
  const { form, errors, handleSubmit } = createForm<T>({
    initialValues: initialData,
    validationSchema: schema.parse,
    onSubmit: (values) => {
      dispatch('submit', values)
    }
  })
  
  // Auto-generate form fields based on schema
  $: fields = generateFormFields(schema)
</script>

<form on:submit={handleSubmit}>
  {#each fields as field}
    <FormField
      {field}
      bind:value={$form[field.name]}
      error={$errors[field.name]}
    />
  {/each}
  
  <div class="form-actions">
    <button type="submit" class="btn btn-primary" disabled={loading}>
      {mode === 'create' ? 'Create' : 'Update'}
    </button>
    <button type="button" class="btn btn-secondary" on:click={() => dispatch('cancel')}>
      Cancel
    </button>
  </div>
</form>
```

### **3. File Upload Component**
```svelte
<!-- src/lib/components/molecules/FileUpload.svelte -->
<script lang="ts">
  export let accept = '*/*'
  export let multiple = false
  export let maxSize = 10 * 1024 * 1024 // 10MB
  export let category: FileCategory
  
  let fileInput: HTMLInputElement
  let dragover = false
  
  async function handleFiles(files: FileList) {
    for (const file of Array.from(files)) {
      try {
        const result = await fileManager.upload(file, category)
        dispatch('uploaded', result)
      } catch (error) {
        dispatch('error', error.message)
      }
    }
  }
</script>

<div 
  class="file-upload"
  class:dragover
  on:dragover|preventDefault={() => dragover = true}
  on:dragleave={() => dragover = false}
  on:drop|preventDefault={(e) => {
    dragover = false
    handleFiles(e.dataTransfer.files)
  }}
>
  <input 
    bind:this={fileInput}
    type="file"
    {accept}
    {multiple}
    on:change={(e) => handleFiles(e.target.files)}
    hidden
  />
  
  <div class="upload-area" on:click={() => fileInput.click()}>
    <svg><!-- Upload icon --></svg>
    <p>Drag & drop files here or click to browse</p>
  </div>
</div>
```

---

## 📝 USAGE EXAMPLES

### **Backend — Properties Controller**
```typescript
// src/controllers/properties.controller.ts
export class PropertiesController extends CRUDController<
  Property,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilters
> {
  constructor(
    public service: PropertiesService
  ) {
    super()
  }
  
  protected validateCreateInput(input: any): CreatePropertyInput {
    return createPropertySchema.parse(input)
  }
  
  protected validateUpdateInput(input: any): UpdatePropertyInput {
    return updatePropertySchema.parse(input)
  }
  
  protected parseFilters(query: Record<string, string>): PropertyFilters {
    return {
      search: query.search,
      property_type: query.property_type,
      min_price: query.min_price ? Number(query.min_price) : undefined,
      max_price: query.max_price ? Number(query.max_price) : undefined,
    }
  }
}
```

### **Frontend — Properties List Page**
```svelte
<!-- src/routes/admin/properties/+page.svelte -->
<script lang="ts">
  import CRUDTable from '$lib/components/organisms/CRUDTable.svelte'
  import type { Property } from '$lib/types'
  
  const columns = [
    { field: 'title', label: 'Title' },
    { field: 'address', label: 'Address' },
    { field: 'price', label: 'Price', render: (item) => `€${item.price}` },
    { field: 'status', label: 'Status' }
  ]
  
  const actions = [
    { key: 'edit', label: 'Edit', variant: 'primary' },
    { key: 'delete', label: 'Delete', variant: 'danger' }
  ]
  
  async function handleAction(event) {
    const { action, item } = event.detail
    
    switch (action) {
      case 'edit':
        goto(`/admin/properties/${item.id}/edit`)
        break
      case 'delete':
        if (confirm('Delete this property?')) {
          await api.properties.delete(item.id)
          // Refresh list
        }
        break
    }
  }
</script>

<CRUDTable 
  {items}
  {columns}
  {actions}
  {loading}
  {pagination}
  on:action={handleAction}
  on:pageChange={handlePageChange}
/>
```

---

## 🎯 BENEFITS

### **Consistency**
- Misma UX en todas las secciones (properties, clients, users)
- Mismo patrón de API responses
- Error handling uniforme

### **Speed**
- Nueva entity = extend base classes + define schema
- No reescribir CRUD logic
- Templates disponibles

### **Maintainability**  
- Fix bugs en un lugar → funciona everywhere
- Easy to add features (pagination, filtering, sorting)
- Type-safe end-to-end

### **Scalability**
- Add new entities fácilmente
- Consistent API for LLM agents
- Ready for multi-tenant

---

**Versión:** 1.0  
**Última actualización:** 2026-02-10  
**Status:** Template completo para implementación