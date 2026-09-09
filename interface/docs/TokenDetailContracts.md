# Token 详情页：读写合约、Quote 公式与 Creator / Holder Fees

> 对应页面：[`LaunchpadTokenDetailPage.tsx`](../src/pages/LaunchpadTokenDetailPage.tsx)  
> 统一读合约日志：[`contractDebug.ts`](../src/lib/contractDebug.ts)  
> Console 格式：`[scope] readContract.<Method>` → `{ method, contract, args, status, raw, fields }`  
> 相关：[`Qoute.md`](./Qoute.md) · [`Buy.md`](./Buy.md) · [`Launch.md`](./Launch.md)

---

## 0. 名称速查

| 名称 | 含义 |
|---|---|
| **quote / quote asset** | 报价资产。ETH pair 时为原生 ETH；否则为 `pairToken` ERC-20 |
| **meme / launch token** | 发射出的 ERC-20（`PonsV2LauncherToken`） |
| **bonding curve / Curve** | 毕业前买卖的恒定乘积曲线合约 |
| **Factory** | `PonsV2LaunchFactory`：登记 launch、改 fee recipient、收 launch fee |
| **FeeEscrow** | 已 sweep 的 creator / protocol 份额托管；用户 `claim` / `claimToken` 从这里取 |
| **phantomQuote** | 定价用的虚拟 quote 储备；**不算**进毕业进度 |
| **realQuoteReserve** | 曲线真实收到的 quote（无 phantom）；**只做毕业进度** |
| **bps / BASIS_POINTS** | 基点；`100 bps = 1%`；分母恒为 `10_000` |
| **feeBps** | 曲线基础交易费率（协议可再拆 protocol / buyback / creator） |
| **creatorTaxBps** | Creator 额外税，全部归 `creatorFeeRecipient` |
| **snipeBps** | 开盘防狙击税（按 recipient）；读不到则前端按 `0` |
| **sellableTokens** | 曲线上还能卖出的 token 上限（接近毕业会钳制买入） |
| **graduated / readyToGraduate** | 已毕业 / 已达毕业条件但未完成迁移 |
| **phase** | Factory 记录的发射阶段；`0 = NotGraduated` |
| **sweepFees** | 把 Curve 内未结算的 fee/tax 划到 FeeEscrow（及 buyback 路径） |
| **claim** | 从 FeeEscrow 把已记入的余额提到自己的钱包 |

全程金额用 `bigint` / `uint256`，**先乘后除**，除法向 0 截断（`ceilDiv` 除外）。

---

## 1. 买卖数量 Quote 计算公式

Curve **没有**链上 `quote()`。前端读状态后本地复算，再带滑点写 `buy` / `sell`。

### 1.1 买入流程总览

```text
用户输入 quoteIn（ETH wei）
        ↓
读 Curve：getReserves / sellableTokens / feeBps / creatorTaxBps
         / currentSnipeTaxBps? / realQuoteReserve / graduationThreshold / graduated
        ↓
quoteBuyFromState(quoteIn, state)   // lib/quoteBuy.ts
        ↓
UI 展示 tokensOut
        ↓
minTokensOut = tokensOut × (10000 − slippageBps) / 10000
        ↓
curve.buy(quoteIn, minTokensOut, recipient)  msg.value = quoteIn
```

实现：[`quoteBuy.ts`](../src/lib/quoteBuy.ts) · [`useCurveBuyQuote.ts`](../src/hooks/useCurveBuyQuote.ts) · [`useCurveBuy.ts`](../src/hooks/useCurveBuy.ts)

### 1.2 买入：读合约字段（参与运算 / 展示）

| 读方法 | raw 含义 | 是否进 AMM 公式 |
|---|---|---|
| `getReserves()` → `(quoteReserve, tokenReserve)` | 定价储备；**含 phantomQuote** | ✅ |
| `sellableTokens()` | 还能买到的 token 上限 | ✅ clamp |
| `feeBps()` | 基础费率 | ✅ |
| `creatorTaxBps()` | Creator 税 | ✅ |
| `currentSnipeTaxBps(recipient)` | 对该买家的 sniper 税；无方法 → `0` | ✅（估算） |
| `realQuoteReserve()` | 真实筹集额 | ❌ 仅进度条 |
| `graduationThreshold()` | 毕业目标 | ❌ 仅进度条 |
| `graduated()` | 已毕业则不可 buy | 门闩 |

