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

  const kc = new KubeConfig();
  kc.loadFromDefault();

  const client = KubernetesObjectApi.makeApiClient(kc);

  const specPaths = [];

  getFiles(specPaths, options.specPath);

  let success = true;

  for (let specPath in specPaths) {
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

        await client.patch(spec, 'true');
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

const getFiles = (filePaths: string[], rootFilePath: string): void => {
  if (!fs.lstatSync(rootFilePath).isDirectory()) {
    filePaths.push(rootFilePath);
  } else {
    const files = fs.readdirSync(rootFilePath, { withFileTypes: true });

    files.forEach(f => {
      getFiles(filePaths, rootFilePath);
    });
  }
}
