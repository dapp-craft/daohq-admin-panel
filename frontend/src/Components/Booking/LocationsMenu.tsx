import leftBarMenu from "../../styles/modules/locationsLeftBarMenu.module.scss";
import fullScreenMenu from "../../styles/modules/locationsFullScreenMenu.module.scss";
import slot_styles from "../../styles/modules/slot.module.scss";
import { v4 as uuidv4 } from "uuid";
import { memo, useEffect, useState } from "react";
import {
  activeBookingsStore,
  bookingContentLimitStore,
  breadcrumbStore,
  inactiveBookingsStore,
  locationsSchemaStore,
  selectedLocationStore,
} from "../../store/store";
import loaders from "../../styles/modules/loaders.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import { getLocationsSchema } from "../../scripts/getLocationsSchema";
import { breadcrumbSync } from "../../scripts/breadcrumbSync";

export interface IDiscordBoard {
  channel: null | string;
  description: string;
  guild: null | string;
  id: string;
  location: string;
  location_preview: string;
}

export interface ILocationSchemaItem {
  id: string;
  forBooking: boolean;
  locationPreview?: string;
  scene?: string;
  slots?: {
    id: number;
    name: number | string;
    supportsStreaming: boolean;
    format: string;
    trigger: boolean;
  }[];
  discord_screens?: IDiscordBoard[];
}

export interface ILocationsSchema {
  [typeKey: string]: {
    locations?: ILocationSchemaItem[];
  };
}

