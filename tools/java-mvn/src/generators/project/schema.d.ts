import {ProjectType} from "@nrwl/workspace";

export interface ProjectGeneratorSchema {
    name: string;
    tags?: string;
    directory?: string;

    projectType: ProjectType;
}
