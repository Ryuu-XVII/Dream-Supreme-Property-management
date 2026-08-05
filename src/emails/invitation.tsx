import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Heading,
} from "@react-email/components";

interface InviteEmailProps {
  name: string;
  role: string;
  inviteUrl: string;
}

export function InvitationEmailTemplate({ name, role, inviteUrl }: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Invitation to join Dream Supreme Properties</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Dream Supreme Properties</Heading>
          <Text style={subheading}>Team Invitation</Text>
          <Hr style={hr} />
          <Text style={paragraph}>Hello {name},</Text>
          <Text style={paragraph}>
            You have been invited to join <strong>Dream Supreme Properties</strong> as an{" "}
            <strong>{role}</strong>.
          </Text>
          <Text style={paragraph}>
            Please click the button below to complete your registration and set up your secure
            account password:
          </Text>
          <Section style={btnContainer}>
            <Button style={button} href={inviteUrl}>
              Complete Account Registration
            </Button>
          </Section>
          <Text style={smallText}>
            If the button above does not work, copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>{inviteUrl}</Text>
          <Hr style={hr} />
          <Text style={footer}>Dream Supreme Property Management • Real Estate Excellence</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  marginBottom: "64px",
  borderRadius: "8px",
  border: "1px solid #e6ebf1",
  maxWidth: "560px",
};

const heading = {
  fontSize: "24px",
  letterSpacing: "-0.5px",
  lineHeight: "1.3",
  fontWeight: "700",
  color: "#0f172a",
  margin: "0 0 4px 0",
};

const subheading = {
  fontSize: "14px",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  fontWeight: "600",
  color: "#64748b",
  margin: "0 0 16px 0",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const paragraph = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px 0",
};

const btnContainer = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const button = {
  backgroundColor: "#1e293b",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 28px",
};

const smallText = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "24px 0 4px 0",
};

const linkText = {
  color: "#2563eb",
  fontSize: "13px",
  wordBreak: "break-all" as const,
};

const footer = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "16px",
  textAlign: "center" as const,
  margin: "16px 0 0 0",
};
