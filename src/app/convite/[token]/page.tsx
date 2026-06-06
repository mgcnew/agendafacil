import { createClient } from "@/lib/supabase/server";
import { InviteAccept } from "./InviteAccept";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invite", { p_token: token });
  const invite = Array.isArray(data) && data.length ? data[0] : null;

  return <InviteAccept token={token} invite={invite} />;
}
