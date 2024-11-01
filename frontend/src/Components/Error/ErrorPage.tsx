import { Link, useRouteError } from "react-router-dom";
import error_styles from "../../styles/modules/errorPage.module.scss";

export default function ErrorPage() {
  const error = useRouteError() as object;
  console.error(error);

  return (
    <div className={error_styles.page_bg}>
      <div id="error-page">
        <div className={error_styles.page_title_wrap}>
          <div className={error_styles.page_title_logo_wrap}>
            <img src="/logo.svg" alt="logo_icon" />
          </div>
          <h1 className={error_styles.page_title}>DAO HQ Admin Panel</h1>
        </div>
        <h2 className={error_styles.error_title}>Oops!</h2>
        <p className={error_styles.error_text}>
          Sorry, an unexpected error has occurred.
        </p>
        <p className={error_styles.error_text}>
          <i>
            {"statusText" in error
              ? `${error.statusText}`
              : "message" in error
              ? `${error.message}`
              : "Unknown error"}
          </i>
        </p>
        <div className={error_styles.error_link_wrap}>
          <Link className={error_styles.error_link} to={"/"}>
            Go to Home Page
          </Link>
        </div>
      </div>
    </div>
  );
}
