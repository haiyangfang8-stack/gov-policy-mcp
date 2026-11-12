# gov-policy-mcp

**MCP server for China's State Council policy document library.**

China publishes every State Council policy document (国务院文件) on
[gov.cn](https://www.gov.cn) — but there is no public API and no documentation for its
search backend. This server reverse-engineers the internal JSON endpoint and exposes it
as an MCP tool, so an AI agent can look up **official policy text and document numbers**
in one call.

```
You: 最近国务院关于人工智能出了哪些文件？
AI:  [calls search_policies → 743 hits, with document numbers, issuing bodies and links]
```

## Tool

| Tool | What it does |
|---|---|
| `search_policies` | Full-text search over the State Council policy library. Returns title, document number (文号), issuing body, publish date, category, summary and a link to the original page. |

### Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `keyword` | string | required | Chinese keyword, e.g. `人工智能` · `数据要素` · `新能源汽车` |
| `page` | number | `1` | Page number |
| `size` | number | `10` | Records per page, 1–20 |

## Install

```bash
git clone https://github.com/haiyangfang8-stack/gov-policy-mcp.git
cd gov-policy-mcp
npm install
npm run build
```

## Configure your MCP client

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gov-policy": {
      "command": "node",
      "args": ["/absolute/path/to/gov-policy-mcp/dist/index.js"]
    }
  }
}
```

## Example output

```
搜索「人工智能」· 第 1 页 · 命中约 743 条

1. 国务院办公厅关于适应人工智能技术发展助力构建就业友好型发展方式的意见
   国办发〔2026〕29号 · 国务院办公厅 · 2026.10.23
   分类：劳动、人事、监察\劳动就业
   摘要：为贯彻落实党中央、国务院决策部署，就业是最基本的民生……
   https://www.gov.cn/zhengce/zhengceku/202610/content_7084108.htm
```

## Known limits (upstream)

- Search is **keyword based** — no boolean operators, no date range in this endpoint version.
- Results include both exact and loose matches; the `<em>` highlight tags are stripped.
- Chinese only. The upstream index does not handle English well.
- Undocumented endpoint: if it breaks, the mapping lives in `src/index.ts` (`SEARCH` + the
  `PolicyRecord` mapping) and is a small fix.

## Why this exists

Part of a small set of adapters that give AI agents access to Chinese data sources
that have no API. See also [ggzy-mcp](https://github.com/haiyangfang8-stack/ggzy-mcp)
for tender announcements.

## License

MIT
