import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { listRuntimeWorkloads } from "@/lib/toolhive-runtime";
import { RuntimeErrorState } from "../components/runtime-states";
import { RuntimeWorkloadList } from "../components/runtime-workload-list";

export default async function RuntimeWorkloadsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/signin");
  }

  const result = await listRuntimeWorkloads();
  if (!result.ok) {
    return <RuntimeErrorState kind={result.kind} message={result.message} />;
  }
  return <RuntimeWorkloadList workloads={result.data} />;
}
