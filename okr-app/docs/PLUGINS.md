# Plugin System

RUOK's plugin system imports data from external services (e.g., Fitbit) into the metrics system. Plugins use OAuth2 for authentication, sync data on an hourly schedule, and surface imported values as external metrics that users can reference in their templates.

Use this document as a guide for adding new plugins. Follow every step exactly — the system expects specific file locations, naming conventions, and interface implementations.

---

## Architecture

```
src/lib/server/plugins/
  types.ts        # All interfaces (do NOT modify)
  manager.ts      # Plugin registry, credential storage, sync orchestration
  scheduler.ts    # Background sync (hourly, last 7 days, all enabled plugins)
  oauth.ts        # OAuth2 utilities (PKCE, token exchange, refresh)
  oauth-state.ts  # In-memory pending auth state store
  fitbit.ts       # Reference implementation
  index.ts        # Plugin registration + re-exports
```

### Data Flow

```
Admin configures credentials (Admin Dashboard > Configuration)
  → stored in `system_config` table as `plugin.{pluginId}.{key}`
  → falls back to env vars via `src/lib/server/config.ts`

User connects account (Settings > Integrations)
  → OAuth2 flow → tokens stored in `plugins` table as JSON

Sync runs (hourly background or manual "Sync Now")
  → plugin.fetchData() → returns ImportedDataRecord[]
  → manager writes to `daily_metric_values` table as `{pluginId}.{fieldId}`
  → also writes to legacy `daily_metrics` table for backward compat

User reads metrics
  → template system reads from `daily_metric_values` where source = pluginId
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `system_config` | Admin-set plugin credentials. Key format: `plugin.{pluginId}.{fieldName}` |
| `plugins` | Per-user plugin state: OAuth tokens (JSON), enabled flag, last sync time |
| `daily_metric_values` | Synced values. `metricName` = `{pluginId}.{fieldId}`, `source` = `{pluginId}` |
| `daily_metrics` | Legacy table with hardcoded columns (Fitbit-specific: sleepLength, steps, etc.) |

### Config Resolution

Plugin credentials are resolved by `src/lib/server/config.ts`:

1. Check `system_config` table for key `plugin.{pluginId}.{fieldName}`
2. Fall back to environment variable (if mapped in `ENV_FALLBACKS`)

The admin UI at `/admin` writes to the DB. Env vars are a deployment convenience.

---

## Interfaces

All types are defined in `src/lib/server/plugins/types.ts`. Here are the ones you need to implement:

### DataImportPlugin (required)

```typescript
interface DataImportPlugin {
  id: string;                    // Unique ID, used as DB key prefix (e.g., 'fitbit', 'garmin')
  name: string;                  // Display name (e.g., 'Fitbit')
  description: string;           // Short description for UI
  icon?: string;                 // Emoji for UI

  getAdminConfigFields(): AdminConfigField[];
  getSetupInfo(configValues: Record<string, string>): SetupInfoItem[];
  isConfigured(): Promise<boolean>;
  getOAuthConfig(): Promise<OAuthConfig>;
  getAvailableFields(): DataFieldDescriptor[];
  validateCredentials(credentials: OAuthCredentials): Promise<boolean>;
  refreshTokens(credentials: OAuthCredentials): Promise<OAuthCredentials>;
  fetchData(credentials: OAuthCredentials, startDate: string, endDate: string, fields: string[]): Promise<ImportedDataRecord[]>;
}
```

### Supporting Types

```typescript
interface AdminConfigField {
  key: string;                   // Stored as `plugin.{pluginId}.{key}` in system_config
  label: string;
  description?: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder?: string;
}

interface SetupInfoItem {
  label: string;
  value: string;
  copyable?: boolean;            // Renders as copyable code snippet in admin UI
}

interface OAuthConfig {
  clientId: string;
  clientSecret?: string;         // Optional for PKCE-only flows
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
  usePKCE: boolean;
}

interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;             // Unix timestamp (seconds)
  tokenType: string;
  scope: string;
}

interface DataFieldDescriptor {
  id: string;                    // Used as second part of metric key: `{pluginId}.{id}`
  name: string;
  description: string;
  type: 'number' | 'time' | 'text' | 'boolean';
  unit?: string;
}

interface ImportedDataRecord {
  date: string;                  // YYYY-MM-DD
  fields: Record<string, string | number | null>;  // Keys must match DataFieldDescriptor.id
}
```

---

## Adding a New Plugin

### Step 1: Create the plugin file

Create `src/lib/server/plugins/{your-plugin}.ts`.

Implement the `DataImportPlugin` interface. Use `src/lib/server/plugins/fitbit.ts` as a reference implementation.

```typescript
import type {
  DataImportPlugin, OAuthConfig, OAuthCredentials,
  DataFieldDescriptor, ImportedDataRecord, AdminConfigField, SetupInfoItem
} from './types';
import { refreshAccessToken } from './oauth';
import { getConfigValue } from '$lib/server/config';

