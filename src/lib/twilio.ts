import twilio from "twilio";

// Lazy singleton — only created when first called
let _client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("Missing Twilio credentials");
    _client = twilio(sid, token);
  }
  return _client;
}

export async function sendSMS(to: string, body: string): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    to,
    body,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || undefined,
    from: process.env.TWILIO_MESSAGING_SERVICE_SID
      ? undefined
      : process.env.TWILIO_PHONE_NUMBER,
  });
  return message.sid;
}

// Validate incoming Twilio webhook signature
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  return twilio.validateRequest(token, signature, url, params);
}
