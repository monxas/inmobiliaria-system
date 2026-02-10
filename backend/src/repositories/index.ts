/**
 * @fileoverview Repository exports.
 * 
 * @description
 * Repositories handle data access layer operations.
 * Each repository extends CRUDRepository for consistent patterns.
 */

export { CRUDRepository, type QueryOptions } from './base/crud.repository'
export { propertiesRepository, PropertiesRepository } from './properties.repository'
export { clientsRepository, ClientsRepository } from './clients.repository'
export { usersRepository, UsersRepository } from './users.repository'
export { documentsRepository, DocumentsRepository } from './documents.repository'
