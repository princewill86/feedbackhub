<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  const pageLink = (page: number) => '?' + new URLSearchParams({
    page: String(page), q: data.query, product: data.product, sort: data.sort
  });
</script>

<svelte:head><title>{data.name} feedback | FeedbackHub</title></svelte:head>

<section class="public-board">
  <h1>{data.name}</h1>
  {#if data.description}<p>{data.description}</p>{/if}
  <nav aria-label="Product updates">
    <a href={`/boards/${data.slug}/updates/roadmap`}>Roadmap</a>
    <a href={`/boards/${data.slug}/updates/changelog`}>Changelog</a>
  </nav>
  <h2>Feedback</h2>
  <form method="GET">
    <label>Search feedback <input name="q" type="search" maxlength="140" value={data.query} /></label>
    {#if data.options.length}
      <label>Product
        <select name="product" value={data.product}>
          <option value="">All products</option>
          {#each data.options as product (product.id)}<option value={product.id}>{product.name}</option>{/each}
        </select>
      </label>
    {/if}
    <label>Sort
      <select name="sort" value={data.sort}>
        <option value="newest">Newest</option>
        <option value="popular">Most voted</option>
      </select>
    </label>
    <button class="button">Apply filters</button>
  </form>
  {#each data.items as item (item.id)}
    <article>
      <h3><a href={`/boards/${data.slug}/feedback/${item.id}`}>{item.title}</a></h3>
      <p>{item.votes} {item.votes === 1 ? 'vote' : 'votes'}{item.product ? ` · ${item.product}` : ''}</p>
    </article>
  {:else}
    <p>{data.query || data.product ? 'No feedback matches these filters.' : 'No feedback has been published.'}</p>
  {/each}
  {#if data.page > 1 || data.hasNext}
    <nav aria-label="Feedback pages">
      {#if data.page > 1}<a href={pageLink(data.page - 1)}>Newer</a>{/if}
      {#if data.hasNext}<a href={pageLink(data.page + 1)}>Older</a>{/if}
    </nav>
  {/if}
</section>

<style>
  .public-board { width: min(100% - 2rem, 48rem); margin: 3rem auto; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2.5rem, 8vw, 5rem); margin-bottom: 1rem; }
  h2 { font: 1.65rem var(--display); margin: 2rem 0 1rem; }
  form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: 0.75rem; align-items: end; margin-bottom: 1.5rem; }
  label { display: grid; gap: 0.35rem; }
  input, select { min-height: 44px; border: 1px solid var(--line); padding: 0.5rem; background: #fffdf8; }
  article { border-top: 1px solid var(--line); padding-block: 0.75rem; }
  h3 { font-weight: 650; }
  h3 a { display: inline-flex; align-items: center; min-height: 44px; text-decoration: underline; }
</style>
