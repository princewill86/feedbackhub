<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  function pageLink(page: number) {
    const query = new URLSearchParams({ page: String(page) });
    if (data.query) query.set('q', data.query);
    if (data.productFilter) query.set('product', data.productFilter);
    return `?${query}`;
  }
  const activeProducts = $derived(data.products.filter((product) => !product.archivedAt));
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<svelte:head><title>{data.name} | FeedbackHub</title></svelte:head>

<section class="board">
  <div class="board-heading">
    <p class="board-label">Workspace feedback</p>
    <h1>{data.name}</h1>
  </div>
  {#if data.description}<p>{data.description}</p>{/if}
  {#if data.publicBoard}<p><a href={`/boards/${data.slug}`}>View public board</a></p>{/if}
  {#if data.role === 'owner'}
    <details>
      <summary>Board visibility</summary>
      <p>Visitors can see feedback you publish individually.</p>
      <form method="POST" action="?/visibility">
        <button class="button" name="visibility" value={data.publicBoard ? 'private' : 'public'}>
          {data.publicBoard ? 'Make board private' : 'Publish board'}
        </button>
      </form>
    </details>
  {/if}
  <div class="board-grid">
    <section class="board-list" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading">Feedback</h2>
      <form method="GET" class="search">
        <label>Search feedback <input name="q" value={data.query} maxlength="140" type="search" /></label>
        {#if data.products.length}
          <label>Product
            <select name="product" value={data.productFilter}>
              <option value="">All products</option>
              {#each data.products as product (product.id)}<option value={product.id}>{product.name}</option>{/each}
            </select>
          </label>
        {/if}
        <button class="button">Apply filters</button>
      </form>
      {#each data.items as item (item.id)}
        <details>
          <summary><strong>{item.title}</strong> <time datetime={item.createdAt.toISOString()}>{date.format(item.createdAt)}</time></summary>
          {#if item.product}<p>{item.product}</p>{/if}
          <p>{item.description}</p>
          <a href={`/workspaces/${data.slug}/feedback/${item.id}`}>Open discussion for {item.title}</a>
        </details>
      {:else}
        <p>{data.query || data.productFilter ? 'No feedback matched your search.' : 'No feedback has been submitted.'}</p>
      {/each}
      {#if data.page > 1 || data.hasNext}
        <nav aria-label="Feedback pages">
          {#if data.page > 1}<a href={pageLink(data.page - 1)}>Newer</a>{/if}
          {#if data.hasNext}<a href={pageLink(data.page + 1)}>Older</a>{/if}
        </nav>
      {/if}
    </section>
    {#if data.role !== 'viewer'}
      <section class="submit-card" aria-labelledby="submit-heading">
        <h2 id="submit-heading">Submit feedback</h2>
        <form method="POST" action="?/submit">
          {#if activeProducts.length}
            <label>Product
              <select name="product">
                <option value="">No product</option>
                {#each activeProducts as product (product.id)}<option value={product.id}>{product.name}</option>{/each}
              </select>
            </label>
          {/if}
          <label>Title <input name="title" minlength="3" maxlength="140" value={form?.title ?? ''} required /></label>
          <label>Description <textarea name="description" maxlength="5000" value={form?.description ?? ''} required></textarea></label>
          {#if form?.message}<p role="alert">{form.message}</p>{/if}
          <button class="button">Submit feedback</button>
        </form>
      </section>
    {/if}
  </div>
</section>

<style>
  .board { max-width: 72rem; margin: auto; padding: 0.5rem 0 2rem; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2.5rem, 6vw, 4.6rem); margin-block: 0.35rem 0; }
  .board-heading { margin-bottom: 1.3rem; }
  .board-label { color: var(--accent); font-size: 0.86rem; font-weight: 750; }
  .board-grid { margin-top: 1rem; }
  .board-list, .submit-card { padding: clamp(0.85rem, 2vw, 1.45rem); background: var(--surface); border: 1px solid var(--line); border-radius: 0.85rem; }
  .submit-card { align-self: start; }
  h2 { font: 1.65rem var(--display); margin-bottom: 1rem; }
  .board-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(15rem, 21rem); gap: clamp(0.75rem, 2vw, 1.75rem); }
  details { border-top: 1px solid var(--line); padding-block: 0.75rem; }
  details p { white-space: pre-wrap; margin: 0.75rem 0; }
  summary { min-height: 44px; cursor: pointer; }
  time { color: var(--accent); font-size: 0.875rem; margin-inline-start: 0.5rem; }
  .search { margin-bottom: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); align-items: end; }
  form, label { display: grid; gap: 0.65rem; }
  input, select, textarea { padding: 0.6rem; min-height: 44px; border: 1px solid #ac96a3; background: #fffdf8; border-radius: 0.45rem; }
  textarea { min-height: 8rem; }
  a { text-decoration: underline; }
  @media (max-width: 67rem) and (min-width: 54.01rem), (max-width: 39rem) { .board-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
