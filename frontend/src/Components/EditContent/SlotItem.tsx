import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import slot_styles from "../../styles/modules/slot.module.scss";
import loaded_styles from "../../styles/modules/prevLoadedCont.module.scss";
import loaders from "../../styles/modules/loaders.module.scss";

import {
  resourceToEditStore,
  locationsSchemaStore,
  selectedBookingStore,
  selectedLocationStore,
  selectedSlotStore,
  breadcrumbStore,
  IBreadcrumbItem,
  liveBookingsWsStore,
  IBookingStateItem,
  streamingInfoModalStore,
  bookingContentLimitStore,
} from "../../store/store";
import {
  ILocationSchemaItem,
  ILocationsSchema,
} from "../Booking/LocationsMenu";
import processApi from "../../scripts/processApi";
import { backendUrl } from "../../main";
import { IBookingItem } from "../Booking/BookingStartPanel";
import { breadcrumbSync } from "../../scripts/breadcrumbSync";
import { hashCode } from "../../scripts/hashCode";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { findLocation, StreamingInfo } from "./AddContentForm";
import { errorHandler } from "../../scripts/errorHandler";
import { buildUrlToScene } from "../../scripts/buildSceneLink";
import { getBookingContentLimit } from "../../scripts/getBookingContentLimit";

export interface IContentItem {
  booking: number;
  content_id: number;
  location_id: string;
  order_id: number;
  name: string;
  preview: null;
  resource_id: number;
  s3_urn: string;
  slot: number;
  type: string;
  isSortChecked?: boolean;
}

export interface ILoadedResourceItem {
  file: number;
  id: number;
  name: string;
  preview: null | string;
  type: string;
  s3_urn: string;
}

export enum SCREEN_FORMATS {
  STANDARD_WIDE = "16:9",
  STANDARD_NARROW = "9:16",
  ULTRA_WIDE = "21:9",
  RECTANGULAR = "4:3",
  RECTANGULAR_NARROW = "3:4",
}

