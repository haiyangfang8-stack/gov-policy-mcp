#!/usr/bin/env node
/**
 * gov-policy-mcp — MCP server for China's State Council policy document library
 *
 * Exposes the (undocumented) JSON endpoint behind sousuo.www.gov.cn so AI agents
 * can search official policy documents (国务院文件) directly.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const SEARCH = "https://sousuo.www.gov.cn/search-gov/data";
const SITE = "https://www.gov.cn";
function clean(s) {
    return String(s ?? "")
        .replace(/<\/?em>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
async function searchPolicies(opts) {
    const page = Math.min(Math.max(opts.page ?? 1, 1), 50);
    const size = Math.min(Math.max(opts.size ?? 10, 1), 20);
    const params = new URLSearchParams({
        t: "zhengcelibrary_gw",
        q: opts.keyword.slice(0, 60),
        p: String(page),
        n: String(size),
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let res;
    try {
        res = await fetch(`${SEARCH}?${params}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                Referer: "https://sousuo.www.gov.cn/",
                Accept: "application/json, text/plain, */*",
            },
            signal: ctrl.signal,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`请求中国政府网失败（${msg}），可稍后重试`);
    }
    finally {
        clearTimeout(timer);
    }
    if (!res.ok)
        throw new Error(`上游返回 HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== undefined && Number(json.code) !== 200) {
        throw new Error(`上游返回错误：${json.msg ?? json.code}`);
    }
    const sv = json.searchVO ?? {};
    const list = sv.listVO ?? [];
    const records = list.map((r) => ({
        title: clean(r.title),
        docNumber: clean(r.pcode),
        issuedBy: clean(r.puborg),
        publishedAt: clean(r.pubtimeStr),
        category: clean(r.childtype),
        summary: clean(r.summary).slice(0, 160),
        url: r.url ? String(r.url) : "",
    }));
    return {
        total: Number(sv.totalCount ?? records.length),
        page,
        records,
    };
}
function render(r, keyword) {
    if (r.records.length === 0) {
        return `搜索「${keyword}」：没有结果。换个关键词试试。`;
    }
    const lines = [`搜索「${keyword}」· 第 ${r.page} 页 · 命中约 ${r.total} 条`, ""];
    r.records.forEach((p, i) => {
        const meta = [p.docNumber, p.issuedBy, p.publishedAt].filter(Boolean).join(" · ");
        lines.push(`${i + 1}. ${p.title}`);
        if (meta)
            lines.push(`   ${meta}`);
        if (p.category)
            lines.push(`   分类：${p.category}`);
        if (p.summary)
            lines.push(`   摘要：${p.summary}`);
        if (p.url)
            lines.push(`   ${p.url}`);
        lines.push("");
    });
    return lines.join("\n").trimEnd();
}
const server = new McpServer({ name: "gov-policy-mcp", version: "1.0.0" });
server.tool("search_policies", "Search official policy documents (国务院文件/政策) in China's State Council policy library. Returns title, document number, issuing body, publish date, category, summary and a direct link to the original page on gov.cn.", {
    keyword: z.string().min(1).describe("Search keyword in Chinese, e.g. 人工智能 / 数据要素 / 新能源汽车"),
    page: z.number().int().min(1).max(50).optional().describe("Page number, default 1"),
    size: z.number().int().min(1).max(20).optional().describe("Records per page, default 10"),
}, async (args) => {
    try {
        const result = await searchPolicies(args);
        return { content: [{ type: "text", text: render(result, args.keyword) }] };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `搜索失败：${msg}` }], isError: true };
    }
});
async function main() {
    await server.connect(new StdioServerTransport());
}
main().catch((e) => {
    console.error("gov-policy-mcp fatal:", e);
    process.exit(1);
});