export const yourPlugin: DataImportPlugin = {
  id: 'your-plugin',
  name: 'Your Service',
  description: 'Import data from Your Service',
  icon: '📊',

  getAdminConfigFields(): AdminConfigField[] {
    return [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true, placeholder: 'From developer portal' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true, placeholder: '••••••••' }
    ];
  },

  getSetupInfo(configValues: Record<string, string>): SetupInfoItem[] {
    const baseUrl = configValues['global.base_url'] || 'http://localhost:5173';
    return [
      { label: 'OAuth Callback URL', value: `${baseUrl}/api/plugins/your-plugin/callback`, copyable: true }
    ];
  },

  async isConfigured(): Promise<boolean> {
    const clientId = await getConfigValue('plugin.your-plugin.client_id');
    const clientSecret = await getConfigValue('plugin.your-plugin.client_secret');
    return !!(clientId && clientSecret);
  },

  async getOAuthConfig(): Promise<OAuthConfig> {
    const baseUrl = (await getConfigValue('global.base_url')) || 'http://localhost:5173';
    const clientId = (await getConfigValue('plugin.your-plugin.client_id')) || '';
    const clientSecret = (await getConfigValue('plugin.your-plugin.client_secret')) || '';
    return {
      clientId,
      clientSecret,
      authorizationUrl: 'https://your-service.com/oauth/authorize',
      tokenUrl: 'https://your-service.com/oauth/token',
      scopes: ['read_data'],
      redirectUri: `${baseUrl}/api/plugins/your-plugin/callback`,
      usePKCE: true
    };
  },

  getAvailableFields(): DataFieldDescriptor[] {
    return [
      { id: 'dailyScore', name: 'Daily Score', description: 'Your daily score', type: 'number', unit: '0-100' },
      { id: 'duration', name: 'Duration', description: 'Daily tracked duration', type: 'time', unit: 'HH:MM' }
    ];
  },

  async validateCredentials(credentials: OAuthCredentials): Promise<boolean> {
    try {
      const res = await fetch('https://api.your-service.com/me', {
        headers: { Authorization: `Bearer ${credentials.accessToken}` }
      });
      return res.ok;
    } catch { return false; }
  },

  async refreshTokens(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    const config = await this.getOAuthConfig();
    return refreshAccessToken(config, credentials.refreshToken);
  },

  async fetchData(credentials: OAuthCredentials, startDate: string, endDate: string): Promise<ImportedDataRecord[]> {
    const res = await fetch(`https://api.your-service.com/data?start=${startDate}&end=${endDate}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` }
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    return data.entries.map((entry: any) => ({
      date: entry.date,    // Must be YYYY-MM-DD
      fields: {
        dailyScore: entry.score,    // Keys must match getAvailableFields() IDs
        duration: entry.duration
      }
    }));
  }
};
```

### Step 2: Register the plugin

Edit `src/lib/server/plugins/index.ts`:

```typescript
import { registerPlugin } from './manager';
import { fitbitPlugin } from './fitbit';
import { yourPlugin } from './your-plugin';       // add

export function initializePlugins(): void {
  registerPlugin(fitbitPlugin);
  registerPlugin(yourPlugin);                      // add
}

export * from './types';
export * from './manager';
export * from './oauth';
export { fitbitPlugin } from './fitbit';
export { yourPlugin } from './your-plugin';        // add
```

### Step 3: Add env var fallbacks (optional)

If you want environment variables as a deployment alternative to the admin UI, add entries to `ENV_FALLBACKS` in `src/lib/server/config.ts`:

```typescript
const ENV_FALLBACKS: Record<string, () => string | undefined> = {
  'global.base_url': () => env.PUBLIC_BASE_URL,
  'plugin.fitbit.client_id': () => env.FITBIT_CLIENT_ID,
  'plugin.fitbit.client_secret': () => env.FITBIT_CLIENT_SECRET,
  'plugin.your-plugin.client_id': () => env.YOUR_PLUGIN_CLIENT_ID,         // add
  'plugin.your-plugin.client_secret': () => env.YOUR_PLUGIN_CLIENT_SECRET, // add
};
```

### Step 4: Create API routes

Create four route files. The path structure must be `src/routes/api/plugins/{your-plugin}/`.

**`src/routes/api/plugins/{your-plugin}/+server.ts`** — Status and disconnect:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserPluginConfig, disableUserPlugin } from '$lib/server/plugins/manager';
import { yourPlugin } from '$lib/server/plugins/your-plugin';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  const config = await getUserPluginConfig(locals.user.id, 'your-plugin');
  return json({
    plugin: {
      id: yourPlugin.id,
      name: yourPlugin.name,
      description: yourPlugin.description,
      icon: yourPlugin.icon,
      fields: yourPlugin.getAvailableFields()
    },
    connected: !!(config?.credentials),
    enabled: config?.enabled ?? false,
    lastSync: config?.lastSync ?? null
  });
};

export const DELETE: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  await disableUserPlugin(locals.user.id, 'your-plugin');
  return json({ success: true });
};
```

**`src/routes/api/plugins/{your-plugin}/auth/+server.ts`** — Start OAuth flow:

