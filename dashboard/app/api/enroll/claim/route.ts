import { NextResponse } from "next/server";
import { ensureTableExists } from "@/lib/azure";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const client = await ensureTableExists();

    // Find device with this code
    // Note: In a real app with millions of devices, querying by non-key field is slow.
    // For this PoC, we'll scan. Or we could use a secondary index/table.
    // Given the scale, a scan is fine, or we can use OData filter.
    
    const queryOptions = {
      filter: `EnrollmentCode eq '${code}'`
    };

    const iterator = client.listEntities({ queryOptions });
    let targetDevice = null;

    for await (const entity of iterator) {
      targetDevice = entity;
      break; // Assume unique codes
    }

    if (!targetDevice) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    // Update the device
    const updatedEntity = {
      partitionKey: targetDevice.partitionKey as string,
      rowKey: targetDevice.rowKey as string,
      UserEmail: session.user.email,
      UserName: session.user.name,
      IsEnrolled: true,
      EnrollmentCode: "" // Clear the code
    };

    await client.upsertEntity(updatedEntity, "Merge");

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error in enrollment claim:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
