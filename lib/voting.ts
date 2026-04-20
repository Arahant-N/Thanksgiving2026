import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Session } from "next-auth";
import { Redis } from "@upstash/redis";

import type { LodgingVote, PropertyListing, TripConfig } from "@/types/trip";

type AuthenticatedVoter = {
  googleSub: string;
  email: string;
  name: string;
};

const votesRoot = path.join(process.cwd(), "data", "generated", "votes");

function isUpstashConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function isGoogleVotingConfigured() {
  return (
    Boolean(process.env.AUTH_SECRET) &&
    Boolean(process.env.AUTH_GOOGLE_ID) &&
    Boolean(process.env.AUTH_GOOGLE_SECRET)
  );
}

export function getVotingStoreMode() {
  if (isUpstashConfigured()) {
    return "upstash";
  }

  if (process.env.NODE_ENV !== "production") {
    return "local";
  }

  return "unconfigured";
}

export function isVotingStorageReady() {
  return getVotingStoreMode() !== "unconfigured";
}

export function getAllowedVoterEmails() {
  return (process.env.ALLOWED_VOTER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedVoterEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  const allowlist = getAllowedVoterEmails();

  if (allowlist.length === 0) {
    return true;
  }

  return allowlist.includes(email.toLowerCase());
}

export function getTripVoteId(trip: TripConfig) {
  return `${trip.destinationId}:${trip.checkInDate}:${trip.checkOutDate}`;
}

export function getAuthenticatedVoter(session: Session | null): AuthenticatedVoter | null {
  const email = session?.user?.email?.trim() || "";
  const name = session?.user?.name?.trim() || "";
  const googleSub = session?.user?.googleSub?.trim() || "";

  if (!email || !googleSub) {
    return null;
  }

  return {
    googleSub,
    email,
    name: name || email
  };
}

function getLocalVoteFile(destinationId: string) {
  return path.join(votesRoot, `${destinationId}.json`);
}

function getVoteIndexKey(tripId: string, destinationId: string) {
  return `lodging-votes:${tripId}:${destinationId}:index`;
}

function getVoteKey(tripId: string, destinationId: string, voterId: string) {
  return `lodging-votes:${tripId}:${destinationId}:${voterId}`;
}

let redisClient: Redis | null = null;

function getRedisClient() {
  if (!isUpstashConfigured()) {
    return null;
  }

  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }

  return redisClient;
}

async function readLocalVotes(destinationId: string) {
  const filePath = getLocalVoteFile(destinationId);

  try {
    const file = await readFile(filePath, "utf8");
    return JSON.parse(file) as LodgingVote[];
  } catch {
    return [];
  }
}

async function writeLocalVotes(destinationId: string, votes: LodgingVote[]) {
  await mkdir(votesRoot, { recursive: true });
  await writeFile(getLocalVoteFile(destinationId), JSON.stringify(votes, null, 2) + "\n", "utf8");
}

async function listUpstashVotes(tripId: string, destinationId: string) {
  const redis = getRedisClient();

  if (!redis) {
    return [];
  }

  const voterIds = (await redis.smembers<string[]>(getVoteIndexKey(tripId, destinationId))) ?? [];
  const votes = await Promise.all(
    voterIds.map((voterId) => redis.get<LodgingVote>(getVoteKey(tripId, destinationId, voterId)))
  );

  return votes.filter((vote): vote is LodgingVote => Boolean(vote));
}

async function saveUpstashVote(vote: LodgingVote) {
  const redis = getRedisClient();

  if (!redis) {
    throw new Error("Upstash Redis is not configured.");
  }

  await redis.set(getVoteKey(vote.tripId, vote.destinationId, vote.voterId), vote);
  await redis.sadd(getVoteIndexKey(vote.tripId, vote.destinationId), vote.voterId);
}

export async function listLodgingVotes(tripId: string, destinationId: string) {
  if (getVotingStoreMode() === "upstash") {
    return listUpstashVotes(tripId, destinationId);
  }

  const votes = await readLocalVotes(destinationId);
  return votes.filter((vote) => vote.tripId === tripId);
}

export async function saveLodgingVote(vote: LodgingVote) {
  if (getVotingStoreMode() === "upstash") {
    await saveUpstashVote(vote);
    return vote;
  }

  if (getVotingStoreMode() !== "local") {
    throw new Error("Voting storage is not configured in production.");
  }

  const votes = await readLocalVotes(vote.destinationId);
  const existingIndex = votes.findIndex(
    (entry) => entry.tripId === vote.tripId && entry.voterId === vote.voterId
  );

  if (existingIndex >= 0) {
    votes[existingIndex] = {
      ...votes[existingIndex],
      propertyId: vote.propertyId,
      voterEmail: vote.voterEmail,
      voterName: vote.voterName,
      updatedAt: vote.updatedAt
    };
  } else {
    votes.push(vote);
  }

  await writeLocalVotes(vote.destinationId, votes);
  return vote;
}

export function countVotesForProperty(votes: LodgingVote[], propertyId: string) {
  return votes.filter((vote) => vote.propertyId === propertyId).length;
}

export function getLeadingProperty(properties: PropertyListing[], votes: LodgingVote[]) {
  const ranked = properties
    .map((property) => ({
      property,
      count: countVotesForProperty(votes, property.id)
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.property.totalStayPrice - right.property.totalStayPrice;
    });

  return ranked[0] ?? null;
}
