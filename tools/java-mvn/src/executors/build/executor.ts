import { BuildExecutorSchema } from './schema';
import {executeCommand} from "../../core/command";

export default async function runExecutor(options: BuildExecutorSchema) {
  return executeCommand('package', options);
}
