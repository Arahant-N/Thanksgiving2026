import { getAuthSession } from "@/auth";
import { Dashboard } from "@/components/dashboard";
import { getDestinationOptions } from "@/data/config";
import { defaultDestinationId, isKnownDestinationId } from "@/data/destinations";
import { loadDashboardData } from "@/lib/data";
import {
  getAuthenticatedVoter,
  getLeadingProperty,
  getTripVoteId,
  isAllowedVoterEmail,
  isGoogleVotingConfigured,
  isVotingStorageReady,
  listLodgingVotes
} from "@/lib/voting";

type HomePageProps = {
  searchParams?: Promise<{
    city?: string;
    voteSaved?: string;
    voteAuth?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedDestinationId = isKnownDestinationId(params?.city) ? params?.city : defaultDestinationId;
  const destinationOptions = getDestinationOptions();
  const data = await loadDashboardData(selectedDestinationId);
  const session = await getAuthSession();
  const voter = getAuthenticatedVoter(session);
  const lodgingVotes = await listLodgingVotes(getTripVoteId(data.trip), data.trip.destinationId);
  const viewerVote =
    voter ? lodgingVotes.find((vote) => vote.voterId === voter.googleSub) ?? null : null;
  const leadingVote = getLeadingProperty(data.properties, lodgingVotes);
  const returnTo = params?.city ? `/?city=${params.city}` : "/";
  const voteMessage =
    params?.voteSaved === "1"
      ? "Your lodging pick is saved."
      : params?.voteAuth === "signin"
        ? "Sign in with Google to cast a lodging vote."
        : params?.voteAuth === "blocked"
          ? "That Google account is not on the approved voter list."
          : params?.voteAuth === "missing"
            ? "Google voting is not configured yet."
            : params?.voteAuth === "storage"
              ? "Vote storage is not configured for production yet."
              : null;

  return (
    <Dashboard
      {...data}
      destinationOptions={destinationOptions}
      selectedDestinationId={selectedDestinationId}
      returnTo={returnTo}
      lodgingVotes={lodgingVotes}
      viewerVote={viewerVote}
      viewerVoter={voter ? { ...voter, isAllowed: isAllowedVoterEmail(voter.email) } : null}
      leadingVote={leadingVote}
      googleVotingConfigured={isGoogleVotingConfigured()}
      votingStorageReady={isVotingStorageReady()}
      voteMessage={voteMessage}
    />
  );
}
