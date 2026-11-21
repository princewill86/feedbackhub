<style>
  :global(body:has(.widget) .masthead) { display: none; }
</style>

<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
