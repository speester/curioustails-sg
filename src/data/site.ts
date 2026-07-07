// Mirrors project-config.md. Update both files together.
export const site = {
  businessName: "Curious Tails",
  businessType: "AVS licensed pet shop",
  domain: "https://curioustails.sg",
  phone: "82206480",
  phoneDisplay: "8220 6480",
  whatsapp: "82206480",
  email: "hello@curioustails.sg",
  address: {
    full: "2 Balestier Road #01-701 S320002 Singapore",
    street: "2 Balestier Road #01-701",
    postalCode: "320002",
    city: "Singapore",
    country: "SG",
  },
  hours: "Weekdays 12pm–6pm, Weekends 10am–6pm",
  hoursSpecification: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "12:00", closes: "18:00" },
    { days: ["Saturday", "Sunday"], opens: "10:00", closes: "18:00" },
  ],
  googleMapsEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7977.498996742476!2d103.84101967571235!3d1.3262440616497237!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31da1947eb0c073d%3A0xb4c1905c6481624!2sCurious%20Tails!5e0!3m2!1sen!2ssg!4v1782792386135!5m2!1sen!2ssg",
  gbpUrl:
    "https://www.google.com/search?kgmid=%2Fg%2F11w_rhg9mv&hl=en-SG&q=Curious%20Tails",
  social: {
    instagram: "https://www.instagram.com/curioustails.pups/",
    facebook: "https://www.facebook.com/profile.php?id=61573140013505",
  },
  priceRange: "$2,888–$4,488",
  primaryCta: "WhatsApp us",
  license: {
    // AVS pet shop licence — the number the public verifies on the AVS registry.
    // `number` is the primary displayed licence (AVS). ACRA is the separate
    // company-registration id, kept for legal/footer use, not the AVS licence.
    number: "AS24J00046",
    avsNumber: "AS24J00046",
    acraNumber: "202420075D",
    registryUrl:
      "https://avs.nparks.gov.sg/outreach/resources/public-registry-of-avs-licensed-pet-shops/",
  },
  reviews: {
    count: 41,
    rating: 5.0,
  },
  ga4MeasurementId: "G-S1WGGDQKQ4",
} as const;

export const whatsappLink = (message?: string) => {
  const base = `https://wa.me/65${site.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
