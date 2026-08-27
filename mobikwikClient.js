const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { encryptPayload } = require("./encryptionService");

const publicKeyPath = path.resolve(__dirname, "public_key.pem");
const publicKey = fs.readFileSync(publicKeyPath, "utf8");

const BASE_URL = process.env.MOBIKWIK_BASE_URL || "https://alpha3.mobikwik.com";
const CLIENT_ID =
  process.env.MOBIKWIK_CLIENT_ID || "RCH_WeRKS9w5ZyIWf7zkbZOt8Q";
const CLIENT_SECRET =
  process.env.MOBIKWIK_CLIENT_SECRET ||
  "T_Wps3XQYb7B-7TeZTMlI4NCgPEuX5cgR-oxPqfGmCs"; // Will fetch token if present, or test with available endpoints

async function getToken(clientId, clientSecret) {
  try {
    const res = await axios.post(
      `${BASE_URL}/recharge/v1/verify/retailer`,
      {
        clientId,
        clientSecret,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      },
    );
    return res.data;
  } catch (err) {
    if (err.response) {
      return err.response.data;
    }
    return { error: err.message };
  }
}

async function callEncryptedApi(
  endpoint,
  plainPayload,
  token,
  keyVersion = "1.0",
) {
  const encryptedEnvelope = encryptPayload(plainPayload, publicKey, keyVersion);

  try {
    const res = await axios.post(`${BASE_URL}${endpoint}`, encryptedEnvelope, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      timeout: 15000,
    });
    return {
      success: true,
      endpoint,
      plainPayload,
      encryptedEnvelope,
      status: res.status,
      responseData: res.data,
    };
  } catch (err) {
    return {
      success: false,
      endpoint,
      plainPayload,
      encryptedEnvelope,
      status: err.response ? err.response.status : null,
      responseData: err.response ? err.response.data : { error: err.message },
    };
  }
}

async function runAll() {
  console.log("==================================================");
  console.log("Running MobiKwik Encryption API Client Test Suite");
  console.log("==================================================");

  // 1. Auth Token API Test (Failed case with dummy secret to demonstrate rejection)
  console.log("\n1. Testing Auth Token API (Negative Case)...");
  const authNeg = await getToken("INVALID_CLIENT", "INVALID_SECRET");
  console.log("Auth Response (Negative):", JSON.stringify(authNeg, null, 2));

  // 2. Encryption Test Payload
  const testToken = "3i6CXDh-ihdb-oySiDm04ZBqS2-1dHIbNoOqNQ3lCfY";

  const reqid = `tessjdk103${Date.now()}`;
  const failedReqid = `tessjdk10311${Date.now()}`;

  const apisToTest = [
    {
      name: "Balance Inquiry",
      endpoint: "/recharge/v3/retailerBalance",
      payload: { memberId: "testalpha1@gmail.com" },
    },
    {
      name: "Validation",
      endpoint: "/recharge/v3/retailerValidation",
      payload: {
        amt: "1",
        cn: "9997457557",
        op: "338",
        cir: "22",
        planCode: "Vi-UP-WEST-Uttarakhand-121-made-for-you-Rs-1.0",
        adParams: {},
      },
      failedPayload: {
        cn: "9876543210",
        op: "7",
        cir: "",
        amt: "10",
        reqid: "1772278452624302713",
        remitterName: "UAT Tester",
        paymentRefID: "1772278452624302713",
        paymentMode: "UPI",
        paymentAccountInfo: "uat@okaxis",
      },
    },
    {
      name: "View Bill",
      endpoint: "/recharge/v3/retailerViewbill",
      payload: { cn: "80003948751", op: "249", cir: "1", adParams: {} },
      failedPayload: { cn: "211", op: "432423", cir: "2", adParams: {} },
    },
    {
      name: "Recharge Payment",
      endpoint: "/recharge/v3/retailerPayment",
      payload: {
        cn: "9876543210",
        op: "7",
        cir: "",
        amt: "10",
        reqid: "1772278452624302713",
        remitterName: "UAT Tester",
        paymentRefID: "1772278452624302713",
        paymentMode: "UPI",
        paymentAccountInfo: "uat@okaxis",
      },
      failedPayload: {
        cn: "121",
        op: "1",
        cir: "",
        amt: "10",
        reqid: failedReqid,
        remitterName: "dsada",
        paymentRefID: failedReqid,
        paymentMode: "asd",
        paymentAccountInfo: "sad@ybl",
      },
    },
    {
      name: "Transaction Status",
      endpoint: "/recharge/v3/retailerStatus",
      payload: {
        txId: reqid,
      },
      failedPayload: {
        txId: failedReqid,
      },
    },
    {
      name: "Credit card bill",
      endpoint: "/recharge/v3/retailerCCBill",
      payload: {
        last4: "4357",
        mobile: "7865789567",
        agentId: "MK01HFUIQ532563526",
        bankCode: "AXIS",
      },
      failedPayload: {
        last4: "4358",
        mobile: "7865789568",
        agentId: "MK01HFUIQ532563527",
        bankCode: "HDFC",
      },
    },
  ];

  const results = [];
  for (const api of apisToTest) {
    console.log(`\nTesting ${api.name} (${api.endpoint})...`);
    const res = await callEncryptedApi(api.endpoint, api.payload, testToken);
    console.log("Plain Payload:", JSON.stringify(api.payload, null, 2));
    console.log(
      "Encrypted Payload Envelope:",
      JSON.stringify(res.encryptedEnvelope, null, 2),
    );
    console.log("API Response:", JSON.stringify(res.responseData, null, 2));
    results.push(res);

    if (api.failedPayload) {
      const failedRes = await callEncryptedApi(
        api.endpoint,
        api.failedPayload,
        testToken,
      );
      console.log(
        "failedRes Plain Payload:",
        JSON.stringify(api.payload, null, 2),
      );
      console.log(
        "failedRes Encrypted Payload Envelope:",
        JSON.stringify(failedRes.encryptedEnvelope, null, 2),
      );
      console.log(
        "API Response:",
        JSON.stringify(failedRes.responseData, null, 2),
      );
      results.push(failedRes);
    }
  }

  console.log("\n==================================================");
  console.log("API Test Execution Completed Successfully!");
  console.log("==================================================");

  // Write results to JSON in encryption directory
  fs.writeFileSync(
    path.resolve(__dirname, "api_execution_results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("Results saved to encryption/api_execution_results.json");
}

runAll();
