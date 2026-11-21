<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  type Product = PageProps['data']['entries'][number];
</script>

<svelte:head><title>Products | FeedbackHub</title></svelte:head>

{#snippet editor(product?: Product)}
  <form method="POST" action="?/save">
    {#if product}<input type="hidden" name="id" value={product.id} />{/if}
    <label>Product name <input name="name" maxlength="80" value={product?.name ?? ''} required /></label>
    <label>URL slug <input name="slug" maxlength="64" value={product?.slug ?? ''} required /></label>
    <label>Description <textarea name="description" maxlength="500" value={product?.description ?? ''}></textarea></label>
    <button class="button">{product ? 'Save product' : 'Create product'}</button>
  </form>
{/snippet}

<section class="account-panel">
  <p><a href={`/workspaces/${data.slug}`}>Back to feedback</a></p>
  <h1>Products</h1>
  {#if form?.message}<p role="status">{form.message}</p>{/if}
  <ul class="mb-6 space-y-3">
    {#each data.entries as product (product.slug)}
      <li>
        <strong>{product.name}</strong>{#if product.archivedAt} · Archived{/if}
        {#if product.description}<div>{product.description}</div>{/if}
        {#if data.editable}
          <details>
            <summary>Edit {product.name}</summary>
            {@render editor(product)}
            <form method="POST" action="?/archive">
              <input type="hidden" name="id" value={product.id} />
              <button class="button" name="intent" value={product.archivedAt ? 'restore' : 'archive'}>
                {product.archivedAt ? 'Restore product' : 'Archive product'}
              </button>
            </form>
          </details>
        {/if}
      </li>
    {:else}
      <li>No products have been added.</li>
    {/each}
  </ul>
  {#if data.editable}
    {@render editor()}
  {/if}
</section>

<style>
  textarea { padding: 0.6rem; min-height: 6rem; border: 1px solid #887481; background: #fffdf8; }
</style>
