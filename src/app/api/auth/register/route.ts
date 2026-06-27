import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password, orgName } = await req.json();

    if (!name || !email || !password || !orgName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // Create organization and user inside a transaction
    const passwordHash = await bcrypt.hash(password, 12);
    
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: orgName }
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "ADMIN", // First user is Admin
          organizationId: organization.id
        }
      });

      return { user, organization };
    });

    return NextResponse.json({
      message: "User registered successfully",
      userId: result.user.id,
      organizationId: result.organization.id
    }, { status: 201 });
  } catch (error) {
    console.error("Registration API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
