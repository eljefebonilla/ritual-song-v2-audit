/**
 * Invoice Tool — MCP-style tool server for musician history + invoices
 * Ref: DESIGN-SPEC-v2.md 11.11
 *
 * Tool handlers:
 * - invoice.queryHistory: Fetch booking history with filters
 * - invoice.generateInvoice: Build invoice data from history entries
 */

import type { ToolDefinition } from "@/runtime/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  HistoryEntry,
  HistoryQueryArgs,
  InvoiceData,
  InvoiceLineItem,
  GenerateInvoiceArgs,
} from "./types";

export type { HistoryEntry, InvoiceData, InvoiceLineItem } from "./types";

export function createInvoiceTools(): ToolDefinition[] {
  return [
    {
      name: "invoice.queryHistory",
      description:
        "Query a musician's booking history with date range, ensemble, and event type filters. Returns all confirmed/expected slots.",
      permissionLevel: "allow",
      handler: async (args) => {
        const typedArgs = args as unknown as HistoryQueryArgs;
        return queryHistory(typedArgs);
      },
    },
    {
      name: "invoice.generateInvoice",
      description:
        "Generate invoice data from a musician's booking history. Calculates line items and totals using the musician's agreed-upon pay rate.",
      permissionLevel: "prompt",
      handler: async (args) => {
        const typedArgs = args as unknown as GenerateInvoiceArgs;
        return generateInvoice(typedArgs);
      },
    },
  ];
}

async function queryHistory(args: HistoryQueryArgs): Promise<HistoryEntry[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("booking_slots")
    .select(`
      id,
      confirmation,
      is_recurring,
      role_label_override,
      instrument_detail,
      notes,
      mass_event:mass_events!inner(
        id, event_date, start_time_12h, event_type,
        community, celebrant, liturgical_name, season, has_music
      ),
      ministry_role:ministry_roles!inner(id, name)
    `)
    .eq("profile_id", args.profileId)
    .not("confirmation", "eq", "declined");

  if (args.from) {
    query = query.gte("mass_events.event_date", args.from);
  }
  if (args.to) {
    query = query.lte("mass_events.event_date", args.to);
  }
  if (args.ensemble) {
    query = query.eq("mass_events.community", args.ensemble);
  }
  if (args.eventType) {
    query = query.eq("mass_events.event_type", args.eventType);
  }
  if (args.roleId) {
    query = query.eq("ministry_role_id", args.roleId);
  }

  const { data, error } = await query.order("mass_events(event_date)", { ascending: false });

  if (error) throw new Error(`History query failed: ${error.message}`);

  return (data || []).map((row) => {
    const me = row.mass_event as unknown as Record<string, unknown>;
    const mr = row.ministry_role as unknown as Record<string, unknown>;
    return {
      slotId: row.id,
      massEventId: me.id as string,
      eventDate: me.event_date as string,
      startTime12h: me.start_time_12h as string | null,
      eventType: me.event_type as string,
      ensemble: me.community as string | null,
      celebrant: me.celebrant as string | null,
      liturgicalName: me.liturgical_name as string | null,
      season: me.season as string | null,
      roleName: mr.name as string,
      roleId: mr.id as string,
      roleLabelOverride: row.role_label_override,
      instrumentDetail: row.instrument_detail,
      confirmation: row.confirmation,
      isRecurring: row.is_recurring,
      slotNotes: row.notes,
    };
  });
}

async function generateInvoice(args: GenerateInvoiceArgs): Promise<InvoiceData> {
  const supabase = createAdminClient();

  // Get musician profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, pay_rate_per_mass, payment_notes")
    .eq("id", args.profileId)
    .single();

  if (!profile) throw new Error("Musician profile not found");

  const rate = args.customRate ?? profile.pay_rate_per_mass ?? 0;

  // Get history for the period
  const history = await queryHistory({
    profileId: args.profileId,
    from: args.from,
    to: args.to,
  });

  const lineItems: InvoiceLineItem[] = history.map((entry) => {
    const parts = [entry.liturgicalName, entry.ensemble, entry.roleName].filter(Boolean);
    return {
      date: entry.eventDate,
      time: entry.startTime12h,
      description: parts.join(" — "),
      role: entry.roleLabelOverride || entry.roleName,
      rate,
    };
  });

  return {
    musicianName: profile.full_name,
    musicianEmail: profile.email,
    musicianPhone: profile.phone,
    periodFrom: args.from,
    periodTo: args.to,
    payRatePerMass: rate,
    lineItems,
    subtotal: lineItems.length * rate,
    paymentNotes: profile.payment_notes,
    generatedAt: new Date().toISOString(),
  };
}
