<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<svelte:head>
  <title>Platform administration | FeedbackHub</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="admin-console">
  <div class="admin-heading">
    <h1>Platform administration</h1>
    <p>Manage this installation’s public content, subscriptions, email, and activity.</p>
  </div>
  <nav aria-label="Platform administration">
    <a href="#public-website">Public website</a>
    <a href="/admin/plans">Subscription plans</a>
    <a href="/admin/legal">Legal pages</a>
    <a href="/admin/email">Email templates</a>
    <a href="#accounts">Accounts</a>
    <a href="#activity">Audit activity</a>
  </nav>
  <div class="admin-grid">
  <section id="public-website">
    <h2>Public website</h2>
    <form method="POST" action="?/save">
      {#each data.fields as field (field.key)}
        <label>{field.label}
          {#if field.maximum > 200}
            <textarea name={field.key} maxlength={field.maximum} required value={data.settings[field.key]}></textarea>
          {:else}
            <input name={field.key} maxlength={field.maximum} required value={data.settings[field.key]} />
          {/if}
        </label>
      {/each}
      {#if form?.message}<p role="status">{form.message}</p>{/if}
      <button class="button">Save settings</button>
    </form>
  </section>
  <div class="admin-stream">
  <section id="accounts">
    <h2>Recent accounts</h2>
    <ul>
      {#each data.accounts as account (account.email)}
        <li><strong>{account.name}</strong> <span>{account.email}</span> <time datetime={account.createdAt.toISOString()}>{date.format(account.createdAt)}</time></li>
      {:else}
        <li>No registered accounts.</li>
      {/each}
    </ul>
  </section>
  <section id="activity">
    <h2>Recent audit activity</h2>
    <ul>
      {#each data.activity as entry}
        <li><strong>{entry.action}</strong> <span>{entry.target}</span> <time datetime={entry.createdAt.toISOString()}>{date.format(entry.createdAt)}</time></li>
      {:else}
        <li>No recorded activity.</li>
      {/each}
    </ul>
  </section>
</div>
  </div>
</div>

<style>
  .admin-console { width: min(100% - 2rem, 76rem); padding-block: 1.5rem 4rem; margin: auto; }
  .admin-heading { padding: clamp(1.2rem, 4vw, 2.5rem); background: var(--ink); color: #fff7f1; border-radius: 0.9rem; }
  .admin-heading p { color: #ecd9e2; margin-top: 0.8rem; }
  .admin-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
  .admin-stream { display: grid; gap: 1rem; }
  h1 { font-size: clamp(2rem, 5vw, 4rem); }
  h2 { font: 1.65rem var(--display); margin-bottom: 1rem; }
  section { border: 1px solid var(--line); padding: clamp(0.9rem, 3vw, 1.65rem); background: var(--surface); border-radius: 0.85rem; }
  nav { margin-block: 1rem; }
  nav a { padding-inline: 0.7rem; background: var(--accent-soft); color: var(--accent); border-radius: 0.45rem; }
  form { display: grid; gap: 1rem; max-width: 40rem; justify-items: start; }
  label { display: grid; gap: 0.35rem; width: 100%; }
  input, textarea { padding: 0.6rem; min-height: 44px; border: 1px solid #ac96a3; background: #fffdf8; border-radius: 0.45rem; }
  textarea { min-height: 7rem; }
  li { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; padding-block: 0.65rem; border-top: 1px solid var(--line); overflow-wrap: anywhere; }
  time { margin-inline-start: auto; color: var(--muted); font-size: 0.85rem; }
  @media (max-width: 48rem) { .admin-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
