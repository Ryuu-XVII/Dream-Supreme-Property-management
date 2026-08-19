import { describe, expect, it } from "vitest";
import {
  calculateTransferDutyCents,
  conditionStatusFromDb,
  entityTypeFromDb,
  stageFromDb,
  stageToDb,
} from "./domain";
import { STAGES } from "@/types";
import { TRANSFER_DUTY_FALLBACK } from "@/lib/financial-config";

describe("database domain mapping", () => {
  it("round-trips every deal stage", () => {
    for (const stage of STAGES) {
      expect(stageFromDb[stageToDb[stage]]).toBe(stage);
    }
  });

  it("maps pre-consolidation stage values onto their merged label", () => {
    expect(stageFromDb.mandate_signed).toBe("Listing & Negotiation");
    expect(stageFromDb.listed_marketing).toBe("Listing & Negotiation");
    expect(stageFromDb.offer_received).toBe("Listing & Negotiation");
    expect(stageFromDb.conveyancer_instructed).toBe("Conveyancing");
    expect(stageFromDb.compliance_certificates).toBe("Conveyancing");
    expect(stageFromDb.transfer_duty_vat).toBe("Conveyancing");
    expect(stageFromDb.rates_levy_clearance).toBe("Conveyancing");
    expect(stageFromDb.documents_signed_guarantees).toBe("Conveyancing");
  });

  it("maps condition and entity values used by Supabase", () => {
    expect(conditionStatusFromDb.pending).toBe("Open");
    expect(conditionStatusFromDb.extended).toBe("Extended");
    expect(entityTypeFromDb.natural_person).toBe("Natural Person");
    expect(entityTypeFromDb.close_corporation).toBe("Close Corporation");
  });
});

describe("SARS transfer duty", () => {
  it("charges no duty at the exemption threshold", () => {
    expect(calculateTransferDutyCents(121_000_000, TRANSFER_DUTY_FALLBACK).duty).toBe(0);
  });

  it("uses the published base and marginal rate above R2,329,300", () => {
    expect(calculateTransferDutyCents(250_000_000, TRANSFER_DUTY_FALLBACK).duty).toBe(6_720_000);
  });

  it("uses the top bracket above R13,310,000", () => {
    expect(calculateTransferDutyCents(1_500_000_000, TRANSFER_DUTY_FALLBACK).duty).toBe(
      146_115_600,
    );
  });
});
