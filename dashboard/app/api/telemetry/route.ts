import { NextResponse } from "next/server";
import { ensureTableExists } from "@/lib/azure";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hostname, serialNumber, osBuild, checks, userEmail, userName, azureAdDeviceId, joinType } = body;

    if (!hostname || !serialNumber || !checks) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const isCompliant = 
      checks.bitlocker && 
      checks.firewall && 
      checks.secureBoot && 
      checks.tpm && 
      checks.antivirus;

    const entity: any = {
      partitionKey: "SERC",
      rowKey: serialNumber,
      Hostname: hostname,
      OSBuild: osBuild || "Unknown",
      LastSeen: new Date(),
      ComplianceStatus: JSON.stringify(checks),
      IsCompliant: isCompliant,
      IsEnrolled: true,
      // Explicitly requested fields
      FullName: userName,
      Username: userEmail,
      Bitlocker: checks.bitlocker,
      Firewall: checks.firewall,
      TPM: checks.tpm,
      SecureBoot: checks.secureBoot,
      Antivirus: checks.antivirus
    };

    if (userEmail && userEmail !== "Unknown") {
      entity.UserEmail = userEmail;
    }

    if (userName && userName !== "Unknown") {
      entity.UserName = userName;
    }

    if (azureAdDeviceId) {
      entity.AzureAdDeviceId = azureAdDeviceId;
    }

    if (joinType) {
      entity.JoinType = joinType;
    }

    const client = await ensureTableExists();
    await client.upsertEntity(entity, "Merge");

    return NextResponse.json({ success: true, isCompliant });
  } catch (error) {
    console.error("Error processing telemetry:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    const client = await ensureTableExists();
    const entities = [];
    
    // Filter by UserEmail if provided, and ensure only enrolled devices are returned
    let filter = "IsEnrolled eq true";
    if (email) {
      filter = `UserEmail eq '${email}' and IsEnrolled eq true`;
    }

    const queryOptions = { filter };

    const iterator = client.listEntities({ queryOptions });

    for await (const entity of iterator) {
      entities.push(entity);
    }

    return NextResponse.json(entities);
  } catch (error) {
    console.error("Error fetching telemetry:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partitionKey = searchParams.get("partitionKey");
    const rowKey = searchParams.get("rowKey");

    if (!partitionKey || !rowKey) {
      return NextResponse.json({ error: "Missing partitionKey or rowKey" }, { status: 400 });
    }

    const client = await ensureTableExists();
    await client.deleteEntity(partitionKey, rowKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting device:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
