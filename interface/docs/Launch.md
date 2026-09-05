# Launch Token：入参含义与写合约对接

依据：[官方 docs · Launching a token](https://docs.ponsfamily.com/v2#launching) 与仓库合约 [`contractsV2/src/v2/PonsV2LaunchFactory.sol`](../../contractsV2/src/v2/PonsV2LaunchFactory.sol)。

前端实现入口：

| 模块 | 路径 |
|---|---|
| ABI | `src/constants/abis.ts` |
| 地址 | `src/constants/contracts.ts` |
| 预读 | `src/hooks/useLaunchPrep.ts` |
| 写交易 | `src/hooks/useLaunchToken.ts` |
| 表单组装 | `src/components/LaunchTokenForm.tsx` |
| 校验工具 | `src/lib/launch.ts` |

---

## 1. 调用路径（二选一）

```text
预读 launchFee / configs / expectedEconomics / canLaunch
                │
                ▼
        Developer buy (quoteIn)？
         /                    \
       否                      是
        │                      │
        ▼                      ▼
 factory.launchToken    launchAndBuy.launchAndBuy
  value = launchFee      ETH 对：value = launchFee + quoteIn
                         ERC-20 对：value = launchFee + 事先 approve
                │
                ▼
         返回 token / curve（及 tokensOut）
```

| 场景 | 合约 | 函数 | `msg.value` |
|---|---|---|---|
| 仅创建 | Factory | `launchToken(params, launchConfigId, pairToken, snipeTaxExemptions)` | 精确等于 `launchFee()` |
| 创建 + 首购 | LaunchAndBuy Router | `launchAndBuy(...)` | ETH 对：`launchFee + quoteIn`；ERC-20 对：仅 `launchFee` |

当前 demo：`pairToken = address(0)`（ETH）。`Developer buy` 为空或 `0` → `launchToken`；有正数 → `launchAndBuy`。

**交互约束**：写交易只由 Launch 按钮 `onClick` 触发，不绑定 `form.onSubmit`（避免输入框 Enter 误发）。

---

## 2. `TokenParams`（三种入口共用）

```solidity
struct TokenParams {
  string name;
  string symbol;
  string logo;
  string description;
  Socials socials;           // twitter / telegram / discord / website / farcaster
  address creatorFeeRecipient;
  uint16 creatorTaxBps;
  bool buybackEnabled;
  bytes32 expectedEconomics;
  bytes32 salt;
}
```

| 字段 | 类型 | 含义 | Demo 默认 / 来源 |
|---|---|---|---|
| `name` | `string` | Token 名称；非空 | 表单 Name，如 `SPIKE ICE` |
| `symbol` | `string` | Ticker；非空 | 表单 Ticker，如 `SPI` |
| `logo` | `string` | Logo URI，常为 `ipfs://…` | `VITE_IMAGE_URL` 或内置 CID |
| `description` | `string` | 描述文案 | 表单 Description |
| `socials.*` | `string` | 社交 / 官网链接；可空 | Advanced 或主表单 X/Telegram 等 |
| `creatorFeeRecipient` | `address` | Creator 手续费收款地址。纯 `launchToken` 时 `0` = 调用者；**`launchAndBuy` 必须非 0** | 默认连接钱包 |
| `creatorTaxBps` | `uint16` | 额外 creator 税（bps，1% = 100），叠在曲线基础费上，全给 creator；超过 `maxCreatorTaxBps()` 回滚 | UI 填百分比再换算 |
| `buybackEnabled` | `bool` | 是否开启 buyback + 锁仓 | Advanced 开关，默认 `true` |
| `expectedEconomics` | `bytes32` | 经济条款钉扎。`0` 跳过校验；否则须等于 `previewLaunchEconomics(id, pairToken)` | 提交前 `refetchEconomics()` |
| `salt` | `bytes32` | **CREATE2 盐**：与工厂、部署字节码、构造参数一起决定可预测的 token/curve 地址。按发起账户命名空间；同一账户勿复用「相同条款 + 相同 salt」，否则地址冲突回滚。可用于 vanity 挖地址 | 空则 `randomSalt()` |

元数据字节上限（与 Deployer 一致，见 `lib/launch.ts`）：

| 字段 | 最大 bytes |
|---|---|
| name | 64 |
| symbol | 16 |
| logo | 512 |
| description | 2048 |
| 单个 social | 256 |
| snipeTaxExemptions | 最多 32 个地址 |

---

## 3. `launchToken` 额外参数（Factory）

| 参数 | 类型 | 含义 |
|---|---|---|
| `launchConfigId` | `uint256` | LaunchConfig 索引（供应量、curve 费、phantom、毕业阈值、poolFee、tickSpacing、enabled） |
| `pairToken` | `address` | 计价资产；`address(0)` = 原生 ETH；非 0 须已 `approvedPairTokens` |
| `snipeTaxExemptions` | `address[]` | 开盘 sniper tax 额外豁免；launcher 与 `creatorFeeRecipient` 已自动豁免 |
| `msg.value` | `uint256` | 必须 **精确等于** `factory.launchFee()`，否则 `LaunchFeeNotPaid` |

返回：`(address token, address curve)`。

合约地址（Robinhood mainnet 默认）：

```text
Factory: 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e
```

可用 env `VITE_PONS_V2_FACTORY_ADDRESS` 覆盖。

---

## 4. `launchAndBuy` 额外参数（Router）

| 参数 | 类型 | 含义 |
|---|---|---|
| `params` | `TokenParams` | 同上；`creatorFeeRecipient` **必填非 0** |
| `launchConfigId` | `uint256` | 同上 |
| `pairToken` | `address` | 同上 |
| `quoteIn` | `uint256` | 首购投入的报价资产数量（wei / token decimals） |
| `minTokensOut` | `uint256` | 最少到手 token（滑点保护） |
| `recipient` | `address` | 首购 token 接收地址；自动加入 sniper 豁免 |
| `snipeTaxExemptions` | `address[]` | 额外豁免；可 `[]` |
| `msg.value` | `uint256` | ETH 对：`launchFee + quoteIn`；ERC-20 对：仅 `launchFee` |

返回：`(address token, address curve, uint256 tokensOut)`。

```text
LaunchAndBuy: 0xe33E9E479dF8802cb0866d5d05258bEc4cF62948
```

可用 env `VITE_PONS_V2_LAUNCH_AND_BUY_ADDRESS` 覆盖。

---

## 5. 写交易前必须预读的值

| 读接口 | 用途 |
|---|---|
| `launchFee()` | 组装 `msg.value` |
| `launchConfigCount()` / `getLaunchConfig(id)` | 选启用中的 config；展示 graduation / trade fee |
| `previewLaunchEconomics(id, pairToken)` | 填 `expectedEconomics` |
| `canLaunch(account)` | 白名单 / 公开放行 |
| `maxCreatorTaxBps()` | 校验表单 tax |
| `predictLaunchAddresses`（Deployer，可选） | 预知 vanity / 地址 |

`LaunchConfig` 由 `launchConfigId` 间接锁定，调用者不能逐项改 supply / fee / phantom 等。

---

## 6. 前端对接流程

```text
1. useLaunchPrep(account, preferredConfigId=0, pairToken=0x0)
   → fee / configs / economics / canLaunch / maxTax

2. 用户点 Launch 按钮（非 form submit）
   → 校验登录、chain、canLaunch、元数据、地址、tax、salt

3. refetchEconomics() → expectedEconomics
   → 组装 TokenParams + launch 额外参数

4. useLaunchToken.launch(input)
   → quoteIn == 0  → writeContract factory.launchToken
   → quoteIn  > 0  → writeContract launchAndBuy.launchAndBuy

5. useWaitForTransactionReceipt 等确认
```

### UI → 合约映射

| UI | 合约 |
|---|---|
| Name / Ticker / Description / Image | `name` / `symbol` / `description` / `logo` |
| X / Telegram / Discord / Website / Farcaster | `socials.*` |
| Paired asset ETH | `pairToken = 0x0` |
| Developer buy | `quoteIn`；空/`0` → `launchToken`，否则 → `launchAndBuy` |
| Creator tax % | `creatorTaxBps`（×100） |
| Buyback | `buybackEnabled` |
| Fee recipient / Recipient / Exemptions / Salt | Advanced |
| Login 钱包 | `msg.sender`（Privy + wagmi） |

自动填充：`expectedEconomics`（预读）、`salt`（随机）、`launchFee`（value）、`recipient` / `creatorFeeRecipient`（默认钱包）。

### 写合约代码要点（`useLaunchToken`）

```ts
// 仅创建
writeContractAsync({
  address: factory,
  abi: launchTokenWriteAbi,
  functionName: 'launchToken',
  args: [tokenParams, launchConfigId, pairToken, snipeTaxExemptions],
  value: launchFee
});

// 创建 + 首购（ETH）
writeContractAsync({
  address: launchAndBuy,
  abi: launchAndBuyAbi,
  functionName: 'launchAndBuy',
  args: [
    tokenParams,
    launchConfigId,
    pairToken,
    quoteIn,
    minTokensOut,
    recipient,
    snipeTaxExemptions
  ],
  value: launchFee + quoteIn
});
```

---

## 7. 常见 revert

| Error | 含义 / 前端提示方向 |
|---|---|
| `LaunchFeeNotPaid` | `msg.value` ≠ `launchFee` |
| `NotWhitelisted` | `canLaunch=false` |
| `LaunchEconomicsMismatch` | `expectedEconomics` 过期，需 refetch |
| `CreatorTaxTooHigh` | tax 超过 `maxCreatorTaxBps` |
| `PairTokenNotApproved` | 非 ETH 计价资产未批准 |
| `ExemptionListTooLong` | 豁免列表 > 32 |
| `InvalidTokenParams` | name/symbol 非法 |
| `MetadataTooLong` | 元数据超字节上限 |
| `LaunchConfigDisabled` | 所选 config 未启用 |

映射实现：`useLaunchToken.ts` → `mapLaunchError`。

---

## 8. Demo 降级说明

- 未实现曲线 quote：`minTokensOut` 默认 `0`（无自动滑点保护），Advanced 可手填
- 未实现 ERC-20 `pairToken` 的 `approve` 路径；计价资产固定 ETH（`address(0)`）
- 生产接入 `launchAndBuy` 前应补齐 quote + slippage，并支持自定义 pair + approve

更细的计划稿见 [`../plans/launch_token_params_19bd9933.plan.md`](../plans/launch_token_params_19bd9933.plan.md)。
