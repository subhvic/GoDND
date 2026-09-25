/**
 * Selection options for the wizard.
 *
 * These belong in `regions` and `taxonomy_terms` in Postgres (see
 * 0002_experiences.sql) and will be fetched once the database is provisioned.
 * They live here meanwhile so the forms are complete and reviewable, and the
 * shape — {value, label} — is what the query will return.
 */

export const REGION_OPTIONS = [
  { value: "assam", label: "Assam" },
  { value: "meghalaya", label: "Meghalaya" },
  { value: "arunachal-pradesh", label: "Arunachal Pradesh" },
  { value: "nagaland", label: "Nagaland" },
  { value: "manipur", label: "Manipur" },
  { value: "mizoram", label: "Mizoram" },
  { value: "tripura", label: "Tripura" },
  { value: "sikkim", label: "Sikkim" },
];

export const CATEGORY_OPTIONS = [
  { value: "adventure", label: "Adventure" },
  { value: "backpacking", label: "Backpacking" },
  { value: "culture-heritage", label: "Culture & Heritage" },
  { value: "wildlife", label: "Wildlife" },
  { value: "wellness", label: "Wellness" },
  { value: "food", label: "Food & Culinary" },
  { value: "photography", label: "Photography" },
];

export const LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "assamese", label: "Assamese" },
  { value: "bengali", label: "Bengali" },
  { value: "khasi", label: "Khasi" },
  { value: "nepali", label: "Nepali" },
];

export const ACTIVITY_OPTIONS = [
  { value: "rafting", label: "Rafting" },
  { value: "camping", label: "Camping" },
  { value: "biking", label: "Biking" },
  { value: "swimming", label: "Swimming" },
  { value: "trekking", label: "Trekking" },
  { value: "caving", label: "Caving" },
  { value: "kayaking", label: "Kayaking" },
  { value: "birdwatching", label: "Bird watching" },
];

export const CREW_OPTIONS = [
  { value: "madhurjyoti-saikia", label: "Madhurjyoti Saikia (Driver)" },
  { value: "dipendu-dey", label: "Dipendu Dey" },
  { value: "rohit-sangha", label: "Rohit Sangha" },
  { value: "mayur-bhramha", label: "Mayur Bhramha" },
  { value: "anjali-rai", label: "Anjali Rai" },
];

export const INCLUSION_OPTIONS = [
  { value: "breakfast-partial", label: "Breakfast (Partial)" },
  { value: "ac-car", label: "AC Car" },
  { value: "all-meals", label: "All Meals" },
  { value: "accommodation", label: "Accommodation" },
  { value: "guide", label: "Certified Guide" },
  { value: "permits", label: "Permits (ILP)" },
  { value: "first-aid", label: "First Aid Kit" },
];

export const EXCLUSION_OPTIONS = [
  { value: "elephant-falls-tickets", label: "Tickets to Elephant Falls" },
  { value: "dawki-river-ride", label: "Tickets to Dawki River Ride" },
  { value: "flights", label: "Flights" },
  { value: "personal-expenses", label: "Personal Expenses" },
  { value: "travel-insurance", label: "Travel Insurance" },
  { value: "alcohol", label: "Alcoholic Beverages" },
];

export const ACCESSIBILITY_OPTIONS = [
  { value: "wheelchair-accessible", label: "Wheelchair accessible" },
  { value: "transport-wheelchair", label: "Transportation is wheelchair accessible" },
  { value: "service-animals", label: "Service animals allowed" },
  { value: "surfaces-wheelchair", label: "Surfaces are wheelchair accessible" },
  { value: "near-public-transport", label: "Near public transportation" },
];

export const ADDITIONAL_INFO_OPTIONS = [
  { value: "confirmation-at-booking", label: "Confirmation will be received at time of booking" },
  { value: "under-21", label: "Not recommended for individuals traveling with persons under 21 years old" },
  { value: "pregnant", label: "Not recommended for pregnant travellers" },
  {
    value: "weather-dependent",
    label:
      "This experience requires good weather. If it's cancelled due to poor weather, you'll be offered a different date or a full refund",
  },
  { value: "most-travellers", label: "Most travellers can participate" },
  {
    value: "minimum-travellers",
    label:
      "This experience requires a minimum number of travellers. If it's cancelled because the minimum isn't met, you'll be offered a different date/experience or a full refund",
  },
  {
    value: "moderate-pace",
    label:
      "Not recommended for individuals that cannot walk at a moderate pace for a minimum of 0.7 miles",
  },
  { value: "max-travellers", label: "This tour/activity will have a maximum of 12 travellers" },
  {
    value: "standing-3-hours",
    label:
      "Not recommended for individuals that cannot stand for a period of up to 3 hours",
  },
];

export const ACTIVITY_KIND_OPTIONS = [
  { value: "stop_location", label: "Stop Location" },
  { value: "stay", label: "Stay / Overnight" },
  { value: "meal", label: "Meal" },
  { value: "transfer", label: "Transfer" },
  { value: "trek", label: "Trek" },
  { value: "activity", label: "Activity" },
  { value: "free_time", label: "Free Time" },
];

export const STOPPAGE_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240].map((mins) => ({
  value: String(mins),
  label: mins >= 60 ? `${mins / 60} hr${mins >= 120 ? "s" : ""}` : `${mins} mins`,
}));

