// ============================================================================
// Diagnostic Tests & Packages Catalog Service
// ============================================================================

export const SAMPLE_PACKAGES = [
  {
    id: "pkg-1",
    name: "Complete Health Vital Check",
    category: "Full Body Profile",
    testCount: 64,
    description: "Comprehensive screening covering CBC, Lipid Profile, Liver Function, Kidney Function, Thyroid, and Blood Glucose.",
    price: 999,
    originalPrice: 1999,
    fastingRequired: true,
    tatHours: 24,
    popular: true,
    parameters: ["CBC with ESR", "Lipid Profile", "Liver Function Tests (LFT)", "Kidney Function Tests (KFT)", "Fasting Blood Sugar", "HbA1c"],
  },
  {
    id: "pkg-2",
    name: "Advanced Cardiac Risk Panel",
    category: "Cardiac Health",
    testCount: 18,
    description: "Evaluates key cardiovascular markers including high-sensitivity CRP, lipid fractions, and homocysteine levels.",
    price: 1499,
    originalPrice: 2499,
    fastingRequired: true,
    tatHours: 24,
    popular: false,
    parameters: ["hs-CRP", "Homocysteine", "Lipid Extended Panel", "ApoA1 & ApoB", "Lipoprotein (a)"],
  },
  {
    id: "pkg-3",
    name: "Diabetes Monitoring & Control",
    category: "Endocrinology",
    testCount: 12,
    description: "Targeted monitoring for diabetic patients including glycemic index, kidney microalbumin, and lipid levels.",
    price: 799,
    originalPrice: 1299,
    fastingRequired: true,
    tatHours: 12,
    popular: true,
    parameters: ["Fasting Blood Sugar", "Post-Prandial Glucose", "HbA1c (Glycated Hemoglobin)", "Average Blood Glucose", "Urine Microalbumin"],
  },
  {
    id: "pkg-4",
    name: "Comprehensive Thyroid Profile (Total & Free)",
    category: "Endocrinology",
    testCount: 6,
    description: "Precise assessment of thyroid endocrine health measuring T3, T4, TSH, and free hormones.",
    price: 499,
    originalPrice: 899,
    fastingRequired: false,
    tatHours: 12,
    popular: false,
    parameters: ["Total T3", "Total T4", "TSH (Ultrasensitive)", "Free T3", "Free T4"],
  },
  {
    id: "pkg-5",
    name: "Women's Wellness & Vitality",
    category: "Preventive Care",
    testCount: 52,
    description: "Designed specifically for women's nutritional, hormonal, and bone health including Vitamin D & B12.",
    price: 1699,
    originalPrice: 2899,
    fastingRequired: true,
    tatHours: 24,
    popular: true,
    parameters: ["Vitamin D (25-OH)", "Vitamin B12", "Iron Deficiency Panel", "Thyroid Profile", "Calcium & Bone Health", "Complete Hemogram"],
  },
  {
    id: "pkg-6",
    name: "Senior Citizen Comprehensive Health",
    category: "Geriatric Care",
    testCount: 72,
    description: "Specialized geriatric diagnostic battery evaluating bone density markers, cardiac risk, prostate/electrolytes.",
    price: 2199,
    originalPrice: 3999,
    fastingRequired: true,
    tatHours: 36,
    popular: false,
    parameters: ["Electrolytes Panel", "PSA (for males)", "Renal & Hepatic Battery", "Cardiac Biomarkers", "Complete Urine Examination"],
  },
];

export const testService = {
  async getPackages({ category = "" } = {}) {
    // Returns curated diagnostic package catalog
    if (!category || category === "all") {
      return SAMPLE_PACKAGES;
    }
    return SAMPLE_PACKAGES.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  },

  async getPackageById(id) {
    return SAMPLE_PACKAGES.find((p) => p.id === id) || null;
  },
};
