<script lang="ts">
  import { buildGeoIpHeaders, buildGeoIpQueryPath, geoipApi } from './api.ts';
  import type { GeoIpData } from './types.ts';

  type GeoIpMeta = { database: { filename: string }; db_cache_hit: boolean };

  let token = $state('');
  let ip = $state('');
  let result = $state<GeoIpData | null>(null);
  let meta = $state<GeoIpMeta | null>(null);
  let loading = $state(false);
  let error = $state('');
  let copied = $state(false);

  const trimmedToken = $derived(token.trim());
  const trimmedIp = $derived(ip.trim());
  const requestPath = $derived(buildGeoIpQueryPath(trimmedIp));
  const requestHeaders = $derived(buildGeoIpHeaders(trimmedToken));
  const requestUrl = $derived(
    typeof window === 'undefined'
      ? requestPath
      : `${window.location.protocol}//${window.location.host}${requestPath}`
  );
  const curlCommand = $derived([
    'curl --request GET',
    `  --url ${JSON.stringify(requestUrl)}`,
    `  --header ${JSON.stringify(`Authorization: ${requestHeaders.Authorization ?? ''}`)}`,
  ].join(' \\\n'));

  async function query() {
    if (!trimmedToken || !trimmedIp) return;
    loading = true;
    error = '';
    result = null;
    meta = null;
    const res = await geoipApi.query(trimmedToken, trimmedIp);
    loading = false;
    if (res.success) {
      result = res.data;
      meta = (res as any).meta ?? null;
    } else {
      error = res.error.message;
    }
  }

  async function copyCurl() {
    if (!trimmedToken || !trimmedIp || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(curlCommand);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1600);
  }
</script>

<section class="card">
  <div class="card-header">
    <h2>GeoIP Tester</h2>
  </div>

  <form class="query-form" onsubmit={(e) => { e.preventDefault(); query(); }}>
    <label>
      Bearer Token
      <input type="text" placeholder="geoip_…" bind:value={token} autocomplete="off" />
    </label>
    <label>
      IP Address
      <input type="text" placeholder="1.2.3.4" bind:value={ip} />
    </label>
    <button type="submit" disabled={loading || !token.trim() || !ip.trim()}>
      {loading ? 'Querying…' : 'Query'}
    </button>
  </form>

  <div class="curl-block">
    <div class="curl-header">
      <h3>cURL</h3>
      <button class="btn-sm" type="button" disabled={!trimmedToken || !trimmedIp} onclick={copyCurl}>
        {copied ? 'Copied' : 'Copy cURL'}
      </button>
    </div>
    <pre class="curl-command"><code>{curlCommand}</code></pre>
  </div>

  {#if error}<p class="alert alert-error">{error}</p>{/if}

  {#if result}
    <div class="result-block">
      {#if meta}
        <p class="result-meta muted">
          Database: <span class="mono">{meta.database.filename}</span>
          &nbsp;·&nbsp;
          Cache: {meta.db_cache_hit ? '✓ hit' : '✗ miss'}
        </p>
      {/if}

      <dl class="dl-grid">
        <dt>IP</dt><dd class="mono">{result.ip}</dd>

        <dt>Country</dt>
        <dd>
          {result.country.iso_code ?? '—'}
          {#if result.country.name}&nbsp;({result.country.name}){/if}
        </dd>

        <dt>Continent</dt>
        <dd>
          {result.continent.code ?? '—'}
          {#if result.continent.name}&nbsp;({result.continent.name}){/if}
        </dd>

        {#if result.subdivisions.length > 0}
          <dt>Region</dt>
          <dd>{result.subdivisions.map(s => s.name ?? s.iso_code).join(', ')}</dd>
        {/if}

        <dt>City</dt><dd>{result.city.name ?? '—'}</dd>
        <dt>Postal</dt><dd>{result.postal.code ?? '—'}</dd>
        <dt>Timezone</dt><dd>{result.location.time_zone ?? '—'}</dd>

        {#if result.location.latitude != null}
          <dt>Coordinates</dt>
          <dd class="mono">
            {result.location.latitude}, {result.location.longitude}
            {#if result.location.accuracy_radius != null}
              &nbsp;(±{result.location.accuracy_radius} km)
            {/if}
          </dd>
        {/if}
      </dl>
    </div>

    <div class="result-block">
      <h3 class="localization-title">本地化 / Localization</h3>

      <dl class="dl-grid">
        <dt>语言</dt><dd>中文（简体）</dd>
        <dt>国家 / 地区</dt><dd>{result.localization.zh.country ?? '—'}</dd>
        {#if result.localization.zh.subdivision != null}
          <dt>省份</dt><dd>{result.localization.zh.subdivision}</dd>
        {/if}
        {#if result.localization.zh.city != null}
          <dt>城市</dt><dd>{result.localization.zh.city}</dd>
        {/if}
      </dl>
    </div>
  {/if}
</section>
