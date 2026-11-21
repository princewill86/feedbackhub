<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' });
</script>

<svelte:head>
  <title>{data.title} | FeedbackHub</title>
  <meta name="description" content={data.description} />
</svelte:head>

<div class="legal-frame site-width">
  <aside>
    <nav aria-label="Legal pages">
      <a href="/terms" aria-current={data.kind === 'terms' ? 'page' : undefined}>Terms of Service</a>
      <a href="/privacy" aria-current={data.kind === 'privacy' ? 'page' : undefined}>Privacy Policy</a>
    </nav>
  </aside>
  <article>
    <header>
      <h1>{data.title}</h1>
      {#if data.updatedAt}
        <p>Updated <time datetime={data.updatedAt.toISOString()}>{date.format(data.updatedAt)}</time></p>
      {/if}
    </header>
    {#each data.blocks as block}
      {#if block.heading}<h2>{block.text}</h2>{:else}<p>{block.text}</p>{/if}
    {/each}
  </article>
</div>

<style>
  .legal-frame { display: grid; grid-template-columns: minmax(11rem, 0.35fr) minmax(0, 1fr); gap: clamp(1rem, 5vw, 4rem); max-width: 65rem; padding-block: clamp(1.4rem, 6vw, 4.5rem); }
  nav { display: grid; gap: 0.25rem; padding: 0.55rem; background: var(--surface); border: 1px solid var(--line); border-radius: 0.65rem; }
  nav a { padding-inline: 0.65rem; border-radius: 0.35rem; font-weight: 650; }
  nav a[aria-current="page"] { background: var(--accent-soft); color: var(--accent-hover); }
  article { padding: clamp(1rem, 4vw, 2.5rem); background: var(--surface); border: 1px solid var(--line); border-radius: 0.9rem; overflow-wrap: anywhere; }
  header { border-bottom: 1px solid var(--line); padding-bottom: 1.15rem; margin-bottom: 1.15rem; }
  h1 { font-size: clamp(2.35rem, 6vw, 4.5rem); }
  h2 { font: 1.45rem var(--display); margin: 1.65rem 0 0.5rem; }
  p { line-height: 1.7; margin: 0.75rem 0; color: var(--muted); white-space: pre-wrap; }
  @media (max-width: 43rem) {
    .legal-frame { grid-template-columns: minmax(0, 1fr); }
    nav { grid-template-columns: repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr)); }
  }
</style>
