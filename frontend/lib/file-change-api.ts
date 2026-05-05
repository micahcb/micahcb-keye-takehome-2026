export type FileChangePayload = {
  file_path: string
  change_id?: string
  reason?: string
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_FILE_CHANGE_API_BASE_URL ?? "http://localhost:8000"

async function postRoute(route: string, payload: FileChangePayload) {
  const response = await fetch(`${API_BASE_URL}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status}): ${JSON.stringify(data)}`,
    )
  }

  return data
}

async function getRoute(route: string, query: Record<string, string>) {
  const searchParams = new URLSearchParams(query).toString()
  const response = await fetch(`${API_BASE_URL}${route}?${searchParams}`, {
    method: "GET",
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status}): ${JSON.stringify(data)}`,
    )
  }

  return data
}

export function addFile(payload: FileChangePayload) {
  return postRoute("/add-file", payload)
}

export function acceptChange(payload: FileChangePayload) {
  return postRoute("/accept-change", payload)
}

export function revertChange(payload: FileChangePayload) {
  return postRoute("/revert-change", payload)
}

export function denyChange(payload: FileChangePayload) {
  return postRoute("/deny-change", payload)
}

export function getFile(filePath: string) {
  return getRoute("/get-file", { file_path: filePath })
}
