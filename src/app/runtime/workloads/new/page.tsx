import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/header-page";
import { auth } from "@/lib/auth/auth";
import { RuntimeCreateForm } from "../../components/runtime-create-form";
import { BackToWorkloads } from "../../components/runtime-states";

export default async function NewRuntimeWorkloadPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/signin");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Create Runtime Workload">
        <BackToWorkloads />
      </PageHeader>
      <RuntimeCreateForm />
    </div>
  );
}
