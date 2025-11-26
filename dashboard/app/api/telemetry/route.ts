import { NextResponse } from "next/server";
import { ensureTableExists } from "@/lib/azure";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hostname, serialNumber, osBuild, checks, userEmail } = body;

    if (!hostname || !serialNumber || !checks) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const isCompliant = 
      checks.bitlocker && 
      checks.firewall && 
      checks.secureBoot && 
      checks.tpm && 
      checks.antivirus;

    const entity = {
      partitionKey: "SERC",
      rowKey: serialNumber,
      Hostname: hostname,
      OSBuild: osBuild || "Unknown",
      UserEmail: userEmail || "Unknown",
      LastSeen: new Date(),
      ComplianceStatus: JSON.stringify(checks),
      IsCompliant: isCompliant,
    };

    const client = await ensureTableExists();
    await client.upsertEntity(entity, "Replace");

    return NextResponse.json({ success: true, isCompliant });
  } catch (error) {
    console.error("Error processing telemetry:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const client = await ensureTableExists();
    const entities = [];
    const iterator = client.listEntities();

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
