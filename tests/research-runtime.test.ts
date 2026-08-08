import { describe, expect, it, vi } from "vitest";

import { runCredentialPlanWithRetry } from "../src/research/runtime";

describe("research runtime resilience", () => {
  it("retries one transient provider failure with fresh planning dependencies", async () => {
    const build = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary provider failure"))
      .mockResolvedValueOnce({ path: "signup_required" });

    await expect(runCredentialPlanWithRetry(build)).resolves.toEqual({
      path: "signup_required",
    });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("surfaces a repeated provider failure after the bounded retry", async () => {
    const build = vi.fn().mockRejectedValue(new Error("provider unavailable"));

    await expect(runCredentialPlanWithRetry(build)).rejects.toThrow(
      "provider unavailable",
    );
    expect(build).toHaveBeenCalledTimes(2);
  });
});
