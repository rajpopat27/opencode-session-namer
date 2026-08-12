import { execFile } from "node:child_process"
import type { Plugin } from "@opencode-ai/plugin"

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, encoding: "utf8", timeout: 5000 }, (err, stdout) => {
      if (err) return reject(err)
      resolve(stdout.trim())
    })
  })
}

async function worktreeName(cwd: string): Promise<string | undefined> {
  try {
    const branch = await git(cwd, ["branch", "--show-current"])
    if (branch) return branch
  } catch {
    return undefined
  }
  return undefined
}

export const NameSessionsPlugin: Plugin = async ({ client, directory }) => {
  const named = new Set<string>()

  const isIdle = (event: any) =>
    event?.type === "session.idle" ||
    (event?.type === "session.status" && event?.properties?.status?.type === "idle")

  return {
    event: async ({ event }: { event: any }) => {
      if (!isIdle(event)) return
      const sessionID: string | undefined = event?.properties?.sessionID
      if (!sessionID || named.has(sessionID)) return

      if (!directory) return
      const branch = await worktreeName(directory)
      if (!branch) return

      try {
        const messages = await client.session.messages({ path: { id: sessionID } })
        const lastAssistant = (messages.data ?? [])
          .filter((m: any) => m.info?.role === "assistant")
          .pop()
        const agent: string | undefined = lastAssistant?.info?.mode
        if (!agent) return

        await client.session.update({
          path: { id: sessionID },
          body: { title: `${branch} · ${agent}` },
        })
        named.add(sessionID)
      } catch (err) {
      }
    },
  }
}

export default NameSessionsPlugin
