<script lang="ts">
  import TokenManager from './lib/TokenManager.svelte';
  import DatabaseManager from './lib/DatabaseManager.svelte';
  import Ip2RegionManager from './lib/Ip2RegionManager.svelte';
  import GeoIpTester from './lib/GeoIpTester.svelte';

  type Tab = 'tokens' | 'database' | 'ip2region' | 'geoip';
  let activeTab = $state<Tab>('tokens');
</script>

<header class="topbar">
  <span class="title">EGeo Admin</span>
  <nav class="tabs">
    <button class="tab" class:active={activeTab === 'tokens'} onclick={() => (activeTab = 'tokens')}>
      Tokens
    </button>
    <button class="tab" class:active={activeTab === 'database'} onclick={() => (activeTab = 'database')}>
      Database
    </button>
    <button class="tab" class:active={activeTab === 'ip2region'} onclick={() => (activeTab = 'ip2region')}>
      ip2region
    </button>
    <button class="tab" class:active={activeTab === 'geoip'} onclick={() => (activeTab = 'geoip')}>
      GeoIP Tester
    </button>
  </nav>
</header>

<main class="content">
  <div class:hidden={activeTab !== 'tokens'}><TokenManager /></div>
  <div class:hidden={activeTab !== 'database'}><DatabaseManager /></div>
  <div class:hidden={activeTab !== 'ip2region'}><Ip2RegionManager /></div>
  <div class:hidden={activeTab !== 'geoip'}><GeoIpTester /></div>
</main>
