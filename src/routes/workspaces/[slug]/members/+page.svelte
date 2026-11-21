<script lang="ts">
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Members · {data.name} | FeedbackHub</title></svelte:head>

<section class="members">
  <a href={`/workspaces/${data.slug}`}>Back to {data.name}</a>
  <h1>Workspace members</h1>
  {#if form?.message}<p role="status">{form.message}</p>{/if}
  {#if form?.invitation}<p><a href={form.invitation}>{form.invitation}</a></p>{/if}
  {#if data.owner}
    <form method="POST" action="?/add">
      <label>Email <input name="email" type="email" maxlength="254" required /></label>
      <label>Role
        <select name="role" value="member">
          {#each data.roles as role}<option value={role}>{role}</option>{/each}
        </select>
      </label>
      <button class="button" formaction="?/invite">Create invitation</button>
      <button class="button">Add registered member</button>
    </form>
  {/if}
  <ul>
    {#each data.members as member (member.id)}
      <li>
        <div><strong>{member.name}</strong><p>{member.email} · {member.role}</p></div>
        {#if data.owner && member.role !== 'owner'}
          <form method="POST" action="?/update">
            <input type="hidden" name="userId" value={member.id} />
            <select name="role" value={member.role} aria-label={`Role for ${member.name}`}>
              {#each data.roles as role}<option value={role}>{role}</option>{/each}
            </select>
            <button class="button">Save role</button>
            <button class="button" formaction="?/remove">Remove</button>
          </form>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .members { max-width: 65rem; margin: auto; padding: 2rem 1rem 4rem; overflow-wrap: anywhere; }
  h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); margin-block: 0.75rem 1.5rem; }
  a { text-decoration: underline; }
  form, li { display: flex; flex-wrap: wrap; align-items: end; gap: 0.75rem; }
  li { justify-content: space-between; border-top: 1px solid var(--line); padding-block: 1rem; }
  ul { margin-top: 2rem; }
  label { display: grid; gap: 0.35rem; max-width: 100%; }
  input, select { padding: 0.5rem; min-height: 44px; border: 1px solid #887481; background: #fffdf8; }
</style>
