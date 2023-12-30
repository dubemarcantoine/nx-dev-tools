import {DockerImageTag} from "@locationtourismeestrie/core";

export interface DeployExecutorSchema {
    namespace: string;
    specPath: string;
    simpleApply?: boolean;
    imageTag?: string | DockerImageTag;
}

