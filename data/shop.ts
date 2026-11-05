// Fictional Glow & Co data for development and tests (D-15, D-16). Not real people.
export type Customer = { id: string; email: string; name: string };
export type Order = { number: string; customerId: string; status: "processing" | "shipped" | "delivered"; placedAt: string };

export const customers: Customer[] = [
  { id: "cus_1", email: "mei.lin@example.com", name: "Mei Lin" },
  { id: "cus_2", email: "sam.carter@example.com", name: "Sam Carter" },
];

export const orders: Order[] = [
  { number: "GC-1042", customerId: "cus_1", status: "delivered", placedAt: "2026-10-20" },
  { number: "GC-1043", customerId: "cus_1", status: "shipped", placedAt: "2026-11-01" },
  { number: "GC-2001", customerId: "cus_2", status: "processing", placedAt: "2026-11-04" },
];
