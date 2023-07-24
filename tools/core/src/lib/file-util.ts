import {NxJsonConfiguration, ProjectConfiguration} from "@nrwl/devkit";
import * as fs from "fs";

export const readNxJson = (): NxJsonConfiguration => {
  return JSON.parse(getFileContents(`nx.json`));
}

export const readProjectJson = (path: string): ProjectConfiguration => {
    return JSON.parse(getFileContents(`${path}/project.json`));
}

export const getFileContents = (path: string): string => {
    return fs.readFileSync(path, {encoding: 'utf8', flag: 'r'});
}

