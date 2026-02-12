const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ============================================
// Auth endpoints
// ============================================

app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    data: {
      accessToken: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
      user: { id: 1, email: 'admin@test.com', fullName: 'Admin User', role: 'admin', createdAt: '2024-01-01T00:00:00Z' }
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, fullName } = req.body || {};
  res.json({
    success: true,
    data: {
      accessToken: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
      user: { id: 2, email: email || 'new@test.com', fullName: fullName || 'New User', role: 'agent', createdAt: '2024-01-01T00:00:00Z' }
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  res.json({
    success: true,
    data: { id: 1, email: 'admin@test.com', fullName: 'Admin User', role: 'admin', createdAt: '2024-01-01T00:00:00Z' }
  });
});

app.put('/api/auth/me', (req, res) => {
  res.json({ success: true, data: { id: 1, email: 'admin@test.com', fullName: 'Admin User', role: 'admin', createdAt: '2024-01-01T00:00:00Z', ...req.body } });
});

app.post('/api/auth/refresh', (req, res) => {
  res.json({ success: true, data: { accessToken: 'mock-jwt-token-refreshed', refreshToken: 'mock-refresh-token-2' } });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.post('/api/auth/logout-all', (req, res) => {
  res.json({ success: true });
});

app.get('/api/auth/sessions', (req, res) => {
  res.json({ success: true, data: [] });
});

// ============================================
// Properties
// ============================================

const properties = [
  { id: 1, title: 'Piso Centro Madrid', description: 'Amplio piso en pleno centro', address: 'C/ Mayor 123', city: 'Madrid', postalCode: '28013', country: 'España', propertyType: 'apartment', status: 'available', price: '250000', surfaceArea: 120, bedrooms: 3, bathrooms: 2, garage: false, garden: false, ownerId: null, agentId: 1, createdAt: '2024-01-15T00:00:00Z' },
  { id: 2, title: 'Casa Unifamiliar Pozuelo', description: 'Casa con jardín privado', address: 'Av. Europa 456', city: 'Pozuelo', postalCode: '28223', country: 'España', propertyType: 'house', status: 'available', price: '450000', surfaceArea: 250, bedrooms: 4, bathrooms: 3, garage: true, garden: true, ownerId: null, agentId: 1, createdAt: '2024-01-20T00:00:00Z' },
  { id: 3, title: 'Ático Malasaña', description: 'Ático con terraza', address: 'C/ Fuencarral 78', city: 'Madrid', postalCode: '28004', country: 'España', propertyType: 'penthouse', status: 'sold', price: '380000', surfaceArea: 95, bedrooms: 2, bathrooms: 1, garage: false, garden: false, ownerId: null, agentId: 1, createdAt: '2024-02-01T00:00:00Z' },
  { id: 4, title: 'Local Comercial Sol', description: 'Local en zona prime', address: 'Puerta del Sol 5', city: 'Madrid', postalCode: '28013', country: 'España', propertyType: 'commercial', status: 'rented', price: '3500', surfaceArea: 80, bedrooms: 0, bathrooms: 1, garage: false, garden: false, ownerId: null, agentId: 1, createdAt: '2024-02-10T00:00:00Z' },
  { id: 5, title: 'Chalet La Moraleja', description: 'Chalet de lujo', address: 'C/ Los Tilos 12', city: 'Alcobendas', postalCode: '28109', country: 'España', propertyType: 'house', status: 'available', price: '1200000', surfaceArea: 500, bedrooms: 6, bathrooms: 5, garage: true, garden: true, ownerId: null, agentId: 1, createdAt: '2024-02-15T00:00:00Z' },
];

app.get('/api/properties', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  const paginated = properties.slice(start, start + limit);
  res.json({
    success: true,
    data: paginated,
    pagination: { total: properties.length, page, limit, totalPages: Math.ceil(properties.length / limit) }
  });
});

app.get('/api/properties/:id', (req, res) => {
  const p = properties.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: p });
});

app.post('/api/properties', (req, res) => {
  const newProp = { id: properties.length + 1, ...req.body, createdAt: new Date().toISOString() };
  properties.push(newProp);
  res.status(201).json({ success: true, data: newProp });
});

app.put('/api/properties/:id', (req, res) => {
  const p = properties.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ success: false, error: 'Not found' });
  Object.assign(p, req.body);
  res.json({ success: true, data: p });
});

