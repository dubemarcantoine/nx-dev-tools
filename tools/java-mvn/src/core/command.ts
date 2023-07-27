import {logger} from "@nrwl/devkit";
import {execSync} from "child_process";
import {MvnExecutorSchema} from "./mvn-executor-schema";

type NormalizedSchema = MvnExecutorSchema

const normalizeOptions = (options: MvnExecutorSchema): NormalizedSchema => {
  return {
    root: options.root,
    args: options.args ?? [],
  };
}

export const executeCommand = (command: string, options: NormalizedSchema) => {
  const normalizedOptions = normalizeOptions(options);

  const fullCommand = `mvn install ${normalizedOptions.args}`;

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
