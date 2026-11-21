<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<svelte:head>
  <title>{data.title} · {data.workspaceName}</title>
  <meta name="description" content={data.description.slice(0, 160)} />
</svelte:head>

<article>
  <a href={`/boards/${data.slug}`}>Back to {data.workspaceName} feedback</a>
  <h1>{data.title}</h1>
  <p>
    <time datetime={data.createdAt.toISOString()}>{date.format(data.createdAt)}</time>
    · {data.votes} {data.votes === 1 ? 'vote' : 'votes'}
    {#if data.status} · {data.status}{/if}
  </p>
  <p class="description">{data.description}</p>
</article>

<style>
  article { width: min(100% - 2rem, 48rem); margin: 3rem auto; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2.5rem, 8vw, 5rem); margin: 1.25rem 0 1rem; }
  a { text-decoration: underline; }
  .description { margin: 1.5rem 0; white-space: pre-wrap; }
</style>
