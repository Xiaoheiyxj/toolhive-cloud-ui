import { PageHeader } from "@/components/header-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  RuntimeWorkload,
  RuntimeWorkloadDetail,
} from "@/lib/toolhive-runtime";
import { BackToWorkloads, RuntimeStatusBadge } from "./runtime-states";

function endpointFor(
  workload?: RuntimeWorkload,
  detail?: RuntimeWorkloadDetail,
): string {
  if (workload?.url) {
    return workload.url;
  }
  if (detail?.host && detail.proxy_port) {
    return `http://${detail.host}:${detail.proxy_port}`;
  }
  if (workload?.port) {
    return `http://127.0.0.1:${workload.port}`;
  }
  return "Endpoint unavailable";
}

export function RuntimeWorkloadDetailView({
  workload,
  detail,
  status,
}: {
  workload?: RuntimeWorkload;
  detail: RuntimeWorkloadDetail;
  status?: string;
}) {
  return (
    <div className="flex flex-col gap-6" data-testid="runtime-workload-detail">
      <PageHeader title={workload?.name || detail.name || "Workload detail"}>
        <BackToWorkloads />
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Runtime status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              <RuntimeStatusBadge status={status || workload?.status} />
            </div>
            <div>
              <span className="font-medium">Proxy endpoint:</span>{" "}
              <code data-testid="runtime-detail-endpoint">
                {endpointFor(workload, detail)}
              </code>
            </div>
            <div>
              <span className="font-medium">Transport:</span>{" "}
              {detail.transport || workload?.transport_type || "unknown"}
            </div>
            <div>
              <span className="font-medium">Proxy mode:</span>{" "}
              {detail.proxy_mode || workload?.proxy_mode || "unknown"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workload metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="font-medium">Image:</span>{" "}
              {detail.image || "Unavailable"}
            </div>
            <div>
              <span className="font-medium">Group:</span>{" "}
              {detail.group || workload?.group || "default"}
            </div>
            <div>
              <span className="font-medium">Target port:</span>{" "}
              {detail.target_port || "None"}
            </div>
            <div>
              <span className="font-medium">Network isolation:</span>{" "}
              {detail.network_isolation ? "enabled" : "disabled"}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
