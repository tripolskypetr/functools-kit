/**
 * Returns the error message from the given error object.
 *
 * @param error - The error object.
 * @returns The error message.
 */
export const getErrorMessage = (error: any) => {
    let errorMessage = 'Unknown error';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null) {
      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else {
        errorMessage = error.toString();
      }
    }
    return errorMessage;
};

export default getErrorMessage;
