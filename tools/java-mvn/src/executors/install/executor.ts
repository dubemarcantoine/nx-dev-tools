import { InstallExecutorSchema } from './schema'
import {logger, Tree} from "@nrwl/devkit";
import {execSync} from "child_process";

type NormalizedSchema = InstallExecutorSchema

const normalizeOptions = (options: InstallExecutorSchema): NormalizedSchema => {
  return {
    root: options.root,
    args: options.args ?? [],
  };
}

export default async function runExecutor(options: InstallExecutorSchema) {
  const normalizedOptions = normalizeOptions(options);

  const command = `mvn install ${normalizedOptions.args}`;

  try {
    logger.info(`Executing command: ${command}`);
    execSync(command, {
      cwd: options.root,
      stdio: [0, 1, 2],
      maxBuffer: 1024*1024*1024 }
    );

    return { success: true };
  } catch (e) {
    logger.error(`Failed to execute command: ${command}`);
    logger.error(e);
    return { success: false };
  }

}
