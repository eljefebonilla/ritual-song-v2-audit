import { notFound, redirect } from "next/navigation";
import { getSharedView } from "@/lib/shared-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareRootPage({ params }: Props) {
  const { token } = await params;
  const view = await getSharedView(token);
  if (!view) notFound();
  const first = view.config.types[0] || "planner";
  redirect(`/share/${token}/${first}`);
}
