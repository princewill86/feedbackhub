<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<svelte:head><title>Notifications | FeedbackHub</title></svelte:head>

<section class="inbox">
  <a href="/account">Back to account</a>
  <h1>Notifications</h1>
  {#if data.entries.length}
    <form method="POST" action="?/readAll"><button class="button">Mark all as read</button></form>
  {/if}
  <ul>
    {#each data.entries as entry (entry.id)}
      <li>
        <p>{entry.kind === 'comment' ? 'New comment on' : 'Status changed for'}
          <a href={`/workspaces/${entry.slug}/feedback/${entry.feedbackId}`}>{entry.title}</a>
        </p>
        {#if !entry.readAt}<strong>Unread</strong>{/if}
        <time datetime={entry.at.toISOString()}>{date.format(entry.at)}</time>
      </li>
    {:else}
      <li>No notifications yet.</li>
    {/each}
  </ul>
  {#if data.page > 1 || data.hasNext}
    <nav aria-label="Notification pages">
      {#if data.page > 1}<a href={`?page=${data.page - 1}`}>Newer</a>{/if}
      {#if data.hasNext}<a href={`?page=${data.page + 1}`}>Older</a>{/if}
    </nav>
  {/if}
</section>

<style>
  .inbox { width: min(100% - 2rem, 46rem); margin: 2.5rem auto; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2.5rem, 7vw, 4rem); margin: 1rem 0; }
  form { margin-bottom: 1rem; }
  li { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: baseline; border-top: 1px solid var(--line); padding: 0.75rem 0; }
  time { font-size: 0.875rem; }
  a { text-decoration: underline; }
</style>
