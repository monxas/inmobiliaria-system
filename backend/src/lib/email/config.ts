/**
 * @fileoverview Email Configuration
 * Level 3 - Notifications & Email System
 * 
 * Supports multiple email providers:
 * - SMTP (generic)
 * - SendGrid
 * - Resend
 * - Mailgun (future)
 */

import { z } from 'zod';

// =============================================================================
// Provider Configuration Schemas
// =============================================================================

const smtpConfigSchema = z.object({
  provider: z.literal('smtp'),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.coerce.boolean().default(true),
  auth: z.object({
    user: z.string().min(1),
    pass: z.string().min(1),
  }),
});

const sendgridConfigSchema = z.object({
  provider: z.literal('sendgrid'),
  apiKey: z.string().startsWith('SG.'),
});

const resendConfigSchema = z.object({
  provider: z.literal('resend'),
  apiKey: z.string().startsWith('re_'),
});

const mockConfigSchema = z.object({
  provider: z.literal('mock'),
});

// =============================================================================
// Email Configuration
// =============================================================================

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'resend' | 'mock';
  from: {
    name: string;
    email: string;
  };
  replyTo?: string;
  
  // Provider-specific config
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  sendgrid?: {
    apiKey: string;
  };
  resend?: {
    apiKey: string;
  };
  
  // Queue settings
  queue: {
    enabled: boolean;
    batchSize: number;
    intervalMs: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  
  // Rate limiting
  rateLimit: {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
  
  // Tracking
  tracking: {
    opens: boolean;
    clicks: boolean;
  };
  
  // App URLs for email links
  appUrl: string;
  logoUrl?: string;
}

// =============================================================================
// Load Email Configuration
// =============================================================================

let _emailConfig: EmailConfig | null = null;

export function loadEmailConfig(): EmailConfig {
  if (_emailConfig) return _emailConfig;

  const provider = process.env['EMAIL_PROVIDER'] || 'mock';
  const fromName = process.env['EMAIL_FROM_NAME'] || 'InmoPro';
  const fromEmail = process.env['EMAIL_FROM_ADDRESS'] || 'noreply@inmopro.local';
  const appUrl = process.env['APP_URL'] || 'http://localhost:5173';

  const baseConfig: EmailConfig = {
    provider: provider as EmailConfig['provider'],
    from: {
      name: fromName,
      email: fromEmail,
    },
    replyTo: process.env['EMAIL_REPLY_TO'] || fromEmail,
    queue: {
      enabled: process.env['EMAIL_QUEUE_ENABLED'] !== 'false',
      batchSize: Number(process.env['EMAIL_QUEUE_BATCH_SIZE']) || 10,
      intervalMs: Number(process.env['EMAIL_QUEUE_INTERVAL_MS']) || 5000,
      maxRetries: Number(process.env['EMAIL_MAX_RETRIES']) || 3,
      retryDelayMs: Number(process.env['EMAIL_RETRY_DELAY_MS']) || 60000,
    },
    rateLimit: {
      maxPerMinute: Number(process.env['EMAIL_RATE_LIMIT_MINUTE']) || 60,
      maxPerHour: Number(process.env['EMAIL_RATE_LIMIT_HOUR']) || 500,
      maxPerDay: Number(process.env['EMAIL_RATE_LIMIT_DAY']) || 5000,
    },
    tracking: {
      opens: process.env['EMAIL_TRACK_OPENS'] === 'true',
      clicks: process.env['EMAIL_TRACK_CLICKS'] === 'true',
    },
    appUrl,
    logoUrl: process.env['EMAIL_LOGO_URL'],
  };

  // Provider-specific configuration
  switch (provider) {
    case 'smtp': {
      const result = smtpConfigSchema.safeParse({
        provider: 'smtp',
        host: process.env['SMTP_HOST'],
        port: process.env['SMTP_PORT'] || '587',
        secure: process.env['SMTP_SECURE'] || 'false',
        auth: {
          user: process.env['SMTP_USER'],
          pass: process.env['SMTP_PASS'],
        },
      });
      if (!result.success) {
        console.warn('SMTP configuration invalid, falling back to mock provider');
        baseConfig.provider = 'mock';
      } else {
        baseConfig.smtp = {
          host: result.data.host,
          port: result.data.port,
          secure: result.data.secure,
          auth: result.data.auth,
        };
      }
      break;
    }
    case 'sendgrid': {
      const result = sendgridConfigSchema.safeParse({
        provider: 'sendgrid',
        apiKey: process.env['SENDGRID_API_KEY'],
      });
      if (!result.success) {
        console.warn('SendGrid configuration invalid, falling back to mock provider');
        baseConfig.provider = 'mock';
      } else {
        baseConfig.sendgrid = { apiKey: result.data.apiKey };
      }
      break;
    }
    case 'resend': {
      const result = resendConfigSchema.safeParse({
        provider: 'resend',
        apiKey: process.env['RESEND_API_KEY'],
      });
      if (!result.success) {
        console.warn('Resend configuration invalid, falling back to mock provider');
        baseConfig.provider = 'mock';
      } else {
        baseConfig.resend = { apiKey: result.data.apiKey };
      }
      break;
    }
    case 'mock':
    default:
      // Mock provider needs no additional config
      break;
  }

  _emailConfig = baseConfig;
  return _emailConfig;
}

export function getEmailConfig(): EmailConfig {
  if (!_emailConfig) {
    return loadEmailConfig();
  }
  return _emailConfig;
}
