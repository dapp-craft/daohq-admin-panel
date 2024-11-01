import { lazy, Suspense } from "react";
import auth from "../../styles/modules/auth.module.scss";
import loaders from "../../styles/modules/loaders.module.scss";
import { errorStore } from "../../store/store";
import { ErrorModal } from "../Error/ErrorModal";

const AuthForm = lazy(() => import("./AuthForm"));

export const Auth = () => {
  const { modal } = errorStore();

  return (
    <>
      {modal.isModalError ? <ErrorModal /> : null}
      <div className={auth.login_grid}>
        <div className={auth.login_container}>
          <div className={auth.cover}>
            <img
              className={auth.cover_img}
              src="/images/auth_form_img.jpeg"
              alt="auth_form_img"
            />
          </div>
          <div className={auth.login_form}>
            <h1>DAO HQ Scene</h1>
            <p>Book rooms and edit events</p>
            <Suspense fallback={<FormLoader />}>
              <AuthForm />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
};

const FormLoader = () => {
  return (
    <div className={loaders.auth_form_loader_wrap}>
      <div className={loaders.loader_ring} />
    </div>
  );
};
