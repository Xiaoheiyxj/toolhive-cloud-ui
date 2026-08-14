import Link from "next/link";
import { PageHeader } from "@/components/header-page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RuntimeWorkload } from "@/lib/toolhive-runtime";
import { RuntimeEmptyState, RuntimeStatusBadge } from "./runtime-states";

function endpointFor(workload: RuntimeWorkload): string {
  if (workload.url) {
    return workload.url;
  }
  if (workload.port) {
    return `http://127.0.0.1:${workload.port}`;
  }
  return "Endpoint unavailable";
}

export function RuntimeWorkloadList({
  workloads,
}: {
  workloads: RuntimeWorkload[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Runtime Workloads">
        <span className="text-sm text-muted-foreground">Read-only</span>
      </PageHeader>
      {workloads.length === 0 ? (
        <RuntimeEmptyState />
      ) : (
        <div
          className="grid gap-4 xl:grid-cols-2"
          data-testid="runtime-workload-list"
        >
          {workloads.map((workload) => (
            <Link
              href={`/runtime/workloads/${encodeURIComponent(workload.name)}`}
              key={workload.name}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{workload.name}</CardTitle>
                    <CardDescription className="mt-2">
                      {workload.package || "ToolHive workload"}
                    </CardDescription>
                  </div>
                  <RuntimeStatusBadge status={workload.status} />
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <div>
                    <span className="font-medium">Proxy endpoint:</span>{" "}
                    <code data-testid="runtime-workload-endpoint">
                      {endpointFor(workload)}
                    </code>
                  </div>
                  <div className="text-muted-foreground">
                    Transport: {workload.transport_type || "unknown"}
                    {workload.proxy_mode ? ` · ${workload.proxy_mode}` : ""}
                  </div>
                  {workload.group && (
                    <div className="text-muted-foreground">
                      Group: {workload.group}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