export const SlotItem = (props: { isScene?: boolean }) => {
  const { isScene } = props;
  const { selectedLocation, setSelectedLocation } = selectedLocationStore();
  const { selectedSlot, setSelectedSlot } = selectedSlotStore();
  const { selectedBooking, setSelectedBooking } = selectedBookingStore();
  const { setBreadcrumbsParts } = breadcrumbStore();
  const { locationsSchema } = locationsSchemaStore();
  const { bookingStates } = liveBookingsWsStore();
  const { isShowInfoModal, setIsShowInfoModal } = streamingInfoModalStore();
  const { limit } = bookingContentLimitStore();
  const [activeContentIndex, setActiveContentIndex] = useState<number | null>(
    null
  );
  const [isShowAddMenu, setIsShowAddMenu] = useState(false);
  const [dragResOrder, setDragResOrder] = useState<{
    start: number | null;
    drop: number | null;
  }>({ start: null, drop: null });
  const [isContentLoaded, setIsContentLoaded] = useState<boolean>(false);
  const [isShowLoadedModal, setIsShowLoadedModal] = useState<boolean>(false);
  const [isResourcesListLoaded, setIsResourcesListLoaded] =
    useState<boolean>(false);
  const [loadedResource, setLoadedResource] = useState<
    ILoadedResourceItem[] | null
  >(null);
  const [urlToScreen, setUrlToScreen] = useState<string | null>(null);
  const params = useParams();
  const navigate = useNavigate();

  const streamingModalRef = useRef(null);
  const loadedResModalRef = useRef(null);
  const componentContainerRef = useRef(null);
  const titleContainerRef = useRef(null);
  const contentListContainerRef = useRef(null);

  const getSlotInfo = (schema: ILocationsSchema, currentSlot: number) => {
    let allLocations: ILocationSchemaItem[] = [];
    for (const key in schema) {
      allLocations = allLocations.concat(
        schema[key].locations as ILocationSchemaItem[]
      );
    }
    const currentLocation = allLocations.find(
      (loc) => loc.id === selectedLocation
    );
    if (currentLocation && currentLocation.slots) {
      const slotData = currentLocation.slots.find(
        (slot) => slot.id === currentSlot
      );
      if (slotData) {
        setSelectedSlot({
          slotInfo: {
            id: slotData.id,
            name: slotData.name.toString(),
            supportsStreaming: slotData.supportsStreaming,
            format: slotData.format,
            trigger: slotData.trigger,
          },
          content: selectedSlot.content,
        });
      }
    }
  };

  const getSlotContentWithBooking = async () => {
    setIsContentLoaded(false);

    const getBookingContentData = async () => {
      try {
        const res = await processApi({
          url: `${backendUrl}/content?slot_id=${
            selectedSlot.slotInfo.id || params.slotId
          }&location_id=${selectedLocation || params.locationId}&booking_id=${
            selectedBooking?.id || params.bookingId
          }`,
        });
        if (res.result && Array.isArray(res.result)) {
          return res.result as IContentItem[];
        }
        if (res.error.statusCode || res.error.description) {
          errorHandler("Can't get booking content data!", res.error, () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          });
        }
      } catch (error) {
        errorHandler(
          "Can't get booking content data!",
          { description: error },
          () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          }
        );
      }
    };

    const content = await getBookingContentData();

    if (content) {
      content.sort((a, b) => a.order_id - b.order_id);
      setSelectedSlot({
        slotInfo: selectedSlot.slotInfo,
        content,
      });
    }
    setIsContentLoaded(true);
  };

  const getDefaultSlotContent = async () => {
    setIsContentLoaded(false);

    const getDefaultContentData = async () => {
      try {
        const res = await processApi({
          url: `${backendUrl}/content?slot_id=${
            selectedSlot.slotInfo.id || params.slotId
          }`,
        });
        if (res.result && Array.isArray(res.result)) {
          return res.result as IContentItem[];
        }
        if (res.error.statusCode || res.error.description) {
          errorHandler(
            "Can't get default booking content data!",
            res.error,
            () => {
              navigate(-1);
              window.history.replaceState({}, window.location.href);
            }
          );
        }
      } catch (error) {
        errorHandler(
          "Can't get default booking content data!",
          { description: error },
          () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          }
        );
      }
    };

    const content = await getDefaultContentData();

    if (content) {
      content.sort((a, b) => a.order_id - b.order_id);
      setSelectedSlot({
        slotInfo: selectedSlot.slotInfo,
        content,
      });
    }
    setIsContentLoaded(true);
  };

  const getSelectedBookingData = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/bookings/${params.bookingId}`,
      });
      if (res.result && typeof res.result === "object" && "id" in res.result) {
        setSelectedBooking(res.result as IBookingItem);
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get selected booking data!", res.error, () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        });
      }
    } catch (error) {
      errorHandler(
        "Can't get selected booking data!",
        { description: error },
        () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        }
      );
    }
  };

  const handleDragStart = (ev: React.DragEvent<HTMLDivElement>) => {
    const startOrder: string | undefined = ev.currentTarget.dataset.order;
    if (startOrder) {
      setDragResOrder({ start: +startOrder, drop: null });
    }
  };

  const handleDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    const dropOrder: string | undefined = ev.currentTarget.dataset.order;
    if (dropOrder) {
      setDragResOrder({ start: dragResOrder.start, drop: +dropOrder });
    }
  };

  const handleDragOver = (ev: React.DragEvent<HTMLDivElement>) =>
    ev.preventDefault();

  const handleDragEnd = async () => {
    if (!selectedSlot.content || !dragResOrder.start || !dragResOrder.drop) {
      return;
    }

    selectedSlot.content.sort((a, b) => a.order_id - b.order_id);

    const min = Math.min(dragResOrder.start, dragResOrder.drop);
    const max = Math.max(dragResOrder.start, dragResOrder.drop);
    const sign = Math.sign(dragResOrder.drop - dragResOrder.start);

    for (const item of selectedSlot.content) {
      if (item.order_id === dragResOrder.start) {
        item.order_id = dragResOrder.drop;
      } else if (item.order_id === dragResOrder.drop) {
        item.order_id = dragResOrder.drop - sign;
      } else if (min < item.order_id && item.order_id < max) {
        item.order_id -= sign;
      }
    }

    selectedSlot.content.sort((a, b) => a.order_id - b.order_id);

    const body: { [key: string]: number } = {};
    selectedSlot.content.forEach((item, index) => {
      body[item.content_id] = index + 1;
    });

    if (Object.keys(body).length) {
      try {
        const res = await processApi({
          url: `${backendUrl}/contents/order`,
          method: "PATCH",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
        });
        if (res.error.statusCode || res.error.description) {
          errorHandler("Failed to sort slot content!", res.error);
        }
      } catch (error) {
        errorHandler("Failed to sort slot content!", { description: error });
      }

      if (isScene) {
        getDefaultSlotContent();
      } else {
        getSlotContentWithBooking();
      }
    }
  };

  const findActiveContentIndex = () => {
    const selectedBookingId = selectedBooking?.id || params.bookingId;
    const selectedSlotId = selectedSlot.slotInfo.id || params.slotId;
    if (selectedBookingId && selectedSlotId) {
      const liveBooking = bookingStates.find(
        (stateItem) => +stateItem.booking.id === +selectedBookingId
      );
      if (liveBooking) {
        const liveSlot = liveBooking.bookedSlots.find(
          (bookedSlot) => +bookedSlot.slotId === +selectedSlotId
        );
        if (liveSlot) {
          setActiveContentIndex(liveSlot.contentIndex);
        }
      }
    }
  };

  const openLoadedModal = () => {
    setIsShowLoadedModal((prev) => !prev);
    setIsShowAddMenu(false);
    getLoadedResources();
  };

  const getLoadedResources = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/resources?types=image&types=video`,
      });
      if (res.result && Array.isArray(res.result)) {
        setLoadedResource(res.result as ILoadedResourceItem[]);
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get loaded resources!", res.error, () =>
          setIsShowLoadedModal(false)
        );
      }
      setIsResourcesListLoaded(true);
    } catch (error) {
      errorHandler("Can't get loaded resources!", { description: error }, () =>
        setIsShowLoadedModal(false)
      );
    }
  };

  const setLoadedResourceToContent = async (
    ev: React.MouseEvent<HTMLDivElement>
  ) => {
    const resId: string | undefined = ev.currentTarget.dataset.res_id;
    const resType: string | undefined = ev.currentTarget.dataset.res_type;
    if (resId && resType) {
      let url: string | null = null;
      if (resType === "image" || resType === "video") {
        url = `${backendUrl}/contents?slot=${
          selectedSlot.slotInfo.id || params.slotId
        }&resource=${resId}`;
      }
      if (!props.isScene && url) {
        url = url.concat(`&booking=${selectedBooking?.id || params.bookingId}`);
      }
      if (url) {
        try {
          const res = await processApi({ url, method: "POST" });
          const bookingId = selectedBooking?.id || params.bookingId;
          if (bookingId) getBookingContentLimit("slot", bookingId);
          if (res.error.statusCode || res.error.description) {
            errorHandler(
              "Failed to process loaded resources data!",
              res.error,
              () => setIsShowLoadedModal(false)
            );
          }
        } catch (error) {
          errorHandler(
            "Failed to process loaded resources data!",
            { description: error },
            () => setIsShowLoadedModal(false)
          );
        }

        if (isScene) {
          getDefaultSlotContent();
        } else {
          getSlotContentWithBooking();
        }
      }
      setIsShowLoadedModal((prev) => !prev);
    } else {
      throw new Error("Missing resource and type in loaded resources list");
    }
  };

  const generateURL = async () => {
    let id: string | null = null;
    const locationId = selectedLocation || params.locationId;
    const slotId = selectedSlot.slotInfo.id || params.slotId;
    for (const locType in locationsSchema) {
      if (
        locationsSchema[locType].locations &&
        locationsSchema[locType].locations!.length
      ) {
        const currentLocation = locationsSchema[locType].locations!.find(
          (locItem) => {
            if (selectedLocation === locItem.id) {
              return locItem;
            } else return false;
          }
        );
        if (currentLocation && currentLocation.scene) {
          id = currentLocation.scene;
        }
      }
    }

    if (id && locationId && slotId) {
      const fullUrl = buildUrlToScene(id, locationId, slotId.toString());
      setUrlToScreen(fullUrl);
    } else {
      throw new Error(
        "Can't find correct location to set the teleport to screen link on scene"
      );
    }
  };

  const getRealmName = (): string | undefined => {
    const locId = selectedLocation || params.locationId || null;
    const locData = findLocation(locId, locationsSchema);
    if (locData && locData.scene) {
      const splitSceneData = locData.scene.split(":");
      if (splitSceneData.length >= 2 && splitSceneData[1].length) {
        return splitSceneData[1];
      }
    }
  };

  const containerHeightAdapter = () => {
    const modalElem: HTMLElement | null =
      (streamingModalRef.current as HTMLElement | null) ||
      (loadedResModalRef.current as HTMLElement | null);

    const containerElem: HTMLElement | null =
      componentContainerRef.current as HTMLElement | null;

    const titleElem: HTMLElement | null =
      titleContainerRef.current as HTMLElement | null;
    const contentListelem: HTMLElement | null =
      contentListContainerRef.current as HTMLElement | null;

    if (titleElem && contentListelem && containerElem) {
      const titleHeight: number = titleElem.getBoundingClientRect().height;
      const contentHeight: number =
        contentListelem.getBoundingClientRect().height;
      containerElem.style.minHeight = `${titleHeight + contentHeight}px`;
    }

    if (modalElem && containerElem) {
      const containerHeight: number =
        containerElem.getBoundingClientRect().height;
      const modalHeight: number = modalElem.getBoundingClientRect().height;

      if (modalHeight > containerHeight) {
        containerElem.style.minHeight = `${modalHeight}px`;
      }
    }
  };

  const handleWindowClick = (event: MouseEvent) => {
    const getDataset = (elem: HTMLElement): string | null => {
      const clickOnModal = elem.dataset.loaded_res_modal;
      if (clickOnModal) {
        return clickOnModal;
      } else {
        const parentElem = elem.parentElement;
        if (parentElem) {
          return getDataset(parentElem);
        } else return null;
      }
    };
    if (event.target) {
      const clickOnModal = getDataset(event.target as HTMLElement);
      if (clickOnModal !== "loaded_res_modal") setIsShowLoadedModal(false);
    }
  };

  useEffect(() => {
    const bookingId = selectedBooking?.id || params.bookingId;
    if (!selectedBooking && !isScene) getSelectedBookingData();
    if (!selectedLocation && params.locationId) {
      setSelectedLocation(params.locationId);
    }
    if (isScene) {
      getDefaultSlotContent();
    } else {
      getSlotContentWithBooking();
    }
    breadcrumbSync();
    if (bookingId) getBookingContentLimit("slot", bookingId);

    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, []);

  useEffect(() => {
    if (params.slotId && locationsSchema) {
      getSlotInfo(locationsSchema, +params.slotId);
    }
    if (locationsSchema) generateURL();
  }, [locationsSchema, selectedSlot.slotInfo.id]);

  useEffect(() => {
    findActiveContentIndex();
  }, [selectedBooking, selectedSlot, bookingStates]);

  useEffect(() => {
    containerHeightAdapter();
  }, [isShowInfoModal, isShowLoadedModal, loadedResource]);

  return (
    <div ref={componentContainerRef}>
      <div className={slot_styles.slot_title_wrap} ref={titleContainerRef}>
        <p className={slot_styles.slot_title}>{selectedSlot.slotInfo.name}</p>
        <div className={`${slot_styles.slot_add_content_controls_wrap}`}>
          <div className={`${slot_styles.slot_add_content_buttons_wrap}`}>
            <div className={slot_styles.slot_link_to_scene_wrap}>
              <a
                target="_blank"
                rel="noopener noreferrer"
                className={slot_styles.slot_link_to_scene}
                href={urlToScreen ? urlToScreen : "#"}
              >
                <img width={25} height={25} src="/logo.svg" alt="dcl_icon" />
                <span>Go To Scene</span>
              </a>
            </div>
            <button
              className={`${slot_styles.slot_add_content_button} ${
                isShowAddMenu ? slot_styles.slot_add_content_button__active : ""
              }`}
              onClick={() => setIsShowAddMenu((prev) => !prev)}
            >
              <span>ADD CONTENT</span>
              <svg
                width="9"
                height="5"
                viewBox="0 0 9 5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.1816 4.35365C4.37686 4.54892 4.69345 4.54892 4.88871 4.35365L8.07069 1.17167C8.26595 0.976411 8.26595 0.659828 8.07069 0.464566C7.87543 0.269304 7.55885 0.269304 7.36358 0.464566L4.53516 3.29299L1.70673 0.464566C1.51147 0.269304 1.19488 0.269304 0.999622 0.464566C0.80436 0.659828 0.80436 0.976411 0.999622 1.17167L4.1816 4.35365ZM4.03516 4V4.0001H5.03516V4H4.03516Z"
                  fill="white"
                />
              </svg>
            </button>
          </div>
          {limit.slotContent.content_count !== null &&
          limit.slotContent.limit !== null ? (
            <div
              className={`${slot_styles.slot_list_limit_wrap} ${slot_styles.slot_list_limit_wrap__slot}`}
            >
              <p className={slot_styles.slot_list_limit_label}>Images limit</p>
              <p
                className={slot_styles.slot_list_limit}
              >{`${limit.slotContent.content_count}/${limit.slotContent.limit}`}</p>
            </div>
          ) : null}
        </div>
        {isShowAddMenu ? (
          <div
            className={`${slot_styles.slot_add_content_modal} 
            ${
              selectedSlot.slotInfo.trigger &&
              !selectedSlot.slotInfo.supportsStreaming
                ? slot_styles.slot_add_content_modal_with_video
                : ""
            }
            ${
              selectedSlot.slotInfo.supportsStreaming
                ? slot_styles.slot_add_content_modal_with_streaming
                : ""
            }`}
          >
            <Link
              onClick={() => {
                setBreadcrumbsParts({
                  newPart: {
                    name: "add img",
                    path: "/add_img",
                    level: 5,
                  },
                });
              }}
              to={"add_img"}
            >
              Image
            </Link>
            {selectedSlot.slotInfo.trigger ? (
              <Link
                onClick={() => {
                  setBreadcrumbsParts({
                    newPart: {
                      name: "add video",
                      path: "/add_video",
                      level: 5,
                    },
                  });
                }}
                to={"add_video"}
              >
                Video
              </Link>
            ) : null}
            {selectedSlot.slotInfo.supportsStreaming ? (
              <Link
                onClick={() => {
                  setBreadcrumbsParts({
                    newPart: {
                      name: "streaming",
                      path: "/streaming",
                      level: 5,
                    },
                  });
                }}
                to={"streaming"}
              >
                Streaming
              </Link>
            ) : null}
            <button
              data-loaded_res_modal={"loaded_res_modal"}
              onClick={openLoadedModal}
            >
              Loaded
            </button>
          </div>
        ) : null}
      </div>
      {isContentLoaded ? (
        <div
          className={slot_styles.slot_items_container}
          ref={contentListContainerRef}
        >
          {selectedSlot &&
          selectedSlot.content &&
          selectedSlot.content.length ? (
            selectedSlot.content.map((contentItem, index) => (
              <div
                data-order={contentItem.order_id}
                data-index={index}
                draggable={true}
                className={`${slot_styles.slot_item} ${
                  index === activeContentIndex
                    ? slot_styles.slot_item__active
                    : ""
                }`}
                key={hashCode(`${contentItem.name}${index}`)}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <ContentItem
                  contentItem={contentItem}
                  getSlotContent={
                    isScene ? getDefaultSlotContent : getSlotContentWithBooking
                  }
                  isActiveItem={index === activeContentIndex}
                  currentContentIndex={index}
                />
              </div>
            ))
          ) : (
            <p className={slot_styles.slot_items_default_value}>
              Add content using button above.
            </p>
          )}
        </div>
      ) : (
        <div className={loaders.loader_ring} />
      )}
      {isShowLoadedModal ? (
        <div
          className={loaded_styles.loaded_content_list_modal}
          ref={loadedResModalRef}
          data-loaded_res_modal={"loaded_res_modal"}
        >
          <div className={loaded_styles.loaded_content_list_modal_title_wrap}>
            <p className={loaded_styles.loaded_content_list_modal_title}>
              Previously loaded files:
            </p>
            <div
              className={
                loaded_styles.loaded_content_list_modal_close_button_wrap
              }
            >
              <button
                onClick={() => setIsShowLoadedModal((prev) => !prev)}
                className={loaded_styles.loaded_content_list_modal_close_button}
              >
                <img src="/icons/close.svg" alt="close_icon" />
              </button>
            </div>
          </div>
          {isResourcesListLoaded ? (
            loadedResource && loadedResource.length ? (
              loadedResource.map((resourceItem, index) => {
                if (
                  resourceItem.type === "image" ||
                  (resourceItem.type === "video" &&
                    selectedSlot.slotInfo.trigger) ||
                  resourceItem.type === "music"
                ) {
                  return (
                    <div
                      className={loaded_styles.loaded_content_list_item}
                      key={hashCode(`${resourceItem.s3_urn}${index}`)}
                    >
                      <LoadedResourceItem
                        setLoadedResourceToContent={setLoadedResourceToContent}
                        getLoadedResources={getLoadedResources}
                        resourceItem={resourceItem}
                      />
                    </div>
                  );
                }
              })
            ) : (
              <p className={slot_styles.slot_list_empty_msg}>
                There are no files available
              </p>
            )
          ) : (
            <div className={loaders.loader_ring} />
          )}
        </div>
      ) : null}
      {isShowInfoModal ? (
        <div
          className={slot_styles.slot_item_info_modal}
          data-streaming_info_modal={"streaming_info_modal"}
          ref={streamingModalRef}
        >
          <div
            className={
              loaded_styles.loaded_content_list_modal_close_button_wrap
            }
          >
            <button
              onClick={() => setIsShowInfoModal(false)}
              className={loaded_styles.loaded_content_list_modal_close_button}
            >
              <img src="/icons/close.svg" alt="close_icon" />
            </button>
          </div>
          <p className={slot_styles.slot_item_info_modal_title}>
            Streaming Setup Guide
          </p>
          <StreamingInfo worldName={getRealmName()} />
        </div>
      ) : null}
    </div>
  );
};