**禁止**用 `realQuoteReserve` 当 `quoteReserve` 做定价。

### 1.3 买入：核心 AMM（扣费之后）

费用在 **quote 侧先扣干净**，再对净额做 constant-product（AMM 内 `feeBps = 0`）：

\[
\text{amountOut} = \left\lfloor \frac{\text{amountIn} \times \text{reserveOut}}{\text{reserveIn} + \text{amountIn}} \right\rfloor
\]

买入时：`amountIn = netQuote`，`reserveIn = quoteReserve`，`reserveOut = tokenReserve`。

反推（clamp 用，已知想要的 token 数量）：

\[
\text{amountIn} = \left\lfloor \frac{\text{amountOut} \times \text{reserveIn}}{\text{reserveOut} - \text{amountOut}} \right\rfloor + 1
\]

### 1.4 买入：逐步运算

设 `BPS = 10_000`，`spent` 初始 `= quoteIn`。

**Step A — 规范化 snipe**

```text
snipeBps = rawSnipeBps
if snipeBps > 0:
  maxSnipeBps = BPS − feeBps − creatorTaxBps − 100
  if maxSnipeBps ≤ 0: snipeBps = 0
  else if snipeBps > maxSnipeBps: snipeBps = maxSnipeBps
```

`100` bps：预留至少约 1% 净额进曲线。  
> 当前仓库 Solidity `buy()` 只扣 `feeBps + creatorTaxBps`；前端若读不到 snipe，令 `snipeBps = 0` 与链上一致。

**Step B — 扣费**

\[
\begin{aligned}
\text{fee} &= \lfloor \text{spent} \times \text{feeBps} / 10000 \rfloor \\
\text{tax} &= \lfloor \text{spent} \times \text{creatorTaxBps} / 10000 \rfloor \\
\text{snipeTax} &= \lfloor \text{spent} \times \text{snipeBps} / 10000 \rfloor \\
\text{netQuote} &= \text{spent} - \text{fee} - \text{tax} - \text{snipeTax}
\end{aligned}
\]

| 字段 | 意思 |
|---|---|
| `fee` | 基础交易费（进入 `quoteFeeBalance` 再拆分） |
| `tax` | Creator tax（进入 `creatorTaxBalance`） |
| `snipeTax` | 开盘税（若启用） |
| `netQuote` | **真正进入恒定乘积的 quote** |

**Step C — 理论产出**

\[
\text{tokensOut} = \left\lfloor \frac{\text{netQuote} \times \text{tokenReserve}}{\text{quoteReserve} + \text{netQuote}} \right\rfloor
\]

**Step D — 超过 sellable 则钳制**

```text
tokensOut ← sellable
net = amountIn(sellable, quoteReserve, tokenReserve)
denom = BPS − feeBps − creatorTaxBps − snipeBps
grossed = ceilDiv(net × BPS, denom)   // ⌊(a+b−1)/b⌋
spent = min(grossed, quoteIn)
重算 fee / tax / snipeTax
refund = quoteIn − spent
```

**Step E — 返回**

`{ tokensOut, spent, refund, fee, tax, snipeTax, snipeBpsUsed }`

**滑点（写交易）**

\[
\text{minTokensOut} = \left\lfloor \frac{\text{tokensOut} \times (10000 - \text{slippageBps})}{10000} \right\rfloor
\]

Demo 默认 `slippageBps = 100`（1%）。链上校验（部分成交时为价格界）：

```text
若 spent × minTokensOut > received × tokensOut → SlippageExceeded
```

### 1.5 卖出流程总览

```text
用户输入 tokensIn
        ↓
读 Curve：getReserves / feeBps / creatorTaxBps / readyToGraduate / graduated
        ↓
若 graduated || readyToGraduate → 关闭 sell
        ↓
quoteSellFromState(tokensIn, state)
        ↓
minQuoteOut = quoteOut × (10000 − slippageBps) / 10000
        ↓
approve(curve, tokensIn)（若 allowance 不足）
        ↓
curve.sell(tokensIn, minQuoteOut, recipient)
```

