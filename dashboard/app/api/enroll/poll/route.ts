import { NextResponse } from "next/server";
import { ensureTableExists } from "@/lib/azure";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serialNumber, hostname, enrollmentCode, osBuild } = body;

    if (!serialNumber || !enrollmentCode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await ensureTableExists();
    
    // Check if device exists
    try {
      const existing = await client.getEntity("SERC", serialNumber);
      
      if (existing.IsEnrolled) {
        return NextResponse.json({ 
          status: "enrolled",
          userEmail: existing.UserEmail,
          userName: existing.UserName
        });
      }
    } catch (error: any) {
      if (error.statusCode !== 404) throw error;
    }

    // Update or Create with pending status
    const entity = {
      partitionKey: "SERC",
      rowKey: serialNumber,
      Hostname: hostname,
      OSBuild: osBuild || "Unknown",
      EnrollmentCode: enrollmentCode,
      IsEnrolled: false,
      LastSeen: new Date(),
      ComplianceStatus: "{}" // Empty until enrolled
    };

    await client.upsertEntity(entity, "Merge");

    return NextResponse.json({ status: "pending" });

  } catch (error) {
    console.error("Error in enrollment poll:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
