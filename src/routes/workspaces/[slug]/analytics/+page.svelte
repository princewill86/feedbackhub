<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  const max = $derived(Math.max(1, ...data.series.map((entry) => entry.total)));
</script>

<svelte:head><title>Feedback analytics | FeedbackHub</title></svelte:head>

<section class="analytics">
  <a href={`/workspaces/${data.slug}`}>Back to feedback</a>
  <h1>Feedback analytics</h1>
  <p><a href={`/workspaces/${data.slug}/analytics/export`}>Download workspace feedback CSV</a></p>
  <form method="GET">
    <label>Date range
      <select name="days" value={data.days}>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </select>
    </label>
    <button class="button">Apply range</button>
  </form>
  <h2>Submissions by day</h2>
  <p>{data.submissions} submissions in the selected range. Dates are shown in UTC.</p>
  <div class="bars" aria-hidden="true">
    {#each data.series as entry (entry.date)}
      <div class="bar" style:height={`${entry.total / max * 100}%`} title={`${entry.date}: ${entry.total}`}></div>
    {/each}
  </div>
  <details>
    <summary>Daily totals</summary>
    <table>
      <thead><tr><th scope="col">Date</th><th scope="col">Submissions</th></tr></thead>
      <tbody>
        {#each data.series as entry (entry.date)}
          <tr><td>{entry.date}</td><td>{entry.total}</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
  <h2>Engagement on these submissions</h2>
  <p>{data.votes} votes from {data.voters} people and {data.comments} comments.</p>
  <h2>Submissions by product</h2>
  <ul>
    {#each data.breakdown as product (product.id)}
      <li>{product.name ?? 'No product'} <strong>{product.total}</strong></li>
    {:else}
      <li>No activity in this range.</li>
    {/each}
  </ul>
</section>

<style>
  .analytics { width: min(100% - 2rem, 60rem); margin: 2rem auto 4rem; }
  h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); margin-block: 1rem; }
  h2 { font: 1.65rem var(--display); margin: 2rem 0 0.5rem; }
  form { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: end; }
  label { display: grid; gap: 0.35rem; }
  select { min-height: 44px; padding: 0.5rem; border: 1px solid var(--line); }
  .bars { display: flex; align-items: end; gap: 2px; height: 125px; border-bottom: 1px solid var(--line); margin-block: 1rem; }
  .bar { flex: 1; background: var(--accent); }
  summary { min-height: 44px; cursor: pointer; }
  table { width: 100%; text-align: left; }
  tr, li { border-bottom: 1px solid var(--line); }
  td, th, li { padding: 0.5rem; }
  li { display: flex; justify-content: space-between; gap: 1rem; }
  a { text-decoration: underline; }
</style>
