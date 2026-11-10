import { NextResponse, type NextRequest } from "next/server";

/** Basic auth for /internal. With no credentials configured, the area is closed. */
export function middleware(req: NextRequest) {
  const user = process.env.INTERNAL_USER;
  const pass = process.env.INTERNAL_PASSWORD;
  if (!user || !pass) return new NextResponse("Not found", { status: 404 });
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, p] = atob(encoded).split(":");
    if (u === user && p === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Passo Shopping internal"' },
  });
}

export const config = { matcher: ["/internal/:path*"] };
