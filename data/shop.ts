// Fictional Glow & Co data for development and tests (D-15, D-16). Not real people.
export type Customer = { id: string; email: string; name: string };
export type Order = { number: string; customerId: string; status: "processing" | "shipped" | "delivered" };

export const customers: Customer[] = [
  { id: "cus_1", email: "mei.lin@example.com", name: "Mei Lin" },
  { id: "cus_2", email: "sam.carter@example.com", name: "Sam Carter" },
];

export const orders: Order[] = [
  { number: "GC-1042", customerId: "cus_1", status: "delivered" },
  { number: "GC-1043", customerId: "cus_1", status: "shipped" },
  { number: "GC-2001", customerId: "cus_2", status: "processing" },
];
