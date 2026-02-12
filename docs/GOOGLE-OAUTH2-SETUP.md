# Google OAuth2 Setup - Inmobiliaria System

## Status
- ✅ Backend routes: `/api/calendar/auth/url`, `/auth/callback`, `/status`, `/disconnect`, CRUD events
- ✅ Service: `google-calendar.service.ts` - full OAuth2 flow + Calendar API v3
- ✅ Frontend: Settings page with Connect/Disconnect buttons + status display
- ✅ Database: `google_calendar_tokens` + `calendar_events_cache` tables (migration 014)
- ⏳ **Pending: Google Cloud Console credentials**

## Step 1: Google Cloud Console Setup

1. Go to https://console.cloud.google.com/
2. Create or select project (e.g., "Inmobiliaria System")
3. **Enable APIs:**
   - Google Calendar API
   - (Optional) Google Drive API, Gmail API
4. **Create OAuth2 credentials:**
   - Go to APIs & Services → Credentials → Create Credentials → OAuth Client ID
   - Application type: **Web application**
   - Name: "Inmobiliaria System"
   - **Authorized redirect URIs:**
     - `http://localhost:8081/api/calendar/auth/callback` (development)
     - For production, add your actual domain
5. **Configure OAuth consent screen:**
   - User type: External (or Internal if Workspace)
   - App name: "Inmobiliaria System"
   - User support email: ramonkawa@gmail.com
   - Scopes: `https://www.googleapis.com/auth/calendar`
   - Test users: Add `ramonkawa@gmail.com`
6. Copy **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

Add to `/root/clawd/projects/inmobiliaria-system/.env`:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8081/api/calendar/auth/callback
FRONTEND_URL=http://localhost:5173
```

## Step 3: Restart Backend

```bash
cd /root/clawd/projects/inmobiliaria-system
docker compose -f docker-compose.dev.yml restart backend
```

## Step 4: Test Flow

1. Login to the app at http://localhost:5173
2. Go to Dashboard → Settings
3. Click "Conectar Google Calendar"
4. Authorize with Google
5. You'll be redirected back with a success message

## Architecture

```
Browser → /api/calendar/auth/url → returns Google consent URL
Browser → Google consent → grants access
Google → /api/calendar/auth/callback?code=...&state=userId
Backend → exchanges code for tokens → saves to DB → redirects to frontend
Frontend → checks /api/calendar/status → shows connected state
```

## Scopes
- `https://www.googleapis.com/auth/calendar` - Full calendar access

## Token Storage
- Tokens stored in `google_calendar_tokens` table (per user)
- Auto-refresh when access token expires (5-min buffer)
- Refresh token persisted through access token renewals

## Event Types & Color Coding
- viewing → Blueberry (9)
- meeting → Banana (5)  
- signing → Sage (10)
- other → Graphite (8)

Events store inmobiliaria metadata (propertyId, clientId) in Google's extendedProperties.
