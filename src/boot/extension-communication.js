// Status constants for clear, descriptive responses
const STATUS = {
  SUCCESS: "success",
  ERROR: "error",
  PENDING: "pending",
  CANCELLED: "cancelled",
};

// Helper function to send standardized responses
function sendResponse({
  originalEvent,
  action,
  status,
  payload = null,
  error = null,
}) {
  const response = {
    ext: "cashu",
    type: "cashu.response",
    action: action,
    status: status,
    id: originalEvent.data.id,
    timestamp: Date.now(),
    payload: payload,
  };

  // Always include error if provided, regardless of status
  if (error) {
    response.error = {
      message: error.message || error,
      code: error.code || "UNKNOWN_ERROR",
    };
  }

  window.parent.postMessage(response, originalEvent.origin);
}

export default function () {
  // Listen for postMessages from browser extension
  addEventListener("message", async (event) => {
    // Validate message structure
    if (!event.data?.ext === "cashu" || !event.data?.id) {
      return;
    }

    switch (event.data.ext) {
      case "cashu":
        try {
          const { useWalletStore } = await import("src/stores/wallet");
          const walletStore = useWalletStore();
          switch (event.data.type) {
            case "lnpay":
              const { amount, comment, addrOrLnurl } = event.data.params;

              const result = await walletStore.lnurlPayFirst(
                addrOrLnurl,
                amount,
                comment
              );

              sendResponse({
                originalEvent: event,
                action: "cashu.dialog.opened",
                status: STATUS.SUCCESS,
                payload: {
                  message: "Token dialog is open",
                  token: event.data.params.token,
                  status: "ready_for_claim",
                },
              });
              break;

            case "claimToken":
              const { useReceiveTokensStore } = await import(
                "src/stores/receiveTokensStore"
              );
              const receiveTokensStore = useReceiveTokensStore();

              // Set the token to be redeemed
              receiveTokensStore.receiveData.tokensBase64 =
                event.data.params.token;
              receiveTokensStore.showReceiveTokens = true;
              sendResponse({
                originalEvent: event,
                action: "cashu.dialog.opened",
                status: STATUS.SUCCESS,
                payload: {
                  message: "Token dialog is open",
                  token: event.data.params.token,
                  status: "ready_for_claim",
                },
              });
              break;

            // New action for checking wallet status
            case "getWalletStatus":
              sendResponse({
                originalEvent: event,
                action: "cashu.wallet.status",
                status: STATUS.SUCCESS,
                payload: {
                  balance: walletStore.balance,
                  connected: walletStore.isConnected,
                  mints: walletStore.mints,
                },
              });
              break;

            default:
              sendResponse({
                originalEvent: event,
                action: "cashu.error.unsupported",
                status: STATUS.ERROR,
                error: {
                  message: `Unsupported action type: ${event.data.type}`,
                  code: "UNSUPPORTED_ACTION",
                },
              });
          }
        } catch (error) {
          sendResponse({
            originalEvent: event,
            action: "cashu.error",
            status: STATUS.ERROR,
            error: {
              message: error.message,
              code: "PAYMENT_ERROR",
            },
          });
        }
        break;
    }
  });

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
