import { useEffect } from "react";
import modal_styles from "../../styles/modules/confirmModal.module.scss";

export const ConfirmActionModal = (props: {
  actionMsg: string;
  yesActionEvent: () => void;
  noActionEvent: () => void;
  modalPrefix: string;
  itemName?: string;
  contentType?: string;
}) => {
  const {
    actionMsg,
    itemName,
    contentType,
    yesActionEvent,
    noActionEvent,
    modalPrefix,
  } = props;

  const handleWindowClick = (event: MouseEvent) => {
    if (event.target) {
      const elem = event.target as HTMLElement;
      const btnPrefix = elem.dataset.modal_btn_prefix;
      if (modalPrefix !== btnPrefix) noActionEvent();
    }
  };

  useEffect(() => {
    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, []);

  return (
    <div
      className={modal_styles.confirm_del_modal}
      data-modal_btn_prefix={modalPrefix}
    >
      {actionMsg}{" "}
      {itemName ? (
        <span data-modal_btn_prefix={modalPrefix}>
          {itemName.length > 15
            ? itemName.slice(0, 15).concat("...")
            : itemName}
        </span>
      ) : (
        ""
      )}{" "}
      {contentType ? contentType : ""}?
      <div
        data-modal_btn_prefix={modalPrefix}
        className={modal_styles.confirm_del_modal_btns_wrap}
      >
        <button
          className={modal_styles.confirm_del_modal_btn}
          onClick={yesActionEvent}
          data-modal_btn_prefix={modalPrefix}
        >
          YES
        </button>
        <button
          className={modal_styles.confirm_del_modal_btn}
          onClick={noActionEvent}
          data-modal_btn_prefix={modalPrefix}
        >
          NO
        </button>
      </div>
    </div>
  );
};
