/**
 * @fileoverview WhatsApp Service using whatsapp-web.js
 * Handles session management, message sending, and template rendering
 */

import { logger } from '../lib/logger'
import { container } from '../lib/container'
import { EventEmitter } from 'events'

// =============================================================================
// Types
// =============================================================================

export interface WhatsAppStatus {
  connected: boolean
  phoneNumber?: string
  qrCode?: string  // Base64 QR for initial pairing
  state: 'disconnected' | 'connecting' | 'qr_pending' | 'connected' | 'error'
  lastError?: string
}

export interface WhatsAppMessage {
  to: string          // Phone number with country code (e.g., "34612345678")
  message: string
  mediaUrl?: string   // Optional image/document URL
  mediaCaption?: string
}

export interface MessageResult {
  success: boolean
  messageId?: string
  error?: string
  timestamp?: Date
}

interface TemplateVars {
  [key: string]: string | number | undefined
}

// =============================================================================
// WhatsApp Client Wrapper
// =============================================================================

class WhatsAppService extends EventEmitter {
  private client: any = null
  private _status: WhatsAppStatus = { connected: false, state: 'disconnected' }
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private messageQueue: Array<{ msg: WhatsAppMessage; resolve: (r: MessageResult) => void }> = []
  private processing = false

  get status(): WhatsAppStatus {
    return { ...this._status }
  }

  /**
   * Initialize WhatsApp client with whatsapp-web.js
   */
  async initialize(): Promise<void> {
    if (this.client) {
      logger.warn('WhatsApp client already initialized')
      return
    }

    try {
      this._status = { connected: false, state: 'connecting' }
      
      // Dynamic import to avoid issues if not installed
      const { Client, LocalAuth } = await import('whatsapp-web.js')
      
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: '/app/data/whatsapp-sessions' }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--single-process',
            '--disable-gpu',
          ],
        },
      })

      this.setupEventHandlers()
      await this.client.initialize()
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('WhatsApp initialization failed', { error: msg })
      this._status = { connected: false, state: 'error', lastError: msg }
      this.scheduleReconnect()
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return

    this.client.on('qr', (qr: string) => {
      logger.info('WhatsApp QR code received - scan to connect')
      this._status = { connected: false, state: 'qr_pending', qrCode: qr }
      this.emit('qr', qr)
    })

    this.client.on('ready', () => {
      const info = this.client.info
      logger.info('WhatsApp connected', { phone: info?.wid?.user })
      this._status = {
        connected: true,
        state: 'connected',
        phoneNumber: info?.wid?.user,
      }
      this.emit('ready')
      this.processQueue()
    })

    this.client.on('authenticated', () => {
      logger.info('WhatsApp authenticated')
    })

    this.client.on('auth_failure', (msg: string) => {
      logger.error('WhatsApp auth failure', { msg })
      this._status = { connected: false, state: 'error', lastError: msg }
    })

    this.client.on('disconnected', (reason: string) => {
      logger.warn('WhatsApp disconnected', { reason })
      this._status = { connected: false, state: 'disconnected', lastError: reason }
      this.client = null
      this.scheduleReconnect()
    })

    this.client.on('message', (msg: any) => {
      this.emit('message', {
        from: msg.from,
        body: msg.body,
        timestamp: msg.timestamp,
        isGroup: msg.isGroupMsg,
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      logger.info('Attempting WhatsApp reconnection...')
      void this.initialize()
    }, 30000) // 30 seconds
  }

  /**
   * Send a WhatsApp message
   */
  async sendMessage(msg: WhatsAppMessage): Promise<MessageResult> {
    // Normalize phone number
    const chatId = this.normalizePhone(msg.to) + '@c.us'

    if (!this._status.connected || !this.client) {
      // Queue message for when connected
      return new Promise((resolve) => {
        this.messageQueue.push({ msg, resolve })
        // Also attempt fallback after timeout
        setTimeout(() => {
          const idx = this.messageQueue.findIndex(q => q.msg === msg)
          if (idx !== -1) {
            this.messageQueue.splice(idx, 1)
            resolve({ success: false, error: 'WhatsApp not connected - message queued timeout' })
          }
        }, 60000) // 1 minute timeout
      })
    }

    try {
      let result: any
      if (msg.mediaUrl) {
        const { MessageMedia } = await import('whatsapp-web.js')
        const media = await MessageMedia.fromUrl(msg.mediaUrl)
        result = await this.client.sendMessage(chatId, media, { caption: msg.message })
      } else {
        result = await this.client.sendMessage(chatId, msg.message)
      }

      return {
        success: true,
        messageId: result?.id?.id,
        timestamp: new Date(),
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error('WhatsApp send failed', { to: msg.to, error: errMsg })
      return { success: false, error: errMsg }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || !this._status.connected) return
    this.processing = true

    while (this.messageQueue.length > 0) {
      const item = this.messageQueue.shift()!
      const result = await this.sendMessage(item.msg)
      item.resolve(result)
      // Small delay between messages to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000))
    }

    this.processing = false
  }

  /**
   * Normalize phone number to international format without +
   */
  private normalizePhone(phone: string): string {
    let clean = phone.replace(/[\s\-\(\)\+]/g, '')
    // Add Spain country code if no country code
    if (clean.length === 9 && (clean.startsWith('6') || clean.startsWith('7') || clean.startsWith('9'))) {
      clean = '34' + clean
    }
    return clean
  }

  /**
   * Get QR code for pairing (base64 image)
   */
  async getQRCode(): Promise<string | null> {
    if (this._status.state === 'qr_pending' && this._status.qrCode) {
      return this._status.qrCode
    }
    return null
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.client) {
      try {
        await this.client.destroy()
      } catch { /* ignore */ }
      this.client = null
    }
    this._status = { connected: false, state: 'disconnected' }
  }
}

// =============================================================================
// Template Rendering
// =============================================================================

/**
 * Render a message template with variables
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  })
}

/**
 * Get template from database by name
 */
export async function getTemplate(name: string): Promise<{ body: string; subject?: string } | null> {
  const db = container.getDatabase()
  const rows = await db`
    SELECT body, subject FROM message_templates 
    WHERE name = ${name} AND is_active = true
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as { body: string; subject?: string }) : null
}

// =============================================================================
// Singleton Export
// =============================================================================

export const whatsappService = new WhatsAppService()
