<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<svelte:head><title>{data.item.title} | FeedbackHub</title></svelte:head>

<article class="detail">
  <a href={`/workspaces/${data.slug}`}>Back to feedback</a>
  <h1>{data.item.title}</h1>
  <p class="body">{data.item.description}</p>
  <p>Status: {data.history[0]?.name ?? 'Unassigned'}</p>
  {#if data.statuses.length}
    <form method="POST" action="?/status">
      <label>Change status
        <select name="status" value={undefined} required>
          <option value="" disabled selected>Choose a status</option>
          {#each data.statuses as status (status.id)}<option value={status.id}>{status.name}</option>{/each}
        </select>
      </label>
      <button class="button">Update status</button>
    </form>
  {/if}
  {#if data.history.length}
    <details>
      <summary>Status history</summary>
      <ul>
        {#each data.history as change (change.id)}
          <li>{change.name} <time datetime={change.at.toISOString()}>{date.format(change.at)}</time></li>
        {/each}
      </ul>
    </details>
  {/if}
  {#if data.canPublish}
    <form method="POST" action="?/publish">
      <button class="button" name="intent" value={data.item.published ? 'hide' : 'publish'}>
        {data.item.published ? 'Hide from public board' : 'Publish to public board'}
      </button>
    </form>
  {/if}
  <p>{data.votes} {data.votes === 1 ? 'vote' : 'votes'}</p>
  {#if data.writable}
    <form method="POST" action="?/vote">
      <button class="button" name="intent" value={data.voted ? 'remove' : 'add'}>{data.voted ? 'Remove vote' : 'Vote'}</button>
    </form>
  {/if}
  <section>
    <h2>Discussion</h2>
    {#if form?.message}<p role="alert">{form.message}</p>{/if}
    {#if data.writable}
      <form method="POST" action="?/comment">
        <label>Comment <textarea name="body" maxlength="3000" required></textarea></label>
        <button class="button">Post comment</button>
      </form>
    {/if}
    {#each data.comments as comment (comment.id)}
      <div class="comment">
        <strong>{comment.author ?? 'Former member'}</strong>
        <time datetime={comment.createdAt.toISOString()}>{date.format(comment.createdAt)}</time>
        {#if comment.editedAt}<small>Edited</small>{/if}
        <p class="body">{comment.body}</p>
        {#if comment.canEdit}
          <details>
            <summary>Edit comment</summary>
            <form method="POST" action="?/editComment">
              <input type="hidden" name="commentId" value={comment.id} />
              <label>Comment <textarea name="body" maxlength="3000" required value={comment.body}></textarea></label>
              <button class="button">Save comment</button>
            </form>
          </details>
        {/if}
        {#if comment.canRemove}
          <form method="POST" action="?/removeComment">
            <input type="hidden" name="commentId" value={comment.id} />
            <button class="button">Remove comment</button>
          </form>
        {/if}
      </div>
    {:else}
      <p>No comments yet.</p>
    {/each}
    {#if data.page > 1 || data.hasNext}
      <nav aria-label="Comment pages">
        {#if data.page > 1}<a href={`?page=${data.page - 1}`}>Newer</a>{/if}
        {#if data.hasNext}<a href={`?page=${data.page + 1}`}>Older</a>{/if}
      </nav>
    {/if}
  </section>
</article>

<style>
  .detail { width: min(100% - 2rem, 46rem); margin: 2.5rem auto; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2.5rem, 6vw, 4rem); margin: 1rem 0; }
  h2 { font: 1.65rem var(--display); }
  .body { white-space: pre-wrap; margin-block: 1rem; }
  section, .comment { border-top: 1px solid var(--line); margin-top: 1.5rem; padding-block: 1rem; }
  form, label { display: grid; gap: 0.65rem; margin-block: 0.5rem; }
  button { justify-self: start; }
  select { padding: 0.6rem; min-height: 44px; border: 1px solid #887481; background: #fffdf8; }
  textarea { min-height: 6rem; padding: 0.6rem; border: 1px solid #887481; background: #fffdf8; }
  time { margin-inline-start: 0.5rem; font-size: 0.875rem; }
  a { text-decoration: underline; }
</style>
