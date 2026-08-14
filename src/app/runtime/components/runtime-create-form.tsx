"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  RuntimeCreateResponse,
  RuntimeResult,
  RuntimeWorkloadCreateRequest,
} from "@/lib/toolhive-runtime";

type Mode = "container" | "remote";

function splitLines(value: string): string[] | undefined {
  const values = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export function RuntimeCreateForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("container");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [commandArguments, setCommandArguments] = useState("");
  const [volumes, setVolumes] = useState("");
  const [disableNetworkIsolation, setDisableNetworkIsolation] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const request: RuntimeWorkloadCreateRequest =
      mode === "container"
        ? {
            mode,
            name: name.trim(),
            image: image.trim(),
            transport: "stdio",
            cmd_arguments: splitLines(commandArguments),
            volumes: splitLines(volumes),
            ...(disableNetworkIsolation ? { network_isolation: false } : {}),
          }
        : {
            mode,
            name: name.trim(),
            url: url.trim(),
            transport: "streamable-http",
          };

    startTransition(async () => {
      let result: RuntimeResult<RuntimeCreateResponse>;
      try {
        const response = await fetch("/api/runtime/workloads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        result =
          (await response.json()) as RuntimeResult<RuntimeCreateResponse>;
      } catch {
        setError("Cloud UI could not reach its Runtime create endpoint.");
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/runtime/workloads/${encodeURIComponent(result.data.name)}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-2xl rounded-xl border bg-card p-6 shadow-xs"
      data-testid="runtime-create-form"
    >
      <div
        className="mb-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Workload type"
      >
        <Button
          type="button"
          variant={mode === "container" ? "default" : "outline"}
          onClick={() => setMode("container")}
          aria-selected={mode === "container"}
          role="tab"
        >
          Container MCP
        </Button>
        <Button
          type="button"
          variant={mode === "remote" ? "default" : "outline"}
          onClick={() => setMode("remote")}
          aria-selected={mode === "remote"}
          role="tab"
        >
          Remote MCP
        </Button>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <label
            htmlFor="runtime-workload-name"
            className="text-sm font-medium"
          >
            Workload name
          </label>
          <Input
            id="runtime-workload-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="my-mcp"
            required
          />
        </div>

        {mode === "container" ? (
          <>
            <div className="grid gap-2">
              <label
                htmlFor="runtime-container-image"
                className="text-sm font-medium"
              >
                Container image
              </label>
              <Input
                id="runtime-container-image"
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="docker.io/mcp/filesystem:1.0.2"
                required
              />
              <p className="text-xs text-muted-foreground">
                ToolHive will run this image with the stdio transport.
              </p>
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="runtime-command-arguments"
                className="text-sm font-medium"
              >
                Command arguments (optional, one per line)
              </label>
              <Textarea
                id="runtime-command-arguments"
                value={commandArguments}
                onChange={(event) => setCommandArguments(event.target.value)}
                placeholder="/projects"
                rows={3}
              />
            </div>
            <label className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={disableNetworkIsolation}
                onChange={(event) =>
                  setDisableNetworkIsolation(event.target.checked)
                }
                className="mt-1"
              />
              <span>
                <span className="font-medium">Disable network isolation</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Explicitly sends ToolHive&apos;s native
                  network_isolation=false option when selected.
                </span>
              </span>
            </label>
            <div className="grid gap-2">
              <label htmlFor="runtime-volumes" className="text-sm font-medium">
                Volume mounts (optional, one per line)
              </label>
              <Textarea
                id="runtime-volumes"
                value={volumes}
                onChange={(event) => setVolumes(event.target.value)}
                placeholder="/tmp:/projects:ro"
                rows={3}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <label htmlFor="runtime-remote-url" className="text-sm font-medium">
              Remote MCP URL
            </label>
            <Input
              id="runtime-remote-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://mcp.example.com/mcp"
              required
            />
            <p className="text-xs text-muted-foreground">
              ToolHive will proxy this existing streamable HTTP MCP endpoint.
            </p>
          </div>
        )}

        {error && (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
            data-testid="runtime-create-error"
          >
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create workload"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/runtime/workloads")}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
