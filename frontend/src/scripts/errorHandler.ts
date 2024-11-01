import { errorStore } from "../store/store";

export const errorHandler = (
  errorTitle: string,
  error: { description: unknown; statusCode?: number | null },
  action?: () => void
) => {
  const errorModal = errorStore.getState().modal;
  const setIsErrorModal = errorStore.getState().setIsErrorModal;
  const baseErrorMsg = "Something went wrong";
  let errorDescription: string = "";

  if (error.description instanceof Error) {
    errorDescription = error.description.message;
  } else if (typeof error.description === "string") {
    errorDescription = error.description;
  } else {
    error.description = baseErrorMsg;
  }
  setIsErrorModal({
    isModalError: true,
    errorTitle,
    errorDescription,
    statusCode: error.statusCode
      ? error.statusCode
      : errorModal.statusCode
      ? errorModal.statusCode
      : null,
    action,
  });
  throw new Error(
    errorDescription !== baseErrorMsg
      ? errorDescription
      : "An untyped error occurred from fetchRequest"
  );
};
