/**
 * Metrics Evaluator - Evaluates computed metric expressions
 * using QuickJS for safe sandboxed execution
 */

import { getQuickJS, type QuickJSContext, type QuickJSHandle } from 'quickjs-emscripten';
import type { MetricDefinition } from '$lib/db/schema';

const EXECUTION_TIMEOUT_MS = 1000; // Shorter timeout for expressions
const MAX_MEMORY_BYTES = 16 * 1024 * 1024; // 16MB

export interface MetricValues {
	[key: string]: string | number | boolean | null;
}

export interface EvaluationContext {
	metrics: MetricValues;
	date: string; // YYYY-MM-DD
}

export interface EvaluationResult {
	value: string | number | boolean | null;
	error?: string;
}

/**
 * Evaluate a computed metric expression
 */
export async function evaluateExpression(
	expression: string,
	context: EvaluationContext
): Promise<EvaluationResult> {
	const QuickJS = await getQuickJS();
	const runtime = QuickJS.newRuntime();

	// Set memory limit
	runtime.setMemoryLimit(MAX_MEMORY_BYTES);

	// Set execution timeout
	let shouldInterrupt = false;
	runtime.setInterruptHandler(() => shouldInterrupt);

	const timeoutId = setTimeout(() => {
		shouldInterrupt = true;
	}, EXECUTION_TIMEOUT_MS);

	const qsContext = runtime.newContext();

	try {
		// Inject context data
		injectContext(qsContext, context);

		// Wrap expression in a return statement if it doesn't already return
		const wrappedCode = expression.trim().startsWith('return ')
			? `(function() { ${expression} })()`
			: `(function() { return ${expression}; })()`;

		const result = qsContext.evalCode(wrappedCode);

		if (result.error) {
			const errorMessage = qsContext.dump(result.error);
			result.error.dispose();
			return { value: null, error: String(errorMessage) };
		}

		const value = qsContext.dump(result.value);
		result.value.dispose();

		// Convert result to appropriate type
		if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
			return { value };
		}
		if (value === null || value === undefined) {
			return { value: null };
		}
		// Convert other types to string
		return { value: String(value) };
	} catch (error) {
		return {
			value: null,
			error: error instanceof Error ? error.message : 'Expression evaluation failed'
		};
	} finally {
		clearTimeout(timeoutId);
		qsContext.dispose();
		runtime.dispose();
	}
}

/**
 * Inject context data and helper functions into QuickJS context
 */
function injectContext(context: QuickJSContext, evalContext: EvaluationContext) {
	// Inject metrics object
	const metricsHandle = jsonToHandle(context, evalContext.metrics);
	context.setProp(context.global, 'metrics', metricsHandle);
	metricsHandle.dispose();

	// Inject date
	const dateHandle = context.newString(evalContext.date);
	context.setProp(context.global, 'date', dateHandle);
	dateHandle.dispose();

	// Create q object with helper functions
	const qHandle = context.newObject();

	// parseTime(timeStr) -> minutes
	const parseTimeFn = context.newFunction('parseTime', (timeHandle) => {
		const timeStr = context.dump(timeHandle) as string;
		if (!timeStr) return context.newNumber(0);
		const parts = timeStr.split(':').map(Number);
		if (parts.length === 2) {
			return context.newNumber(parts[0] * 60 + parts[1]);
		}
		return context.newNumber(0);
	});
	context.setProp(qHandle, 'parseTime', parseTimeFn);
	parseTimeFn.dispose();

	// formatDuration(minutes) -> "Xh Ym"
	const formatDurationFn = context.newFunction('formatDuration', (minutesHandle) => {
		const minutes = context.dump(minutesHandle) as number;
		const h = Math.floor(minutes / 60);
		const m = Math.round(minutes % 60);
		if (h === 0) return context.newString(`${m}m`);
		if (m === 0) return context.newString(`${h}h`);
		return context.newString(`${h}h ${m}m`);
	});
	context.setProp(qHandle, 'formatDuration', formatDurationFn);
	formatDurationFn.dispose();

	// formatTime(minutes) -> "HH:MM"
	const formatTimeFn = context.newFunction('formatTime', (minutesHandle) => {
		const minutes = context.dump(minutesHandle) as number;
		const h = Math.floor(minutes / 60) % 24;
		const m = Math.round(minutes % 60);
		return context.newString(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
	});
	context.setProp(qHandle, 'formatTime', formatTimeFn);
	formatTimeFn.dispose();

	// isWeekday(date) -> boolean
	const isWeekdayFn = context.newFunction('isWeekday', (dateHandle) => {
		const dateStr = context.dump(dateHandle) as string;
		const date = new Date(dateStr);
		const day = date.getDay();
		return day > 0 && day < 6 ? context.true : context.false;
	});
	context.setProp(qHandle, 'isWeekday', isWeekdayFn);
	isWeekdayFn.dispose();

	// round(value, decimals) -> number
	const roundFn = context.newFunction('round', (valueHandle, decimalsHandle) => {
		const value = context.dump(valueHandle) as number;
		const decimals = decimalsHandle ? (context.dump(decimalsHandle) as number) : 0;
		const factor = Math.pow(10, decimals);
		return context.newNumber(Math.round(value * factor) / factor);
	});
	context.setProp(qHandle, 'round', roundFn);
	roundFn.dispose();

	context.setProp(context.global, 'q', qHandle);
	qHandle.dispose();
}

/**
 * Convert a JavaScript value to a QuickJS handle
 */
function jsonToHandle(context: QuickJSContext, value: unknown): QuickJSHandle {
	if (value === null || value === undefined) {
		return context.undefined;
	}
	if (typeof value === 'boolean') {
		return value ? context.true : context.false;
	}
	if (typeof value === 'number') {
		return context.newNumber(value);
	}
	if (typeof value === 'string') {
		return context.newString(value);
	}
	if (Array.isArray(value)) {
		const arr = context.newArray();
		for (let i = 0; i < value.length; i++) {
			const itemHandle = jsonToHandle(context, value[i]);
			context.setProp(arr, i, itemHandle);
			itemHandle.dispose();
		}
		return arr;
	}
	if (typeof value === 'object') {
		const obj = context.newObject();
		for (const [key, val] of Object.entries(value)) {
			const valHandle = jsonToHandle(context, val);
			context.setProp(obj, key, valHandle);
			valHandle.dispose();
		}
		return obj;
	}
	return context.undefined;
}

/**
 * Evaluate all metrics in a template, returning computed values
 */
export async function evaluateMetrics(
	template: MetricDefinition[],
	inputValues: MetricValues,
	externalValues: MetricValues,
	date: string
): Promise<{ values: MetricValues; errors: Record<string, string> }> {
	const values: MetricValues = {};
	const errors: Record<string, string> = {};

	for (const metric of template) {
		if (metric.type === 'input') {
			// Use input value if provided
			values[metric.name] = inputValues[metric.name] ?? null;
		} else if (metric.type === 'external') {
			// Use external source value
			values[metric.name] = externalValues[metric.name] ?? null;
		} else if (metric.type === 'computed') {
			// Evaluate expression with current values
			if (!metric.expression) {
				values[metric.name] = null;
				continue;
			}

			const result = await evaluateExpression(metric.expression, {
				metrics: values,
				date
			});

			if (result.error) {
				errors[metric.name] = result.error;
				values[metric.name] = null;
			} else {
				values[metric.name] = result.value;
			}
		}
	}

	return { values, errors };
}
