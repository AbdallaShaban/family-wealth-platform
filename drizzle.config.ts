import { defineConfig } from "drizzle-kit";

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

if (connectionString.includes("tidbcloud.com") && !connectionString.includes("ssl=")) {
  const separator = connectionString.includes("?") ? "&" : "?";
  connectionString += `${separator}ssl={"rejectUnauthorized":true}`;
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
