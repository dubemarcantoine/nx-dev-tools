import { InstallExecutorSchema } from './schema'
import {executeCommand} from "../../core/command";

export default async function runExecutor(options: InstallExecutorSchema) {
  return executeCommand('install', options);
}
