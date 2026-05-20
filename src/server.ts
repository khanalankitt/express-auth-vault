import app from "./app";
import prisma from "./config/db";
import env from "./config/env";

async function start() {
  try {
    await prisma.$connect();
    console.log("[db] database connected ✅");
  } catch (err) {
    console.error("[db] failed to connect to database", err);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[server] listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received, shutting down...`);

    server.close(async () => {
      try {
        await prisma.$disconnect();
      } catch (err) {
        console.error("[server] error disconnecting prisma", err);
      }
      console.log("[server] graceful shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("[server] forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException", err);
});

start();
