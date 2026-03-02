# Query Builder API Reference

Complete reference for writing JavaScript queries in RUOK's sandboxed environment.

## Contents

1. [Overview](#overview)
2. [Execution Model](#execution-model)
3. [Data Fetching (`q`)](#data-fetching-q)
   - [q.daily()](#qdailyfilters)
   - [q.tasks()](#qtasksfilters)
   - [q.objectives()](#qobjectivesfilters)
4. [Helper Functions (`q`)](#helper-functions-q)
   - [q.sum()](#qsumitems-field)
   - [q.avg()](#qavgitems-field)
   - [q.count()](#qcountitems)
   - [q.parseTime()](#qparsetimetimestr)
   - [q.formatDuration()](#qformatdurationminutes)
   - [q.formatPercent()](#qformatpercentvalue-total)
5. [Date/Time Library (`moment`)](#datetime-library-moment)
6. [Rendering (`render`)](#rendering-render)
   - [render.markdown()](#rendermarkdowntext)
   - [render.table()](#rendertabledata)
   - [render.json()](#renderjsonvalue)
   - [render.plot.bar()](#renderplotbaroptions)
   - [render.plot.line()](#renderplotlineoptions)
   - [render.plot.pie()](#renderplotpieoptions)
   - [render.plot.multi()](#renderplotmultioptions)
7. [Progress (`progress`)](#progress-progress)
8. [Parameters (`params`)](#parameters-params)
9. [Data Schemas](#data-schemas)
10. [Complete Examples](#complete-examples)
11. [Limits & Constraints](#limits--constraints)

---

## Overview

The Query Builder lets you write JavaScript code that runs in a sandboxed **QuickJS** environment (WebAssembly). Your code can fetch your data, compute aggregations, and render results as markdown, tables, or interactive charts.

Queries are used in three contexts:

- **General analysis** — Ad-hoc exploration in the Query Builder page. Output via `render.*`.
- **Key Result progress** — Automatically score a Key Result by calling `progress.set(numerator, denominator)`. The ratio becomes the KR's score (0–1), and "numerator / denominator" is shown as the label.
- **Dashboard widgets** — Saved queries whose rendered output is displayed as a card on your dashboard.

Four global objects are available in every query:

| Global | Purpose |
|--------|---------|
| `q` | Fetch data and compute aggregations |
| `render` | Output markdown, tables, and charts |
| `progress` | Set Key Result progress (0–1) |
| `params` | Runtime parameters passed from the client |
| `moment` | Date/time library ([Moment.js](https://momentjs.com/)) |

---

## Execution Model

Your code is automatically wrapped in an `async` function, so you can use `await` at the top level:

```javascript
// This works — no need to wrap in async function
const days = await q.daily({ year: 2025 });
render.markdown(`Found ${days.length} days`);
```

Internally, your code becomes:

```javascript
(async () => {
    // your code here
})()
```

### Return values

The last expression in your code is captured as the query's return value and displayed as JSON in the "Return Value" section. This is optional — most queries use `render.*` instead.

```javascript
// The object below is returned and shown as JSON
const tasks = await q.tasks({ year: 2025 });
({ total: tasks.length, completed: tasks.filter(t => t.completed).length })
```

### Error handling

If your code throws an error, the error message is shown in the results panel. Stack traces and file paths are stripped for security. Standard `try/catch` works inside the sandbox.

---

## Data Fetching (`q`)

All data-fetching methods are **async** and return promises. They only return data belonging to the current user.

### Common Filter Parameters

All three methods accept an optional filters object:

```typescript
interface QueryFilters {
  year?: number;       // Filter by year (e.g., 2025)
  month?: number;      // Filter by month (1-12)
  week?: number;       // Filter by week number (1-53, respects your week start day setting)
  from?: string;       // Start date, inclusive (YYYY-MM-DD)
  to?: string;         // End date, inclusive (YYYY-MM-DD)
  completed?: boolean; // Filter tasks by completion status
  tag?: string;        // Filter tasks by tag name
  level?: 'yearly' | 'monthly'; // Filter objectives by level
}
```

All filters are optional. Omit the parameter entirely or pass `{}` to get all data.

---

### `q.daily(filters?)`

Fetch daily records including health metrics, tasks, and computed totals. Returns an array sorted by date ascending.

**Relevant filters:**
- `year` — Filter to a specific year
- `month` — Filter to a specific month (combine with `year`)
- `week` — Filter to a specific week number (respects your week start day setting)
- `from`, `to` — Date range filter (both inclusive, format YYYY-MM-DD)

**Return type: `DailyRecord[]`**

```typescript
interface DailyRecord {
  date: string;              // ISO date "YYYY-MM-DD"
  year: number;
  month: number;             // 1-12
  week: number;              // Week number 1-53 (respects your week start day setting)

  // Metrics from your metrics template (Settings > Metrics).
  // Keys depend on your configured template and connected plugins.
  // Numbers are auto-parsed; time strings (e.g., "7:30") stay as strings.
  // Example keys: "sleep", "steps", "fitbit.sleepLength", etc.
  metrics: Record<string, string | number | null>;

  // Tasks for this day
  tasks: TaskRecord[];             // Same type as q.tasks() — see below
  completedTasks: number;          // Count of completed tasks
  totalTasks: number;              // Total task count
  totalHours: number;              // Sum of expected_hours across tasks
}
```

Tasks inside `DailyRecord` use the same `TaskRecord` type as `q.tasks()` — see [TaskRecord](#taskrecord) below.

**Examples:**

```javascript
// Get current month's daily records
const { year, month } = q.today();
const days = await q.daily({ year, month });

// Get records for a date range
const week = await q.daily({
  from: '2025-01-06',
  to: '2025-01-12'
});

// Calculate average sleep (assuming a "sleep" metric in HH:MM format)
const sleepDays = days.filter(d => d.metrics.sleep);
const avgSleepMin = sleepDays.reduce(
  (sum, d) => sum + q.parseTime(d.metrics.sleep),
  0
) / sleepDays.length;
render.markdown(`Average sleep: ${q.formatDuration(avgSleepMin)}`);

// Show daily task completion rate
render.plot.line({
  x: days.map(d => d.date),
  y: days.map(d =>
    d.totalTasks > 0 ? d.completedTasks / d.totalTasks * 100 : 0
  ),
  title: 'Daily Completion Rate (%)',
  yLabel: 'Completion %'
});

// Discover available metric keys
const allKeys = new Set();
days.forEach(d => Object.keys(d.metrics).forEach(k => allKeys.add(k)));
render.markdown('Available metrics: ' + [...allKeys].join(', '));
```

---

### `q.tasks(filters?)`

Fetch tasks with their attributes and tags. Returns tasks from all time period types (daily, weekly, monthly, yearly).

**Relevant filters:**
- `year` — Filter to tasks in time periods of a specific year
- `week` (with `year`) — For daily tasks, filters by date range computed from the week number. For weekly initiatives, matches the `week` stored in the record.
- `month` (with `year`) — For daily tasks, filters by month date range. For weekly initiatives, matches `month` stored in the record.
- `completed` — `true` for completed only, `false` for incomplete only
- `tag` — Filter to tasks tagged with this exact tag name (case-sensitive)
- `periodType` — `'daily'` for daily tasks only, `'weekly'` for weekly initiatives only

#### TaskRecord

```typescript
interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;  // ISO timestamp or null

  // Time period context
  periodType: 'daily' | 'weekly';  // Whether this is a daily task or weekly initiative
  date: string | null;   // "YYYY-MM-DD" for daily tasks, null for weekly
  year: number | null;
  month: number | null;
  week: number | null;   // Week number (respects your week start day setting)

  // Flexible attributes as key-value pairs
  attributes: Record<string, string>;

  // Tags assigned to this task
  tags: string[];  // Array of tag names (e.g., ["work", "ai_research"])

  // Pre-parsed common attributes for convenience
  expected_hours: number;  // Parsed from attributes.expected_hours, 0 if not set
  progress: number;     // Parsed from attributes.progress (0 if not set, any number)

  // Timer data
  timeSpentMs: number;  // Cumulative time tracked via the task timer (milliseconds, 0 if unused)
}
```

**Examples:**

```javascript
// Get all tasks for 2025
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
    hoursByTag[tag] = (hoursByTag[tag] || 0) + t.expected_hours;
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
  x: months.map(m => `Month ${m}`),
  y: months.map(m => byMonth[m].done / byMonth[m].total * 100),
  title: 'Monthly Completion Rate (%)',
  yLabel: '%'
});
```

---

### `q.objectives(filters?)`

Fetch objectives with their key results and weighted scores.

**Relevant filters:**
- `year` — Filter to objectives for a specific year
- `level` — `'yearly'` or `'monthly'`

**Return type: `ObjectiveRecord[]`**

```typescript
interface ObjectiveRecord {
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
}
```

**Score calculation:**

```
score = sum(kr.score * kr.weight) / sum(kr.weight)
```

**Examples:**

```javascript
// Get yearly objectives for 2025
const yearly = await q.objectives({ year: 2025, level: 'yearly' });

// Overall yearly progress
const totalWeight = yearly.reduce((s, o) => s + o.weight, 0);
const weightedScore = yearly.reduce(
  (s, o) => s + o.score * o.weight,
  0
) / totalWeight;
render.markdown(`## Yearly Progress: ${(weightedScore * 100).toFixed(0)}%`);

// Objective scorecard
render.table({
  headers: ['Objective', 'Score', 'Key Results'],
  rows: yearly.map(o => [
    o.title,
    `${(o.score * 100).toFixed(0)}%`,
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
  render.markdown(`### Month ${month}: ${(avg * 100).toFixed(0)}%`);
}
```

---

## Helper Functions (`q`)

Convenience functions for common aggregations and formatting. These are synchronous (no `await` needed).

### `q.sum(items, field)`

Sum a numeric field across an array of objects. Non-numeric values are treated as 0.

```javascript
// Parameters
q.sum(items: object[], field: string): number

// Examples
const days = await q.daily({ year: 2025, month: 1 });
const totalHours = q.sum(days, 'totalHours');       // e.g., 45.5
const totalSteps = q.sum(days, 'steps');             // e.g., 150000
const totalTasks = q.sum(days, 'totalTasks');        // e.g., 93
```

### `q.avg(items, field)`

Average a numeric field. Returns 0 for empty arrays.

```javascript
// Parameters
q.avg(items: object[], field: string): number

// Examples
const days = await q.daily({ year: 2025, month: 1 });
const avgSteps = q.avg(days, 'steps');           // e.g., 8500
const avgHours = q.avg(days, 'totalHours');      // e.g., 3.2
```

### `q.count(items)`

Count items in an array. Equivalent to `items.length` but works with the sandbox's array handles.

```javascript
// Parameters
q.count(items: any[]): number

// Examples
const tasks = await q.tasks({ year: 2025 });
const total = q.count(tasks);                        // e.g., 120
const done = q.count(tasks.filter(t => t.completed)); // e.g., 85
```

### `q.parseTime(timeStr)`

Parse an "HH:MM" time string into total minutes. Useful for working with time-format metrics (e.g., sleep duration, wake-up time).

```javascript
// Parameters
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
) / sleepDays.length;
```

### `q.formatDuration(minutes)`

Format a number of minutes into an "HH:MM" string (consistent with `q.parseTime()`).

```javascript
// Parameters
q.formatDuration(minutes: number): string

// Examples
q.formatDuration(450)  // "07:30"
q.formatDuration(90)   // "01:30"
q.formatDuration(60)   // "01:00"
q.formatDuration(45)   // "00:45"
q.formatDuration(0)    // "00:00"
```

### `q.formatPercent(value, total)`

Format a fraction as a percentage string. Returns "0%" if total is 0.

```javascript
// Parameters
q.formatPercent(value: number, total: number): string

// Examples
q.formatPercent(7, 10)    // "70%"
q.formatPercent(3, 4)     // "75%"
q.formatPercent(0, 0)     // "0%"
q.formatPercent(85, 100)  // "85%"
```

---

## Date/Time Library (`moment`)

The [Moment.js](https://momentjs.com/) library is available as a global `moment` in the sandbox. It provides comprehensive date/time parsing, manipulation, and formatting.

### Quick Examples

```javascript
// Current date/time
const now = moment();

// Parse a date string
const date = moment('2025-03-15');

// Format dates
now.format('YYYY-MM-DD')          // "2025-06-15"
now.format('dddd, MMMM D, YYYY') // "Sunday, June 15, 2025"

// Date arithmetic
moment().subtract(7, 'days').format('YYYY-MM-DD')
moment().startOf('month').format('YYYY-MM-DD')
moment().endOf('week').format('YYYY-MM-DD')
moment().add(1, 'month').format('YYYY-MM-DD')
```

### Use with `q.daily()` for Date Ranges

```javascript
const start = moment().startOf('month').format('YYYY-MM-DD');
const end = moment().endOf('month').format('YYYY-MM-DD');
const days = await q.daily({ from: start, to: end });
```

### Comparison and Difference

```javascript
moment('2025-03-01').isBefore('2025-03-15')   // true
moment('2025-03-01').isAfter('2025-02-15')     // true
moment('2025-03-15').diff('2025-03-01', 'days') // 14
moment('2025-06-01').diff('2025-01-01', 'months') // 5
```

### Duration

```javascript
const dur = moment.duration(150, 'minutes');
dur.hours()   // 2
dur.minutes() // 30
dur.humanize() // "3 hours"
```

See [Moment.js docs](https://momentjs.com/docs/) for the full API.

---

## Rendering (`render`)

All `render.*` calls append output to the results panel. You can call them multiple times to build up a composite result with mixed content types. Order is preserved.

### `render.markdown(text)`

Render a string as formatted markdown. Supports headings, bold, italic, lists, links, inline code, and tables (standard markdown syntax).

```javascript
// Parameters
render.markdown(text: string): void

// Examples
render.markdown('# Monthly Report');
render.markdown('Tasks completed: **42**');
render.markdown(`
## Summary

- Total hours: ${totalHours.toFixed(1)}
- Completion rate: ${(rate * 100).toFixed(0)}%
- Best day: ${bestDay.date}

> Keep up the good work!
`);
```

### `render.table(data)`

Render a structured table with headers and rows.

```javascript
// Parameters
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
    t.expected_hours.toFixed(1),
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
    rows: data.map(t => [t.date || '-', t.title, t.expected_hours + 'h'])
  });
}
```

### `render.json(value)`

Render any JavaScript value as pretty-printed JSON. Useful for debugging.

```javascript
// Parameters
render.json(value: any): void

// Examples
const tasks = await q.tasks({ year: 2025 });
render.json(tasks[0]); // inspect a single task record

const days = await q.daily({ year: 2025, month: 1 });
render.json({ taskCount: days.length, sample: days[0] });
```

### `render.plot.bar(options)`

Render an interactive bar chart (powered by Plotly.js).

```javascript
// Parameters
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
  byTag[tag] = (byTag[tag] || 0) + t.expected_hours;
}));
const sorted = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
render.plot.bar({
  x: sorted.map(([tag]) => tag),
  y: sorted.map(([, hours]) => hours),
  title: 'Hours Invested by Tag',
  yLabel: 'Hours',
  color: '#3b82f6'
});
```

### `render.plot.line(options)`

Render an interactive line chart with markers.

```javascript
// Parameters
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
});
```

### `render.plot.pie(options)`

Render an interactive pie/donut chart.

```javascript
// Parameters
render.plot.pie(options: {
  values: number[];   // Slice sizes
  labels: string[];   // Slice labels
  title?: string;     // Chart title
}): void

// Example: Time allocation by tag
const tasks = await q.tasks({ year: 2025 });
const byTag = {};
tasks.forEach(t => t.tags.forEach(tag => {
  byTag[tag] = (byTag[tag] || 0) + t.expected_hours;
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
});
```

### `render.plot.multi(options)`

Render multiple line series on a single chart. Each series gets its own legend entry.

```javascript
// Parameters
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
    x: months.map(m => `Month ${m}`),
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
});
```

---

## Progress (`progress`)

Used exclusively for **Key Result progress queries**. When a KR uses "Custom Query" measurement, this is how the score is computed.

### `progress.set(numerator, denominator)`

```javascript
// Parameters
progress.set(numerator: number, denominator: number): void
// Score = numerator / denominator, clamped to 0–1
// The label "numerator / denominator" is shown on the KR badge
```

**Rules:**
- The ratio is clamped to 0–1 (e.g., `progress.set(150, 100)` → score 1.0, label "150 / 100")
- Division by zero is silently ignored
- If `progress.set()` is never called in a KR progress query, the query returns an error
- Only the last call matters if called multiple times
- Can be combined with `render.*` calls to show a visual breakdown alongside the progress value

**Examples:**

```javascript
// Simple: completed / total tasks
const tasks = await q.tasks({ year: 2025, tag: 'Q1_Goal' });
const completed = tasks.filter(t => t.completed).length;
progress.set(completed, tasks.length);
// Badge shows e.g. "7 / 10"

// Hours-based progress: track hours against a target
const TARGET_HOURS = 100;
const tasks2 = await q.tasks({ year: 2025, tag: 'deep_work' });
const totalHours = tasks2.reduce((sum, t) => sum + t.expected_hours, 0);
progress.set(totalHours, TARGET_HOURS);
// Badge shows e.g. "42.5 / 100"
```

---

## Parameters (`params`)

The `params` object contains runtime parameters passed from the client when executing the query. This enables reusable queries that adapt to different inputs.

```javascript
// params is a plain object — access properties directly
const year = params.year || new Date().getFullYear();
const month = params.month || new Date().getMonth() + 1;
const tagFilter = params.tag || null;

const tasks = await q.tasks({ year, month });
const filtered = tagFilter
  ? tasks.filter(t => t.tags.includes(tagFilter))
  : tasks;
```

### Default values pattern

Always provide defaults since `params` may be empty:

```javascript
const year = params.year || 2025;
const limit = params.limit || 10;
const showChart = params.showChart !== false; // default true
```

---

## Data Schemas

The underlying database tables that drive the query API. Understanding these helps you know what data is available.

### Time periods

All tasks and metrics are organized into time periods. Each period has a type (`yearly`, `monthly`, `weekly`, `daily`) and scoping fields (`year`, `month`, `week`, `day`).

### Tasks

Tasks belong to time periods. Each task has:
- `title` — The task name
- `completed` / `completedAt` — Completion status and timestamp
- `timeSpentMs` — Tracked time in milliseconds (from built-in timer)
- `sortOrder` — Display order within the period

### Task attributes

Flexible key-value pairs on tasks. Common keys:

| Key | Type | Description |
|-----|------|-------------|
| `expected_hours` | number | Planned/budgeted hours for the task (e.g., "2.5") |
| `progress` | number | Completion progress, any number (e.g., "75") |

All attribute values are stored as strings. The query API pre-parses `expected_hours` and `progress` as numbers on `TaskRecord`.

Additionally, `timeSpentMs` (number) is available directly on `TaskRecord` — it holds cumulative milliseconds from the built-in task timer.

### Tags

Tags categorize tasks. Each tag has a `name`, optional `color` (hex), and optional `category`. Tasks can have multiple tags. Use the `tag` filter in `q.tasks()` to filter by tag name.

### Objectives & key results

Objectives are yearly or monthly goals. Each has weighted key results. KR measurement types:

| Type | Description |
|------|-------------|
| `slider` | Manual 0–100% slider |
| `checkboxes` | Checklist items, score = completed / total |
| `custom_query` | JavaScript query that calls `progress.set(n, d)` |

### Daily metrics

Metrics are defined by your **metrics template** (Settings > Metrics). Each metric has a `name` used as the key in `DailyRecord.metrics`. Three metric types are supported:

| Type | Description | Example key |
|------|-------------|-------------|
| `input` | User-entered value (number, time, text, boolean) | `sleep`, `mood` |
| `computed` | Calculated from other metrics via a JS expression | `sleepScore` |
| `external` | Synced from a plugin (e.g., Fitbit) | `fitbit.steps` |

Use `Object.keys(day.metrics)` to discover which metrics are available for a given day. Numeric values are auto-parsed; time strings like "7:30" remain as strings (use `q.parseTime()` to convert).

---

## Complete Examples

### Weekly productivity report

```javascript
const { year, week } = q.today();
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

render.markdown(`
# Week ${week} Report

| Metric | Value |
|--------|-------|
| Hours worked | ${totalHours.toFixed(1)} |
| Tasks completed | ${totalCompleted}/${totalTasks} |
| Completion rate | ${q.formatPercent(totalCompleted, totalTasks)} |
${avgSleep ? '| Avg sleep | ' + avgSleep.toFixed(1) + 'h |' : ''}
`);

render.plot.bar({
  x: days.map(d => d.date),
  y: days.map(d => d.totalHours),
  title: 'Hours by Day',
  color: '#3b82f6'
});
```

### Tag-based time analysis with pie chart

```javascript
const tasks = await q.tasks({ year: 2025 });
const byTag = {};
let untagged = 0;

tasks.forEach(t => {
  if (t.tags.length === 0) {
    untagged += t.expected_hours;
  } else {
    t.tags.forEach(tag => {
      byTag[tag] = (byTag[tag] || 0) + t.expected_hours;
    });
  }
});

if (untagged > 0) byTag['(untagged)'] = untagged;

const sorted = Object.entries(byTag)
  .sort((a, b) => b[1] - a[1]);

render.markdown(`# Time Investment - 2025\n\nTotal: ${
  sorted.reduce((s, [, h]) => s + h, 0).toFixed(1)
} hours across ${sorted.length} categories`);

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
});
```

### KR progress: Course completion tracker

```javascript
// Attach to a Key Result to auto-calculate progress
const tasks = await q.tasks({
  year: 2025,
  tag: 'ml_course'
});

const completed = tasks.filter(t => t.completed).length;
const total = tasks.length;

if (total === 0) {
  progress.set(0, 1);
  render.markdown('No course tasks found. Add tasks tagged "ml_course".');
} else {
  progress.set(completed, total);

  render.markdown(`## ML Course Progress\n\n${completed}/${total} modules completed`);

  render.table({
    headers: ['Module', 'Status', 'Hours'],
    rows: tasks.map(t => [
      t.title,
      t.completed ? 'Done' : 'Pending',
      t.expected_hours.toFixed(1)
    ])
  });
}
```

### Sleep quality correlation

```javascript
const { year } = q.today();
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

render.markdown(`
# Sleep & Productivity

| Sleep Category | Days | Avg Work Hours |
|---------------|------|----------------|
| < 7 hours | ${shortSleep.length} | ${avgProdShort.toFixed(1)} |
| >= 7 hours | ${goodSleep.length} | ${avgProdGood.toFixed(1)} |
`);

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
});
```

### Dashboard widget: Today's snapshot

```javascript
const today = new Date().toISOString().split('T')[0];
const days = await q.daily({ from: today, to: today });

if (days.length === 0) {
  render.markdown('No data for today yet.');
} else {
  const day = days[0];
  const pct = day.totalTasks > 0
    ? (day.completedTasks / day.totalTasks * 100).toFixed(0)
    : '0';

  const m = day.metrics;
  render.markdown(`
**${day.completedTasks}/${day.totalTasks}** tasks done (${pct}%)
| ${day.totalHours.toFixed(1)}h logged
${m.sleep ? '| Sleep: ' + m.sleep : ''}
${m.steps || m['fitbit.steps'] ? '| Steps: ' + (m.steps || m['fitbit.steps']) : ''}
  `);
}
```

### Objective progress overview with chart

```javascript
const yearly = await q.objectives({ year: 2025, level: 'yearly' });

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
    render.markdown(`### ${obj.title} — ${(obj.score * 100).toFixed(0)}%`);
    if (obj.keyResults.length > 0) {
      render.table({
        headers: ['Key Result', 'Weight', 'Score'],
        rows: obj.keyResults.map(kr => [
          kr.title,
          kr.weight.toFixed(1),
          `${(kr.score * 100).toFixed(0)}%`
        ])
      });
    }
  });
}
```

---

## Limits & Constraints

| Constraint | Value |
|-----------|-------|
| Execution timeout | 5 seconds |
| Memory limit | 128 MB |
| Code size limit | 100 KB |
| Rate limit | 30 queries per minute per user |

### What's available

- Standard JavaScript: variables, functions, classes, closures
- Async/await for all `q.*` data-fetching methods
- Array methods: `map`, `filter`, `reduce`, `forEach`, `find`, `some`, `every`, `sort`, `slice`, `splice`
- Object methods: `Object.keys`, `Object.values`, `Object.entries`, `Object.assign`
- String methods, template literals, destructuring, spread operator
- `Math.*`, `Date`, `JSON.*`, `parseInt`, `parseFloat`, `isNaN`

### What's NOT available

- No `fetch` / `XMLHttpRequest` — no network access
- No `require` / `import` — no module loading
- No file system access
- No `process`, `child_process`, or OS interaction
- No `setTimeout` / `setInterval`
- No `console.log` — use `render.markdown()` for debug output
- No DOM access — the sandbox runs in WebAssembly, not in a browser

### Tips

- Use `render.markdown()` as a substitute for `console.log()` when debugging
- Fetch only the data you need — use filters to narrow results and stay within the timeout
- For large datasets, prefer `q.sum()`/`q.avg()` over manual loops when possible
- If a query times out, try narrowing the date range or adding more specific filters
