import {XMLParser} from "fast-xml-parser";
import {getFileContents} from "@nx-dev-tools/core";

const alwaysArray = [
  "project.modules.module",
  "project.dependencyManagement.dependencies.dependency",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  isArray: (name, jpath, isLeafNode, isAttribute) => {
    if (alwaysArray.indexOf(jpath) !== -1) return true;
  }
});

export const readPomInFolder = (path: string): any => {
  return readPom(`${path}/pom.xml`);
}

export const readPom = (path: string): any => {
  return parser.parse(getFileContents(path));
}
