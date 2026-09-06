# Pons V2 Buy 询价计算说明

> Curve **没有**链上 `quote()`。前端读取 Curve 状态后，用与合约 `buy()` **相同**的整数公式本地算出「投入多少 ETH → 预计得到多少 token」。  
> 实现：[`interface/src/lib/quoteBuy.ts`](../src/lib/quoteBuy.ts) · Hook：[`useCurveBuyQuote.ts`](../src/hooks/useCurveBuyQuote.ts) · 写交易：[`docs/Buy.md`](./Buy.md)

```text
用户输入 quoteIn（ETH）
        ↓
读 Curve：getReserves / sellable / feeBps / creatorTaxBps / snipeBps?
        ↓
本地 quoteBuyFromState()
        ↓
UI 展示 tokensOut（meme token 数量）
        ↓
minTokensOut = tokensOut × (1 − 滑点)
        ↓
curve.buy(quoteIn, minTokensOut, recipient)  value = quoteIn
```

---

## 0. 单位与符号一览

| 符号 / 字段 | 链上类型 | 单位含义 | 可读换算 |
|---|---|---|---|
| **wei** | — | ETH 最小单位 | `1 ETH = 10^18 wei` |
| **token wei** | — | ERC-20 最小单位（meme 通常 18 decimals） | `1 SPI = 10^18` 最小单位（若 decimals=18） |
| **bps** | `uint256` / `uint16` | 基点，万分之一 | `1 bps = 0.01%`；`100 bps = 1%`；`10_000 bps = 100%` |
| **BPS / BASIS_POINTS** | 常量 | `10_000` | 费率分母 |
| `quoteIn` | `uint256` | 用户愿意投入的**报价资产**数量 | ETH pair：wei；UI 用 `parseEther("0.0001")` → `10^14` |
| `spent` | `uint256` | 实际计入曲线的报价额（可 ≤ `quoteIn`） | wei |
| `refund` | `uint256` | `quoteIn − spent`，部分成交退回 | wei |
| `fee` | `uint256` | 交易费（从 quote 里扣） | wei |
| `tax` | `uint256` | Creator tax（从 quote 里扣） | wei |
| `snipeTax` | `uint256` | 开盘 sniper tax（文档/前端可选；当前仓库 `buy()` 未扣） | wei |
| `netQuote` | — | 扣费后进入 AMM 的报价 | `spent − fee − tax − snipeTax`（wei） |
| `quoteReserve` | `uint256` | 定价用报价侧储备（含 **phantom**） | wei；来自 `getReserves()` |
| `tokenReserve` | `uint256` | 定价用 token 侧储备 | token wei；来自 `getReserves()` |
| `sellable` | `uint256` | 曲线上还能卖出的 token 上限 | token wei；`sellableTokens()` |
| `tokensOut` | `uint256` | 预计/实际到手 meme token | token wei |
| `minTokensOut` | `uint256` | 滑点保护：最少接受的 token | token wei |
| `feeBps` | `uint256` | 曲线交易费率 | 例：`100` = 1% |
| `creatorTaxBps` | `uint256` | 额外 creator 税 | 例：`0` = 0% |
| `snipeBps` | `uint256` | 对某 recipient 的 sniper 税 | 例：`0`；有则封顶 |
| `realQuoteReserve` | `uint256` | 曲线**真实**收到的报价（无 phantom） | **只做毕业进度，不做定价** |
| `graduationThreshold` | `uint256` | 毕业所需真实报价总量 | wei → UI 如 `4.2 ETH` |

**整数规则**：全程用 `bigint` / Solidity `uint256` 做乘除；**先乘后除**；除法向 0 截断（除 `ceilDiv` / `Rounding.Ceil` 外）。不要用浮点直接算成交量。

---

## 1. 链上要读什么

| 读接口 | 用途 | 单位 |
|---|---|---|
| `getReserves()` → `(quoteReserve, tokenReserve)` | **定价**储备（含 phantom quote） | wei / token wei |
| `sellableTokens()` | 可售上限，接近毕业时 clamp | token wei |
| `feeBps()` | 交易费率 | bps |
| `creatorTaxBps()` | Creator 额外税 | bps |
| `currentSnipeTaxBps(recipient)` | 开盘税（部署合约若无此方法 → 按 `0`） | bps |
| `realQuoteReserve()` | 毕业进度分子 | wei |
| `graduationThreshold()` | 毕业进度分母 | wei |
| `graduated()` | 是否已毕业（不可再 buy） | bool |

**禁止**用 `realQuoteReserve()` 当 `quoteReserve` 做定价。  
定价储备近似为：

```text
quoteReserve ≈ phantomQuote + trackedQuote − feeBalances
tokenReserve ≈ trackedTokens
```

（合约内部 `getReserves()` / buy 内计算与此一致。）

---

## 2. 核心 AMM 公式（扣费之后）

Pons buy 路径：费用在 quote 侧先扣干净，再对净额做 **constant-product**（与 Uniswap V2 无手续费池类似）。合约里调用：

