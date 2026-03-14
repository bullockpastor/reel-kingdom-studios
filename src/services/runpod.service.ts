/**
 * RunPod cloud GPU manager.
 * Provides pod lifecycle management (start/stop) and dynamic URL discovery
 * for the RunPod ComfyUI engine. Pod IDs are not stable — each deployment
 * gets a new ID, so we always query the live pods list to find a running pod.
 */
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const GQL_URL = "https://api.runpod.io/graphql";

export interface RunPodStatus {
  state: "running" | "stopped" | "not_configured";
  podId: string | null;
  proxyUrl: string | null;
  costPerHr: number | null;
  uptimeSeconds: number | null;
}

interface GqlPod {
  id: string;
  name: string;
  imageName: string;
  desiredStatus: string;
  costPerHr: number | null;
  runtime: {
    uptimeInSeconds: number;
    ports: Array<{ ip: string; privatePort: number; publicPort: number | null; type: string }>;
  } | null;
}

async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${GQL_URL}?api_key=${config.RUNPOD_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`RunPod API HTTP ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (body.errors?.length) {
    throw new Error(`RunPod GraphQL: ${body.errors.map((e) => e.message).join(", ")}`);
  }

  return body.data as T;
}

export function getPodProxyUrl(podId: string, port = 8188): string {
  return `https://${podId}-${port}.proxy.runpod.net`;
}

async function queryPods(): Promise<GqlPod[]> {
  const data = await gqlRequest<{ myself: { pods: GqlPod[] } }>(`
    query {
      myself {
        pods {
          id
          name
          imageName
          desiredStatus
          costPerHr
          runtime {
            uptimeInSeconds
            ports {
              ip
              privatePort
              publicPort
              type
            }
          }
        }
      }
    }
  `);
  return data.myself.pods;
}

/**
 * Find a running pod that exposes port 8188 (ComfyUI).
 */
async function findRunningComfyPod(): Promise<GqlPod | null> {
  const pods = await queryPods();
  return (
    pods.find(
      (p) =>
        p.desiredStatus === "RUNNING" &&
        p.runtime?.ports.some((port) => port.privatePort === 8188)
    ) ?? null
  );
}

/**
 * Get the current status of the RunPod ComfyUI pod.
 * Always queries the live pods list — no cached pod ID.
 */
export async function getRunPodStatus(): Promise<RunPodStatus> {
  if (!config.RUNPOD_API_KEY) {
    return { state: "not_configured", podId: null, proxyUrl: null, costPerHr: null, uptimeSeconds: null };
  }

  const pod = await findRunningComfyPod();
  if (pod) {
    return {
      state: "running",
      podId: pod.id,
      proxyUrl: getPodProxyUrl(pod.id),
      costPerHr: pod.costPerHr,
      uptimeSeconds: pod.runtime?.uptimeInSeconds ?? null,
    };
  }

  return { state: "stopped", podId: null, proxyUrl: null, costPerHr: null, uptimeSeconds: null };
}

/**
 * Deploy a new RunPod pod using the configured GPU template.
 * If a pod is already running, returns its status without deploying a new one.
 */
export async function startRunPod(): Promise<RunPodStatus> {
  if (!config.RUNPOD_API_KEY) {
    throw new Error("RUNPOD_API_KEY not configured");
  }

  // Return immediately if already running
  const existing = await getRunPodStatus();
  if (existing.state === "running") {
    logger.info({ podId: existing.podId }, "RunPod pod already running");
    return existing;
  }

  const input: Record<string, unknown> = {
    cloudType: "SECURE",
    gpuCount: 1,
    containerDiskInGb: 20,
    volumeInGb: 40,
    minVcpuCount: 2,
    minMemoryInGb: 16,
    gpuTypeId: config.RUNPOD_GPU_TYPE_ID,
    name: "reel-kingdom-comfyui",
    imageName: config.RUNPOD_TEMPLATE_ID,
    ports: "8188/http,22/tcp",
    volumeMountPath: "/workspace",
    startJupyter: false,
    startSsh: false,
  };

  if (config.RUNPOD_NETWORK_VOLUME_ID) {
    input.networkVolumeId = config.RUNPOD_NETWORK_VOLUME_ID;
  }

  const data = await gqlRequest<{
    podFindAndDeployOnDemand: { id: string; imageName: string; machineId: string };
  }>(
    `mutation($input: PodFindAndDeployOnDemandInput!) {
      podFindAndDeployOnDemand(input: $input) {
        id
        imageName
        machineId
      }
    }`,
    { input }
  );

  const podId = data.podFindAndDeployOnDemand.id;
  logger.info({ podId, imageName: config.RUNPOD_TEMPLATE_ID }, "RunPod pod deployed");

  return {
    state: "running",
    podId,
    proxyUrl: getPodProxyUrl(podId),
    costPerHr: null,
    uptimeSeconds: 0,
  };
}

/**
 * Terminate the running RunPod pod.
 * Container disk data is lost. Workspace volume data is preserved if a
 * network volume is configured.
 */
export async function stopRunPod(podId: string): Promise<void> {
  if (!config.RUNPOD_API_KEY) {
    throw new Error("RUNPOD_API_KEY not configured");
  }

  await gqlRequest<{ podTerminate: null }>(
    `mutation($podId: String!) {
      podTerminate(input: { podId: $podId })
    }`,
    { podId }
  );

  logger.info({ podId }, "RunPod pod terminated");
}
