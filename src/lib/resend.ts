import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Missing RESEND_API_KEY");
    _client = new Resend(key);
  }
  return _client;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<string | null> {
  const client = getClient();
  const from = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";
  const { data, error } = await client.emails.send({ from, to, subject, html });
  if (error) {
    console.error("Resend error:", error);
    return null;
  }
  return data?.id ?? null;
}
