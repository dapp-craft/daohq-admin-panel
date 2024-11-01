import { create } from "zustand";
import { IContentItem } from "../Components/EditContent/SlotItem";
import { ILocationsSchema } from "../Components/Booking/LocationsMenu";
import { IBookingItem } from "../Components/Booking/BookingStartPanel";

interface ISelectedSlotData {
  content: IContentItem[] | null;
  slotInfo: {
    id: number | null;
    name: string | null;
    supportsStreaming: boolean | null;
    format: string | null;
    trigger: boolean | null;
  };
}

interface IErrorModal {
  isModalError: boolean;
  errorTitle: string | null;
  errorDescription: string | null;
  statusCode: number | null;
  action?: (() => void) | null;
}

interface IAuthData {
  token: string | null;
  address: string | null;
}

interface IEditResource {
  id: number | null;
  name: string | null;
  s3_urn: string | null;
  preview: string | null;
}

interface IVersion {
  frontendVersion: string | null;
  backendVersion: string | null;
}

export interface IBreadcrumbItem {
  path: string;
  name: string;
  level: number;
}

interface IBookingPaginationData {
  activeTake: number;
  inactiveTake: number;
  selectedBookingList: "active" | "inactive" | null;
}

export interface IBookedSlotStateItem {
  slotId: number;
  contentIndex: number;
  isPaused: boolean | number | null;
}

export interface IBookingStateItem {
  booking: IBookingItem;
  bookingSocket: WebSocket;
  bookedSlots: IBookedSlotStateItem[];
}

interface IActiveBookingsState {
  activeBookings: IBookingItem[] | null;
  setActiveBookings: (newBookings: IBookingItem[] | null) => void;
}

interface IInactiveBookingsState {
  inactiveBookings: IBookingItem[] | null;
  setInactiveBookings: (newBookings: IBookingItem[] | null) => void;
}

interface ILocationsSchemaState {
  locationsSchema: ILocationsSchema | null;
  setLocationsSchema: (newLocationSchema: ILocationsSchema | null) => void;
}

interface ISelectedBookingState {
  selectedBooking: IBookingItem | null;
  setSelectedBooking: (newBooking: IBookingItem | null) => void;
}

interface IResourceToEditState {
  resourceToEdit: IEditResource;
  setResourceToEdit: (newRes: IEditResource) => void;
}

interface ISelectedSlotState {
  selectedSlot: ISelectedSlotData;
  setSelectedSlot: (newSlotData: ISelectedSlotData) => void;
}

interface ISelectedLocationState {
  selectedLocation: string | null;
  setSelectedLocation: (newLocationId: string | null) => void;
}

interface ICurrentAuthData {
  currentAuthData: IAuthData;
  setCurrentAuthData: (newAuthData: IAuthData) => void;
}

interface IErrorState {
  modal: IErrorModal;
  setIsErrorModal: (newValue: IErrorModal) => void;
}

interface IVersionState {
  versions: IVersion;
  setVersions: (newVersions: IVersion) => void;
}

interface IBreadcrumbState {
  breadcrumbsParts: IBreadcrumbItem[];
  setBreadcrumbsParts: (props: { newPart: IBreadcrumbItem }) => void;
}

interface IBookingPaginationState {
  bookingPagination: IBookingPaginationData;
  setBookingPagination: (newPaginationData: IBookingPaginationData) => void;
}

interface IUserRoleState {
  userRole: string | null;
  setUserRole: (newUserRole: string | null) => void;
}

interface IWsBookingStates {
  bookingStates: IBookingStateItem[];
  setBookingStates: (newBookingStates: IBookingStateItem[]) => void;
}

interface ISelectedDiscordBoardState {
  selectedDiscordBoard: string | null;
  setSelectedDiscordBoard: (newDiscordBoard: string | null) => void;
}

interface IStreamingInfoModalState {
  isShowInfoModal: boolean;
  setIsShowInfoModal: (newState: boolean) => void;
}

export interface ILimitItem {
  limit: number | null;
  content_count: number | null;
}

export interface IBookingContentLimit {
  slotContent: ILimitItem;
  music: ILimitItem;
}

interface IBookingContentLimitState {
  limit: IBookingContentLimit;
  setLimit: (newLimit: IBookingContentLimit) => void;
}