实现：[`quoteSell.ts`](../src/lib/quoteSell.ts) · [`useCurveSellQuote.ts`](../src/hooks/useCurveSellQuote.ts) · [`useCurveSell.ts`](../src/hooks/useCurveSell.ts)

### 1.6 卖出：公式与字段

先把 token 卖进曲线得到 **gross** quote，再从产出里扣费：

\[
\begin{aligned}
\text{grossQuoteOut} &= \left\lfloor \frac{\text{tokensIn} \times \text{quoteReserve}}{\text{tokenReserve} + \text{tokensIn}} \right\rfloor \\
\text{fee} &= \lfloor \text{grossQuoteOut} \times \text{feeBps} / 10000 \rfloor \\
\text{tax} &= \lfloor \text{grossQuoteOut} \times \text{creatorTaxBps} / 10000 \rfloor \\
\text{quoteOut} &= \text{grossQuoteOut} - \text{fee} - \text{tax}
\end{aligned}
\]

| 字段 | 意思 |
|---|---|
| `tokensIn` | 用户卖出的 meme token（最小精度） |
| `grossQuoteOut` | 扣费前应得 quote |
| `quoteOut` | 用户实际到手（UI 展示） |
| `fee` / `tax` | 从产出侧扣除的基础费 / creator 税 |

滑点：

\[
\text{minQuoteOut} = \left\lfloor \frac{\text{quoteOut} \times (10000 - \text{slippageBps})}{10000} \right\rfloor
\]

`readyToGraduate == true` 时也关 sell：避免「已达毕业但未迁移」窗口里再卖，破坏预留给 pool 的 token/quote 结构。

### 1.7 交易面板额外读合约

| 方法 | 用途 |
|---|---|
| `Token.balanceOf(wallet)` | Sell 可用余额 |
| `Token.allowance(wallet, curve)` | Sell 前是否先 `approve` |
| `useBalance(wallet)` | Buy 侧 ETH 余额（**不是** readContract，不进统一日志） |

---

## 2. Creator fees 卡片

UI：详情页 `CreatorFeesCard` · 读：[`useCreatorFees.ts`](../src/hooks/useCreatorFees.ts) · 写：[`useCreatorFeeActions.ts`](../src/hooks/useCreatorFeeActions.ts)

### 2.1 读合约原数据

| 方法 | 合约 | raw 含义 | UI |
|---|---|---|---|
| `FeeEscrow.balanceOf(recipient)` | FeeEscrow | recipient 可 claim 的 **ETH** | Claimable now（ETH pair） |
| `FeeEscrow.balanceOfToken(recipient, quoteToken)` | FeeEscrow | 可 claim 的 **ERC-20 quote** | Claimable now（非 ETH） |
| `Curve.quoteFeeBalance()` | Curve | 尚未 sweep 的基础交易费池（含 protocol/buyback/creator） | 参与左侧 Earned |
| `Curve.creatorTaxBalance()` | Curve | 尚未 sweep 的 creator tax（全归 recipient） | 加进 Earned |
| `Curve.buybackQuoteBalance()` | Curve | 已标为 buyback-and-lock 的份额 | `>0` 时普通 collect 被挡 |
| `Curve.protocolFeeShareBps()` | Curve | 基础费中归协议的比例 | 从 quoteFeeBalance 扣掉后再估 creator |

另需详情页已有字段：

| 字段 | 来源 | 用途 |
|---|---|---|
| `creatorFeeRecipient` | `Factory.getLaunchedToken` | 谁能 Transfer / Collect / Claim |
| `phase` | 同上 | `0` 才允许本 demo 的 collect |
| `isNativeQuote` / `pairToken` | Curve / Factory | 决定 claim ETH 还是 claimToken |

### 2.2 展示数值怎么算

```text
protocolFeeAmount = quoteFeeBalance × protocolFeeShareBps / 10000
creatorBaseFee    = quoteFeeBalance − protocolFeeAmount   // 估：基础费里归 creator 的部分
pendingCreatorEstimate = creatorBaseFee + creatorTaxBalance   // 卡片左侧 Earned
claimableQuote =
  isNativeQuote ? FeeEscrow.balanceOf(recipient)
                : FeeEscrow.balanceOfToken(recipient, pairToken)  // 右侧 Claimable
pendingCurveFees = quoteFeeBalance + creatorTaxBalance          // 是否还能 collect
```

