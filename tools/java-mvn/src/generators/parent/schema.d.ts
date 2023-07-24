import { ProjectType } from '@nx/workspace';

export interface ProjectGeneratorSchema {
  name: string;
  groupId: string;
  artifactId: string;
  version?: string;
  pomLocation?: string;
  tags?: string;
  directory?: string;

  projectType: ProjectType;
}
