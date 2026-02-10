/**
 * @fileoverview Dependency Injection Container
 * Level 1 Foundation - Architecture Excellence
 * 
 * Simple DI container for managing service dependencies.
 * Supports lazy initialization and singleton instances.
 */

import { logger, type Logger } from './logger'
import { db, testConnection, type Database } from '../database/connection'
import { getConfig, type EnvConfig } from '../config'

// =============================================================================
// Container Types
// =============================================================================

export interface Container {
  // Core services
  config: EnvConfig
  logger: Logger
  db: Database
  
  // Service getters (lazy loaded)
  getAuthService: () => Promise<AuthService>
  getUsersService: () => Promise<UsersService>
  getPropertiesService: () => Promise<PropertiesService>
  getClientsService: () => Promise<ClientsService>
  getDocumentsService: () => Promise<DocumentsService>
  
  // Lifecycle
  initialize: () => Promise<void>
  shutdown: () => Promise<void>
  isReady: () => boolean
}

// Forward declarations for services (to avoid circular imports)
type AuthService = import('../services/auth.service').AuthService
type UsersService = import('../services/users.service').UsersService
type PropertiesService = import('../services/properties.service').PropertiesService
type ClientsService = import('../services/clients.service').ClientsService
type DocumentsService = import('../services/documents.service').DocumentsService

// =============================================================================
// Container Implementation
// =============================================================================

let _initialized = false
let _ready = false

// Service singletons (lazy loaded)
let _authService: AuthService | null = null
let _usersService: UsersService | null = null
let _propertiesService: PropertiesService | null = null
let _clientsService: ClientsService | null = null
let _documentsService: DocumentsService | null = null

export const container: Container = {
  // Core services (eagerly available)
  get config() {
    return getConfig()
  },
  
  logger,
  db,
  
  // Service getters (lazy initialization)
  async getAuthService() {
    if (!_authService) {
      const { AuthService } = await import('../services/auth.service')
      _authService = new AuthService()
    }
    return _authService
  },
  
  async getUsersService() {
    if (!_usersService) {
      const { UsersService } = await import('../services/users.service')
      _usersService = new UsersService()
    }
    return _usersService
  },
  
  async getPropertiesService() {
    if (!_propertiesService) {
      const { PropertiesService } = await import('../services/properties.service')
      _propertiesService = new PropertiesService()
    }
    return _propertiesService
  },
  
  async getClientsService() {
    if (!_clientsService) {
      const { ClientsService } = await import('../services/clients.service')
      _clientsService = new ClientsService()
    }
    return _clientsService
  },
  
  async getDocumentsService() {
    if (!_documentsService) {
      const { DocumentsService } = await import('../services/documents.service')
      _documentsService = new DocumentsService()
    }
    return _documentsService
  },
  
  /**
   * Initialize container - verify database connection
   */
  async initialize() {
    if (_initialized) return
    
    const log = logger.child({ component: 'container' })
    
    try {
      log.info('Initializing container...')
      
      // Validate config first
      getConfig()
      log.debug('Configuration validated')
      
      // Test database connection
      await testConnection()
      log.info('Database connection verified')
      
      _initialized = true
      _ready = true
      
      log.info('Container initialized successfully')
    } catch (error) {
      log.error('Container initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },
  
  /**
   * Graceful shutdown - close connections
   */
  async shutdown() {
    const log = logger.child({ component: 'container' })
    
    try {
      log.info('Shutting down container...')
      _ready = false
      
      // Import and close the postgres client
      const { client } = await import('../database/connection')
      await client.end()
      
      log.info('Container shutdown complete')
    } catch (error) {
      log.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
  
  isReady() {
    return _ready
  },
}

// =============================================================================
// Graceful Shutdown Handler
// =============================================================================

const shutdownSignals = ['SIGTERM', 'SIGINT'] as const

for (const signal of shutdownSignals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, starting graceful shutdown...`)
    await container.shutdown()
    process.exit(0)
  })
}

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.fatal('Uncaught exception', { error: error.message, stack: error.stack })
  await container.shutdown()
  process.exit(1)
})

process.on('unhandledRejection', async (reason) => {
  logger.fatal('Unhandled rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason) 
  })
  await container.shutdown()
  process.exit(1)
})
