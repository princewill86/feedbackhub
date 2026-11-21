<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Send feedback to {data.name}</title></svelte:head>
<section class="widget">
  <h1>Send feedback</h1>
  <p>{data.name}</p>
  {#if data.submitted}
    <p role="status">Thanks. Your feedback was submitted.</p>
    <a href="?">Send more feedback</a>
  {:else}
    <form method="POST">
      <label>Title <input name="title" minlength="3" maxlength="140" required /></label>
      <label>Description <textarea name="description" maxlength="5000" required></textarea></label>
      <div hidden><label>Website <input name="website" tabindex="-1" autocomplete="off" /></label></div>
      {#if form?.message}<p role="alert">{form.message}</p>{/if}
      <button class="button">Send feedback</button>
    </form>
  {/if}
</section>

<style>
  .widget { width: min(100% - 2rem, 34rem); margin: 1.25rem auto; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2rem, 6vw, 3rem); }
  p { margin-block: 0.65rem; }
  form, label { display: grid; gap: 0.5rem; }
  input, textarea { padding: 0.6rem; min-height: 44px; border: 1px solid #887481; background: #fffdf8; }
  textarea { min-height: 6rem; }
  a { text-decoration: underline; }
</style>
