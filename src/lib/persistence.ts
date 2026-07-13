import { del, get, set } from "idb-keyval";
import type { Project } from "@/src/model/types";
import { PROJECT_STORAGE_KEY } from "./project";

export const loadProject = () => get<Project>(PROJECT_STORAGE_KEY);
export const saveProject = (project: Project) =>
  set(PROJECT_STORAGE_KEY, project);
export const deleteProject = () => del(PROJECT_STORAGE_KEY);
