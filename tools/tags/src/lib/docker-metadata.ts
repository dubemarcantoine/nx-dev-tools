export interface DockerMetadata {
    images: string[];
    tags: Array<string | DockerImageTag>;
}

export interface DockerImageTag {
    pattern: string;
}
