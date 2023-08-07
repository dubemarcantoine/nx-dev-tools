import {DockerImageTag} from "@locationtourismeestrie/core";

export interface DeployExecutorSchema {
    namespace: string;
    specPath: string;
    imageTag?: string | DockerImageTag;
}