```solidity
getAmountOut(spent - fee - tax, quoteReserve, tokenReserve, /* feeBps */ 0)
```

即 AMM 内 **feeBps = 0**，公式为：

### 2.1 已知投入 `amountIn`，求产出 `amountOut`

\[
\text{amountOut} = \left\lfloor \frac{\text{amountIn} \times \text{reserveOut}}{\text{reserveIn} + \text{amountIn}} \right\rfloor
\]

| 变量 | Buy 场景取值 | 单位 |
|---|---|---|
| `amountIn` | `netQuote`（扣费后的 ETH） | wei |
| `reserveIn` | `quoteReserve` | wei |
| `reserveOut` | `tokenReserve` | token wei |
| `amountOut` | `tokensOut` | token wei |

代码：

```ts
amountOut = (amountIn * tokenReserve) / (quoteReserve + amountIn)
```

### 2.2 已知想要 `amountOut`，反推最少净投入 `amountIn`（clamp 用）

\[
\text{amountIn} = \left\lfloor \frac{\text{amountOut} \times \text{reserveIn}}{\text{reserveOut} - \text{amountOut}} \right\rfloor + 1
\]

（`+1` 向上兜底，避免舍入少付。）

---

## 3. Buy 询价逐步计算

设：

- 用户输入：`quoteIn`（wei）
- 已读：`quoteReserve`, `tokenReserve`, `sellable`, `feeBps`, `creatorTaxBps`, `rawSnipeBps`

### Step A — 规范化 snipe 税率（可选）

```text
BPS = 10_000

snipeBps = rawSnipeBps
if snipeBps > 0:
  maxSnipeBps = BPS − feeBps − creatorTaxBps − 100
  if maxSnipeBps ≤ 0: snipeBps = 0
  else if snipeBps > maxSnipeBps: snipeBps = maxSnipeBps
```

| 量 | 单位 | 含义 |
|---|---|---|
| `snipeBps` | bps | 本笔对 recipient 生效的 sniper 税 |
| `100` | bps | 预留至少 1% 净额进曲线（文档封顶） |

> **与当前仓库 Solidity 对齐**：`PonsV2BondingCurve.buy` 只扣 `feeBps + creatorTaxBps`，**不算 snipe**。前端若读不到 `currentSnipeTaxBps`，令 `snipeBps = 0`，与链上一致。

### Step B — 从 `quoteIn` 扣费得到净报价

默认先假设整笔成交：`spent = quoteIn`。

\[
\begin{aligned}
\text{fee} &= \left\lfloor \frac{\text{spent} \times \text{feeBps}}{10\,000} \right\rfloor \\
\text{tax} &= \left\lfloor \frac{\text{spent} \times \text{creatorTaxBps}}{10\,000} \right\rfloor \\
\text{snipeTax} &= \left\lfloor \frac{\text{spent} \times \text{snipeBps}}{10\,000} \right\rfloor \\
\text{netQuote} &= \text{spent} - \text{fee} - \text{tax} - \text{snipeTax}
\end{aligned}
\]

| 量 | 单位 | 含义 |
|---|---|---|
| `fee` | wei | 协议/曲线交易费 |
| `tax` | wei | 全部给 creator 的额外税 |
| `snipeTax` | wei | 开盘防狙击税（若启用） |
| `netQuote` | wei | **真正进入恒定乘积定价的 ETH** |

官方语义：**先扣费，再进曲线**（不是从 token 产出里扣）。

### Step C — 恒定乘积得到理论 `tokensOut`

\[
\text{tokensOut} = \left\lfloor \frac{\text{netQuote} \times \text{tokenReserve}}{\text{quoteReserve} + \text{netQuote}} \right\rfloor
\]

| 量 | 单位 | 含义 |
|---|---|---|
| `tokensOut` | token wei | 理论到手数量 |

### Step D — 若超过 `sellable`，钳制并反算 `spent`

当 `tokensOut > sellable`（接近毕业、可售不足）：

```text
tokensOut ← sellable

net = amountIn(sellable, quoteReserve, tokenReserve)
    = ⌊ sellable × quoteReserve / (tokenReserve − sellable) ⌋ + 1

denom = BPS − feeBps − creatorTaxBps − snipeBps

grossed = ceilDiv(net × BPS, denom)     // 向上取整，保证扣费后仍够 net
spent   = min(grossed, quoteIn)

重新计算 fee / tax / snipeTax（用新的 spent）
refund  = quoteIn − spent
```

`ceilDiv(a, b) = ⌊(a + b − 1) / b⌋`。

| 量 | 单位 | 含义 |
|---|---|---|
| `sellable` | token wei | 最多还能买到的 token |
| `net` | wei | 买满 `sellable` 所需的**净**报价 |
| `grossed` | wei | 扣费前应付毛额 |
| `spent` | wei | 本笔实际消耗（≤ quoteIn） |
| `refund` | wei | 多余退回（链上 `CurveBuyRefunded`） |

若未触发 clamp：`spent = quoteIn`，`refund = 0`。

### Step E — 返回询价结果

