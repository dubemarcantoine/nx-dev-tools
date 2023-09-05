import {logger} from "@nrwl/devkit";
import {execSync} from "child_process";
import {MvnExecutorSchema} from "./mvn-executor-schema";

interface NormalizedSchema {
  root: string;
  args: string;
}

const normalizeOptions = (options: MvnExecutorSchema): NormalizedSchema => {
  return {
    root: options.root,
    args: options?.args?.join(' ') ?? '',
  };
}

export const executeCommand = (command: string, options: MvnExecutorSchema) => {
  const normalizedOptions = normalizeOptions(options);

  const fullCommand = `mvn ${command} ${normalizedOptions.args}`;

  try {
    logger.info(`Executing command: ${fullCommand}`);
    execSync(fullCommand, {
      cwd: options.root,
      stdio: [0, 1, 2],
      maxBuffer: 1024*1024*1024 }
    );

    return { success: true };
  } catch (e) {
    logger.error(`Failed to execute command: ${fullCommand}`);
    logger.error(e);
    return { success: false };
  }
}
