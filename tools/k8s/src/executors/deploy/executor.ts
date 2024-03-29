import { DeployExecutorSchema } from './schema';
import {
  KubeConfig,
  KubernetesObject,
  KubernetesObjectApi,
} from '@kubernetes/client-node';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { logger } from '@nx/devkit';
import {buildTag} from "@nx-dev-tools/tags";
import {execSync} from "child_process";

const patchOrCreate = async (options: DeployExecutorSchema) => {
  const kc = new KubeConfig();
  kc.loadFromDefault();

  const client = KubernetesObjectApi.makeApiClient(kc);

  const specPaths = [];

  getFiles(specPaths, options.specPath);

  let success = true;

  for (let specPath of specPaths) {
    logger.info("Parsing file " + specPath);
    const specString = await fs.promises.readFile(specPath);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const specs: KubernetesObject[] = yaml.loadAll(specString);
    const validSpecs = specs.filter((s) => s && s.kind && s.metadata);

    for (const spec of validSpecs) {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await client.read(spec);

        spec.metadata = spec.metadata || {};
        spec.metadata.annotations = spec.metadata.annotations || {};
        delete spec.metadata.annotations[
            'kubectl.kubernetes.io/last-applied-configuration'
            ];
        spec.metadata.annotations[
            'kubectl.kubernetes.io/last-applied-configuration'
            ] = JSON.stringify(spec);

        // Replace image tag
        if (options.imageTag) {
          const tag = buildTag(options.imageTag);

          (spec as any)?.spec?.template?.spec?.containers?.forEach(
              (container) => {
                const tagIndex = container.image.indexOf(':');
                if (tagIndex > -1) {
                  const specTag = container.image.substring(
                      container.image.indexOf(':')
                  );
                  logger.info(
                      `Replacing default tag ${specTag.substring(1)} with ${tag}`
                  );
                  container.image = container.image.replace(specTag, `:${tag}`);
                } else {
                  logger.info(`Setting tag ${tag}`);
                  container.image += `:${tag}`;
                }
              }
          );
        }

        logger.info(
            'Patching for: ' + spec.kind + ' named ' + spec.metadata.name
        );

        await client.patch(spec, 'true', undefined, 'nx-dev-tools');
      } catch (e) {
        try {
          logger.warn('Patch failed, trying create. ' + e);

          if (spec?.metadata?.annotations) {
            delete spec.metadata.annotations['kubectl.kubernetes.io/restartedAt'];
          }

          await client.create(spec, 'true');
        } catch (e) {
          logger.error(e);
          success = false;
        }
      }
    }
  }

  return {
    success,
  };
}

const simpleApply = (options: DeployExecutorSchema) => {
  try {
    execSync(`kubectl apply -f ${options.specPath}`, {
      stdio: [0, 1, 2],
      maxBuffer: 1024*1024*1024 }
    );
  } catch (e) {
    logger.error(e);

    return {
      success: false,
    };
  }

  return {
    success: true,
  };
}

export default async function runExecutor(
  options: DeployExecutorSchema,
  ctx?: ExecutorContext
) {
  logger.info('Starting k8s deploy with args: ' + options);

  if (!options.namespace) {
    logger.error('namespace option is required');

    return {
      success: false,
    };
  }

  if (!options.specPath) {
    logger.error('specPath is required');

    return {
      success: false,
    };
  }

  if (options.simpleApply) {
    return simpleApply(options);
  } else {
    return await patchOrCreate(options);
  }
}

const getFiles = (filePaths: string[], path: string): void => {
  if (!fs.lstatSync(path).isDirectory()) {
    filePaths.push(path);
  } else {
    const files = fs.readdirSync(path, { withFileTypes: true });

    files.forEach(f => {
      if (!path.endsWith('/')) {
        path += '/';
      }
      getFiles(filePaths, path + f.name);
    });
  }
}
