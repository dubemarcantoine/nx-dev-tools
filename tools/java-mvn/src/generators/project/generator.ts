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
import * as xml2js from 'xml2js';
import {ProjectGeneratorSchema} from './schema';
import {readPom} from "../../core/pom";
import {getFileContents} from "@nx-dev-tools/core";

interface NormalizedSchema extends ProjectGeneratorSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  parentArtifactId: string;
  parentGroupId: string;
  parentVersion: string;
  parentRelativePath: string;
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

  const artifactId = options.artifactId;

  const nxJson = readNxJson(tree);

  let parentPomLocation = options.parentPomLocation;

  if (!parentPomLocation) {
    if (nxJson?.pluginsConfig['@nx-dev-tools/java-mvn']) {
      parentPomLocation = `${nxJson.pluginsConfig['@nx-dev-tools/java-mvn']['parent-pom-folder']}/pom.xml`;
    }
  }

  const parentPom = await getPom(parentPomLocation);

  const parentArtifactId = parentPom.project.artifactId;
  const parentGroupId = parentPom.project.groupId;
  const parentVersion = parentPom.project.version;
  const parentRelativePath = path.relative(projectRoot, parentPomLocation);

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
    parentPomLocation
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
  const parentPom = await getPom(options.parentPomLocation);

  if (!parentPom.project.modules) {
    parentPom.project.modules = [
      {
        module: [],
      },
    ];
  }

  console.log(parentPom.project.modules)
  console.log(parentPom.project.modules.filter(obj => !!obj.module))
  if (parentPom.project.modules.filter(obj => !!obj.module).length === 0) {
    console.log('here')
    parentPom.project.modules = [
      {
        module: [],
      },
    ];
  }

  console.log(parentPom.project)

  parentPom.project.modules.filter(obj => {
    if (obj.module) {
      obj.module.push(options.projectRoot)
    }
  });

  // if (!parentPom.project?.dependencyManagement?.dependencies?.dependency) {
  //   parentPom.project.dependencyManagement.dependencies = {
  //     dependency: []
  //   }
  // }
  //
  // if (!parentPom.project?.dependencyManagement) {
  //   parentPom.project.dependencyManagement = {};
  // }
  //
  // if (!parentPom.project.dependencyManagement.dependencies) {
  //   parentPom.project.dependencyManagement.dependencies = {};
  // }
  //
  // if (!parentPom.project.dependencyManagement.dependencies.dependency) {
  //   parentPom.project.dependencyManagement.dependencies.dependency = [];
  // }
  //
  // console.log(parentPom.project)
  // console.log(parentPom.project.dependencyManagement)
  // console.log(parentPom.project.dependencyManagement.dependencies)
  //
  // parentPom.project.dependencyManagement.dependencies.dependency.push({
  //   groupId: '${project.groupId}',
  //   artifactId: options.artifactId,
  //   version: '${project.version}',
  // })

  console.log(JSON.stringify(parentPom))

  const builder = new xml2js.Builder();
  const xmlStr = builder.buildObject(parentPom);

  tree.write(options.parentPomLocation, xmlStr);
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

const getPom = async (pomPath: string): Promise<any> => {
  return await new Promise((resolve, reject) => {
    const parser = new xml2js.Parser()
    try {
      parser.parseStringPromise(getFileContents(pomPath)).then((result) => {
        return resolve(result)
      }).catch((err) => {
        return reject(err);
      });
    } catch (e) {
      return reject('No pom parent project found. Make sure that a parent project was generated or that a parent pom path is set in `pluginsConfig["@nx-dev-tools/java-mvn"]["parent-pom-folder"]`');
    }
  })
}
