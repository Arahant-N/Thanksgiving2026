import { NextResponse } from "next/server";

import { getAuthSession } from "@/auth";
import { getTripConfig } from "@/data/config";
import {
  getAuthenticatedVoter,
  getTripVoteId,
  isAllowedVoterEmail,
  isVotingStorageReady,
  saveLodgingVote
} from "@/lib/voting";

function withStatus(returnTo: string, key: string, value: string) {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}${key}=${value}`;
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const voter = getAuthenticatedVoter(session);
  const formData = await request.formData();
  const returnTo = String(formData.get("returnTo") ?? "/");

  if (!voter) {
    return NextResponse.redirect(new URL(withStatus(returnTo, "voteAuth", "signin"), request.url), {
      status: 303
    });
  }

  if (!isAllowedVoterEmail(voter.email)) {
    return NextResponse.redirect(new URL(withStatus(returnTo, "voteAuth", "blocked"), request.url), {
      status: 303
    });
  }

  if (!isVotingStorageReady()) {
    return NextResponse.redirect(new URL(withStatus(returnTo, "voteAuth", "storage"), request.url), {
      status: 303
    });
  }

  const destinationId = String(formData.get("destinationId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");

  if (!destinationId || !propertyId) {
    return NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
  }

  const trip = getTripConfig(destinationId);
  const now = new Date().toISOString();

  await saveLodgingVote({
    tripId: getTripVoteId(trip),
    destinationId: trip.destinationId,
    propertyId,
    voterId: voter.googleSub,
    voterEmail: voter.email,
    voterName: voter.name,
    createdAt: now,
    updatedAt: now
  });

  return NextResponse.redirect(
    new URL(`${withStatus(returnTo, "voteSaved", "1")}#stay-shortlist`, request.url),
    {
      status: 303
    }
  );
}