```text
{
  tokensOut,   // UI「Buy」侧显示
  spent,
  refund,
  fee,
  tax,
  snipeTax,
  snipeBpsUsed
}
```

---

## 4. 数值示例（逐步）

假设（示意，非实时链上值）：

| 量 | 值 | 说明 |
|---|---|---|
| 用户输入 | `0.0001 ETH` | |
| `quoteIn` | `100_000_000_000_000` | \(10^{14}\) wei |
| `feeBps` | `100` | 1% |
| `creatorTaxBps` | `0` | |
| `snipeBps` | `0` | |
| `quoteReserve` | \(R_q\) | wei（含 phantom） |
| `tokenReserve` | \(R_t\) | token wei |
| `sellable` | 很大，不触发 clamp | |

**Step B**

\[
\begin{aligned}
\text{fee} &= \lfloor 10^{14} \times 100 / 10\,000 \rfloor = 10^{12}\ \text{wei} = 0.000001\ \text{ETH} \\
\text{tax} &= 0,\quad \text{snipeTax} = 0 \\
\text{netQuote} &= 10^{14} - 10^{12} = 99\,000\,000\,000\,000\ \text{wei}
\end{aligned}
\]

**Step C**

\[
\text{tokensOut} = \left\lfloor \frac{99\times10^{12} \times R_t}{R_q + 99\times10^{12}} \right\rfloor
\]

UI：`tokensOut / 10^{18}`（若 decimals=18）格式化为可读 SPI。

链上某笔真实成交可对照事件：`quoteIn/spent ≈ 10^14`，`fee ≈ 10^12`，`tax = 0`，`tokensOut` 与 Transfer `value` 相同（见 [`Buy.md`](./Buy.md)）。

---

## 5. 滑点 → `minTokensOut`

询价得到 `tokensOut` 后，写交易前加滑点保护（demo 默认 **1% = 100 bps**）：

\[
\text{minTokensOut} = \left\lfloor \frac{\text{tokensOut} \times (10\,000 - \text{slippageBps})}{10\,000} \right\rfloor
\]

例：`slippageBps = 100` → `minTokensOut = ⌊ tokensOut × 9900 / 10000 ⌋`。

| 量 | 单位 | 含义 |
|---|---|---|
| `slippageBps` | bps | 可接受相对询价少拿的比例 |
| `minTokensOut` | token wei | `buy` 第 2 参数 |

合约校验（部分成交时按价格界，而非简单数量界）：

```text
若 spent × minTokensOut > received × tokensOut → SlippageExceeded
```

整笔成交（`spent == received`）时等价于 `tokensOut ≥ minTokensOut`。

---

## 6. 毕业进度（仅展示，不参与 quote）

\[
\text{progress\%} = \min\left(100,\ \frac{\text{realQuoteReserve}}{\text{graduationThreshold}} \times 100\right)
\]

| 量 | 单位 | UI |
|---|---|---|
| `realQuoteReserve` | wei | 「已筹集 X ETH」 |
| `graduationThreshold` | wei | 「目标 Y ETH」（如 4.2） |

---

## 7. 边际价 vs 询价（勿混用）

\[
\text{marginalPrice} \approx \frac{\text{quoteReserve}}{\text{tokenReserve}}
\quad\text{（ETH / token，仅展示）}
\]

**不能**用 `边际价 × 购买数量` 代替 `quoteBuy`：忽略了 price impact 与扣费顺序。

| 用途 | 方法 |
|---|---|
| 展示「大约 1 SPI = ? ETH」 | `quoteReserve / tokenReserve` |
| 展示「输入 0.01 ETH 得多少 SPI」 | **必须**走 §3 全流程 |

---

## 8. 与写交易的衔接

```text
quoteIn     = parseEther(用户输入)
quote       = quoteBuyFromState(quoteIn, state)
minTokensOut = tokensOut * 9900 / 10000

curve.buy(quoteIn, minTokensOut, recipient)  payable value = quoteIn
```

详见 [`Buy.md`](./Buy.md)。

---

## 9. 前端代码对照

| 步骤 | 代码 |
|---|---|
| `amountOut` / `amountIn` / `ceilDiv` / `quoteBuyFromState` | [`lib/quoteBuy.ts`](../src/lib/quoteBuy.ts) |
| 读链 + 组装 state | [`hooks/useCurveBuyQuote.ts`](../src/hooks/useCurveBuyQuote.ts) |
| `minTokensOut` + `writeContract buy` | [`hooks/useCurveBuy.ts`](../src/hooks/useCurveBuy.ts) |
| UI 输入 ETH / 展示 token | [`components/BuyTradePanel.tsx`](../src/components/BuyTradePanel.tsx) |

---

## 参考

- [Pons V2 官方文档](https://docs.ponsfamily.com/v2)
- 合约：[`PonsV2BondingCurve.sol`](../../contractsV2/src/v2/PonsV2BondingCurve.sol) · [`PonsV2BondingCurveMath.sol`](../../contractsV2/src/v2/libraries/PonsV2BondingCurveMath.sol)
