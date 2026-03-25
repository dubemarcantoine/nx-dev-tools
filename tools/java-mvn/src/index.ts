import { ProjectGraph } from '@nx/devkit'; // Removed unused imports
import { readProjectJson, readNxJson } from "@nx-dev-tools/core";
import { readPomInFolder } from "./core/pom";

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
  context: any
): ProjectGraph => {
  const nxJsonConf = readNxJson();

  if (!nxJsonConf.pluginsConfig || !nxJsonConf.pluginsConfig['@nx-dev-tools/java-mvn']) {
    return graph;
  }

  const parentRoot = nxJsonConf.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-project-folder'] as string;
  const parentPomFolder = nxJsonConf.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-folder'] as string;

  const parentPom = readPomInFolder(parentPomFolder);
  const parentGroupId = parentPom.project.groupId;

  const accumulator: { [artifact: string]: Project } = {};
  buildProjectTree(graph, parentRoot, parentPomFolder, null, parentGroupId, accumulator);

  for (const [, project] of Object.entries(accumulator)) {
    if (!Array.isArray(project?.dependencies)) {
      let dependency = project.dependencies;
      if (dependency?.groupId === '${project.groupId}') {
        dependency.groupId = parentGroupId;
      }
      const matchingProject = accumulator[`${dependency?.groupId}:${dependency?.artifactId}`];
      if (matchingProject) {
        graph.dependencies[project.projectName] ??= [];
        graph.dependencies[project.projectName].push({
          type: 'implicit',
          source: project.projectName,
          target: matchingProject.projectName,
        });
      }
    } else {
      for (let dependency of project.dependencies) {
        if (dependency?.groupId === '${project.groupId}') {
          dependency.groupId = parentGroupId;
        }
        const matchingProject = accumulator[`${dependency?.groupId}:${dependency?.artifactId}`];
        if (matchingProject) {
          graph.dependencies[project.projectName] ??= [];
          graph.dependencies[project.projectName].push({
            type: 'implicit',
            source: project.projectName,
            target: matchingProject.projectName,
          });
        }
      }
    }
  }
  return graph;
};

export const buildProjectTree = (
  graph: ProjectGraph,
  basePath: string,
  pomPath: string,
  parent: any,
  parentGroupId: string,
  accumulator: { [artifact: string]: Project }
) => {
  const nxJsonConf = readNxJson();

  if (parent) {
    basePath = `${nxJsonConf.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-folder']}/${basePath}`;
    pomPath = `${nxJsonConf.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-folder']}/${pomPath}`;
  }

  const project = readProjectJson(basePath);
  const pom = readPomInFolder(pomPath);

  if (parent) {
    graph.dependencies[parent.name] ??= [];
    graph.dependencies[parent.name].push({
      type: 'implicit',
      source: parent.name,
      target: project.name,
    });
  }

  accumulator[`${parentGroupId}:${pom.project.artifactId}`] = {
    projectName: project.name,
    dependencies: pom.project?.dependencies?.dependency,
  };

  if (pom.project.modules && !Array.isArray(pom.project?.modules?.module)) {
    pom.project.modules.module = [pom.project?.modules?.module];
  }

  pom.project?.modules?.module?.forEach(module => {
    buildProjectTree(graph, module, module, project, parentGroupId, accumulator);
  });
};

