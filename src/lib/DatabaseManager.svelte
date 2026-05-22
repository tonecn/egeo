<script lang="ts">
  import { adminApi } from './api.ts';
  import type { ActiveDbConfig } from './types.ts';

  let db = $state<ActiveDbConfig | null>(null);
  let loading = $state(true);
  let uploading = $state(false);
  let error = $state('');
  let success = $state('');

  async function load() {
    loading = true;
    error = '';
    const res = await adminApi.getDatabase();
    loading = false;
    if (res.success) db = res.data;
    else if (res.error.code !== 'DB_NOT_CONFIGURED') error = res.error.message;
  }

  async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.mmdb')) {
      error = 'Only .mmdb files are accepted.';
      input.value = '';
      return;
    }
    uploading = true;
    error = '';
    success = '';
    const res = await adminApi.uploadDatabase(file);
    uploading = false;
    input.value = '';
    if (res.success) {
      db = res.data;
      success = `"${res.data.filename}" is now active.`;
    } else {
      error = res.error.message;
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  load();
</script>

<section class="card">
  <div class="card-header">
    <h2>GeoIP Database</h2>
    <button class="btn-sm" onclick={load} disabled={loading}>Refresh</button>
  </div>

  {#if error}<p class="alert alert-error">{error}</p>{/if}
  {#if success}<p class="alert alert-success">{success}</p>{/if}

  <div class="db-status">
    <h3>Active Database</h3>
    {#if loading}
      <p class="muted">Loading…</p>
    {:else if db}
      <dl class="dl-grid">
        <dt>Filename</dt><dd>{db.filename}</dd>
        <dt>Size</dt><dd>{formatBytes(db.size)}</dd>
        <dt>Uploaded</dt><dd>{new Date(db.uploaded_at).toLocaleString()}</dd>
        <dt>R2 Key</dt><dd class="mono muted">{db.object_key}</dd>
      </dl>
    {:else}
      <p class="muted">No database configured. Upload an .mmdb file below.</p>
    {/if}
  </div>

  <div class="db-upload">
    <h3>Upload New Database</h3>
    <p class="muted">Accepts MaxMind GeoIP2 / GeoLite2 .mmdb files (max 100 MiB).</p>
    <label class="file-label" class:disabled={uploading}>
      {#if uploading}
        Uploading…
      {:else}
        Choose .mmdb file
      {/if}
      <input type="file" accept=".mmdb" disabled={uploading} onchange={handleUpload} />
    </label>
  </div>
</section>
