import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AdminLayout from "./Components/Layout/AdminLayout.tsx";
import ErrorPage from "./Components/Error/ErrorPage.tsx";
import { Auth } from "./Components/Auth/Auth.tsx";
import { Booking } from "./Components/Booking/Booking.tsx";
import { BookingStartPanel } from "./Components/Booking/BookingStartPanel.tsx";
import { BookingEditItem } from "./Components/Booking/BookingEditItem.tsx";
import { SlotsList } from "./Components/EditContent/SlotsList.tsx";
import { SlotItem } from "./Components/EditContent/SlotItem.tsx";
import { AddContentForm } from "./Components/EditContent/AddContentForm.tsx";
import { Scene } from "./Components/Scene/Scene.tsx";
import {
  currentAuthDataStore,
  userRoleStore,
  versionStore,
} from "./store/store.ts";
import processApi from "./scripts/processApi.ts";
import { checkUserRole } from "./scripts/checkUserRole.ts";
import { DiscordScreenItem } from "./Components/EditContent/DiscordScreenItem.tsx";
import { EditChannelForm } from "./Components/EditContent/EditChannelForm.tsx";
import Users from "./Components/Users/Users.tsx";
import { Dashboard } from "./Components/Dashboard/Dashboard.tsx";
import { MusicLocationItem } from "./Components/EditContent/MusicLocationItem.tsx";
import { MusicAddForm } from "./Components/EditContent/MusicAddForm.tsx";
import { errorHandler } from "./scripts/errorHandler.ts";

export const backendUrl: string =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8008";

export enum contentFormTypesEnum {
  IMAGE = "image",
  VIDEO = "video",
  STREAMING = "streaming",
}

async function getVersionAndRole() {
  const setVersions = versionStore.getState().setVersions;
  const setUserRole = userRoleStore.getState().setUserRole;
  const currentAuthData = currentAuthDataStore.getState().currentAuthData;
  let address: string | null = null;
  if (currentAuthData.address) {
    address = currentAuthData.address;
  } else {
    const locAddress = localStorage.getItem("dao_hq_user_address");
    if (locAddress) {
      address = locAddress;
    }
  }
  const getVersionData = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/version`,
      });
      if (typeof res.result === "string" || res.result === null) {
        return res.result;
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Failed to get current app version!", res.error);
      }
    } catch (error) {
      errorHandler("Failed to get current app version!", {
        description: error,
      });
    }
  };
  const backendVersion = await getVersionData();
  if (backendVersion) setVersions({ backendVersion, frontendVersion: null });

  if (address) {
    const role = await checkUserRole(address);
    setUserRole(role);
  }
}

getVersionAndRole();

const router = createBrowserRouter([
  {
    path: "/",
    element: <AdminLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "booking",
        element: <Booking />,
        children: [
          {
            path: ":locationId",
            element: <BookingStartPanel />,
            children: [
              { path: "create", element: <BookingEditItem isEdit={false} /> },
              {
                path: "edit/:bookingId",
                element: <BookingEditItem isEdit={true} />,
              },
              {
                path: "edit/:bookingId/slots",
                element: <SlotsList />,
              },
              { path: "edit/:bookingId/slots/:slotId", element: <SlotItem /> },
              {
                path: "edit/:bookingId/slots/music",
                element: <MusicLocationItem isScene={false} />,
              },
              {
                path: "edit/:bookingId/slots/music/add_music",
                element: <MusicAddForm isScene={false} />,
              },
              {
                path: "edit/:bookingId/slots/:slotId/add_img",
                element: (
                  <AddContentForm
                    formType={contentFormTypesEnum.IMAGE}
                    isEdit={false}
                  />
                ),
              },
              {
                path: "edit/:bookingId/slots/:slotId/add_video",
                element: (
                  <AddContentForm
                    formType={contentFormTypesEnum.VIDEO}
                    isEdit={false}
                  />
                ),
              },
              {
                path: "edit/:bookingId/slots/:slotId/streaming",
                element: (
                  <AddContentForm
                    formType={contentFormTypesEnum.STREAMING}
                    isEdit={false}
                  />
                ),
              },
              {
                path: "edit/:bookingId/slots/:slotId/edit_video/:resourceId",
                element: (
                  <AddContentForm
                    formType={contentFormTypesEnum.VIDEO}
                    isEdit={true}
                  />
                ),
              },
            ],
          },
        ],
      },
      {
        path: "scene",
        element: <Scene />,
        children: [
          { path: ":locationId", element: <SlotsList /> },
          { path: ":locationId/:slotId", element: <SlotItem isScene={true} /> },
          {
            path: ":locationId/discord/:discordId",
            element: <DiscordScreenItem />,
          },
          {
            path: ":locationId/music",
            element: <MusicLocationItem isScene={true} />,
          },
          {
            path: ":locationId/music/add_music",
            element: <MusicAddForm isScene={true} />,
          },
          {
            path: ":locationId/discord/:discordId/edit_channel",
            element: <EditChannelForm />,
          },
          {
            path: ":locationId/:slotId/add_img",
            element: (
              <AddContentForm
                formType={contentFormTypesEnum.IMAGE}
                isEdit={false}
                isScene={true}
              />
            ),
          },
          {
            path: ":locationId/:slotId/add_video",
            element: (
              <AddContentForm
                formType={contentFormTypesEnum.VIDEO}
                isEdit={false}
                isScene={true}
              />
            ),
          },
          {
            path: ":locationId/:slotId/edit_video/:resourceId",
            element: (
              <AddContentForm
                formType={contentFormTypesEnum.VIDEO}
                isEdit={true}
                isScene={true}
              />
            ),
          },
          {
            path: ":locationId/:slotId/streaming",
            element: (
              <AddContentForm
                formType={contentFormTypesEnum.STREAMING}
                isEdit={false}
                isScene={true}
              />
            ),
          },
        ],
      },
      {
        path: "users",
        element: <Users />,
      },
      {
        path: "events",
        // element: <Events />,
      },
    ],
  },
  {
    path: "/auth",
    element: <Auth />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
