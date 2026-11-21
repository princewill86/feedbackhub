<script lang="ts">
  import { createAuthClient } from 'better-auth/svelte';

  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  const auth = createAuthClient();
  let pending = $state(false);
  let message = $state('');

  async function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    pending = true;
    try {
      const result = await auth.requestPasswordReset({
        email: String(form.get('email')).trim(),
        redirectTo: new URL('/auth/reset', window.location.origin).href
      });
      message = result.error?.status === 429
        ? 'Too many requests. Try again later.'
        : 'If an account uses that email, you’ll receive a reset link.';
    } catch {
      message = 'The request failed. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<svelte:head><title>Recover account | FeedbackHub</title></svelte:head>
<section class="account-panel">
  <h1>Recover account</h1>
  {#if data.canRecover}
  <p>Enter the email address on your account to request a reset link.</p>
  <form method="POST" onsubmit={submit}>
    <label>Email <input type="email" name="email" autocomplete="email" maxlength="254" required /></label>
    <button class="button" disabled={pending}>Send reset link</button>
  </form>
  {#if message}<p role="status">{message}</p>{/if}
  {:else}
    <p>Reset emails are unavailable on this installation. Contact the platform administrator for account recovery.</p>
  {/if}
  <p><a href="/auth/sign-in">Back to sign in</a></p>
</section>
