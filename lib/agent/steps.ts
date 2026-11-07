// D-51: what the customer sees for each tool step while the loop runs (D-50).
// Labels are written HERE, by code. Only whitelisted words from a tool result may appear,
// and every failure is the same generic line, so a step can never leak what D-04/D-06 keep back.

export type Step = { tool: string; label: string; ok: boolean };

const ORDER_NO = /^GC-\d{1,8}$/;
const SAFE_WORD = /^[A-Za-z][A-Za-z ]{0,23}$/; // statuses and policy titles: letters and spaces, short

function safe(v: unknown, pattern: RegExp): string | null {
  return typeof v === "string" && pattern.test(v) ? v : null;
}

function policyLabel(title: unknown, version: unknown): string | null {
  const t = safe(title, SAFE_WORD);
  return t && Number.isInteger(version) ? `${t}, v${version}` : null;
}

export function stepLabel(tool: string, result: any): Step {
  const failed = (label: string): Step => ({ tool, label, ok: false });
  if (!result || typeof result !== "object" || result.isError === true) {
    const what: Record<string, string> = {
      verify_customer: "Couldn't confirm",
      list_orders: "Couldn't load orders",
      search_policy: "Couldn't load policies",
      read_policy: "Couldn't load policy",
      report_reaction: "Couldn't pass on",
    };
    return failed(what[tool] ?? "Skipped");
  }

  switch (tool) {
    case "verify_customer":
      // No-match and locked look the same here (D-04); Claude explains the next step in words.
      return result.ok === true ? { tool, label: "Verified", ok: true } : failed("Couldn't confirm");

    case "list_orders": {
      const orders = Array.isArray(result.orders) ? result.orders : [];
      if (orders.length === 1) {
        const n = safe(orders[0].number, ORDER_NO);
        const s = safe(orders[0].status, SAFE_WORD);
        if (n && s) return { tool, label: `${n} ${s.toLowerCase()}`, ok: true };
      }
      return { tool, label: orders.length === 0 ? "No orders" : orders.length === 1 ? "1 order" : `${orders.length} orders`, ok: true };
    }

    case "search_policy": {
      if (result.found !== true) return { tool, label: "Not in our policies", ok: true };
      const first = Array.isArray(result.results) ? result.results[0] : null;
      return { tool, label: (first && policyLabel(first.title, first.version)) ?? "Found", ok: true };
    }

    case "read_policy":
      return { tool, label: policyLabel(result.title, result.version) ?? "Read", ok: true };

    case "report_reaction":
      return { tool, label: "Passed to our team", ok: true };

    default:
      return failed("Skipped");
  }
}
