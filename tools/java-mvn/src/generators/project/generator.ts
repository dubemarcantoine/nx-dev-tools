import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import * as path from 'path';
import {ProjectGeneratorSchema} from './schema';

interface NormalizedSchema extends ProjectGeneratorSchema {
  projectName: string;
  artifactId: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  parentPomLocation: string;
}

function normalizeOptions(tree: Tree, options: ProjectGeneratorSchema): NormalizedSchema {
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

  const artifactId = options.artifactId;

  const parentPomLocation = options.parentPomLocation;

  return {
    ...options,
    projectName,
    artifactId,
    projectRoot,
    projectDirectory,
    parsedTags,
    projectType,
    parentPomLocation,
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

export default async function (tree: Tree, options: ProjectGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);
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
}
