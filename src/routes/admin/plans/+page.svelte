<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  type Plan = PageProps['data']['plans'][number];
</script>

<svelte:head><title>Subscription plans | FeedbackHub</title></svelte:head>

{#snippet editor(plan?: Plan)}
  <form method="POST" action="?/save">
    {#if plan}<input type="hidden" name="id" value={plan.id} />{/if}
    <label>Plan name <input name="name" maxlength="80" value={plan?.name ?? ''} required /></label>
    <label>Description <textarea name="description" maxlength="500" value={plan?.description ?? ''}></textarea></label>
    <label>Stripe Price ID <input name="stripePriceId" maxlength="126" value={plan?.stripePriceId ?? ''} placeholder="price_..." /></label>
    <label>Paystack price in minor units <input name="paystackAmount" type="number" min="1" max="1000000" value={plan?.paystackAmount ?? ''} /></label>
    <label>Paystack currency <input name="paystackCurrency" maxlength="3" value={plan?.paystackCurrency ?? 'NGN'} required /></label>
    <label>Paystack prepaid term in days <input name="paystackDays" type="number" min="1" max="365" value={plan?.paystackDays ?? 30} required /></label>
    <label>Crypto checkout price in US cents <input name="bitcoinAmount" type="number" min="1" max="1000000" value={plan?.bitcoinAmount ?? ''} /></label>
    <label>Crypto prepaid term in days <input name="bitcoinDays" type="number" min="1" max="365" value={plan?.bitcoinDays ?? 30} required /></label>
    <label>Feedback item limit <input name="limit" type="number" min="0" max="1000000" value={plan?.feedbackLimit ?? ''} /></label>
    <label>Product limit <input name="products" type="number" min="0" max="1000000" value={plan?.productLimit ?? ''} /></label>
    <label>Member limit <input name="members" type="number" min="1" max="1000000" value={plan?.memberLimit ?? ''} /></label>
    <small>Blank limits are unlimited. Archived products and workspace owners count toward their respective limits.</small>
    <input type="hidden" name="features" value="configured" />
    <label class="active"><input name="api" type="checkbox" checked={plan?.apiEnabled ?? true} /> Feedback API</label>
    <label class="active"><input name="widget" type="checkbox" checked={plan?.widgetEnabled ?? true} /> Feedback widget</label>
    <label class="active"><input name="analytics" type="checkbox" checked={plan?.analyticsEnabled ?? true} /> Analytics and CSV exports</label>
    <label class="active"><input name="active" type="checkbox" checked={plan?.active ?? true} /> Available for assignment</label>
    <button class="button">{plan ? 'Save plan' : 'Create plan'}</button>
  </form>
{/snippet}

<section class="account-panel plans">
  <p><a href="/admin">Back to platform administration</a></p>
  <h1>Subscription plans</h1>
  <p>Assign plans manually to control workspace limits. Payment processing is pending provider configuration.</p>
  {#if form?.message}<p role="status">{form.message}</p>{/if}
  <details>
    <summary>New plan</summary>
    {@render editor()}
  </details>
  {#each data.plans as plan (plan.id)}
    <details>
      <summary>{plan.name} · {plan.feedbackLimit === null ? 'Unlimited feedback' : `${plan.feedbackLimit} feedback items`}</summary>
      {@render editor(plan)}
    </details>
  {/each}
  <h2>Workspace assignment</h2>
  <form method="GET">
    <label>Workspace slug <input name="workspace" value={data.slug} maxlength="64" required /></label>
    <button class="button">Find workspace</button>
  </form>
  {#if data.workspace}
    <form method="POST" action={`?/assign&workspace=${encodeURIComponent(data.workspace.slug)}`}>
      <input type="hidden" name="workspace" value={data.workspace.slug} />
      <label>Plan for {data.workspace.name}
        <select name="plan" value={data.workspace.planId ?? ''}>
          <option value="">No assigned plan</option>
          {#each data.plans as plan (plan.id)}
            {#if plan.active || plan.id === data.workspace.planId}
              <option value={plan.id} disabled={!plan.active}>{plan.name}{plan.active ? '' : ' (inactive)'}</option>
            {/if}
          {/each}
        </select>
      </label>
      <button class="button">Assign plan</button>
    </form>
  {:else if data.slug}
    <p>No workspace has that slug.</p>
  {/if}
</section>

<style>
  .plans { width: min(100% - 2rem, 44rem); }
  details { padding: 0.75rem 0; border-top: 1px solid var(--line); }
  summary { cursor: pointer; min-height: 44px; }
  h2 { font: 1.65rem var(--display); margin: 1.5rem 0 0.75rem; }
  textarea, select { padding: 0.6rem; min-height: 44px; border: 1px solid #887481; background: #fffdf8; }
  .active { display: flex; align-items: center; gap: 0.5rem; }
  .active input { width: 1rem; }
</style>
