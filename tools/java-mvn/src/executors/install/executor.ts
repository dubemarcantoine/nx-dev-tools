import { CleanExecutorSchema } from './schema'
import {executeCommand} from "../../core/command";

export default async function runExecutor(options: CleanExecutorSchema) {
  return executeCommand('clean', options);
}
