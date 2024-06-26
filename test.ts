import Pocketbase from "pocketbase";
import { createConnection, createQueue } from "./index";

// create this many tasks per second
const tasksPerSecond = 30;

export async function start() {
  if (!process.env.POCKETBASE_EMAIL) {
    throw new Error("POCKETBASE_EMAIL is required");
  }
  if (!process.env.POCKETBASE_PASSWORD) {
    throw new Error("POCKETBASE_PASSWORD is required");
  }

  const pb = new Pocketbase(process.env.POCKETBASE_URL || "http://127.0.0.1:8090");
  await pb.admins.authWithPassword(process.env.POCKETBASE_EMAIL, process.env.POCKETBASE_PASSWORD);
  const connection = createConnection({ pb, verbose: false });

  const greetingQueue = createQueue<{ message: string }>({
    name: "greeting",
    connection,
  });

  const currentTimeQueue = createQueue<{ message: string }>({
    name: "current-time",
    connection,
  });

  process.on("SIGINT", async () => {
    greetingQueue.close();
    currentTimeQueue.close();
    await new Promise((resolve) => setImmediate(resolve));
    console.log("exiting");
    process.exit(0);
  });

  greetingQueue.process({ concurrency: 2 }, async ({ task, workerId }) => {
    console.log(workerId, task.message);
  });

  currentTimeQueue.process({ concurrency: 4 }, async ({ task, workerId }) => {
    const ms = Math.floor(Math.random() * 100);
    await new Promise((resolve) => setTimeout(resolve, ms));
    if (Math.random() < 0.5) {
      throw new Error("random error");
    }
    console.log(workerId, task);
  });

  currentTimeQueue.on("stats", (stats) => {
    console.log("stats", stats);
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000 / tasksPerSecond));
    currentTimeQueue.push({
      task: { message: "current time is " + Date.now() },
    });
    greetingQueue.push({
      task: { message: "hello world" },
    });
  }
}

start();
