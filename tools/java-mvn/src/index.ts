import {
  logger,
  ProjectConfiguration,
  ProjectGraph,
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';
import {XMLParser} from "fast-xml-parser";
import * as fs from "fs";
import {NxJsonConfiguration} from "nx/src/config/nx-json";

// TODO: Use functions from core. Issue right now with imports after build...
export const readProjectJson = (path: string): ProjectConfiguration => {
  return JSON.parse(getFileContents(`${path}/project.json`));
}

export const readNxJson = (): NxJsonConfiguration => {
  return JSON.parse(getFileContents(`nx.json`));
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

  const nxJsonConf = readNxJson();

  const parentRoot = nxJsonConf.pluginsConfig['nx-dev-tools/dist/tools/java-mvn']['parent-pom-project-folder'];
  const parentPomFolder = nxJsonConf.pluginsConfig['nx-dev-tools/dist/tools/java-mvn']['parent-pom-folder'];

  const parentPom = readPom(parentPomFolder);
  const parentGroupId = parentPom.project.groupId;

  const accumulator: { [artifact: string]: Project } = {};
  buildProjectTree(builder, parentRoot, parentPomFolder, null, parentGroupId, accumulator);

  Object.entries(accumulator).forEach(([, project]) => {
    if (!Array.isArray(project?.dependencies)) {
      if (project?.dependencies?.groupId === '${project.groupId}') {
        project.dependencies.groupId = parentGroupId;
      }

      const matchingProject = accumulator[`${project?.dependencies?.groupId}:${project?.dependencies?.artifactId}`];
      if (matchingProject) {
        builder.addImplicitDependency(project.projectName, matchingProject.projectName);
      }
    } else {
      (project as any)?.dependencies?.forEach(dependency => {
        if (dependency?.groupId === '${project.groupId}') {
          dependency.groupId = parentGroupId;
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

export const buildProjectTree = (builder: ProjectGraphBuilder, path: string, pomPath: string, parent: ProjectConfiguration, parentGroupId: string, accumulator: { [artifact: string]: Project }) => {
  let project = undefined;

  project = readProjectJson(path);

  let pom = readPom(pomPath);

  if (parent) {
    builder.addImplicitDependency(project.name, parent.name);
  }

  accumulator[`${parentGroupId}:${pom.project.artifactId}`] = {
    projectName: project.name,
    dependencies: pom.project?.dependencies?.dependency,
  };

  if (pom.project.modules && !Array.isArray(pom.project?.modules?.module)) {
    pom.project.modules.module = [pom.project?.modules?.module];
  }

  pom.project?.modules?.module?.forEach(module => {
    buildProjectTree(builder, module, module, project, parentGroupId, accumulator);
  });
}

const readPom = (path: string): any => {
  return parser.parse(getFileContents(`${path}/pom.xml`));
}
