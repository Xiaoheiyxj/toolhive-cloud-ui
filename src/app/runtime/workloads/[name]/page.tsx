import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import {
  getRuntimeWorkload,
  getRuntimeWorkloadStatus,
  listRuntimeWorkloads,
} from "@/lib/toolhive-runtime";
import { RuntimeErrorState } from "../../components/runtime-states";
import { RuntimeWorkloadDetailView } from "../../components/runtime-workload-detail";

interface RuntimeWorkloadDetailPageProps {
  params: Promise<{ name: string }>;
}

async function findWorkloadWithCanonicalUrl(name: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await listRuntimeWorkloads();
    if (result.ok) {
      const workload = result.data.find((candidate) => candidate.name === name);
      if (workload?.url) return workload;
    }
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return undefined;
}

export default async function RuntimeWorkloadDetailPage({
  params,
}: RuntimeWorkloadDetailPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/signin");
  }

  const { name } = await params;
  const [detailResult, statusResult, listResult] = await Promise.all([
    getRuntimeWorkload(name),
    getRuntimeWorkloadStatus(name),
    listRuntimeWorkloads(),
  ]);

  if (!detailResult.ok) {
    return (
      <RuntimeErrorState
        kind={detailResult.kind}
        message={detailResult.message}
      />
    );
  }

  const initialWorkload = listResult.ok
    ? listResult.data.find((candidate) => candidate.name === name)
    : undefined;
  const workload = initialWorkload?.url
    ? initialWorkload
    : await findWorkloadWithCanonicalUrl(name);
  const status = statusResult.ok ? statusResult.data : workload?.status;

  return (
    <RuntimeWorkloadDetailView
      workload={workload}
      detail={detailResult.data}
      status={status}
    />
  );
}
