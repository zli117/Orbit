<svelte:head>
	<title>API Reference - Query Builder - OKR Tracker</title>
</svelte:head>

<div class="api-reference">
	<header class="page-header">
		<h1>Query Builder API Reference</h1>
		<p class="subtitle">Complete reference for writing JavaScript queries in OKR Tracker's sandboxed environment.</p>
	</header>

	<nav class="toc">
		<h2>Contents</h2>
		<ol>
			<li><a href="#overview">Overview</a></li>
			<li><a href="#execution-model">Execution Model</a></li>
			<li>
				<a href="#data-fetching">Data Fetching (<code>q</code>)</a>
				<ol>
					<li><a href="#q-daily">q.daily()</a></li>
					<li><a href="#q-tasks">q.tasks()</a></li>
					<li><a href="#q-objectives">q.objectives()</a></li>
					<li><a href="#q-today">q.today()</a></li>
				</ol>
			</li>
			<li>
				<a href="#helpers">Helper Functions (<code>q</code>)</a>
				<ol>
					<li><a href="#q-sum">q.sum()</a></li>
					<li><a href="#q-avg">q.avg()</a></li>
					<li><a href="#q-count">q.count()</a></li>
					<li><a href="#q-parseTime">q.parseTime()</a></li>
					<li><a href="#q-formatDuration">q.formatDuration()</a></li>
					<li><a href="#q-formatPercent">q.formatPercent()</a></li>
				</ol>
			</li>
			<li>
				<a href="#render">Rendering (<code>render</code>)</a>
				<ol>
					<li><a href="#render-markdown">render.markdown()</a></li>
					<li><a href="#render-table">render.table()</a></li>
					<li><a href="#render-plot-bar">render.plot.bar()</a></li>
					<li><a href="#render-plot-line">render.plot.line()</a></li>
					<li><a href="#render-plot-pie">render.plot.pie()</a></li>
					<li><a href="#render-plot-multi">render.plot.multi()</a></li>
				</ol>
			</li>
			<li><a href="#progress">Progress (<code>progress</code>)</a></li>
			<li><a href="#params">Parameters (<code>params</code>)</a></li>
			<li><a href="#data-schemas">Data Schemas</a></li>
			<li><a href="#examples">Complete Examples</a></li>
			<li><a href="#limits">Limits &amp; Constraints</a></li>
		</ol>
	</nav>

	<!-- Overview -->
	<section id="overview">
		<h2>Overview</h2>
		<p>The Query Builder lets you write JavaScript code that runs in a sandboxed <strong>QuickJS</strong> environment (WebAssembly). Your code can fetch your OKR data, compute aggregations, and render results as markdown, tables, or interactive charts.</p>
		<p>Queries are used in three contexts:</p>
		<ul>
			<li><strong>General analysis</strong> &mdash; Ad-hoc exploration in the Query Builder page. Output via <code>render.*</code>.</li>
			<li><strong>Key Result progress</strong> &mdash; Automatically score a Key Result by calling <code>progress.set(value)</code>. The value (0&ndash;1) becomes the KR's score.</li>
			<li><strong>Dashboard widgets</strong> &mdash; Saved queries whose rendered output is displayed as a card on your dashboard.</li>
		</ul>
		<p>Four global objects are available in every query:</p>
		<div class="globals-grid">
			<div class="global-card">
				<code>q</code>
				<span>Fetch data and compute aggregations</span>
			</div>
			<div class="global-card">
				<code>render</code>
				<span>Output markdown, tables, and charts</span>
			</div>
			<div class="global-card">
				<code>progress</code>
				<span>Set Key Result progress (0&ndash;1)</span>
			</div>
			<div class="global-card">
				<code>params</code>
				<span>Runtime parameters passed from the client</span>
			</div>
		</div>
	</section>

	<!-- Execution Model -->
	<section id="execution-model">
		<h2>Execution Model</h2>
		<p>Your code is automatically wrapped in an <code>async</code> function, so you can use <code>await</code> at the top level:</p>
		<pre><code>{`// This works — no need to wrap in async function
const { year, month } = q.today();
const days = await q.daily({ year, month });
render.markdown(\`Found \${days.length} days\`);`}</code></pre>

		<p>Internally, your code becomes:</p>
		<pre><code>{`(async () => {
    // your code here
})()`}</code></pre>

		<h3>Return values</h3>
		<p>The last expression in your code is captured as the query's return value and displayed as JSON in the "Return Value" section. This is optional &mdash; most queries use <code>render.*</code> instead.</p>
		<pre><code>{`// The object below is returned and shown as JSON
const { year } = q.today();
const tasks = await q.tasks({ year });
({ total: tasks.length, completed: tasks.filter(t => t.completed).length })`}</code></pre>

		<h3>Error handling</h3>
		<p>If your code throws an error, the error message is shown in the results panel. Stack traces and file paths are stripped for security. Standard <code>try/catch</code> works inside the sandbox.</p>
	</section>

	<!-- Data Fetching -->
	<section id="data-fetching">
		<h2>Data Fetching (<code>q</code>)</h2>
		<p>All data-fetching methods are <strong>async</strong> and return promises. They only return data belonging to the current user.</p>

		<h3>Common Filter Parameters</h3>
		<p>All three methods accept an optional filters object:</p>
		<pre><code>{`interface QueryFilters {
  year?: number;       // Filter by year (e.g., 2025)
  month?: number;      // Filter by month (1-12)
  week?: number;       // Filter by ISO week number (1-53)
  from?: string;       // Start date, inclusive (YYYY-MM-DD)
  to?: string;         // End date, inclusive (YYYY-MM-DD)
  completed?: boolean; // Filter tasks by completion status
  tag?: string;        // Filter tasks by tag name
  periodId?: string;   // Filter by specific time period ID
  level?: 'yearly' | 'monthly'; // Filter objectives by level
}`}</code></pre>
		<p>All filters are optional. Omit the parameter entirely or pass <code>{'{}'}</code> to get all data.</p>

		<!-- q.daily -->
		<article id="q-daily">
			<h3><code>q.daily(filters?)</code></h3>
			<p>Fetch daily records including metrics, tasks, and computed totals. Returns an array sorted by date ascending.</p>

			<h4>Relevant filters</h4>
			<ul>
				<li><code>year</code> &mdash; Filter to a specific year</li>
				<li><code>month</code> &mdash; Filter to a specific month (combine with <code>year</code>)</li>
				<li><code>week</code> &mdash; Filter to a specific ISO week number</li>
				<li><code>from</code>, <code>to</code> &mdash; Date range filter (both inclusive, format YYYY-MM-DD)</li>
			</ul>

			<h4>Return type: <code>DailyRecord[]</code></h4>
			<pre><code>{`interface DailyRecord {
  date: string;              // ISO date "YYYY-MM-DD"
  year: number;
  month: number;             // 1-12
  week: number;              // ISO week 1-53

  // Metrics from your metrics template
  // Keys depend on your configured template and connected plugins.
  // Numbers are auto-parsed; time strings (e.g., "7:30") stay as strings.
  // Example keys: "sleep", "steps", "fitbit.sleepLength", etc.
  metrics: Record<string, string | number | null>;

  // Tasks for this day
  tasks: TaskWithAttributes[];     // See schema below
  completedTasks: number;          // Count of completed tasks
  totalTasks: number;              // Total task count
  totalHours: number;              // Sum of "hour" attribute across tasks
}`}</code></pre>

			<h4>Nested type: <code>TaskWithAttributes</code></h4>
			<pre><code>{`interface TaskWithAttributes {
  id: string;
  title: string;
  completed: boolean;
  completedAt: Date | null;
  attributes: Record<string, string>;
  // Common attribute keys:
  //   "hour"     - hours spent (e.g., "2.5")
  //   "progress" - completion progress 0-1 (e.g., "0.75")
  //   "expected_hours" - planned hours (e.g., "4")
}`}</code></pre>

			<h4>About <code>metrics</code></h4>
			<p>The keys in <code>metrics</code> depend on your configured metrics template (Settings &gt; Metrics). For example:</p>
			<ul>
				<li>User-input metrics: <code>metrics.sleep</code>, <code>metrics.mood</code></li>
				<li>Plugin (external) metrics: <code>metrics['fitbit.sleepLength']</code>, <code>metrics['fitbit.steps']</code></li>
				<li>Computed metrics: <code>metrics.sleepScore</code></li>
			</ul>
			<p>Use <code>Object.keys(day.metrics)</code> to discover available keys at runtime.</p>

			<h4>Examples</h4>
			<pre><code>{`// Get current month's daily records
const { year, month } = q.today();
const days = await q.daily({ year, month });

// Get records for a date range
const week = await q.daily({
  from: '2025-01-06',
  to: '2025-01-12'
});

// Calculate average sleep (assuming a "sleep" metric in HH:MM format)
const { year: y, month: m } = q.today();
const jan = await q.daily({ year: y, month: m });
const sleepDays = jan.filter(d => d.metrics.sleep);
const avgSleepMin = sleepDays.reduce(
  (sum, d) => sum + q.parseTime(d.metrics.sleep),
  0
) / sleepDays.length;
render.markdown(\`Average sleep: \${q.formatDuration(avgSleepMin)}\`);

// Show daily task completion rate
const days2 = await q.daily({ year: y, month: m });
render.plot.line({
  x: days2.map(d => d.date),
  y: days2.map(d =>
    d.totalTasks > 0 ? d.completedTasks / d.totalTasks * 100 : 0
  ),
  title: 'Daily Completion Rate (%)',
  yLabel: 'Completion %'
});

// List all available metric keys for a day
const sample = days[0];
if (sample) {
  render.markdown('Available metrics: ' + Object.keys(sample.metrics).join(', '));
}`}</code></pre>
		</article>

		<!-- q.tasks -->
		<article id="q-tasks">
			<h3><code>q.tasks(filters?)</code></h3>
			<p>Fetch tasks with their attributes and tags. Returns tasks from all time period types (daily, weekly, monthly, yearly).</p>

			<h4>Relevant filters</h4>
			<ul>
				<li><code>year</code> &mdash; Filter to tasks in time periods of a specific year</li>
				<li><code>completed</code> &mdash; <code>true</code> for completed only, <code>false</code> for incomplete only</li>
				<li><code>tag</code> &mdash; Filter to tasks tagged with this exact tag name (case-sensitive)</li>
				<li><code>periodId</code> &mdash; Filter to tasks in a specific time period</li>
			</ul>

			<h4>Return type: <code>TaskRecord[]</code></h4>
			<pre><code>{`interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;  // ISO timestamp or null

  // Time period context
  date: string | null;   // "YYYY-MM-DD" for daily tasks, null otherwise
  year: number | null;
  month: number | null;
  week: number | null;

  // Flexible attributes as key-value pairs
  attributes: Record<string, string>;

  // Tags assigned to this task
  tags: string[];  // Array of tag names (e.g., ["work", "ai_research"])

  // Pre-parsed common attributes for convenience
  hour: number;      // Parsed from attributes.hour (0 if not set)
  progress: number;  // Parsed from attributes.progress (0 if not set)
}`}</code></pre>

			<h4>Examples</h4>
			<pre><code>{`// Get all tasks for 2025
const allTasks = await q.tasks({ year: 2025 });

// Get only completed tasks tagged "work"
const workDone = await q.tasks({
  year: 2025,
  completed: true,
  tag: 'work'
});

// Total hours by tag
const tasks = await q.tasks({ year: 2025 });
const hoursByTag = {};
tasks.forEach(t => {
  t.tags.forEach(tag => {
    hoursByTag[tag] = (hoursByTag[tag] || 0) + t.hour;
  });
});

render.table({
  headers: ['Tag', 'Hours'],
  rows: Object.entries(hoursByTag)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, hours]) => [tag, hours.toFixed(1)])
});

// Task completion over time
const tasks2 = await q.tasks({ year: 2025 });
const byMonth = {};
tasks2.forEach(t => {
  if (t.month) {
    const key = t.month;
    if (!byMonth[key]) byMonth[key] = { done: 0, total: 0 };
    byMonth[key].total++;
    if (t.completed) byMonth[key].done++;
  }
});

const months = Object.keys(byMonth).sort((a, b) => a - b);
render.plot.bar({
  x: months.map(m => \`Month \${m}\`),
  y: months.map(m => byMonth[m].done / byMonth[m].total * 100),
  title: 'Monthly Completion Rate (%)',
  yLabel: '%'
});`}</code></pre>
		</article>

		<!-- q.objectives -->
		<article id="q-objectives">
			<h3><code>q.objectives(filters?)</code></h3>
			<p>Fetch objectives with their key results and weighted scores.</p>

			<h4>Relevant filters</h4>
			<ul>
				<li><code>year</code> &mdash; Filter to objectives for a specific year</li>
				<li><code>level</code> &mdash; <code>'yearly'</code> or <code>'monthly'</code></li>
			</ul>

			<h4>Return type: <code>ObjectiveRecord[]</code></h4>
			<pre><code>{`interface ObjectiveRecord {
  id: string;
  title: string;
  description: string | null;
  level: 'yearly' | 'monthly';
  year: number;
  month: number | null;  // Only set for monthly objectives
  weight: number;        // Objective weight for overall scoring
  score: number;         // Weighted average of KR scores (0-1)
  keyResults: KeyResultRecord[];
}

interface KeyResultRecord {
  id: string;
  title: string;
  score: number;           // 0-1 (0% to 100%)
  weight: number;          // Weight within its objective
  expectedHours: number | null;
}`}</code></pre>

			<h4>Score calculation</h4>
			<p>The <code>score</code> on each objective is the weighted average of its key results:</p>
			<pre><code>{`score = sum(kr.score * kr.weight) / sum(kr.weight)`}</code></pre>

			<h4>Examples</h4>
			<pre><code>{`// Get yearly objectives for 2025
const yearly = await q.objectives({ year: 2025, level: 'yearly' });

// Overall yearly progress
const totalWeight = yearly.reduce((s, o) => s + o.weight, 0);
const weightedScore = yearly.reduce(
  (s, o) => s + o.score * o.weight,
  0
) / totalWeight;
render.markdown(\`## Yearly Progress: \${(weightedScore * 100).toFixed(0)}%\`);

// Objective scorecard
render.table({
  headers: ['Objective', 'Score', 'Key Results'],
  rows: yearly.map(o => [
    o.title,
    \`\${(o.score * 100).toFixed(0)}%\`,
    o.keyResults.length
  ])
});

// Monthly objectives breakdown
const monthly = await q.objectives({ year: 2025, level: 'monthly' });
const byMonth = {};
monthly.forEach(o => {
  if (!byMonth[o.month]) byMonth[o.month] = [];
  byMonth[o.month].push(o);
});

for (const [month, objs] of Object.entries(byMonth)) {
  const avg = objs.reduce((s, o) => s + o.score, 0) / objs.length;
  render.markdown(\`### Month \${month}: \${(avg * 100).toFixed(0)}%\`);
}`}</code></pre>
		</article>

		<!-- q.today -->
		<article id="q-today">
			<h3><code>q.today()</code></h3>
			<p>Returns the current date as an object with pre-parsed fields. Synchronous &mdash; no <code>await</code> needed. Use it to avoid hardcoding dates in filters.</p>

			<h4>Return type: <code>TodayResult</code></h4>
			<pre><code>{`interface TodayResult {
  year: number;    // e.g., 2025
  month: number;   // 1-12
  day: number;     // 1-31
  date: string;    // "YYYY-MM-DD" (e.g., "2025-06-15")
  week: number;    // ISO week 1-53
}`}</code></pre>

			<h4>Examples</h4>
			<pre><code>{`// Get current month's daily records
const { year, month } = q.today();
const days = await q.daily({ year, month });

// Get this week's tasks
const { year: y, week } = q.today();
const tasks = await q.tasks({ year: y });
const weekTasks = tasks.filter(t => t.week === week);

// Use date string for range queries
const { date } = q.today();
const recent = await q.daily({ from: '2025-01-01', to: date });

// Show today's info
const t = q.today();
render.markdown(\`Today is \${t.date} (week \${t.week})\`);`}</code></pre>
		</article>
	</section>

	<!-- Helper Functions -->
	<section id="helpers">
		<h2>Helper Functions (<code>q</code>)</h2>
		<p>Convenience functions for common aggregations and formatting. These are synchronous (no <code>await</code> needed).</p>

		<article id="q-sum">
			<h3><code>q.sum(items, field)</code></h3>
			<p>Sum a numeric field across an array of objects. Non-numeric values are treated as 0.</p>
			<pre><code>{`// Parameters
q.sum(items: object[], field: string): number

// Examples
const days = await q.daily({ year: 2025, month: 1 });
const totalHours = q.sum(days, 'totalHours');       // e.g., 45.5
const totalSteps = q.sum(days, 'steps');             // e.g., 150000
const totalTasks = q.sum(days, 'totalTasks');        // e.g., 93`}</code></pre>
		</article>

		<article id="q-avg">
			<h3><code>q.avg(items, field)</code></h3>
			<p>Average a numeric field. Returns 0 for empty arrays.</p>
			<pre><code>{`// Parameters
q.avg(items: object[], field: string): number

// Examples
const days = await q.daily({ year: 2025, month: 1 });
const avgSteps = q.avg(days, 'steps');           // e.g., 8500
const avgHours = q.avg(days, 'totalHours');      // e.g., 3.2`}</code></pre>
		</article>

		<article id="q-count">
			<h3><code>q.count(items)</code></h3>
			<p>Count items in an array. Equivalent to <code>items.length</code> but works with the sandbox's array handles.</p>
			<pre><code>{`// Parameters
q.count(items: any[]): number

// Examples
const tasks = await q.tasks({ year: 2025 });
const total = q.count(tasks);                        // e.g., 120
const done = q.count(tasks.filter(t => t.completed)); // e.g., 85`}</code></pre>
		</article>

		<article id="q-parseTime">
			<h3><code>q.parseTime(timeStr)</code></h3>
			<p>Parse an "HH:MM" time string into total minutes. Useful for working with time-format metrics (e.g., sleep duration, wake-up time).</p>
			<pre><code>{`// Parameters
q.parseTime(timeStr: string): number  // Returns minutes

// Examples
q.parseTime('7:30')   // 450 (minutes)
q.parseTime('0:45')   // 45
q.parseTime('12:00')  // 720
q.parseTime(null)     // 0

// Convert to hours
const hours = q.parseTime('7:30') / 60;  // 7.5

// Average sleep in hours (assuming a "sleep" metric in HH:MM format)
const { year, month } = q.today();
const days = await q.daily({ year, month });
const sleepDays = days.filter(d => d.metrics.sleep);
const avgSleepHrs = sleepDays.reduce(
  (sum, d) => sum + q.parseTime(d.metrics.sleep) / 60,
  0
) / sleepDays.length;`}</code></pre>
		</article>

		<article id="q-formatDuration">
			<h3><code>q.formatDuration(minutes)</code></h3>
			<p>Format a number of minutes into a human-readable duration string.</p>
			<pre><code>{`// Parameters
q.formatDuration(minutes: number): string

// Examples
q.formatDuration(450)  // "7h 30m"
q.formatDuration(90)   // "1h 30m"
q.formatDuration(60)   // "1h"
q.formatDuration(45)   // "45m"
q.formatDuration(0)    // "0m"`}</code></pre>
		</article>

		<article id="q-formatPercent">
			<h3><code>q.formatPercent(value, total)</code></h3>
			<p>Format a fraction as a percentage string. Returns "0%" if total is 0.</p>
			<pre><code>{`// Parameters
q.formatPercent(value: number, total: number): string

// Examples
q.formatPercent(7, 10)    // "70%"
q.formatPercent(3, 4)     // "75%"
q.formatPercent(0, 0)     // "0%"
q.formatPercent(85, 100)  // "85%"`}</code></pre>
		</article>
	</section>

	<!-- Render API -->
	<section id="render">
		<h2>Rendering (<code>render</code>)</h2>
		<p>All <code>render.*</code> calls append output to the results panel. You can call them multiple times to build up a composite result with mixed content types. Order is preserved.</p>

		<article id="render-markdown">
			<h3><code>render.markdown(text)</code></h3>
			<p>Render a string as formatted markdown. Supports headings, bold, italic, lists, links, inline code, and tables (standard markdown syntax).</p>
			<pre><code>{`// Parameters
render.markdown(text: string): void

// Examples
render.markdown('# Monthly Report');
render.markdown('Tasks completed: **42**');
render.markdown(\`
## Summary

- Total hours: \${totalHours.toFixed(1)}
- Completion rate: \${(rate * 100).toFixed(0)}%
- Best day: \${bestDay.date}

> Keep up the good work!
\`);`}</code></pre>
		</article>

		<article id="render-table">
			<h3><code>render.table(data)</code></h3>
			<p>Render a structured table with headers and rows.</p>
			<pre><code>{`// Parameters
render.table(data: {
  headers: string[];
  rows: (string | number)[][];
}): void

// Example
const tasks = await q.tasks({ year: 2025, completed: true });
render.table({
  headers: ['Task', 'Hours', 'Tags'],
  rows: tasks.slice(0, 20).map(t => [
    t.title,
    t.hour.toFixed(1),
    t.tags.join(', ')
  ])
});

// Empty state handling
const data = await q.tasks({ year: 2025, tag: 'exercise' });
if (data.length === 0) {
  render.markdown('*No exercise tasks found.*');
} else {
  render.table({
    headers: ['Date', 'Task', 'Duration'],
    rows: data.map(t => [t.date || '-', t.title, t.hour + 'h'])
  });
}`}</code></pre>
		</article>

		<article id="render-plot-bar">
			<h3><code>render.plot.bar(options)</code></h3>
			<p>Render an interactive bar chart (powered by Plotly.js).</p>
			<pre><code>{`// Parameters
render.plot.bar(options: {
  x: (string | number)[];  // Category labels or numeric X values
  y: number[];             // Bar heights
  title?: string;          // Chart title
  xLabel?: string;         // X-axis label
  yLabel?: string;         // Y-axis label
  color?: string;          // Bar color (hex or CSS name, e.g., "#3b82f6")
}): void

// Example: Steps per day (assumes a "steps" or "fitbit.steps" metric)
const { year, month } = q.today();
const days = await q.daily({ year, month });
render.plot.bar({
  x: days.map(d => d.date),
  y: days.map(d => d.metrics.steps || d.metrics['fitbit.steps'] || 0),
  title: 'Daily Steps',
  yLabel: 'Steps',
  color: '#22c55e'
});

// Example: Hours by tag
const tasks = await q.tasks({ year: 2025 });
const byTag = {};
tasks.forEach(t => t.tags.forEach(tag => {
  byTag[tag] = (byTag[tag] || 0) + t.hour;
}));
const sorted = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
render.plot.bar({
  x: sorted.map(([tag]) => tag),
  y: sorted.map(([, hours]) => hours),
  title: 'Hours Invested by Tag',
  yLabel: 'Hours',
  color: '#3b82f6'
});`}</code></pre>
		</article>

		<article id="render-plot-line">
			<h3><code>render.plot.line(options)</code></h3>
			<p>Render an interactive line chart with markers.</p>
			<pre><code>{`// Parameters
render.plot.line(options: {
  x: (string | number)[];  // X-axis values (dates, numbers, etc.)
  y: number[];             // Y-axis values
  title?: string;          // Chart title
  xLabel?: string;         // X-axis label
  yLabel?: string;         // Y-axis label
  color?: string;          // Line/marker color
}): void

// Example: Sleep trend (assumes a "sleep" metric in HH:MM format)
const { year, month } = q.today();
const days = await q.daily({ year, month });
const sleepDays = days.filter(d => d.metrics.sleep);
render.plot.line({
  x: sleepDays.map(d => d.date),
  y: sleepDays.map(d => q.parseTime(d.metrics.sleep) / 60),
  title: 'Sleep Duration Over Time',
  yLabel: 'Hours',
  color: '#8b5cf6'
});

// Example: Cumulative hours worked
const days2 = await q.daily({ year, month });
let cumulative = 0;
render.plot.line({
  x: days2.map(d => d.date),
  y: days2.map(d => {
    cumulative += d.totalHours;
    return cumulative;
  }),
  title: 'Cumulative Hours Worked',
  yLabel: 'Total Hours'
});`}</code></pre>
		</article>

		<article id="render-plot-pie">
			<h3><code>render.plot.pie(options)</code></h3>
			<p>Render an interactive pie/donut chart.</p>
			<pre><code>{`// Parameters
render.plot.pie(options: {
  values: number[];   // Slice sizes
  labels: string[];   // Slice labels
  title?: string;     // Chart title
}): void

// Example: Time allocation by tag
const tasks = await q.tasks({ year: 2025 });
const byTag = {};
tasks.forEach(t => t.tags.forEach(tag => {
  byTag[tag] = (byTag[tag] || 0) + t.hour;
}));

render.plot.pie({
  labels: Object.keys(byTag),
  values: Object.values(byTag),
  title: 'Time Allocation'
});

// Example: Task completion breakdown
const all = await q.tasks({ year: 2025, month: 1 });
const done = all.filter(t => t.completed).length;
const pending = all.length - done;
render.plot.pie({
  labels: ['Completed', 'Pending'],
  values: [done, pending],
  title: 'Task Status'
});`}</code></pre>
		</article>

		<article id="render-plot-multi">
			<h3><code>render.plot.multi(options)</code></h3>
			<p>Render multiple line series on a single chart. Each series gets its own legend entry.</p>
			<pre><code>{`// Parameters
render.plot.multi(options: {
  series: Array<{
    x: (string | number)[];
    y: number[];
    name: string;        // Legend label
    color?: string;      // Line color
  }>;
  title?: string;
  xLabel?: string;
  yLabel?: string;
}): void

// Example: Compare sleep vs. productivity
const { year, month } = q.today();
const days = await q.daily({ year, month });
const valid = days.filter(d => d.metrics.sleep && d.totalTasks > 0);
render.plot.multi({
  series: [
    {
      x: valid.map(d => d.date),
      y: valid.map(d => q.parseTime(d.metrics.sleep) / 60),
      name: 'Sleep (hours)',
      color: '#8b5cf6'
    },
    {
      x: valid.map(d => d.date),
      y: valid.map(d => d.totalHours),
      name: 'Work (hours)',
      color: '#f59e0b'
    }
  ],
  title: 'Sleep vs. Work Hours'
});

// Example: Monthly task completion by tag
const tags = ['work', 'health', 'learning'];
const series = [];
for (const tag of tags) {
  const tasks = await q.tasks({ year: 2025, tag });
  const byMonth = {};
  tasks.forEach(t => {
    if (t.month) {
      byMonth[t.month] = byMonth[t.month] || { done: 0, total: 0 };
      byMonth[t.month].total++;
      if (t.completed) byMonth[t.month].done++;
    }
  });
  const months = Object.keys(byMonth).sort();
  series.push({
    x: months.map(m => \`Month \${m}\`),
    y: months.map(m => byMonth[m].total > 0
      ? (byMonth[m].done / byMonth[m].total * 100) : 0
    ),
    name: tag
  });
}
render.plot.multi({
  series,
  title: 'Completion Rate by Tag (%)',
  yLabel: '%'
});`}</code></pre>
		</article>
	</section>

	<!-- Progress API -->
	<section id="progress">
		<h2>Progress (<code>progress</code>)</h2>
		<p>Used exclusively for <strong>Key Result progress queries</strong>. When a KR uses "Custom Query" measurement, this is how the score is computed.</p>

		<h3><code>progress.set(value)</code></h3>
		<pre><code>{`// Parameters
progress.set(value: number): void
// value: 0 to 1 (clamped automatically)
//   0   = 0% complete
//   0.5 = 50% complete
//   1   = 100% complete`}</code></pre>

		<h4>Rules</h4>
		<ul>
			<li>Values outside 0&ndash;1 are clamped (e.g., <code>-0.5</code> becomes <code>0</code>, <code>1.5</code> becomes <code>1</code>)</li>
			<li>If <code>progress.set()</code> is never called in a KR progress query, the query returns an error</li>
			<li>Only the last call matters if called multiple times</li>
			<li>Can be combined with <code>render.*</code> calls to show a visual breakdown alongside the progress value</li>
		</ul>

		<h4>Examples</h4>
		<pre><code>{`// Simple: percentage of tagged tasks completed
const tasks = await q.tasks({ year: 2025, tag: 'Q1_Goal' });
if (tasks.length === 0) {
  progress.set(0);
} else {
  progress.set(
    tasks.filter(t => t.completed).length / tasks.length
  );
}

// Hours-based progress: track hours against a target
const TARGET_HOURS = 100;
const tasks2 = await q.tasks({ year: 2025, tag: 'deep_work' });
const totalHours = tasks2.reduce((sum, t) => sum + t.hour, 0);
progress.set(totalHours / TARGET_HOURS);
render.markdown(\`\${totalHours.toFixed(1)} / \${TARGET_HOURS} hours\`);

// Weighted multi-criteria progress
const tasks3 = await q.tasks({ year: 2025, tag: 'project_x' });
const completionRate = tasks3.filter(t => t.completed).length / tasks3.length;
const hoursRate = Math.min(1,
  tasks3.reduce((s, t) => s + t.hour, 0) / 50
);
// 60% weight on completion, 40% on hours
const weighted = completionRate * 0.6 + hoursRate * 0.4;
progress.set(weighted);`}</code></pre>
	</section>

	<!-- Params -->
	<section id="params">
		<h2>Parameters (<code>params</code>)</h2>
		<p>The <code>params</code> object contains runtime parameters passed from the client when executing the query. This enables reusable queries that adapt to different inputs.</p>

		<pre><code>{`// params is a plain object — access properties directly
const t = q.today();
const year = params.year || t.year;
const month = params.month || t.month;
const tagFilter = params.tag || null;

const tasks = await q.tasks({ year, month });
const filtered = tagFilter
  ? tasks.filter(t => t.tags.includes(tagFilter))
  : tasks;`}</code></pre>

		<h3>Default values pattern</h3>
		<p>Always provide defaults since <code>params</code> may be empty:</p>
		<pre><code>{`const { year } = q.today();
const y = params.year || year;
const limit = params.limit || 10;
const showChart = params.showChart !== false; // default true`}</code></pre>
	</section>

	<!-- Data Schemas -->
	<section id="data-schemas">
		<h2>Data Schemas</h2>
		<p>The underlying database tables that drive the query API. Understanding these helps you know what data is available.</p>

		<h3>Time periods</h3>
		<p>All tasks and metrics are organized into time periods. Each period has a type (<code>yearly</code>, <code>monthly</code>, <code>weekly</code>, <code>daily</code>) and scoping fields (<code>year</code>, <code>month</code>, <code>week</code>, <code>day</code>).</p>

		<h3>Tasks</h3>
		<p>Tasks belong to time periods. Each task has:</p>
		<ul>
			<li><code>title</code> &mdash; The task name</li>
			<li><code>completed</code> / <code>completedAt</code> &mdash; Completion status and timestamp</li>
			<li><code>timeSpentMs</code> &mdash; Tracked time in milliseconds (from built-in timer)</li>
			<li><code>sortOrder</code> &mdash; Display order within the period</li>
		</ul>

		<h3>Task attributes</h3>
		<p>Flexible key-value pairs on tasks. Common keys:</p>
		<table class="schema-table">
			<thead>
				<tr><th>Key</th><th>Type</th><th>Description</th></tr>
			</thead>
			<tbody>
				<tr><td><code>hour</code></td><td>number</td><td>Hours spent on the task (e.g., "2.5")</td></tr>
				<tr><td><code>progress</code></td><td>number</td><td>Progress 0 to 1 (e.g., "0.75")</td></tr>
				<tr><td><code>expected_hours</code></td><td>number</td><td>Planned/budgeted hours</td></tr>
			</tbody>
		</table>
		<p>All attribute values are stored as strings. The query API pre-parses <code>hour</code> and <code>progress</code> as numbers on <code>TaskRecord</code>.</p>

		<h3>Tags</h3>
		<p>Tags categorize tasks. Each tag has a <code>name</code>, optional <code>color</code> (hex), and optional <code>category</code>. Tasks can have multiple tags. Use the <code>tag</code> filter in <code>q.tasks()</code> to filter by tag name.</p>

		<h3>Objectives &amp; key results</h3>
		<p>Objectives are yearly or monthly goals. Each has weighted key results. KR measurement types:</p>
		<table class="schema-table">
			<thead>
				<tr><th>Type</th><th>Description</th></tr>
			</thead>
			<tbody>
				<tr><td><code>slider</code></td><td>Manual 0&ndash;100% slider</td></tr>
				<tr><td><code>checkboxes</code></td><td>Checklist items, score = completed / total</td></tr>
				<tr><td><code>custom_query</code></td><td>JavaScript query that calls <code>progress.set()</code></td></tr>
			</tbody>
		</table>

		<h3>Daily metrics</h3>
		<p>Metrics are defined by your <strong>metrics template</strong> (Settings &gt; Metrics). Each metric has a <code>name</code> used as the key in <code>DailyRecord.metrics</code>. Three metric types are supported:</p>
		<table class="schema-table">
			<thead>
				<tr><th>Type</th><th>Description</th><th>Example key</th></tr>
			</thead>
			<tbody>
				<tr><td><code>input</code></td><td>User-entered value (number, time, text, boolean)</td><td><code>sleep</code>, <code>mood</code></td></tr>
				<tr><td><code>computed</code></td><td>Calculated from other metrics via a JS expression</td><td><code>sleepScore</code></td></tr>
				<tr><td><code>external</code></td><td>Synced from a plugin (e.g., Fitbit)</td><td><code>fitbit.steps</code></td></tr>
			</tbody>
		</table>
		<p>Use <code>Object.keys(day.metrics)</code> to discover which metrics are available for a given day. Numeric values are auto-parsed; time strings like "7:30" remain as strings (use <code>q.parseTime()</code> to convert).</p>
	</section>

	<!-- Complete Examples -->
	<section id="examples">
		<h2>Complete Examples</h2>

		<article>
			<h3>Weekly productivity report</h3>
			<pre><code>{`const { year, week } = q.today();
const days = await q.daily({ year, week });

const totalHours = q.sum(days, 'totalHours');
const totalCompleted = q.sum(days, 'completedTasks');
const totalTasks = q.sum(days, 'totalTasks');

// Sleep average (if you have a "sleep" metric)
const sleepDays = days.filter(d => d.metrics.sleep);
const avgSleep = sleepDays.length > 0
  ? sleepDays.reduce((s, d) => s + q.parseTime(d.metrics.sleep) / 60, 0)
    / sleepDays.length
  : 0;

render.markdown(\`
# Week \${week} Report

| Metric | Value |
|--------|-------|
| Hours worked | \${totalHours.toFixed(1)} |
| Tasks completed | \${totalCompleted}/\${totalTasks} |
| Completion rate | \${q.formatPercent(totalCompleted, totalTasks)} |
\${avgSleep ? '| Avg sleep | ' + avgSleep.toFixed(1) + 'h |' : ''}
\`);

render.plot.bar({
  x: days.map(d => d.date),
  y: days.map(d => d.totalHours),
  title: 'Hours by Day',
  color: '#3b82f6'
});`}</code></pre>
		</article>

		<article>
			<h3>Tag-based time analysis with pie chart</h3>
			<pre><code>{`const tasks = await q.tasks({ year: 2025 });
const byTag = {};
let untagged = 0;

tasks.forEach(t => {
  if (t.tags.length === 0) {
    untagged += t.hour;
  } else {
    t.tags.forEach(tag => {
      byTag[tag] = (byTag[tag] || 0) + t.hour;
    });
  }
});

if (untagged > 0) byTag['(untagged)'] = untagged;

const sorted = Object.entries(byTag)
  .sort((a, b) => b[1] - a[1]);

render.markdown(\`# Time Investment - 2025\\n\\nTotal: \${
  sorted.reduce((s, [, h]) => s + h, 0).toFixed(1)
} hours across \${sorted.length} categories\`);

render.plot.pie({
  labels: sorted.map(([tag]) => tag),
  values: sorted.map(([, hours]) => hours),
  title: 'Hours by Category'
});

render.table({
  headers: ['Category', 'Hours', 'Share'],
  rows: sorted.map(([tag, hours]) => {
    const total = sorted.reduce((s, [, h]) => s + h, 0);
    return [tag, hours.toFixed(1), q.formatPercent(hours, total)];
  })
});`}</code></pre>
		</article>

		<article>
			<h3>KR progress: Course completion tracker</h3>
			<pre><code>{`// Attach to a Key Result to auto-calculate progress
const tasks = await q.tasks({
  year: 2025,
  tag: 'ml_course'
});

const completed = tasks.filter(t => t.completed).length;
const total = tasks.length;

if (total === 0) {
  progress.set(0);
  render.markdown('No course tasks found. Add tasks tagged "ml_course".');
} else {
  progress.set(completed / total);

  render.markdown(\`## ML Course Progress\\n\\n\${completed}/\${total} modules completed\`);

  render.table({
    headers: ['Module', 'Status', 'Hours'],
    rows: tasks.map(t => [
      t.title,
      t.completed ? 'Done' : 'Pending',
      t.hour.toFixed(1)
    ])
  });
}`}</code></pre>
		</article>

		<article>
			<h3>Sleep quality correlation</h3>
			<pre><code>{`const { year } = q.today();
const days = await q.daily({ year });
const valid = days.filter(d =>
  d.metrics.sleep && d.totalTasks > 0
);

// Scatter-style analysis using multi-line
const shortSleep = valid.filter(d => q.parseTime(d.metrics.sleep) / 60 < 7);
const goodSleep = valid.filter(d => q.parseTime(d.metrics.sleep) / 60 >= 7);

const avgProdShort = shortSleep.length > 0
  ? shortSleep.reduce((s, d) => s + d.totalHours, 0) / shortSleep.length
  : 0;
const avgProdGood = goodSleep.length > 0
  ? goodSleep.reduce((s, d) => s + d.totalHours, 0) / goodSleep.length
  : 0;

render.markdown(\`
# Sleep & Productivity

| Sleep Category | Days | Avg Work Hours |
|---------------|------|----------------|
| < 7 hours | \${shortSleep.length} | \${avgProdShort.toFixed(1)} |
| >= 7 hours | \${goodSleep.length} | \${avgProdGood.toFixed(1)} |
\`);

render.plot.multi({
  series: [
    {
      x: valid.map(d => d.date),
      y: valid.map(d => q.parseTime(d.metrics.sleep) / 60),
      name: 'Sleep (hours)',
      color: '#8b5cf6'
    },
    {
      x: valid.map(d => d.date),
      y: valid.map(d => d.totalHours),
      name: 'Work (hours)',
      color: '#f59e0b'
    }
  ],
  title: 'Sleep vs. Productivity Over Time'
});`}</code></pre>
		</article>

		<article>
			<h3>Dashboard widget: Today's snapshot</h3>
			<pre><code>{`const { date } = q.today();
const days = await q.daily({ from: date, to: date });

if (days.length === 0) {
  render.markdown('No data for today yet.');
} else {
  const day = days[0];
  const pct = day.totalTasks > 0
    ? (day.completedTasks / day.totalTasks * 100).toFixed(0)
    : '0';

  const m = day.metrics;
  render.markdown(\`
**\${day.completedTasks}/\${day.totalTasks}** tasks done (\${pct}%)
| \${day.totalHours.toFixed(1)}h logged
\${m.sleep ? '| Sleep: ' + m.sleep : ''}
\${m.steps || m['fitbit.steps'] ? '| Steps: ' + (m.steps || m['fitbit.steps']) : ''}
  \`);
}`}</code></pre>
		</article>

		<article>
			<h3>Objective progress overview with chart</h3>
			<pre><code>{`const { year } = q.today();
const yearly = await q.objectives({ year, level: 'yearly' });

if (yearly.length === 0) {
  render.markdown('No yearly objectives found for 2025.');
} else {
  render.markdown('# 2025 Objectives');

  render.plot.bar({
    x: yearly.map(o => o.title.length > 25
      ? o.title.slice(0, 22) + '...'
      : o.title
    ),
    y: yearly.map(o => o.score * 100),
    title: 'Objective Scores (%)',
    yLabel: '%',
    color: '#3b82f6'
  });

  yearly.forEach(obj => {
    render.markdown(\`### \${obj.title} — \${(obj.score * 100).toFixed(0)}%\`);
    if (obj.keyResults.length > 0) {
      render.table({
        headers: ['Key Result', 'Weight', 'Score'],
        rows: obj.keyResults.map(kr => [
          kr.title,
          kr.weight.toFixed(1),
          \`\${(kr.score * 100).toFixed(0)}%\`
        ])
      });
    }
  });
}`}</code></pre>
		</article>
	</section>

	<!-- Limits -->
	<section id="limits">
		<h2>Limits &amp; Constraints</h2>

		<table class="schema-table">
			<thead>
				<tr><th>Constraint</th><th>Value</th></tr>
			</thead>
			<tbody>
				<tr><td>Execution timeout</td><td>5 seconds</td></tr>
				<tr><td>Memory limit</td><td>128 MB</td></tr>
				<tr><td>Code size limit</td><td>100 KB</td></tr>
				<tr><td>Rate limit</td><td>30 queries per minute per user</td></tr>
			</tbody>
		</table>

		<h3>What's available</h3>
		<ul>
			<li>Standard JavaScript: variables, functions, classes, closures</li>
			<li>Async/await for all <code>q.*</code> data-fetching methods</li>
			<li>Array methods: <code>map</code>, <code>filter</code>, <code>reduce</code>, <code>forEach</code>, <code>find</code>, <code>some</code>, <code>every</code>, <code>sort</code>, <code>slice</code>, <code>splice</code></li>
			<li>Object methods: <code>Object.keys</code>, <code>Object.values</code>, <code>Object.entries</code>, <code>Object.assign</code></li>
			<li>String methods, template literals, destructuring, spread operator</li>
			<li><code>Math.*</code>, <code>Date</code>, <code>JSON.*</code>, <code>parseInt</code>, <code>parseFloat</code>, <code>isNaN</code></li>
		</ul>

		<h3>What's NOT available</h3>
		<ul>
			<li>No <code>fetch</code> / <code>XMLHttpRequest</code> &mdash; no network access</li>
			<li>No <code>require</code> / <code>import</code> &mdash; no module loading</li>
			<li>No file system access</li>
			<li>No <code>process</code>, <code>child_process</code>, or OS interaction</li>
			<li>No <code>setTimeout</code> / <code>setInterval</code></li>
			<li>No <code>console.log</code> &mdash; use <code>render.markdown()</code> for debug output</li>
			<li>No DOM access &mdash; the sandbox runs in WebAssembly, not in a browser</li>
		</ul>

		<h3>Tips</h3>
		<ul>
			<li>Use <code>render.markdown()</code> as a substitute for <code>console.log()</code> when debugging</li>
			<li>Fetch only the data you need &mdash; use filters to narrow results and stay within the timeout</li>
			<li>For large datasets, prefer <code>q.sum()</code>/<code>q.avg()</code> over manual loops when possible</li>
			<li>If a query times out, try narrowing the date range or adding more specific filters</li>
		</ul>
	</section>
