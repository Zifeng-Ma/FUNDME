The Development Process (Step-by-Step)

Here is your exact playbook to build the **cMED Patient Portal** during the hackathon:

#### Phase 1: Setup & Smart Contracts (Days 1-3)
1.  **Clone the Starter:** Clone the Nox JS Starter Kit from GitHub. Run `npm install`.
2.  **Write the cMED Contract (Solidity):**
    *   Create a contract called `cMEDToken.sol`. Import the Nox ERC-7984 library.
    *   Create a contract called `MedicalRegistry.sol`. This will store the ACLs (who can access what).
    *   Instead of storing the actual patient data, store the **Encrypted Handle** provided by Nox.
3.  **Deploy Locally:** Use Hardhat to deploy these contracts to a local test network so you can interact with them.

#### Phase 2: Frontend & Wallet Integration (Days 4-6)
1.  **Build the UI:** In React, create two simple views: `/patient` and `/hospital`.
2.  **Add Wallet Login:** Integrate RainbowKit. When the user connects, check their address.
    *   *Tip:* Hardcode one of your MetaMask test wallets to always be recognized as the "Hospital Admin" so you can easily demonstrate the two different views.
3.  **Connect to Contract:** Use Wagmi/Viem to read data from your deployed `MedicalRegistry.sol` (e.g., displaying the patient's current cMED balance).

#### Phase 3: The Nox JS Magic (Days 7-10)
This is where the hackathon is won. You will wire up the Nox SDK to your buttons.
1.  **The Upload Button (Patient View):**
    *   *Action:* Patient enters data -> JS runs `nox.encrypt(data)` -> You upload the encrypted text to IPFS -> You send a blockchain transaction saving the IPFS link & the Nox Handle to `MedicalRegistry.sol`.
2.  **The Grant Button (Patient View):**
    *   *Action:* Patient selects "Amsterdam Hospital" -> JS triggers a transaction updating the ACL in `MedicalRegistry.sol` to `true`.
3.  **The View Button (Hospital View):**
    *   *Action:* Doctor clicks view -> JS reads the Handle from the blockchain -> JS runs `nox.decrypt(handle)` -> Nox checks the ACL, sees it is `true`, and decrypts the data in the browser.

#### Phase 4: Polish & Pitch (Days 11-14)
*   **Make it look real:** Add some dummy data (fake patient names, fake hospital logos).
*   **Highlight the "Confidential Token" aspect:** Make sure the UI clearly shows the **cMED** token balances moving (Hospital locking up cMED to request data, Patient receiving cMED). Emphasize that *nobody else on the blockchain* can see these transaction amounts because you used Nox!

### Summary of your workflow:
**Write Solidity -> Deploy with Hardhat -> Build React UI -> Connect MetaMask -> Encrypt/Decrypt with Nox JS SDK.** 

You are now using the exact industry-standard stack that professional Web3 developers use!
