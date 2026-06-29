import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const userEmail = req.headers.get("x-user-email");
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized: Missing user email header" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { organization: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user.organization.brandConfig || null);
  } catch (error) {
    console.error("GET brand-settings error:", error);
    return NextResponse.json({ error: "Failed to fetch brand settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userEmail = req.headers.get("x-user-email");
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized: Missing user email header" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { organization: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();

    const updatedOrg = await prisma.organization.update({
      where: { id: user.organizationId },
      data: { brandConfig: body }
    });

    return NextResponse.json(updatedOrg.brandConfig);
  } catch (error) {
    console.error("PATCH brand-settings error:", error);
    return NextResponse.json({ error: "Failed to update brand settings" }, { status: 500 });
  }
}
