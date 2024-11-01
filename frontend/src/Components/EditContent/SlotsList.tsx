import { useEffect, useState } from "react";
import {
  IBreadcrumbItem,
  breadcrumbStore,
  locationsSchemaStore,
  selectedBookingStore,
  selectedDiscordBoardStore,
  selectedLocationStore,
  selectedSlotStore,
  bookingContentLimitStore,
} from "../../store/store";
import {
  IDiscordBoard,
  ILocationSchemaItem,
  ILocationsSchema,
} from "../Booking/LocationsMenu";
import slot_styles from "../../styles/modules/slot.module.scss";
import { v4 as uuidv4 } from "uuid";
import { Link, useParams } from "react-router-dom";
import { breadcrumbSync } from "../../scripts/breadcrumbSync";
import { updateAllContentLimits } from "../../scripts/getBookingContentLimit";

function getLocationById(locationId: string, scheme: ILocationsSchema | null) {
  if (!scheme) return null;

  for (const key in scheme) {
    if ("locations" in scheme[key] && Array.isArray(scheme[key].locations)) {
      for (const item of scheme[key].locations!)
        if (item.id === locationId) return item;
    }
  }

  return null;
}

export const SlotsList = () => {
  const { locationsSchema, setLocationsSchema } = locationsSchemaStore();
  const { selectedSlot, setSelectedSlot } = selectedSlotStore();
  const { selectedLocation, setSelectedLocation } = selectedLocationStore();
  const { setSelectedDiscordBoard } = selectedDiscordBoardStore();
  const [currentSlotList, setCurrentSlotList] =
    useState<ILocationSchemaItem | null>(null);
  const { setBreadcrumbsParts } = breadcrumbStore();
  const { selectedBooking } = selectedBookingStore();
  const { limit } = bookingContentLimitStore();
  const params = useParams();

  const saveSlotData = (
    slotInfo: {
      id: number;
      name: string;
      supportsStreaming: boolean;
      format: string;
      trigger: boolean;
    },
    breadcrumbItem: IBreadcrumbItem
  ) => {
    setSelectedSlot({
      slotInfo,
      content: selectedSlot.content,
    });
    setBreadcrumbsParts({ newPart: breadcrumbItem });
  };

  const saveDiscordData = (discordScreen: IDiscordBoard) => {
    setSelectedDiscordBoard(discordScreen.id);
    setBreadcrumbsParts({
      newPart: {
        level: 4,
        path: `/discord/${discordScreen.id}`,
        name: discordScreen.id,
      },
    });
  };

  const locationNameFormatter = (locId: string): string => {
    return locId.replace(/_/g, " ");
  };

  useEffect(() => {
    const bookingId = selectedBooking?.id || params.bookingId;
    if (!locationsSchema) {
      const locationsSchemaLocStor = localStorage.getItem(
        "dao_hq_locationsSchema"
      );
      if (locationsSchemaLocStor) {
        setLocationsSchema(JSON.parse(locationsSchemaLocStor));
      }
    }
    if (!selectedLocation && params.locationId) {
      setSelectedLocation(params.locationId);
    }
    if (bookingId) {
      updateAllContentLimits(bookingId);
    }
    breadcrumbSync();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (selectedLocation && locationsSchema) {
      const location = getLocationById(selectedLocation, locationsSchema);
      if (location) setCurrentSlotList(location);
    }
  }, [locationsSchema, selectedLocation]);

  return (
    <div className={slot_styles.slot_list}>
      <div className={slot_styles.slot_list_title_wrap}>
        <p className={slot_styles.slot_list_title}>
          Screens in{" "}
          <span className={slot_styles.slot_list_title_location}>
            {selectedLocation
              ? locationNameFormatter(selectedLocation)
              : "unknown location"}
          </span>
        </p>
        {limit.slotContent.content_count !== null &&
        limit.slotContent.limit !== null ? (
          <div className={slot_styles.slot_list_limit_wrap}>
            <p className={slot_styles.slot_list_limit_label}>Images limit</p>
            <p
              className={slot_styles.slot_list_limit}
            >{`${limit.slotContent.content_count}/${limit.slotContent.limit}`}</p>
          </div>
        ) : null}
      </div>
      {currentSlotList && currentSlotList.slots ? (
        currentSlotList.slots.map((slot) => (
          <div className={slot_styles.slot_list_item} key={uuidv4()}>
            {slot.supportsStreaming ? (
              <div className={slot_styles.slot_list_item_streaming_img_wrap}>
                <img src="/icons/streaming.svg" alt="streaming_icon" />
                <span>supports streaming</span>
              </div>
            ) : null}
            <p className={slot_styles.slot_list_item_title}>{slot.name}</p>
            <div className={slot_styles.slot_list_item_buttons_container}>
              <div>
                <Link
                  to={slot.id.toString()}
                  className={slot_styles.slot_list_item_edit_link}
                  onClick={() =>
                    saveSlotData(
                      {
                        id: slot.id,
                        name: slot.name.toString(),
                        supportsStreaming: slot.supportsStreaming,
                        format: slot.format,
                        trigger: slot.trigger,
                      },
                      {
                        name: slot.name.toString(),
                        path: `/${slot.id.toString()}`,
                        level: 4,
                      }
                    )
                  }
                >
                  SETUP SCREEN
                </Link>
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className={slot_styles.slot_list_empty_msg}>
          No regular screens in {selectedLocation}
        </p>
      )}
      {currentSlotList && currentSlotList.discord_screens ? (
        <>
          <p
            className={`${slot_styles.slot_list_title} ${slot_styles.slot_list_title_simple}`}
          >
            Discord boards in{" "}
            <span className={slot_styles.slot_list_title_location}>
              {selectedLocation}
            </span>
          </p>
          {currentSlotList.discord_screens.map((discordScreen) => (
            <div key={uuidv4()} className={slot_styles.slot_list_item}>
              <p className={slot_styles.slot_list_item_title}>
                {discordScreen.description}
              </p>
              <div>
                <Link
                  to={`discord/${discordScreen.id}`}
                  className={slot_styles.slot_list_item_edit_link}
                  onClick={() => saveDiscordData(discordScreen)}
                >
                  SETUP BOARD
                </Link>
              </div>
            </div>
          ))}
        </>
      ) : null}
      <div className={slot_styles.slot_list_title_wrap}>
        <p className={`${slot_styles.slot_list_title}`}>
          Music settings in{" "}
          <span className={slot_styles.slot_list_title_location}>
            {selectedLocation
              ? locationNameFormatter(selectedLocation)
              : "unknown location"}
          </span>
        </p>
        {limit.music.content_count !== null && limit.music.limit !== null ? (
          <div className={slot_styles.slot_list_limit_wrap}>
            <p className={slot_styles.slot_list_limit_label}>Music limit</p>
            <p
              className={slot_styles.slot_list_limit}
            >{`${limit.music.content_count}/${limit.music.limit}`}</p>
          </div>
        ) : null}
      </div>
      <div key={uuidv4()} className={slot_styles.slot_list_item}>
        <p className={slot_styles.slot_list_item_title}>
          Set music playlist{" "}
          {selectedBooking?.id || params.bookingId ? "during the event" : ""}
        </p>
        <div>
          <Link
            to={"music"}
            className={slot_styles.slot_list_item_edit_link}
            onClick={() => {
              setBreadcrumbsParts({
                newPart: {
                  level: 4,
                  path: "/music",
                  name: "music",
                },
              });
            }}
          >
            SETUP MUSIC
          </Link>
        </div>
      </div>
    </div>
  );
};
