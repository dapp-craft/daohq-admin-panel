import { memo, useEffect, useRef, useState } from "react";
import start_panel_styles from "../../styles/modules/startPanel.module.scss";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import processApi from "../../scripts/processApi";
import { backendUrl } from "../../main";
import {
  IBreadcrumbItem,
  activeBookingsStore,
  bookingPaginationStore,
  breadcrumbStore,
  currentAuthDataStore,
  inactiveBookingsStore,
  liveBookingsWsStore,
  locationsSchemaStore,
  selectedBookingStore,
  selectedLocationStore,
  userRoleStore,
} from "../../store/store";
import { getBookingListData } from "../../scripts/getBookingListData";
import LocationPreview from "../Layout/LocationPreview";
import { startConnectionLoop } from "../../scripts/wsConnectionLoop";
import { ConfirmActionModal } from "../EditContent/ConfirmActionModal";
import loaders from "../../styles/modules/loaders.module.scss";
import { errorHandler } from "../../scripts/errorHandler";

export interface IBookingItem {
  creation_date: number;
  description: string;
  duration: number;
  event_date: number;
  id: number;
  is_live: boolean;
  location: string;
  owner: string;
  preview: string | null;
  start_date: number;
  title: string;
}

interface IUiDateItem {
  start: { day: string; month: string; time: string };
  end: { day: string; month: string; time: string };
}

interface IBookingSearchBody {
  q: string;
  attributesToRetrieve: string[];
  attributesToSearchOn: string[];
  filter: string;
}

