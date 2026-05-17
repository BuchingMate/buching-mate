export type DeploymentMode = "cloud" | "self-hosted";

export const DEPLOYMENT_MODE: DeploymentMode =
  process.env.DEPLOYMENT_MODE === "cloud" ? "cloud" : "self-hosted";

export const IS_CLOUD = DEPLOYMENT_MODE === "cloud";
export const IS_SELF_HOSTED = DEPLOYMENT_MODE === "self-hosted";
