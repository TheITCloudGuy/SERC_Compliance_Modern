import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true";
const tableName = "DeviceCompliance";

export const getTableClient = () => {
  return TableClient.fromConnectionString(connectionString, tableName);
};

export const ensureTableExists = async () => {
  const client = getTableClient();
  try {
    await client.createTable();
  } catch (error: any) {
    if (error.statusCode === 409) {
      // Table already exists
    } else {
      throw error;
    }
  }
  return client;
};
