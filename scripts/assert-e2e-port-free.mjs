import net from "node:net";

const baseUrl = new URL(process.env.BASE_URL || "http://localhost:3000");
const port = Number(baseUrl.port || (baseUrl.protocol === "https:" ? 443 : 80));
const host = baseUrl.hostname === "localhost" ? "127.0.0.1" : baseUrl.hostname;

await new Promise((resolve, reject) => {
  const socket = net.createConnection({ host, port });
  socket.once("connect", () => {
    socket.destroy();
    reject(
      new Error(
        `E2E port ${baseUrl.origin} is already occupied; refusing to reuse an uncontrolled server.`,
      ),
    );
  });
  socket.once("error", (error) => {
    socket.destroy();
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      resolve();
      return;
    }
    reject(error);
  });
});
