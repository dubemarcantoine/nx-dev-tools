import { TestExecutorSchema } from './schema'
import {executeCommand} from "../../core/command";

export default async function runExecutor(options: TestExecutorSchema) {
  return executeCommand('test', options);
}
