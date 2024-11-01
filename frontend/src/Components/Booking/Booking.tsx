import LocationsMenu from "./LocationsMenu";
import base_styles from "../../styles/base.module.scss";
import { Outlet, useLocation } from "react-router-dom";
import { layoutPagesNames } from "../Layout/AdminLayout";

export const Booking = () => {
  const { pathname } = useLocation();
  const lastPathname: string = pathname.split("/").slice(-1)[0];
  const isFullScreenMenu: boolean = layoutPagesNames.some(
    (name) => name === lastPathname
  );
  return (
    <div className={base_styles.page_container}>
      <LocationsMenu isBookingsSlot={true} isFullScreen={isFullScreenMenu} />
      <Outlet />
    </div>
  );
};
