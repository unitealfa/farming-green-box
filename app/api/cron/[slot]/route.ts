import type { NextRequest } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Format: "YYYY-MM-DD HH:mm:ss Africa/Algiers"
 */
function stampAlgiers(now = new Date()) {
  const dt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .format(now)
    .replace("T", " ");
  return `${dt} Africa/Algiers`;
}

function dayKeyAlgiers(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

/**
 * MODE=random2or4:
 * - ~1 jour sur 2 => 4 runs (tous les slots)
 * - sinon => 2 runs/jour (une paire choisie de façon déterministe par la date)
 */
function shouldRunSlot(slot: string, mode?: string) {
  if (mode !== "random2or4") return true;

  const day = dayKeyAlgiers();
  const hash = crypto.createHash("sha256").update(day).digest();

  const run4 = hash[0] % 2 === 0;
  if (run4) return true;

  const pairs: string[][] = [
    ["0005", "0600"],
    ["0005", "1200"],
    ["0005", "1900"],
    ["0600", "1200"],
    ["0600", "1900"],
    ["1200", "1900"]
  ];

  const idx = hash[1] % pairs.length;
  return pairs[idx].includes(slot);
}

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function encodePathForContentsApi(path: string) {
  // GitHub Contents API attends "a/b/c.txt" dans l'URL.
  // On encode segment par segment pour éviter les soucis avec %2F.
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

async function ghFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
}

async function getFileContent(opts: {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}): Promise<{ text: string; sha?: string; exists: boolean }> {
  const { token, owner, repo, path, branch } = opts;
  const encodedPath = encodePathForContentsApi(path);
  const refQS = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}${refQS}`;

  const res = await ghFetch(url, token);
  if (res.status === 404) return { text: "", sha: undefined, exists: false };
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET ${res.status}: ${body}`);
  }

  const data: any = await res.json();
  const sha = data.sha as string | undefined;
  const b64 = String(data.content || "").replace(/\n/g, "");
  const text = Buffer.from(b64, "base64").toString("utf8");
  return { text, sha, exists: true };
}

async function putFileContent(opts: {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch?: string;
  message: string;
  contentText: string;
  sha?: string;
}): Promise<void> {
  const { token, owner, repo, path, branch, message, contentText, sha } = opts;
  const encodedPath = encodePathForContentsApi(path);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const payload: any = {
    message,
    content: Buffer.from(contentText, "utf8").toString("base64"),
    committer: {
      name: "vercel-cron-bot",
      email: "vercel-cron-bot@users.noreply.github.com"
    }
  };

  if (branch) payload.branch = branch;
  if (sha) payload.sha = sha;

  const res = await ghFetch(url, token, { method: "PUT", body: JSON.stringify(payload) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub PUT ${res.status}: ${body}`);
  }
}

export async function GET(request: NextRequest, { params }: { params: { slot: string } }) {
  try {
    const authHeader = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const slot = params.slot;
    const mode = process.env.MODE;

    if (!["0005", "0600", "1200", "1900"].includes(slot)) {
      return new Response("Invalid slot", { status: 400 });
    }

    if (!shouldRunSlot(slot, mode)) {
      return Response.json({ ok: true, skipped: true, reason: "mode_random2or4", slot });
    }

    const token = assertEnv("GITHUB_TOKEN");
    const owner = assertEnv("GITHUB_OWNER");
    const repo = assertEnv("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || undefined;
    const filePath = process.env.GITHUB_FILE_PATH || "status.txt";

    const stamp = stampAlgiers(new Date());
    const minutePrefix = stamp.slice(0, 16); // "YYYY-MM-DD HH:mm"

    // Read
    const { text: oldText, sha } = await getFileContent({ token, owner, repo, path: filePath, branch });

    // Anti-doublon (même minute)
    const trimmed = oldText.trimEnd();
    if (trimmed.length > 0) {
      const lastLine = trimmed.split("\n").at(-1) ?? "";
      if (lastLine.startsWith(minutePrefix)) {
        return Response.json({ ok: true, skippedDuplicate: true, slot, stamp });
      }
    }

    const newLine = `${stamp}\n`;
    const updatedText = oldText + newLine;

    // Write with 1 retry on conflict
    const msg = `chore: log time (${slot})`;

    try {
      await putFileContent({
        token,
        owner,
        repo,
        path: filePath,
        branch,
        message: msg,
        contentText: updatedText,
        sha
      });
    } catch (e: any) {
      const m = String(e?.message || e);
      // If SHA conflict, refetch and retry once
      if (m.includes("409")) {
        const fresh = await getFileContent({ token, owner, repo, path: filePath, branch });
        const updated2 = fresh.text + newLine;
        await putFileContent({
          token,
          owner,
          repo,
          path: filePath,
          branch,
          message: msg,
          contentText: updated2,
          sha: fresh.sha
        });
      } else {
        throw e;
      }
    }

    return Response.json({ ok: true, slot, stamp, filePath, mode: mode || "fixed" });
  } catch (err: any) {
    return new Response(`Error: ${String(err?.message || err)}`, { status: 500 });
  }
}
