export interface EmailDocumentTypeDef {
  id: string;
  label: string;
  description: string;
  defaultSubject: string;
  /**
   * Sample merge-field values shown as starter `{{key}}` tokens in the
   * designer's text/heading/button blocks, so an admin can see how a field
   * renders without needing a real send on hand. The field names here are
   * the contract a future "Send" action must fill with real data.
   */
  sampleInput: Record<string, string>;
}

export const EMAIL_DOCUMENT_TYPES: EmailDocumentTypeDef[] = [
  {
    id: "team_invitation",
    label: "Team Invitation",
    description: "Sent when an admin invites a new agent or admin to the agency.",
    defaultSubject: "You've been invited to join {{agencyName}}",
    sampleInput: {
      recipientName: "Jane Agent",
      role: "Agent",
      agencyName: "Dream Supreme Properties",
      inviteUrl: "https://app.dreamsupreme.co.za/register?token=abc123",
    },
  },
  {
    id: "deal_notification",
    label: "Deal Notification",
    description: "Sent to admins when a deal event occurs (registered, cancelled, stage change).",
    defaultSubject: "{{eventSubject}}",
    sampleInput: {
      eventSubject: "🎉 Deal Registered & Closed: DSP-2026-00001",
      eventBody:
        "Deal for property at 150 Frikkie De Beer St has been registered and closed. Final sale price: R2,500,000.00",
      dealLink: "https://admin.dreamsupreme.co.za/deals/123",
    },
  },
  {
    id: "daily_notification_digest",
    label: "Daily Notification Digest",
    description: "Sent once a day to users who opted into digest (rather than realtime) delivery.",
    defaultSubject: "Daily Digest - Dream Supreme Properties",
    sampleInput: {
      recipientName: "Alex Agent",
      digestCount: "5",
      notificationsUrl: "https://app.dreamsupreme.co.za/notifications",
    },
  },
  {
    id: "password_reset",
    label: "Password Reset",
    description: "Sent when someone requests a password reset link from the login page.",
    defaultSubject: "Reset your Dream Supreme Properties password",
    sampleInput: {
      recipientName: "Jane Agent",
      resetUrl: "https://app.dreamsupreme.co.za/reset-password#access_token=...",
    },
  },
];

export function getEmailDocumentType(id: string | undefined): EmailDocumentTypeDef | undefined {
  return EMAIL_DOCUMENT_TYPES.find((doc) => doc.id === id);
}
