// import { useNavigate } from "react-router-dom";
import { errorStore } from "../../store/store";
import error from "../../styles/modules/errorModal.module.scss";
import { breadcrumbSync } from "../../scripts/breadcrumbSync";
import { useEffect } from "react";

export const ErrorModal = () => {
  const { modal, setIsErrorModal } = errorStore();

  const handleCloseModal = () => {
    if (modal.action) modal.action();
    breadcrumbSync();
    setIsErrorModal({
      isModalError: false,
      errorTitle: null,
      errorDescription: null,
      statusCode: null,
      action: null,
    });
    document.body.style.overflow = "scroll";
  };

  useEffect(() => {
    console.log("error modal data :>> ", modal);
    document.body.style.overflow = "hidden";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className={error.modal_wrap}>
      <div className={error.modal}>
        <div className={error.modal_img_wrap}>
          <img width={80} height={80} src="/icons/error.svg" alt="error_icon" />
          <p className={error.modal_title}>Error!</p>
        </div>
        <p className={error.modal_description_header}>{modal.errorTitle}</p>
        {modal.statusCode ? (
          <p
            className={`${error.modal_description_text} ${error.modal_description_code}`}
          >{`Error status code: ${modal.statusCode}`}</p>
        ) : null}
        <p className={error.modal_description_text}>{modal.errorDescription}</p>
        <div className={error.modal_button_wrap} onClick={handleCloseModal}>
          <button className={error.modal_button}>OK</button>
        </div>
      </div>
    </div>
  );
};
