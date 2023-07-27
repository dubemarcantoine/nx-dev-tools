import {
  addProjectConfiguration, formatFiles, generateFiles, getWorkspaceLayout, names, offsetFromRoot, Tree, updateJson,
} from '@nrwl/devkit';
import * as path from 'path';
import {ProjectGeneratorSchema} from './schema';
import * as fs from "fs";

interface NormalizedSchema extends ProjectGeneratorSchema {
  projectName: string;

  artifactId: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

function normalizeOptions(tree: Tree, options: ProjectGeneratorSchema): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory ? `${names(options.directory).fileName}/${name}` : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');

  const root = options.projectType === 'application' ? `${getWorkspaceLayout(tree).appsDir}` : `${getWorkspaceLayout(tree).libsDir}`;

  const projectRoot = `${root}/${projectDirectory}`;
  const parsedTags = options.tags ? options.tags.split(',').map((s) => s.trim()) : [];

  const projectType = options.projectType;

  const groupId = options.groupId;
  const artifactId = options.name;
  const version = options.version;

  const pomLocation = options.pomLocation;

  return {
    ...options,
    projectName,
    groupId,
    artifactId,
    version,
    projectRoot,
    projectDirectory,
    parsedTags,
    projectType,
    pomLocation,
  };
}

function addFiles(tree: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options, ...names(options.name), offsetFromRoot: offsetFromRoot(options.projectRoot), template: ''
  };
  generateFiles(tree, path.join(__dirname, 'files'), options.projectRoot, templateOptions);

  let pomFolder;
  if (options.pomLocation) {
    pomFolder = options.pomLocation;
    const pomLocationAndProjectRelativePath = path.relative(pomFolder, options.projectRoot);
    fs.symlinkSync(`${pomLocationAndProjectRelativePath}/pom.xml`, `${pomFolder}/pom.xml`);
  } else {
    pomFolder = options.projectRoot;
  }


  updateJson(tree, 'nx.json', (nxJson) => {
    nxJson.pluginsConfig = nxJson.pluginsConfig ?? {};
    nxJson.pluginsConfig['@nx-dev-tools/java-mvn'] = nxJson.pluginsConfig['@nx-dev-tools/java-mvn'] ?? {};
    nxJson.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-project-folder'] = options.projectRoot;
    nxJson.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-folder'] = pomFolder;
    return nxJson;
  });
}

export default async function (tree: Tree, options: ProjectGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);
  addProjectConfiguration(tree, normalizedOptions.projectName, {
    root: normalizedOptions.projectRoot,
    projectType: normalizedOptions.projectType,
    sourceRoot: `${normalizedOptions.projectRoot}/src`,
    targets: {
      install: {
        executor: "@nx-dev-tools/java-mvn:build",
      },
    },
    tags: normalizedOptions.parsedTags,
  });
  addFiles(tree, normalizedOptions);
  await formatFiles(tree);
}
