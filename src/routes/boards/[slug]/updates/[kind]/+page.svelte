<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  const label = $derived(data.kind === 'roadmap' ? 'Roadmap' : 'Changelog');
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<svelte:head><title>{label} · {data.name}</title></svelte:head>

<section class="updates">
  <a href={`/boards/${data.slug}`}>{data.name} feedback</a>
  <h1>{label}</h1>
  {#each data.items as entry (entry.id)}
    <article id={entry.id ?? undefined}>
      <h2>{entry.title}</h2>
      {#if entry.period}<p>{entry.period}</p>{/if}
      {#if entry.publishedAt}<time datetime={entry.publishedAt.toISOString()}>{date.format(entry.publishedAt)}</time>{/if}
      <p class="body">{entry.body}</p>
    </article>
  {:else}
    <p>No entries have been published.</p>
  {/each}
  {#if data.page > 1 || data.hasNext}
    <nav aria-label="Publication pages">
      {#if data.page > 1}<a href={`?page=${data.page - 1}`}>Newer</a>{/if}
      {#if data.hasNext}<a href={`?page=${data.page + 1}`}>Older</a>{/if}
    </nav>
  {/if}
</section>

<style>
  .updates { width: min(100% - 2rem, 48rem); margin: 3rem auto; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2.5rem, 7vw, 5rem); margin-block: 1rem; }
  article { border-top: 1px solid var(--line); padding-block: 1.25rem; }
  h2 { font: 1.7rem var(--display); }
  .body { white-space: pre-wrap; margin-top: 0.65rem; }
  a { text-decoration: underline; }
</style>
