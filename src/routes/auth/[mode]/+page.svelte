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
    pending = true;
    message = '';
    const fields = new FormData(event.currentTarget);
    const credentials = {
      email: String(fields.get('email')).trim(),
      password: String(fields.get('password'))
    };

    try {
      const { error } = data.register
        ? await auth.signUp.email({ ...credentials, name: String(fields.get('name')).trim() })
        : await auth.signIn.email(credentials);

      if (!error) {
        if (data.register && data.emailEnabled) {
          message = 'Check your email for a verification link before signing in.';
        } else {
          await goto('/account', { invalidateAll: true });
        }
      } else if (error.code === 'EMAIL_NOT_VERIFIED') {
        message = 'Verify your email before signing in. Check your inbox for a new link.';
      } else if (error.status === 429) {
        message = 'Too many attempts. Wait a moment and try again.';
      } else {
        message = data.register
          ? 'Could not create your account. Check your details or sign in if you already have an account.'
          : 'Could not sign in. Check your email and password.';
      }
    } catch {
      message = 'The request failed. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<svelte:head><title>{data.register ? 'Create account' : 'Sign in'} | FeedbackHub</title></svelte:head>

<div class="auth-layout site-width">
  <aside class="auth-aside">
    <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
    <h2>{data.register ? 'Create a place for customer feedback.' : 'Pick up where your team left off.'}</h2>
    <p>Organize requests, answer customers, and keep your roadmap up to date.</p>
  </aside>
<section class="account-panel auth-panel">
  <h1>{data.register ? 'Create account' : 'Sign in'}</h1>
  <form method="POST" onsubmit={submit}>
    {#if data.register}
      <label>Name <input name="name" autocomplete="name" maxlength="100" required /></label>
    {/if}
    <label>Email <input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
    <div class="password-heading">
      <label for="account-password">Password</label>
      {#if !data.register}<a href="/auth/recovery">Forgot password?</a>{/if}
    </div>
    <div>
      <input id="account-password" name="password" type="password" required
        autocomplete={data.register ? 'new-password' : 'current-password'}
        minlength={data.register ? minimumPasswordLength : undefined} maxlength="128"
        aria-describedby={data.register ? 'password-help' : undefined} />
    </div>
    {#if data.register}<small id="password-help">Use at least {minimumPasswordLength} characters.</small>{/if}
    {#if message}<p role="alert">{message}</p>{/if}
    {#if data.register}
      <p class="legal-note">Read the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> before creating an account.</p>
    {/if}
    <button class="button" disabled={pending}>{pending ? 'Please wait…' : data.register ? 'Create account' : 'Sign in'}</button>
  </form>
  <p><a href={data.register ? '/auth/sign-in' : '/auth/register'}>{data.register ? 'Already have an account? Sign in' : 'New to FeedbackHub? Create an account'}</a></p>
</section>
</div>

<style>
  .auth-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.95fr); max-width: 64rem; margin-block: clamp(1.5rem, 6vw, 5rem); border: 1px solid var(--line); border-radius: 1rem; overflow: hidden; background: var(--surface); }
  .auth-aside { color: #fff7ee; background: var(--ink); padding: clamp(1.5rem, 5vw, 4rem); display: flex; flex-direction: column; justify-content: center; gap: 1.2rem; }
  .auth-aside .brand-mark { background: #f2dce7; color: var(--ink); }
  h2 { font: 500 clamp(2rem, 4.2vw, 3.8rem)/1.05 var(--display); letter-spacing: -0.06em; text-wrap: balance; }
  .auth-aside p { color: #f0dbe6; max-width: 30ch; line-height: 1.6; }
  .auth-panel { width: 100%; padding: clamp(1.35rem, 5vw, 3.5rem); margin: 0; box-shadow: none; border: 0; border-radius: 0; }
  .auth-panel .legal-note { margin: 0; font-size: 0.875rem; color: var(--muted); }
  .password-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0.25rem 1rem; margin-bottom: -0.5rem; }
  .password-heading a { font-size: 0.875rem; color: var(--accent); }
  @media (max-width: 43rem) {
    .auth-layout { grid-template-columns: minmax(0, 1fr); }
    .auth-aside { gap: 0.6rem; }
    .auth-aside h2 { font-size: clamp(1.6rem, 6vw, 2.4rem); }
  }
</style>
