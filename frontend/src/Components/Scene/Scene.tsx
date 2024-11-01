import { Outlet, useLocation } from "react-router-dom";
import base_styles from "../../styles/base.module.scss";
import scene from "../../styles/modules/scene.module.scss";
import LocationsMenu from "../Booking/LocationsMenu";
import { layoutPagesNames } from "../Layout/AdminLayout";
import LocationPreview from "../Layout/LocationPreview";

export const Scene = () => {
  const { pathname } = useLocation();
  const lastPathname: string = pathname.split("/").slice(-1)[0];
  const isFullScreenMenu: boolean = layoutPagesNames.some(
    (name) => name === lastPathname
  );

  return (
    <div className={base_styles.page_container}>
      <LocationsMenu isBookingsSlot={false} isFullScreen={isFullScreenMenu} />
      <div className={!isFullScreenMenu ? scene.start_panel_wrap : ""}>
        {!isFullScreenMenu ? <LocationPreview /> : null}
        <Outlet />
      </div>
    </div>
  );
};
