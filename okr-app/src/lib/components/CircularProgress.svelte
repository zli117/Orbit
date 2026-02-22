<script lang="ts">
	interface Props {
		value: number; // 0-1
		size?: number;
		strokeWidth?: number;
		color?: string;
		label?: string;
		showPercent?: boolean;
	}

	let { value, size = 80, strokeWidth = 6, color, label, showPercent = true }: Props = $props();

	const radius = $derived((size - strokeWidth) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - Math.min(Math.max(value, 0), 1) * circumference);
	const percent = $derived(Math.round(Math.min(Math.max(value, 0), 1) * 100));

	const autoColor = $derived.by(() => {
		if (color) return color;
		if (value >= 0.7) return '#059669';
		if (value >= 0.3) return '#D97706';
		return '#DC2626';
	});
</script>

<div class="circular-progress" style="width: {size}px; height: {size}px;">
	<svg width={size} height={size} viewBox="0 0 {size} {size}">
		<circle
			cx={size / 2}
			cy={size / 2}
			r={radius}
			fill="none"
			stroke="#E2E8F0"
			stroke-width={strokeWidth}
		/>
		<circle
			class="progress-ring"
			cx={size / 2}
			cy={size / 2}
			r={radius}
			fill="none"
			stroke={autoColor}
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			transform="rotate(-90 {size / 2} {size / 2})"
		/>
	</svg>
	{#if showPercent || label}
		<div class="progress-label">
			{#if showPercent}
				<span class="progress-percent" style="font-size: {size * 0.22}px; color: {autoColor};">
					{percent}%
				</span>
			{/if}
			{#if label}
				<span class="progress-sublabel" style="font-size: {size * 0.13}px;">
					{label}
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.circular-progress {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.progress-ring {
		transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.progress-label {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
	}

	.progress-percent {
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.progress-sublabel {
		color: var(--color-text-muted);
		font-weight: 500;
		line-height: 1;
	}
</style>
