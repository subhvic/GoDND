/**
 * What the sample workspace's guests wrote.
 *
 * Reviews are the one fixture a reader actually reads, so these are built
 * from the trips the portal already sells rather than from lorem ipsum: a
 * five-star review of the Meghalaya week names the root bridges and the
 * homestay, and a two-star one names the weather that closed the road.
 * Variety comes from combining a frame with a detail, so a few dozen
 * phrases cover a couple of thousand reviews without repeating a sentence
 * every screenful.
 */

const FIRST_NAMES = [
  "Priya", "Karan", "Neha", "Meera", "Aarav", "Ritu", "Sandeep", "Ananya", "Vikram", "Sneha",
  "Rahul", "Divya", "Arjun", "Kavya", "Nikhil", "Pooja", "Siddharth", "Tanvi", "Rohan", "Ishita",
  "Manish", "Shruti", "Abhishek", "Lakshmi", "Gaurav", "Deepa", "Varun", "Anjali", "Harsh", "Swati",
];

const LAST_NAMES = [
  "Sengupta", "Bose", "Kulkarni", "Iyer", "Nair", "Sharma", "Mehta", "Reddy", "Chatterjee", "Banerjee",
  "Desai", "Pillai", "Joshi", "Rao", "Menon", "Gupta", "Verma", "Saxena", "Bhattacharya", "Krishnan",
];

/** What went right, by experience — named things, not adjectives. */
const HIGHLIGHTS: Record<string, string[]> = {
  "demo-1": [
    "the walk down to the double-decker root bridge, which our captain paced so we stopped where we wanted rather than where the schedule said",
    "two nights in a Nongriat homestay where the food was better than anything we ate in Shillong",
    "swimming at Rainbow Falls before the day crowd arrived",
    "the drive out to Dawki, where we were on the water by eight and had it almost to ourselves",
  ],
  "demo-2": [
    "riding out of Ziro with a support van that turned up exactly where it said it would",
    "camping above the valley on the second night, which none of us expected to be the high point",
    "our permits being sorted before we landed, so we rode on day one instead of queuing",
    "the mechanic who rebuilt a derailleur by torchlight and had us moving by seven",
  ],
  "demo-3": [
    "the Siang running high enough to be properly exciting without anyone feeling out of their depth",
    "a safety briefing that treated us like adults and was still the most thorough I've had",
    "the riverside camp, where the crew cooked over a fire and nobody touched their phone",
    "swapping the raft for bicycles on day six, which broke up the trip perfectly",
  ],
  "demo-4": [
    "how little of it was scheduled — we were asked each morning what we felt like",
    "a village lunch that wasn't on any itinerary and was the thing we still talk about",
    "getting to the living root bridge before anybody else was on the path",
  ],
  "demo-7": [
    "a dawn safari where we saw rhino inside twenty minutes",
    "the naturalist, who could name everything and never made us feel slow for asking",
    "an elephant grass drive at last light that felt like the whole reason to come",
  ],
};

/** What went wrong. The first four can happen on any trip. */
const GRIPES = [
  "the Guwahati leg took five hours in traffic and ate most of a day",
  "the hotel on the first night was a clear step below the rest of the trip",
  "there were two more people in the group than we'd been told to expect",
  "messages before the trip took a day or two to get answered",
];

const GRIPES_BY_EXPERIENCE: Record<string, string[]> = {
  "demo-1": ["rain closed the Nongriat path and we lost the root bridge day entirely"],
  "demo-2": ["a permit check held us up for half a day and nobody had warned us it was likely"],
  "demo-3": ["the water was too high to run the section we'd booked for, so we did a tamer stretch"],
  "demo-4": ["so little was fixed that some days drifted, which won't suit everyone"],
  "demo-7": ["we did three safaris and saw very little on two of them"],
};

const TITLES: Record<number, string[]> = {
  5: [
    "Worth every rupee",
    "Still talking about it",
    "The best trip we've taken",
    "Our captain made it",
    "Exactly what we'd hoped for",
    "Go before everyone finds it",
  ],
  4: [
    "Very good, with one flat day",
    "Would book again",
    "Great trip, small niggles",
    "Nearly perfect",
    "Strong trip, honest review",
  ],
  3: [
    "Good in parts",
    "Fine, not memorable",
    "Half of it was excellent",
    "Mixed — read the detail",
  ],
  2: [
    "Not what was sold to us",
    "Disappointing for the price",
    "Too much went wrong",
  ],
  1: [
    "Wouldn't book again",
    "Badly handled",
  ],
};

export function pickName(rand: () => number) {
  const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
  return { first, full: `${first} ${last}` };
}

const choose = <T>(rand: () => number, items: readonly T[]) => items[Math.floor(rand() * items.length)];

/** A review's title and body, built from a frame plus one named detail. */
export function reviewProse(rand: () => number, experienceId: string, rating: number) {
  const highlight = choose(rand, HIGHLIGHTS[experienceId] ?? HIGHLIGHTS["demo-4"]);
  const gripe = choose(rand, [...GRIPES, ...(GRIPES_BY_EXPERIENCE[experienceId] ?? [])]);
  const title = choose(rand, TITLES[rating] ?? TITLES[3]);

  const body =
    rating === 5
      ? `${capitalise(highlight)}. The whole thing was organised without ever feeling packaged, and we were never once left wondering what happened next.`
      : rating === 4
        ? `${capitalise(highlight)}. Not perfect — ${gripe} — but it didn't take much away from the rest.`
        : rating === 3
          ? `${capitalise(highlight)}. Against that, ${gripe}, and for what we paid I'd expect the whole trip to be at the level of its best day.`
          : rating === 2
            ? `${capitalise(gripe)}, and we were told about it far too late to plan around. ${capitalise(highlight)} was genuinely good, which made the rest more frustrating.`
            : `${capitalise(gripe)}. We raised it during the trip and nothing changed, and the reply afterwards didn't really engage with what we'd said.`;

  return { title, body };
}

/** The operator's public reply. It answers the review rather than thanking it. */
export function replyProse(rand: () => number, firstName: string, rating: number) {
  if (rating >= 4) {
    return choose(rand, [
      `Thank you ${firstName} — I've passed this on to the crew, who will be very pleased. Come back in the dry months and we'll show you the stretch we didn't have time for.`,
      `Glad it landed, ${firstName}. Thank you for taking the time to write it — reviews like this are how people find us.`,
      `Thanks ${firstName}. Noted on what could have been better; we've already moved that leg earlier in the day for future groups.`,
    ]);
  }
  if (rating === 3) {
    return choose(rand, [
      `Thank you for being straight with us, ${firstName}. You're right that the trip wasn't level throughout, and we're rebuilding that middle section for the coming season.`,
      `Appreciated, ${firstName}. We've taken the point about pacing and have cut one drive out of this itinerary entirely.`,
    ]);
  }
  return choose(rand, [
    `${firstName}, I'm sorry — this isn't the trip we sell. We should have told you far earlier, and I've changed how we brief groups when conditions turn. Please contact us directly; I'd like to put it right.`,
    `This one is on us, ${firstName}. Thank you for setting it out plainly. We've refunded the affected day and the guide has been taken off this route while we retrain.`,
  ]);
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
