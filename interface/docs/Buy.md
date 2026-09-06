# Buy：询价与 curve.buy 对接

依据：[Qoute.md](./Qoute.md)、[`PonsV2BondingCurve.buy`](../../contractsV2/src/v2/PonsV2BondingCurve.sol)。

UI：`/memes` → 点卡片 **Buy** → 下方展开 [`BuyTradePanel`](../src/components/BuyTradePanel.tsx)。

---

## 1. 链上 `CurveBuy` 事件（成交结果）

| 字段 | 含义 |
|---|---|
| `buyer` | `msg.sender` |
| `recipient` | 收 token 地址（`buy` 第 3 参） |
| `quoteIn` / spent | 实际计入曲线的报价额（wei） |
| `tokensOut` | 到手 meme token |
| `fee` | 交易费（quote 侧） |
| `tax` | creator tax |

---

## 2. 写合约入参

```solidity
function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensOut)
```

| 参数 | 含义 | Demo |
|---|---|---|
| `quoteIn` | 投入报价资产数量 | Sell ETH → `parseEther` |
| `minTokensOut` | 滑点下限 | `tokensOut * 9900 / 10000`（1%） |
| `recipient` | 收币地址 | 连接钱包 |
| `msg.value` | ETH pair **必须等于** `quoteIn` | 同 `quoteIn` |

ABI：[`curveAbi`](../src/constants/abis.ts)。Hook：[`useCurveBuy`](../src/hooks/useCurveBuy.ts)。

---

## 3. 前置询价（本地，无 `quote()`）

读 Curve：

- `getReserves()`（定价，含 phantom）
- `sellableTokens()` / `feeBps()` / `creatorTaxBps()`
- `currentSnipeTaxBps(recipient)`（无则当 0）
- `realQuoteReserve()` + `graduationThreshold()`（进度条）

公式：[`lib/quoteBuy.ts`](../src/lib/quoteBuy.ts) → `quoteBuyFromState`（扣费 → constant-product → sellable clamp）。

Hook：[`useCurveBuyQuote`](../src/hooks/useCurveBuyQuote.ts)。

```text
输入 ETH → quoteBuy → 展示 tokensOut → Buy CTA → curve.buy(quoteIn, minOut, recipient) value=quoteIn
```

---

## 4. Demo 边界

- 仅 ETH pair；不做 Sell / 方向翻转
- 滑点固定 1%
- 不改 Solidity
