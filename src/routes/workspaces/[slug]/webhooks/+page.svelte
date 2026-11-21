<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Webhooks | FeedbackHub</title></svelte:head>
<section class="account-panel">
  <p><a href={`/workspaces/${data.slug}`}>Back to feedback</a></p>
  <h1>Webhooks</h1>
  {#if form?.message}<p role="status">{form.message}</p>{/if}
  {#if form?.secret}<p><code>{form.secret}</code></p>{/if}
  <form method="POST" action="?/add">
    <label>Approved HTTPS destination <input name="url" type="url" maxlength="500" required /></label>
    <button class="button">Add webhook</button>
  </form>
  <h2>Destinations</h2>
  <ul>
    {#each data.entries as entry (entry.id)}
      <li class="border-t py-3">
        <p>{entry.url} · {entry.disabled ? 'Disabled' : 'Active'}</p>
        {#if !entry.disabled}
          <form method="POST" action="?/disable">
            <input type="hidden" name="id" value={entry.id} />
            <button class="button">Disable</button>
          </form>
        {/if}
      </li>
    {:else}<li>No destinations configured.</li>{/each}
  </ul>
  <h2>Recent deliveries</h2>
  <ul>
    {#each data.deliveries as delivery (delivery.id)}
      <li class="border-t py-3">{delivery.event} · {delivery.state} · {delivery.attempts} attempts
        {#if delivery.status} · HTTP {delivery.status}{/if}
      </li>
    {:else}<li>No delivery attempts yet.</li>{/each}
  </ul>
</section>

<style>
  h2 { font: 1.5rem var(--display); margin-block: 1.5rem 0.5rem; }
</style>
