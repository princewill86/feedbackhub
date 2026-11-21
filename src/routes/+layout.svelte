<script lang="ts">
  import { page } from '$app/state';
  import '../app.css';
  import type { LayoutProps } from './$types';

  let { children, data }: LayoutProps = $props();
  let menu = $state<HTMLDetailsElement>();
  const widget = $derived(page.url.pathname.startsWith('/widgets/'));
  const brand = $derived((page.data.settings?.name as string | undefined) ?? 'FeedbackHub');
</script>

{#snippet navigation()}
  {#if data.account}
    <a href="/workspaces" onclick={() => { if (menu) menu.open = false; }}>Workspaces</a>
    <a href="/notifications" onclick={() => { if (menu) menu.open = false; }}>Notifications</a>
    {#if data.account.administrator}<a href="/admin" onclick={() => { if (menu) menu.open = false; }}>Platform admin</a>{/if}
  {:else}
    <a href="/#features" onclick={() => { if (menu) menu.open = false; }}>Features</a>
    <a href="/#workflow" onclick={() => { if (menu) menu.open = false; }}>How it works</a>
    <a href="/#questions" onclick={() => { if (menu) menu.open = false; }}>FAQ</a>
  {/if}
{/snippet}

{#if !widget}
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="masthead">
    <div class="site-width masthead-inner">
      <a class="wordmark" href="/"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>{brand}</a>
      <nav class="desktop-nav" aria-label="Main navigation">{@render navigation()}</nav>
      <div class="header-actions">
        {#if data.account}
          <a class="profile-link" href="/account" aria-label="Your account"><span class="avatar" aria-hidden="true">{data.account.name.trim().slice(0, 1).toUpperCase() || 'A'}</span><span>Account</span></a>
        {:else}
          <a class="sign-in-link" href="/auth/sign-in">Sign in</a>
          <a class="button desktop-cta" href="/auth/register">Create account <span aria-hidden="true">↗</span></a>
        {/if}
        <details class="mobile-nav" bind:this={menu}>
          <summary aria-label="Menu"><span></span><span></span><span></span></summary>
          <nav aria-label="Mobile navigation">
            {@render navigation()}
            {#if !data.account}<a href="/auth/register" onclick={() => { if (menu) menu.open = false; }}>Create account</a>{/if}
          </nav>
        </details>
      </div>
    </div>
  </header>
{/if}
<main id="main-content">{@render children()}</main>
{#if !widget}
  <footer class="site-footer">
    <div class="site-width footer-inner">
      <div>
        <a class="wordmark" href="/"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>{brand}</a>
        <p>Customer feedback and product planning in one place.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="/#features">Features</a>
        <a href="/#workflow">How it works</a>
        <a href="/#questions">FAQ</a>
        <a href="/terms">Terms of Service</a>
        <a href="/privacy">Privacy Policy</a>
        {#if data.account}<a href="/account">Account</a>{:else}<a href="/auth/sign-in">Sign in</a>{/if}
      </nav>
    </div>
    <div class="site-width footer-credit">
      <p>Built by <a href="https://github.com/princewill86">princewill86</a></p>
      <a href="https://github.com/princewill86/feedbackhub">Source on GitHub <span aria-hidden="true">↗</span></a>
    </div>
  </footer>
{/if}
