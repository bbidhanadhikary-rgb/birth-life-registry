import type { Union } from "@/lib/types";

const banglaDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)] ?? digit);

export function formatUnionBadgeName(union: Union, unions: Union[]) {
  const name = union.bn.trim();
  if (/পৌরসভা$/.test(name) || /pourashava|municipality/i.test(`${union.id} ${union.en}`)) {
    return /পৌরসভা$/.test(name) ? name : `${name} পৌরসভা`;
  }

  const numberedName = /^(?:[০-৯]+|[0-9]+)\s*নং\s*/.test(name)
    ? name.replace(/^([0-9]+)/, (digits) => banglaDigits(Number(digits)))
    : `${banglaDigits(
        unions
          .filter(
            (item) =>
              !/পৌরসভা$/.test(item.bn) && !/pourashava|municipality/i.test(`${item.id} ${item.en}`),
          )
          .findIndex((item) => item.id === union.id) + 1,
      )} নং ${name}`;

  return `${numberedName.replace(/\s*ইউনিয়ন(?: পরিষদ)?$/, "")} ইউনিয়ন পরিষদ`;
}
