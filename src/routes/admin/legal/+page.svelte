<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  const documents = ['terms', 'privacy'] as const;
  const headingExample = '## Section heading';
</script>

<svelte:head>
  <title>Legal pages | FeedbackHub</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="account-panel legal-editor">
  <p><a href="/admin">Back to platform administration</a></p>
  <h1>Legal pages</h1>
  <p>Review the starter text before publishing this installation. Add your operator identity, contact details, and installation-specific terms and privacy practices.</p>
  {#if form?.message}<p role="status">{form.message}</p>{/if}
  {#each documents as kind (kind)}
    <details>
      <summary>{data[kind].title}</summary>
      <p><a href={'/' + kind}>View published page</a></p>
      <form method="POST" action="?/save">
        <input type="hidden" name="document" value={kind} />
        <label>Document text
          <textarea name="body" maxlength="24000" rows="18" required value={data[kind].body}></textarea>
        </label>
        <small>Use <code>{headingExample}</code> for headings. Separate headings and paragraphs with blank lines.</small>
        <button class="button">Save {data[kind].title}</button>
      </form>
    </details>
  {/each}
</section>

<style>
  .legal-editor { width: min(100% - 2rem, 58rem); }
  details { border-top: 1px solid var(--line); padding-block: 0.75rem; }
  summary { cursor: pointer; min-height: 44px; font-weight: 700; }
  textarea { width: 100%; font-family: ui-monospace, monospace; font-size: 0.9rem; }
</style>
