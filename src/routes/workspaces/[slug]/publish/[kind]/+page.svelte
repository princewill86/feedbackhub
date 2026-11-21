<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  const label = $derived(data.kind === 'roadmap' ? 'Roadmap' : 'Changelog');
  type Entry = PageProps['data']['entries'][number];
</script>

<svelte:head><title>{label} · {data.name} | FeedbackHub</title></svelte:head>

{#snippet editor(entry?: Entry)}
  <form method="POST" action="?/save">
    {#if entry}<input type="hidden" name="id" value={entry.id} />{/if}
    <label>Title <input name="title" maxlength="140" value={entry?.title ?? ''} required /></label>
    {#if data.kind === 'roadmap'}
      <label>Planned period <input name="period" maxlength="80" value={entry?.period ?? ''} /></label>
    {/if}
    <label>Description <textarea name="body" maxlength="12000" required value={entry?.body ?? ''}></textarea></label>
    <label>Publication state
      <select name="status" value={entry?.status ?? 'draft'}>
        <option value="draft">Draft</option>
        <option value="published">Publish</option>
        <option value="archived">Archived</option>
      </select>
    </label>
    <label>Publication time in UTC <input name="scheduled" type="datetime-local" value={entry?.publishAt?.toISOString().slice(0, 16) ?? ''} /></label>
    <small>Leave the time empty to publish immediately when you select Publish.</small>
    <button class="button">{entry ? 'Save entry' : 'Create entry'}</button>
  </form>
{/snippet}

<section class="account-panel publication">
  <p><a href={`/workspaces/${data.slug}`}>Back to {data.name}</a></p>
  <h1>{label}</h1>
  {#if data.board}<p><a href={`/boards/${data.slug}/updates/${data.kind}`}>View public {label.toLowerCase()}</a></p>{/if}
  {#if form?.message}<p role="alert">{form.message}</p>{/if}
  {#if data.canManage}
    <details><summary>New entry</summary>{@render editor()}</details>
  {/if}
  {#each data.entries as entry (entry.id)}
    <details>
      <summary>{entry.title} · {entry.status}</summary>
      {#if data.canManage}
        {@render editor(entry)}
      {:else}
        {#if entry.period}<p>{entry.period}</p>{/if}
        <p class="body">{entry.body}</p>
      {/if}
    </details>
  {:else}
    <p>No entries yet.</p>
  {/each}
  {#if data.page > 1 || data.hasNext}
    <nav aria-label="Publication pages">
      {#if data.page > 1}<a href={`?page=${data.page - 1}`}>Newer</a>{/if}
      {#if data.hasNext}<a href={`?page=${data.page + 1}`}>Older</a>{/if}
    </nav>
  {/if}
</section>

<style>
  .publication { width: min(100% - 2rem, 48rem); }
  details { border-top: 1px solid var(--line); padding: 0.75rem 0; overflow-wrap: anywhere; }
  summary { cursor: pointer; min-height: 44px; }
  form { margin-block: 0.75rem; }
  textarea, select { padding: 0.6rem; border: 1px solid #887481; background: #fffdf8; min-height: 44px; }
  textarea { min-height: 8rem; }
  .body { white-space: pre-wrap; }
</style>
