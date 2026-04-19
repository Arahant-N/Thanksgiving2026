import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE, getExpectedPassword, isPasswordConfigured } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");

  if (!isPasswordConfigured() || password !== getExpectedPassword()) {
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return NextResponse.redirect(new URL("/", request.url));
}