说明：

- **Earned（pending）**：还在 Curve 里、**尚未** sweep 到 Escrow 的估算应得。
- **Claimable**：已经进 Escrow、点 Claim 就能提到钱包的余额。
- `creatorBaseFee` 是前端估算（用 `protocolFeeShareBps` 扣协议份额）；真实 sweep 还可能涉及 buyback 拆分，以链上 `sweepFees` 为准。

### 2.3 Transfer / Collect / Claim 原理

```text
交易产生 fee/tax
    → 记在 Curve：quoteFeeBalance / creatorTaxBalance / buybackQuoteBalance
    → Collect = sweepFees(0)  （当前钱包 = creatorFeeRecipient，且无 buyback 积压）
    → 份额进入 FeeEscrow.balanceOf / balanceOfToken
    → Claim = claim() 或 claimToken(quoteToken)
    → ETH/ERC20 进入钱包
```

| 按钮 | 写方法 | 权限 / 前提 | 原理 |
|---|---|---|---|
| **Transfer** | `Factory.transferCreatorFeeRecipient(token, newRecipient)` | 当前钱包 == `creatorFeeRecipient` | 改收款人；不影响已在 Escrow 的旧余额归属逻辑以合约为准 |
| **Collect curve fees** | `Curve.sweepFees(0)` | recipient；`phase == 0`；`buybackQuoteBalance == 0`；`pendingCurveFees > 0` | 把 Curve 未结算费划到 Escrow；`0` 表示不走需 operator 的 buyback minOut 路径 |
| **Claim ETH / QUOTE** | `FeeEscrow.claim()` / `claimToken(pairToken)` | recipient 且 claimable > 0 | 从托管提到 `msg.sender` |

**可点条件（前端）**

```text
canTransfer          = wallet == creatorFeeRecipient
canCollectCurveFees  = canTransfer
                       && phase == NotGraduated(0)
                       && buybackQuoteBalance == 0
                       && pendingCurveFees > 0
canClaimQuote        = canTransfer && claimableQuote > 0
```

`buybackQuoteBalance > 0` 时 collect 会提示需要 **sweep operator**（带 `minBuybackTokensOut`），本 demo 不暴露该入口。

### 2.4 费用生命周期（名称解释）

| 阶段 | 名称 | 钱在哪 |
|---|---|---|
| 交易当下 | accrue | Curve 内部余额累加 |
| Collect / sweep | settle to escrow | FeeEscrow 记账 |
| Claim | withdraw | 用户钱包 |

Creator tax 与「基础 fee 里的 creator 份额」最终都可经 sweep → claim 到达 `creatorFeeRecipient`；协议份额进协议侧，buyback 份额进 vault/锁仓路径。

---

## 3. Holder fee sharing 卡片

### 3.1 当前 UI 行为

详情页第二张卡 **Holder fee sharing**：

- 文案说明：当前 launch 的 creator fees 付给 `creatorFeeRecipient`。
- `useCreatorFees` 固定返回 `routesToHolders: false`。
- **未接** holder distributor factory / ABI，因此不会切换成「fees route to holders、无 creator claim」样式。

### 3.2 正确状态应如何判断（原理）

Holder sharing 的本质是：**`creatorFeeRecipient` 是否被设成某个 Fee Distributor 合约**，而不是「有没有某段 bytecode」。

推荐判断（接上 distributor 后）：

```text
1. 读 Factory.getLaunchedToken(token).creatorFeeRecipient → R
2. 若配置了 DistributorFactory：
     predicted = DistributorFactory.predict / getDistributor(token)   // 以实际 ABI 为准
     routesToHolders = (R == predicted) 且 predicted != 0
3. 可选增强：对 R 做接口探测（如 supportsInterface / 已知 distributor 方法）
4. 不要用 eth_getCode(R) != "0x" 当唯一条件：
     - 任意合约（多签、代理、错误地址）都有 bytecode
     - EOA recipient 才是「纯 creator 收取」的常见形态，但「有代码 ≠ holder sharing」
```

