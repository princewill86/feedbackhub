<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  const snippet = $derived(data.embedUrl
    ? `<iframe src="${data.embedUrl}" title="Send feedback" width="420" height="520" style="max-width:100%;border:0" loading="lazy"></iframe>`
    : '');
</script>

<svelte:head><title>Feedback widget | FeedbackHub</title></svelte:head>
<section class="account-panel">
  <p><a href={`/workspaces/${data.slug}`}>Back to feedback</a></p>
  <h1>Feedback widget</h1>
  <form method="POST" action="?/save">
    <label>Allowed HTTPS origins
      <textarea name="origins" maxlength="3000" value={data.widget?.origins.join('\n') ?? ''} placeholder="https://example.com"></textarea>
    </label>
    <label class="enabled"><input type="checkbox" name="enabled" checked={data.widget?.enabled ?? false} /> Enable widget</label>
    {#if form?.message}<p role="alert">{form.message}</p>{/if}
    <button class="button">Save settings</button>
    {#if data.widget}<button class="button" name="intent" value="rotate">Save and regenerate embed ID</button>{/if}
  </form>
  {#if data.widget?.enabled && data.embedUrl}
    <p><a href={data.embedUrl}>Preview form</a></p>
    <label>Embed HTML <textarea readonly value={snippet}></textarea></label>
  {/if}
</section>

<style>
  textarea { min-height: 6rem; padding: 0.6rem; border: 1px solid #887481; background: #fffdf8; }
  .enabled { display: flex; align-items: center; gap: 0.5rem; }
  .enabled input { width: 1rem; min-height: 44px; }
</style>
