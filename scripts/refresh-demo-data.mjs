import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "data", "generated");

const files = {
  "properties.json": [
    {
      id: "prop-01",
      title: "Blue Ridge Grand Lodge",
      source: "Vrbo",
      bedrooms: 8,
      bathrooms: 8,
      sleeps: 24,
      nightlyRate: 1450,
      totalStayPrice: 5800,
      rating: 4.7,
      reviewCount: 38,
      distanceToDowntownMiles: 5.1,
      highlights: ["Mountain views", "Large kitchen", "Game room"],
      url: "https://www.vrbo.com/search/keywords:Asheville--North-Carolina--United-States-of-America"
    },
    {
      id: "prop-02",
      title: "Haw Creek Estate Retreat",
      source: "Airbnb",
      bedrooms: 8,
      bathrooms: 8,
      sleeps: 20,
      nightlyRate: 1585,
      totalStayPrice: 6340,
      rating: 4.8,
      reviewCount: 51,
      distanceToDowntownMiles: 4.3,
      highlights: ["Two living rooms", "Firepit", "Kid-friendly"],
      url: "https://www.airbnb.com/s/Asheville--NC/homes"
    }
  ],
  "flights.json": [
    {
      id: "flt-01",
      familyId: "kumaran",
      cabin: "Economy",
      stops: "1-stop",
      totalPrice: 1460,
      perTravelerPrice: 365,
      carrierLabel: "Delta + American",
      durationLabel: "6h 35m",
      departSummary: "DTW -> AVL, Wed Nov 25",
      returnSummary: "AVL -> DTW, Sun Nov 29",
      bookingUrl: "https://www.google.com/travel/flights",
      sourceLabel: "Google Flights"
    },
    {
      id: "flt-11",
      familyId: "venkatesan-ii",
      cabin: "Economy",
      stops: "Nonstop",
      totalPrice: 1320,
      perTravelerPrice: 330,
      carrierLabel: "Allegiant / American mix",
      durationLabel: "2h 01m",
      departSummary: "ORD -> AVL, Wed Nov 25",
      returnSummary: "AVL -> ORD, Sun Nov 29",
      bookingUrl: "https://www.google.com/travel/flights",
      sourceLabel: "Google Flights"
    }
  ],
  "restaurants.json": [
    {
      id: "rest-01",
      name: "Mela Indian Restaurant",
      rating: 4.6,
      reviewCount: 816,
      priceTier: "$$",
      cuisineTags: ["North Indian", "South Indian", "Buffet"],
      distanceMiles: 0.4,
      neighborhood: "Downtown Asheville",
      websiteUrl: "https://melaasheville.com/",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Mela+Indian+Restaurant+Asheville",
      notes: "Strong group dinner candidate with broad menu coverage."
    },
    {
      id: "rest-02",
      name: "Laila Asheville",
      rating: 4.7,
      reviewCount: 310,
      priceTier: "$$",
      cuisineTags: ["Modern Indian", "Lunch Buffet"],
      distanceMiles: 0.6,
      neighborhood: "Central Asheville",
      websiteUrl: "https://www.lailaasheville.com/",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Laila+Asheville",
      notes: "Stylish dining room and flexible menu for mixed spice preferences."
    }
  ]
};

await mkdir(generatedDir, { recursive: true });

await Promise.all(
  Object.entries(files).map(async ([filename, data]) => {
    const target = path.join(generatedDir, filename);

    try {
      await access(target);
      return;
    } catch {
      await writeFile(target, JSON.stringify(data, null, 2));
    }
  })
);

console.log("Demo data ensured.");
