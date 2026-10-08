import type { AppState, Union, Upazila, RegCase } from "./types";

const MANIRAMPUR: [string, string, string][] = [
  ["pourashava", "মণিরামপুর পৌরসভা", "Manirampur Pourashava"],
  ["rohita", "০১ নং রোহিতা", "01 No. Rohita"],
  ["kashimnagar", "০২ নং কাশিমনগর", "02 No. Kashimnagar"],
  ["bhojgati", "০৩ নং ভোজগাতি", "03 No. Bhojgati"],
  ["dhakuria", "০৪ নং ঢাকুরিয়া", "04 No. Dhakuria"],
  ["haridaskati", "০৫ নং হরিদাসকাটি", "05 No. Haridaskati"],
  ["manirampur", "০৬ নং মণিরামপুর", "06 No. Manirampur"],
  ["khedapara", "০৭ নং খেদাপাড়া", "07 No. Khedapara"],
  ["hariharnagar", "০৮ নং হরিহরনগর", "08 No. Hariharnagar"],
  ["jhanpa", "০৯ নং ঝাঁপা", "09 No. Jhanpa"],
  ["moshmimnagar", "১০ নং মশ্বিমনগর", "10 No. Moshmimnagar"],
  ["chaluahati", "১১ নং চালুয়াহাটি", "11 No. Chaluahati"],
  ["shyamkur", "১২ নং শ্যামকুড়", "12 No. Shyamkur"],
  ["khanpur", "১৩ নং খানপুর", "13 No. Khanpur"],
  ["durbadanga", "১৪ নং দুর্বাডাঙ্গা", "14 No. Durbadanga"],
  ["kultia", "১৫ নং কুলটিয়া", "15 No. Kultia"],
  ["nehalpur", "১৬ নং নেহালপুর", "16 No. Nehalpur"],
  ["monoharpur", "১৭ নং মনোহরপুর", "17 No. Monoharpur"],
];

const stripBn = (s: string) => s.replace(/^.*নং\s*/, "");
const stripEn = (s: string) => s.replace(/^\d+ No\.\s*/, "");

export function makeUnions(list: [string, string, string][], prefix: string): Union[] {
  return list.map(([id, bn, en]) => {
    const b = stripBn(bn).replace(" পৌরসভা", ""), e = stripEn(en).replace(" Pourashava", "");
    const uid = `${prefix}-${id}`;
    return {
      id: uid, bn, en,
      villages: [1, 2, 3].map((w) => ({
        id: `${uid}-v${w}`,
        bn: `${b} গ্রাম-${"০১২৩"[w]}`, en: `${e} Village-${w}`,
        poBn: b, poEn: e, ward: w,
      })),
    };
  });
}

