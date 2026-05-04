import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const KIE_BASE = "https://api.kie.ai";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "KIE_API_KEY not set" }, { status: 500 });

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `KIE getTask failed: ${res.status} ${text}` }, { status: 502 });
  }

  const data = await res.json();
  const task = data.data ?? data;

  // state field: "success" | "failed" | "processing" | "pending"
  const rawState: string = (task.state ?? task.status ?? "pending").toLowerCase();
  const DONE = ["success", "completed", "finished", "done"];
  const FAIL = ["failed", "error", "cancelled", "canceled"];
  const status = DONE.includes(rawState) ? "completed" : FAIL.includes(rawState) ? "failed" : "pending";

  // resultJson is a JSON string: {"resultUrls":["https://..."]}
  let imageUrl: string | null = null;
  if (task.resultJson) {
    try {
      const parsed = JSON.parse(task.resultJson);
      imageUrl = parsed.resultUrls?.[0] ?? null;
    } catch {
      imageUrl = null;
    }
  }

  return NextResponse.json({ taskId, status, imageUrl });
}
