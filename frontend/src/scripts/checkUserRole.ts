import { backendUrl } from "../main";
import { errorHandler } from "./errorHandler";
import processApi from "./processApi";

export const checkUserRole = async (
  address: string
): Promise<string | null> => {
  const getRoleData = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/users/role/${address}`,
      });
      if (
        res.result &&
        typeof res.result === "object" &&
        "role" in res.result &&
        (typeof res.result.role === "string" || res.result.role === null)
      ) {
        return res.result.role;
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Failed to get user role!", res.error);
      }
    } catch (error) {
      errorHandler("Failed to get user role!", {
        description: error,
      });
    }
  };
  const roleData = await getRoleData();
  if (typeof roleData === "string") {
    return roleData;
  } else {
    return null;
  }
};
