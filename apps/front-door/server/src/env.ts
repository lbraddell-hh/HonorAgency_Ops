export const env = {
  port: Number(process.env.PORT ?? 4123),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://localhost:5432/honoragency_db",
  // Demo default so the MCP endpoint works out of the box; override in real deployments.
  mcpApiKey: process.env.FRONT_DOOR_MCP_API_KEY ?? "hh-front-door-dev-key",
  paperclipApiUrl: process.env.PAPERCLIP_API_URL ?? null,
  paperclipApiKey: process.env.PAPERCLIP_API_KEY ?? null,
  paperclipCompanyId: process.env.PAPERCLIP_COMPANY_ID ?? null,
};