| 错误做法 | 为什么错 |
|---|---|
| `getCode(recipient) !== '0x'` ⇒ holders | 多签/任意合约也会 true |
| 只看 token 名字或 UI 开关 | 与链上收款人无关 |
| 忽略 Factory 登记的 `creatorFeeRecipient` | Transfer 之后链上真相只在这里 |

### 3.3 `routesToHolders == true` 时应如何展示（目标态）

| 区域 | 行为 |
|---|---|
| Creator fees · Earned | 可显示 `-` 或「归 holders」 |
| Claimable / Claim | 隐藏或禁用（creator 不再个人 claim） |
| Transfer | 通常隐藏（收款人是 distributor） |
| Holder 卡片 | 说明 fees 经 distributor 分给持仓用户 |

本仓库 **边界**：只读 creator 路径；holder 分红需额外地址与 ABI。

---

## 4. 详情页全部 readContract 清单（Console）

打开 Token 详情后，控制台应按方法逐条输出（无 result 时不打，避免 loading 噪音）：

### 4.1 `LaunchpadTokenDetail`

| method | 合约 |
|---|---|
| `Factory.getLaunchedToken` | Factory |
| `Token.name` / `symbol` / `decimals` / `totalSupply` | Token |
| `Token.getTokenInfo` | Token |
| `Curve.realQuoteReserve` / `sellableTokens` / `graduationThreshold` | Curve |
| `Curve.readyToGraduate` / `graduated` / `isNativeQuote` / `pairToken` / `creatorTaxBps` | Curve |

### 4.2 `CurveBuyQuote` / `CurveSellQuote`

见 §1.2、§1.5。

### 4.3 `CreatorFees`

见 §2.1。

### 4.4 `TradePanel`

`Token.balanceOf` · `Token.allowance`（sell 模式）。

---

## 5. 写合约一览（详情相关）

| 场景 | 合约 | 方法 | 关键 value / approve |
|---|---|---|---|
| 买入 | Curve | `buy(quoteIn, minTokensOut, recipient)` | `msg.value = quoteIn`（ETH） |
| 卖出 | Token → Curve | `approve` 然后 `sell(tokensIn, minQuoteOut, recipient)` | approve spender = curve |
| 改收款人 | Factory | `transferCreatorFeeRecipient(token, newRecipient)` | — |
| 收集曲线费 | Curve | `sweepFees(0)` | — |
| 领取 ETH | FeeEscrow | `claim()` | — |
| 领取 ERC20 quote | FeeEscrow | `claimToken(pairToken)` | — |

---

## 6. 本 demo 已接 / 未接边界

| 已接 | 未接 / 受限 |
|---|---|
| 详情读 Factory + Token + Curve | Holder distributor 路由检测与 UI |
| 本地 buy/sell quote + 滑点写交易 | 非 ETH pair 买卖（UI 会拒） |
| Creator Transfer / Collect(`sweepFees(0)`) / Claim | 带 buyback 的 operator sweep |
| 毕业进度条（real / threshold） | 毕业后 Uniswap v4 交易与毕业后 collect |

---

## 参考代码

| 主题 | 路径 |
|---|---|
| 统一日志 | [`src/lib/contractDebug.ts`](../src/lib/contractDebug.ts) |
| 详情聚合 | [`src/hooks/useLaunchpadTokenDetail.ts`](../src/hooks/useLaunchpadTokenDetail.ts) |
| Buy/Sell quote | [`src/hooks/useCurveBuyQuote.ts`](../src/hooks/useCurveBuyQuote.ts) · [`useCurveSellQuote.ts`](../src/hooks/useCurveSellQuote.ts) |
| 公式 | [`src/lib/quoteBuy.ts`](../src/lib/quoteBuy.ts) · [`quoteSell.ts`](../src/lib/quoteSell.ts) |
| Creator fees | [`src/hooks/useCreatorFees.ts`](../src/hooks/useCreatorFees.ts) · [`useCreatorFeeActions.ts`](../src/hooks/useCreatorFeeActions.ts) |
| 合约 | [`PonsV2BondingCurve.sol`](../../contractsV2/src/v2/PonsV2BondingCurve.sol) · [`PonsV2BondingCurveMath.sol`](../../contractsV2/src/v2/libraries/PonsV2BondingCurveMath.sol) |
