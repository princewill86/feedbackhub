<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Feedback statuses | FeedbackHub</title></svelte:head>

<section class="account-panel">
  <p><a href={`/workspaces/${data.slug}`}>Back to feedback</a></p>
  <h1>Feedback statuses</h1>
  <form method="POST" action="?/create">
    <label>Status name <input name="name" maxlength="60" required /></label>
    {#if form?.message}<p role="status">{form.message}</p>{/if}
    <button class="button">Add status</button>
  </form>
  <ul class="mt-6 space-y-2">
    {#each data.statuses as status (status.name)}
      <li>{status.name}</li>
    {:else}
      <li>No statuses have been added.</li>
    {/each}
  </ul>
</section>
