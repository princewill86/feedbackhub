<script lang="ts">
  import { minimumPasswordLength } from '$lib/password';
  import { goto } from '$app/navigation';
  import { createAuthClient } from 'better-auth/svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const auth = createAuthClient();
  let pending = $state(false);
  let message = $state('');

  async function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    if (!data.token) return;
    const form = new FormData(event.currentTarget);
    pending = true;
    try {
      const result = await auth.resetPassword({ token: data.token, newPassword: String(form.get('password')) });
      if (result.error) message = 'The password could not be reset. Request a new link if this one has expired.';
      else await goto('/auth/sign-in', { replaceState: true });
    } catch {
      message = 'The request failed. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<svelte:head><title>Reset password | FeedbackHub</title></svelte:head>
<section class="account-panel">
  <h1>Reset password</h1>
  {#if data.token}
    <form method="POST" onsubmit={submit}>
      <label>New password
        <input type="password" name="password" autocomplete="new-password" minlength={minimumPasswordLength} maxlength="128" required />
      </label>
      <button class="button" disabled={pending}>Reset password</button>
    </form>
    {#if message}<p role="alert">{message}</p>{/if}
  {:else}
    <p>This reset link is invalid or expired.</p>
  {/if}
  <p><a href="/auth/recovery">Request a new reset link</a></p>
</section>
