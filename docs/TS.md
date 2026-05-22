# GeoIP 查询平台技术方案说明书 v1

## 1. 项目目标

构建一个基于 **Cloudflare Pages + Cloudflare Workers** 的 GeoIP 查询平台，支持：

- 前端单页管理界面
- 管理员通过 **Basic Auth** 登录和访问管理接口
- 管理页面对 **API Token** 进行配置管理
- 管理页面上传 **MaxMind 数据库文件** 到 **Cloudflare R2**
- 业务查询接口通过 **Bearer Token** 鉴权
- 用户传入 **IPv4** 地址后返回完整 GeoIP 信息
- 后续支持扩展统计、缓存、审计、数据库更新策略

本期版本强调：

- 权责清晰
- 易于部署
- 运行链路简单
- 减少合规和供应链风险
- 为后续扩展保留结构

---

# 2. 需求边界

## 2.1 本期纳入范围

### 管理侧
- Basic Auth 保护管理页面及管理接口
- API Token 创建、查看、删除、启用/禁用
- MaxMind mmdb 文件上传到 R2
- 查看当前已启用数据库文件的元信息
- 基础系统配置读取（默认配置 + KV 配置）

### 查询侧
- Bearer Token 鉴权
- 支持传入 IPv4 地址进行 GeoIP 查询
- 返回标准化后的完整 GeoIP 数据

### 存储侧
- KV 存储 API Token 配置及业务配置
- R2 存储 MaxMind mmdb 文件

---

## 2.2 本期不纳入范围

- 统计图表
- 查询日志
- 审计日志
- 结果缓存
- MaxMind 数据主动下载/同步
- IPv6 查询
- 多角色权限系统
- 管理员账户体系扩展
- Token 细粒度权限控制
- 查询限流配额
- 多数据库策略切换
- 多租户支持

---

# 3. 关键设计决策

## 3.1 鉴权职责分离

你已经明确这个方向，这也是本方案的重要基础：

### Basic Auth
仅用于：
- 管理页面访问
- 管理接口调用

### Bearer Token
仅用于：
- 业务 GeoIP 查询接口调用

### 不允许混用
- 管理接口不能接受 Bearer Token
- 查询接口不能接受 Basic Auth

这样做的好处：
- 权限边界清晰
- 管理凭据和业务调用凭据隔离
- 后续扩展速率限制、配额和 token 权限更自然

---

## 3.2 Basic Auth 密码传输策略

你的设想是：
- 环境变量明文存储账户密码
- 前端和 Worker 分别 hash 后再做比对
- 降低前端到 Worker 的泄漏风险

这里需要明确一个现实问题：

### 结论
**如果最终还是使用标准 HTTP Basic Auth 头，那么浏览器到 Worker 之间的 Basic 凭据本质上仍然会被传输。**  
也就是说，前端先 hash 再传，已经不再是“标准 Basic Auth”了，而是“自定义登录协议”。

因此这里建议分两种实现路线，必须二选一：

---

### 方案 A：严格 Basic Auth 方案
- 浏览器使用标准 `Authorization: Basic base64(username:password)`
- Worker 直接读取并校验
- 环境变量里存明文用户名密码，Worker 本地比对
- 依赖 HTTPS 保护传输安全

#### 优点
- 实现最简单
- 浏览器原生支持
- 符合 Basic Auth 语义

#### 缺点
- 用户名密码会在请求中直接传给 Worker（当然是走 HTTPS）

---

### 方案 B：自定义登录口令方案
- 前端不发送明文密码
- 前端对密码做 hash 后发送
- Worker 对环境变量密码做同样 hash 后对比
- 这已经不是标准 Basic Auth，而是自定义认证协议

#### 优点
- 避免前端到 Worker 直接传原始密码
- 更符合你的预期

#### 缺点
- 不能再叫严格意义上的 Basic Auth
- 需要自定义登录逻辑和会话机制
- 如果只是“hash(password)”直接传输，仍存在重放风险，除非引入 nonce/challenge

---

