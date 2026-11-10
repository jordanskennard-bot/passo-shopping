// Site and company details. Google requires the business address shown on the
// site to match the company registration, and contact details to be present.

export const site = {
  name: process.env.SITE_NAME ?? "Passo Shopping",
  domain: process.env.SITE_DOMAIN ?? "shopping.passoagency.com",
  url: process.env.SITE_URL ?? "https://shopping.passoagency.com",
  country: "GB",
  currency: "GBP",
};

export const company = {
  legalName: "Passo Agency Ltd",
  number: "17208051",
  registeredIn: "England and Wales",
  address: ["5 Croftway", "York", "YO26 5LU", "United Kingdom"],
  contactEmail: process.env.CONTACT_EMAIL ?? "shopping@passoagency.com",
  // Never the founder's personal mobile. Leave unset unless a business line exists.
  contactPhone: process.env.CONTACT_PHONE ?? "",
  parentSite: "https://passoagency.com",
};

export const rules = {
  // Google's minimum is 50 distinct merchant domains per country. We aim higher.
  merchantsRequired: 50,
  merchantsTarget: Number(process.env.MERCHANTS_TARGET ?? 60),
  // An offer not seen in a feed for this long is hidden.
  offerMaxAgeHours: 48,
  // Products that must show two or more merchants for the comparison check to pass.
  comparableProductsTarget: Number(process.env.COMPARABLE_TARGET ?? 50),
  pageSize: 24,
};
