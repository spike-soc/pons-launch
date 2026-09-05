# interface — pons v2 Launchpad Demo

Robinhood Chain（chain id `4663`）上的 pons v2 **发币演示前端**：Privy 登录 + wagmi 读写合约，左侧 Launch 表单，右侧钱包 / 预览 / Meme feed。

更细的 Launch 入参与写合约说明见 [`docs/Launch.md`](docs/Launch.md)。

---

## 快速开始

```bash
cd interface
cp .env.example .env   # 填入 VITE_PRIVY_APP_ID
pnpm install
pnpm dev               # http://0.0.0.0:3050
```

| 脚本 | 说明 |
|---|---|
| `pnpm dev` | Vite 开发服，端口 3050 |
| `pnpm build` | `tsc --noEmit` + 生产构建 |
| `pnpm preview` | 预览构建产物 |

必需环境变量：`VITE_PRIVY_APP_ID`。未配置时页面可打开，但无法登录。

---

## 目录结构

```text
interface/
  src/
    main.tsx                 # 入口；有 Privy AppId 才包 AppProviders
    App.tsx                  # 布局：表单 + 预览 + meme feed
    components/
      Providers.tsx          # Privy + React Query + wagmi
      LaunchTokenForm.tsx    # Launch 表单与提交
      WalletAccountCard.tsx  # 钱包地址 / 链 / 余额
      MemeTokenCard.tsx      # Feed 卡片
    hooks/
      useSyncedPrivyAuth.ts  # Privy 会话 ↔ wagmi active wallet
      useLaunchPrep.ts       # 读 factory：fee / config / economics / canLaunch
      useLaunchToken.ts      # 写 launchToken / launchAndBuy
      useWalletTokenBalances.ts
      useMemeLaunchCards.ts  # 读已部署 meme token 元数据
    constants/
      chain.ts               # Robinhood chain + RPC
      contracts.ts           # pons v2 地址（可 env 覆盖）
      abis.ts                # 读/写 ABI
      trackedTokens.ts       # 钱包卡展示的 ERC-20
    lib/
      wagmi.ts               # createConfig + http transport
      launch.ts              # salt / 校验 / bps 换算
      meme.ts                # ipfs logo → 网关 URL
      format.ts
    styles.css
  docs/Launch.md             # Launch 入参与写合约对接
  plans/                     # Agent 实现计划源文件
  json/                      # 示例 logo / launches 索引
  .env.example
```

---

## 架构总览

```text
┌─────────────────────────────────────────────────────────┐
│  React (Vite)                                           │
│  App → LaunchTokenForm | WalletAccountCard | Meme feed  │
└───────────────┬───────────────────────────┬─────────────┘
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│  Privy (@privy-io/*)      │   │  wagmi + viem             │
│  登录 / 会话 / 钱包列表    │──▶│  useReadContract(s)       │
│  setActiveWallet → wagmi  │   │  useWriteContract         │
└───────────────────────────┘   │  useBalance / receipt     │
                                └─────────────┬─────────────┘
                                              │ http(RPC)
                                              ▼
                                Robinhood Chain RPC
                                + pons v2 Factory / Router
```

Provider 嵌套（`components/Providers.tsx`）：

```text
PrivyProvider
  └─ QueryClientProvider (@tanstack/react-query)
       └─ WagmiProvider (@privy-io/wagmi)
```

---

## Privy + wagmi 集成

### 配置

- **Privy**：`loginMethods: ['email', 'wallet']`，`defaultChain` / `supportedChains` = Robinhood；嵌入式钱包 `createOnLogin: 'users-without-wallets'`；会话走 localStorage，刷新可恢复。
- **wagmi**：`@privy-io/wagmi` 的 `createConfig`，单链 + `http(rpcHttpUrl)`（见 `lib/wagmi.ts`）。

### 会话同步（`useSyncedPrivyAuth`）

1. 等 Privy `ready` 后再判定登录（避免刷新误显示未登录 → UI 显示 Restoring…）。
2. `authenticated && wallets` 就绪后，`setActiveWallet` 同步到 wagmi，供写交易签名。
3. `chainReady`：已连接且 `chainId === robinhoodChain.id`。
4. `reconnecting`：Privy 已登录但 wagmi 尚未连上。

入口分支（`main.tsx`）：有 `VITE_PRIVY_APP_ID` → `AppProviders` + `PrivyConnectedApp`；否则无登录壳。

---

## RPC 与链配置

定义：`src/constants/chain.ts`。