```typescript
import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { yourPlugin } from '$lib/server/plugins/your-plugin';
import { generateCodeVerifier, generateCodeChallenge, generateState, buildAuthorizationUrl } from '$lib/server/plugins/oauth';
import { setPendingAuth } from '$lib/server/plugins/oauth-state';

export const GET: RequestHandler = async ({ locals, cookies }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const config = await yourPlugin.getOAuthConfig();
  if (!config.clientId) return json({ error: 'Plugin not configured' }, { status: 500 });

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  setPendingAuth(state, {
    userId: locals.user.id,
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  cookies.set('your_plugin_oauth_state', state, {
    path: '/', httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 600
  });

  throw redirect(302, buildAuthorizationUrl(config, state, codeChallenge));
};
```

**`src/routes/api/plugins/{your-plugin}/callback/+server.ts`** — OAuth callback:

```typescript
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { yourPlugin } from '$lib/server/plugins/your-plugin';
import { exchangeCodeForTokens } from '$lib/server/plugins/oauth';
import { saveUserPluginConfig } from '$lib/server/plugins/manager';
import { getPendingAuth } from '$lib/server/plugins/oauth-state';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) throw redirect(302, '/settings/plugins?error=' + encodeURIComponent(error));
  if (!code || !state) throw redirect(302, '/settings/plugins?error=missing_params');

  const cookieState = cookies.get('your_plugin_oauth_state');
  if (state !== cookieState) throw redirect(302, '/settings/plugins?error=invalid_state');

  const pending = getPendingAuth(state);
  if (!pending || pending.expiresAt < Date.now()) throw redirect(302, '/settings/plugins?error=expired');

  cookies.delete('your_plugin_oauth_state', { path: '/' });

  try {
    const config = await yourPlugin.getOAuthConfig();
    const credentials = await exchangeCodeForTokens(config, code, pending.codeVerifier);
    await saveUserPluginConfig(pending.userId, 'your-plugin', credentials);
    throw redirect(302, '/settings/plugins?success=your-plugin');
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Token exchange failed:', err);
    throw redirect(302, '/settings/plugins?error=token_exchange_failed');
  }
};
```

**`src/routes/api/plugins/{your-plugin}/sync/+server.ts`** — Manual sync:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncPluginData, getUserPluginConfig } from '$lib/server/plugins/manager';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const config = await getUserPluginConfig(locals.user.id, 'your-plugin');
  if (!config?.credentials) return json({ error: 'Not connected' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const startDate = body.startDate || weekAgo.toISOString().split('T')[0];
  const endDate = body.endDate || today.toISOString().split('T')[0];

  const result = await syncPluginData(locals.user.id, 'your-plugin', startDate, endDate);
  return json(result);
};
```

### Step 5: Use in metrics templates

Once a user connects and syncs, the plugin's fields are available as **external sources** in Settings > Metrics. When creating a metric template entry:

- **Type**: External
- **Source**: `{pluginId}.{fieldId}` (e.g., `your-plugin.dailyScore`)

The field IDs come from `getAvailableFields()`. For reference, Fitbit provides:

| Source key | Description |
|-----------|-------------|
| `fitbit.sleepLength` | Sleep duration (HH:MM) |
| `fitbit.wakeUpTime` | Wake time (HH:MM) |
| `fitbit.bedTime` | Bed time (HH:MM) |
| `fitbit.steps` | Daily step count |
| `fitbit.cardioLoad` | Cardio load score |
| `fitbit.restingHeartRate` | Resting heart rate (bpm) |
| `fitbit.fitbitReadiness` | Readiness score (0-100) |

---

## Sync Behavior

- **Background scheduler** (`scheduler.ts`): Runs every hour, syncs last 7 days for all users with enabled plugins
- **Manual sync**: "Sync Now" in Settings > Integrations, syncs last 7 days (or custom date range via POST body)
- **Token refresh**: Automatic — if `credentials.expiresAt < now`, `refreshTokens()` is called before `fetchData()`
- **Data storage**: Each field value is written to `daily_metric_values` with `metricName = "{pluginId}.{fieldId}"` and `source = "{pluginId}"`
- **Idempotent writes**: Sync upserts — existing values for the same date+metric are updated, not duplicated

---

## Checklist

When adding a new plugin, verify:

- [ ] Plugin file at `src/lib/server/plugins/{id}.ts` implementing `DataImportPlugin`
- [ ] Registered in `src/lib/server/plugins/index.ts` (both `initializePlugins()` and re-export)
- [ ] API routes at `src/routes/api/plugins/{id}/` — four files: `+server.ts`, `auth/+server.ts`, `callback/+server.ts`, `sync/+server.ts`
- [ ] (Optional) Env var fallbacks in `src/lib/server/config.ts` `ENV_FALLBACKS`
- [ ] Admin configures credentials at Admin Dashboard > Configuration
- [ ] User connects at Settings > Integrations
- [ ] "Sync Now" imports data and values appear in metrics templates
- [ ] Background scheduler picks up the new plugin automatically (no changes needed — it iterates all registered plugins)
