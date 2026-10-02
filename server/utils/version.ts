import path from "path";
import fs from "fs";

export const serverStartTime = new Date();

export function getAppBuildSignature(): string {
  let buildSignature = `v-${serverStartTime.getTime().toString(36)}`;
  try {
    const distIndexPath = path.join(process.cwd(), "dist", "index.html");
    if (fs.existsSync(distIndexPath)) {
      const stats = fs.statSync(distIndexPath);
      buildSignature = `b-${stats.mtimeMs.toString(36)}-${stats.size.toString(36)}`;
    }
  } catch (e) {}
  return buildSignature;
}
