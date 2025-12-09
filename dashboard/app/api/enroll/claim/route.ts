import { NextResponse } from "next/server";
import { ensureTableExists } from "@/lib/azure";
import { auth } from "@/auth";

export async function POST(request: Request) {
  console.log("[CLAIM] POST /api/enroll/claim called");

  try {
    const session = await auth();
    console.log("[CLAIM] Session:", session?.user?.email || "No session");

    if (!session || !session.user) {
      console.log("[CLAIM] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;
    console.log("[CLAIM] Code received:", code);

    if (!code) {
      console.log("[CLAIM] Missing code in request");
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    console.log("[CLAIM] Connecting to Azure Table...");
    const client = await ensureTableExists();
    console.log("[CLAIM] Connected to Azure Table");

    // Find device with this code
    const queryOptions = {
      filter: `EnrollmentCode eq '${code}'`
    };
    console.log("[CLAIM] Querying with filter:", queryOptions.filter);

    const iterator = client.listEntities({ queryOptions });
    let targetDevice = null;

    for await (const entity of iterator) {
      console.log("[CLAIM] Found device:", entity.rowKey);
      targetDevice = entity;
      break; // Assume unique codes
    }

    if (!targetDevice) {
      console.log("[CLAIM] No device found with code:", code);
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    console.log("[CLAIM] Updating device:", targetDevice.rowKey);

    // Update the device
    const updatedEntity = {
      partitionKey: targetDevice.partitionKey as string,
      rowKey: targetDevice.rowKey as string,
      UserEmail: session.user.email,
      UserName: session.user.name,
      FullName: session.user.name,
      Username: session.user.email,
      IsEnrolled: true,
      EnrollmentCode: "" // Clear the code
    };

    await client.upsertEntity(updatedEntity, "Merge");
    console.log("[CLAIM] Device updated successfully");

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[CLAIM] Error in enrollment claim:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

