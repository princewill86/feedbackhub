<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  const linkVariable = '{{link}}';
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
  const workspaceVariable = '{{workspace}}';
</script>

<svelte:head>
  <title>Email templates | FeedbackHub</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="account-panel templates">
  <p><a href="/admin">Back to platform administration</a></p>
  <h1>Email templates</h1>
  <p>{data.enabled ? 'A mail transport is configured.' : 'Mail delivery requires transport configuration.'}</p>
  {#if form?.message}<p role="status">{form.message}</p>{/if}
  {#each data.entries as entry (entry.kind)}
    <details>
      <summary>{entry.label}</summary>
      <form method="POST" action="?/save">
        <input type="hidden" name="kind" value={entry.kind} />
        <label>Subject <input name="subject" maxlength="120" value={entry.subject} required /></label>
        <label>Message <textarea name="body" maxlength="5000" value={entry.body} required></textarea></label>
        <small>Include <code>{linkVariable}</code>. {#if entry.kind === 'invitation'}You can also use <code>{workspaceVariable}</code>.{/if}</small>
        <button class="button">Save template</button>
      </form>
      <details>
        <summary>Preview saved template</summary>
        <strong>{entry.subject}</strong>
        <p class="preview">{entry.preview}</p>
      </details>
    </details>
  {/each}
  <h2>Recent deliveries</h2>
  <ul>
    {#each data.deliveries as delivery (delivery.id)}
      <li><strong>{delivery.kind}</strong> · {delivery.status} · {delivery.attempts} attempts · {date.format(delivery.createdAt)} UTC</li>
    {:else}
      <li>No queued mail yet.</li>
    {/each}
  </ul>
</section>

<style>
  .templates { width: min(100% - 2rem, 48rem); overflow-wrap: anywhere; }
  details { border-top: 1px solid var(--line); padding-block: 0.75rem; }
  h2 { font: 1.65rem var(--display); margin-block: 1.5rem 0.75rem; }
  li { padding-block: 0.5rem; }
  summary { cursor: pointer; min-height: 44px; }
  form { margin-bottom: 1rem; }
  textarea { padding: 0.6rem; min-height: 8rem; border: 1px solid #887481; background: #fffdf8; }
  .preview { white-space: pre-wrap; }
</style>
