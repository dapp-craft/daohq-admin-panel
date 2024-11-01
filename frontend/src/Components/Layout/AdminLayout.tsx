import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  IBreadcrumbItem,
  activeBookingsStore,
  bookingContentLimitStore,
  breadcrumbStore,
  currentAuthDataStore,
  errorStore,
  inactiveBookingsStore,
  locationsSchemaStore,
  resourceToEditStore,
  selectedBookingStore,
  selectedLocationStore,
  selectedSlotStore,
  userRoleStore,
  versionStore,
} from "../../store/store";
import { memo, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import layout from "../../styles/modules/layout.module.scss";
import baseStyles from "../../styles/base.module.scss";
import processApi from "../../scripts/processApi";
import BreadcrumbNavigation from "./BreadcrumbNavigation";
import { ErrorModal } from "../Error/ErrorModal";
import { errorHandler } from "../../scripts/errorHandler";
import { buildUrlToScene } from "../../scripts/buildSceneLink";

interface ITokenPayload {
  expired_at: string;
  signer_address: string;
}

// export const layoutPagesNames = ["booking", "scene", "users", "events"];
export const layoutPagesNames = ["booking", "scene", "users"];

const AdminLayout = () => {
  const { currentAuthData, setCurrentAuthData } = currentAuthDataStore();
  const [avatarLink, setAvatarLink] = useState<string | null>(null);
  const [burgerCheckboxVal, setBurgerCheckboxVal] = useState<boolean>(false);
  const [jumpInUrl, setJumpInUrl] = useState<string | null>(null);
  const { selectedLocation, setSelectedLocation } = selectedLocationStore();
  const { selectedSlot, setSelectedSlot } = selectedSlotStore();
  const { activeBookings, setActiveBookings } = activeBookingsStore();
  const { inactiveBookings, setInactiveBookings } = inactiveBookingsStore();
  const { selectedBooking, setSelectedBooking } = selectedBookingStore();
  const { resourceToEdit, setResourceToEdit } = resourceToEditStore();
  const { setBreadcrumbsParts } = breadcrumbStore();
  const { versions } = versionStore();
  const { modal } = errorStore();
  const { limit, setLimit } = bookingContentLimitStore();
  const navigate = useNavigate();
  const locData = useLocation();
  const { userRole, setUserRole } = userRoleStore();
  const { locationsSchema } = locationsSchemaStore();
  const locStorTokenKey: string = "dao_hq_auth_token";
  const authTokenLocStor = localStorage.getItem(locStorTokenKey);
  const userAddressLocStor = localStorage.getItem("dao_hq_user_address");

  const handleLogOut = () => {
    if (authTokenLocStor && authTokenLocStor.length) {
      localStorage.removeItem(locStorTokenKey);
      localStorage.removeItem("dao_hq_user_address");
      setCurrentAuthData({ address: null, token: null });
      setUserRole(null);
    }
  };

  const getShortUserAddress = () => {
    const address = currentAuthData.address || userAddressLocStor;
    let shortAddress: string = "no auth address";
    if (address) {
      shortAddress = address
        .slice(0, 5)
        .concat("...")
        .concat(address.slice(address.length - 5));
    }
    return shortAddress;
  };

  const getUserAvatar = async () => {
    if (currentAuthData.address) {
      const getUserProfileData = async () => {
        try {
          const res = await processApi({
            url: `https://peer.decentraland.org/lambdas/profile/${currentAuthData.address}`,
            isWithoutAuth: true,
          });
          if (
            res.result &&
            typeof res.result === "object" &&
            "avatars" in res.result &&
            Array.isArray(res.result.avatars) &&
            res.result.avatars.length
          ) {
            return res.result.avatars as {
              [key: string]: { [key: string]: { [key: string]: string } };
            }[];
          }
          if (res.error.statusCode || res.error.description) {
            errorHandler("Can't get DCL user profile!", res.error);
          }
        } catch (error) {
          errorHandler("Can't get DCL user profile!", { description: error });
        }
      };
      const userProfile = await getUserProfileData();
      if (userProfile) {
        setAvatarLink(userProfile[0].avatar.snapshots.face256);
      }
    }
  };

  const getFirstPathname = (): string | null => {
    const splitPath = locData.pathname.split("/");
    if (splitPath.length > 1) {
      return splitPath[1];
    } else {
      return null;
    }
  };

  const isTokenNotExpired = (token: string) => {
    let expiredDate: null | string = null;
    const splitToken = token.split(".");
    if (splitToken.length >= 2) {
      const convertedToken = atob(splitToken[1]);
      const payload: ITokenPayload = JSON.parse(convertedToken);
      if (typeof payload === "object" && "expired_at" in payload) {
        expiredDate = payload.expired_at;
      }
    }
    if (expiredDate) {
      const dateEnd = new Date(expiredDate).getTime();
      const dateNow = new Date().getTime();
      return dateEnd - dateNow > 0;
    }
  };

  const handleMenuClick = (item: IBreadcrumbItem) => {
    resetSelectedData();
    setBreadcrumbsParts({ newPart: item });
    if (burgerCheckboxVal) {
      document.body.style.overflow = "scroll";
      setBurgerCheckboxVal(false);
    }
  };

  const handleBurgerBtnChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (ev.currentTarget.checked) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "scroll";
    }
    setBurgerCheckboxVal(ev.currentTarget.checked);
  };

  const resetSelectedData = () => {
    if (selectedLocation) setSelectedLocation(null);
    if (selectedSlot.slotInfo.id) {
      setSelectedSlot({
        slotInfo: {
          id: null,
          name: null,
          supportsStreaming: null,
          format: null,
          trigger: null,
        },
        content: [],
      });
    }
    if (activeBookings) setActiveBookings(null);
    if (inactiveBookings) setInactiveBookings(null);
    if (selectedBooking) setSelectedBooking(null);
    if (resourceToEdit) {
      setResourceToEdit({ id: null, name: null, preview: null, s3_urn: null });
    }
    if (limit.slotContent !== null || limit.music.limit !== null) {
      setLimit({
        music: { content_count: null, limit: null },
        slotContent: { content_count: null, limit: null },
      });
    }
  };

  const getLayoutType = () => {
    const allPages: string[] = [...layoutPagesNames];
    if (!(userRole === "admin" || userRole === "superadmin")) {
      const index = allPages.indexOf("scene");
      allPages.splice(index, 2);
    }
    return allPages;
  };

  useEffect(() => {
    if (!currentAuthData.token) {
      if (
        authTokenLocStor &&
        authTokenLocStor.length &&
        userAddressLocStor &&
        userAddressLocStor.length
      ) {
        setCurrentAuthData({
          address: userAddressLocStor,
          token: authTokenLocStor,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (
      (!currentAuthData.token && !authTokenLocStor) ||
      (authTokenLocStor && !isTokenNotExpired(authTokenLocStor))
    ) {
      navigate(`/auth?navigate_to=${locData.pathname}`);
    }
    getUserAvatar();
  }, [currentAuthData.token]);

  useEffect(() => {
    if (locationsSchema) {
      for (const locType in locationsSchema) {
        if (locType === "outdoor") {
          const outdoorLocations = locationsSchema[locType].locations;
          if (outdoorLocations && outdoorLocations.length) {
            const id = outdoorLocations[0].scene;
            if (id) {
              const url = buildUrlToScene(id);
              setJumpInUrl(url);
            }
          }
        }
      }
    }
  }, [locationsSchema]);

  return (
    <div className={baseStyles.container}>
      {modal.isModalError ? <ErrorModal /> : null}
      <header className={layout.header} id="header">
        <div className={layout.burger_button_wrap}>
          <input
            type="checkbox"
            id="layout_burger_checkbox"
            className={layout.burger_button_input}
            onChange={handleBurgerBtnChange}
            checked={burgerCheckboxVal}
          />
          <label htmlFor="layout_burger_checkbox">
            <div className={layout.burger_button_bars_wrap}>
              <span
                className={`${layout.burger_button_bar} ${layout.burger_button_bar1}`}
              />
              <span
                className={`${layout.burger_button_bar} ${layout.burger_button_bar2}`}
              />
              <span
                className={`${layout.burger_button_bar} ${layout.burger_button_bar3}`}
              />
              <span
                className={`${layout.burger_button_bar} ${layout.burger_button_bar4}`}
              />
              <span
                className={`${layout.burger_button_bar} ${layout.burger_button_bar5}`}
              />
            </div>
          </label>
        </div>
        <nav
          className={`${layout.header_navbar_container} ${
            burgerCheckboxVal
              ? layout.header_navbar_container_adaptive_active
              : ""
          }`}
        >
          <ul className={layout.header_navbar}>
            {getLayoutType().map((item) => (
              <li
                key={uuidv4()}
                className={`${layout.header_navbar_item} ${
                  getFirstPathname() === item
                    ? layout.header_navbar_item__active
                    : ""
                }`}
              >
                <Link
                  className={layout.header_navbar_item_link}
                  to={`/${item}`}
                  onClick={() =>
                    handleMenuClick({ name: item, path: `/${item}`, level: 0 })
                  }
                >
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={layout.header_auth}>
          <p className={layout.header_auth_username}>
            {currentAuthData.address ? (
              <span>{getShortUserAddress()}</span>
            ) : (
              "Log In"
            )}
          </p>
          <div
            className={`${layout.header_auth_avatar_wrap} ${
              avatarLink ? layout.with_border : ""
            }`}
          >
            <img
              className={layout.header_auth_avatar_picture}
              src={avatarLink ? avatarLink : "/icons/default_user.svg"}
              alt="User icon"
            />
          </div>
          <div className={layout.header_auth_modal_wrap}>
            <ul className={layout.header_auth_modal}>
              {jumpInUrl ? (
                <li className={layout.header_auth_modal_item}>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className={layout.header_auth_modal_item_link}
                    href={jumpInUrl}
                  >
                    Jump In
                  </a>
                </li>
              ) : null}

              <li className={layout.header_auth_modal_item}>
                <button
                  onClick={handleLogOut}
                  className={layout.header_auth_modal_item_button}
                >
                  Log Out
                </button>
              </li>
              <li className={layout.header_auth_modal_item}>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className={layout.header_auth_modal_item_link}
                  href="https://decentraland.org/"
                >
                  decentraland.org
                </a>
              </li>
            </ul>
          </div>
        </div>
        <hr className={layout.header_line} />
      </header>
      <BreadcrumbNavigation />
      <Outlet />
      <footer className={layout.footer}>
        <p className={layout.footer_version_info}>
          version: <span>{versions.backendVersion}</span>
        </p>
        <p className={layout.footer_version_info}>
          role: <span>{userRole ? userRole : "user"}</span>
        </p>
      </footer>
    </div>
  );
};

export default memo(AdminLayout);
