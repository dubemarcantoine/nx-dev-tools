import { ProjectType } from '@nx/workspace';

export interface ProjectGeneratorSchema {
  name: string;
  parentPomLocation?: string;
  tags?: string;
  directory?: string;

  resourcesApplicationExtension?: string;

  projectType: ProjectType;
}
