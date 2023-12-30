import {DockerImageTag} from "@locationtourismeestrie/core";

export interface DeployExecutorSchema {
    namespace: string;
    specPath: string;
    forcePatch?: boolean;
    imageTag?: string | DockerImageTag;
}