const LocationsMenu = (props: {
  isFullScreen: boolean;
  isBookingsSlot: boolean;
}) => {
  const { isFullScreen, isBookingsSlot } = props;
  const [isMenuShow, setIsMenuShow] = useState<boolean>(false);
  const [isSchemaLoaded, setIsSchemaLoaded] = useState<boolean>(false);
  const { activeBookings, setActiveBookings } = activeBookingsStore();
  const { inactiveBookings, setInactiveBookings } = inactiveBookingsStore();
  const { selectedLocation, setSelectedLocation } = selectedLocationStore();
  const { setBreadcrumbsParts } = breadcrumbStore();
  const { limit, setLimit } = bookingContentLimitStore();
  const params = useParams();
  const navigate = useNavigate();

  const handleSelectLocation = (
    ev: React.MouseEvent<HTMLElement, MouseEvent>
  ) => {
    if (limit.slotContent.limit !== null || limit.music.limit !== null) {
      setLimit({
        music: { content_count: null, limit: null },
        slotContent: { content_count: null, limit: null },
      });
    }
    const locationId: string | undefined = ev.currentTarget.dataset.location_id;
    if (locationId) {
      setSelectedLocation(locationId);
      setBreadcrumbsParts({
        newPart: {
          name: locationId,
          path: `/${locationId}`,
          level: 1,
        },
      });
      if (activeBookings && locationId !== selectedLocation)
        setActiveBookings(null);
      if (inactiveBookings && locationId !== selectedLocation)
        setInactiveBookings(null);
      navigate(locationId);
      if (isMenuShow) setIsMenuShow(false);
    } else {
      throw new Error("Wrong location ID");
    }
  };

  const handleLeftBarMenuSwitcher = () => {
    setIsMenuShow((prev) => !prev);
  };

  const loadLocationsSchema = async () => {
    setIsSchemaLoaded(false);
    await getLocationsSchema(isBookingsSlot);
    breadcrumbSync();
    setIsSchemaLoaded(true);
  };

  useEffect(() => {
    loadLocationsSchema();
  }, []);

  useEffect(() => {
    if (params.locationId) setSelectedLocation(params.locationId);
  }, [params.locationId]);

  return (
    <>
      {!isFullScreen ? (
        <div
          onClick={handleLeftBarMenuSwitcher}
          className={`${leftBarMenu.container_full_menu_switcher} ${
            isMenuShow ? leftBarMenu.container_full_menu_switcher_active : ""
          }`}
        >
          {!isMenuShow ? "SHOW" : "HIDE"} <br />
          MENU
        </div>
      ) : null}
      <div
        className={`${
          isFullScreen ? fullScreenMenu.container : leftBarMenu.container
        } ${isMenuShow ? leftBarMenu.container_show : ""}`}
      >
        {!isFullScreen ? <p className={leftBarMenu.title}>LOCATIONS</p> : ""}
        <div
          className={
            isFullScreen ? fullScreenMenu.public_wrap : leftBarMenu.public_wrap
          }
        >
          <p
            className={
              isFullScreen ? fullScreenMenu.post_title : leftBarMenu.post_title
            }
          >
            {isFullScreen ? "PUBLIC LOCATIONS" : "PUBLIC"}
          </p>
          {isSchemaLoaded ? (
            <LocationsSection
              isFullScreen={isFullScreen}
              isBookingsSlot={isBookingsSlot}
              handleSelectLocation={handleSelectLocation}
              sectionTarget={"outdoor"}
            />
          ) : (
            <div className={loaders.locations_menu_loader_wrap}>
              <div className={loaders.loader_ring} />
            </div>
          )}
        </div>
        <div
          className={
            isFullScreen ? fullScreenMenu.room_wrap : leftBarMenu.room_wrap
          }
        >
          <p
            className={
              isFullScreen ? fullScreenMenu.post_title : leftBarMenu.post_title
            }
          >
            ROOMS
          </p>
          {isSchemaLoaded ? (
            <LocationsSection
              isFullScreen={isFullScreen}
              isBookingsSlot={isBookingsSlot}
              handleSelectLocation={handleSelectLocation}
              sectionTarget={"room"}
            />
          ) : (
            <div className={loaders.locations_menu_loader_wrap}>
              <div className={loaders.loader_ring} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const LocationsSection = (props: {
  isFullScreen: boolean;
  isBookingsSlot: boolean;
  handleSelectLocation: (ev: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  sectionTarget: "room" | "outdoor";
}) => {
  const { isFullScreen, isBookingsSlot, handleSelectLocation, sectionTarget } =
    props;
  const { locationsSchema } = locationsSchemaStore();
  const { selectedLocation } = selectedLocationStore();

  const getTargetLocations = () => {
    if (sectionTarget === "outdoor" && locationsSchema?.outdoor?.locations) {
      return locationsSchema.outdoor.locations;
    } else if (sectionTarget === "room" && locationsSchema?.room?.locations) {
      return locationsSchema.room.locations;
    } else return null;
  };

  const locationNameFormatter = (locId: string): string => {
    return locId.replace(/_/g, " ");
  };

  return (
    <div className={isFullScreen ? fullScreenMenu.items_wrap : ""}>
      {(function () {
        const locationItems = getTargetLocations();
        return (
          <>
            {locationItems ? (
              locationItems.map((loc) => (
                <div
                  key={uuidv4()}
                  className={
                    isFullScreen
                      ? fullScreenMenu.item
                      : `${leftBarMenu.item} ${
                          loc.id === selectedLocation
                            ? leftBarMenu.item__active
                            : ""
                        }`
                  }
                  onClick={handleSelectLocation}
                  data-location_id={loc.id}
                >
                  {isFullScreen ? (
                    <LocationImgPreview previewUrl={loc.locationPreview} />
                  ) : null}
                  {isFullScreen ? (
                    <p className={fullScreenMenu.item_name}>
                      {locationNameFormatter(loc.id)}
                    </p>
                  ) : null}
                  <div
                    className={
                      isFullScreen ? fullScreenMenu.item_link_wrap : ""
                    }
                  >
                    <span
                      className={
                        isFullScreen
                          ? fullScreenMenu.item_link
                          : leftBarMenu.item_link
                      }
                    >
                      {isFullScreen
                        ? isBookingsSlot
                          ? "BOOKINGS"
                          : "EDIT"
                        : locationNameFormatter(loc.id)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className={slot_styles.slot_list_empty_msg}>
                There are no available locations
              </p>
            )}
          </>
        );
      })()}
    </div>
  );
};

const LocationImgPreview = (props: { previewUrl: string | undefined }) => {
  const { previewUrl } = props;
  const [isImgLoaded, setIsImgLoaded] = useState<boolean>(false);
  return (
    <div className={fullScreenMenu.prev_img_wrap}>
      <div
        className={`${loaders.img_loader} ${loaders.img_loader_location_prev} ${
          isImgLoaded ? loaders.img_hidden_state : loaders.img_visible_state
        }`}
      >
        <img src="/icons/image.svg" alt="loader_img_icon" />
      </div>
      <div className={fullScreenMenu.item_img_wrap}>
        <img
          className={fullScreenMenu.item_img}
          src={previewUrl ? previewUrl : "/images/banner.png"}
          alt="Location Picture"
          onLoad={() => {
            setTimeout(() => {
              setIsImgLoaded(true);
            }, 500);
          }}
        />
      </div>
    </div>
  );
};

export default memo(LocationsMenu);
