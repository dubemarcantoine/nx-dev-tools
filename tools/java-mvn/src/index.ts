import {
  logger,
  ProjectConfiguration,
  ProjectGraph,
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';
import {XMLParser} from "fast-xml-parser";
import * as fs from "fs";

// TODO: Use functions from core. Issue right now with imports after build...
export const readProjectJson = (path: string): ProjectConfiguration => {
  return JSON.parse(getFileContents(`${path}/project.json`));
}

export const getFileContents = (path: string): string => {
  return fs.readFileSync(path, {encoding: 'utf8', flag: 'r'});
}

const parser = new XMLParser();

interface Project {
  projectName: string;
  dependencies: JavaDependency | JavaDependency[];
}

interface JavaDependency {
  artifactId: string;
  groupId: string;
}

export const processProjectGraph = (
  graph: ProjectGraph,
  context: ProjectGraphProcessorContext
): ProjectGraph => {
  const builder = new ProjectGraphBuilder(graph);
  const parentRoot = 'libs/backend/lte-parent';

  const accumulator: { [artifact: string]: Project } = {};
  buildProjectTree(builder, parentRoot, null, null, accumulator);

  Object.entries(accumulator).forEach(([, project]) => {
    if (!Array.isArray(project?.dependencies)) {
      if (project?.dependencies?.groupId === '${project.groupId}') {
        // TODO: Do not hardcode, get parent groupid
        logger.info(project?.dependencies?.groupId)
        project.dependencies.groupId = 'ca.tourismeestrie';
      }

      const matchingProject = accumulator[`${project?.dependencies?.groupId}:${project?.dependencies?.artifactId}`];
      if (matchingProject) {
        builder.addImplicitDependency(project.projectName, matchingProject.projectName);
      }
    } else {
      (project as any)?.dependencies?.forEach(dependency => {
        if (dependency?.groupId === '${project.groupId}') {
          // TODO: Do not hardcode, get parent groupid
          dependency.groupId = 'ca.tourismeestrie';
        }

        const matchingProject = accumulator[`${dependency?.groupId}:${dependency?.artifactId}`];
        if (matchingProject) {
          builder.addImplicitDependency(project.projectName, matchingProject.projectName);
        }
      })
    }
  });

  return builder.getUpdatedProjectGraph();
}

export const buildProjectTree = (builder: ProjectGraphBuilder, path: string, parent: ProjectConfiguration, parentGroupId: string, accumulator: { [artifact: string]: Project }) => {
  const project = readProjectJson(path);

  let pom = readPom(path);

  if (parent) {
    builder.addImplicitDependency(project.name, parent.name);
  }

  if (!parentGroupId) {
    parentGroupId = pom.project.groupId;
  }

  accumulator[`${parentGroupId}:${pom.project.artifactId}`] = {
    projectName: project.name,
    dependencies: pom.project?.dependencies?.dependency,
  };

  pom.project?.modules?.module?.forEach(module => {
    buildProjectTree(builder, `${path}/${module}`, project, parentGroupId, accumulator);
  });
}

const readPom = (path: string): any => {
  return parser.parse(getFileContents(`${path}/pom.xml`));
}
