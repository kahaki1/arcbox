import { app } from "./app.js";
import { circleConfigured, config, mcpUrl, publicUrl } from "./config.js";

app.listen(config.port, () => {
  console.log(`Onix listening on ${config.publicUrl}`);
  console.log(`MCP endpoint: ${mcpUrl.href}`);
  console.log(`Circle configured: ${circleConfigured()}`);
  if (publicUrl.protocol !== "https:" && publicUrl.hostname !== "localhost") {
    console.warn("PUBLIC_URL is not HTTPS. ChatGPT OAuth requires a public HTTPS origin.");
  }
});
