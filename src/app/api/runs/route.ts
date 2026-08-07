import { runRequestSchema, type RunSnapshot } from "@/domain/run";

function invalidRequest(): Response {
  return Response.json(
    {
      error: {
        code: "invalid_request",
        message: "Enter an app name or describe the kind of app you need.",
      },
    },
    { status: 400 },
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }

  const parsed = runRequestSchema.safeParse(body);

  if (!parsed.success) {
    return invalidRequest();
  }

  const run: RunSnapshot = {
    id: crypto.randomUUID(),
    query: parsed.data.query,
    state: "resolving",
    createdAt: new Date().toISOString(),
  };

  return Response.json(run, { status: 201 });
}
