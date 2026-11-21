<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Workspaces | FeedbackHub</title></svelte:head>

<div class="directory site-width">
  <section aria-labelledby="workspace-heading">
    <h1 id="workspace-heading">Workspaces</h1>
    <p class="intro">Open a workspace to review feedback, manage products, and publish updates.</p>
    <ul>
      {#each data.entries as workspace (workspace.slug)}
        <li>
          <a href={`/workspaces/${workspace.slug}`}>
            <span class="initial" aria-hidden="true">{workspace.name.trim().slice(0, 1).toUpperCase()}</span>
            <span class="workspace-label"><strong>{workspace.name}</strong><span>{workspace.role}</span></span>
            <span aria-hidden="true">→</span>
          </a>
        </li>
      {:else}
        <li class="empty">You don’t belong to a workspace yet. Create one here or accept an invitation from your team.</li>
      {/each}
    </ul>
  </section>
  <section class="account-panel" aria-labelledby="create-heading">
    <h2 id="create-heading">Create a workspace</h2>
    <form method="POST" action="?/create">
      <label>Workspace name <input name="name" maxlength="80" required /></label>
      <label>URL slug <input name="slug" maxlength="64" placeholder="example-team" required /></label>
      {#if form?.message}<p role="alert">{form.message}</p>{/if}
      <button class="button">Create workspace</button>
    </form>
  </section>
</div>

<style>
  .directory { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr); align-items: start; gap: clamp(1.5rem, 5vw, 5rem); padding-block: clamp(2rem, 6vw, 5rem); }
  h1 { font-size: clamp(2.75rem, 7vw, 5.5rem); }
  h2 { font: 1.7rem var(--display); margin-bottom: 1rem; }
  .intro { color: var(--muted); margin-block: 1rem 1.5rem; }
  ul { border-top: 1px solid var(--line); }
  li { border-bottom: 1px solid var(--line); }
  li a { padding: 0.8rem 0.35rem; display: flex; align-items: center; gap: 0.75rem; min-height: 55px; }
  .initial { flex: 0 0 2.5rem; height: 2.5rem; border-radius: 0.55rem; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-weight: 750; }
  .workspace-label { display: grid; flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .workspace-label span { font-size: 0.82rem; color: var(--muted); text-transform: capitalize; }
  .empty { padding-block: 1rem; }
  .account-panel { width: 100%; margin: 0; }
  @media (max-width: 45rem) { .directory { grid-template-columns: minmax(0, 1fr); } }
</style>
