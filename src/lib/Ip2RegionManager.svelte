<script lang="ts">
  import { adminApi } from './api.ts';
  import type { ActiveIp2RegionConfig } from './types.ts';

  let config = $state<ActiveIp2RegionConfig | null>(null);
  let loading = $state(true);
  let uploading = $state(false);
  let error = $state('');
  let success = $state('');

  async function load() {
    loading = true;
    error = '';
    const res = await adminApi.getIp2Region();
    loading = false;
    if (res.success) config = res.data;
    else if (res.error.code !== 'IP2REGION_NOT_CONFIGURED') error = res.error.message;
  }

  async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xdb')) {
      error = 'Only .xdb files are accepted.';
      input.value = '';
      return;
    }
    uploading = true;
    error = '';
    success = '';
    const res = await adminApi.uploadIp2Region(file);
    uploading = false;
    input.value = '';
    if (res.success) {
      config = res.data;
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
    <h2>ip2region Database</h2>
    <button class="btn-sm" onclick={load} disabled={loading}>Refresh</button>
  </div>

  <p class="muted" style="margin-bottom: 1rem;">
    Used for Chinese mainland province lookups. Download
    <a href="https://github.com/lionsoul2014/ip2region/releases" target="_blank" rel="noopener">
      ip2region.xdb
    </a>
    and upload it here.
  </p>

  {#if error}<p class="alert alert-error">{error}</p>{/if}
  {#if success}<p class="alert alert-success">{success}</p>{/if}

  <div class="db-status">
    <h3>Active Database</h3>
    {#if loading}
      <p class="muted">Loading…</p>
    {:else if config}
      <dl class="dl-grid">
        <dt>Filename</dt><dd>{config.filename}</dd>
        <dt>Size</dt><dd>{formatBytes(config.size)}</dd>
        <dt>Uploaded</dt><dd>{new Date(config.uploaded_at).toLocaleString()}</dd>
        <dt>R2 Key</dt><dd class="mono muted">{config.object_key}</dd>
      </dl>
    {:else}
      <p class="muted">No ip2region database configured. Upload a .xdb file below.</p>
    {/if}
  </div>

  <div class="db-upload">
    <h3>Upload ip2region Database</h3>
    <p class="muted">Accepts ip2region v2 .xdb files (max 64 MiB).</p>
    <label class="file-label" class:disabled={uploading}>
      {#if uploading}
        Uploading…
      {:else}
        Choose .xdb file
      {/if}
      <input type="file" accept=".xdb" disabled={uploading} onchange={handleUpload} />
    </label>
  </div>
</section>
