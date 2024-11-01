import { backendUrl } from "../main";
import {
  bookingContentLimitStore,
  IBookingContentLimit,
  ILimitItem,
} from "../store/store";
import { errorHandler } from "./errorHandler";
import processApi from "./processApi";

export const getBookingContentLimit = async (
  contentType: "slot" | "music",
  bookingId: string | number
): Promise<IBookingContentLimit | undefined> => {
  const limitState = bookingContentLimitStore.getState();
  const { limit, setLimit } = limitState;

  const url: string = `${backendUrl}${
    contentType === "slot" ? `/content` : `/music`
  }/limit?booking_id=${bookingId}`;

  try {
    const res = await processApi({ url });
    if (
      res.result &&
      typeof res.result === "object" &&
      "limit" in res.result &&
      "content_count" in res.result
    ) {
      let newLimits: IBookingContentLimit | null = null;
      if (contentType === "slot") {
        newLimits = { ...limit, slotContent: res.result as ILimitItem };
      }
      if (contentType === "music") {
        newLimits = { ...limit, music: res.result as ILimitItem };
      }
      if (newLimits) {
        setLimit(newLimits);
        return newLimits;
      }
    }
    if (res.error.statusCode || res.error.description) {
      errorHandler(
        `Failed to get booking ${
          contentType === "slot" ? "content" : "music"
        } limit data!`,
        res.error
      );
    }
  } catch (error) {
    errorHandler(
      `Failed to get booking ${
        contentType === "slot" ? "content" : "music"
      } limit data!`,
      {
        description: error,
      }
    );
  }
};

export const updateAllContentLimits = async (bookingId: string | number) => {
  await getBookingContentLimit("slot", bookingId);
  await getBookingContentLimit("music", bookingId);
};
