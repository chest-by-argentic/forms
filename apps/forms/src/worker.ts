import { runWorker } from "../../../packages/chest-client/src/worker.js";
import { invoke } from "./invoke.js";

await runWorker(invoke);
