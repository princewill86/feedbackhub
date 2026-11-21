<script lang="ts">
  import { page } from '$app/state';
  import type { LayoutProps } from './$types';

  let { children, data }: LayoutProps = $props();
  let mobile = $state<HTMLDetailsElement>();
  const base = $derived('/workspaces/' + data.workspaceNavigation.slug);
  const entries = $derived([
    { path: '', label: 'Feedback', icon: '↳' },
    { path: '/products', label: 'Products', icon: '◇' },
    { path: '/publish/roadmap', label: 'Roadmap', icon: '→' },
    { path: '/publish/changelog', label: 'Changelog', icon: '↗' },
    ...(data.workspaceNavigation.manager ? [
      { path: '/analytics', label: 'Analytics', icon: '▥' },
      { path: '/statuses', label: 'Feedback statuses', icon: '○' }
    ] : []),
    ...(data.workspaceNavigation.role === 'owner' || data.workspaceNavigation.role === 'administrator'
      ? [{ path: '/members', label: 'Members', icon: '⊕' }] : []),
    ...(data.workspaceNavigation.role === 'owner' ? [
      { path: '/widget', label: 'Widget', icon: '⊞' },
      { path: '/api-keys', label: 'API keys', icon: '⌘' },
      { path: '/webhooks', label: 'Webhooks', icon: '⇄' },
      { path: '/billing', label: 'Billing', icon: '▤' }
    ] : [])
  ]);
</script>

{#snippet workspaceLinks()}
  {#each entries as entry (entry.path)}
    {@const current = page.url.pathname === base + entry.path || (entry.path === '' && page.url.pathname.startsWith(base + '/feedback/'))}
    <a href={base + entry.path} aria-current={current ? 'page' : undefined} onclick={() => { if (mobile) mobile.open = false; }}>
      <span aria-hidden="true">{entry.icon}</span>{entry.label}
    </a>
  {/each}
{/snippet}

<div class="workspace-frame">
  <aside class="workspace-sidebar">
    <a href="/workspaces" class="switch-workspace">← All workspaces</a>
    <div class="workspace-identity">
      <span class="workspace-avatar" aria-hidden="true">{data.workspaceNavigation.name.trim().slice(0, 1).toUpperCase()}</span>
      <div><strong>{data.workspaceNavigation.name}</strong><span>{data.workspaceNavigation.role}</span></div>
    </div>
    <nav class="desktop-workspace-nav" aria-label="Workspace navigation">{@render workspaceLinks()}</nav>
    <details class="mobile-workspace-nav" bind:this={mobile}>
      <summary>Workspace menu</summary>
      <nav aria-label="Workspace navigation">{@render workspaceLinks()}</nav>
    </details>
  </aside>
  <div class="workspace-content">{@render children()}</div>
</div>

<style>
  .workspace-frame { width: min(100% - clamp(1rem, 5vw, 5rem), 88rem); margin: 1.5rem auto 3rem; display: grid; grid-template-columns: 15.5rem minmax(0, 1fr); gap: clamp(1rem, 3vw, 2.5rem); align-items: start; }
  .workspace-sidebar { border: 1px solid var(--line); border-radius: 0.85rem; background: var(--surface); padding: 0.85rem; min-width: 0; }
  .switch-workspace { display: inline-flex; align-items: center; min-height: 44px; font-size: 0.85rem; color: var(--muted); }
  .workspace-identity { display: flex; align-items: center; gap: 0.65rem; padding: 0.65rem 0 1.1rem; margin-bottom: 0.55rem; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
  .workspace-identity strong, .workspace-identity div span { display: block; }
  .workspace-identity div span { color: var(--muted); text-transform: capitalize; font-size: 0.8rem; }
  .workspace-avatar { width: 2.5rem; height: 2.5rem; flex: 0 0 2.5rem; border-radius: 0.65rem; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-weight: 750; }
  nav { display: grid; gap: 0.2rem; }
  nav a { gap: 0.55rem; padding: 0 0.62rem; border-radius: 0.45rem; font-size: 0.9rem; font-weight: 620; }
  nav a span { width: 1.25rem; color: var(--accent); }
  nav a[aria-current="page"] { background: var(--accent-soft); color: var(--accent-hover); }
  .workspace-content { min-width: 0; }
  .workspace-content :global(.account-panel) { margin-block: 0; }
  .mobile-workspace-nav { display: none; }
  @media (max-width: 54rem) {
    .workspace-frame { grid-template-columns: minmax(0, 1fr); margin-top: 0.8rem; }
    .workspace-identity { padding-bottom: 0.7rem; }
    .desktop-workspace-nav { display: none; }
    .mobile-workspace-nav { display: block; }
    .mobile-workspace-nav summary { min-height: 44px; padding: 0.65rem 0.35rem; font-weight: 650; cursor: pointer; }
    nav { grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); }
  }
</style>
