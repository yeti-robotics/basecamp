import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";


config({ path: "../../.env" });

if(!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in the environment variables.");
    }



export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});