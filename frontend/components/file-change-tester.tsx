"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  acceptChange,
  addFile,
  denyChange,
  getFile,
  revertChange,
  type FileChangePayload,
} from "@/lib/file-change-api"

type RouteName =
  | "add-file"
  | "accept-change"
  | "revert-change"
  | "deny-change"
  | "get-file"

type RouteConfig = {
  key: RouteName
  label: string
  run: (payload: FileChangePayload) => Promise<unknown>
}

const ROUTES: RouteConfig[] = [
  { key: "add-file", label: "Add File", run: addFile },
  { key: "accept-change", label: "Accept Change", run: acceptChange },
  { key: "revert-change", label: "Revert Change", run: revertChange },
  { key: "deny-change", label: "Deny Change", run: denyChange },
  { key: "get-file", label: "Get File", run: (payload) => getFile(payload.file_path) },
]

export function FileChangeTester() {
  const [loadingRoute, setLoadingRoute] = useState<RouteName | null>(null)
  const [responseText, setResponseText] = useState<string>("No response yet.")

  const payload = useMemo<FileChangePayload>(
    () => ({
      file_path: "sample/test.txt",
      change_id: "change-123",
      reason: "Testing route from frontend",
    }),
    [],
  )

  const callRoute = async (route: RouteConfig) => {
    try {
      setLoadingRoute(route.key)
      const data = await route.run(payload)
      setResponseText(JSON.stringify(data, null, 2))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown request error"
      setResponseText(message)
    } finally {
      setLoadingRoute(null)
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">File Change Route Tester</h1>
      <p className="text-sm text-muted-foreground">
        Buttons call the backend on <code>/add-file</code>,{" "}
        <code>/accept-change</code>, <code>/revert-change</code>, and{" "}
        <code>/deny-change</code>, plus <code>/get-file</code>.
      </p>

      <div className="flex flex-wrap gap-2">
        {ROUTES.map((route) => (
          <Button
            key={route.key}
            size="sm"
            onClick={() => callRoute(route)}
            disabled={loadingRoute !== null}
          >
            {loadingRoute === route.key ? "Loading..." : route.label}
          </Button>
        ))}
      </div>

      <div className="rounded-none border bg-muted/30 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Response
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
          {responseText}
        </pre>
      </div>
    </div>
  )
}
