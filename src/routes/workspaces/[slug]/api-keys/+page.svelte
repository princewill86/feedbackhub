<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>API keys | FeedbackHub</title></svelte:head>

<section class="account-panel">
  <p><a href={`/workspaces/${data.slug}`}>Back to feedback</a></p>
  <h1>API keys</h1>
  {#if form?.message}<p role="status">{form.message}</p>{/if}
  {#if form?.secret}<p><code>{form.secret}</code></p>{/if}
  <form method="POST" action="?/create">
    <label>Name <input name="name" maxlength="80" required /></label>
    <label>Access
      <select name="scope">
        <option value="read">Read feedback</option>
        <option value="write">Read and create feedback</option>
      </select>
    </label>
    <button class="button">Create API key</button>
  </form>
  <ul class="mt-6">
    {#each data.entries as key (key.id)}
      <li class="border-t py-3">
        <strong>{key.name}</strong>
        <p>{key.revokedAt ? 'Revoked' : key.canWrite ? 'Read and create' : 'Read only'}</p>
        {#if !key.revokedAt}
          <form method="POST" action="?/revoke">
            <input type="hidden" name="id" value={key.id} />
            <button class="button">Revoke key</button>
          </form>
        {/if}
      </li>
    {:else}
      <li>No API keys yet.</li>
    {/each}
  </ul>
</section>

<style>
  select { padding: 0.6rem; min-height: 44px; border: 1px solid #887481; background: #fffdf8; }
</style>
