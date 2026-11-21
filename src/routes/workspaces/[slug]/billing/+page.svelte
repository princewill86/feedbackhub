<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Workspace billing | FeedbackHub</title></svelte:head>

<section class="account-panel">
  <h1>Billing</h1>
  {#if form?.message}<p role="alert">{form.message}</p>{/if}
  {#if !data.enabled && !data.paystackEnabled && !data.bitcoinEnabled && !data.nowPaymentsEnabled}
    <p>Online billing hasn’t been configured for this installation.</p>
  {/if}
  {#if data.enabled && !data.payments.length}
    <h2 class="font-bold">Stripe subscriptions</h2>
    {#if data.test}<p>Stripe test mode is active.</p>{/if}
    {#if data.billing}
      <p>{data.billing.planName} · {data.billing.status}</p>
    {/if}
    {#if data.billing?.portal}
      <form method="POST" action="?/portal"><button class="button">Manage subscription and invoices</button></form>
    {:else}
      {#each data.plans as plan (plan.id)}
        <div class="border-t py-4">
          <h2 class="font-bold">{plan.name}</h2>
          {#if plan.description}<p>{plan.description}</p>{/if}
          <form method="POST" action="?/checkout">
            <input type="hidden" name="plan" value={plan.id} />
            <button class="button">View price and continue to Stripe</button>
          </form>
        </div>
      {:else}<p>No plans are available for checkout.</p>{/each}
    {/if}
  {/if}
  {#if data.paystackEnabled && !data.billing}
    <h2 class="mt-6 font-bold">Paystack prepaid plans</h2>
    {#each data.prepaidPlans as plan (plan.id)}
      <div class="border-t py-4">
        <strong>{plan.name}</strong>
        <p>{plan.days} days of access. Paystack displays the total before payment.</p>
        <form method="POST" action="?/paystack">
          <input type="hidden" name="plan" value={plan.id} />
          <button class="button">Continue to Paystack</button>
        </form>
      </div>
    {:else}<p>No prepaid plans are available.</p>{/each}
  {/if}
  {#if (data.bitcoinEnabled || data.nowPaymentsEnabled) && !data.billing}
    <h2 class="mt-6 font-bold">Crypto prepaid plans</h2>
    {#each data.bitcoinPlans as plan (plan.id)}
      <div class="border-t py-4">
        <strong>{plan.name}</strong>
        <p>{plan.days} days of access. The provider shows the total before payment.</p>
        {#if data.bitcoinEnabled}<form method="POST" action="?/bitcoin">
          <input type="hidden" name="plan" value={plan.id} />
          <button class="button">Continue to BTCPay</button>
        </form>{/if}
        {#if data.nowPaymentsEnabled}
          <form method="POST" action="?/nowpayments">
            <input type="hidden" name="plan" value={plan.id} />
            <button class="button">Continue to NOWPayments</button>
          </form>
        {/if}
      </div>
    {:else}<p>No Crypto prepaid plans are available.</p>{/each}
  {/if}
  {#if data.payments.length}
    <h2 class="mt-6 font-bold">Prepaid payments</h2>
    {#each data.payments as payment (payment.reference)}
      <div class="border-t py-4">
        <p>{payment.provider === 'btcpay' ? 'BTCPay' : payment.provider === 'nowpayments' ? 'NOWPayments' : 'Paystack'} · <code>{payment.reference}</code></p>
        <p>{payment.paidAt ? 'Paid' : payment.voidedAt ? 'Closed' : 'Awaiting payment'}{payment.expiresAt ? ` · Access through ${payment.expiresAt.toISOString().slice(0, 10)} UTC` : ''}</p>
        {#if payment.provider === 'btcpay' && payment.invoiceId && data.bitcoinEnabled}
          <a href={payment.checkoutUrl}>Open BTCPay invoice</a>
          {#if !payment.paidAt && !payment.voidedAt}
            <form method="POST" action="?/verifyBitcoin">
              <input type="hidden" name="invoice" value={payment.invoiceId} />
              <button class="button">Check invoice status</button>
            </form>
          {/if}
        {:else if payment.provider === 'nowpayments' && data.nowPaymentsEnabled}
          <a href={payment.checkoutUrl}>Open NOWPayments invoice</a>
        {:else if payment.provider === 'paystack' && !payment.paidAt && data.paystackEnabled}
          <form method="POST" action="?/verifyPaystack">
            <input type="hidden" name="reference" value={payment.reference} />
            <button class="button">Check payment status</button>
          </form>
        {/if}
      </div>
    {/each}
  {/if}
</section>
