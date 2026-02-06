"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { backendApiClient, type GroupSavingsGoal } from "@/lib/services/backendApiService";
import { useActiveAccount } from "thirdweb/react";
import { GoalInviteView, LoadingView, ProcessingView, ErrorView } from "@/components/common";
import { useChain } from "@/components/ChainProvider";

export default function GoalInvitePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  const { chain } = useChain();
  const metaGoalId = params.metaGoalId as string;
  const inviterAddress = searchParams.get('inviter');
  const inviteToken = searchParams.get('invite');

  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const processInvite = async () => {
      if (!account?.address || !inviteToken || joining) return;

      setJoining(true);
      try {
        await backendApiClient.acceptGroupGoalInvite({
          metaGoalId,
          inviteToken,
          invitedAddress: account.address,
          chainId: chain?.id,
          chain: chain?.name,
        });
        router.push(`/?join=${metaGoalId}`);
      } catch (err) {
        console.error('Failed to process invite:', err);
        router.push(`/?join=${metaGoalId}`);
      } finally {
        setJoining(false);
      }
    };

    processInvite();
  }, [account?.address, inviteToken, metaGoalId, router, joining, chain?.id, chain?.name]);

  if (!account?.address) {
    return (
      <GoalInviteView 
        goal={{ metaGoalId, name: "Group Savings Goal" } as GroupSavingsGoal} 
        isAuthenticated={false}
        inviterAddress={inviterAddress || undefined}
      />
    );
  }

  if (joining) {
    return (
      <ProcessingView
        title="Processing Invite"
        message="Please wait while we add you to the goal..."
      />
    );
  }

  return null;
}
