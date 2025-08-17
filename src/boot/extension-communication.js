
// This file handles communication with the browser extension and only runs once

export default function () {
  // Listen for postMessages from browser extension
  // This will only run once when the app starts
  addEventListener("message", async (event) => {  
    switch (event.data.ext) {
      case 'cashu':
        switch (event.data.type) {
          case 'lnpay':
            // Import the wallet store to handle lightning payments
            const { useWalletStore } = await import('src/stores/wallet');
            const walletStore = useWalletStore();

            // Call the lnurlPayFirst method to handle lightning address payments
            // This will open the lightning payment modal (PayInvoiceDialog)
            // Pass predefined amount and comment if provided
            const predefinedAmount = event.data.params.amount;
            const predefinedComment = event.data.params.comment;
            await walletStore.lnurlPayFirst(event.data.params.addrOrLnurl, predefinedAmount, predefinedComment);
            break;
          case 'claimToken':
            // Import the receive tokens store to handle token redemption
            const { useReceiveTokensStore } = await import('src/stores/receiveTokensStore');
            const receiveTokensStore = useReceiveTokensStore();

            // Set the token to be redeemed
            receiveTokensStore.receiveData.tokensBase64 = event.data.params.token;
            
            // Open the receive token dialog
            receiveTokensStore.showReceiveTokens = true;
            break;
        }
        break;
    }
  });
}