### 本方案建议
**从工程简洁和正确性角度，v1 仍建议采用标准 Basic Auth。**

原因：
1. 你现在只需要一个轻量后台保护
2. Worker 与前端间默认走 HTTPS
3. 自定义 hash 登录如果没有 challenge 机制，并不比 HTTPS 下的 Basic Auth 更安全
4. 自定义方案会把简单问题复杂化

所以本说明书后续默认采用：

- **管理入口：标准 Basic Auth**
- 环境变量中存明文用户名密码
- Worker 直接校验
- 不在前端持久化密码
- 不做自定义 hash 登录协议

如果你坚持“前端和 Worker 分别 hash 后比对”，那我建议后续单独作为“管理登录协议改造版 v1.1”处理。

---

# 4. 总体架构

```text
[ Browser / Svelte WebUI ]
           |
           | HTTPS
           v
[ Cloudflare Pages / Worker 统一入口 ]
           |
   +-------+--------------------+
   |                            |
   v                            v
[ 管理接口 ]                 [ 查询接口 ]
 Basic Auth                   Bearer Token
   |                            |
   v                            v
[ Cloudflare KV ]            [ Cloudflare R2 ]
 token/config                MaxMind mmdb 文件
```

---

## 4.1 推荐部署形式

推荐使用：

- **Svelte 前端** 部署到 Cloudflare Pages
- **Workers/Pages Functions** 作为 API 层和鉴权层

有两种组织方式：

### 方式 1：Pages + Functions
- 前端静态资源在 Pages
- `/api/*` 和 `/admin/*` 由 Functions/Worker 处理
- 适合一体化项目

### 方式 2：Pages 前端 + 独立 Worker API
- 前端单独部署
- API 单独部署
- 通过域名或路径区分

### 推荐
**优先使用方式 1：Pages + Functions 一体化部署**

理由：
- 更简单
- 前后端同域，减少 CORS 配置
- 管理入口保护更统一

---

# 5. 技术选型

## 5.1 前端
- **Svelte**
- 构建工具：**Vite**
- UI 风格：轻量管理后台
- 图表库：本期不需要

## 5.2 服务端
- **Cloudflare Workers / Pages Functions**
- TypeScript

## 5.3 存储
- **Cloudflare KV**
  - API Token 元数据
  - 基础业务配置
- **Cloudflare R2**
  - MaxMind mmdb 文件

## 5.4 GeoIP 数据源
- **MaxMind mmdb**
- 上传方式：**前端管理页面上传到 R2**
- 本期不做主动下载，不做镜像同步

## 5.5 密码学能力
- Worker Web Crypto API：SHA-256/HMAC 等
- 用于 Token hash 存储和校验

---

# 6. 模块划分

建议项目分为以下模块：

## 6.1 前端模块

### 1）认证入口模块
- 管理页面的访问入口
- 浏览器弹出 Basic Auth 登录框或由 fetch 自动附带凭据

### 2）Token 管理模块
- 创建 token
- 删除 token
- 启用/禁用 token
- 查看 token 列表
- 显示新建 token 的明文（仅首次）

### 3）数据库上传模块
- 上传 mmdb 文件到 R2
- 展示当前数据库版本/文件名/更新时间
- 设置当前启用数据库

### 4）GeoIP 测试模块
- 输入 IPv4
- 输入 Bearer Token
- 触发查询
- 展示 JSON 结果

### 5）系统配置展示模块
- 展示默认配置
- 展示当前数据库状态
- 展示接口状态信息

---

## 6.2 服务端模块

### 1）管理鉴权中间件
- 校验 Basic Auth
- 仅允许访问 `/admin/*`

### 2）查询鉴权中间件
- 校验 Bearer Token
- 仅允许访问 `/api/geoip`

### 3）Token 管理服务
- 生成 token
- 计算 token hash
- 存储与查询 KV
- 启用/禁用
- 删除

### 4）GeoIP 服务
- 从 R2 读取 mmdb
- 解析 IPv4
- 执行查询
- 标准化输出结果

