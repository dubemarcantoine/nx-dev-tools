import {XMLParser} from "fast-xml-parser";
import {getFileContents} from "@nx-dev-tools/core";

const parser = new XMLParser();

export const readPomInFolder = (path: string): any => {
  return readPom(`${path}/pom.xml`);
}

export const readPom = (path: string): any => {
  return parser.parse(getFileContents(path));
}
