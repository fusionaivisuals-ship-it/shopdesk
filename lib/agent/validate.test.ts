import { describe, it, expect } from "vitest";
import { checkInput, MAX_FIELD_CHARS } from "./validate";
import { definition as verifyDef } from "../tools/verify_customer";
import { definition as listDef } from "../tools/list_orders";

describe("G14 tool input checked against the tool's schema", () => {
  it("normal input passes", () => {
    expect(checkInput(verifyDef.input_schema, { email: "mei.lin@example.com", order_number: "GC-1042" }).ok).toBe(true);
    expect(checkInput(listDef.input_schema, {}).ok).toBe(true);
  });
  it("non-text values are refused (e.g. an object aimed at the database)", () => {
    expect(checkInput(verifyDef.input_schema, { email: { $ne: "" }, order_number: "GC-1042" })).toEqual({ ok: false, problem: "email must be text" });
  });
  it("extra fields are refused (no smuggling a customer_id into list_orders)", () => {
    expect(checkInput(listDef.input_schema, { customer_id: "cus_2" })).toEqual({ ok: false, problem: "unknown field customer_id" });
  });
  it("missing required fields and huge strings are refused", () => {
    expect(checkInput(verifyDef.input_schema, { email: "a@b.c" }).ok).toBe(false);
    expect(checkInput(verifyDef.input_schema, { email: "a".repeat(MAX_FIELD_CHARS + 1), order_number: "GC-1" }).ok).toBe(false);
  });
});
