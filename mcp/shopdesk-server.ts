// ShopDesk MCP server (D-32, D-33): exposes ONLY ShopDesk's own tools, with the same
// rules the live agent gets (locks, trimmed fields, structured errors).
// Uses Neon when SHOPDESK_DATABASE_URL is set (D-15, D-33, D-34).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { memoryStore, neonStore } from "../lib/tools/store";
import { verifyCustomer, definition as verifyDef } from "../lib/tools/verify_customer";
import { listOrders, definition as listDef } from "../lib/tools/list_orders";
import { searchPolicy, definition as searchDef } from "../lib/tools/search_policy";
import { readPolicy, definition as readDef } from "../lib/tools/read_policy";

// Real database when SHOPDESK_DATABASE_URL is set (D-33), otherwise in-memory test data.
const url = process.env.SHOPDESK_DATABASE_URL;
const store = url && !url.startsWith("${") ? neonStore(url) : memoryStore();
// One MCP connection = one test conversation and one test visitor.
const ctx = () => ({ conversationId: "mcp-dev", visitorId: "mcp-dev", now: Date.now() });
const asText = (x: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(x) }] });

const server = new McpServer({ name: "shopdesk", version: "0.1.0" });

server.registerTool(
  verifyDef.name,
  {
    description: verifyDef.description,
    inputSchema: { email: z.string(), order_number: z.string() },
  },
  async (input) => asText(await verifyCustomer(input, ctx(), store))
);

server.registerTool(
  listDef.name,
  { description: listDef.description, inputSchema: {} },
  async () => {
    const r = await listOrders({}, ctx(), store);
    return { ...asText(r), isError: "isError" in r }; // MCP-level error flag matches our contract (D-30)
  }
);

server.registerTool(searchDef.name, { description: searchDef.description, inputSchema: { query: z.string() } }, async (input) => {
  const r: any = await searchPolicy(input, ctx(), store);
  return { ...asText(r), isError: r?.isError === true };
});

server.registerTool(readDef.name, { description: readDef.description, inputSchema: { section: z.string() } }, async (input) => {
  const r: any = await readPolicy(input, ctx(), store);
  return { ...asText(r), isError: r?.isError === true };
});

await server.connect(new StdioServerTransport());
