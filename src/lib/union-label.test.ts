import { describe, expect, it } from "vitest";
import { seedState } from "./seed";
import { formatUnionBadgeName, formatUnionFullName, getUnionLabel } from "./union-label";

describe("union badge labels", () => {
  const upazila = seedState().upazilas.find((area) => area.id === "manirampur")!;

  it("formats Rohita and Dhakuria as Bengali Union Parishad names", () => {
    const rohita = upazila.unions.find((union) => union.id === "mn-rohita")!;
    const dhakuria = upazila.unions.find((union) => union.id === "mn-dhakuria")!;

    expect(formatUnionBadgeName(rohita, upazila.unions)).toBe("০১ নং রোহিতা ইউনিয়ন পরিষদ");
    expect(formatUnionBadgeName(dhakuria, upazila.unions)).toBe("০৪ নং ঢাকুরিয়া ইউনিয়ন পরিষদ");
    expect(getUnionLabel("mn-rohita")).toBe("০১ নং রোহিতা ইউনিয়ন পরিষদ");
    expect(getUnionLabel("mn-dhakuria")).toBe("০৪ নং ঢাকুরিয়া ইউনিয়ন পরিষদ");
  });

  it("formats a full station header with upazila and district", () => {
    const dhakuria = upazila.unions.find((union) => union.id === "mn-dhakuria")!;

    expect(formatUnionFullName(dhakuria, upazila.unions, upazila)).toBe(
      "০৪ নং ঢাকুরিয়া ইউনিয়ন পরিষদ, মণিরামপুর, যশোর",
    );
  });

  it("keeps municipal areas labeled as municipalities", () => {
    const pourashava = upazila.unions.find((union) => union.id === "mn-pourashava")!;

    expect(formatUnionBadgeName(pourashava, upazila.unions)).toBe("মণিরামপুর পৌরসভা");
  });

  it("never falls back to showing an ID-shaped name", () => {
    const rohita = upazila.unions.find((union) => union.id === "mn-rohita")!;
    const mislabeledUnion = { ...rohita, id: "other-rohita", bn: "other-rohita" };

    expect(formatUnionBadgeName(mislabeledUnion, upazila.unions)).toBe("ইউনিয়ন পরিষদ");
  });
});