| Env | 默认（mainnet） |
|---|---|
| `VITE_CHAIN_ID` | `4663` |
| `VITE_CHAIN_NAME` | `Robinhood Chain` |
| `VITE_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `VITE_EXPLORER_URL` | `https://robinhoodchain.blockscout.com` |

`wagmiConfig.transports[chainId] = http(rpcHttpUrl)`，所有 `useRead*` / `useWrite*` / `useBalance` 都走该 RPC。

合约地址：`src/constants/contracts.ts` 内置官方 mainnet 默认值，可用 `VITE_PONS_V2_*` 覆盖（见 `.env.example`）。

| Key | 默认地址 |
|---|---|
| Factory | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` |
| LaunchAndBuy | `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948` |
| 其它 | memeHook / feeEscrow / buybackVault / launchLocker / launchDeployer / graduation* |

---

## 合约读取集成

统一通过 wagmi `useReadContract` / `useReadContracts`，ABI 在 `constants/abis.ts`。

### Factory（`useLaunchPrep`）

| 方法 | 用途 |
|---|---|
| `launchFee()` | Launch 手续费（写交易 `msg.value`） |
| `launchConfigCount()` | Config 数量 |
| `getLaunchConfig(id)` | 单条 LaunchConfig（supply / fee / phantom / graduation / enabled…） |
| `previewLaunchEconomics(id, pairToken)` | `expectedEconomics` 钉扎哈希 |
| `canLaunch(account)` | 是否允许该地址发币 |
| `maxCreatorTaxBps()` | Creator tax 上限 |

逻辑：优先 `preferredLaunchConfigId`（默认 `0`）且 enabled，否则取第一个 open config；提交前可 `refetchEconomics()`。

### 钱包余额（`useWalletTokenBalances`）

| 来源 | 方法 |
|---|---|
| 原生 ETH | `useBalance({ address })` |
| WETH / USDG / TSLA（4663） | `erc20Abi.balanceOf` 批量 `useReadContracts` |

列表：`constants/trackedTokens.ts`。

### Meme feed（`useMemeLaunchCards`）

对 `MEME_TOKEN_ADDRESSES`（可改 `contracts.ts`）批量读：

| 合约 | 方法 |
|---|---|
| Factory | `getLaunchedToken(token)` → curve / deployer / phase / exists… |
| Token | `name` / `symbol` / `getTokenInfo`（logo、description、socials） |
| Curve | `realQuoteReserve` / `graduationThreshold` / `graduated` 等（进度） |

可与 `json/pons-launches.json` 索引合并展示。Logo：`lib/meme.ts` → `https://www.ponsfamily.com/api/ipfs/content/{cid}?variant=card`。

---

## 合约写入集成

实现：`useLaunchToken` → `useWriteContract` + `useWaitForTransactionReceipt`。

| 条件 | 合约 | 函数 | `value` |
|---|---|---|---|
| `quoteIn == 0` | Factory | `launchToken(params, configId, pairToken, exemptions)` | `launchFee` |
| `quoteIn > 0` | LaunchAndBuy | `launchAndBuy(params, configId, pairToken, quoteIn, minOut, recipient, exemptions)` | ETH 对：`launchFee + quoteIn` |

触发：`LaunchTokenForm` 的 Launch **按钮** `onClick`（不走 form submit）。

提交前校验：`authenticated`、`chainReady`、`canLaunch`、元数据字节上限、地址、tax、salt 格式；组装 `TokenParams` 后调用 `launch()`。

常见 revert 映射与字段含义见 [`docs/Launch.md`](docs/Launch.md)。

控制台调试前缀：`[launch]`（步骤 1–9 + `writeContract`）。

---

## UI 行为摘要

- **左栏**：Launch 表单（双语标签 `English 中文（param）`）、Advanced、仅按钮触发发币
- **右栏**：已登录显示钱包卡 → token 预览（fee / graduation 来自 prep）→ Meme launches feed
- **顶栏**：Refresh（整页刷新）、Login / Restoring…、v2 pill
- **默认 token**：Name `SPIKE ICE`，Symbol `SPI`，logo 来自 `VITE_IMAGE_URL`

---

## Demo 限制

- 仅 ETH pair；无 ERC-20 pair 的 `approve`
- 无曲线 quote；`minTokensOut` 默认 `0`
- Meme feed 地址列表需手动维护 `MEME_TOKEN_ADDRESSES`

生产完善项见 `docs/Launch.md` §8。
