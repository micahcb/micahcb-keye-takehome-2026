

import { UploadPanel } from "@/components/upload-panel"


export default async function Page() {

  return (
    <div className="min-h-svh">
      <main className="mx-auto flex w-full max-w-3xl px-6 py-16">
        <UploadPanel/>
      </main>
    </div>
  )
}
