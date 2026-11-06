// ShopDesk MCP server (D-32, D-33): exposes ONLY ShopDesk's own tools, with the same
// rules the live agent gets (locks, trimmed fields, structured errors).
// Storage is in-memory until the Neon session; then SHOPDESK_DATABASE_URL is used (D-15, D-33).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { memoryStore } from "../lib/tools/store";
import { verifyCustomer, definition as verifyDef } from "../lib/tools/verify_customer";
import { listOrders, definition as listDef } from "../lib/tools/list_orders";

const store = memoryStore();
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
  async (input) => asText(verifyCustomer(input, ctx(), store))
);

server.registerTool(
  listDef.name,
  { description: listDef.description, inputSchema: {} },
  async () => {
    const r = listOrders({}, ctx(), store);
    return { ...asText(r), isError: "isError" in r }; // MCP-level error flag matches our contract (D-30)
  }
);

await server.connect(new StdioServerTransport());
