import {DockerMetadata} from "@locationtourismeestrie/core";

export interface BuildExecutorSchema {
    context: string;
    file: string;
    metadata: DockerMetadata;
    push: boolean;
}