export const TEXT_REGEX =
  /^[a-zA-Z0-9\\ \/_()!&?,.\-@#$%*\[\]{}<>|=+\;:`~"'(\r\n|\r|\n) \t]+$/;
export const URL_REGEX =
  /^(?:(?:https?|ftp):\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s]*$/i;

export const selectedSlotStore = create<ISelectedSlotState>()((set) => ({
  selectedSlot: {
    content: [],
    slotInfo: {
      id: null,
      name: null,
      supportsStreaming: null,
      format: null,
      trigger: null,
    },
  },
  setSelectedSlot: (newSlotData: ISelectedSlotData) =>
    set(() => ({
      selectedSlot: newSlotData,
    })),
}));

export const activeBookingsStore = create<IActiveBookingsState>()((set) => ({
  activeBookings: null,
  setActiveBookings: (newBookings: IBookingItem[] | null) =>
    set(() => ({ activeBookings: newBookings })),
}));

export const inactiveBookingsStore = create<IInactiveBookingsState>()(
  (set) => ({
    inactiveBookings: null,
    setInactiveBookings: (newBookings: IBookingItem[] | null) =>
      set(() => ({ inactiveBookings: newBookings })),
  })
);

export const selectedLocationStore = create<ISelectedLocationState>()(
  (set) => ({
    selectedLocation: null,
    setSelectedLocation: (newLocationId: string | null) =>
      set(() => ({ selectedLocation: newLocationId })),
  })
);

export const selectedBookingStore = create<ISelectedBookingState>()((set) => ({
  selectedBooking: null,
  setSelectedBooking: (newBooking: IBookingItem | null) =>
    set(() => ({ selectedBooking: newBooking })),
}));

export const resourceToEditStore = create<IResourceToEditState>()((set) => ({
  resourceToEdit: { id: null, name: null, s3_urn: null, preview: null },
  setResourceToEdit: (newRes: IEditResource) =>
    set(() => ({ resourceToEdit: newRes })),
}));

export const locationsSchemaStore = create<ILocationsSchemaState>()((set) => ({
  locationsSchema: null,
  setLocationsSchema: (newLocationSchema: ILocationsSchema | null) =>
    set(() => ({ locationsSchema: newLocationSchema })),
}));

export const currentAuthDataStore = create<ICurrentAuthData>()((set) => ({
  currentAuthData: { address: null, token: null },
  setCurrentAuthData: (newAuthData: IAuthData) =>
    set(() => ({ currentAuthData: newAuthData })),
}));

export const errorStore = create<IErrorState>((set) => ({
  modal: {
    isModalError: false,
    errorDescription: null,
    statusCode: null,
    errorTitle: null,
    action: null,
  },
  setIsErrorModal: (newValue: IErrorModal) => set(() => ({ modal: newValue })),
}));

export const versionStore = create<IVersionState>((set) => ({
  versions: { backendVersion: null, frontendVersion: null },
  setVersions: (newVersions: IVersion) =>
    set(() => ({ versions: newVersions })),
}));

export const bookingPaginationStore = create<IBookingPaginationState>(
  (set) => ({
    bookingPagination: {
      activeTake: 5,
      inactiveTake: 5,
      selectedBookingList: null,
    },
    setBookingPagination: (newPaginationData: IBookingPaginationData) =>
      set(() => ({ bookingPagination: newPaginationData })),
  })
);

export const breadcrumbStore = create<IBreadcrumbState>((set) => ({
  breadcrumbsParts: [],
  setBreadcrumbsParts: (props: { newPart: IBreadcrumbItem }) => {
    const { newPart } = props;
    return set((prevState) => {
      let currentState: IBreadcrumbItem[] = prevState.breadcrumbsParts;
      const duplicated = currentState.find(
        (item) => item.level === newPart.level
      );
      if (duplicated) {
        const index: number = currentState.indexOf(duplicated);
        currentState.splice(index, 1, newPart);
        currentState = currentState.slice(0, index + 1);
        return {
          breadcrumbsParts: currentState,
        };
      } else {
        return {
          breadcrumbsParts: [...currentState, newPart].sort(
            (a, b) => a.level - b.level
          ),
        };
      }
    });
  },
}));

export const userRoleStore = create<IUserRoleState>()((set) => ({
  userRole: null,
  setUserRole: (newUserRole: string | null) =>
    set(() => ({ userRole: newUserRole })),
}));

export const liveBookingsWsStore = create<IWsBookingStates>()((set) => ({
  bookingStates: [],
  setBookingStates: (newBookingStates: IBookingStateItem[]) =>
    set(() => ({ bookingStates: newBookingStates })),
}));

export const selectedDiscordBoardStore = create<ISelectedDiscordBoardState>()(
  (set) => ({
    selectedDiscordBoard: null,
    setSelectedDiscordBoard: (newDiscordBoard: string | null) =>
      set(() => ({ selectedDiscordBoard: newDiscordBoard })),
  })
);

export const streamingInfoModalStore = create<IStreamingInfoModalState>()(
  (set) => ({
    isShowInfoModal: false,
    setIsShowInfoModal: (newState: boolean) =>
      set(() => ({ isShowInfoModal: newState })),
  })
);

export const bookingContentLimitStore = create<IBookingContentLimitState>()(
  (set) => ({
    limit: {
      slotContent: { limit: null, content_count: null },
      music: { limit: null, content_count: null },
    },
    setLimit: (newLimit: IBookingContentLimit) =>
      set(() => ({ limit: newLimit })),
  })
);
