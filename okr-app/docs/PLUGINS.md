# Plugin System

The plugin system allows importing data from external services (e.g., Fitbit) into the OKR Tracker's metrics system. Plugins are OAuth-based data import integrations that sync periodically and surface data through the flexible metrics template system.

## Architecture Overview

```
src/lib/server/plugins/
  types.ts        # Interfaces: DataImportPlugin, AdminConfigField, etc.
  manager.ts      # Plugin registry, credential storage, sync orchestration
  scheduler.ts    # Background sync scheduler (hourly)
  oauth.ts        # OAuth2 utilities (PKCE, token exchange, refresh)
  oauth-state.ts  # In-memory pending auth state store
  fitbit.ts       # Fitbit plugin implementation
  index.ts        # Entry point: registers plugins, re-exports
```

### Data Flow

1. **Admin configures plugin** via Admin Dashboard > Configuration (client ID, secret stored in `system_config` table)
2. **User connects** via Settings > Integrations, which starts an OAuth2 flow
3. **Sync runs** (hourly background or manual "Sync Now") — fetches data from the external API and writes to DB
4. **Metrics display** — the flexible template system reads synced values from `daily_metric_values` table

### Key Tables

| Table | Purpose |
|-------|---------|
| `system_config` | Admin-configured plugin credentials (client_id, client_secret) |
| `plugins` | Per-user plugin connections (OAuth tokens, enabled state, last sync time) |
| `daily_metrics` | Legacy metrics storage (hardcoded columns) |
| `daily_metric_values` | Flexible metrics storage — synced values stored as `pluginId.fieldId` (e.g., `fitbit.sleepLength`) |

### Config Resolution

Plugin configuration (client ID, secret, base URL) is read via the config service (`$lib/server/config.ts`):
1. Check `system_config` table (set by admin in the UI)
2. Fall back to environment variables (e.g., `FITBIT_CLIENT_ID`)

This allows both DB-based admin config and env var deployment.

## Adding a New Plugin

### Step 1: Create the Plugin File

Create `src/lib/server/plugins/your-plugin.ts`:

```typescript
import type {
  DataImportPlugin,
  OAuthConfig,
  OAuthCredentials,
  DataFieldDescriptor,
  ImportedDataRecord,
  AdminConfigField,
  SetupInfoItem
} from './types';
import { refreshAccessToken } from './oauth';
import { getConfigValue } from '$lib/server/config';

export const yourPlugin: DataImportPlugin = {
  id: 'your-plugin',           // Unique ID, used as DB key prefix
  name: 'Your Service',
  description: 'Import data from Your Service',
  icon: '📊',                  // Emoji shown in UI

  // Config fields the admin must fill in (Admin Dashboard > Configuration)
  getAdminConfigFields(): AdminConfigField[] {
    return [
      {
        key: 'client_id',
        label: 'Client ID',
        description: 'OAuth Client ID from developer portal',
        type: 'text',
        required: true,
        placeholder: 'e.g., abc123'
      },
      {
        key: 'client_secret',
        label: 'Client Secret',
        description: 'OAuth Client Secret',
        type: 'password',
        required: true,
        placeholder: '••••••••'
      }
    ];
  },

  // Dynamic info shown in the admin config form (e.g., computed callback URL)
  getSetupInfo(configValues: Record<string, string>): SetupInfoItem[] {
    const baseUrl = configValues['global.base_url'] || 'http://localhost:5173';
    return [
      {
        label: 'OAuth Callback URL',
        value: `${baseUrl}/api/plugins/your-plugin/callback`,
        copyable: true
      }
    ];
  },

  // Check if the admin has configured this plugin
  async isConfigured(): Promise<boolean> {
    const clientId = await getConfigValue('plugin.your-plugin.client_id');
    const clientSecret = await getConfigValue('plugin.your-plugin.client_secret');
    return !!(clientId && clientSecret);
  },

  // Build OAuth config from stored settings
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
      usePKCE: true  // Recommended; set false if the provider doesn't support it
    };
  },

  // Declare the data fields this plugin provides.
  // These become available as external sources in metrics templates
  // via "your-plugin.fieldId" (e.g., "your-plugin.dailyScore").
  getAvailableFields(): DataFieldDescriptor[] {
    return [
      {
        id: 'dailyScore',
        name: 'Daily Score',
        description: 'Your daily score from the service',
        type: 'number',
        unit: '0-100'
      },
      {
        id: 'duration',
        name: 'Duration',
        description: 'Daily tracked duration',
        type: 'time',
        unit: 'HH:MM'
      }
    ];
  },

  // Validate that stored credentials still work
  async validateCredentials(credentials: OAuthCredentials): Promise<boolean> {
    try {
      const response = await fetch('https://api.your-service.com/me', {
        headers: { Authorization: `Bearer ${credentials.accessToken}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Refresh expired tokens
  async refreshTokens(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    const config = await this.getOAuthConfig();
    return refreshAccessToken(config, credentials.refreshToken);
  },

  // Fetch data for a date range. Called during sync.
  // Return one ImportedDataRecord per day with field values.
  async fetchData(
    credentials: OAuthCredentials,
    startDate: string,     // YYYY-MM-DD
    endDate: string,       // YYYY-MM-DD
    _fields: string[]
  ): Promise<ImportedDataRecord[]> {
    const response = await fetch(
      `https://api.your-service.com/data?start=${startDate}&end=${endDate}`,
      { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
    );

    if (!response.ok) throw new Error(`API failed: ${response.status}`);

    const data = await response.json();

    // Map API response to ImportedDataRecord format
    return data.entries.map((entry: any) => ({
      date: entry.date,           // Must be YYYY-MM-DD
      fields: {
        dailyScore: entry.score,  // Keys must match getAvailableFields() IDs
        duration: entry.duration
      }
    }));
  }
};
```

### Step 2: Register the Plugin

Edit `src/lib/server/plugins/index.ts`:

```typescript
import { registerPlugin } from './manager';
import { fitbitPlugin } from './fitbit';
import { yourPlugin } from './your-plugin';