export function seedState(): AppState {
  const mani: Upazila = {
    id: "manirampur", bn: "মণিরামপুর", en: "Manirampur",
    districtBn: "যশোর", districtEn: "Jashore", divisionBn: "খুলনা", divisionEn: "Khulna",
    unions: makeUnions(MANIRAMPUR, "mn"),
  };
  // Realistic village names for Rohita
  mani.unions[1].villages = [
    { id: "mn-rohita-v1", bn: "রোহিতা", en: "Rohita", poBn: "রোহিতা", poEn: "Rohita", ward: 1 },
    { id: "mn-rohita-v2", bn: "নেংগুড়াহাট", en: "Nengurahat", poBn: "রোহিতা", poEn: "Rohita", ward: 2 },
    { id: "mn-rohita-v3", bn: "খোদ্দ", en: "Khodda", poBn: "রোহিতা", poEn: "Rohita", ward: 3 },
  ];
  const kesh: Upazila = {
    id: "keshabpur", bn: "কেশবপুর", en: "Keshabpur",
    districtBn: "যশোর", districtEn: "Jashore", divisionBn: "খুলনা", divisionEn: "Khulna",
    unions: makeUnions([["pourashava", "কেশবপুর পৌরসভা", "Keshabpur Pourashava"], ["trimohini", "০১ নং ত্রিমোহিনী", "01 No. Trimohini"]], "ks"),
  };

  const D = 86400000, now = Date.now();
  const mk = (i: number, p: Partial<RegCase>): RegCase => ({
    id: `c${i}`, type: "birth",
    name: { bn: "আরিফ হোসেন", en: "Arif Hossain" },
    father: { bn: "কামাল হোসেন", en: "Kamal Hossain" },
    mother: { bn: "রেহানা বেগম", en: "Rehana Begum" },
    nid: `19901234567${i}`, gender: "male", dob: "2026-09-12", order: "1",
    villageId: "mn-rohita-v1", files: [{ name: "epi-card.jpg", size: 120000 }],
    status: "pending", remarks: [], createdBy: "u-w1", upazilaId: "manirampur", unionId: "mn-rohita", ward: 1,
    createdAt: now - i * D, synced: true, smsSent: true, ...p,
  });

  const cases: RegCase[] = [
    mk(1, {}),
    mk(2, { name: { bn: "সুমাইয়া খাতুন", en: "Sumaiya Khatun" }, gender: "female", status: "progress",
      police: { epiCard: true, parentNid: false, collected: false },
      remarks: [{ by: "মো. রফিক (প্রশাসনিক কর্মকর্তা)", role: "admin", text: "পিতার NID কপি অস্পষ্ট", at: now - D }] }),
    mk(3, { status: "completed", regNo: "20264112345678901", completedAt: now - 2 * D }),
    mk(4, { type: "death", name: { bn: "আব্দুল করিম", en: "Abdul Karim" }, dob: "1948-02-01", dod: "2026-10-01",
      cause: { bn: "বার্ধক্যজনিত", en: "Old age" }, order: undefined }),
    mk(5, { status: "completed", regNo: "20264112345670000", completedAt: now - 100 * D, createdAt: now - 110 * D,
      files: [{ name: "nid.pdf", size: 300000 }] }),
    mk(6, { createdBy: "u-w3", unionId: "mn-pourashava", villageId: "mn-pourashava-v1",
      name: { bn: "নুসরাত জাহান", en: "Nusrat Jahan" }, gender: "female" }),
    mk(7, { createdBy: "u-wk", upazilaId: "keshabpur", unionId: "ks-trimohini", villageId: "ks-trimohini-v1",
      name: { bn: "তানভীর আহমেদ", en: "Tanvir Ahmed" } }),
  ];

  return {
    upazilas: [mani, kesh],
    users: [
      { id: "u-super", name: { bn: "সুপার অ্যাডমিন", en: "Super Admin" }, role: "super", email: "super@demo.gov.bd", password: "123456", upazilaId: "" },
      { id: "u-uno", name: { bn: "ইউএনও, মণিরামপুর", en: "UNO, Manirampur" }, role: "uno", email: "uno@manirampur.gov.bd", password: "123456", upazilaId: "manirampur" },
      { id: "u-a1", name: { bn: "মো. রফিক", en: "Md. Rafiq" }, role: "admin", email: "admin.rohita@demo.gov.bd", password: "123456", upazilaId: "manirampur", unionId: "mn-rohita" },
      { id: "u-a2", name: { bn: "শাহানা পারভীন", en: "Shahana Parvin" }, role: "admin", email: "admin.pourashava@demo.gov.bd", password: "123456", upazilaId: "manirampur", unionId: "mn-pourashava" },
      { id: "u-w1", name: { bn: "ফাতেমা খাতুন", en: "Fatema Khatun" }, role: "worker", mobile: "01711000001", upazilaId: "manirampur", unionId: "mn-rohita", ward: 1 },
      { id: "u-w2", name: { bn: "সালমা আক্তার", en: "Salma Akter" }, role: "worker", mobile: "01711000002", upazilaId: "manirampur", unionId: "mn-rohita", ward: 2 },
      { id: "u-w3", name: { bn: "রুনা লায়লা", en: "Runa Laila" }, role: "worker", mobile: "01711000003", upazilaId: "manirampur", unionId: "mn-pourashava", ward: 1 },
      { id: "u-p1", name: { bn: "হাবিবুর রহমান", en: "Habibur Rahman" }, role: "police", mobile: "01811000001", upazilaId: "manirampur", unionId: "mn-rohita", ward: 1 },
      { id: "u-uk", name: { bn: "ইউএনও, কেশবপুর", en: "UNO, Keshabpur" }, role: "uno", email: "uno@keshabpur.gov.bd", password: "123456", upazilaId: "keshabpur" },
      { id: "u-wk", name: { bn: "মরিয়ম বেগম", en: "Moriom Begum" }, role: "worker", mobile: "01711000009", upazilaId: "keshabpur", unionId: "ks-trimohini", ward: 1 },
    ],
    cases, audit: [], sessionId: null,
  };
}
