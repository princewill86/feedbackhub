<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

<svelte:head><title>Workspace invitation | FeedbackHub</title></svelte:head>
<section class="account-panel">
  <h1>Join {data.name}</h1>
  {#if data.eligible}
    <form method="POST" action="?/accept"><button class="button">Accept invitation</button></form>
  {:else if data.signedIn}
    <p>Sign in with the invited email address to accept.</p>
    <p><a href="/account">Go to your account</a></p>
  {:else}
    <p>Sign in or create an account with the invited email address, then reopen this link.</p>
    <p><a href="/auth/sign-in">Sign in</a> · <a href="/auth/register">Create account</a></p>
  {/if}
</section>