export const BookingStartPanel = () => {
  const [searchVal, setSearchVal] = useState<string>("");
  const [searchPublicKeyState, setSearchPublicKeyState] = useState<
    string | null
  >(null);
  const [isSearchingListMode, setIsSearchingListMode] =
    useState<boolean>(false);
  const [isBookingListLoaded, setIsBookingListLoaded] =
    useState<boolean>(false);
  const { currentAuthData } = currentAuthDataStore();
  const { selectedLocation, setSelectedLocation } = selectedLocationStore();
  const { setBreadcrumbsParts } = breadcrumbStore();
  const { locationsSchema, setLocationsSchema } = locationsSchemaStore();
  const { bookingStates } = liveBookingsWsStore();
  const params = useParams();
  const { activeBookings, setActiveBookings } = activeBookingsStore();
  const { inactiveBookings, setInactiveBookings } = inactiveBookingsStore();
  const { pathname } = useLocation();
  const activeListRef = useRef<HTMLDivElement>(null);
  const inactiveListRef = useRef<HTMLDivElement>(null);
  const { bookingPagination, setBookingPagination } = bookingPaginationStore();
  let { activeTake, inactiveTake, selectedBookingList } = bookingPagination;
  const bookingsTakeStep: number = 5;
  let nextPageFetchingMarker: boolean = true;

  const handleChangeSearchVal = async (
    ev: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSearchVal(ev.currentTarget.value);
    const locId = selectedLocation || params.locationId;
    if (ev.currentTarget.value.length === 0 && locId) {
      setIsBookingListLoaded(false);
      await getBookingListData("active", locId, bookingPagination.activeTake);
      await getBookingListData(
        "inactive",
        locId,
        bookingPagination.inactiveTake
      );
      setIsBookingListLoaded(true);
      setIsSearchingListMode(false);
    }
  };

  const switchPaginationList = (target: "active" | "inactive") => {
    const { activeTake, inactiveTake, selectedBookingList } = bookingPagination;
    const newActiveTake =
      target === "active" && activeTake <= bookingsTakeStep
        ? activeTake + bookingsTakeStep
        : bookingsTakeStep;
    const newInactiveTake =
      target === "inactive" && inactiveTake <= bookingsTakeStep
        ? inactiveTake + bookingsTakeStep
        : bookingsTakeStep;

    setBookingPagination({
      activeTake: newActiveTake,
      inactiveTake: newInactiveTake,
      selectedBookingList: selectedBookingList === target ? null : target,
    });
    const locationId: string | undefined =
      selectedLocation || params.locationId;
    if (locationId) {
      getBookingListData("active", locationId, newActiveTake);
      getBookingListData("inactive", locationId, newInactiveTake);
    }
  };

  const handleBookingListScroll = async () => {
    if (
      selectedBookingList &&
      activeListRef.current &&
      inactiveListRef.current
    ) {
      const locationId: string | undefined =
        selectedLocation || params.locationId;
      const windowHeight: number = window.screen.height;
      const itemsList: Element[] =
        selectedBookingList === "active"
          ? [...activeListRef.current.children]
          : [...inactiveListRef.current.children];
      const lastItem: Element = itemsList[itemsList.length - 1];
      const lastItemY: number = lastItem.getBoundingClientRect().y;
      if (lastItemY <= windowHeight && locationId && nextPageFetchingMarker) {
        nextPageFetchingMarker = false;
        const newBookings = await getBookingListData(
          selectedBookingList,
          locationId,
          selectedBookingList === "active"
            ? activeTake + bookingsTakeStep
            : inactiveTake + bookingsTakeStep
        );
        if (selectedBookingList === "active") {
          activeTake += bookingsTakeStep;
        } else {
          inactiveTake += bookingsTakeStep;
        }
        if (newBookings && newBookings.length > itemsList.length) {
          nextPageFetchingMarker = true;
        }
      }
    }
  };

  const getSearchPublicKey = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/meilisearch/public-key`,
      });

      if (res.result && typeof res.result === "string") {
        setSearchPublicKeyState(res.result);
        return res.result;
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get public-key for search!", res.error);
      }
    } catch (error) {
      errorHandler("Can't get public-key for search!", { description: error });
    }
  };

  const getLiveBookingsData = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/locations/bookings/live?locations=${
          selectedLocation || params.locationId
        }`,
      });
      if (res.result && Array.isArray(res.result) && res.result.length) {
        return res.result as IBookingItem[];
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get live bookings data!", res.error);
      }
    } catch (error) {
      errorHandler("Can't get live bookings data!", { description: error });
    }
  };

  const getSearchResult = async (publicKeyArg?: string) => {
    setIsBookingListLoaded(false);
    const locationId = selectedLocation || params.locationId;
    const body: IBookingSearchBody = {
      q: searchVal,
      attributesToRetrieve: [
        "id",
        "owner",
        "title",
        "creation_date",
        "start_date",
        "duration",
        "event_date",
        "description",
        "preview",
        "location",
      ],
      attributesToSearchOn: ["title", "description"],
      filter: `location=${locationId}`,
    };

    const getSearchedBookingsData = async (
      url: string,
      body: IBookingSearchBody
    ) => {
      try {
        const res = await processApi({
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${publicKeyArg || searchPublicKeyState}`,
          },
          body: JSON.stringify(body),
          isWithoutAuth: true,
        });

        if (
          res.result &&
          typeof res.result === "object" &&
          "hits" in res.result &&
          Array.isArray(res.result.hits) &&
          res.result.hits.length
        ) {
          return res.result.hits as IBookingItem[];
        }

        if (res.error.statusCode || res.error.description) {
          setIsBookingListLoaded(true);
          errorHandler("Can't get searched bookings data!", res.error);
        }
      } catch (error) {
        setIsBookingListLoaded(true);
        errorHandler("Can't get searched bookings data!", {
          description: error,
        });
      }
    };

    const searchedBookings = await getSearchedBookingsData(
      `${backendUrl.replace("api", "meilisearch")}/indexes/booking/search`,
      body
    );
    const liveBookings = await getLiveBookingsData();
    const active: IBookingItem[] = [];
    const inactive: IBookingItem[] = [];

    if (searchedBookings) {
      if (liveBookings) {
        liveBookings.forEach((liveBooking: IBookingItem) => {
          const searchingBookingItem = searchedBookings.find(
            (searchedBooking) => searchedBooking.id === liveBooking.id
          );
          if (searchingBookingItem) {
            searchingBookingItem.is_live = true;
          }
        });
      }
      searchedBookings.forEach((booking: IBookingItem) => {
        const dateEnd = booking.start_date + booking.duration;
        const dateNow = new Date().getTime();
        if (dateNow <= dateEnd) {
          active.push(booking);
        } else {
          inactive.push(booking);
        }
      });
    }
    setActiveBookings(active);
    setInactiveBookings(inactive);
    setIsBookingListLoaded(true);
    setIsSearchingListMode(true);
  };

  const searchBookingsSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!searchPublicKeyState) {
      const publicKey = await getSearchPublicKey();
      getSearchResult(publicKey);
    } else if (searchPublicKeyState) {
      getSearchResult();
    }
  };

  const connectLiveBookingsWs = async () => {
    const liveBookings = await getLiveBookingsData();

    if (liveBookings) {
      const authTokenLocStor = localStorage.getItem("dao_hq_auth_token");
      const authToken = currentAuthData.token || authTokenLocStor;
      liveBookings.forEach((newLiveBooking: IBookingItem) => {
        const isConnectionExist = bookingStates.find(
          (liveBookingState) =>
            liveBookingState.booking.id === newLiveBooking.id
        );
        if (authToken && !isConnectionExist) {
          startConnectionLoop(
            `/ws/booking/${newLiveBooking.id}/auth`,
            authToken,
            newLiveBooking
          );
        }
      });
    }
  };

  const loadAllEvents = async (): Promise<void> => {
    if (selectedLocation) {
      setIsBookingListLoaded(false);
      await getBookingListData(
        "active",
        selectedLocation,
        bookingPagination.activeTake
      );
      await getBookingListData(
        "inactive",
        selectedLocation,
        bookingPagination.inactiveTake
      );
      setIsBookingListLoaded(true);
    }
  };

  useEffect(() => {
    if (!selectedLocation && params.locationId) {
      setSelectedLocation(params.locationId);
    }
    loadAllEvents();
    if (!locationsSchema) {
      const locationsSchemaLocStor = localStorage.getItem(
        "dao_hq_locationsSchema"
      );
      if (locationsSchemaLocStor) {
        setLocationsSchema(JSON.parse(locationsSchemaLocStor));
      }
    }
    if (selectedLocation) connectLiveBookingsWs();
  }, [selectedLocation]);

  useEffect(() => {
    if (bookingPagination.selectedBookingList) {
      window.addEventListener("scroll", handleBookingListScroll);
      return () =>
        window.removeEventListener("scroll", handleBookingListScroll);
    }
  }, [bookingPagination.selectedBookingList]);

  return (
    <div className={start_panel_styles.start_panel}>
      <LocationPreview />
      {pathname.split("/").slice(-1)[0] !== selectedLocation ? (
        <Outlet />
      ) : (
        <>
          <div className={start_panel_styles.start_panel_controls}>
            <form
              className={start_panel_styles.start_panel_controls_search_form}
              onSubmit={searchBookingsSubmit}
            >
              <div
                className={
                  start_panel_styles.start_panel_controls_search_input_wrap
                }
              >
                <img
                  className={
                    start_panel_styles.start_panel_controls_search_icon
                  }
                  src="/icons/search.svg"
                  alt="search_icon"
                />
                <input
                  className={
                    start_panel_styles.start_panel_controls_search_input
                  }
                  type="text"
                  value={searchVal}
                  onChange={handleChangeSearchVal}
                  placeholder="enter booking title or description"
                />
              </div>
              <button
                className={
                  start_panel_styles.start_panel_controls_search_button
                }
                type="submit"
              >
                SEARCH
              </button>
            </form>
            <div>
              <Link
                className={start_panel_styles.start_panel_controls_new_link}
                to="create"
                onClick={() =>
                  setBreadcrumbsParts({
                    newPart: {
                      name: "create",
                      path: "/create",
                      level: 2,
                    },
                  })
                }
              >
                NEW BOOKING
              </Link>
            </div>
          </div>
          <div
            className={`${start_panel_styles.start_panel_list} ${start_panel_styles.start_panel_list_container}`}
          >
            {isBookingListLoaded ? (
              <>
                <div className={start_panel_styles.start_panel_list}>
                  <div
                    className={
                      start_panel_styles.start_panel_list_title_flex_wrap
                    }
                  >
                    <p className={start_panel_styles.start_panel_list_title}>
                      Active
                    </p>
                    {!isSearchingListMode ? (
                      <div>
                        <button
                          className={
                            start_panel_styles.start_panel_list_view_btn
                          }
                          onClick={() => switchPaginationList("active")}
                        >
                          {bookingPagination.selectedBookingList === "active"
                            ? "HIDE ALL\n>"
                            : "VIEW ALL \n>"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div ref={activeListRef}>
                    {activeBookings && activeBookings.length
                      ? activeBookings.map((item, index) => (
                          <div
                            key={index}
                            className={start_panel_styles.start_panel_list_item}
                          >
                            <BookingItem bookingItem={item} />
                          </div>
                        ))
                      : "No active events"}
                  </div>
                </div>
                <div className={start_panel_styles.start_panel_list}>
                  <div
                    className={
                      start_panel_styles.start_panel_list_title_flex_wrap
                    }
                  >
                    <p className={start_panel_styles.start_panel_list_title}>
                      Past
                    </p>
                    {!isSearchingListMode ? (
                      <div>
                        <button
                          className={
                            start_panel_styles.start_panel_list_view_btn
                          }
                          onClick={() => switchPaginationList("inactive")}
                        >
                          {bookingPagination.selectedBookingList === "inactive"
                            ? "HIDE ALL\n>"
                            : "VIEW ALL \n>"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div ref={inactiveListRef}>
                    {inactiveBookings && inactiveBookings.length
                      ? inactiveBookings.map((item, index) => (
                          <div
                            key={index + 50}
                            className={start_panel_styles.start_panel_list_item}
                          >
                            <BookingItem bookingItem={item} isInactive={true} />
                          </div>
                        ))
                      : "No past events"}
                  </div>
                </div>
              </>
            ) : (
              <div className={loaders.start_panel_loader_wrap}>
                <div className={loaders.loader_ring} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const BookingItem = memo(
  (props: { bookingItem: IBookingItem; isInactive?: boolean }) => {
    const { bookingItem, isInactive } = props;
    const [uiDates, setUiDates] = useState<IUiDateItem>({
      start: { day: "", month: "", time: "" },
      end: { day: "", month: "", time: "" },
    });
    const { setSelectedBooking } = selectedBookingStore();
    const [isDelConfirmModal, setIsDelConfirmModal] = useState<boolean>(false);
    const [bookingIdToDel, setBookingIdToDel] = useState<number | null>(null);
    const { setBreadcrumbsParts } = breadcrumbStore();
    const { selectedLocation } = selectedLocationStore();
    const { bookingPagination } = bookingPaginationStore();
    const { userRole } = userRoleStore();
    const { currentAuthData } = currentAuthDataStore();

    const params = useParams();

    const getUiDates = () => {
      const { start_date, duration } = bookingItem;
      const startDate: Date = new Date(start_date);
      const endDate: Date = new Date(start_date + duration);

      const startMonth = startDate.toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
      const startDay = startDate.toLocaleString("en-US", {
        day: "2-digit",
        timeZone: "UTC",
      });
      const startTime = startDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
      const endMonth = endDate.toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
      const endDay = endDate.toLocaleString("en-US", {
        day: "2-digit",
        timeZone: "UTC",
      });
      const endTime = endDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });

      setUiDates({
        start: { day: startDay, month: startMonth, time: startTime },
        end: { day: endDay, month: endMonth, time: endTime },
      });
    };

    const handleEditClick = (
      bookingItem: IBookingItem,
      breadCrumbItem: IBreadcrumbItem
    ) => {
      setSelectedBooking(bookingItem);
      setBreadcrumbsParts({
        newPart: breadCrumbItem,
      });
    };

    const switchConfirmDelModal = (bookingId: number) => {
      setBookingIdToDel(bookingId);
      setIsDelConfirmModal((prev) => !prev);
    };

    const handleBookingDel = async () => {
      if (bookingIdToDel) {
        try {
          const res = await processApi({
            url: `${backendUrl}/bookings/${bookingIdToDel}`,
            method: "DELETE",
          });
          if (res.error.statusCode || res.error.description) {
            errorHandler("Failed to delete the selected booking!", res.error);
          }
        } catch (error) {
          errorHandler("Failed to delete the selected booking!", {
            description: error,
          });
        }

        setIsDelConfirmModal((prev) => !prev);
        const locationId: string | undefined =
          selectedLocation || params.locationId;
        if (locationId) {
          getBookingListData(
            isInactive ? "inactive" : "active",
            locationId,
            isInactive
              ? bookingPagination.inactiveTake
              : bookingPagination.activeTake
          );
        }
      } else {
        throw new Error("Wrong bookingIdToDel value");
      }
    };

    const checkBookingEditMode = (): boolean => {
      if (userRole === "superadmin" || userRole === "admin") return true;
      if (bookingItem.owner === currentAuthData.address) return true;
      return false;
    };

    useEffect(() => {
      getUiDates();
      checkBookingEditMode();
    }, []);

    useEffect(() => {
      checkBookingEditMode();
    }, [userRole]);

    return (
      <>
        {bookingItem.is_live ? (
          <div
            className={start_panel_styles.start_panel_list_item_live_img_wrap}
          >
            <img src="/icons/live.svg" alt="live_icon" />
            <span>Live</span>
          </div>
        ) : null}
        <ImagePrev imgUrl={bookingItem.preview} />
        <div className={start_panel_styles.start_panel_list_item_content_wrap}>
          <p className={start_panel_styles.start_panel_list_item_title}>
            {bookingItem.title.length > 30
              ? bookingItem.title.slice(0, 30).concat("...")
              : bookingItem.title}
          </p>
          <p className={start_panel_styles.start_panel_list_item_description}>
            {bookingItem.description.length > 70
              ? bookingItem.description.slice(0, 70).concat("...")
              : bookingItem.description}
          </p>
        </div>
        <div className={start_panel_styles.start_panel_list_item_dates}>
          <div className={start_panel_styles.start_panel_list_item_date}>
            <span
              className={start_panel_styles.start_panel_list_item_date_date}
            >
              {uiDates.start.month}
            </span>
            <span
              className={start_panel_styles.start_panel_list_item_date_date}
            >
              {uiDates.start.day}
            </span>
            <span
              className={start_panel_styles.start_panel_list_item_date_time}
            >
              {uiDates.start.time}
            </span>
          </div>
          <span
            className={start_panel_styles.start_panel_list_item_dates_line}
          />
          <div className={start_panel_styles.start_panel_list_item_date}>
            <span
              className={start_panel_styles.start_panel_list_item_date_date}
            >
              {uiDates.end.month}
            </span>
            <span
              className={start_panel_styles.start_panel_list_item_date_date}
            >
              {uiDates.end.day}
            </span>
            <span
              className={start_panel_styles.start_panel_list_item_date_time}
            >
              {uiDates.end.time}
            </span>
          </div>
        </div>
        <div className={start_panel_styles.start_panel_list_item_actions}>
          {!isInactive ? (
            <>
              {checkBookingEditMode() ? (
                <div
                  className={
                    start_panel_styles.start_panel_list_item_action_wrap
                  }
                >
                  <Link
                    to={`edit/${bookingItem.id}`}
                    onClick={() =>
                      handleEditClick(bookingItem, {
                        name: `edit ${bookingItem.id}`,
                        path: `/edit/${bookingItem.id}`,
                        level: 2,
                      })
                    }
                  >
                    <img src="/icons/edit.svg" alt="edit_icon" />
                  </Link>
                </div>
              ) : (
                <img
                  className={
                    start_panel_styles.start_panel_list_item_disabled_btn
                  }
                  src="/icons/edit.svg"
                  alt="edit_icon"
                />
              )}
            </>
          ) : null}
          {checkBookingEditMode() ? (
            <div
              data-modal_btn_prefix={`booking_${bookingItem.id}_del`}
              className={start_panel_styles.start_panel_list_item_action_wrap}
            >
              <button
                data-modal_btn_prefix={`booking_${bookingItem.id}_del`}
                onClick={() => switchConfirmDelModal(bookingItem.id)}
              >
                <img
                  data-modal_btn_prefix={`booking_${bookingItem.id}_del`}
                  src="/icons/basket.svg"
                  alt="delete_icon"
                />
              </button>
            </div>
          ) : (
            <img
              className={start_panel_styles.start_panel_list_item_disabled_btn}
              src="/icons/basket.svg"
              alt="delete_icon"
            />
          )}
        </div>
        {isDelConfirmModal ? (
          <ConfirmActionModal
            actionMsg="Do you confirm the deletion of this booking"
            yesActionEvent={handleBookingDel}
            noActionEvent={() => setIsDelConfirmModal((prev) => !prev)}
            modalPrefix={`booking_${bookingItem.id}_del`}
          />
        ) : null}
      </>
    );
  }
);

const ImagePrev = (props: { imgUrl: string | null }) => {
  const { imgUrl } = props;
  const [isImgLoaded, setIsImgLoaded] = useState<boolean>(false);

  return (
    <div
      className={
        start_panel_styles.start_panel_list_item_event_poster_container
      }
    >
      <div
        className={`${loaders.img_loader} ${loaders.img_loader_event_poster} ${
          isImgLoaded ? loaders.img_hidden_state : loaders.img_visible_state
        }`}
      >
        <img src="/icons/image.svg" alt="loader_img_icon" />
      </div>
      <div
        className={start_panel_styles.start_panel_list_item_event_poster_wrap}
      >
        <img
          className={start_panel_styles.start_panel_list_item_event_poster}
          src={imgUrl && imgUrl.length ? imgUrl : "/icons/image.svg"}
          alt="event_poster_img"
          onLoad={() => setIsImgLoaded(true)}
        />
      </div>
    </div>
  );
};
