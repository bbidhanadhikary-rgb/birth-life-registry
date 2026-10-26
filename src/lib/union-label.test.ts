import { describe, expect, it } from "vitest";
import { seedState } from "./seed";
import { formatUnionBadgeName } from "./union-label";

describe("union badge labels", () => {
  const upazila = seedState().upazilas.find((area) => area.id === "manirampur")!;

  it("formats Rohita and Dhakuria as Bengali Union Parishad names", () => {
    const rohita = upazila.unions.find((union) => union.id === "mn-rohita")!;
    const dhakuria = upazila.unions.find((union) => union.id === "mn-dhakuria")!;

    expect(formatUnionBadgeName(rohita, upazila.unions)).toBe("০১ নং রোহিতা ইউনিয়ন পরিষদ");
    expect(formatUnionBadgeName(dhakuria, upazila.unions)).toBe("০৪ নং ঢাকুরিয়া ইউনিয়ন পরিষদ");
  });

  it("keeps municipal areas labeled as municipalities", () => {
    const pourashava = upazila.unions.find((union) => union.id === "mn-pourashava")!;

    expect(formatUnionBadgeName(pourashava, upazila.unions)).toBe("মণিরামপুর পৌরসভা");
  });
});
