// Enhanced postMessage handler with consistent API design
export default function () {
  // Status constants for clear, descriptive responses
  const STATUS = {
    SUCCESS: "success",
    ERROR: "error",
    PENDING: "pending",
    CANCELLED: "cancelled",
  };

  // Helper function to send standardized responses
  function sendResponse(
    originalEvent,
    action,
    status,
    payload = null,
    error = null
  ) {
    const response = {
      ext: "cashu",
      type: "cashu.response",
      action: action,
      status: status,
      id: originalEvent.data.id,
      timestamp: Date.now(),
    };

    // Always include payload if provided, regardless of status
    if (payload) {
      response.payload = payload;
    }

    // Always include error if provided, regardless of status
    if (error) {
      response.error = {
        message: error.message || error,
        code: error.code || "UNKNOWN_ERROR",
      };
    }

    window.parent.postMessage(response, "*");
  }

  // Listen for postMessages from browser extension
  addEventListener("message", async (event) => {
    // Validate message structure
    if (!event.data?.ext === "cashu" || !event.data?.id) {
      return;
    }

    switch (event.data.ext) {
      case "cashu":
        switch (event.data.type) {
          case "lnpay":
            try {
              sendResponse(event, "cashu.dialog.opened", STATUS.PENDING, {
                message: "Token dialog is open",
                token: event.data.params.token,
                status: "ready_for_claim",
              });
              const { useWalletStore } = await import("src/stores/wallet");
              const walletStore = useWalletStore();

              const { amount, comment, addrOrLnurl } = event.data.params;

              const result = await walletStore.lnurlPayFirst(
                addrOrLnurl,
                amount,
                comment
              );

              sendResponse(event, "cashu.payment.completed", STATUS.SUCCESS, {
                transaction: result,
                amount: amount,
                address: addrOrLnurl,
              });
            } catch (error) {
              sendResponse(event, "cashu.payment.failed", STATUS.ERROR, null, {
                message: error.message,
                code: "PAYMENT_ERROR",
              });
            }
            break;

          case "claimToken":
            try {
              const { useReceiveTokensStore } = await import(
                "src/stores/receiveTokensStore"
              );
              const receiveTokensStore = useReceiveTokensStore();

              // Set the token to be redeemed
              receiveTokensStore.receiveData.tokensBase64 =
                event.data.params.token;
              receiveTokensStore.showReceiveTokens = true;

              sendResponse(event, "cashu.dialog.opened", STATUS.SUCCESS, {
                message: "Token dialog is open",
                token: event.data.params.token,
                status: "ready_for_claim",
              });
            } catch (error) {
              sendResponse(event, "cashu.dialog.error", STATUS.ERROR, null, {
                message: error.message,
                code: "DIALOG_ERROR",
              });
            }
            break;

          // New action for checking wallet status
          case "getWalletStatus":
            try {
              const { useWalletStore } = await import("src/stores/wallet");
              const walletStore = useWalletStore();

              sendResponse(event, "cashu.wallet.status", STATUS.SUCCESS, {
                balance: walletStore.balance,
                connected: walletStore.isConnected,
                mints: walletStore.activeMints,
              });
            } catch (error) {
              sendResponse(
                event,
                "cashu.wallet.error",
                STATUS.ERROR,
                null,
                error
              );
            }
            break;

          default:
            sendResponse(event, "cashu.error.unsupported", STATUS.ERROR, null, {
              message: `Unsupported action type: ${event.data.type}`,
              code: "UNSUPPORTED_ACTION",
            });
        }
        break;
    }
  });

  // Optional: Send ready signal when extension loads
  window.parent.postMessage(
    {
      ext: "cashu",
      type: "cashu.response",
      action: "cashu.extension.ready",
      status: STATUS.SUCCESS,
      timestamp: Date.now(),
      payload: {
        version: "1.0.0",
        capabilities: ["lnpay", "claimToken", "getWalletStatus"],
      },
    },
    "*"
  );
}
