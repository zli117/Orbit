/**
 * Fitbit Plugin - Import health and fitness data from Fitbit
 */

import type { DataImportPlugin, OAuthConfig, OAuthCredentials, DataFieldDescriptor, ImportedDataRecord, AdminConfigField, SetupInfoItem } from './types';
import { refreshAccessToken } from './oauth';
import { getConfigValue } from '$lib/server/config';

const FITBIT_API_BASE = 'https://api.fitbit.com';

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const fitbitPlugin: DataImportPlugin = {
	id: 'fitbit',
	name: 'Fitbit',
	description: 'Import sleep, activity, and health data from Fitbit',
	icon: '/icons/fitbit_logo_icon_171153.svg',

	getAdminConfigFields(): AdminConfigField[] {
		return [
			{
				key: 'client_id',
				label: 'Client ID',
				description: 'OAuth 2.0 Client ID from dev.fitbit.com',
				type: 'text',
				required: true,
				placeholder: 'e.g., 23ABCD'
			},
			{
				key: 'client_secret',
				label: 'Client Secret',
				description: 'OAuth 2.0 Client Secret from dev.fitbit.com',
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
				value: `${baseUrl}/api/plugins/fitbit/callback`,
				copyable: true
			}
		];
	},

	getSetupGuide(configValues: Record<string, string>): string {
		const baseUrl = escapeHtml((configValues['global.base_url'] || 'http://localhost:5173').replace(/\/+$/, ''));
		const callbackUrl = escapeHtml(`${(configValues['global.base_url'] || 'http://localhost:5173').replace(/\/+$/, '')}/api/plugins/fitbit/callback`);

		return `
<h3>1. Create a Fitbit developer account</h3>
<ol>
<li>Go to <a href="https://accounts.fitbit.com/signup" target="_blank">accounts.fitbit.com/signup</a></li>
<li>Click <strong>Continue with Google</strong></li>
<li>Click <strong>Create Account</strong> and select <strong>For my personal user</strong></li>
<li>Follow the instructions to complete account creation</li>
<li>Go to <a href="https://dev.fitbit.com/apps" target="_blank">dev.fitbit.com/apps</a> and click <strong>Log In</strong></li>
<li>Click <strong>Continue with Google</strong> and select your account</li>
</ol>

<h3>2. Register a Fitbit application</h3>
<ol>
<li>Go to <a href="https://dev.fitbit.com/apps" target="_blank">dev.fitbit.com/apps</a></li>
<li>Click <strong>Register a new application</strong> in the upper right corner</li>
<li>Fill in the form:
  <ul>
  <li><strong>Application Name</strong> &mdash; anything (e.g. "RUOK")</li>
  <li><strong>Description</strong> &mdash; anything</li>
  <li><strong>Application Website URL</strong> &mdash; <code>${baseUrl}</code></li>
  <li><strong>Organization</strong> &mdash; anything</li>
  <li><strong>Organization Website URL</strong> &mdash; <code>${baseUrl}</code></li>
  <li><strong>Terms of Service URL</strong> &mdash; <code>${baseUrl}</code></li>
  <li><strong>Privacy Policy URL</strong> &mdash; <code>${baseUrl}</code></li>
  <li><strong>OAuth 2.0 Application Type</strong> &mdash; <strong>Server</strong></li>
  <li><strong>Redirect URL</strong> &mdash; <code>${callbackUrl}</code></li>
  </ul>
</li>
<li>Click <strong>Register</strong> and note the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
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
<li>Click <strong>Connect</strong> next to Fitbit</li>
<li>Authorize the requested permissions on the Fitbit consent screen</li>
<li>Once connected, click <strong>Sync Now</strong> to pull in your data</li>
</ol>

<p>Data syncs automatically every hour. Each sync fetches the last 7 days.</p>

<p><strong>Note:</strong> Some metrics (HRV, breathing rate, SpO2, skin temperature) are only recorded during sleep and require a compatible device. If a metric isn't available for your device, it will be empty.</p>

<p><strong>Re-authorization:</strong> If you previously connected Fitbit before new data types were added, disconnect and reconnect to grant the additional permissions.</p>`;
	},

	async isConfigured(): Promise<boolean> {
		const clientId = await getConfigValue('plugin.fitbit.client_id');
		const clientSecret = await getConfigValue('plugin.fitbit.client_secret');
		return !!(clientId && clientSecret);
	},

	async getOAuthConfig(): Promise<OAuthConfig> {
		const baseUrl = ((await getConfigValue('global.base_url')) || 'http://localhost:5173').replace(/\/+$/, '');
		const clientId = (await getConfigValue('plugin.fitbit.client_id')) || '';
		const clientSecret = (await getConfigValue('plugin.fitbit.client_secret')) || '';
		return {
			clientId,
			clientSecret,
			authorizationUrl: 'https://www.fitbit.com/oauth2/authorize',
			tokenUrl: 'https://api.fitbit.com/oauth2/token',
			scopes: [
				'sleep', 'activity', 'heartrate', 'profile',
				'respiratory_rate', 'oxygen_saturation', 'cardio_fitness',
				'temperature', 'weight'
			],
			redirectUri: `${baseUrl}/api/plugins/fitbit/callback`,
			usePKCE: true
		};
	},

	getAvailableFields(): DataFieldDescriptor[] {
		return [
			{
				id: 'sleepLength',
				name: 'Sleep Duration',
				description: 'Total time asleep',
				type: 'time',
				unit: 'HH:MM'
			},
			{
				id: 'wakeUpTime',
				name: 'Wake Up Time',
				description: 'Time of waking up',
				type: 'time',
				unit: 'HH:MM'
			},
			{
				id: 'bedTime',
				name: 'Bed Time',
				description: 'Time of going to bed',
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
				id: 'cardioLoad',
				name: 'Active Zone Minutes',
				description: 'Minutes in cardio/peak heart rate zones',
				type: 'number',
				unit: 'minutes'
			},
			{
				id: 'restingHeartRate',
				name: 'Resting Heart Rate',
				description: 'Daily resting heart rate',
				type: 'number',
				unit: 'bpm'
			},
			{
				id: 'hrv',
				name: 'HRV (RMSSD)',
				description: 'Heart rate variability during sleep (daily RMSSD)',
				type: 'number',
				unit: 'ms'
			},
			{
				id: 'breathingRate',
				name: 'Breathing Rate',
				description: 'Average breaths per minute during sleep',
				type: 'number',
				unit: 'brpm'
			},
			{
				id: 'spo2',
				name: 'SpO2',
				description: 'Average blood oxygen saturation during sleep',
				type: 'number',
				unit: '%'
			},
			{
				id: 'vo2Max',
				name: 'VO2 Max',
				description: 'Cardio fitness score (may be a range like "44-48")',
				type: 'text',
				unit: 'mL/kg/min'
			},
			{
				id: 'skinTemperature',
				name: 'Skin Temperature',
				description: 'Nightly skin temperature variation from baseline',
				type: 'number',
				unit: '°C'
			},
			{
				id: 'weight',
				name: 'Weight',
				description: 'Body weight (unit depends on Fitbit profile settings)',
				type: 'number'
			}
		];
	},

	async validateCredentials(credentials: OAuthCredentials): Promise<boolean> {
		try {
			const response = await fetch(`${FITBIT_API_BASE}/1/user/-/profile.json`, {
				headers: {
					'Authorization': `Bearer ${credentials.accessToken}`
				}
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

		// Helper to ensure record exists
		const getRecord = (date: string): ImportedDataRecord => {
			if (!records.has(date)) {
				records.set(date, { date, fields: {} });
			}
			return records.get(date)!;
		};

		// Fetch all data sources in parallel
		const [sleepData, activityData, heartData, hrvData, brData, spo2Data, vo2Data, tempData, weightData] = await Promise.all([
			fetchSleepData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch sleep data:', err); return []; }),
			fetchActivityData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch activity data:', err); return []; }),
			fetchHeartRateData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch heart rate data:', err); return []; }),
			fetchHRVData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch HRV data:', err); return []; }),
			fetchBreathingRateData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch breathing rate data:', err); return []; }),
			fetchSpO2Data(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch SpO2 data:', err); return []; }),
			fetchVO2MaxData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch VO2 Max data:', err); return []; }),
			fetchSkinTemperatureData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch skin temperature data:', err); return []; }),
			fetchWeightData(credentials.accessToken, startDate, endDate).catch(err => { console.error('Failed to fetch weight data:', err); return []; })
		]);

		for (const sleep of sleepData) {
			const record = getRecord(sleep.date);
			record.fields.sleepLength = sleep.duration;
			record.fields.wakeUpTime = sleep.wakeUpTime;
			record.fields.bedTime = sleep.bedTime;
		}

		for (const activity of activityData) {
			const record = getRecord(activity.date);
			record.fields.steps = activity.steps;
			record.fields.cardioLoad = activity.activeZoneMinutes;
		}

		for (const heart of heartData) {
			const record = getRecord(heart.date);
			record.fields.restingHeartRate = heart.restingHeartRate;
		}

		for (const hrv of hrvData) {
			const record = getRecord(hrv.date);
			record.fields.hrv = hrv.dailyRmssd;
		}

		for (const br of brData) {
			const record = getRecord(br.date);
			record.fields.breathingRate = br.breathingRate;
		}

		for (const spo2 of spo2Data) {
			const record = getRecord(spo2.date);
			record.fields.spo2 = spo2.avg;
		}

		for (const vo2 of vo2Data) {
			const record = getRecord(vo2.date);
			record.fields.vo2Max = vo2.vo2Max;
		}

		for (const temp of tempData) {
			const record = getRecord(temp.date);
			record.fields.skinTemperature = temp.nightlyRelative;
		}

		for (const w of weightData) {
			const record = getRecord(w.date);
			record.fields.weight = w.weight;
		}

		return Array.from(records.values()).sort((a, b) => a.date.localeCompare(b.date));
	}
};

// --- Fetch functions ---

interface SleepRecord {
	date: string;
	duration: string; // HH:MM
	wakeUpTime: string;
	bedTime: string;
}

async function fetchSleepData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<SleepRecord[]> {
	const response = await fetch(
		`${FITBIT_API_BASE}/1.2/user/-/sleep/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`Sleep API failed: ${response.status}`);
	}

	const data = await response.json();
	const records: SleepRecord[] = [];

	for (const sleep of data.sleep || []) {
		if (sleep.isMainSleep) {
			const durationMinutes = sleep.minutesAsleep || 0;
			const hours = Math.floor(durationMinutes / 60);
			const minutes = durationMinutes % 60;

			// Extract times from the sleep log
			const startTime = new Date(sleep.startTime);
			const endTime = new Date(sleep.endTime);

			records.push({
				date: sleep.dateOfSleep,
				duration: `${hours}:${String(minutes).padStart(2, '0')}`,
				bedTime: formatTime(startTime),
				wakeUpTime: formatTime(endTime)
			});
		}
	}

	return records;
}

interface ActivityRecord {
	date: string;
	steps: number;
	activeZoneMinutes: number;
}

async function fetchActivityData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<ActivityRecord[]> {
	// Fetch steps and active zone minutes in parallel
	const [stepsResponse, azmResponse] = await Promise.all([
		fetch(
			`${FITBIT_API_BASE}/1/user/-/activities/steps/date/${startDate}/${endDate}.json`,
			{ headers: { 'Authorization': `Bearer ${accessToken}` } }
		),
		fetch(
			`${FITBIT_API_BASE}/1/user/-/activities/active-zone-minutes/date/${startDate}/${endDate}.json`,
			{ headers: { 'Authorization': `Bearer ${accessToken}` } }
		).catch(() => null)
	]);

	if (!stepsResponse.ok) {
		throw new Error(`Steps API failed: ${stepsResponse.status}`);
	}

	const stepsData = await stepsResponse.json();
	const azmData = azmResponse?.ok ? await azmResponse.json() : {};

	const records: Map<string, ActivityRecord> = new Map();

	for (const entry of stepsData['activities-steps'] || []) {
		records.set(entry.dateTime, {
			date: entry.dateTime,
			steps: parseInt(entry.value) || 0,
			activeZoneMinutes: 0
		});
	}

	for (const entry of azmData['activities-active-zone-minutes'] || []) {
		const existing = records.get(entry.dateTime);
		if (existing) {
			existing.activeZoneMinutes = entry.value?.activeZoneMinutes || 0;
		} else {
			records.set(entry.dateTime, {
				date: entry.dateTime,
				steps: 0,
				activeZoneMinutes: entry.value?.activeZoneMinutes || 0
			});
		}
	}

	return Array.from(records.values());
}

interface HeartRecord {
	date: string;
	restingHeartRate: number | null;
}

async function fetchHeartRateData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<HeartRecord[]> {
	const response = await fetch(
		`${FITBIT_API_BASE}/1/user/-/activities/heart/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`Heart rate API failed: ${response.status}`);
	}

	const data = await response.json();
	const records: HeartRecord[] = [];

	for (const entry of data['activities-heart'] || []) {
		records.push({
			date: entry.dateTime,
			restingHeartRate: entry.value?.restingHeartRate || null
		});
	}

	return records;
}

interface HRVRecord {
	date: string;
	dailyRmssd: number | null;
}

async function fetchHRVData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<HRVRecord[]> {
	const response = await fetch(
		`${FITBIT_API_BASE}/1/user/-/hrv/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`HRV API failed: ${response.status}`);
	}

	const data = await response.json();
	const records: HRVRecord[] = [];

	for (const entry of data.hrv || []) {
		records.push({
			date: entry.dateTime,
			dailyRmssd: entry.value?.dailyRmssd ?? null
		});
	}

	return records;
}

interface BreathingRateRecord {
	date: string;
	breathingRate: number | null;
}

async function fetchBreathingRateData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<BreathingRateRecord[]> {
	const response = await fetch(
		`${FITBIT_API_BASE}/1/user/-/br/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`Breathing rate API failed: ${response.status}`);
	}

	const data = await response.json();
	const records: BreathingRateRecord[] = [];

	for (const entry of data.br || []) {
		records.push({
			date: entry.dateTime,
			breathingRate: entry.value?.breathingRate ?? null
		});
	}

	return records;
}

interface SpO2Record {
	date: string;
	avg: number | null;
}

async function fetchSpO2Data(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<SpO2Record[]> {
	const response = await fetch(
		`${FITBIT_API_BASE}/1/user/-/spo2/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`SpO2 API failed: ${response.status}`);
	}

	// SpO2 interval endpoint returns a top-level array
	const data = await response.json();
	const entries = Array.isArray(data) ? data : [];
	const records: SpO2Record[] = [];

	for (const entry of entries) {
		records.push({
			date: entry.dateTime,
			avg: entry.value?.avg ?? null
		});
	}

	return records;
}

interface VO2MaxRecord {
	date: string;
	vo2Max: string | null;
}

async function fetchVO2MaxData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<VO2MaxRecord[]> {
	const response = await fetch(
		`${FITBIT_API_BASE}/1/user/-/cardioscore/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`VO2 Max API failed: ${response.status}`);
	}

	const data = await response.json();
	const records: VO2MaxRecord[] = [];

	for (const entry of data.cardioScore || []) {
		records.push({
			date: entry.dateTime,
			vo2Max: entry.value?.vo2Max ?? null
		});
	}

	return records;
}

interface SkinTemperatureRecord {
	date: string;
	nightlyRelative: number | null;
}

async function fetchSkinTemperatureData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<SkinTemperatureRecord[]> {
	const response = await fetch(
		`${FITBIT_API_BASE}/1/user/-/temp/skin/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`Skin temperature API failed: ${response.status}`);
	}

	const data = await response.json();
	const records: SkinTemperatureRecord[] = [];

	for (const entry of data.tempSkin || []) {
		records.push({
			date: entry.dateTime,
			nightlyRelative: entry.value?.nightlyRelative ?? null
		});
	}

	return records;
}

interface WeightRecord {
	date: string;
	weight: number | null;
}

async function fetchWeightData(
	accessToken: string,
	startDate: string,
	endDate: string
): Promise<WeightRecord[]> {
	// Body time series endpoint supports date ranges
	const response = await fetch(
		`${FITBIT_API_BASE}/1/user/-/body/weight/date/${startDate}/${endDate}.json`,
		{
			headers: { 'Authorization': `Bearer ${accessToken}` }
		}
	);

	if (!response.ok) {
		throw new Error(`Weight API failed: ${response.status}`);
	}

	const data = await response.json();
	const records: WeightRecord[] = [];

	for (const entry of data['body-weight'] || []) {
		const value = parseFloat(entry.value);
		records.push({
			date: entry.dateTime,
			weight: isNaN(value) || value === 0 ? null : value
		});
	}

	return records;
}

function formatTime(date: Date): string {
	const hours = date.getHours();
	const minutes = date.getMinutes();
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
