<script lang="ts">
  import { adminApi } from './api.ts';
  import type { TokenRecord } from './types.ts';

  let tokens = $state<TokenRecord[]>([]);
  let loading = $state(true);
  let error = $state('');
  let newName = $state('');
  let creating = $state(false);
  let newToken = $state<string | null>(null);

  async function load() {
    loading = true;
    error = '';
    const res = await adminApi.listTokens();
    loading = false;
    if (res.success) tokens = res.data;
    else error = res.error.message;
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    creating = true;
    error = '';
    const res = await adminApi.createToken(name);
    creating = false;
    if (res.success) {
      newToken = res.data.token;
      newName = '';
      await load();
    } else {
      error = res.error.message;
    }
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await adminApi.updateToken(id, !enabled);
    if (res.success) {
      tokens = tokens.map(t => t.id === id ? { ...t, enabled: !enabled } : t);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete token "${name}"? This cannot be undone.`)) return;
    const res = await adminApi.deleteToken(id);
    if (res.success) tokens = tokens.filter(t => t.id !== id);
    else error = res.error.message;
  }

  load();
</script>

<section class="card">
  <div class="card-header">
    <h2>API Tokens</h2>
    <button class="btn-sm" onclick={load} disabled={loading}>Refresh</button>
  </div>

  {#if newToken}
    <div class="alert alert-success">
      <div class="alert-title">Token created — copy it now, it will not be shown again.</div>
      <div class="token-reveal">
        <code>{newToken}</code>
        <button class="btn-sm" onclick={() => navigator.clipboard.writeText(newToken!)}>Copy</button>
        <button class="btn-sm btn-ghost" onclick={() => (newToken = null)}>Dismiss</button>
      </div>
    </div>
  {/if}

  {#if error}<p class="alert alert-error">{error}</p>{/if}

  <form class="inline-form" onsubmit={(e) => { e.preventDefault(); create(); }}>
    <input type="text" placeholder="Token name (e.g. my-service)" bind:value={newName} />
    <button type="submit" disabled={creating || !newName.trim()}>
      {creating ? 'Creating…' : '+ Create Token'}
    </button>
  </form>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if tokens.length === 0}
    <p class="muted">No tokens yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>ID</th>
          <th>Status</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each tokens as token (token.id)}
          <tr>
            <td>{token.name}</td>
            <td class="mono muted">{token.id}</td>
            <td>
              <span class="badge" class:badge-green={token.enabled} class:badge-gray={!token.enabled}>
                {token.enabled ? 'Active' : 'Disabled'}
              </span>
            </td>
            <td class="muted">{new Date(token.created_at).toLocaleString()}</td>
            <td class="actions">
              <button class="btn-sm btn-ghost" onclick={() => toggle(token.id, token.enabled)}>
                {token.enabled ? 'Disable' : 'Enable'}
              </button>
              <button class="btn-sm btn-danger" onclick={() => remove(token.id, token.name)}>
                Delete
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>
