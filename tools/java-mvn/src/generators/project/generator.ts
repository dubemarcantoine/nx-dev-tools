import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  readNxJson,
  Tree,
} from '@nrwl/devkit';
import * as path from 'path';
import {ProjectGeneratorSchema} from './schema';
import {readPom} from "../../core/pom";
import {XMLBuilder} from "fast-xml-parser";

interface NormalizedSchema extends ProjectGeneratorSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  artifactId: string;
  parsedTags: string[];
  parentArtifactId: string;
  parentGroupId: string;
  parentVersion: string;
  parentRelativePath: string;

  packageDirectory: string;
  packageName: string;
  className: string;
}

const snakeCaseToCamelCase = (artifactId: string): string => {
  return artifactId.replace(/[-_][a-z]/g, (group) => group.slice(-1).toUpperCase())
}

const normalizeOptions = async (tree: Tree, options: ProjectGeneratorSchema): Promise<NormalizedSchema> => {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');

  const root = options.projectType === 'application' ? `${getWorkspaceLayout(tree).appsDir}` : `${getWorkspaceLayout(tree).libsDir}`;

  const projectRoot = `${root}/${projectDirectory}`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const projectType = options.projectType;

  const artifactId = options.name;

  const nxJson = readNxJson(tree);

  let parentPomLocation = options.parentPomLocation;

  if (!parentPomLocation) {
    if (nxJson?.pluginsConfig['@nx-dev-tools/java-mvn']) {
      parentPomLocation = `${nxJson.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-folder']}/pom.xml`;
    }
  }

  const parentPom = readPom(parentPomLocation);

  const parentArtifactId = parentPom.project.artifactId;
  const parentGroupId = parentPom.project.groupId;
  const parentVersion = parentPom.project.version;
  const parentRelativePath = path.relative(projectRoot, parentPomLocation);

  const camelCaseArtifactId = snakeCaseToCamelCase(artifactId);
  const packageName = `${parentGroupId}.${camelCaseArtifactId}`;
  const packageDirectory = packageName.split('.').join('/');

  const className = camelCaseArtifactId[0].toUpperCase() + camelCaseArtifactId.slice(1);

  return {
    ...options,
    projectName,
    artifactId,
    projectRoot,
    projectDirectory,
    parsedTags,
    projectType,
    parentArtifactId,
    parentGroupId,
    parentVersion,
    parentRelativePath,
    parentPomLocation,
    packageDirectory,
    packageName,
    className
  };
}

function addFiles(tree: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    template: ''
  };
  generateFiles(tree, path.join(__dirname, 'files'), options.projectRoot, templateOptions);
}

const updateParentPom = async (tree: Tree, options: NormalizedSchema) => {
  const parentPom = readPom(options.parentPomLocation);

  if (!parentPom.project?.modules?.module) {
    parentPom.project.modules = {
      module: [],
    };
  }

  parentPom.project.modules.module.push(path.relative(options.parentPomLocation.replace('/pom.xml', ''), options.projectRoot));

  if (!parentPom.project?.dependencyManagement?.dependencies?.dependency) {
    parentPom.project.dependencyManagement = {
      dependencies: {
        dependency: [],
      }
    };
  }

  parentPom.project.dependencyManagement.dependencies.dependency.push({
    groupId: '${project.groupId}',
    artifactId: options.artifactId,
    version: '${project.version}',
  });

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
  })
  const output = builder.build(parentPom)

  tree.write(options.parentPomLocation, output);
}

export default async function (tree: Tree, options: ProjectGeneratorSchema) {
  const normalizedOptions = await normalizeOptions(tree, options);
  addProjectConfiguration(
    tree,
    normalizedOptions.projectName,
    {
      root: normalizedOptions.projectRoot,
      projectType: normalizedOptions.projectType,
      sourceRoot: `${normalizedOptions.projectRoot}/src`,
      targets: {
        build: {
          executor: "@nx-dev-tools/java-mvn:build",
        },
      },
      tags: normalizedOptions.parsedTags,
    }
  );
  addFiles(tree, normalizedOptions);
  await formatFiles(tree);
  await updateParentPom(tree, normalizedOptions);
}

