import { useEffect, useRef, useState } from "react";
import { backendUrl } from "../../main";
import processApi from "../../scripts/processApi";
import loaders from "../../styles/modules/loaders.module.scss";
import slot_styles from "../../styles/modules/slot.module.scss";
import loaded_styles from "../../styles/modules/prevLoadedCont.module.scss";
import content_form_styles from "../../styles/modules/contentForm.module.scss";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  bookingContentLimitStore,
  breadcrumbStore,
  selectedBookingStore,
  selectedLocationStore,
} from "../../store/store";
import { hashCode } from "../../scripts/hashCode";
import { ILoadedResourceItem, LoadedResourceItem } from "./SlotItem";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { errorHandler } from "../../scripts/errorHandler";
import { getBookingContentLimit } from "../../scripts/getBookingContentLimit";

export interface IMusicItem {
  booking: number;
  content_id: number;
  location_id: string;
  name: string;
  order_id: number;
  resource_id: number;
  s3_urn: string;
  type: string;
}

export const MusicLocationItem = (props: { isScene: boolean }) => {
  const [isContentLoaded, setIsContentLoaded] = useState<boolean>(false);
  const { selectedLocation } = selectedLocationStore();
  const { selectedBooking } = selectedBookingStore();
  const { setBreadcrumbsParts } = breadcrumbStore();
  const { limit } = bookingContentLimitStore();
  const [musicData, setMusicData] = useState<IMusicItem[] | null>(null);
  const [dragResOrder, setDragResOrder] = useState<{
    start: number | null;
    drop: number | null;
  }>({ start: null, drop: null });
  const [isShowModalForAdding, setIsShowModalForAdding] =
    useState<boolean>(false);
  const [isShowLoadedModal, setIsShowLoadedModal] = useState<boolean>(false);
  const [loadedResource, setLoadedResource] = useState<
    ILoadedResourceItem[] | null
  >(null);
  const [isResourcesListLoaded, setIsResourcesListLoaded] =
    useState<boolean>(false);
  const params = useParams();
  const navigate = useNavigate();

  const loadedResModalRef = useRef(null);
  const componentContainerRef = useRef(null);
  const titleContainerRef = useRef(null);
  const contentListContainerRef = useRef(null);

  const getMusicData = async () => {
    setIsContentLoaded(false);
    let url: string = `${backendUrl}/music?location_id=${
      selectedLocation || params.locationId
    }`;
    if (!props.isScene) {
      url = url.concat(
        `&booking_id=${selectedBooking?.id || params.bookingId}`
      );
    }
    try {
      const res = await processApi({ url });
      if (res.result && Array.isArray(res.result)) {
        setMusicData(res.result);
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get music data!", res.error, () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        });
      }
    } catch (error) {
      errorHandler("Can't get music data!", { description: error }, () => {
        navigate(-1);
        window.history.replaceState({}, window.location.href);
      });
    }
    setIsContentLoaded(true);
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
    if (!musicData || !dragResOrder.start || !dragResOrder.drop) {
      return;
    }

    musicData.sort((a, b) => a.order_id - b.order_id);

    const min = Math.min(dragResOrder.start, dragResOrder.drop);
    const max = Math.max(dragResOrder.start, dragResOrder.drop);
    const sign = Math.sign(dragResOrder.drop - dragResOrder.start);

    for (const item of musicData) {
      if (item.order_id === dragResOrder.start) {
        item.order_id = dragResOrder.drop;
      } else if (item.order_id === dragResOrder.drop) {
        item.order_id = dragResOrder.drop - sign;
      } else if (min < item.order_id && item.order_id < max) {
        item.order_id -= sign;
      }
    }

    musicData.sort((a, b) => a.order_id - b.order_id);

    const body: { [key: string]: number } = {};
    musicData.forEach((item, index) => {
      body[item.content_id] = index + 1;
    });

    if (Object.keys(body).length) {
      try {
        const res = await processApi({
          url: `${backendUrl}/music/order`,
          method: "PATCH",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
        });
        if (res.error.statusCode || res.error.description) {
          errorHandler("Failed to sort music content!", res.error);
        }
      } catch (error) {
        errorHandler("Failed to sort music content!", { description: error });
      }

      getMusicData();
    }
  };

  const getLoadedResources = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/resources?types=music`,
      });
      if (res.result && Array.isArray(res.result)) {
        setLoadedResource(res.result);
      }
      setIsResourcesListLoaded(true);
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get loaded resources!", res.error, () =>
          setIsShowLoadedModal(false)
        );
      }
    } catch (error) {
      errorHandler("Can't get loaded resources!", { description: error }, () =>
        setIsShowLoadedModal(false)
      );
    }
  };

  const openLoadedModal = () => {
    setIsShowLoadedModal((prev) => !prev);
    setIsShowModalForAdding(false);
    getLoadedResources();
  };

  const setLoadedResourceToContent = async (
    ev: React.MouseEvent<HTMLDivElement>
  ) => {
    const resId: string | undefined = ev.currentTarget.dataset.res_id;
    const resType: string | undefined = ev.currentTarget.dataset.res_type;
    if (resId && resType) {
      let url: string | null = null;
      if (resType === "music") {
        url = `${backendUrl}/music?location=${
          selectedLocation || params.locationId
        }&resource=${resId}`;
      }
      if (!props.isScene && url) {
        url = url.concat(`&booking=${selectedBooking?.id || params.bookingId}`);
      }
      if (url) {
        try {
          const res = await processApi({ url, method: "POST" });
          if (res.error.statusCode || res.error.description) {
            errorHandler(
              "Failed to process loaded resources data!",
              res.error,
              () => setIsShowLoadedModal(false)
            );
          }
          const bookingId = selectedBooking?.id || params.bookingId;
          if (bookingId) getBookingContentLimit("music", bookingId);
        } catch (error) {
          errorHandler(
            "Failed to process loaded resources data!",
            { description: error },
            () => setIsShowLoadedModal(false)
          );
        }
        await getMusicData();
      }
      setIsShowLoadedModal((prev) => !prev);
    } else {
      throw new Error("Missing resource and type in loaded resources list");
    }
  };

  const containerHeightAdapter = () => {
    const modalElem: HTMLElement | null =
      loadedResModalRef.current as HTMLElement | null;

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
    getMusicData();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (bookingId) getBookingContentLimit("music", bookingId);

    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, []);

  useEffect(() => {
    containerHeightAdapter();
  }, [isShowLoadedModal, loadedResource]);

  return (
    <div ref={componentContainerRef}>
      <div className={slot_styles.slot_title_wrap} ref={titleContainerRef}>
        <p className={slot_styles.slot_title}>
          Music settings in{" "}
          <span className={slot_styles.slot_title_brown}>
            {(selectedLocation || params.locationId)?.replace(/_/g, " ")}{" "}
          </span>
          location
        </p>
        <div
          className={`${slot_styles.slot_add_content_controls_wrap} ${slot_styles.slot_add_content_controls_wrap__music}`}
        >
          <div className={`${content_form_styles.form_music_item_button_wrap}`}>
            <button
              className={`${slot_styles.slot_add_content_button} ${
                isShowModalForAdding
                  ? slot_styles.slot_add_content_button__active
                  : ""
              }`}
              onClick={() => setIsShowModalForAdding((prev) => !prev)}
            >
              <span>ADD MUSIC</span>
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
          {limit.music.content_count !== null && limit.music.limit !== null ? (
            <div
              className={`${slot_styles.slot_list_limit_wrap} ${slot_styles.slot_list_limit_wrap__music}`}
            >
              <p className={slot_styles.slot_list_limit_label}>Music limit</p>
              <p
                className={slot_styles.slot_list_limit}
              >{`${limit.music.content_count}/${limit.music.limit}`}</p>
            </div>
          ) : null}
        </div>
        {isShowModalForAdding ? (
          <div
            className={`${slot_styles.slot_add_content_modal} ${content_form_styles.form_music_add_content_modal}`}
          >
            <Link
              to={"add_music"}
              onClick={() => {
                setBreadcrumbsParts({
                  newPart: {
                    level: 5,
                    path: "/add_music",
                    name: "add music",
                  },
                });
              }}
            >
              New File
            </Link>
            <button
              data-loaded_res_modal={"loaded_res_modal"}
              onClick={openLoadedModal}
            >
              Loaded
            </button>
          </div>
        ) : null}
      </div>
      <div ref={contentListContainerRef}>
        {isContentLoaded ? (
          musicData && musicData.length ? (
            musicData.map((musicItem) => (
              <div
                className={content_form_styles.form_music_item_grid_wrap}
                key={hashCode(`${musicItem.s3_urn}`)}
                data-order={musicItem.order_id}
                draggable={true}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <ContentItem
                  musicItem={musicItem}
                  getMusicData={getMusicData}
                />
              </div>
            ))
          ) : (
            <p className={slot_styles.slot_list_empty_msg}>
              There is no music in {selectedLocation || params.locationId}
            </p>
          )
        ) : (
          <div className={loaders.loader_ring} />
        )}
      </div>
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
              loadedResource.map((resourceItem, index) => (
                <div
                  className={loaded_styles.loaded_content_list_item}
                  key={hashCode(`${resourceItem.s3_urn}${index}`)}
                  data-res_id={resourceItem.id}
                  data-res_type={resourceItem.type}
                >
                  <LoadedResourceItem
                    resourceItem={resourceItem}
                    setLoadedResourceToContent={setLoadedResourceToContent}
                    getLoadedResources={getLoadedResources}
                  />
                </div>
              ))
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
    </div>
  );
};

const ContentItem = (itemProps: {
  musicItem: IMusicItem;
  getMusicData: () => Promise<void>;
}) => {
  const { musicItem, getMusicData } = itemProps;
  const { selectedBooking } = selectedBookingStore();
  const [isDelConfirmModal, setIsDelConfirmModal] = useState<boolean>(false);
  const [musicIdToDel, setMusicIdToDel] = useState<number | null>(null);
  const params = useParams();

  const switchConfirmContentDel = (idToDel: number) => {
    setMusicIdToDel(idToDel);
    setIsDelConfirmModal((prev) => !prev);
  };

  const handleMusicItemDel = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/music/playlist?music_id=${musicIdToDel}`,
        method: "DELETE",
      });
      const bookingId = selectedBooking?.id || params.bookingId;
      if (bookingId) getBookingContentLimit("music", bookingId);
      if (res.error.statusCode || res.error.description) {
        errorHandler("Failed to delete the selected music item!", res.error);
      }
    } catch (error) {
      errorHandler("Failed to delete the selected music item!", {
        description: error,
      });
    }
    await getMusicData();
    setIsDelConfirmModal((prev) => !prev);
  };

  return (
    <>
      <div className={content_form_styles.form_music_item_audio_res_wrap}>
        <audio controls>
          <source src={musicItem.s3_urn} type="audio/mpeg" />
        </audio>
      </div>
      <p className={content_form_styles.form_music_item_filename}>
        {musicItem.name}
      </p>
      <div
        data-modal_btn_prefix={`music_${musicItem.content_id}_del`}
        className={content_form_styles.form_music_item_del_button_wrap}
      >
        <button
          data-modal_btn_prefix={`music_${musicItem.content_id}_del`}
          className={slot_styles.slot_item_edit_btn}
          onClick={() => {
            switchConfirmContentDel(musicItem.content_id);
          }}
        >
          <img
            data-modal_btn_prefix={`music_${musicItem.content_id}_del`}
            src="/icons/basket.svg"
            alt="delete_icon"
          />
        </button>
      </div>
      {isDelConfirmModal ? (
        <ConfirmActionModal
          actionMsg="Do you confirm the deletion of"
          itemName={musicItem.name}
          contentType={musicItem.type}
          yesActionEvent={handleMusicItemDel}
          noActionEvent={() => setIsDelConfirmModal((prev) => !prev)}
          modalPrefix={`music_${musicItem.content_id}_del`}
        />
      ) : null}
    </>
  );
};
