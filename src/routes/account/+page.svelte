<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

<svelte:head><title>Account | FeedbackHub</title></svelte:head>

<section class="account-panel">
  <h1>Your account</h1>
  <div class="profile">
    <span aria-hidden="true">{data.name.trim().slice(0, 1).toUpperCase() || 'A'}</span>
    <div><strong>{data.name}</strong><p>{data.email}</p></div>
  </div>
  <nav aria-label="Account shortcuts">
    <a href="/workspaces">Your workspaces <span aria-hidden="true">→</span></a>
    <a href="/notifications">Notifications <span aria-hidden="true">→</span></a>
    {#if data.account?.administrator}<a href="/admin">Platform administration <span aria-hidden="true">→</span></a>{/if}
  </nav>
  <form method="POST" action="?/signOut">
    <button class="button">Sign out</button>
  </form>
</section>

<style>
  .profile { display: flex; align-items: center; gap: 0.75rem; padding-block: 0.85rem; border-block: 1px solid var(--line); }
  .profile > span { display: grid; place-items: center; flex: 0 0 2.65rem; height: 2.65rem; border-radius: 0.7rem; color: var(--accent); background: var(--accent-soft); font-weight: 750; }
  .profile p { margin: 0.2rem 0 0; color: var(--muted); }
  .profile > div { min-width: 0; overflow-wrap: anywhere; }
  nav { display: grid; gap: 0; margin-bottom: 1rem; }
  nav a { justify-content: space-between; gap: 0.65rem; padding-block: 0.55rem; border-bottom: 1px solid var(--line); text-decoration: none; }
  nav a:hover { text-decoration: underline; }
</style>