</div>

<style>
	.api-reference {
		max-width: 900px;
		margin: 0 auto;
		padding: var(--spacing-lg);
		font-size: 0.9375rem;
		line-height: 1.7;
	}

	.page-header {
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-lg);
		border-bottom: 2px solid var(--color-border);
	}

	.page-header h1 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.75rem;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: 1rem;
		margin: 0;
	}

	/* Table of contents */
	.toc {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md) var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
	}

	.toc h2 {
		margin: 0 0 var(--spacing-sm);
		font-size: 1rem;
	}

	.toc ol {
		margin: 0;
		padding-left: var(--spacing-lg);
	}

	.toc li {
		margin-bottom: 4px;
	}

	.toc ol ol {
		margin-top: 4px;
	}

	.toc a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.toc a:hover {
		text-decoration: underline;
	}

	.toc code {
		font-size: 0.8125rem;
		background: transparent;
		padding: 0;
	}

	/* Sections */
	section {
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
	}

	section:last-child {
		border-bottom: none;
	}

	section h2 {
		font-size: 1.375rem;
		margin: 0 0 var(--spacing-md);
		padding-top: var(--spacing-md);
	}

	section h3 {
		font-size: 1.1rem;
		margin: var(--spacing-lg) 0 var(--spacing-sm);
	}

	section h4 {
		font-size: 0.9375rem;
		margin: var(--spacing-md) 0 var(--spacing-xs);
		color: var(--color-text-muted);
	}

	article {
		margin-bottom: var(--spacing-lg);
		padding-bottom: var(--spacing-md);
		border-bottom: 1px dashed var(--color-border);
	}

	article:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	article h3 code {
		font-size: 1rem;
		background: var(--color-bg);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
	}

	/* Code blocks */
	pre {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		overflow-x: auto;
		font-size: 0.8125rem;
		line-height: 1.5;
		margin: var(--spacing-sm) 0 var(--spacing-md);
	}

	pre code {
		background: none;
		padding: 0;
		font-size: inherit;
	}

	code {
		background: var(--color-bg);
		padding: 1px 5px;
		border-radius: 3px;
		font-size: 0.8125rem;
	}

	/* Globals grid */
	.globals-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--spacing-sm);
		margin: var(--spacing-md) 0;
	}

	.global-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.global-card code {
		font-size: 1rem;
		font-weight: 600;
		background: none;
		padding: 0;
	}

	.global-card span {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	/* Schema tables */
	.schema-table {
		width: 100%;
		border-collapse: collapse;
		margin: var(--spacing-sm) 0 var(--spacing-md);
		font-size: 0.875rem;
	}

	.schema-table th,
	.schema-table td {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		text-align: left;
	}

	.schema-table th {
		background: var(--color-bg);
		font-weight: 600;
	}

	.schema-table code {
		font-size: 0.75rem;
	}

	/* Lists */
	ul, ol {
		padding-left: var(--spacing-lg);
	}

	li {
		margin-bottom: 4px;
	}

	p {
		margin: 0 0 var(--spacing-sm);
	}

	@media (max-width: 768px) {
		.api-reference {
			padding: var(--spacing-md);
		}

		.globals-grid {
			grid-template-columns: 1fr 1fr;
		}

		pre {
			font-size: 0.75rem;
			padding: var(--spacing-sm);
		}
	}
</style>
