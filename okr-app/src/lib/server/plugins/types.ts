/**
 * Plugin system types for data import integrations
 */

export interface PluginConfig {
	id: string;
	userId: string;
	enabled: boolean;
	credentials?: OAuthCredentials;
	settings?: Record<string, unknown>;
	lastSync?: Date;
}

export interface OAuthCredentials {
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // Unix timestamp
	tokenType: string;
	scope: string;
}

export interface OAuthConfig {
	clientId: string;
	clientSecret?: string; // Optional for PKCE
	authorizationUrl: string;
	tokenUrl: string;
	scopes: string[];
	redirectUri: string;
	usePKCE: boolean;
}

export interface DataFieldDescriptor {
	id: string;
	name: string;
	description: string;
	type: 'number' | 'time' | 'text' | 'boolean';
	unit?: string;
}

export interface ImportedDataRecord {
	date: string; // YYYY-MM-DD
	fields: Record<string, string | number | null>;
}

export interface SyncResult {
	success: boolean;
	recordsImported: number;
	errors?: string[];
	lastSyncDate?: string;
}

export interface AdminConfigField {
	key: string;
	label: string;
	description?: string;
	type: 'text' | 'password' | 'url';
	required: boolean;
	placeholder?: string;
}

export interface SetupInfoItem {
	label: string;
	value: string;
	/** If true, the value is rendered as a copyable code snippet */
	copyable?: boolean;
}

/**
 * Base interface for data import plugins
 */
export interface DataImportPlugin {
	id: string;
	name: string;
	description: string;
	icon?: string;

	// Admin config fields this plugin requires (e.g. client_id, client_secret)
	getAdminConfigFields(): AdminConfigField[];

	// Dynamic info items shown in the admin config form (e.g. computed callback URL)
	getSetupInfo(configValues: Record<string, string>): SetupInfoItem[];

	// Check if plugin has been configured by admin (reads from DB/env)
	isConfigured(): Promise<boolean>;

	// OAuth configuration (reads from DB/env)
	getOAuthConfig(): Promise<OAuthConfig>;

	// Available data fields this plugin can import
	getAvailableFields(): DataFieldDescriptor[];

	// Check if credentials are valid
	validateCredentials(credentials: OAuthCredentials): Promise<boolean>;

	// Refresh expired tokens
	refreshTokens(credentials: OAuthCredentials): Promise<OAuthCredentials>;

	// Fetch data for a date range
	fetchData(
		credentials: OAuthCredentials,
		startDate: string,
		endDate: string,
		fields: string[]
	): Promise<ImportedDataRecord[]>;
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
	plugin: DataImportPlugin;
	enabled: boolean;
}
