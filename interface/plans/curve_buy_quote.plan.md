---
name: Curve Buy Quote
overview: 在 /memes 点击 Buy 展开询价表单；本地 quoteBuy；调用 curve.buy。不改 Solidity。
todos:
  - id: expose-curve
    content: MemeLaunchCardData 增加 curve
    status: completed
  - id: quote-lib-hook
    content: lib/quoteBuy.ts + useCurveBuyQuote
    status: completed
  - id: buy-write
    content: curveAbi.buy + useCurveBuy
    status: completed
  - id: buy-panel-ui
    content: BuyTradePanel + MemeLaunchesPage 展开
    status: completed
  - id: docs-buy
    content: docs/Buy.md + README
    status: completed
isProject: false
---

# Curve Buy 询价与写合约对接

详见 [`interface/docs/Buy.md`](../docs/Buy.md) 与实现代码：

- [`lib/quoteBuy.ts`](../src/lib/quoteBuy.ts)
- [`hooks/useCurveBuyQuote.ts`](../src/hooks/useCurveBuyQuote.ts)
- [`hooks/useCurveBuy.ts`](../src/hooks/useCurveBuy.ts)
- [`components/BuyTradePanel.tsx`](../src/components/BuyTradePanel.tsx)

流程：点 Buy → 面板输入 ETH → 本地 quote → `curve.buy(quoteIn, minTokensOut, recipient)` + `value=quoteIn`。
