/**
 * Oura Ring Plugin - Import sleep, readiness, activity, and health data from Oura
 */

import type { DataImportPlugin, OAuthConfig, OAuthCredentials, DataFieldDescriptor, ImportedDataRecord, AdminConfigField, SetupInfoItem } from './types';
import { refreshAccessToken } from './oauth';
import { getConfigValue } from '$lib/server/config';

const OURA_API_BASE = 'https://api.ouraring.com';

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const ouraPlugin: DataImportPlugin = {
	id: 'oura',
	name: 'Oura Ring',
	description: 'Import sleep, readiness, activity, and health data from Oura Ring',
	icon: '/icons/oura.png',

	getAdminConfigFields(): AdminConfigField[] {
		return [
			{
				key: 'client_id',
				label: 'Client ID',
				description: 'OAuth 2.0 Client ID from cloud.ouraring.com',
				type: 'text',
				required: true,
				placeholder: 'e.g., ABCDEF123456'
			},
			{
				key: 'client_secret',
				label: 'Client Secret',
				description: 'OAuth 2.0 Client Secret from cloud.ouraring.com',
				type: 'password',
				required: true,
				placeholder: '••••••••'
			}
		];
	},

	getSetupInfo(configValues: Record<string, string>): SetupInfoItem[] {
		const baseUrl = (configValues['global.base_url'] || 'http://localhost:5173').replace(/\/+$/, '');
		return [
			{
				label: 'OAuth Callback URL',
				value: `${baseUrl}/api/plugins/oura/callback`,
				copyable: true
			}
		];
	},

	getSetupGuide(configValues: Record<string, string>): string {
		const baseUrl = escapeHtml((configValues['global.base_url'] || 'http://localhost:5173').replace(/\/+$/, ''));
		const callbackUrl = escapeHtml(`${(configValues['global.base_url'] || 'http://localhost:5173').replace(/\/+$/, '')}/api/plugins/oura/callback`);

		return `
<h3>1. Sign in to Oura Cloud</h3>
<ol>
<li>Go to <a href="https://cloud.ouraring.com" target="_blank">cloud.ouraring.com</a></li>
<li>Sign in with your Oura account (the same account linked to your Oura Ring)</li>
</ol>

<h3>2. Create an OAuth application</h3>
<ol>
<li>Navigate to the <strong>My Applications</strong> section in your account</li>
<li>Click <strong>Create New Application</strong></li>
<li>Fill in the form:
  <ul>
  <li><strong>Application Name</strong> &mdash; anything (e.g. "RUOK")</li>
  <li><strong>Description</strong> &mdash; anything</li>
  <li><strong>Redirect URIs</strong> &mdash; <code>${callbackUrl}</code></li>
  <li><strong>Application Website</strong> &mdash; <code>${baseUrl}</code></li>
  </ul>
</li>
<li>Click <strong>Save</strong> and note the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
</ol>

<h3>3. Configure in RUOK</h3>
<ol>
<li>On this page, enter the <strong>Client ID</strong> and <strong>Client Secret</strong> from step 2 in the fields below</li>
<li>Make sure the <strong>Base URL</strong> in Global Configuration above is set to <code>${baseUrl}</code></li>
<li>Click <strong>Save</strong></li>
</ol>

<h3>4. Connect your account</h3>
<ol>
<li>Go to <strong>Settings &gt; Integrations</strong></li>
<li>Click <strong>Connect</strong> next to Oura Ring</li>
<li>Authorize the requested permissions on the Oura consent screen</li>
<li>Once connected, click <strong>Sync Now</strong> to pull in your data</li>
</ol>

<p>Data syncs automatically every hour. Each sync fetches the last 7 days.</p>

<p><strong>Note:</strong> Some metrics (SpO2, heart rate time series) require an Oura Gen 3 ring. If a metric isn't available for your device, it will be empty.</p>`;
	},

	async isConfigured(): Promise<boolean> {
		const clientId = await getConfigValue('plugin.oura.client_id');
		const clientSecret = await getConfigValue('plugin.oura.client_secret');
		return !!(clientId && clientSecret);
	},

	async getOAuthConfig(): Promise<OAuthConfig> {
		const baseUrl = ((await getConfigValue('global.base_url')) || 'http://localhost:5173').replace(/\/+$/, '');
		const clientId = (await getConfigValue('plugin.oura.client_id')) || '';
		const clientSecret = (await getConfigValue('plugin.oura.client_secret')) || '';
		return {
			clientId,
			clientSecret,
			authorizationUrl: 'https://cloud.ouraring.com/oauth/authorize',
			tokenUrl: 'https://api.ouraring.com/oauth/token',
			scopes: ['daily', 'heartrate', 'spo2Daily'],
			redirectUri: `${baseUrl}/api/plugins/oura/callback`,
			usePKCE: false
		};
	},

	getAvailableFields(): DataFieldDescriptor[] {
		return [
			{
				id: 'readinessScore',
				name: 'Readiness Score',
				description: 'Daily readiness score (1-100)',
				type: 'number',
				unit: 'points'
			},
			{
				id: 'sleepScore',
				name: 'Sleep Score',
				description: 'Daily sleep score (1-100)',
				type: 'number',
				unit: 'points'
			},
			{
				id: 'activityScore',
				name: 'Activity Score',
				description: 'Daily activity score (1-100)',
				type: 'number',
				unit: 'points'
			},
			{
				id: 'totalSleepDuration',
				name: 'Sleep Duration',
				description: 'Total time asleep',
				type: 'time',
				unit: 'HH:MM'
			},
			{
				id: 'sleepEfficiency',
				name: 'Sleep Efficiency',
				description: 'Percentage of time in bed spent asleep',
				type: 'number',
				unit: '%'
			},
			{
				id: 'avgHRV',
				name: 'Average HRV',
				description: 'Average heart rate variability during sleep',
				type: 'number',
				unit: 'ms'
			},
			{
				id: 'avgHeartRate',
				name: 'Avg Heart Rate (Sleep)',
				description: 'Average heart rate during sleep',
				type: 'number',
				unit: 'bpm'
			},
			{
				id: 'lowestHeartRate',
				name: 'Lowest Heart Rate',
				description: 'Lowest heart rate during sleep',
				type: 'number',
				unit: 'bpm'
			},
			{
				id: 'avgBreathingRate',
				name: 'Breathing Rate',
				description: 'Average breathing rate during sleep',
				type: 'number',
				unit: 'brpm'
			},
			{
				id: 'deepSleepDuration',
				name: 'Deep Sleep',
				description: 'Time spent in deep sleep',
				type: 'time',
				unit: 'HH:MM'
			},
			{
				id: 'remSleepDuration',
				name: 'REM Sleep',
				description: 'Time spent in REM sleep',
				type: 'time',
				unit: 'HH:MM'
			},
			{
				id: 'steps',
				name: 'Steps',
				description: 'Daily step count',
				type: 'number'
			},
			{
				id: 'activeCalories',
				name: 'Active Calories',
				description: 'Calories burned from activity',
				type: 'number',
				unit: 'kcal'
			},
			{
				id: 'totalCalories',
				name: 'Total Calories',
				description: 'Total calories expended',
				type: 'number',
				unit: 'kcal'
			},
			{
				id: 'spo2',
				name: 'SpO2',
				description: 'Average blood oxygen saturation during sleep',
				type: 'number',
				unit: '%'
			},
			{
				id: 'temperatureDeviation',
				name: 'Temperature Deviation',
				description: 'Body temperature deviation from baseline',
				type: 'number',
				unit: '°C'
			}
		];
	},

	async validateCredentials(credentials: OAuthCredentials): Promise<boolean> {
		try {
			const response = await fetch(`${OURA_API_BASE}/v2/usercollection/personal_info`, {
				headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
			});
			return response.ok;
		} catch {
			return false;
		}
	},

	async refreshTokens(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		const config = await this.getOAuthConfig();
		return refreshAccessToken(config, credentials.refreshToken);
	},

	async fetchData(
		credentials: OAuthCredentials,
		startDate: string,
		endDate: string,
		_fields: string[]
	): Promise<ImportedDataRecord[]> {
		const records: Map<string, ImportedDataRecord> = new Map();

		const getRecord = (date: string): ImportedDataRecord => {
			if (!records.has(date)) {
				records.set(date, { date, fields: {} });
			}
			return records.get(date)!;
		};

		// Fetch all data sources in parallel
		const [dailySleep, sleepSessions, dailyActivity, dailyReadiness, dailySpo2] = await Promise.all([
			fetchDailySleep(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch Oura daily sleep:', err); return []; }),
			fetchSleepSessions(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch Oura sleep sessions:', err); return []; }),
			fetchDailyActivity(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch Oura daily activity:', err); return []; }),
			fetchDailyReadiness(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch Oura daily readiness:', err); return []; }),
			fetchDailySpO2(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch Oura SpO2:', err); return []; })
		]);

		for (const entry of dailySleep) {
			const record = getRecord(entry.day);
			record.fields.sleepScore = entry.score;
		}

		for (const entry of sleepSessions) {
			const record = getRecord(entry.day);
			record.fields.totalSleepDuration = entry.totalSleepDuration;
			record.fields.sleepEfficiency = entry.efficiency;
			record.fields.avgHRV = entry.averageHrv;
			record.fields.avgHeartRate = entry.averageHeartRate;
			record.fields.lowestHeartRate = entry.lowestHeartRate;
			record.fields.avgBreathingRate = entry.averageBreath;
			record.fields.deepSleepDuration = entry.deepSleepDuration;
			record.fields.remSleepDuration = entry.remSleepDuration;
		}

		for (const entry of dailyActivity) {
			const record = getRecord(entry.day);
			record.fields.activityScore = entry.score;
			record.fields.steps = entry.steps;
			record.fields.activeCalories = entry.activeCalories;
			record.fields.totalCalories = entry.totalCalories;
		}

		for (const entry of dailyReadiness) {
			const record = getRecord(entry.day);
			record.fields.readinessScore = entry.score;
			record.fields.temperatureDeviation = entry.temperatureDeviation;
		}

		for (const entry of dailySpo2) {
			const record = getRecord(entry.day);
			record.fields.spo2 = entry.spo2Average;
		}

		return Array.from(records.values()).sort((a, b) => a.date.localeCompare(b.date));
	}
};

// --- Oura API helpers ---

function authHeaders(accessToken: string): Record<string, string> {
	return { 'Authorization': `Bearer ${accessToken}` };
}

/** Fetch all pages from a paginated Oura endpoint */
async function fetchAllPages<T>(
	url: string,
	accessToken: string
): Promise<T[]> {
	const allData: T[] = [];
	let nextToken: string | null = null;

	do {
		const fetchUrl = nextToken ? `${url}&next_token=${nextToken}` : url;
		const response = await fetch(fetchUrl, { headers: authHeaders(accessToken) });

		if (!response.ok) {
			throw new Error(`Oura API failed: ${response.status}`);
		}

		const json = await response.json();
		allData.push(...(json.data || []));
		nextToken = json.next_token || null;
	} while (nextToken);

	return allData;
}

function secondsToHHMM(seconds: number | null): string | null {
	if (seconds == null) return null;
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return `${hours}:${String(minutes).padStart(2, '0')}`;
}

// --- Fetch functions ---

interface DailySleepRecord {
	day: string;
	score: number | null;
}

async function fetchDailySleep(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<DailySleepRecord[]> {
	const data = await fetchAllPages<{ day: string; score: number | null }>(
		`${OURA_API_BASE}/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`,
		accessToken
	);

	return data.map(entry => ({
		day: entry.day,
		score: entry.score ?? null
	}));
}

interface SleepSessionRecord {
	day: string;
	totalSleepDuration: string | null;
	efficiency: number | null;
	averageHrv: number | null;
	averageHeartRate: number | null;
	lowestHeartRate: number | null;
	averageBreath: number | null;
	deepSleepDuration: string | null;
	remSleepDuration: string | null;
}

async function fetchSleepSessions(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<SleepSessionRecord[]> {
	const data = await fetchAllPages<{
		day: string;
		type: string;
		total_sleep_duration: number | null;
		efficiency: number | null;
		average_hrv: number | null;
		average_heart_rate: number | null;
		lowest_heart_rate: number | null;
		average_breath: number | null;
		deep_sleep_duration: number | null;
		rem_sleep_duration: number | null;
		time_in_bed: number;
	}>(
		`${OURA_API_BASE}/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`,
		accessToken
	);

	// Group by day, pick the longest long_sleep session per day
	const byDay = new Map<string, typeof data[number]>();
	for (const session of data) {
		if (session.type !== 'long_sleep') continue;
		const existing = byDay.get(session.day);
		if (!existing || session.time_in_bed > existing.time_in_bed) {
			byDay.set(session.day, session);
		}
	}

	return Array.from(byDay.values()).map(s => ({
		day: s.day,
		totalSleepDuration: secondsToHHMM(s.total_sleep_duration),
		efficiency: s.efficiency ?? null,
		averageHrv: s.average_hrv ?? null,
		averageHeartRate: s.average_heart_rate != null ? Math.round(s.average_heart_rate) : null,
		lowestHeartRate: s.lowest_heart_rate ?? null,
		// Oura returns breaths/second, convert to breaths/minute
		averageBreath: s.average_breath != null ? Math.round(s.average_breath * 60 * 10) / 10 : null,
		deepSleepDuration: secondsToHHMM(s.deep_sleep_duration),
		remSleepDuration: secondsToHHMM(s.rem_sleep_duration)
	}));
}

interface DailyActivityRecord {
	day: string;
	score: number | null;
	steps: number;
	activeCalories: number;
	totalCalories: number;
}

async function fetchDailyActivity(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<DailyActivityRecord[]> {
	const data = await fetchAllPages<{
		day: string;
		score: number | null;
		steps: number;
		active_calories: number;
		total_calories: number;
	}>(
		`${OURA_API_BASE}/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`,
		accessToken
	);

	return data.map(entry => ({
		day: entry.day,
		score: entry.score ?? null,
		steps: entry.steps || 0,
		activeCalories: entry.active_calories || 0,
		totalCalories: entry.total_calories || 0
	}));
}

interface DailyReadinessRecord {
	day: string;
	score: number | null;
	temperatureDeviation: number | null;
}

async function fetchDailyReadiness(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<DailyReadinessRecord[]> {
	const data = await fetchAllPages<{
		day: string;
		score: number | null;
		temperature_deviation: number | null;
	}>(
		`${OURA_API_BASE}/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`,
		accessToken
	);

	return data.map(entry => ({
		day: entry.day,
		score: entry.score ?? null,
		temperatureDeviation: entry.temperature_deviation ?? null
	}));
}

interface DailySpO2Record {
	day: string;
	spo2Average: number | null;
}

async function fetchDailySpO2(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<DailySpO2Record[]> {
	const data = await fetchAllPages<{
		day: string;
		spo2_percentage: { average: number } | null;
	}>(
		`${OURA_API_BASE}/v2/usercollection/daily_spo2?start_date=${startDate}&end_date=${endDate}`,
		accessToken
	);

	return data.map(entry => ({
		day: entry.day,
		spo2Average: entry.spo2_percentage?.average ?? null
	}));
}
