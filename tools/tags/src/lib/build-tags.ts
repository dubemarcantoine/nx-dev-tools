import {DockerImageTag, DockerMetadata} from "./docker-metadata";

const patternRegex = /(?<=\{\{)(.+?)(?=}})/g;

export const buildTags = (metadata: DockerMetadata): string[] => {
    return metadata.tags?.map(tag => buildTag(tag));
}

export const buildTag = (tag: DockerImageTag | string): string => {
    if (typeof tag === 'string') {
        return tag;
    }

    let tagName = tag.pattern;

    const tagVariableKeys = tag.pattern.match(patternRegex);

    tagVariableKeys.forEach(key => {
        const envVarValue = process.env[key];
        if (!envVarValue) {
            throw new Error(`The environment variable ${key} is missing`);
        }

        tagName = tagName.replace(`{{${key}}}`, envVarValue);
    });

    return tagName;
}
