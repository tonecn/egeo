# egeo

一个部署在 **Cloudflare Pages + Functions** 上的 GeoIP 查询与管理工具。  
当前项目已实现「管理端 + 查询 API + 本地化增强」的完整闭环。

## 目前已实现

### 1) 管理端（Svelte）

管理端需要 Basic Auth 登录，包含 4 个页面：

- **Tokens**
  - 创建 API Token（只展示一次明文）
  - 查看 Token 列表
  - 启用 / 禁用 Token
  - 删除 Token
- **Database**
  - 查看当前激活的 `.mmdb` 数据库信息
  - 上传新的 `.mmdb` 文件（最大 100 MiB）
- **ip2region**
  - 查看当前激活的 `.xdb` 数据库信息
  - 上传新的 `.xdb` 文件（最大 64 MiB）
- **GeoIP Tester**
  - 输入 Bearer Token + IP 直接调用 `/api/geoip`
  - 展示查询结果与数据库命中信息
  - 展示中文本地化字段（国家/省份）

### 2) 查询 API（Cloudflare Functions）

- `GET /api/geoip?ip=x.x.x.x`
  - 使用 **Bearer Token** 鉴权
  - 仅支持 **IPv4**
  - 从已激活的 MaxMind `.mmdb` 库读取地理信息
  - 当国家为 `CN` 时，额外使用 `ip2region.xdb` 补充省份信息
  - 返回统一 JSON：`success/data/error`，并带 `meta`（数据库文件名、缓存命中）

### 3) 数据与鉴权存储

- **KV (`APP_KV`)**
  - Token 元数据与哈希
  - 当前激活的 mmdb / ip2region 配置
- **R2 (`GEOIP_R2`)**
  - 上传的 `.mmdb` 与 `.xdb` 文件
- 鉴权方式
  - 管理端与静态资源：Basic Auth
  - `/api/*`：Bearer Token

---

## 软件截图（占位，待你替换）

> 下面先给出 README 位置占位。你把对应图片放到这些路径后即可直接显示。

### 管理端 - Token 管理

![Token 管理截图](./docs/screenshots/token-manager.png)

### 管理端 - 数据库上传

![数据库上传截图](./docs/screenshots/database-manager.png)

### 管理端 - GeoIP 测试

![GeoIP 测试截图](./docs/screenshots/geoip-tester.png)

---

## 本地开发（当前可用命令）

```bash
npm install
npm run dev
```

类型检查：

```bash
npm run check
```

构建：

```bash
npm run build
```

本地模拟 Pages：

```bash
npm run pages:dev
```

---

## 环境变量与绑定（部署时）

代码中当前依赖以下环境项：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- KV 绑定：`APP_KV`
- R2 绑定：`GEOIP_R2`
