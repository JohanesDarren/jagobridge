import { describe, expect, it } from "vitest";
import { canUseFeature, canUseModel } from "../../src/services/access.service.js";
import type { EffectiveAccess } from "../../src/services/access.service.js";
import type { ModelRow } from "../../src/repositories/model.repository.js";

function makeAccess(overrides: Partial<EffectiveAccess> = {}): EffectiveAccess {
  return {
    userId: "user-1",
    isActive: true,
    role: "member",
    profileId: "profile-1",
    allowAllModels: false,
    allowedModelIds: [],
    allowedFeatureCodes: [],
    modelOverrides: {},
    featureOverrides: {},
    limits: {
      limit5hTokens: 500_000,
      limitWeeklyTokens: 2_000_000,
      limitRpm: 30,
      maxOutputTokensPerRequest: 0,
    },
    ...overrides,
  };
}

function makeModel(overrides: Partial<ModelRow> = {}): ModelRow {
  return {
    id: "model-1",
    upstream_id: "model-1",
    public_name: "model-1",
    display_name: "Model 1",
    provider_label: null,
    capabilities: {},
    token_multiplier: "1.00",
    is_enabled: true,
    is_available: true,
    last_synced_at: null,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: null,
    updated_by: null,
    ...overrides,
  };
}

describe("canUseModel", () => {
  it("denies when a user override denies a model the profile allows", () => {
    const model = makeModel();
    const access = makeAccess({ allowedModelIds: [model.id], modelOverrides: { [model.id]: "deny" } });
    expect(canUseModel(access, model)).toBe(false);
  });

  it("allows when a user override allows a model the profile excludes", () => {
    const model = makeModel();
    const access = makeAccess({ allowedModelIds: [], modelOverrides: { [model.id]: "allow" } });
    expect(canUseModel(access, model)).toBe(true);
  });

  it("denies a disabled model even when allow-all is set", () => {
    const model = makeModel({ is_enabled: false });
    expect(canUseModel(makeAccess({ allowAllModels: true }), model)).toBe(false);
  });

  it("denies an unavailable model to everyone", () => {
    const model = makeModel({ is_available: false });
    expect(canUseModel(makeAccess({ allowAllModels: true }), model)).toBe(false);
  });

  it("denies all models to an inactive user", () => {
    const model = makeModel();
    expect(canUseModel(makeAccess({ isActive: false, allowAllModels: true }), model)).toBe(false);
  });

  it("defaults to deny when no grant matches", () => {
    expect(canUseModel(makeAccess(), makeModel())).toBe(false);
  });
});

describe("canUseFeature", () => {
  it("honours a deny override over a profile grant", () => {
    const access = makeAccess({
      allowedFeatureCodes: ["tool_calling"],
      featureOverrides: { tool_calling: "deny" },
    });
    expect(canUseFeature(access, "tool_calling")).toBe(false);
  });

  it("honours an allow override outside the profile", () => {
    const access = makeAccess({ featureOverrides: { vision_input: "allow" } });
    expect(canUseFeature(access, "vision_input")).toBe(true);
  });

  it("defaults to deny", () => {
    expect(canUseFeature(makeAccess(), "json_mode")).toBe(false);
  });
});