app.delete('/api/properties/:id', (req, res) => {
  const idx = properties.findIndex(x => x.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
  properties.splice(idx, 1);
  res.json({ success: true, data: null });
});

// ============================================
// Clients
// ============================================

const clients = [
  { id: 1, fullName: 'Juan Pérez García', email: 'juan@email.com', phone: '+34600123456', address: 'C/ Alcalá 100, Madrid', notes: 'Interesado en pisos céntricos', agentId: 1, createdAt: '2024-01-10T00:00:00Z' },
  { id: 2, fullName: 'María García López', email: 'maria@email.com', phone: '+34600654321', address: 'Av. Castellana 50, Madrid', notes: 'Busca casa con jardín', agentId: 1, createdAt: '2024-01-12T00:00:00Z' },
  { id: 3, fullName: 'Carlos Rodríguez', email: 'carlos@email.com', phone: '+34600111222', address: null, notes: 'Inversor - busca locales', agentId: 1, createdAt: '2024-01-20T00:00:00Z' },
  { id: 4, fullName: 'Ana Martínez Sánchez', email: 'ana@email.com', phone: '+34600333444', address: 'C/ Gran Vía 30', notes: null, agentId: 1, createdAt: '2024-02-01T00:00:00Z' },
];

app.get('/api/clients', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  const paginated = clients.slice(start, start + limit);
  res.json({
    success: true,
    data: paginated,
    pagination: { total: clients.length, page, limit, totalPages: Math.ceil(clients.length / limit) }
  });
});

app.get('/api/clients/:id', (req, res) => {
  const c = clients.find(x => x.id === parseInt(req.params.id));
  if (!c) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: c });
});

app.post('/api/clients', (req, res) => {
  const newClient = { id: clients.length + 1, ...req.body, createdAt: new Date().toISOString() };
  clients.push(newClient);
  res.status(201).json({ success: true, data: newClient });
});

app.put('/api/clients/:id', (req, res) => {
  const c = clients.find(x => x.id === parseInt(req.params.id));
  if (!c) return res.status(404).json({ success: false, error: 'Not found' });
  Object.assign(c, req.body);
  res.json({ success: true, data: c });
});

app.delete('/api/clients/:id', (req, res) => {
  const idx = clients.findIndex(x => x.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
  clients.splice(idx, 1);
  res.json({ success: true, data: null });
});

// ============================================
// Users (admin)
// ============================================

const users = [
  { id: 1, email: 'admin@test.com', fullName: 'Admin User', role: 'admin', createdAt: '2024-01-01T00:00:00Z' },
  { id: 2, email: 'agent1@test.com', fullName: 'Carlos Agente', role: 'agent', createdAt: '2024-01-05T00:00:00Z' },
  { id: 3, email: 'agent2@test.com', fullName: 'Laura Agente', role: 'agent', createdAt: '2024-01-08T00:00:00Z' },
];

app.get('/api/users', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  const paginated = users.slice(start, start + limit);
  res.json({
    success: true,
    data: paginated,
    pagination: { total: users.length, page, limit, totalPages: Math.ceil(users.length / limit) }
  });
});

app.get('/api/users/:id', (req, res) => {
  const u = users.find(x => x.id === parseInt(req.params.id));
  if (!u) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: u });
});

app.post('/api/users', (req, res) => {
  const newUser = { id: users.length + 1, ...req.body, createdAt: new Date().toISOString() };
  users.push(newUser);
  res.status(201).json({ success: true, data: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const u = users.find(x => x.id === parseInt(req.params.id));
  if (!u) return res.status(404).json({ success: false, error: 'Not found' });
  Object.assign(u, req.body);
  res.json({ success: true, data: u });
});

app.delete('/api/users/:id', (req, res) => {
  const idx = users.findIndex(x => x.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
  users.splice(idx, 1);
  res.json({ success: true, data: null });
});

// ============================================
// Documents
// ============================================

const documents = [
  { id: 1, filename: 'contrato_juan_perez.pdf', originalFilename: 'Contrato_Juan_Perez.pdf', filePath: '/uploads/contrato_juan_perez.pdf', fileSize: 1024000, mimeType: 'application/pdf', category: 'contract', propertyId: 1, clientId: 1, createdAt: '2024-01-15T00:00:00Z' },
  { id: 2, filename: 'tasacion_piso_centro.pdf', originalFilename: 'Tasacion_Piso_Centro.pdf', filePath: '/uploads/tasacion_piso_centro.pdf', fileSize: 2048000, mimeType: 'application/pdf', category: 'appraisal', propertyId: 1, clientId: null, createdAt: '2024-01-20T00:00:00Z' },
  { id: 3, filename: 'escritura_casa.pdf', originalFilename: 'Escritura_Casa_Pozuelo.pdf', filePath: '/uploads/escritura_casa.pdf', fileSize: 3072000, mimeType: 'application/pdf', category: 'deed', propertyId: 2, clientId: 2, createdAt: '2024-02-01T00:00:00Z' },
];

app.get('/api/documents', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  const paginated = documents.slice(start, start + limit);
  res.json({
    success: true,
    data: paginated,
    pagination: { total: documents.length, page, limit, totalPages: Math.ceil(documents.length / limit) }
  });
});

app.get('/api/documents/:id', (req, res) => {
  const d = documents.find(x => x.id === parseInt(req.params.id));
  if (!d) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: d });
});

app.delete('/api/documents/:id', (req, res) => {
  const idx = documents.findIndex(x => x.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
  documents.splice(idx, 1);
  res.json({ success: true, data: null });
});

// ============================================
// Health
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

app.listen(3000, () => console.log('🎭 Mock backend running on port 3000 - Full API support'));