const ContentItem = (props: {
  contentItem: IContentItem;
  getSlotContent: () => void;
  isActiveItem: boolean;
  currentContentIndex: number;
}) => {
  const { contentItem, getSlotContent, isActiveItem, currentContentIndex } =
    props;
  const [isDelContConfirmModal, setIsDelContConfirmModal] =
    useState<boolean>(false);
  const [currentBookingState, setCurrentBookingState] =
    useState<IBookingStateItem | null>(null);
  const [contentIdToDel, setContentIdToDel] = useState<number | null>(null);
  const [isVideoPaused, setIsVideoPaused] = useState<boolean>(false);
  const { setResourceToEdit } = resourceToEditStore();
  const { setBreadcrumbsParts } = breadcrumbStore();
  const { bookingStates, setBookingStates } = liveBookingsWsStore();
  const { selectedBooking } = selectedBookingStore();
  const { selectedSlot } = selectedSlotStore();
  const params = useParams();
  const { setIsShowInfoModal } = streamingInfoModalStore();

  const switchConfirmContentDel = (contentId: number) => {
    setContentIdToDel(contentId);
    setIsDelContConfirmModal((prev) => !prev);
  };

  const saveContentEditData = (
    resourceItem: IContentItem,
    breadcrumbsItem: IBreadcrumbItem
  ) => {
    const resItem = {
      id: resourceItem.resource_id,
      name: resourceItem.name,
      s3_urn: resourceItem.s3_urn,
      preview: resourceItem.preview,
    };
    setResourceToEdit(resItem);
    setBreadcrumbsParts({
      newPart: breadcrumbsItem,
    });
  };

  const handleContentItemDel = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/contents?content_id=${contentIdToDel}`,
        method: "DELETE",
      });
      const bookingId = selectedBooking?.id || params.bookingId;
      if (bookingId) getBookingContentLimit("slot", bookingId);
      if (res.error.statusCode || res.error.description) {
        errorHandler("Failed to delete the selected content item!", res.error);
      }
    } catch (error) {
      errorHandler("Failed to delete the selected content item!", {
        description: error,
      });
    }

    setIsDelContConfirmModal((prev) => !prev);
    getSlotContent();
  };

  const getCurrentIndex = (elem: HTMLElement): string | null => {
    if (elem.dataset.index) {
      return elem.dataset.index;
    } else {
      if (elem.parentElement) {
        return getCurrentIndex(elem.parentElement);
      } else return null;
    }
  };

  const findSelectedBookingState = () => {
    const selectedBookingId = selectedBooking?.id || params.bookingId;
    const bookingState = bookingStates.find(
      (bookingStateItem) => bookingStateItem.booking.id === selectedBookingId
    );
    if (bookingState) {
      setCurrentBookingState(bookingState);
    } else {
      setCurrentBookingState(null);
    }
  };

  const handleSelectContentToShow = (
    ev: React.MouseEvent<HTMLElement>,
    isPaused: boolean,
    contentType: string,
    buttonType: "switch" | "show_video"
  ) => {
    const elem: HTMLElement = ev.currentTarget;
    const selectedIndex = getCurrentIndex(elem);
    const slotId = selectedSlot.slotInfo.id || params.slotId;
    if (contentType === "video" && buttonType === "show_video") {
      isPaused = !isPaused;
      setIsVideoPaused(isPaused);
    } else if (contentType === "video" && buttonType === "switch") {
      isPaused = false;
      setIsVideoPaused(isPaused);
    }

    if (selectedIndex) {
      if (currentBookingState?.bookingSocket) {
        currentBookingState.bookingSocket.send(
          JSON.stringify({
            type: "switch-content",
            data: {
              slot: slotId,
              content_index: +selectedIndex,
              is_paused: isPaused,
            },
          })
        );
      }
      if (currentBookingState) {
        const bookingsStateCopy: IBookingStateItem[] = [...bookingStates];
        const currentElemInPrevVal = bookingsStateCopy.find(
          (prevBooking) =>
            prevBooking.booking.id === currentBookingState.booking.id
        );
        if (currentElemInPrevVal) {
          const stateIndex = bookingsStateCopy.indexOf(currentElemInPrevVal);
          const slotInPrevVal = bookingsStateCopy[stateIndex].bookedSlots.find(
            (prevSlotItem) => prevSlotItem.slotId === slotId
          );
          if (slotInPrevVal) {
            const stateSlotIndex =
              bookingsStateCopy[stateIndex].bookedSlots.indexOf(slotInPrevVal);
            bookingsStateCopy[stateIndex].bookedSlots[
              stateSlotIndex
            ].contentIndex = +selectedIndex;
            bookingsStateCopy[stateIndex].bookedSlots[stateSlotIndex].isPaused =
              isPaused;
            setBookingStates(bookingsStateCopy);
            setCurrentBookingState({
              ...currentBookingState,
              bookedSlots: bookingsStateCopy[stateIndex].bookedSlots,
            });
          }
        }
      }
    }
  };

  const syncVideoPlayingState = () => {
    if (currentBookingState) {
      const slotToUpdate = currentBookingState.bookedSlots.find(
        (slotItem) => slotItem.slotId === contentItem.slot
      );
      if (slotToUpdate) {
        if (slotToUpdate.contentIndex === currentContentIndex) {
          setIsVideoPaused(Boolean(slotToUpdate.isPaused));
        }
      }
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    syncVideoPlayingState();
  }, [currentBookingState]);

  useEffect(() => {
    findSelectedBookingState();
  }, [selectedBooking, selectedSlot, bookingStates]);

  return (
    <>
      <ImageInList
        type={contentItem.type}
        url={contentItem.s3_urn}
        preview={contentItem.preview}
      />
      <div className={slot_styles.slot_item_description_wrap}>
        <p className={slot_styles.slot_item_description}>{contentItem.name}</p>
        {contentItem.type === "video" ? (
          <a
            className={slot_styles.slot_item_link_to_content}
            href={contentItem.s3_urn}
          >
            {contentItem.s3_urn.length > 60
              ? contentItem.s3_urn.slice(0, 75).concat("...")
              : contentItem.s3_urn}
          </a>
        ) : null}
        {contentItem.type === "streaming" ? (
          <div
            className={slot_styles.slot_item_info_btn}
            onClick={() => setIsShowInfoModal(true)}
            data-streaming_info_modal={"streaming_info_modal"}
          >
            <button
              className={slot_styles.slot_item_edit_btn}
              data-streaming_info_modal={"streaming_info_modal"}
            >
              <img
                data-streaming_info_modal={"streaming_info_modal"}
                src="/icons/info.svg"
                alt="info_icon"
              />
            </button>
            <p data-streaming_info_modal={"streaming_info_modal"}>
              Click to view the streaming setup guide
            </p>
          </div>
        ) : null}
      </div>

      <p className={slot_styles.slot_item_type}>{contentItem.type}</p>
      <div
        className={slot_styles.slot_item_edit_btns_wrap}
        data-content_id={contentItem.content_id}
      >
        {contentItem.type === "video" ? (
          <div>
            <Link
              to={`edit_video/${contentItem.resource_id}`}
              onClick={() =>
                saveContentEditData(contentItem, {
                  name: "edit video",
                  path: `/edit_video/${contentItem.resource_id}`,
                  level: 5,
                })
              }
              className={slot_styles.slot_item_edit_btn}
            >
              <img src="/icons/edit.svg" alt="edit_icon" />
            </Link>
          </div>
        ) : null}
        <div data-modal_btn_prefix={`content_${contentItem.content_id}_del`}>
          <button
            data-modal_btn_prefix={`content_${contentItem.content_id}_del`}
            className={slot_styles.slot_item_edit_btn}
            onClick={() => switchConfirmContentDel(contentItem.content_id)}
          >
            <img
              data-modal_btn_prefix={`content_${contentItem.content_id}_del`}
              src="/icons/basket.svg"
              alt="delete_icon"
            />
          </button>
        </div>
      </div>
      {currentBookingState ? (
        <div className={slot_styles.slot_item_show_now_btn_wrap}>
          <button
            onClick={(ev: React.MouseEvent<HTMLElement>) =>
              handleSelectContentToShow(
                ev,
                isVideoPaused,
                contentItem.type,
                "switch"
              )
            }
            className={`${slot_styles.slot_item_show_now_btn} ${
              isActiveItem ? slot_styles.slot_item_show_now_btn__active : ""
            }`}
          >
            Show
          </button>
          {contentItem.type === "video" ? (
            <button
              onClick={(ev: React.MouseEvent<HTMLElement>) =>
                handleSelectContentToShow(
                  ev,
                  isVideoPaused,
                  contentItem.type,
                  "show_video"
                )
              }
              className={`${slot_styles.slot_item_show_now_btn} ${
                slot_styles.slot_item_show_now_btn__video
              } ${
                isActiveItem ? slot_styles.slot_item_show_now_btn__active : ""
              }`}
            >
              <img
                src={isVideoPaused ? "/icons/play.svg" : "/icons/pause.svg"}
                alt="video_play_button"
              />
              <span>{isVideoPaused ? "Play" : "Pause"}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      {isDelContConfirmModal ? (
        <ConfirmActionModal
          actionMsg="Do you want to remove"
          contentType={contentItem.type}
          itemName={contentItem.name}
          yesActionEvent={handleContentItemDel}
          noActionEvent={() => setIsDelContConfirmModal((prev) => !prev)}
          modalPrefix={`content_${contentItem.content_id}_del`}
        />
      ) : null}
    </>
  );
};

const ImageInList = (props: {
  type: string;
  url: string;
  preview: string | null;
}) => {
  const { type, url, preview } = props;
  const { selectedSlot } = selectedSlotStore();
  const [isImgLoaded, setIsImgLoaded] = useState<boolean>(false);

  const getImgPreviewStyle = () => {
    switch (selectedSlot.slotInfo.format) {
      case SCREEN_FORMATS.STANDARD_WIDE:
        return {
          booking: slot_styles.slot_item_content_preview_wrap_standard_wide,
          loader: loaders.img_loader_standard_wide,
        };

      case SCREEN_FORMATS.STANDARD_NARROW:
        return {
          booking: slot_styles.slot_item_content_preview_wrap_standard_narrow,
          loader: loaders.img_loader_standard_narrow,
        };

      case SCREEN_FORMATS.RECTANGULAR:
        return {
          booking: slot_styles.slot_item_content_preview_wrap_rectangular,
          loader: loaders.img_loader_rectangular,
        };

      case SCREEN_FORMATS.RECTANGULAR_NARROW:
        return {
          booking:
            slot_styles.slot_item_content_preview_wrap_rectangular_narrow,
          loader: loaders.img_loader_rectangular_narrow,
        };

      case SCREEN_FORMATS.ULTRA_WIDE:
        return {
          booking: slot_styles.slot_item_content_preview_wrap_ultra_wide,
          loader: loaders.img_loader_ultra_wide,
        };

      default:
        return {
          booking: slot_styles.slot_item_content_preview_wrap_standard_wide,
          loader: loaders.img_loader_standard_wide,
        };
    }
  };

  return (
    <>
      {(function () {
        const containerSize = getImgPreviewStyle();
        return (
          <div className={containerSize.booking}>
            <div
              className={`${loaders.img_loader} ${containerSize.loader} ${
                isImgLoaded
                  ? loaders.img_hidden_state
                  : loaders.img_visible_state
              }`}
            >
              <img
                draggable={false}
                src="/icons/image.svg"
                alt="loader_img_icon"
              />
            </div>
            <img
              draggable={false}
              className={`${slot_styles.slot_item_content_preview_img} ${
                isImgLoaded
                  ? loaders.img_visible_state
                  : loaders.img_hidden_state
              }`}
              src={
                preview ? preview : type === "image" ? url : "/icons/image.svg"
              }
              alt="content_preview"
              onLoad={() => setIsImgLoaded(true)}
            />
          </div>
        );
      })()}
    </>
  );
};

export const LoadedResourceItem = (props: {
  resourceItem: ILoadedResourceItem;
  setLoadedResourceToContent: (
    ev: React.MouseEvent<HTMLDivElement>
  ) => Promise<void>;
  getLoadedResources: () => Promise<void>;
}) => {
  const { resourceItem, setLoadedResourceToContent, getLoadedResources } =
    props;
  const [resourceIdToDel, setResourceIdToDel] = useState<number | null>(null);
  const [isDelResConfirmModal, setIsDelResConfirmModal] =
    useState<boolean>(false);

  const handleRemoveResItem = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/resources/${resourceIdToDel}`,
        method: "DELETE",
      });
      if (res.error.statusCode || res.error.description) {
        errorHandler("Failed to delete the selected resource item!", res.error);
      }
    } catch (error) {
      errorHandler("Failed to delete the selected resource item!", {
        description: error,
      });
    }

    getLoadedResources();
    setIsDelResConfirmModal((prev) => !prev);
  };

  const switchConfirmResourceDel = (resourceId: number) => {
    setResourceIdToDel(resourceId);
    setIsDelResConfirmModal((prev) => !prev);
  };

  return (
    <>
      <div
        className={`${
          loaded_styles.loaded_content_list_item_click_action_block
        } ${
          resourceItem.type === "music"
            ? loaded_styles.loaded_content_list_item_click_action_block__music
            : ""
        }`}
        data-res_id={resourceItem.id}
        data-res_type={resourceItem.type}
        onClick={setLoadedResourceToContent}
      >
        {resourceItem.type === "image" || resourceItem.type === "video" ? (
          <>
            <ImageInList
              type={resourceItem.type}
              url={resourceItem.s3_urn}
              preview={resourceItem.preview}
            />
            <p className={loaded_styles.loaded_content_list_item_name}>
              {resourceItem.name}
            </p>
            <p className={loaded_styles.loaded_content_list_item_type}>
              {resourceItem.type}
            </p>
          </>
        ) : resourceItem.type === "music" ? (
          <>
            <p
              className={
                loaded_styles.loaded_content_list_item_click_action_block_item_name
              }
            >
              {resourceItem.name}
            </p>
            <div
              className={
                loaded_styles.loaded_content_list_item_click_action_block_audio_res
              }
            >
              <audio controls>
                <source src={resourceItem.s3_urn} type="audio/mpeg" />
              </audio>
            </div>
          </>
        ) : null}
      </div>
      <div
        data-modal_btn_prefix={`resource_${resourceItem.id}_del`}
        className={loaded_styles.loaded_content_list_item_del_btn_wrap}
      >
        <button
          data-modal_btn_prefix={`resource_${resourceItem.id}_del`}
          className={slot_styles.slot_item_edit_btn}
          onClick={() => switchConfirmResourceDel(resourceItem.id)}
        >
          <img
            data-modal_btn_prefix={`resource_${resourceItem.id}_del`}
            src="/icons/basket.svg"
            alt="delete_icon"
          />
        </button>
      </div>
      {isDelResConfirmModal ? (
        <div data-loaded_res_modal={"loaded_res_modal"}>
          <ConfirmActionModal
            actionMsg="Do you want to remove"
            contentType={resourceItem.type}
            itemName={resourceItem.name}
            yesActionEvent={handleRemoveResItem}
            noActionEvent={() => setIsDelResConfirmModal((prev) => !prev)}
            modalPrefix={`resource_${resourceItem.id}_del`}
          />
        </div>
      ) : null}
    </>
  );
};
