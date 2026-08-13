import { describe, expect, it, afterEach } from "vitest";
import { impersonationState, guardQueryBuilder } from "./supabase";

function makeFakeBuilder() {
  const calls: string[] = [];
  const builder: Record<
    string,
    (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>
  > = {};
  for (const method of ["insert", "update", "upsert", "delete", "select"]) {
    builder[method] = async (...args: unknown[]) => {
      calls.push(method);
      return { data: { method, args }, error: null };
    };
  }
  return { builder: guardQueryBuilder(builder), calls };
}

describe("impersonation mutation guard", () => {
  afterEach(() => {
    impersonationState.active = false;
  });

  it("passes insert/update/upsert/delete through when not impersonating", async () => {
    const { builder, calls } = makeFakeBuilder();
    impersonationState.active = false;

    const { data, error } = await builder.insert({ id: "1" });
    expect(error).toBeNull();
    expect(data).toEqual({ method: "insert", args: [{ id: "1" }] });
    expect(calls).toEqual(["insert"]);
  });

  it("leaves non-mutation methods (e.g. select) untouched", async () => {
    const { builder } = makeFakeBuilder();
    impersonationState.active = true;

    const { error } = await builder.select();
    expect(error).toBeNull();
  });

  it("blocks insert/update/upsert/delete while impersonating, without calling the original", async () => {
    const { builder, calls } = makeFakeBuilder();
    impersonationState.active = true;

    for (const method of ["insert", "update", "upsert", "delete"] as const) {
      const { data, error } = await builder[method]({ id: "1" });
      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/read-only/i);
    }
    expect(calls).toEqual([]);
  });

  it("still resolves further chained calls on a blocked mutation (e.g. .select().single())", async () => {
    const { builder } = makeFakeBuilder();
    impersonationState.active = true;

    const blocked = builder.insert({ id: "1" });
    // The blocked result stands in for a Postgrest builder: any chained
    // method (select/eq/single/...) must remain callable and ultimately
    // resolve to the same blocked error, since real call sites chain
    // `.insert(...).select().single()` before awaiting.
    const chained = (blocked as any).select().single();
    const { data, error } = await chained;
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});
