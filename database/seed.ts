/**
 * Database seeder - inserts basic data for development
 * Usage: bun run database/seed.ts
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://app:password@localhost:5432/inmobiliaria';
const sql = postgres(DATABASE_URL);

async function seed() {
  console.log('🌱 Seeding database...\n');

  // 1. Admin user (password: admin123 - bcrypt hash)
  const adminHash = '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36zQKvTq0IqYJQ3xUJj3xC6'; // admin123
  
  await sql`
    INSERT INTO users (email, password_hash, role, full_name, phone)
    VALUES ('admin@inmobiliaria.local', ${adminHash}, 'admin', 'Administrador', '+34 600 000 000')
    ON CONFLICT (email) DO NOTHING
  `;
  console.log('✅ Admin user created');

  // 2. Sample agent
  const agentHash = '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36zQKvTq0IqYJQ3xUJj3xC6'; // admin123
  
  await sql`
    INSERT INTO users (email, password_hash, role, full_name, phone)
    VALUES ('agente@inmobiliaria.local', ${agentHash}, 'agent', 'María García', '+34 600 111 111')
    ON CONFLICT (email) DO NOTHING
  `;
  console.log('✅ Sample agent created');

  // 3. Sample properties
  const [agent] = await sql`SELECT id FROM users WHERE email = 'agente@inmobiliaria.local'`;
  
  await sql`
    INSERT INTO properties (title, description, address, city, postal_code, property_type, status, price, surface_area, bedrooms, bathrooms, garage, garden, agent_id)
    VALUES 
      ('Piso céntrico en Oviedo', 'Amplio piso de 3 habitaciones en pleno centro, luminoso y reformado. Cerca de todos los servicios.', 'Calle Uría 15, 3ºA', 'Oviedo', '33003', 'apartment', 'available', 250000.00, 95, 3, 2, false, false, ${agent.id}),
      ('Casa unifamiliar Gijón', 'Casa con jardín y garaje en zona residencial tranquila. Ideal para familias.', 'Avenida de la Costa 45', 'Gijón', '33201', 'house', 'available', 380000.00, 150, 4, 3, true, true, ${agent.id}),
      ('Local comercial Avilés', 'Local a pie de calle con gran escaparate. Zona comercial consolidada.', 'Calle La Cámara 8', 'Avilés', '33400', 'commercial', 'available', 120000.00, 80, 0, 1, false, false, ${agent.id}),
      ('Oficina centro Oviedo', 'Oficina moderna en edificio empresarial con parking.', 'Plaza de España 3, 5ºB', 'Oviedo', '33004', 'office', 'reserved', 185000.00, 60, 0, 1, true, false, ${agent.id})
    ON CONFLICT DO NOTHING
  `;
  console.log('✅ Sample properties created');

  // 4. Sample clients
  await sql`
    INSERT INTO clients (full_name, email, phone, notes, agent_id)
    VALUES 
      ('Carlos López', 'carlos@example.com', '+34 611 222 333', 'Busca piso en Oviedo, presupuesto 200-300k', ${agent.id}),
      ('Ana Martínez', 'ana@example.com', '+34 622 333 444', 'Interesada en casas con jardín en Gijón', ${agent.id}),
      ('Pedro Sánchez', 'pedro@example.com', '+34 633 444 555', 'Inversor, busca locales comerciales', ${agent.id})
    ON CONFLICT DO NOTHING
  `;
  console.log('✅ Sample clients created');

  // 5. Client-property relationships
  const [carlos] = await sql`SELECT id FROM clients WHERE email = 'carlos@example.com'`;
  const [ana] = await sql`SELECT id FROM clients WHERE email = 'ana@example.com'`;
  const props = await sql`SELECT id, title FROM properties ORDER BY id LIMIT 4`;

  if (carlos && ana && props.length >= 2) {
    await sql`
      INSERT INTO client_properties (client_id, property_id, relationship_type, notes)
      VALUES 
        (${carlos.id}, ${props[0].id}, 'viewing', 'Visita programada para la semana que viene'),
        (${ana.id}, ${props[1].id}, 'interested', 'Le interesa pero quiere negociar precio')
      ON CONFLICT DO NOTHING
    `;
    console.log('✅ Client-property relationships created');
  }

  // 6. Email templates
  await sql`
    INSERT INTO email_templates (template_key, subject_template, body_template)
    VALUES 
      ('document_link', 'Documento disponible: {{document_name}}', '<p>Su documento está disponible en: <a href="{{download_url}}">{{document_name}}</a></p><p>El enlace expira el {{expires_at}}.</p>'),
      ('welcome', 'Bienvenido a {{company_name}}', '<p>Bienvenido {{user_name}},</p><p>Su cuenta ha sido creada exitosamente.</p>'),
      ('viewing_confirmation', 'Confirmación de visita: {{property_title}}', '<p>Hola {{client_name}},</p><p>Su visita a {{property_title}} está confirmada para el {{viewing_date}} a las {{viewing_time}}.</p><p>Dirección: {{property_address}}</p>'),
      ('link_expiring', 'Su enlace expira pronto: {{document_name}}', '<p>El enlace para descargar {{document_name}} expirará en 24 horas.</p><p>Acceda ahora: <a href="{{download_url}}">Descargar</a></p>')
    ON CONFLICT (template_key) DO NOTHING
  `;
  console.log('✅ Email templates created');

  console.log('\n🌱 Seeding complete!');
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
