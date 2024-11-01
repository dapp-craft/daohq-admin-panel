import {
  IDiscordBoard,
  ILocationsSchema,
} from "../Components/Booking/LocationsMenu";
import { backendUrl } from "../main";
import { locationsSchemaStore } from "../store/store";
import { errorHandler } from "./errorHandler";
import processApi from "./processApi";

const discordLocationTypes: { [key: string]: string } = {
  governance: "outdoor",
};

export const getLocationsSchema = async (isBookingsSlot: boolean) => {
  const setLocationsSchema = locationsSchemaStore.getState().setLocationsSchema;
  const locationschema = locationsSchemaStore.getState().locationsSchema;
  const locStorSchema = localStorage.getItem("dao_hq_locationsSchema");

  if (locationschema) setLocationsSchema(null);
  if (locStorSchema) localStorage.removeItem("dao_hq_locationsSchema");

  const getSlotsData = async (url: string) => {
    try {
      const res = await processApi({ url });
      if (
        res.result &&
        typeof res.result === "object" &&
        Object.keys(res.result).length
      ) {
        return res.result;
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler(
          "Failed to get slot data for locations schema!",
          res.error,
          () => (window.location.href = "/")
        );
      }
    } catch (error) {
      errorHandler(
        "Failed to get slot data for locations schema!",
        {
          description: error,
        },
        () => (window.location.href = "/")
      );
    }
  };

  let url: string | null = null;
  if (isBookingsSlot) {
    url = `${backendUrl}/slots/for-booking`;
  } else {
    url = `${backendUrl}/slots`;
  }

  const tempLocationsSchema: ILocationsSchema = {};

  const slotsArr = await getSlotsData(url);

  if (slotsArr) {
    for (const slotId in slotsArr) {
      const slot: {
        location_id: string;
        location_type: string;
        location_preview: string;
        slot_name: string;
        supports_streaming: boolean;
        for_booking: boolean;
        scene: string;
        format: string;
        trigger: boolean;
      } = slotsArr[slotId as keyof object];
      if (!(slot.location_type in tempLocationsSchema)) {
        tempLocationsSchema[slot.location_type] = {};
        if (!("locations" in tempLocationsSchema[slot.location_type])) {
          tempLocationsSchema[slot.location_type].locations = [];
        }
      }
      const currentItem = tempLocationsSchema[slot.location_type].locations;
      const existingLocation = currentItem?.find(
        (item) => item.id === slot.location_id
      );
      if (!existingLocation) {
        currentItem?.push({
          id: slot.location_id,
          locationPreview: slot.location_preview,
          scene: slot.scene,
          forBooking: slot.for_booking,
          slots: [
            {
              id: +slotId,
              name: slot.slot_name,
              supportsStreaming: slot.supports_streaming,
              format: slot.format,
              trigger: slot.trigger,
            },
          ],
        });
      } else if (existingLocation.slots) {
        existingLocation.slots.push({
          id: +slotId,
          name: slot.slot_name,
          supportsStreaming: slot.supports_streaming,
          format: slot.format,
          trigger: slot.trigger,
        });
      }
    }
  }

  if (!isBookingsSlot) {
    const getDiscordScreenData = async () => {
      try {
        const res = await processApi({
          url: `${backendUrl}/discord/screens`,
        });
        if (res.result && Array.isArray(res.result) && res.result.length) {
          return res.result as IDiscordBoard[];
        }
        if (res.error.statusCode || res.error.description) {
          errorHandler(
            "Failed to get discord screens data for locations schema!",
            res.error
          );
        }
      } catch (error) {
        errorHandler(
          "Failed to get discord screens data for locations schema!",
          { description: error }
        );
      }
    };

    const discordScreens = await getDiscordScreenData();

    if (discordScreens) {
      discordScreens.forEach((screenItem: IDiscordBoard) => {
        const discordLocationType =
          discordLocationTypes[screenItem.location] || "outdoor";
        if (!(discordLocationType in tempLocationsSchema)) {
          tempLocationsSchema[discordLocationType] = {
            locations: [],
          };
        }

        const locations = tempLocationsSchema[discordLocationType].locations;
        const location = locations?.find(
          (item) => item.id === screenItem.location
        );

        if (!location) {
          locations?.push({
            id: screenItem.location,
            forBooking: false,
            discord_screens: [screenItem],
            locationPreview: screenItem.location_preview,
          });
        } else if (location.discord_screens) {
          location.discord_screens.push(screenItem);
        } else {
          location.discord_screens = [screenItem];
        }
      });
    }
  }
  setLocationsSchema(tempLocationsSchema);
  localStorage.setItem(
    "dao_hq_locationsSchema",
    JSON.stringify(tempLocationsSchema)
  );
};
