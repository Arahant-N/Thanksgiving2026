import type { Activity } from "@/types/trip";

const ashevilleActivities: Activity[] = [
  {
    id: "biltmore-estate",
    name: "Biltmore Estate",
    description:
      "The signature Asheville outing: tour the house, gardens, winery, and grounds in one long holiday-season day.",
    costPerPerson: 105,
    area: "Biltmore Village",
    priceNote: "Late-Nov holiday pricing starts around this level",
    imageUrl:
      "https://www.biltmore.com/wp-content/uploads/2022/03/Tab_BiltmoreHouse_Spring_Your-Visit-Includes.jpg",
    websiteUrl: "https://www.biltmore.com/visit/tickets-pricing/",
    includedInBudget: true
  },
  {
    id: "folk-art-center",
    name: "Folk Art Center",
    description:
      "A low-pressure Blue Ridge Parkway stop with Southern Appalachian craft galleries, live demos, and an easy browse for the whole group.",
    costPerPerson: 0,
    area: "Blue Ridge Parkway",
    priceNote: "Free admission; shopping is extra",
    imageUrl: "/activity-posters/folk-art-center.svg",
    websiteUrl: "https://www.blueridgeparkway.org/poi/folk-art-center/",
    includedInBudget: false
  },
  {
    id: "gray-line-trolley",
    name: "Gray Line Hop-On/Hop-Off Trolley",
    description:
      "Low-friction first-day move for the whole group: historic districts, Pack Square, Grove Park, RAD, and downtown stops.",
    costPerPerson: 41,
    area: "Downtown Asheville",
    priceNote: "Adult fare; runs in Nov-Dec except Thanksgiving Day",
    imageUrl: "https://graylineasheville.com/wp-content/uploads/2018/09/0U7B9631-1-300x300.jpg",
    websiteUrl: "https://graylineasheville.com/tours/hop-on-hop-off-tour/",
    includedInBudget: true
  },
  {
    id: "pinball-museum",
    name: "Asheville Pinball Museum",
    description:
      "Easy rainy-day family stop with unlimited play on classic pinball machines and arcade cabinets.",
    costPerPerson: 17,
    area: "Downtown Asheville",
    priceNote: "Flat day pass per player",
    imageUrl: "https://img1.wsimg.com/isteam/ip/b5d89622-f631-413f-9b1e-b83eded5bc2e/APM%20pic%202024.jpg",
    websiteUrl: "https://ashevillepinball.com/",
    includedInBudget: true
  },
  {
    id: "asheville-museum-of-science",
    name: "Asheville Museum of Science",
    description:
      "Strong rainy-day option for families with younger kids, with hands-on exhibits that still keep the older cousins occupied for a shorter visit.",
    costPerPerson: 12,
    area: "Downtown Asheville",
    priceNote: "General admission is currently listed at $11.50 per person",
    imageUrl: "/activity-posters/amos.svg",
    websiteUrl: "https://ashevillescience.org/visit/",
    includedInBudget: false
  },
  {
    id: "wnc-nature-center",
    name: "WNC Nature Center",
    description:
      "Kid-friendly Appalachian wildlife stop with red pandas, otters, wolves, and a lighter half-day commitment.",
    costPerPerson: 14,
    area: "East Asheville",
    priceNote: "Rounded from current adult ticket price",
    imageUrl: "https://wildwnc.org/wp-content/uploads/2025/11/donkey.jpg",
    websiteUrl: "https://wildwnc.org/plan-your-visit/",
    includedInBudget: true
  },
  {
    id: "river-arts-district",
    name: "River Arts District Stroll",
    description:
      "Walk studio corridors, browse working artist spaces, and keep one flex block in the trip that is creative and low-pressure.",
    costPerPerson: 0,
    area: "River Arts District",
    priceNote: "Free to wander; workshops and shopping are extra",
    imageUrl: "https://www.riverartsdistrict.com/wp-content/uploads/2024/05/RAD-Overview.jpg",
    websiteUrl: "https://www.riverartsdistrict.com/overview/",
    includedInBudget: true
  },
  {
    id: "blue-ridge-parkway",
    name: "Blue Ridge Parkway Scenic Overlook Run",
    description:
      "The classic Asheville mountain move: pick a short overlook loop, stop for photos, and keep the day flexible.",
    costPerPerson: 0,
    area: "Blue Ridge Parkway",
    priceNote: "No entrance fee; check current road status before heading out",
    imageUrl:
      "https://www.nps.gov/common/uploads/cropped_image/primary/B65742D6-FA8C-446C-668530D5757C814F.jpg?mode=crop&quality=90&width=1600",
    websiteUrl: "https://www.nps.gov/places/mills-river-overlook.htm",
    includedInBudget: true
  },
  {
    id: "asheville-treetops-adventure-park",
    name: "Asheville Treetops Adventure Park",
    description:
      "A real high-energy option for the teens and braver adults: ropes, aerial obstacles, and zip elements close to downtown.",
    costPerPerson: 59,
    area: "West Asheville",
    priceNote: "2026 base price for ages 4+ is listed at $59 before fees",
    imageUrl: "/activity-posters/treetops.svg",
    websiteUrl: "https://ashevilletreetopsadventurepark.com/asheville-treetops-adventure-park/",
    includedInBudget: false
  },
  {
    id: "chimney-rock-state-park",
    name: "Chimney Rock State Park",
    description:
      "The bigger mountain-view day trip option if the group wants a classic Western North Carolina panorama beyond central Asheville.",
    costPerPerson: 17,
    area: "Chimney Rock",
    priceNote: "Adult 1-day admission is currently listed at $17; timed reservation recommended",
    imageUrl: "/activity-posters/chimney-rock.svg",
    websiteUrl: "https://www.chimneyrockpark.com/info-and-tickets/",
    includedInBudget: false
  }
];

const featuredActivitiesByDestination: Record<string, Activity[]> = {
  asheville: ashevilleActivities
};

export function getFeaturedActivities(destinationId: string) {
  return featuredActivitiesByDestination[destinationId] || [];
}

export const featuredActivities = getFeaturedActivities("asheville");
