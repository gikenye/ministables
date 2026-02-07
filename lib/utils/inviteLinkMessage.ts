export type InviteLinkAction = "invite-link:create" | "invite-link:revoke";

export function buildInviteLinkMessage(params: {
  metaGoalId: string;
  inviterAddress: string;
  nonce: string;
  issuedAt: string;
  action: InviteLinkAction;
}): string {
  return [
    "Invite link request",
    `action: ${params.action}`,
    `metaGoalId: ${params.metaGoalId}`,
    `inviterAddress: ${params.inviterAddress}`,
    `nonce: ${params.nonce}`,
    `issuedAt: ${params.issuedAt}`,
  ].join("\n");
}
