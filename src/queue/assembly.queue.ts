import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export interface AssemblyJobData {
  projectId: string;
  outputPath: string;
  outputFormat: "mp4" | "webm";
  targetWidth: number;
  targetHeight: number;
  nativeWidth: number;
  nativeHeight: number;
  shots: Array<{
    shotId: string;
    shotIndex: number;
    filePath: string;
    durationSeconds: number;
    trimStart: number;
    trimEnd: number;
    transitionType: string;
    transitionDuration: number;
    speedFactor: number;
    reframeFocus: string;
    reframePan: string;
    // Presenter overlay data — only populated for presenter projects
    lowerThirdEnabled: boolean;
    lowerThird?: { text: string; in: number; out: number } | null;
    scriptureOverlay?: string | null;
  }>;
  primaryAudioPath?: string;
  backgroundMusicPath?: string;
  // Presenter overlay master toggles
  showLowerThirds?: boolean;
  showScriptureOverlays?: boolean;
}

export const assemblyQueue = new Queue<AssemblyJobData>("assembly", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50,
    removeOnFail: 25,
  },
});