### 5）数据库文件管理服务
- 上传文件
- 获取当前数据库信息
- 标记当前启用数据库

### 6）配置服务
- 默认配置读取
- KV 覆盖配置读取

---

# 7. 配置设计

## 7.1 环境变量

本期只保留你要求的最小集合：

```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

说明：
- 仅用于管理接口 Basic Auth
- 采用 Worker 直接明文比对的方式
- 依赖 HTTPS 保护传输

---

## 7.2 默认配置

默认配置在代码中定义，例如：

```ts
export const defaultConfig = {
  r2DatabaseKey: "db/current.mmdb",
  tokenPrefix: "geoip",
  tokenLength: 32,
  allowIPv6: false,
  resultCacheEnabled: false,
};
```

这些配置不放环境变量，便于版本管理。

---

## 7.3 KV 配置项

通过 KV 保存可变业务配置：

### 示例 key
```text
config:active_db
config:service
```

### `config:active_db`
```json
{
  "object_key": "db/uploads/GeoLite2-City-20260521.mmdb",
  "filename": "GeoLite2-City-20260521.mmdb",
  "uploaded_at": "2026-05-21T10:00:00Z",
  "size": 12345678
}
```

### `config:service`
```json
{
  "result_cache_enabled": false
}
```

---

# 8. KV 数据模型

---

## 8.1 Token 存储设计

采用你确认的 **token hash 反查方案**。

### 原则
- 只展示一次明文 token
- KV 中不保存明文 token
- 使用 token 的 SHA-256 值作为 key 或索引

---

## 8.2 推荐 KV Key 结构

### Token 反查记录
```text
token:{sha256(token)}
```

Value:
```json
{
  "id": "tok_20260521_xxxx",
  "name": "default client",
  "enabled": true,
  "created_at": "2026-05-21T10:00:00Z",
  "updated_at": "2026-05-21T10:00:00Z"
}
```

### Token 元数据列表项
为了便于后台列出 token，建议再建一份元数据：

```text
token_meta:{id}
```

Value:
```json
{
  "id": "tok_20260521_xxxx",
  "name": "default client",
  "enabled": true,
  "created_at": "2026-05-21T10:00:00Z",
  "updated_at": "2026-05-21T10:00:00Z",
  "token_hash": "abcdef..."
}
```

### 为什么需要两份
- `token:{hash}`：用于查询接口快速鉴权
- `token_meta:{id}`：用于后台管理展示

否则仅靠 hash key 不方便列出和管理。

---

## 8.3 配置项

```text
config:active_db
config:service
```

---

# 9. R2 对象设计

## 9.1 数据库文件路径

建议按上传时间归档：

```text
db/uploads/{filename}
```

例如：
```text
db/uploads/GeoLite2-City-20260521.mmdb
```

当前启用哪个数据库，不靠固定覆盖，而是由 KV 的 `config:active_db` 指向。

---

## 9.2 为什么不直接固定覆盖 `db/current.mmdb`
因为保留版本有几个好处：
- 可回滚
- 易调试
- 可在后台查看历史上传
- 避免误覆盖导致不可恢复

本期即使不做历史列表，也建议对象按版本命名保存。

---

# 10. API 设计

---

## 10.1 管理接口

所有 `/admin/*` 路由必须通过 **Basic Auth**。

---

### 10.1.1 获取 Token 列表
`GET /admin/tokens`

返回：
```json
{
  "success": true,
  "data": [
    {
      "id": "tok_001",
      "name": "default client",
      "enabled": true,
      "created_at": "2026-05-21T10:00:00Z",
      "updated_at": "2026-05-21T10:00:00Z"
    }
  ]
}
```

---

### 10.1.2 创建 Token
`POST /admin/tokens`

请求：
```json
{
  "name": "client-a"
}
```

返回：
```json
{
  "success": true,
  "data": {
    "id": "tok_001",
    "name": "client-a",
    "enabled": true,
    "created_at": "2026-05-21T10:00:00Z",
    "token": "geoip_xxxxxxxxxxxxxxxxx"
  }
}
```

说明：
- `token` 仅在创建时返回一次
- 后续无法再次查看明文

---

### 10.1.3 启用/禁用 Token
`PATCH /admin/tokens/:id`

请求：
```json
{
  "enabled": false
}
```

---

### 10.1.4 删除 Token
`DELETE /admin/tokens/:id`

行为：
- 删除 `token_meta:{id}`
- 删除 `token:{hash}`

---

### 10.1.5 上传数据库文件
`POST /admin/database/upload`

请求：
- `multipart/form-data`
- 字段：`file`

约束：
- 仅允许 `.mmdb`
- 限制文件大小
- 上传成功后写入 R2
- 同时更新 `config:active_db`

返回：
```json
{
  "success": true,
  "data": {
    "filename": "GeoLite2-City-20260521.mmdb",
    "object_key": "db/uploads/GeoLite2-City-20260521.mmdb",
    "size": 12345678,
    "uploaded_at": "2026-05-21T10:00:00Z"
  }
}
```

---

### 10.1.6 获取当前数据库信息
`GET /admin/database`

返回：
```json
{
  "success": true,
  "data": {
    "filename": "GeoLite2-City-20260521.mmdb",
    "object_key": "db/uploads/GeoLite2-City-20260521.mmdb",
    "size": 12345678,
    "uploaded_at": "2026-05-21T10:00:00Z"
  }
}
```

---

### 10.1.7 系统配置查看
`GET /admin/config`

返回默认配置和当前生效配置。

---

## 10.2 查询接口

所有查询接口只能接受 **Bearer Token**。

---

### 10.2.1 GeoIP 查询
`GET /api/geoip?ip=1.2.3.4`

请求头：
```text
Authorization: Bearer <token>
```

返回：
```json
{
  "success": true,
  "data": {
    "ip": "1.2.3.4",
    "continent": {
      "code": "AS",
      "name": "Asia"
    },
    "country": {
      "iso_code": "CN",
      "name": "China"
    },
    "subdivisions": [
      {
        "iso_code": "BJ",
        "name": "Beijing"
      }
    ],
    "city": {
      "name": "Beijing"
    },
    "location": {
      "latitude": 39.9289,
      "longitude": 116.3883,
      "time_zone": "Asia/Shanghai",
      "accuracy_radius": 100
    },
    "postal": {
      "code": ""
    }
  },
  "meta": {
    "database": {
      "filename": "GeoLite2-City-20260521.mmdb",
      "uploaded_at": "2026-05-21T10:00:00Z"
    }
  }
}
```

---

# 11. 鉴权设计

---

## 11.1 管理接口鉴权

### 规则
- 仅接受 `Authorization: Basic ...`
- 用户名必须匹配 `ADMIN_USERNAME`
- 密码必须匹配 `ADMIN_PASSWORD`

### 失败处理
返回：
- `401 Unauthorized`
- `WWW-Authenticate: Basic realm="GeoIP Admin"`

---

## 11.2 查询接口鉴权

### 规则
- 仅接受 `Authorization: Bearer ...`
- 取出 token
- 计算 `sha256(token)`
- 使用 `token:{hash}` 查 KV
- 如果记录不存在或 `enabled != true`，返回 401

---

## 11.3 安全原则
- 不允许一个接口同时接受两种鉴权方式
- 管理和业务鉴权中间件完全分离
- 不回显 token hash
- 不记录明文 token

---

# 12. GeoIP 查询流程设计

---

## 12.1 请求流程

1. 客户端调用 `/api/geoip?ip=x.x.x.x`
2. Worker 校验 Bearer Token
3. 校验 IPv4 参数是否合法
4. 读取 `config:active_db`
5. 从 R2 获取对应 mmdb 文件
6. 使用 mmdb 解析库执行 IP 查询
7. 将原始结果标准化
8. 返回统一 JSON 结果

---

## 12.2 IPv4 校验规则

必须严格限制为 IPv4：

- 必须包含 4 段
- 每段必须是十进制数字
- 每段取值 0~255
- 拒绝空值
- 拒绝非数字字符
- 拒绝 IPv6
- 拒绝 CIDR
- 拒绝端口形式

例如：
- 允许：`8.8.8.8`
- 拒绝：`8.8.8.8:53`
- 拒绝：`192.168.1.0/24`
- 拒绝：`::1`

---

## 12.3 数据库读取策略

本期不做结果缓存，但为了性能，建议做 **进程内数据库对象复用**：

### 建议
- Worker 全局变量中缓存已解析数据库实例
- 同时记录当前 `object_key`
- 当 `config:active_db` 指向变化时重新加载

### 逻辑
```text
若全局数据库不存在 -> 从 R2 加载
若当前 object_key 与缓存 object_key 不一致 -> 重新加载
否则复用内存实例
```

### 说明
这不属于“查询结果缓存”，只是运行期资源复用，建议保留。

---

# 13. GeoIP 返回结构标准化

不要直接将底层库原始对象完整透传，建议标准化。

## 13.1 标准响应结构

```json
{
  "success": true,
  "data": {
    "ip": "8.8.8.8",
    "continent": {
      "code": "NA",
      "name": "North America"
    },
    "country": {
      "iso_code": "US",
      "name": "United States"
    },
    "subdivisions": [],
    "city": {
      "name": "Mountain View"
    },
    "location": {
      "latitude": 37.4056,
      "longitude": -122.0775,
      "time_zone": "America/Los_Angeles",
      "accuracy_radius": 1000
    },
    "postal": {
      "code": "94043"
    }
  },
  "meta": {
    "database": {
      "filename": "GeoLite2-City-20260521.mmdb",
      "uploaded_at": "2026-05-21T10:00:00Z"
    }
  }
}
```

---

## 13.2 标准化好处
- 前端展示稳定
- 底层库变动不影响 API
- 后续可补充 ASN、ISP 等字段
- 更容易写文档和测试

---

# 14. 前端页面设计

由于本期只要一个页面，建议布局如下：

---

## 14.1 页面结构

### 区块 1：当前数据库状态
- 当前数据库文件名
- 上传时间
- 文件大小
- 数据库状态提示

### 区块 2：数据库上传
- 选择 `.mmdb` 文件
- 上传按钮
- 上传结果提示

### 区块 3：API Token 管理
- token 列表
- 新建 token
- 启用/禁用
- 删除
- 新 token 明文一次性展示

### 区块 4：GeoIP 测试工具
- 输入 IPv4
- 输入 Bearer Token
- 点击查询
- 展示 JSON 响应

### 区块 5：系统配置展示
- 当前默认配置
- 当前 active_db 配置

---

## 14.2 Svelte 组件建议

```text
src/
  lib/
    api.ts
    auth.ts
    types.ts
    utils.ts
  routes/
    +page.svelte
  components/
    DatabaseStatus.svelte
    DatabaseUpload.svelte
    TokenManager.svelte
    GeoIpTester.svelte
    ConfigViewer.svelte
```

如果你用的是纯 SPA 结构，也可以集中到一个页面组件里，但建议按功能拆组件。

---

# 15. 错误处理设计

统一错误响应结构：

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid bearer token"
  }
}
```

---

## 15.1 错误码建议

### 鉴权类
- `UNAUTHORIZED`
- `INVALID_BASIC_AUTH`
- `INVALID_BEARER_TOKEN`

### 参数类
- `INVALID_IP`
- `INVALID_REQUEST`
- `MISSING_PARAMETER`

### 资源类
- `DATABASE_NOT_FOUND`
- `DATABASE_NOT_CONFIGURED`
- `TOKEN_NOT_FOUND`

### 系统类
- `R2_ERROR`
- `KV_ERROR`
- `INTERNAL_ERROR`
- `GEOIP_LOOKUP_FAILED`

---

# 16. 安全设计

---

## 16.1 当前版本安全边界

### 已做
- HTTPS 下传输
- Basic Auth 与 Bearer Token 职责分离
- Token 仅存 hash
- 管理接口与查询接口隔离
- 明文 token 只在创建时返回一次
- MaxMind 数据库由管理员上传，避免镜像站风险

### 未做
- 管理员密码哈希存储
- 登录挑战应答机制
- 查询频控
- IP 黑名单
- CSRF 专项防护
- 审计日志
- WAF 规则定制

---

## 16.2 安全建议
虽然你本期不做这些，但建议保留演进方向：
- 后续把管理认证升级到 session/cookie + challenge 登录
- 查询接口增加 rate limit
- Token 增加备注、过期时间、用途说明
- 上传接口增加 MIME 和扩展名双重校验

---

# 17. 性能设计

---

## 17.1 本期性能策略
- 不做查询结果缓存
- 允许 Worker 全局缓存 mmdb 解析实例
- Token 校验直接走 KV 单次读取
- 配置读取走 KV，必要时可做短时内存缓存

---

## 17.2 风险点
最大性能影响来自：
1. mmdb 文件从 R2 读取
2. mmdb 解析库初始化
3. Worker 冷启动

因此建议：
- 尽量复用数据库实例
- active_db 变更时才重新加载

---

# 18. 可运维性设计

虽然本期不做日志和统计，但建议提供基本状态信息：

## 18.1 最小状态能力
- `/admin/database` 可查看当前数据库信息
- `/admin/config` 可查看当前配置
- 上传成功后立即校验对象存在性
- 查询接口响应中带上 `meta.database.filename`

---

# 19. 部署设计

---

## 19.1 Cloudflare 资源

需要准备：

- 1 个 Pages 项目
- 1 个 Worker/Functions 服务
- 1 个 KV Namespace
- 1 个 R2 Bucket

---

## 19.2 绑定建议

### KV
- `APP_KV`

### R2
- `GEOIP_R2`

---

## 19.3 环境变量
```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

---

# 20. 开发优先级

---

## 阶段 1：基础骨架
- 搭建 Svelte + Pages + Functions
- 建立统一响应格式
- 完成 Basic Auth 管理路由保护
- 完成 Bearer Token 查询路由保护

## 阶段 2：Token 管理
- 创建 token
- hash 存储
- 列表展示
- 启用/禁用
- 删除

## 阶段 3：数据库管理
- 上传 mmdb 到 R2
- 写入 active_db 配置
- 获取当前数据库信息

## 阶段 4：GeoIP 查询
- IPv4 校验
- 从 R2 读取 mmdb
- 查询并标准化返回

## 阶段 5：前端整合
- 单页管理界面
- Token 管理 UI
- 数据库上传 UI
- 查询测试 UI

---

# 21. 最大技术验证点

在真正开工前，建议优先做一个最小 PoC，验证以下事项：

## PoC 必测项
1. Worker 能否从 R2 正常读取 mmdb
2. 所选 mmdb 解析库能否在 Cloudflare Workers 环境运行
3. 对 IPv4 查询能否返回正确结果
4. 解析实例是否可被 Worker 全局复用
5. 基于 KV 的 token hash 反查是否稳定

其中最关键的是第 2 点。

---

# 22. 推荐的 v1 技术结论

综合你的最新要求，这个方案的最终建议是：

### 适合落地的 v1 方案
- **Svelte 单页管理后台**
- **Cloudflare Pages + Functions**
- **Basic Auth 仅保护管理接口**
- **Bearer Token 仅保护业务查询接口**
- **KV 存 token hash 与配置**
- **R2 存管理员上传的 mmdb 文件**
- **不做统计、不做缓存、不做审计**
- **返回标准化 GeoIP JSON**
- **通过 active_db 配置控制当前生效数据库**

这是一个非常合理的第一版，复杂度可控，也能为后续演进留出空间。

---

# 23. 后续版本演进建议

未来可以按这个顺序扩展：

### v1.1
- 查询结果缓存开关
- token 最后使用时间
- 上传历史数据库列表

### v1.2
- 统计图表
- 查询日志
- 简单审计日志

### v1.3
- IPv6 支持
- Token 过期时间
- 限流/配额
- 管理员登录协议升级
