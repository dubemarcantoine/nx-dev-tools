import {ProjectType} from "@nrwl/workspace";

export interface ProjectGeneratorSchema {
    name: string;
    groupId: string;
    artifactId: string;
    version: string;
    tags?: string;
    directory?: string;

    projectType: ProjectType;
}
