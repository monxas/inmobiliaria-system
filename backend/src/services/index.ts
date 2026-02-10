/**
 * @fileoverview Service exports.
 * 
 * @description
 * Services handle business logic between controllers and repositories.
 * Each service extends CRUDService for consistent patterns.
 */

export { CRUDService } from './base/crud.service'
export { propertiesService, type PropertiesService } from './properties.service'
export { clientsService, type ClientsService } from './clients.service'
export { usersService, type UsersService, type SafeUser } from './users.service'
export { documentsService, type DocumentsService } from './documents.service'
