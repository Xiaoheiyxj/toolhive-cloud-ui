import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function RuntimeErrorState({
  message,
  kind,
}: {
  message: string;
  kind: "unavailable" | "not_found" | "invalid_response";
}) {
  return (
    <Alert variant="destructive" data-testid={`runtime-error-${kind}`}>
      <AlertTitle>
        {kind === "not_found"
          ? "Workload not found"
          : "ToolHive Runtime unavailable"}
      </AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function RuntimeStatusBadge({ status }: { status?: string }) {
  const normalizedStatus = status || "unknown";
  const isHealthy = normalizedStatus === "running";
  return (
    <Badge
      variant={isHealthy ? "default" : "secondary"}
      data-testid="runtime-workload-status"
    >
      {normalizedStatus}
    </Badge>
  );
}

export function RuntimeEmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">No ToolHive workloads</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Start a workload with thv run, then refresh this view.
      </p>
    </div>
  );
}

export function BackToWorkloads() {
  return (
    <Link
      href="/runtime/workloads"
      className="inline-flex h-10 items-center justify-center rounded-md border bg-card px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
    >
      Back to workloads
    </Link>
  );
}
