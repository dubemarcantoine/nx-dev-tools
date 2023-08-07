import {BuildExecutorSchema} from './schema';
import {logger} from "nx/src/utils/logger";
import {execSync} from "child_process";
import {ExecutorContext} from "nx/src/config/misc-interfaces";
import {buildTags, DockerMetadata} from "@nx-dev-tools/tags";

export default async function runExecutor(options: BuildExecutorSchema, ctx?: ExecutorContext ) {
    logger.info(`Docker build executor with ${options}`);

    if (!options.context) {
        options.context = '.';
    }

    if (!options.file) {
        options.file = 'Dockerfile';
    }

    if (!options.metadata.images || options.metadata.images.length === 0) {
        logger.error("The `metadata.images` parameter is required and needs at least one value");
        return {
            success: false,
        };
    }

    const tags = buildImageTagNames(options.metadata);

    execSync(`docker build -f ${options.file} ${tags.map(tag => `--tag=${tag}`).join(' ')} ${options.context}`, {
        stdio: [0, 1, 2],
        maxBuffer: 1024*1024*1024 }
    );

    if (options.push) {
        for (const tag of tags) {
            execSync(`docker push ${tag}`, {
                stdio: [0, 1, 2],
                maxBuffer: 1024*1024*1024 }
            );
        }
    }

    return {
        success: true,
    };
}

const buildImageTagNames = (metadata: DockerMetadata): string[] => {
    const tags = buildTags(metadata);

    return metadata.images.map(image => {
        if (!tags) {
            return image;
        }

        return tags.map(tag => `${image}:${tag}`);
    }).reduce((accumulator, value) => accumulator.concat(value as string), []) as string[];
};