export function initializePlugins(): void {
  registerPlugin(fitbitPlugin);
  registerPlugin(yourPlugin);   // Add this
}

// Re-export everything
export * from './types';
export * from './manager';
export * from './oauth';
export { fitbitPlugin } from './fitbit';
export { yourPlugin } from './your-plugin';   // Add this
```

### Step 3: Add Env Var Fallbacks (Optional)

If you want environment variables as fallback for the admin UI config, add entries to the `ENV_FALLBACKS` map in `src/lib/server/config.ts`:

```typescript
const ENV_FALLBACKS: Record<string, () => string | undefined> = {
  'global.base_url': () => env.PUBLIC_BASE_URL,
  'plugin.fitbit.client_id': () => env.FITBIT_CLIENT_ID,
  'plugin.fitbit.client_secret': () => env.FITBIT_CLIENT_SECRET,
  // Add your plugin:
  'plugin.your-plugin.client_id': () => env.YOUR_PLUGIN_CLIENT_ID,
  'plugin.your-plugin.client_secret': () => env.YOUR_PLUGIN_CLIENT_SECRET,
};
```

### Step 4: Create API Routes

Create three route files for the OAuth flow and sync:

**`src/routes/api/plugins/your-plugin/+server.ts`** — Status & disconnect:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserPluginConfig, disableUserPlugin } from '$lib/server/plugins/manager';
import { yourPlugin } from '$lib/server/plugins/your-plugin';

// GET — Plugin status for current user
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

// DELETE — Disconnect
export const DELETE: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  await disableUserPlugin(locals.user.id, 'your-plugin');
  return json({ success: true });
};
```

**`src/routes/api/plugins/your-plugin/auth/+server.ts`** — Start OAuth flow:

```typescript
import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { yourPlugin } from '$lib/server/plugins/your-plugin';
import {
  generateCodeVerifier, generateCodeChallenge,
  generateState, buildAuthorizationUrl
} from '$lib/server/plugins/oauth';
import { setPendingAuth } from '$lib/server/plugins/oauth-state';

export const GET: RequestHandler = async ({ locals, cookies }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const config = await yourPlugin.getOAuthConfig();
  if (!config.clientId) {
    return json({ error: 'Plugin not configured' }, { status: 500 });
  }

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

**`src/routes/api/plugins/your-plugin/callback/+server.ts`** — OAuth callback:

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
  if (!pending || pending.expiresAt < Date.now()) {
    throw redirect(302, '/settings/plugins?error=expired');
  }

  cookies.delete('your_plugin_oauth_state', { path: '/' });

  try {
    const config = await yourPlugin.getOAuthConfig();
    const credentials = await exchangeCodeForTokens(config, code, pending.codeVerifier);
    await saveUserPluginConfig(pending.userId, 'your-plugin', credentials);
    throw redirect(302, '/settings/plugins?success=your-plugin');
  } catch (err) {
    // Re-throw redirects
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Token exchange failed:', err);
    throw redirect(302, '/settings/plugins?error=token_exchange_failed');
  }
};
```

**`src/routes/api/plugins/your-plugin/sync/+server.ts`** — Manual sync trigger:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncPluginData, getUserPluginConfig } from '$lib/server/plugins/manager';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const config = await getUserPluginConfig(locals.user.id, 'your-plugin');
  if (!config || !config.credentials) {
    return json({ error: 'Not connected' }, { status: 400 });
  }

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

### Step 5: Use in Metrics Templates

Once configured and connected, the plugin's fields become available as **external sources** in metrics templates. When creating a template in Settings > Metrics, add a metric with:

- **Type**: External
- **Source**: `your-plugin.dailyScore` (format: `pluginId.fieldId`)

The field IDs come from `getAvailableFields()`. For example, the Fitbit plugin provides:
- `fitbit.sleepLength`
- `fitbit.wakeUpTime`
- `fitbit.bedTime`
- `fitbit.steps`
- `fitbit.cardioLoad`
- `fitbit.restingHeartRate`
- `fitbit.fitbitReadiness`

## Sync Behavior

- **Background scheduler**: Runs every hour, syncs last 7 days for all users with enabled plugins
- **Manual sync**: "Sync Now" button in Settings > Integrations, syncs last 7 days
- **Token refresh**: Automatic — if the access token is expired, `refreshTokens()` is called before fetching data
- **Data storage**: Synced values are written to `daily_metric_values` with `metricName = "pluginId.fieldId"` and `source = pluginId`
- **Read path**: The flexible metrics endpoint checks `daily_metric_values` first (fast DB read), only calls the live API as a fallback for unsynced dates

## Checklist

- [ ] Plugin file implementing `DataImportPlugin` interface
- [ ] Registered in `index.ts`
- [ ] API routes: status (`GET`/`DELETE`), auth (`GET`), callback (`GET`), sync (`POST`)
- [ ] (Optional) Env var fallbacks in `config.ts`
- [ ] Admin configures client credentials in Admin Dashboard > Configuration
- [ ] User connects via Settings > Integrations
- [ ] Test: Sync Now imports data, metrics template shows values
